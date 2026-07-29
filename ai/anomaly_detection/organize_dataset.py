"""플랫하게 쌓인 원본 촬영본을 DESCRIPTION.md/DATA_COLLECTION.md 규격 폴더로 정리한다.

- 입력: <source>/*.jpg (파일명에 타임스탬프 포함, 촬영 순서 = 정렬 순서)
- 출력: <source>/train/good/, <source>/test/good/ (+ 원본은 그대로 둔다 — 복사만 함)
- 분할: 무작위 셔플이 아니라 **시간순으로 끝 구간을 test로** 뗀다. 연속 프레임이 3초 간격이라
  무작위 분할하면 train/test에 거의 동일한 프레임이 동시에 들어가는 누수가 생긴다
  (DATA_COLLECTION.md §3 "세션 단위 분리" 원칙 — 단일 세션이라 완전한 세션 분리는 불가능하므로
  최대한 근접한 근사로 시간 블록 분리를 쓴다).
- 파일명은 §7 규칙(normal_XXX.jpg / test_normal_XXX.jpg)을 따르고, manifest.csv에 원본 파일명·
  타임스탬프를 남겨 추적 가능하게 한다.

사용:
    .venv\\Scripts\\python.exe organize_dataset.py --source datasets/umbrella --test_ratio 0.15
"""
import argparse
import csv
import shutil
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="datasets/umbrella")
    ap.add_argument("--test_ratio", type=float, default=0.15)
    ap.add_argument("--dry_run", action="store_true", help="복사 없이 계획만 출력")
    args = ap.parse_args()

    src = Path(args.source)
    exts = {".jpg", ".jpeg", ".png"}
    images = sorted(p for p in src.iterdir() if p.is_file() and p.suffix.lower() in exts)
    if not images:
        print(f"'{src}'에 정리할 이미지가 없다 (이미 정리됐거나 경로가 잘못됨)")
        return

    n_test = max(1, round(len(images) * args.test_ratio))
    n_train = len(images) - n_test
    train_imgs = images[:n_train]
    test_imgs = images[n_train:]

    train_dir = src / "train" / "good"
    test_dir = src / "test" / "good"
    print(f"총 {len(images)}장 -> train/good {len(train_imgs)}장 (시간순 앞부분) / "
          f"test/good {len(test_imgs)}장 (시간순 끝부분, test_ratio={args.test_ratio})")

    if args.dry_run:
        print("(--dry_run: 실제 복사는 하지 않음)")
        return

    train_dir.mkdir(parents=True, exist_ok=True)
    test_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = src / "manifest.csv"
    rows = []

    for i, p in enumerate(train_imgs, 1):
        new_name = f"normal_{i:04d}.jpg"
        shutil.copy2(p, train_dir / new_name)
        rows.append({"split": "train/good", "new_name": new_name, "original": p.name})

    for i, p in enumerate(test_imgs, 1):
        new_name = f"test_normal_{i:04d}.jpg"
        shutil.copy2(p, test_dir / new_name)
        rows.append({"split": "test/good", "new_name": new_name, "original": p.name})

    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["split", "new_name", "original"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"완료. manifest: {manifest_path}")
    print("원본 플랫 파일은 그대로 두었다 (복사만 수행). 얼굴 검수 후 필요하면 직접 정리할 것.")


if __name__ == "__main__":
    main()
