"""COCO 사전학습 YOLOv8n이 **우산을 어떤 각도에서 인식하는지** 실시간으로 확인하는 도구.

`DESCRIPTION.md §4 ①`의 뷰 리스크(COCO umbrella는 측면/사선 뷰 위주 → top-down 캐노피는
과소표현)를 손에 우산을 들고 각도를 돌려가며 직접 확인하는 것이 목적이다.

라이브 모드가 기본이다. 우산을 카메라 앞에서 천천히 기울이면서 화면의 **신뢰도 추이 그래프**를
보면, 어느 각도에서 무너지는지가 바로 보인다. 순간값만 보면 손떨림에 묻혀서 판단이 안 되므로
최근 이력을 함께 그린다.

임계값을 일부러 낮게(0.05) 두고 돌린다. 기본값 0.25로는 "안 잡힘"만 보이고 *얼마나 아깝게*
놓치는지가 안 보이는데, 0.18에서 놓치는 것과 0.02에서 놓치는 건 판단이 완전히 다르다.

사용 예:
    python check_umbrella.py                          # 내장 웹캠, 실시간 피드백
    python check_umbrella.py --camera 1               # 두 번째 카메라
    python check_umbrella.py --source datasets/pilot  # 이미지 폴더 일괄 측정
    python check_umbrella.py --source shot.jpg        # 단일 이미지

라이브 조작:
    s      스냅샷 저장(원본+주석)
    r      추이 그래프·최고기록 리셋 (다음 각도 조건으로 넘어갈 때)
    q/ESC  종료 후 요약 출력

결과: runs/umbrella_check/<타임스탬프>/ 에 CSV·스냅샷 저장
"""

import argparse
import csv
import statistics
import sys
import time
from collections import Counter, deque
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
UMBRELLA_ID = 25  # COCO
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ultralytics 기본 임계값. 이 선을 넘느냐가 "COCO 그대로 쓸 수 있느냐"의 기준선이다.
DEFAULT_TH = 0.25
REPORT_THRESHOLDS = (0.25, 0.35, 0.50)

TRACE_LEN = 180  # 추이 그래프에 담는 프레임 수 (대략 최근 6~10초)

# BGR
GREEN = (0, 220, 0)
AMBER = (0, 200, 255)
RED = (60, 60, 255)
GRAY = (150, 150, 150)
WHITE = (255, 255, 255)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="우산 인식 각도 실시간 확인")
    p.add_argument("--model", default=str(ROOT / "yolov8n.pt"), help="가중치 경로")
    p.add_argument("--source", default=None, help="이미지 파일/폴더 경로 (미지정 시 웹캠)")
    p.add_argument("--camera", type=int, default=0, help="카메라 인덱스")
    p.add_argument("--width", type=int, default=1280, help="캡처 가로 해상도")
    p.add_argument("--height", type=int, default=720, help="캡처 세로 해상도")
    p.add_argument("--imgsz", type=int, default=640, help="추론 입력 크기")
    p.add_argument("--conf", type=float, default=0.05, help="수집 임계값(낮게 둘 것)")
    p.add_argument("--device", default=None, help="cuda:0 / cpu (미지정 시 자동)")
    p.add_argument("--no-mirror", action="store_true", help="좌우 반전 끄기")
    p.add_argument("--outdir", default=None, help="결과 디렉터리 (미지정 시 자동 생성)")
    return p.parse_args()


def open_camera(index: int, width: int, height: int) -> cv2.VideoCapture:
    """플랫폼별 카메라 백엔드 선택.

    Windows는 DSHOW가 초기화가 빠르고 안정적이다. 반면 **Jetson/Linux에는 DSHOW가 없어**
    (V4L2를 쓴다) 이 스크립트를 Jetson에서 돌릴 때 백엔드를 강제하면 실패한다.
    """
    backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_V4L2
    cap = cv2.VideoCapture(index, backend)
    if not cap.isOpened():
        cap = cv2.VideoCapture(index)  # 백엔드 자동 선택으로 폴백
    if not cap.isOpened():
        raise RuntimeError(
            f"카메라 {index}번을 열 수 없습니다. "
            "다른 앱이 점유 중이거나 인덱스가 틀렸을 수 있습니다."
        )
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    return cap


