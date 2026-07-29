"""탐지 bbox → PatchCore 입력 크롭 — 학습 측과 추론 측이 **공유하는 단일 출처**.

`DESCRIPTION.md` 「판정 로직」(1)의 구현이다.

⚠️ **의존성은 numpy·opencv 뿐이다.** torch·anomalib·ultralytics를 import하지 않는다.
   탐지는 호출자가 수행하고 bbox만 넘긴다. Jetson은 ONNX Runtime만 올리므로 이 모듈이
   무거운 의존성을 끌면 추론 측에서 못 쓴다. → [decision.py]와 같은 원칙.

**학습과 추론이 반드시 같은 모드·같은 padding**을 써야 한다. 어긋나면 임계값이 그대로
무의미해지며, 에러 없이 조용히 틀린다. 그래서 학습이 쓴 설정을 `metadata.json`에 기록하고
추론이 그것을 읽어 쓴다.
"""

from __future__ import annotations

import cv2
import numpy as np

# 2026-07-22 합성 실험 결과 INSCRIBED가 가장 우수했다(DESCRIPTION.md 판정 로직 (1) 표).
# 실데이터로 GATE-005에서 재확정한다.
CROP_MODES = ("full", "bbox", "inscribed", "mask_ellipse")
DEFAULT_CROP_MODE = "inscribed"
DEFAULT_PADDING = 0.05

_SQRT2 = np.sqrt(2.0)


def to_square_bbox(bbox, width: int, height: int, padding: float = DEFAULT_PADDING):
    """bbox를 정사각형으로 확장하고 padding을 적용한다. 이미지 경계를 넘지 않게 클램프.

    정사각으로 맞추는 이유: 그냥 리사이즈하면 프레임마다 종횡비가 달라져 같은 우산이
    다른 비율로 늘어난다. PatchCore는 그 왜곡을 이상치로 읽는다.
    """
    x1, y1, x2, y2 = (float(v) for v in bbox)
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    side = max(x2 - x1, y2 - y1) * (1.0 + 2.0 * padding)
    # 이미지 밖으로 나가면 정사각형을 유지할 수 없으므로 변 길이를 먼저 줄인다
    side = min(side, float(width), float(height))
    half = side / 2.0
    cx = min(max(cx, half), width - half)
    cy = min(max(cy, half), height - half)
    return (int(round(cx - half)), int(round(cy - half)),
            int(round(cx + half)), int(round(cy + half)))


def crop_umbrella(image: np.ndarray, bbox, mode: str = DEFAULT_CROP_MODE,
                  padding: float = DEFAULT_PADDING) -> np.ndarray | None:
    """모드별 크롭. bbox는 (x1,y1,x2,y2) 픽셀 좌표. 크롭 불가면 None.

    - ``full``         : 크롭하지 않음(전체 프레임). 비교용 기준선.
    - ``bbox``         : 정사각 확장 bbox. **모서리에 배경이 들어온다.**
    - ``inscribed``    : bbox 내접원에 다시 내접하는 정사각형. 배경이 없고 인위적 경계도
                         없어 실험에서 가장 우수했으나, **캐노피 면적의 약 36%(바깥 테두리)를
                         버린다** → 테두리 파손을 놓친다.
    - ``mask_ellipse`` : 정사각 bbox에서 내접 타원 바깥을 0으로 치환. 세그멘테이션 마스킹의
                         근사. 실험에서는 천↔상수 경계 아티팩트가 파손 신호를 덮어 **비권장**.
    """
    if mode not in CROP_MODES:
        raise ValueError(f"알 수 없는 crop mode: {mode} (가능: {CROP_MODES})")
    if mode == "full":
        return image
    if bbox is None:
        return None

    h, w = image.shape[:2]
    x1, y1, x2, y2 = to_square_bbox(bbox, w, h, padding)
    if x2 - x1 < 8 or y2 - y1 < 8:  # 너무 작으면 판정 불가
        return None
    square = image[y1:y2, x1:x2]

    if mode == "bbox":
        return square

    side = square.shape[0]
    if mode == "inscribed":
        # 내접원 반지름 = side/2 → 그 원에 내접하는 정사각형 변 = side/√2
        inner = int(side / _SQRT2)
        off = (side - inner) // 2
        return square[off:off + inner, off:off + inner]

    # mask_ellipse
    mask = np.zeros(square.shape[:2], np.uint8)
    cv2.ellipse(mask, (side // 2, side // 2), (side // 2, side // 2), 0, 0, 360, 255, -1)
    if square.ndim == 3:
        mask = cv2.merge([mask] * square.shape[2])
    return np.where(mask > 0, square, 0).astype(square.dtype)


def resize_for_model(image: np.ndarray, size: int) -> np.ndarray:
    """모델 입력 크기로 리사이즈 — **학습·추론이 반드시 이 함수를 함께 쓴다.**

    torchvision의 `Resize(antialias=True)`와 `cv2.resize` 기본 보간은 **축소 시 결과가 다르다.**
    학습을 torchvision으로, 추론을 cv2로 하면 같은 이미지에서 점수가 미묘하게 어긋나고,
    그 차이가 임계값 근처에서 판정을 뒤집는다. 그래서 양쪽 모두 이 함수를 거치게 하고
    학습 측은 크롭 단계에서 미리 리사이즈해 둔다(torchvision Resize는 항등이 된다).
    """
    h, w = image.shape[:2]
    interp = cv2.INTER_AREA if (h > size or w > size) else cv2.INTER_LINEAR
    return cv2.resize(image, (size, size), interpolation=interp)


def preprocess(image: np.ndarray, size: int, mean, std, apply_normalize: bool = True) -> np.ndarray:
    """크롭된 BGR 이미지 → 모델 입력 텐서 (1,3,H,W) float32.

    ⚠️ **`apply_normalize`를 추측하지 말 것.** ONNX 그래프는 전처리를 포함하지 않고, anomalib이
    학습 배치에 정규화를 실제로 적용했는지는 버전·경로에 따라 달라진다. 틀리면 점수가 8배
    어긋나는데 **에러 없이 조용히 틀린다.**

    그래서 `train.py`가 학습 직후 **양쪽을 모두 시도해 학습 점수와 일치하는 쪽을 실측으로
    확정**하고 `metadata.json`의 `input.normalization.apply`에 기록한다. 추론 측은 그 값을
    읽어 쓴다(`decision.DecisionContract.apply_normalize`).
    """
    x = resize_for_model(image, size)
    x = cv2.cvtColor(x, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    if apply_normalize:
        x = (x - np.asarray(mean, np.float32)) / np.asarray(std, np.float32)
    return np.ascontiguousarray(x.transpose(2, 0, 1)[None])


def describe(mode: str, padding: float) -> str:
    notes = {
        "full": "전체 프레임 (크롭 없음)",
        "bbox": "정사각 확장 bbox — 모서리 배경 포함",
        "inscribed": "내접 정사각 — 배경 없음, 테두리 36% 손실",
        "mask_ellipse": "내접 타원 마스킹 — 경계 아티팩트 위험",
    }
    return f"{mode} (padding={padding}) — {notes.get(mode, '')}"
