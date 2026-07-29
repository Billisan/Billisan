"""우산 파손 검수 추론 파이프라인 (온디바이스).

`DESCRIPTION.md` §4의 3-컴포넌트를 통합한다:

    ① DETECT        YOLOv8n으로 우산 존재 확인 + bbox 취득
    ② QUALITY       규칙 기반 품질 게이트 (블러·크기·잘림·탐지신뢰도)
    ③ DAMAGE_CHECK  crop → PatchCore(ONNX) → normScore → 판정 밴드

의존성 원칙: 판정식은 `decision.py`, 크롭은 `crop.py`를 쓴다. **학습(`train.py`)과 같은 코드**여야
임계값이 유효하다. PatchCore는 ONNX Runtime으로 돌리므로 Jetson에 anomalib이 필요 없다.

**모델 없이도 실행된다.** `--model_dir`를 주지 않으면 ①②만 수행하는 *게이트 검증 모드*로 동작한다.
학습 데이터가 없는 단계에서 품질 게이트 임계값을 실물로 튜닝할 때 쓴다.

사용 예:
    python infer.py --source 0                              # 라이브, 게이트만
    python infer.py --source 0 --model_dir weights/dmg-...  # 전체 파이프라인
    python infer.py --source photo.jpg --model_dir weights/dmg-...
    python infer.py --source shots/ --model_dir weights/... --jsonl out.jsonl
"""

import argparse
import json
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import cv2
import numpy as np

from crop import crop_umbrella, preprocess, to_square_bbox
from decision import DecisionContract, VERDICT_NAMES

ROOT = Path(__file__).resolve().parent
UMBRELLA_CLASS_ID = 25  # COCO
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ── 재촬영·타임아웃 정책 (DESCRIPTION.md 판정 로직 (5)) ──────────────────────
MAX_RETRIES = 2          # DETECT/QUALITY 각각 재촬영 2회 = 총 3시도
TOTAL_TIMEOUT_S = 5.0    # 파손 검수 전체 타임아웃 → 초과 시 FAILED


@dataclass
class QualityConfig:
    """② 품질 게이트 임계값.

    ⚠️ **전부 초기값이며 실물 데이터로 튜닝해야 한다.** 조명·카메라·거리가 바뀌면 특히
    블러 임계값이 크게 달라진다. `--source`에 파일럿 사진 폴더를 주고 출력되는 metrics를
    보면서 조정할 것. (`DESCRIPTION.md` 판정 로직 — 품질 게이트 수치는 미확정 항목)
    """
    min_detect_conf: float = 0.35   # 탐지 임계값(0.25)보다 높게 — 경계 검출은 bbox도 부정확
    min_blur_var: float = 60.0      # 라플라시안 분산. 낮을수록 흐림
    min_area_ratio: float = 0.05    # 너무 멀리 들면 해상도 부족
    max_area_ratio: float = 0.85    # 너무 가까우면 캐노피가 프레임을 벗어남
    edge_margin_px: int = 4         # bbox가 프레임 가장자리에 이만큼 붙으면 잘린 것으로 본다
    max_aspect_ratio: float = 1.15  # bbox 긴변/짧은변. 학습은 정면 위주라, 측면으로 크게
                                     # 기울이면 원형 캐노피가 타원으로 찌그러져 bbox도 정사각(≈1.0)
                                     # 에서 크게 벗어난다 — 이 경우 PatchCore가 처음 보는 형태라
                                     # 파손이 아닌데도 DAMAGED로 오판한다(2026-07-29 라이브 검증
                                     # 중 실측 확인, ENV_SENSITIVITY_ANALYSIS.md §3-13). 파손 여부와
                                     # 무관한 "각도 문제"이므로 DAMAGE_CHECK 이전, 여기서 걸러
                                     # RETRY로 돌린다.
                                     # ⚠️ 값 변천: 1.4(최초, 뚜렷한 측면 aspect 1.388·DAMAGED 오판을
                                     # 못 거름) → 1.25(1차 조정, 여전히 aspect 1.20 수준에서
                                     # UNCERTAIN까지 올라가는 것 확인) → **1.15**(2026-07-30, §3-17,
                                     # 사용자 실측 관찰: 각도가 커질수록 PASS→UNCERTAIN→DAMAGED로
                                     # 점진 악화되고 RETRY는 너무 늦게 걸림 — DAMAGED가 뜨기 전에
                                     # 반드시 RETRY로 끊기도록 더 엄격하게 조정). 대가: 정면이어도
                                     # 자연스러운 손떨림으로 RETRY가 다소 자주 뜰 수 있음 — 각도발
                                     # DAMAGED 오판 방지를 우선한 의도적 트레이드오프. 여전히
                                     # 실물 튜닝 대상, 다음 세션에서 재검증할 것


