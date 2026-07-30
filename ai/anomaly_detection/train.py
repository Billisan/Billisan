"""PatchCore 우산 파손 판정 모델 학습·평가·내보내기.

`DESCRIPTION.md` 「판정 로직 (확정)」을 그대로 구현한다. 특히:

  (1) 크롭은 **고정 ROI**. 탐지 bbox를 쓰지 않는다. 학습·추론이 같은 ROI를 써야 하므로
      ROI 값은 산출물 메타데이터에 박아서 내보낸다.
  (4) 임계값은 **정상 데이터의 백분위**로만 뽑는다. 파손 샘플(유형별 15~20장)에 F1을 맞추면
      그 표본에 과적합되므로, 파손은 Recall '확인'에만 쓰고 임계값을 되돌리지 않는다.

Jetson(JetPack 6) 배포를 고려해 **ONNX로 내보내는 것이 기본 경로**다. 그러면 Jetson에
anomalib을 설치할 필요가 없어 ARM64 의존성·버전 정합 문제가 통째로 사라진다. 판정에 필요한
정규화 파라미터는 `metadata.json`에 명시 저장하므로, 추론 측은 ONNX + JSON만 있으면 된다.

사용 예:
    python train.py --data_path datasets/umbrella
    python train.py --data_path datasets/umbrella --backbone resnet18 --coreset_ratio 0.05
    python train.py --smoke          # 합성 데이터로 파이프라인만 검증 (데이터 없을 때)
"""

import argparse
import json
import platform
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

if sys.platform == "win32":
    # Windows 콘솔 기본 코드페이지(cp949)가 em-dash 등 일부 유니코드 문자를 인코딩
    # 못 해서 print()가 UnicodeEncodeError로 죽는 문제 방지.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import torch

# 판정 계산식은 추론 측과 **공유**한다. decision.py는 numpy만 의존하므로
# Jetson(anomalib 미설치)에서도 같은 모듈을 그대로 쓴다.
from crop import (CROP_MODES, DEFAULT_CROP_MODE, DEFAULT_PADDING, crop_umbrella,
                  describe, preprocess, resize_for_model)
from decision import DEFAULT_BAND, VERDICT_NAMES, classify, to_norm_score