def analyze(result, frame_area: int) -> dict:
    """추론 결과 1건에서 우산 최고신뢰 검출과 최상위 오인 후보를 뽑는다."""
    best_umbrella = None  # (conf, xyxy)
    best_other = None  # (conf, class_name)

    for box in result.boxes:
        cls = int(box.cls.item())
        conf = float(box.conf.item())
        if cls == UMBRELLA_ID:
            if best_umbrella is None or conf > best_umbrella[0]:
                best_umbrella = (conf, box.xyxy[0].tolist())
        else:
            if best_other is None or conf > best_other[0]:
                best_other = (conf, result.names[cls])

    row = {
        "umbrella_conf": 0.0,
        "x1": "", "y1": "", "x2": "", "y2": "",
        "area_ratio": "",
        "top_other_class": "",
        "top_other_conf": "",
    }
    if best_umbrella is not None:
        conf, (x1, y1, x2, y2) = best_umbrella
        row["umbrella_conf"] = conf
        row.update(x1=round(x1), y1=round(y1), x2=round(x2), y2=round(y2))
        row["area_ratio"] = round((x2 - x1) * (y2 - y1) / frame_area, 4)
    if best_other is not None:
        row["top_other_conf"] = round(best_other[0], 4)
        row["top_other_class"] = best_other[1]
    return row


def verdict(conf: float) -> tuple[str, tuple[int, int, int]]:
    """신뢰도를 3단계 라벨로. 경계(AMBER)를 따로 두는 게 핵심 — 마진을 봐야 판단이 선다."""
    if conf >= DEFAULT_TH:
        return "GOOD", GREEN
    if conf > 0:
        return "WEAK", AMBER
    return "MISS", RED