@dataclass
class StageResult:
    stage: str
    ok: bool
    reason: str = ""
    metrics: dict = field(default_factory=dict)


class UmbrellaInspector:
    def __init__(self, model_dir: Path | None, detector_path: str,
                 quality: QualityConfig, detect_conf: float = 0.25):
        from ultralytics import YOLO

        self.detector = YOLO(detector_path)
        self.detect_conf = detect_conf
        self.quality_cfg = quality
        self.contract: DecisionContract | None = None
        self.session = None

        if model_dir is not None:
            meta_path = Path(model_dir) / "metadata.json"
            if not meta_path.is_file():
                raise SystemExit(f"metadata.json이 없습니다: {meta_path}")
            self.contract = DecisionContract.from_file(meta_path)
            onnx_path = Path(model_dir) / "weights" / "onnx" / "model.onnx"
            if not onnx_path.is_file():
                raise SystemExit(f"model.onnx가 없습니다: {onnx_path}")
            import onnxruntime as ort

            # Jetson에서는 CUDA/TensorRT EP가 앞에 오도록 두고, 없으면 CPU로 폴백한다.
            avail = ort.get_available_providers()
            prefer = [p for p in ("TensorrtExecutionProvider", "CUDAExecutionProvider",
                                  "CPUExecutionProvider") if p in avail]
            self.session = ort.InferenceSession(str(onnx_path), providers=prefer)
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [o.name for o in self.session.get_outputs()]
            print(f"[model] {self.contract!r}")
            print(f"[model] providers={self.session.get_providers()}")
            if self.contract.score_max_estimated:
                print("  ⚠️ scoreMax가 추정치입니다 — DAMAGED 경계가 잠정입니다.")

    # ── ① DETECT ────────────────────────────────────────────────────────────
    def detect(self, frame) -> StageResult:
        res = self.detector.predict(frame, conf=self.detect_conf,
                                    classes=[UMBRELLA_CLASS_ID], verbose=False)[0]
        if not len(res.boxes):
            return StageResult("DETECT", False, "우산 미검출", {"detections": 0})
        best = max(res.boxes, key=lambda b: float(b.conf.item()))
        conf = float(best.conf.item())
        bbox = [float(v) for v in best.xyxy[0].tolist()]
        return StageResult("DETECT", True, "", {
            "detections": len(res.boxes), "confidence": conf, "bbox": bbox,
        })

    # ── ② QUALITY ───────────────────────────────────────────────────────────
    def check_quality(self, frame, det: StageResult) -> StageResult:
        cfg = self.quality_cfg
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = det.metrics["bbox"]
        conf = det.metrics["confidence"]

        area_ratio = ((x2 - x1) * (y2 - y1)) / float(w * h)
        # 블러는 bbox 안쪽만 본다 — 배경이 흐린 건 상관없다
        sx1, sy1, sx2, sy2 = to_square_bbox([x1, y1, x2, y2], w, h, 0.0)
        region = frame[sy1:sy2, sx1:sx2]
        blur_var = float(cv2.Laplacian(cv2.cvtColor(region, cv2.COLOR_BGR2GRAY),
                                       cv2.CV_64F).var()) if region.size else 0.0
        m = cfg.edge_margin_px
        truncated = bool(x1 <= m or y1 <= m or x2 >= w - m or y2 >= h - m)
        # bbox 긴변/짧은변 — 정면(원형 캐노피)이면 ≈1.0, 측면으로 기울수록 커진다.
        bw, bh = (x2 - x1), (y2 - y1)
        aspect_ratio = max(bw, bh) / max(min(bw, bh), 1e-6)

        # ⚠️ 키 이름을 'confidence'로 쓰지 않는다. ③의 판정 확신도와 충돌해 덮어써진다
        #    (서버 payload의 confidence는 **판정 확신도**여야 한다).
        metrics = {"detectConf": round(conf, 4), "areaRatio": round(area_ratio, 4),
                   "blurVar": round(blur_var, 1), "truncated": truncated,
                   "aspectRatio": round(aspect_ratio, 3)}

        if conf < cfg.min_detect_conf:
            return StageResult("QUALITY", False, f"탐지 신뢰도 낮음({conf:.2f})", metrics)
        if blur_var < cfg.min_blur_var:
            return StageResult("QUALITY", False, f"흐림(라플라시안 {blur_var:.0f})", metrics)
        if area_ratio < cfg.min_area_ratio:
            return StageResult("QUALITY", False, "우산이 너무 작음(멀리 있음)", metrics)
        if area_ratio > cfg.max_area_ratio:
            return StageResult("QUALITY", False, "우산이 너무 큼(가까움)", metrics)
        if truncated:
            return StageResult("QUALITY", False, "우산이 프레임에 잘림", metrics)
        if aspect_ratio > cfg.max_aspect_ratio:
            return StageResult("QUALITY", False, f"측면 각도로 추정(bbox 비율 {aspect_ratio:.2f})", metrics)
        return StageResult("QUALITY", True, "", metrics)

    # ── ③ DAMAGE_CHECK ──────────────────────────────────────────────────────
    def check_damage(self, frame, det: StageResult) -> StageResult:
        c = self.contract
        cropped = crop_umbrella(frame, det.metrics["bbox"], c.crop_mode, c.crop_padding)
        if cropped is None or cropped.size == 0:
            return StageResult("DAMAGE_CHECK", False, "크롭 실패", {})
        x = preprocess(cropped, c.image_size, c.mean, c.std, c.apply_normalize)
        out = self.session.run(None, {self.input_name: x})
        raw = float(np.atleast_1d(out[self.output_names.index("pred_score")])[0])
        decided = c.decide(raw)
        decided["rawScore"] = raw          # 서버로 보내지 않는다 — 로컬 로그·임계값 재조정용
        return StageResult("DAMAGE_CHECK", True, "", decided)

    # ── 프리뷰 (SPACE 없이 매 프레임 호출 — DAMAGE_CHECK는 절대 돌리지 않는다) ──
    def preview(self, frame) -> tuple[str, str, dict]:
        """가벼운 미리보기: ①DETECT ②QUALITY만 수행. ③DAMAGE_CHECK(ONNX)는 모델 로드
        여부와 무관하게 절대 실행하지 않는다.

        과거엔 라이브 루프가 `inspect_once`를 그대로 매 프레임 호출해 `--model_dir` 지정
        시 PatchCore ONNX까지 매 프레임 돌고 있었다(EVAL_NOTES.md §2-2, 43/43 미검출 사고의
        배경). `face_matching/pipeline.py`의 preview()가 같은 문제를 검출-only 프리뷰로
        구조적으로 막은 것과 동일한 방식으로 여기도 맞춘다.
        """
        det = self.detect(frame)
        if not det.ok:
            return "DETECT", "RETRY", det.metrics | {"reason": det.reason}
        q = self.check_quality(frame, det)
        if not q.ok:
            return "QUALITY", "RETRY", q.metrics | {"reason": q.reason}
        return "QUALITY", "GATE_PASS", det.metrics | q.metrics

    # ── 프리뷰 + 실시간 파손 점수 (2026-07-28 신규, UI 표시 전용) ──────────────
    def preview_live_score(self, frame) -> tuple[str, str, dict]:
        """`preview()` + ③DAMAGE_CHECK 1회. **화면 실시간 표시 전용이며 "공식 검수"가
        아니다** — `inspect()`처럼 재시도(attempts)·타임아웃 정책을 타지 않고, 서버로
        보내는 payload도 안 만든다. SPACE로 트리거하는 `inspect()`(공식 반납 검수 기록)와는
        완전히 분리돼 있어 지연시간(43~54ms 실측)만 문제없다면 매 프레임 불러도 안전하다.

        ⚠️ 이건 2026-07-25 사고(EVAL_NOTES.md §2-2, `preview()`가 `inspect_once`를 그대로
        불러 매 프레임 PatchCore를 돌리다가 SPACE 트리거 자체가 뭘 트리거한 건지 헷갈렸던
        사고)와는 다르다. 그때 문제는 "공식 검수 로직(재시도·확정 판정)"이 매 프레임 돌아
        SPACE의 의미가 없어진 것이었다 — 여기는 재시도·확정 없이 순수 점수만 매 프레임
        갱신하고, SPACE는 여전히 `inspect()`를 통해서만 공식 결과를 만든다.
        """
        det = self.detect(frame)
        if not det.ok:
            return "DETECT", "RETRY", det.metrics | {"reason": det.reason}
        q = self.check_quality(frame, det)
        if not q.ok:
            return "QUALITY", "RETRY", q.metrics | {"reason": q.reason}
        if self.contract is None:
            return "QUALITY", "GATE_PASS", det.metrics | q.metrics
        d = self.check_damage(frame, det)
        if not d.ok:
            return "DAMAGE_CHECK", "UNCERTAIN", q.metrics | {"reason": d.reason}
        return "DAMAGE_CHECK", d.metrics["result"], det.metrics | q.metrics | d.metrics

    # ── 1회 검사 (공식 검수 전용 — `inspect()`의 재시도 루프에서만 호출) ───────
    def inspect_once(self, frame) -> tuple[str, str, dict]:
        """(stage, result, metrics). result는 NORMAL/DAMAGED/UNCERTAIN/RETRY 중 하나."""
        det = self.detect(frame)
        if not det.ok:
            return "DETECT", "RETRY", det.metrics | {"reason": det.reason}

        q = self.check_quality(frame, det)
        if not q.ok:
            return "QUALITY", "RETRY", q.metrics | {"reason": q.reason}

        if self.contract is None:  # 게이트 검증 모드 — ③ 없음
            return "QUALITY", "GATE_PASS", det.metrics | q.metrics

        d = self.check_damage(frame, det)
        if not d.ok:
            return "DAMAGE_CHECK", "UNCERTAIN", q.metrics | {"reason": d.reason}
        # 순서 주의: ③의 confidence(판정 확신도)가 살아남아야 한다
        return "DAMAGE_CHECK", d.metrics["result"], det.metrics | q.metrics | d.metrics

    # ── 재촬영·타임아웃 포함 검사 ────────────────────────────────────────────
    def inspect(self, grab_frame, session_id="", return_id=None) -> dict:
        """`grab_frame()`으로 프레임을 얻어 최대 3회 시도한다.

        ⚠️ 어떤 결과가 나오든 **물리 반납은 진행**한다(CLAUDE.md). 여기서는 판정만 낸다.
        """
        started = time.perf_counter()
        stage, result, metrics = "DETECT", "RETRY", {}
        attempts = 0

        try:
            for attempts in range(1, MAX_RETRIES + 2):
                if time.perf_counter() - started > TOTAL_TIMEOUT_S:
                    stage, result = stage, "FAILED"
                    metrics["reason"] = f"타임아웃 {TOTAL_TIMEOUT_S}s 초과"
                    break
                frame = grab_frame()
                if frame is None:
                    stage, result = "DETECT", "FAILED"
                    metrics["reason"] = "프레임 취득 실패"
                    break
                stage, result, metrics = self.inspect_once(frame)
                if result != "RETRY":
                    break
            else:
                result = "UNCERTAIN"  # 재시도 소진
        except Exception as exc:  # noqa: BLE001 — 모델 예외는 즉시 FAILED (재시도 없음)
            stage, result = stage, "FAILED"
            metrics = {"reason": f"{type(exc).__name__}: {exc}"}

        if result == "RETRY":
            result = "UNCERTAIN"
            metrics.setdefault("reason", "재촬영 반복 실패")

        latency_ms = int((time.perf_counter() - started) * 1000)
        return self.build_payload(stage, result, metrics, latency_ms, attempts,
                                  session_id, return_id)

    def build_payload(self, stage, result, metrics, latency_ms, attempts,
                      session_id="", return_id=None) -> dict:
        """서버 `POST /api/devices/{deviceId}/inspection-results` payload.

        ⚠️ 원시 anomaly score와 이미지는 payload에 넣지 않는다(로컬 보관).
        """
        # confidence는 **판정 확신도**다(DESCRIPTION.md 판정 로직 (2)). ③이 없는 단계에서는
        # 그 단계의 지표를 대신 싣는다 — DETECT는 탐지 신뢰도, QUALITY는 게이트 마진.
        confidence = metrics.get("confidence")
        if confidence is None:
            confidence = metrics.get("detectConf", 0.0)
        payload = {
            "sessionId": session_id,
            "returnId": return_id,
            "requestId": f"req_dmg_{uuid.uuid4().hex[:16]}",
            "stage": stage,
            "result": result,
            "confidence": round(float(confidence), 4),
            "modelVersion": self.contract.model_version if self.contract else None,
            "latencyMs": latency_ms,
            "imageRef": None,   # 업로드 경로 미확정 (DESCRIPTION.md 미정 항목)
        }
        payload["_local"] = {   # 서버 미전송. 디버깅·임계값 재조정용
            "attempts": attempts,
            "reason": metrics.get("reason", ""),
            "rawScore": metrics.get("rawScore"),
            "normScore": metrics.get("normScore"),
            "detectConf": metrics.get("detectConf"),
            "blurVar": metrics.get("blurVar"),
            "areaRatio": metrics.get("areaRatio"),
            "truncated": metrics.get("truncated"),
        }
        return payload