ROOT = Path(__file__).resolve().parent
UMBRELLA_CLASS_ID = 25  # COCO
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ── 튜닝 노출 변수 (DESCRIPTION.md §6) ───────────────────────────────────────
# 추론이 느리면 coreset_sampling_ratio를 0.1 → 0.05 → 0.01로 낮춘다.
DEFAULT_CORESET_RATIO = 0.1
DEFAULT_BACKBONE = "wide_resnet50_2"   # Jetson 메모리가 빠듯하면 resnet18
DEFAULT_LAYERS = ("layer2", "layer3")
# ViT(DINOv2 등) 백본용 기본 레이어. TimmFeatureExtractor는 backbone 이름에 "vit"가 있으면
# CNN의 features_only 대신 forward_intermediates 경로로 자동 전환하고, 레이어는
# "blocks.<idx>" 형식(또는 정수 인덱스)을 받는다 — "layer2"/"layer3" 같은 CNN 이름은 안 통한다.
# vit_small(depth=12) 기준 중간~후반 블록 2개를 CNN의 layer2+layer3(중간~후반 스테이지)에
# 대응시켜 골랐다 — 실험값이며 결과 보고 조정한다.
DEFAULT_VIT_LAYERS = ("blocks.5", "blocks.9")
DEFAULT_IMAGE_SIZE = 256               # DESCRIPTION.md Step 1
DEFAULT_PERCENTILE = 95.0              # 판정 로직 (4): 정상 오탐률 ≤5% 목표

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="PatchCore 우산 파손 판정 학습")
    p.add_argument("--data_path", default=str(ROOT / "datasets" / "umbrella"),
                   help="datasets/umbrella (train/good, test/good, test/defective)")
    p.add_argument("--model", default="patchcore", choices=["patchcore"],
                   help="학습 대상 모델 (MVP는 PatchCore 1개)")
    p.add_argument("--backbone", default=DEFAULT_BACKBONE, help="특징 추출 백본")
    p.add_argument("--layers", nargs="+", default=None,
                   help="특징 추출 레이어. CNN 백본은 'layer2' 'layer3'류, ViT 백본(이름에 "
                        "'vit' 포함)은 'blocks.5' 'blocks.9'류(또는 정수 인덱스)를 쓴다. "
                        "미지정 시 backbone 이름으로 자동 선택(CNN→DEFAULT_LAYERS, "
                        "ViT→DEFAULT_VIT_LAYERS)")
    p.add_argument("--coreset_ratio", type=float, default=DEFAULT_CORESET_RATIO,
                   help="메모리뱅크 coreset 비율. 낮추면 빠르고 가벼워짐")
    p.add_argument("--image_size", type=int, default=DEFAULT_IMAGE_SIZE, help="모델 입력 크기")
    p.add_argument("--percentile", type=float, default=DEFAULT_PERCENTILE,
                   help="정상 점수 분포에서 임계값을 뽑을 백분위 (--threshold_mode percentile일 때만 사용)")
    p.add_argument("--band_width", type=float, default=0.5 - DEFAULT_BAND[0],
                   help="UNCERTAIN 밴드 반폭. 0.5±band_width가 밴드가 된다(기본 0.1 = "
                        "(0.4,0.6)). 좁힐수록 NORMAL/DAMAGED 이진 판정에 가까워지고 관리자 "
                        "검토 여유는 줄어든다 — 안전마진 정책, 임의로 바꾸지 말고 팀 확인 후 조정")
    p.add_argument("--threshold_mode", default="percentile", choices=["percentile", "gap_midpoint"],
                   help="percentile(기본, 파손 표본 미사용) | gap_midpoint(정상 최댓값~파손 "
                        "최솟값 구간 중앙에 임계값을 둠, 파손 표본 필수). "
                        "⚠️ gap_midpoint는 지금 가진 파손 표본(현재는 마스킹테이프 시뮬레이션)의 "
                        "간격에 맞춰 과적합될 위험이 있다 — 실제 파손 유형이 늘면 재검증할 것"
                        "(2026-07-28 팀 결정, DATA_COLLECTION.md §3-2). "
                        "--threshold_value를 주면 이 인자 자체는 무시되고 수동값을 그대로 쓴다")
    p.add_argument("--threshold_value", type=float, default=None,
                   help="threshold_mode 계산을 건너뛰고 이 raw score를 그대로 임계값으로 쓴다. "
                        "gap_midpoint가 구한 안전마진(정상 최댓값~파손 최솟값) 안에서 수동으로 "
                        "위치를 조정할 때 사용 — 파손 최솟값을 넘기면 그만큼 파손 탐지력이 "
                        "줄어드니 반드시 배치 파손 최솟값 밑으로 유지할 것")
    p.add_argument("--crop_mode", default=DEFAULT_CROP_MODE, choices=CROP_MODES,
                   help="이 스크립트가 --data_path 이미지에 적용할 크롭 방식. "
                        "입력이 이미 외부에서 크롭돼 있으면 'full'을 준다")
    p.add_argument("--crop_padding", type=float, default=DEFAULT_PADDING,
                   help="bbox 정사각 확장 시 각 변 여백 비율")
    p.add_argument("--inference_crop_mode", default=None, choices=CROP_MODES,
                   help="metadata.json에 기록할 크롭 방식(추론이 원본 프레임에 적용할 값). "
                        "미지정 시 --crop_mode와 동일. ⚠️ 입력이 이미 외부 도구(예: "
                        "capture_umbrella.py)로 bbox 크롭된 상태라 --crop_mode full을 줬다면, "
                        "이 값은 그 외부 도구가 실제로 쓴 크롭(예: bbox)으로 반드시 따로 지정할 것 "
                        "— 안 그러면 추론이 원본 카메라 프레임을 안 잘라 배경째로 판정해 오탐이 폭증한다")
    p.add_argument("--inference_crop_padding", type=float, default=None,
                   help="metadata.json에 기록할 padding. 미지정 시 --crop_padding과 동일")
    p.add_argument("--detector", default=str(ROOT / "yolov8n.pt"),
                   help="크롭용 탐지기 가중치 (학습 이미지에도 추론과 같은 탐지기를 적용)")
    p.add_argument("--crop_conf", type=float, default=0.25,
                   help="크롭용 탐지 신뢰도 임계값")
    p.add_argument("--keep_crops", action="store_true",
                   help="생성된 크롭 이미지를 산출물에 남긴다 (눈으로 검수용)")
    p.add_argument("--batch_size", type=int, default=8, help="배치 크기")
    p.add_argument("--num_workers", type=int, default=0, help="DataLoader 워커 (Windows는 0 권장)")
    p.add_argument("--seed", type=int, default=42, help="재현성 시드")
    p.add_argument("--model_version", default=None, help="모델 버전 태그 (미지정 시 자동)")
    p.add_argument("--outdir", default=None, help="산출물 경로 (미지정 시 weights/<버전>)")
    p.add_argument("--no_export", action="store_true", help="ONNX 내보내기 생략")
    p.add_argument("--smoke", action="store_true",
                   help="합성 데이터로 파이프라인만 검증 (실데이터 없이 동작 확인)")
    return p.parse_args()