def draw_boxes(canvas, result) -> None:
    """우산은 초록 굵게, 나머지는 회색 얇게 — 무엇으로 오인하는지 한눈에 보기 위함."""
    for box in result.boxes:
        cls = int(box.cls.item())
        conf = float(box.conf.item())
        x1, y1, x2, y2 = (int(v) for v in box.xyxy[0].tolist())
        is_umbrella = cls == UMBRELLA_ID
        color = GREEN if is_umbrella else GRAY
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 3 if is_umbrella else 1)
        cv2.putText(
            canvas, f"{result.names[cls]} {conf:.2f}", (x1, max(y1 - 6, 14)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6 if is_umbrella else 0.45, color,
            2 if is_umbrella else 1, cv2.LINE_AA,
        )


def draw_gauge(canvas, x: int, y: int, w: int, h: int, conf: float, color) -> None:
    """신뢰도 막대. 0.25 지점에 기준선을 그어 넘었는지를 즉시 보이게 한다."""
    cv2.rectangle(canvas, (x, y), (x + w, y + h), (70, 70, 70), -1)
    if conf > 0:
        cv2.rectangle(canvas, (x, y), (x + int(w * min(conf, 1.0)), y + h), color, -1)
    th_x = x + int(w * DEFAULT_TH)
    cv2.line(canvas, (th_x, y - 4), (th_x, y + h + 4), WHITE, 2)
    cv2.putText(canvas, f"{DEFAULT_TH:.2f}", (th_x - 16, y + h + 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, WHITE, 1, cv2.LINE_AA)
    cv2.rectangle(canvas, (x, y), (x + w, y + h), (200, 200, 200), 1)


def draw_trace(canvas, x: int, y: int, w: int, h: int, trace: deque) -> None:
    """최근 신뢰도 추이. 각도를 천천히 돌리면서 이 선이 무너지는 지점을 보는 것이 이 도구의 핵심."""
    cv2.rectangle(canvas, (x, y), (x + w, y + h), (35, 35, 35), -1)
    th_y = y + h - int(h * DEFAULT_TH)
    cv2.line(canvas, (x, th_y), (x + w, th_y), (110, 110, 110), 1, cv2.LINE_AA)
    cv2.putText(canvas, "0.25", (x + w - 38, th_y - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (110, 110, 110), 1, cv2.LINE_AA)

    if len(trace) >= 2:
        step = w / (TRACE_LEN - 1)
        offset = TRACE_LEN - len(trace)  # 왼쪽부터 채우지 않고 오른쪽 정렬
        pts = [
            (int(x + (offset + i) * step), y + h - int(h * min(c, 1.0)))
            for i, c in enumerate(trace)
        ]
        # 임계값 위/아래를 색으로 구분해 구간별로 그린다
        for (x1, y1), (x2, y2), c in zip(pts, pts[1:], list(trace)[1:]):
            cv2.line(canvas, (x1, y1), (x2, y2),
                     GREEN if c >= DEFAULT_TH else (AMBER if c > 0 else RED), 2, cv2.LINE_AA)

    cv2.rectangle(canvas, (x, y), (x + w, y + h), (120, 120, 120), 1)
    cv2.putText(canvas, "recent confidence", (x + 6, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (170, 170, 170), 1, cv2.LINE_AA)


def draw_hud(frame, result, row: dict, trace: deque, stats: dict):
    """라이브 피드백 화면 구성."""
    canvas = frame.copy()
    draw_boxes(canvas, result)

    h, w = canvas.shape[:2]
    conf = row["umbrella_conf"]
    label, color = verdict(conf)

    # 좌상단 패널 — 배경을 깔아야 우산 위에 글자가 겹쳐도 읽힌다
    panel = canvas[0:150, 0:470].copy()
    canvas[0:150, 0:470] = cv2.addWeighted(panel, 0.35, np.zeros_like(panel), 0.65, 0)

    cv2.putText(canvas, label, (16, 62), cv2.FONT_HERSHEY_SIMPLEX, 1.7, color, 4, cv2.LINE_AA)
    cv2.putText(canvas, f"{conf:.3f}", (210, 62), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3, cv2.LINE_AA)
    draw_gauge(canvas, 16, 78, 380, 22, conf, color)

    if conf > 0:
        sub = f"area {row['area_ratio']}"
    else:
        sub = (f"instead: {row['top_other_class']} {row['top_other_conf']}"
               if row["top_other_class"] else "nothing detected")
    cv2.putText(canvas, sub, (16, 138), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (210, 210, 210), 1, cv2.LINE_AA)

    # 우상단 — 유지 시간과 최고 기록. 손떨림으로 한 프레임 튄 건지 실제로 안정적인지 구분용
    hold = f"hold {stats['hold_sec']:.1f}s" if stats["hold_sec"] > 0 else "hold --"
    for i, text in enumerate([
        hold,
        f"best {stats['best']:.3f}",
        f"hit@0.25 {stats['hit_rate']:.0f}%",
        f"{stats['latency']:.0f}ms  {stats['device']}",
    ]):
        cv2.putText(canvas, text, (w - 230, 32 + i * 26),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, WHITE, 1, cv2.LINE_AA)

    draw_trace(canvas, 16, h - 150, 420, 120, trace)
    cv2.putText(canvas, "s=snap  r=reset  q=quit", (16, h - 14),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (170, 170, 170), 1, cv2.LINE_AA)
    return canvas


def draw_static(frame, result, row: dict, title: str):
    """이미지 일괄 모드용 간단 주석."""
    canvas = frame.copy()
    draw_boxes(canvas, result)
    conf = row["umbrella_conf"]
    label, color = verdict(conf)
    head = f"{label} {conf:.3f}"
    if conf == 0 and row["top_other_class"]:
        head += f"  (instead: {row['top_other_class']} {row['top_other_conf']})"
    cv2.putText(canvas, head, (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2, cv2.LINE_AA)
    cv2.putText(canvas, title, (12, 62), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (210, 210, 210), 1, cv2.LINE_AA)
    return canvas


def summarize(rows: list[dict], outdir: Path) -> None:
    """임계값별 검출률과 신뢰도 분포를 출력한다."""
    n = len(rows)
    print("\n" + "=" * 66)
    print(f"  우산 검출 측정 결과   (샘플 {n}건)")
    print("=" * 66)
    if n == 0:
        print("  측정된 샘플이 없습니다.")
        return

    confs = [r["umbrella_conf"] for r in rows]
    print("\n  [임계값별 검출률]  — 0.25가 ultralytics 기본값")
    for th in REPORT_THRESHOLDS:
        hit = sum(1 for c in confs if c >= th)
        bar = "#" * round(hit / n * 30)
        print(f"    conf >= {th:.2f} : {hit:4d}/{n:<4d} = {hit / n * 100:5.1f}%  {bar}")

    detected = [c for c in confs if c > 0]
    if detected:
        detected_sorted = sorted(detected)
        p10 = detected_sorted[max(int(len(detected_sorted) * 0.10) - 1, 0)]
        print(f"\n  [검출된 {len(detected)}건의 신뢰도 분포]")
        print(f"    평균 {statistics.mean(detected):.3f} | 중앙값 {statistics.median(detected):.3f} "
              f"| 최소 {min(detected):.3f} | 최대 {max(detected):.3f} | 하위10% {p10:.3f}")
        ratios = [r["area_ratio"] for r in rows if r["area_ratio"] != ""]
        if ratios:
            print(f"    bbox 점유율: 평균 {statistics.mean(ratios):.3f} | "
                  f"최소 {min(ratios):.3f} | 최대 {max(ratios):.3f}   (② 품질 게이트 기준값 참고)")
    else:
        print("\n  우산으로 검출된 샘플이 0건입니다 (conf 하한까지 낮췄는데도).")

    misses = [r for r in rows if r["umbrella_conf"] < DEFAULT_TH and r["top_other_class"]]
    if misses:
        counter = Counter(r["top_other_class"] for r in misses)
        print(f"\n  [0.25 미만일 때 대신 잡힌 클래스 top5]  ({len(misses)}건)")
        for name, cnt in counter.most_common(5):
            print(f"    {name:<16} {cnt:4d}회")

    print("\n  [판단 가이드]  ※ 라이브 측정은 각도를 얼마나 오래 잡고 있었냐에 좌우된다.")
    print("     비율 자체보다 '어느 각도에서 무너졌는지'를 근거로 볼 것.")
    hit25 = sum(1 for c in confs if c >= DEFAULT_TH) / n
    if hit25 >= 0.95:
        print("    ✅ COCO 그대로 게이트로 쓸 만함. 파인튜닝 없이 진행 검토 가능.")
    elif hit25 >= 0.60:
        print("    ⚠️  경계. 놓침이 재촬영/UNCERTAIN으로 새어나감 → 파인튜닝 권장.")
    else:
        print("    ❌ COCO 그대로는 부적합. 파인튜닝 또는 탐지기 제거(규칙+PatchCore) 경로로.")
    print(f"\n  로그: {outdir / 'measurements.csv'}")
    print("=" * 66)


def main() -> None:
    args = parse_args()

    device = args.device or ("cuda:0" if torch.cuda.is_available() else "cpu")
    outdir = Path(args.outdir) if args.outdir else (
        ROOT / "runs" / "umbrella_check" / datetime.now().strftime("%Y%m%d_%H%M%S")
    )
    outdir.mkdir(parents=True, exist_ok=True)

    model = YOLO(args.model)
    model.to(device)
    print(f"[env] device={device} / model={Path(args.model).name} / conf>={args.conf}")
    print(f"[out] {outdir}")

    rows: list[dict] = []

    def infer(image):
        started = time.perf_counter()
        result = model.predict(
            image, imgsz=args.imgsz, conf=args.conf, device=device, verbose=False
        )[0]
        latency = (time.perf_counter() - started) * 1000
        h, w = image.shape[:2]
        row = analyze(result, h * w)
        row["latency_ms"] = round(latency, 1)
        return result, row

    if args.source:
        # ---- 정적 이미지 모드 ----
        src = Path(args.source)
        files = (
            sorted(f for f in src.rglob("*") if f.suffix.lower() in IMAGE_SUFFIXES)
            if src.is_dir() else [src]
        )
        if not files:
            raise SystemExit(f"이미지를 찾지 못했습니다: {src}")
        print(f"[src] 이미지 {len(files)}건\n")
        annotated_dir = outdir / "annotated"
        annotated_dir.mkdir(exist_ok=True)
        for f in files:
            image = cv2.imread(str(f))
            if image is None:
                print(f"  [skip] 읽기 실패: {f.name}")
                continue
            result, row = infer(image)
            row["source"] = f.name
            rows.append(row)
            label, _ = verdict(row["umbrella_conf"])
            print(f"  {label:<4} {f.name:<40} conf={row['umbrella_conf']:.3f}"
                  f"  other={row['top_other_class']}")
            cv2.imwrite(str(annotated_dir / f.name), draw_static(image, result, row, f.name))
    else:
        # ---- 라이브 모드 ----
        cap = open_camera(args.camera, args.width, args.height)
        print(f"[src] camera {args.camera} "
              f"{int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}"
              f" / mirror={'off' if args.no_mirror else 'on'}")
        print("      우산을 들고 천천히 각도를 돌리면서 하단 추이 그래프를 보세요.")
        print("      s = 스냅샷 / r = 그래프·최고기록 리셋 / q,ESC = 종료 후 요약\n")

        snaps = outdir / "snapshots"
        snaps.mkdir(exist_ok=True)
        latencies: deque[float] = deque(maxlen=30)
        trace: deque[float] = deque(maxlen=TRACE_LEN)
        window = "umbrella live check (s=snap, r=reset, q=quit)"
        saved = 0
        best = 0.0
        hold_start = None

        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    print("[warn] 프레임을 읽지 못했습니다. 종료합니다.")
                    break
                # 내장 캠 앞에서 손으로 각도를 맞추려면 거울상이어야 직관적이다.
                if not args.no_mirror:
                    frame = cv2.flip(frame, 1)

                result, row = infer(frame)
                row["source"] = f"frame_{len(rows):05d}"
                rows.append(row)
                conf = row["umbrella_conf"]
                latencies.append(row["latency_ms"])
                trace.append(conf)
                best = max(best, conf)

                if conf >= DEFAULT_TH:
                    hold_start = hold_start if hold_start is not None else time.perf_counter()
                else:
                    hold_start = None

                stats = {
                    "hold_sec": (time.perf_counter() - hold_start) if hold_start else 0.0,
                    "best": best,
                    "hit_rate": sum(1 for c in trace if c >= DEFAULT_TH) / len(trace) * 100,
                    "latency": statistics.mean(latencies),
                    "device": device,
                }
                canvas = draw_hud(frame, result, row, trace, stats)
                cv2.imshow(window, canvas)

                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), 27):
                    break
                if key == ord("r"):
                    trace.clear()
                    best = 0.0
                    hold_start = None
                    print("  [reset] 추이·최고기록 초기화")
                if key == ord("s"):
                    stem = f"snap_{saved:03d}_conf{conf:.3f}"
                    cv2.imwrite(str(snaps / f"{stem}_raw.jpg"), frame)
                    cv2.imwrite(str(snaps / f"{stem}_annotated.jpg"), canvas)
                    saved += 1
                    print(f"  [snap] {stem}")
        finally:
            cap.release()
            cv2.destroyAllWindows()

    if rows:
        fields = ["source", "umbrella_conf", "area_ratio", "x1", "y1", "x2", "y2",
                  "top_other_class", "top_other_conf", "latency_ms"]
        with open(outdir / "measurements.csv", "w", newline="", encoding="utf-8") as fp:
            writer = csv.DictWriter(fp, fieldnames=fields)
            writer.writeheader()
            writer.writerows({k: r.get(k, "") for k in fields} for r in rows)

    summarize(rows, outdir)


if __name__ == "__main__":
    main()
