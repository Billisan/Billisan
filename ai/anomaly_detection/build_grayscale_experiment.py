"""색상 교차-일반화 실험용 데이터셋 빌더 (일회성 실험 스크립트, 프로덕션 파이프라인 아님).

목적: "PatchCore를 grayscale로 학습하면 다른 색·개체의 우산에도 일반화되는가"를
지금 있는 3개체(연보라/회색/파랑) 데이터로 검증한다. 실제 새 우산(노란색) 없이도
"학습 때 전혀 못 본 색의 우산" 시나리오를 재현할 수 있다 — 연보라+회색으로만 학습하고
파랑(train 후반부+test 전체)을 완전히 안 보여준 채로 평가한다.

    datasets/umbrella/train/good/normal_0001~0130  → 연보라+회색 (비-파랑)
    datasets/umbrella/train/good/normal_0131~0207  → 파랑 (train 후반부)
    datasets/umbrella/test/good/*                  → 파랑 (전체)

만든다:
    datasets/experiment_color/train/good  (비-파랑 130장, 원본 그대로)
    datasets/experiment_color/test/good   (파랑 114장, 원본 그대로)
    datasets/experiment_gray/train/good   (비-파랑 130장, grayscale 3채널 복제)
    datasets/experiment_gray/test/good    (파랑 114장, grayscale 3채널 복제)

사용법:
    python build_grayscale_experiment.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "datasets" / "umbrella"
NON_BLUE_CUTOFF = 130  # normal_0001~0130 = 비-파랑 (연보라+회색), 0131~ = 파랑


def to_gray_bgr(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def build(dst_root: Path, grayscale: bool) -> None:
    train_dst = dst_root / "train" / "good"
    test_dst = dst_root / "test" / "good"
    train_dst.mkdir(parents=True, exist_ok=True)
    test_dst.mkdir(parents=True, exist_ok=True)

    train_files = sorted((SRC / "train" / "good").iterdir())
    non_blue = train_files[:NON_BLUE_CUTOFF]
    blue_from_train = train_files[NON_BLUE_CUTOFF:]
    blue_from_test = sorted((SRC / "test" / "good").iterdir())

    def copy_or_convert(src_file: Path, dst_dir: Path) -> None:
        if grayscale:
            img = cv2.imread(str(src_file))
            cv2.imwrite(str(dst_dir / src_file.name), to_gray_bgr(img))
        else:
            shutil.copy2(src_file, dst_dir / src_file.name)

    for f in non_blue:
        copy_or_convert(f, train_dst)
    for f in blue_from_train:
        copy_or_convert(f, test_dst)
    for f in blue_from_test:
        copy_or_convert(f, test_dst)

    print(f"{dst_root.name}: train/good {len(non_blue)}장(비-파랑), "
          f"test/good {len(blue_from_train) + len(blue_from_test)}장(파랑) "
          f"[grayscale={grayscale}]")


def main() -> None:
    build(ROOT / "datasets" / "experiment_color", grayscale=False)
    build(ROOT / "datasets" / "experiment_gray", grayscale=True)


if __name__ == "__main__":
    main()