def prepare_crops(src_root: Path, dst_root: Path, args) -> dict:
    """데이터셋 전체에 **추론과 동일한 탐지기·크롭**을 적용해 크롭 데이터셋을 만든다.

    학습 이미지에도 YOLO를 돌리는 이유: 운영에서는 탐지 bbox로 크롭한 영상이 PatchCore에
    들어간다. 학습만 다른 방식으로 자르면 두 분포가 어긋나 임계값이 무의미해진다.

    크롭 결과를 파일로 남기므로 **눈으로 검수**할 수 있다 — 탐지가 엉뚱한 걸 잡았는지,
    캐노피가 잘렸는지는 수치보다 그림이 빠르다.
    """
    import cv2
    from ultralytics import YOLO

    detector = YOLO(args.detector)
    stats = {"total": 0, "cropped": 0, "no_detection": [], "too_small": []}

    for split in ("train/good", "test/good", "test/defective"):
        src = src_root / split
        if not src.is_dir():
            continue
        dst = dst_root / split
        dst.mkdir(parents=True, exist_ok=True)
        for f in sorted(p for p in src.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES):
            stats["total"] += 1
            image = cv2.imread(str(f))
            if image is None:
                continue
            bbox = None
            if args.crop_mode != "full":
                res = detector.predict(image, conf=args.crop_conf, classes=[UMBRELLA_CLASS_ID],
                                       verbose=False)[0]
                if len(res.boxes):
                    best = max(res.boxes, key=lambda b: float(b.conf.item()))
                    bbox = [float(v) for v in best.xyxy[0].tolist()]
            if bbox is None and args.crop_mode != "full":
                stats["no_detection"].append(f"{split}/{f.name}")
                continue
            out = crop_umbrella(image, bbox, args.crop_mode, args.crop_padding)
            if out is None or out.size == 0:
                stats["too_small"].append(f"{split}/{f.name}")
                continue
            # 여기서 미리 모델 입력 크기로 맞춘다 → 추론 측과 **동일한 cv2 보간**을 쓰게 되고
            # 학습 파이프라인의 torchvision Resize는 항등이 된다(crop.resize_for_model 주석 참고).
            out = resize_for_model(out, args.image_size)
            cv2.imwrite(str(dst / f"{f.stem}.png"), out)
            stats["cropped"] += 1
    return stats


