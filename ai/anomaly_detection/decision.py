"""파손 판정 계산식 — 학습 측과 추론 측이 **공유하는 단일 출처**.

`DESCRIPTION.md` 「판정 로직 (확정)」(2)(3)의 구현이다.

⚠️ **의존성은 numpy 뿐이다.** torch·anomalib·opencv를 import하지 않는다.
   Jetson(JetPack 6)은 ONNX Runtime만 올리고 anomalib을 설치하지 않으므로,
   이 모듈이 무거운 의존성을 끌면 추론 측에서 그대로 못 쓴다.

학습 측 `train.py`와 추론 측(`infer.py`)이 **같은 함수를 쓰는 것이 요점**이다.
계산식이 한쪽만 바뀌면 임계값이 조용히 어긋난다.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

# 판정 밴드 기본값 (DESCRIPTION.md 판정 로직 (3))
DEFAULT_BAND = (0.40, 0.60)

VERDICT_NAMES = ("NORMAL", "UNCERTAIN", "DAMAGED")
NORMAL, UNCERTAIN, DAMAGED = 0, 1, 2


def to_norm_score(raw, score_min: float, threshold: float, score_max: float) -> np.ndarray:
    """원시 anomaly score → normScore (0~1). min→0.0, threshold→0.5, max→1.0 조각선형 사상.

    임계값이 정확히 0.5로 가므로 밴드를 대칭으로 표현할 수 있고, 무계(unbounded)인
    anomaly score를 API의 0~1 계약에 맞출 수 있다.
    """
    raw = np.asarray(raw, dtype=np.float64)
    out = np.empty_like(raw)
    low = raw <= threshold
    out[low] = 0.5 * (raw[low] - score_min) / max(threshold - score_min, 1e-12)
    out[~low] = 0.5 + 0.5 * (raw[~low] - threshold) / max(score_max - threshold, 1e-12)
    return np.clip(out, 0.0, 1.0)


def classify(norm_score, band: tuple[float, float] = DEFAULT_BAND) -> np.ndarray:
    """normScore → 0=NORMAL / 1=UNCERTAIN / 2=DAMAGED."""
    norm_score = np.asarray(norm_score, dtype=np.float64)
    lo, hi = band
    return np.where(norm_score < lo, NORMAL, np.where(norm_score > hi, DAMAGED, UNCERTAIN))


def confidence(norm_score) -> np.ndarray:
    """판정 확신도 0~1. 경계(0.5)에서 0, 확실할수록 1.

    서버 `inspection-results.confidence` / `DamageInspection.confidence`에 실리는 값.
    """
    return np.clip(np.abs(np.asarray(norm_score, dtype=np.float64) - 0.5) * 2.0, 0.0, 1.0)


class DecisionContract:
    """`metadata.json`을 읽어 판정을 재현한다. 추론 측 진입점."""

    def __init__(self, meta: dict):
        d = meta["decision"]
        self.model_version: str = meta["modelVersion"]
        self.raw_threshold: float = float(d["rawThreshold"])
        self.score_min: float = float(d["scoreMin"])
        self.score_max: float = float(d["scoreMax"])
        self.score_max_estimated: bool = bool(d.get("scoreMaxEstimated", False))
        self.band: tuple[float, float] = tuple(d.get("uncertainBand", DEFAULT_BAND))  # type: ignore[assignment]

        inp = meta["input"]
        self.image_size: int = int(inp["imageSize"])
        self.mean = tuple(inp["normalization"]["mean"])
        self.std = tuple(inp["normalization"]["std"])
        # 학습 직후 실측으로 확정된 값(train.verify_preprocess). 추측 금지.
        self.apply_normalize: bool = bool(inp["normalization"].get("apply", True))

        # 크롭 설정 — 추론이 학습과 **동일한 방식으로 잘라야** 임계값이 유효하다.
        c = inp.get("crop", {})
        self.crop_mode: str = c.get("mode", "inscribed")
        self.crop_padding: float = float(c.get("padding", 0.05))
        self.detector_conf: float = float(c.get("detectorConf", 0.25))
        self.umbrella_class_id: int = int(c.get("umbrellaClassId", 25))

    @classmethod
    def from_file(cls, path: str | Path) -> "DecisionContract":
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    def decide(self, raw_score: float) -> dict:
        """원시 anomaly score 1건 → 서버로 보낼 판정 결과."""
        norm = float(to_norm_score([raw_score], self.score_min, self.raw_threshold, self.score_max)[0])
        verdict = int(classify([norm], self.band)[0])
        return {
            "result": VERDICT_NAMES[verdict],
            "normScore": norm,
            "confidence": float(confidence([norm])[0]),
            "modelVersion": self.model_version,
        }

    def __repr__(self) -> str:
        est = " (scoreMax 추정치 — DAMAGED 경계 잠정)" if self.score_max_estimated else ""
        return (f"<DecisionContract {self.model_version} thr={self.raw_threshold:.4f} "
                f"band={self.band} crop={self.crop_mode}/{self.crop_padding}{est}>")