def open_camera(index: int) -> cv2.VideoCapture:
    backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_V4L2
    cap = cv2.VideoCapture(index, backend)
    if not cap.isOpened():
        cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        raise SystemExit(f"카메라 {index}번을 열 수 없습니다.")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return cap


COLORS = {"NORMAL": (0, 220, 0), "DAMAGED": (60, 60, 255),
          "UNCERTAIN": (0, 200, 255), "FAILED": (60, 60, 255),
          "GATE_PASS": (0, 220, 0), "RETRY": (150, 150, 150)}


def draw(frame, stage, result, metrics):
    canvas = frame.copy()
    h, w = canvas.shape[:2]
    if "bbox" in metrics:
        x1, y1, x2, y2 = (int(v) for v in metrics["bbox"])
        cv2.rectangle(canvas, (x1, y1), (x2, y2), COLORS.get(result, (200, 200, 200)), 3)
    color = COLORS.get(result, (200, 200, 200))
    # 정보 패널 폭을 프레임 폭에 맞춘다 — 좁게 고정돼 있으면 해상도가 커질수록 글자가
    # 패널 밖(실사 영상 위)으로 넘어가 안 보이는 것처럼 보인다(2026-07-28 실사용 중 발견).
    panel_w = min(w, 900)
    cv2.rectangle(canvas, (0, 0), (panel_w, 140), (25, 25, 25), -1)
    cv2.putText(canvas, f"{result}", (14, 46), cv2.FONT_HERSHEY_SIMPLEX, 1.3, color, 3, cv2.LINE_AA)
    cv2.putText(canvas, f"stage={stage}", (330, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                (210, 210, 210), 1, cv2.LINE_AA)
    # 한 줄에 다 넣고 자르는 대신 두 줄로 나눠 값이 안 잘리게 한다.
    line1 = "  ".join(f"{k}={metrics[k]}" for k in ("detectConf", "blurVar", "areaRatio", "aspectRatio")
                      if k in metrics)
    line2 = "  ".join(f"{k}={metrics[k]}" for k in ("normScore", "confidence", "truncated")
                      if k in metrics)
    cv2.putText(canvas, line1, (14, 76), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                (210, 210, 210), 1, cv2.LINE_AA)
    cv2.putText(canvas, line2, (14, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                (210, 210, 210), 1, cv2.LINE_AA)
    if metrics.get("reason"):
        cv2.putText(canvas, str(metrics["reason"])[:90], (14, 124),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 255), 1, cv2.LINE_AA)
    return canvas


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="우산 파손 검수 추론 파이프라인")
    p.add_argument("--source", default="0", help="카메라 인덱스 / 이미지 파일 / 폴더")
    p.add_argument("--model_dir", default=None,
                   help="weights/<modelVersion> (미지정 시 ①② 게이트 검증 모드)")
    p.add_argument("--detector", default=str(ROOT / "yolov8n.pt"), help="탐지기 가중치")
    p.add_argument("--detect_conf", type=float, default=0.25, help="탐지 임계값")
    p.add_argument("--min_detect_conf", type=float, default=0.35, help="게이트: 최소 탐지 신뢰도")
    p.add_argument("--min_blur", type=float, default=60.0, help="게이트: 최소 라플라시안 분산")
    p.add_argument("--min_area", type=float, default=0.05, help="게이트: 최소 bbox 점유율")
    p.add_argument("--max_area", type=float, default=0.85, help="게이트: 최대 bbox 점유율")
    p.add_argument("--max_aspect", type=float, default=1.15,
                   help="게이트: bbox 긴변/짧은변 최댓값 — 넘으면 측면 각도로 보고 RETRY "
                        "(ENV_SENSITIVITY_ANALYSIS.md §3-13, §3-17)")
    p.add_argument("--jsonl", default=None, help="결과를 JSONL로 저장")
    p.add_argument("--dump_dir", default=None,
                   help="진단용: DAMAGE_CHECK 단계에 도달한 라이브 원본 프레임을 이 폴더에 저장 "
                        "(라이브/배치 격차 원인 규명 전용, 운영 경로 아님)")
    p.add_argument("--no_mirror", action="store_true",
                   help="라이브 프레임 좌우반전을 끈다. 기본은 반전 적용(capture_umbrella.py와 "
                        "동일 규칙 — 학습 데이터가 전부 거울상이므로 추론도 맞춰야 함)")
    p.add_argument("--session_id", default="", help="키오스크 세션 ID")
    p.add_argument("--return_id", type=int, default=None, help="반납 ID")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    quality = QualityConfig(min_detect_conf=args.min_detect_conf, min_blur_var=args.min_blur,
                            min_area_ratio=args.min_area, max_area_ratio=args.max_area,
                            max_aspect_ratio=args.max_aspect)
    model_dir = Path(args.model_dir) if args.model_dir else None
    if model_dir is None:
        print("[mode] 게이트 검증 모드 — ①DETECT ②QUALITY만 수행합니다.")
        print("       (--model_dir 를 주면 ③PatchCore 판정까지 수행)")
    inspector = UmbrellaInspector(model_dir, args.detector, quality, args.detect_conf)

    out_fp = open(args.jsonl, "w", encoding="utf-8") if args.jsonl else None
    src = args.source

    dump_dir = Path(args.dump_dir) if args.dump_dir else None
    if dump_dir:
        dump_dir.mkdir(parents=True, exist_ok=True)

    try:
        if src.isdigit():
            # ── 라이브 모드 ──────────────────────────────────────────────
            cap = open_camera(int(src))
            print("      SPACE = 반납 검수 1회 실행 / q,ESC = 종료\n")
            debug_frame_n = 0
            cam_opened_at = time.perf_counter()  # 워밍업 가설 검증용 — 카메라를 연 뒤 경과 시간
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if not args.no_mirror:
                    # capture_umbrella.py는 기본적으로 좌우반전 후 저장한다 — 학습 데이터
                    # 전체가 거울상이므로, 추론도 동일하게 반전해야 crop.py의 학습·추론
                    # 동일 규칙 원칙이 성립한다. 실측으로 확인된 라이브/배치 격차의 주요
                    # 원인 중 하나(2026-07-29, ENV_SENSITIVITY_ANALYSIS.md §3-9).
                    frame = cv2.flip(frame, 1)
                stage, result, metrics = inspector.preview_live_score(frame)  # 실시간 표시용(공식 검수 아님)
                debug_frame_n += 1
                if stage == "DAMAGE_CHECK" and debug_frame_n % 10 == 0:  # 임시 디버그: 진단 후 제거할 것
                    elapsed = time.perf_counter() - cam_opened_at
                    if dump_dir:
                        cv2.imwrite(str(dump_dir / f"live_{debug_frame_n:05d}_raw{metrics.get('rawScore'):.1f}.jpg"),
                                    frame)
                    print(f"[live-debug] t={elapsed:5.1f}s result={result} raw={metrics.get('rawScore')}"
                          f" norm={metrics.get('normScore')} area={metrics.get('areaRatio')}"
                          f" blur={metrics.get('blurVar')}")
                cv2.imshow("umbrella inspect (SPACE=검수, q=종료)",
                           draw(frame, stage, result, metrics))
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), 27):
                    break
                if key == ord(" "):  # 실제 검수 = 재촬영·타임아웃 정책 적용
                    def grab():
                        ok2, f2 = cap.read()
                        if not ok2:
                            return None
                        return cv2.flip(f2, 1) if not args.no_mirror else f2
                    payload = inspector.inspect(grab, args.session_id, args.return_id)
                    print(json.dumps(payload, ensure_ascii=False))
                    if out_fp:
                        out_fp.write(json.dumps(payload, ensure_ascii=False) + "\n")
            cap.release()
            cv2.destroyAllWindows()
        else:
            # ── 이미지/폴더 모드 ─────────────────────────────────────────
            path = Path(src)
            files = (sorted(f for f in path.rglob("*") if f.suffix.lower() in IMAGE_SUFFIXES)
                     if path.is_dir() else [path])
            if not files:
                raise SystemExit(f"이미지를 찾지 못했습니다: {path}")
            counts: dict[str, int] = {}
            for f in files:
                image = cv2.imread(str(f))
                if image is None:
                    continue
                payload = inspector.inspect(lambda img=image: img,
                                            args.session_id, args.return_id)
                r = payload["result"]
                counts[r] = counts.get(r, 0) + 1
                loc = payload["_local"]
                print(f"  {r:<10} {f.name:<30} stage={payload['stage']:<13}"
                      f" conf={payload['confidence']:.3f}"
                      f" norm={loc.get('normScore')} blur={loc.get('blurVar')}"
                      f" area={loc.get('areaRatio')} {loc.get('reason', '')}")
                if out_fp:
                    out_fp.write(json.dumps(payload | {"source": f.name},
                                            ensure_ascii=False) + "\n")
            total = sum(counts.values())
            print(f"\n[집계] 총 {total}건")
            for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
                print(f"  {k:<12} {v:4d} ({v / max(total, 1) * 100:5.1f}%)")
            if model_dir is None:
                print("\n  ※ 게이트 검증 모드입니다. GATE_PASS = ①②를 통과한 건수이며")
                print("     파손 판정은 수행되지 않았습니다.")
    finally:
        if out_fp:
            out_fp.close()
            print(f"\n결과 저장: {args.jsonl}")


if __name__ == "__main__":
    main()