def build_transform(size: int):
    """리사이즈 → ImageNet 정규화. 크롭은 prepare_crops에서 이미 끝났다.

    ⚠️ 회전·플립·색상 증강을 넣지 않는다. PatchCore는 정상의 분포를 외우는 모델이라
    증강이 정상 분포를 인위적으로 넓혀 파손 탐지력을 떨어뜨린다(DESCRIPTION.md Step 1).
    """
    from torchvision.transforms import v2

    return v2.Compose([
        v2.Resize((size, size), antialias=True),
        v2.ToDtype(torch.float32, scale=True),
        v2.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def make_smoke_dataset(base: Path) -> Path:
    """합성 우산 이미지로 최소 데이터셋을 만든다. 성능 평가용이 아니라 배선 검증용."""
    import math

    import cv2

    rng = np.random.default_rng(0)
    root = base / "umbrella"
    specs = [("train/good", 24, False), ("test/good", 8, False), ("test/defective", 8, True)]
    for rel, count, broken in specs:
        d = root / rel
        d.mkdir(parents=True, exist_ok=True)
        for i in range(count):
            img = np.full((320, 320, 3), 40, np.uint8)
            cx, cy, r = 160, 160, 120
            cv2.circle(img, (cx, cy), r, (80, 80, 200), -1)
            for a in range(0, 360, 30):
                x = int(cx + r * math.cos(math.radians(a)))
                y = int(cy + r * math.sin(math.radians(a)))
                cv2.line(img, (cx, cy), (x, y), (30, 30, 30), 2)
            if broken:  # 찢어짐 흉내 — 캐노피에 배경색 쐐기를 뚫는다
                a0 = rng.integers(0, 360)
                pts = np.array([[cx, cy],
                                [cx + int(r * math.cos(math.radians(a0))),
                                 cy + int(r * math.sin(math.radians(a0)))],
                                [cx + int(r * math.cos(math.radians(a0 + 25))),
                                 cy + int(r * math.sin(math.radians(a0 + 25)))]], np.int32)
                cv2.fillPoly(img, [pts], (40, 40, 40))
            img = np.clip(img.astype(np.int16) + rng.integers(-6, 7, img.shape), 0, 255).astype(np.uint8)
            cv2.imwrite(str(d / f"{rel.replace('/', '_')}_{i:03d}.png"), img)
    return root


def verify_preprocess(onnx_path: Path, crop_dir: Path, ref_scores: np.ndarray,
                      image_size: int) -> tuple[bool, dict]:
    """내보낸 ONNX가 **추론 측 전처리로 학습 점수를 재현하는지** 실측 검증한다.

    학습·추론 전처리 불일치는 이 프로젝트에서 가장 위험한 버그다 — 예외가 안 나고 점수만
    조용히 어긋나서, 임계값이 통째로 무의미해진 채로 배포된다. 그래서 추측하지 않고
    **정규화 적용/미적용 두 가지를 모두 돌려 학습 점수와 맞는 쪽을 확정**한다.
    """
    import cv2
    import onnxruntime as ort

    files = sorted(f for f in crop_dir.iterdir() if f.suffix.lower() in IMAGE_SUFFIXES)
    if not files or ref_scores.size == 0:
        return False, {"error": "검증할 크롭/점수가 없음"}

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    iname = sess.get_inputs()[0].name
    onames = [o.name for o in sess.get_outputs()]

    results = {}
    for apply_norm in (True, False):
        vals = []
        for f in files:
            img = cv2.imread(str(f))
            if img is None:
                continue
            x = preprocess(img, image_size, IMAGENET_MEAN, IMAGENET_STD, apply_norm)
            out = sess.run(None, {iname: x})
            vals.append(float(np.atleast_1d(out[onames.index("pred_score")])[0]))
        results[apply_norm] = np.asarray(vals, dtype=np.float64)

    ref_mean = float(ref_scores.mean())
    best, best_err = None, np.inf
    for apply_norm, vals in results.items():
        if vals.size == 0:
            continue
        err = abs(float(vals.mean()) - ref_mean) / max(abs(ref_mean), 1e-9)
        if err < best_err:
            best, best_err = apply_norm, err

    info = {
        "applyNormalize": bool(best),
        "relativeError": float(best_err),
        "trainMean": ref_mean,
        "onnxMeanNormalized": float(results[True].mean()) if results[True].size else None,
        "onnxMeanRaw": float(results[False].mean()) if results[False].size else None,
        "samples": len(files),
    }
    return bool(best_err < 0.01), info


def collect_scores(predictions) -> tuple[np.ndarray, np.ndarray]:
    """predict 결과에서 (점수, 정답라벨) 배열을 뽑는다."""
    scores, labels = [], []
    for batch in predictions:
        score = getattr(batch, "pred_score", None)
        label = getattr(batch, "gt_label", None)
        if score is None or label is None:
            raise RuntimeError("예측 결과에 pred_score/gt_label이 없습니다 (anomalib 버전 확인).")
        scores.append(np.atleast_1d(np.asarray(score.detach().cpu(), dtype=np.float64)))
        labels.append(np.atleast_1d(np.asarray(label.detach().cpu(), dtype=np.int64)))
    return np.concatenate(scores), np.concatenate(labels)


def main() -> None:
    args = parse_args()

    from anomalib.data import Folder
    from anomalib.engine import Engine
    from anomalib.models import Patchcore
    from anomalib.post_processing import PostProcessor
    from anomalib.pre_processing import PreProcessor
    import anomalib
    import lightning

    from lightning.pytorch import seed_everything
    seed_everything(args.seed, workers=True)

    version = args.model_version or f"dmg-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"
    outdir = Path(args.outdir) if args.outdir else (ROOT / "weights" / version)
    outdir.mkdir(parents=True, exist_ok=True)

    tmpdir = None
    if args.smoke:
        tmpdir = tempfile.mkdtemp(prefix="umbrella_smoke_")
        data_root = make_smoke_dataset(Path(tmpdir))
        print(f"[smoke] 합성 데이터셋 생성: {data_root}")
    else:
        data_root = Path(args.data_path)

    # PatchCore는 1-Class 모델이라 **학습에 정상만** 쓴다. 임계값도 정상 분포 백분위로
    # 뽑으므로(판정 로직 (4)), 파손 데이터 없이도 학습·임계값 산출·내보내기가 모두 된다.
    # 파손은 Recall/AUROC '확인'에만 쓰이므로 나중에 붙여도 된다.
    for rel in ("train/good", "test/good"):
        if not (data_root / rel).is_dir():
            raise SystemExit(
                f"데이터 경로가 없습니다: {data_root / rel}\n"
                f"DATA_COLLECTION.md의 구조대로 촬영·배치한 뒤 실행하세요. "
                f"파이프라인만 확인하려면 --smoke 를 쓰세요."
            )

    defective_dir = data_root / "test" / "defective"
    has_defective = defective_dir.is_dir() and any(defective_dir.iterdir())
    if not has_defective:
        print("[info] test/defective 가 비어 있습니다 → 정상 데이터만으로 진행합니다.")
        print("       학습·임계값 산출·ONNX 내보내기는 그대로 됩니다.")
        print("       파손 Recall/AUROC는 파손 샘플을 넣은 뒤 재실행하면 나옵니다.")

    if args.layers:
        layers = list(args.layers)
    elif "vit" in args.backbone.lower():
        layers = list(DEFAULT_VIT_LAYERS)
    else:
        layers = list(DEFAULT_LAYERS)

    print(f"[cfg] backbone={args.backbone} layers={layers} coreset={args.coreset_ratio} "
          f"image_size={args.image_size} percentile=p{args.percentile:g}")
    print(f"[cfg] crop: {describe(args.crop_mode, args.crop_padding)}")
    print(f"[cfg] anomalib={anomalib.__version__} torch={torch.__version__} "
          f"lightning={lightning.__version__}")

    # ── 크롭 전처리 ──────────────────────────────────────────────────────────
    # 학습 이미지에도 추론과 **동일한 탐지기·크롭**을 적용한다. 학습만 다르게 자르면
    # 두 분포가 어긋나 임계값이 무의미해진다.
    crop_root = outdir / "crops"
    print(f"\n[0/4] 크롭 생성 ({args.crop_mode})")
    cstats = prepare_crops(data_root, crop_root, args)
    print(f"  {cstats['cropped']}/{cstats['total']}장 크롭 완료")
    if cstats["no_detection"]:
        n = len(cstats["no_detection"])
        print(f"  ⚠️ 우산 미검출로 제외 {n}장 ({n / max(cstats['total'], 1) * 100:.1f}%)")
        for name in cstats["no_detection"][:5]:
            print(f"       {name}")
        if n > 5:
            print(f"       … 외 {n - 5}장")
        print("     → 이 비율이 높으면 운영에서도 그만큼 재촬영·UNCERTAIN이 발생한다."
              " 탐지기 파인튜닝을 검토할 것.")
    if cstats["too_small"]:
        print(f"  ⚠️ 크롭 실패(너무 작음) {len(cstats['too_small'])}장")
    if cstats["cropped"] == 0:
        raise SystemExit("크롭된 이미지가 0장입니다. 탐지 임계값(--crop_conf)이나 데이터를 확인하세요.")

    # 크롭 후 기준으로 다시 판단한다 — 파손 이미지가 전부 미검출로 빠졌을 수 있다.
    cropped_defective = crop_root / "test" / "defective"
    has_defective = cropped_defective.is_dir() and any(cropped_defective.iterdir())

    transform = build_transform(args.image_size)

    datamodule = Folder(
        name="umbrella",
        root=crop_root,
        normal_dir="train/good",
        normal_test_dir="test/good",
        abnormal_dir="test/defective" if has_defective else None,
        train_batch_size=args.batch_size,
        eval_batch_size=args.batch_size,
        num_workers=args.num_workers,
        seed=args.seed,
        # ⚠️ 기본값은 val_split_mode=FROM_TEST + ratio=0.5 라서 **테스트셋의 절반이 조용히
        # 검증셋으로 빠진다.** 우리는 임계값을 정상 테스트 분포에서 뽑으므로 표본이 줄면
        # 그대로 임계값 품질이 떨어진다. PatchCore는 1에폭·조기종료 없음이라 별도 검증셋이
        # 필요 없으므로 SAME_AS_TEST로 두어 표본을 온전히 쓴다.
        val_split_mode="same_as_test",
    )

    # 임계값을 우리 절차(정상 백분위)로 직접 뽑기 위해 후처리의 정규화·임계처리를 끈다.
    # → predict가 **원시 anomaly score**를 그대로 준다.
    model = Patchcore(
        backbone=args.backbone,
        layers=layers,
        pre_trained=True,
        coreset_sampling_ratio=args.coreset_ratio,
        pre_processor=PreProcessor(transform=transform),
        post_processor=PostProcessor(enable_normalization=False, enable_thresholding=False),
        visualizer=False,
    )

    engine = Engine(
        default_root_dir=str(outdir / "lightning"),
        max_epochs=1,          # PatchCore는 메모리뱅크 구축 = 1 에폭
        accelerator="auto",
        devices=1,
        logger=False,
        enable_checkpointing=True,
    )

    print("\n[1/4] 메모리뱅크 구축 (train/good)")
    engine.fit(model=model, datamodule=datamodule)

    print("\n[2/4] 테스트셋 점수 산출")
    predictions = engine.predict(model=model, datamodule=datamodule)
    scores, labels = collect_scores(predictions)
    normal, abnormal = scores[labels == 0], scores[labels == 1]
    if normal.size == 0:
        raise SystemExit("정상 테스트 샘플이 없습니다. test/good 을 확인하세요.")
    print(f"  정상 {normal.size}건: 평균 {normal.mean():.4f} 최대 {normal.max():.4f}")
    if abnormal.size:
        print(f"  파손 {abnormal.size}건: 평균 {abnormal.mean():.4f} 최소 {abnormal.min():.4f}")

    if args.threshold_value is not None:
        threshold = float(args.threshold_value)
        print(f"\n[3/4] 임계값 산출 — 수동 지정값 사용 (threshold_mode 계산 건너뜀)")
        print(f"  threshold = {threshold:.6f}")
        if abnormal.size and threshold >= abnormal.min():
            print(f"  ⚠️ 이 값이 파손 최솟값({abnormal.min():.4f}) 이상입니다 — 그만큼 파손 표본이 "
                  f"NORMAL/UNCERTAIN으로 새서 탐지력이 줄어듭니다. 의도한 게 맞는지 확인하세요.")
        if normal.size and threshold <= normal.max():
            print(f"  ⚠️ 이 값이 정상 최댓값({normal.max():.4f}) 이하입니다 — 정상 오탐이 늘어납니다.")
    elif args.threshold_mode == "gap_midpoint":
        if not abnormal.size:
            raise SystemExit("--threshold_mode gap_midpoint 는 파손 표본(test/defective)이 필요합니다.")
        print(f"\n[3/4] 임계값 산출 — gap_midpoint (정상 최댓값~파손 최솟값 구간 중앙)")
        gap_lo, gap_hi = float(normal.max()), float(abnormal.min())
        if gap_lo >= gap_hi:
            print(f"  ⚠️ 정상 최댓값({gap_lo:.4f}) >= 파손 최솟값({gap_hi:.4f}) — 겹치는 구간이라 "
                  f"깨끗한 중앙값을 잡을 수 없습니다. percentile로 폴백합니다.")
            threshold = float(np.percentile(normal, args.percentile))
        else:
            threshold = (gap_lo + gap_hi) / 2.0
            print(f"  분리 구간 {gap_lo:.4f} ~ {gap_hi:.4f} (폭 {gap_hi - gap_lo:.4f}) → threshold = {threshold:.6f}")
        print("  ⚠️ 이 임계값은 지금 파손 표본(마스킹테이프 시뮬레이션)의 간격에 맞춘 것이다 —")
        print("     실제 tear/rib 파손 표본이 늘면 이 구간이 좁아지거나 겹칠 수 있으니 재검증할 것.")
    else:
        print(f"\n[3/4] 임계값 산출 — 정상 분포 p{args.percentile:g} (파손 샘플 미사용)")
        threshold = float(np.percentile(normal, args.percentile))
        print(f"  threshold = {threshold:.6f}")

        # 백분위는 표본이 적으면 의미가 없다. p95를 쓰려면 정상 표본이 최소 20건은 돼야
        # '상위 5%'라는 말이 성립한다(20건이면 1건 = 5%).
        min_needed = int(round(100 / max(100 - args.percentile, 1e-9)))
        if normal.size < min_needed:
            print(f"  ⚠️ 정상 표본 {normal.size}건은 p{args.percentile:g} 산출에 부족합니다 "
                  f"(최소 {min_needed}건 권장). 임계값을 신뢰하지 마세요.")

    score_min = float(min(normal.min(), abnormal.min()) if abnormal.size else normal.min())
    if abnormal.size:
        score_max = float(max(normal.max(), abnormal.max()))
        score_max_estimated = False
    else:
        # 파손 표본이 없으면 정규화의 **상단 기준점을 관측할 수 없다.** 임시로 임계값의 2배를
        # 쓰지만, DAMAGED 밴드(>0.60)의 실제 위치가 추정에 의존하게 된다.
        score_max = float(threshold * 2)
        score_max_estimated = True
        print("  ⚠️ 파손 표본이 없어 scoreMax를 추정(threshold×2)했습니다.")
        print("     → NORMAL/UNCERTAIN 구분은 유효하지만 **DAMAGED 경계는 잠정**입니다.")
        print("     → 파손 샘플 확보 후 재실행하여 확정하세요.")
    if not (score_min < threshold < score_max):
        print("  ⚠️ min < threshold < max 가 성립하지 않습니다. 데이터 분포를 확인하세요.")

    # 이진 임계 통과율이 아니라 **실제 3단 판정 밴드**로 평가한다.
    # 운영에서 우산 상태를 가르는 것은 NORMAL/UNCERTAIN/DAMAGED 이 3분류이기 때문.
    band = (0.5 - args.band_width, 0.5 + args.band_width)
    norm_normal = to_norm_score(normal, score_min, threshold, score_max)
    verdict_normal = classify(norm_normal, band)
    names = VERDICT_NAMES

    print(f"\n  [판정 밴드 적용]  NORMAL <{band[0]}  |  UNCERTAIN  |  >{band[1]} DAMAGED")
    print(f"  {'실제':<8} {'n':>4}  {'NORMAL':>9} {'UNCERTAIN':>10} {'DAMAGED':>9}")
    counts_n = [int((verdict_normal == k).sum()) for k in range(3)]
    print(f"  {'정상':<8} {normal.size:>4}  " +
          "  ".join(f"{c:>7} ({c / normal.size * 100:4.1f}%)" for c in counts_n))

    recall = None
    counts_a = None
    if abnormal.size:
        norm_abnormal = to_norm_score(abnormal, score_min, threshold, score_max)
        verdict_abnormal = classify(norm_abnormal, band)
        counts_a = [int((verdict_abnormal == k).sum()) for k in range(3)]
        print(f"  {'파손':<8} {abnormal.size:>4}  " +
              "  ".join(f"{c:>7} ({c / abnormal.size * 100:4.1f}%)" for c in counts_a))
        # 파손이 격리(UNCERTAIN 또는 DAMAGED)되는 비율 = 운영상 실질 Recall
        recall = float((verdict_abnormal >= 1).mean())

    # 운영상 비용: 정상인데 격리되면 가용 우산이 줄고(슬롯 3~5개라 치명적),
    # 파손인데 NORMAL로 통과하면 다음 사용자에게 파손 우산이 나간다.
    quarantine_normal = float((verdict_normal >= 1).mean())
    print(f"\n  정상인데 격리(UNCERTAIN+DAMAGED) = {quarantine_normal * 100:5.1f}%"
          f"   ← 슬롯 3~5개라 이 값이 크면 시연이 막힌다")
    if recall is not None:
        leak = 1.0 - recall
        print(f"  파손인데 통과(NORMAL)          = {leak * 100:5.1f}%"
              f"   ← 파손 우산이 다음 사용자에게 나간다")
        print(f"  ※ 위 두 값은 확인용. 파손 표본에 맞춰 임계값을 되돌리지 않는다(과적합 방지)")

    fpr = quarantine_normal
    auroc = None
    if abnormal.size:
        from sklearn.metrics import roc_auc_score
        auroc = float(roc_auc_score(labels, scores))
        print(f"  Image-level AUROC = {auroc:.4f}")

    print("\n[4/4] 내보내기")
    onnx_path = None
    if not args.no_export:
        try:
            exported = engine.export(
                model=model,
                export_type="onnx",
                export_root=str(outdir),
                input_size=(args.image_size, args.image_size),
                # ⚠️ input_size만 주면 anomalib이 batch·anomaly_map을 **동적축으로 남긴다.**
                # TensorRT는 동적 shape에 최적화 프로파일을 따로 요구하고, Reshape에서 파생된
                # 동적 차원은 shape 추론 실패로 변환이 깨지기 쉽다. 반납 검수는 1장씩
                # 처리하므로 동적축이 필요 없다 → 완전 고정으로 내보낸다.
                onnx_kwargs={"dynamic_axes": {}},
            )
            onnx_path = str(exported) if exported else None
            print(f"  ONNX: {onnx_path}")
        except Exception as exc:  # noqa: BLE001
            print(f"  ⚠️ ONNX 내보내기 실패: {exc}")
            print("     .ckpt로 배포하려면 Jetson에도 동일 anomalib/torch 버전이 필요합니다.")

    ckpt = engine.trainer.checkpoint_callback.best_model_path if engine.trainer.checkpoint_callback else None
    if ckpt:
        print(f"  ckpt: {ckpt}")

    # ── 전처리 정합 검증 (가장 중요한 자가 검사) ─────────────────────────────
    apply_normalize = True
    if onnx_path:
        ok, vinfo = verify_preprocess(Path(onnx_path), crop_root / "test" / "good",
                                      normal, args.image_size)
        apply_normalize = vinfo.get("applyNormalize", True)
        print("\n  [전처리 정합 검증] 추론 전처리로 학습 점수가 재현되는가?")
        print(f"    학습 평균 {vinfo.get('trainMean', float('nan')):.4f} | "
              f"ONNX(정규화O) {vinfo.get('onnxMeanNormalized')} | "
              f"ONNX(정규화X) {vinfo.get('onnxMeanRaw')}")
        if ok:
            print(f"    ✅ 일치 — applyNormalize={apply_normalize} "
                  f"(상대오차 {vinfo['relativeError']:.2e})")
        else:
            print(f"    ❌ 불일치! 상대오차 {vinfo.get('relativeError', float('nan')):.3e}")
            print("       학습과 추론이 다른 입력을 보고 있습니다. 이 상태로 배포하면")
            print("       임계값이 무의미해집니다. crop.preprocess / 학습 transform을 대조하세요.")

    meta = {
        "modelVersion": version,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "model": {
            "arch": "patchcore",
            "backbone": args.backbone,
            "layers": layers,
            "coresetSamplingRatio": args.coreset_ratio,
        },
        "input": {
            # ⚠️ 추론 측이 원본(비크롭) 프레임에 적용할 크롭 설정 — --crop_mode(이 스크립트가
            # --data_path에 적용한 크롭)와 다를 수 있다(입력이 이미 외부 크롭된 경우).
            "crop": {
                "mode": args.inference_crop_mode or args.crop_mode,
                "padding": args.inference_crop_padding if args.inference_crop_padding is not None else args.crop_padding,
                "detector": Path(args.detector).name,
                "detectorConf": args.crop_conf,
                "umbrellaClassId": UMBRELLA_CLASS_ID,
            },
            "imageSize": args.image_size,
            # apply: 추론 시 ImageNet 정규화를 적용할지. **추측이 아니라 학습 직후 실측으로
            # 확정한 값**이다(verify_preprocess). 임의로 바꾸면 임계값이 무의미해진다.
            "normalization": {"mean": list(IMAGENET_MEAN), "std": list(IMAGENET_STD),
                              "apply": apply_normalize},
        },
        "cropStats": {
            "total": cstats["total"],
            "cropped": cstats["cropped"],
            "noDetection": len(cstats["no_detection"]),
            "tooSmall": len(cstats["too_small"]),
        },
        # 추론 측 판정 계약 (DESCRIPTION.md 「판정 로직 (확정)」(2)(3))
        "decision": {
            "rawThreshold": threshold,
            "thresholdMode": "manual" if args.threshold_value is not None else args.threshold_mode,
            "thresholdPercentile": (args.percentile if args.threshold_mode == "percentile"
                                    and args.threshold_value is None else None),
            "scoreMin": score_min,
            "scoreMax": score_max,
            # true면 파손 표본 없이 추정한 값 → DAMAGED 경계가 잠정이라는 뜻.
            "scoreMaxEstimated": score_max_estimated,
            "normScoreMapping": "piecewise-linear: min->0.0, rawThreshold->0.5, max->1.0",
            "uncertainBand": [round(0.5 - args.band_width, 6), round(0.5 + args.band_width, 6)],
            "confidenceFormula": "abs(normScore - 0.5) * 2",
        },
        "evaluation": {
            "normalCount": int(normal.size),
            "abnormalCount": int(abnormal.size),
            "normalQuarantineRate": fpr,      # 정상인데 UNCERTAIN/DAMAGED로 격리된 비율
            "damageQuarantineRate": recall,   # 파손이 격리된 비율(운영상 실질 Recall)
            "normalVerdictCounts": dict(zip(names, counts_n)),
            "abnormalVerdictCounts": dict(zip(names, counts_a)) if counts_a else None,
            "imageAuroc": auroc,
        },
        "env": {
            "anomalib": anomalib.__version__,
            "torch": torch.__version__,
            "lightning": lightning.__version__,
            "python": platform.python_version(),
            "trainedOn": platform.platform(),
        },
        "notes": "임계값은 정상 분포 백분위로만 산출. 파손 샘플은 Recall 확인 전용(과적합 방지).",
    }
    meta_path = outdir / "metadata.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    np.savez(outdir / "scores.npz", scores=scores, labels=labels)

    print(f"\n산출물: {outdir}")
    print(f"  metadata.json  — 추론 측 판정 계약 (threshold·ROI·정규화·모델버전)")
    print(f"  scores.npz     — 원시 점수/라벨 (임계값 재조정용)")

    if args.keep_crops:
        print(f"  crops/        — 생성된 크롭 이미지 (눈으로 검수)")
    else:
        shutil.rmtree(crop_root, ignore_errors=True)

    if tmpdir:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if args.smoke:
        print("\n[smoke] 파이프라인 검증 완료. 위 성능 수치는 합성 데이터라 의미 없습니다.")


if __name__ == "__main__":
    sys.exit(main())
