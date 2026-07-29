"""원본 풀프레임을 저장하지 않고, YOLO 탐지 bbox의 크롭 결과만 저장한다.

이전 시도들(얼굴 블러, bbox 바깥 블러, 사람 검출 시 전체 제외)은 전부 "풀프레임을 유지한 채
위험 영역을 지운다"는 접근이었고, 매번 검출 실패 사례가 나왔다. 이 스크립트는 다르다 —
**애초에 크롭된 작은 조각만 저장**하므로, 캔버스 자체에 얼굴이 존재할 공간이 없다.
crop.py는 어차피 학습·추론 모두 이 크롭 영역만 모델에 넣으므로(DESCRIPTION.md 판정 로직 (1)),
풀프레임을 들고 있을 이유가 없다.

crop.py의 crop_umbrella()를 그대로 재사용해 train.py/infer.py와 크롭 규칙을 강제로 동일하게
유지한다.

⚠️ **중요**: 이 스크립트로 만든 데이터는 이미 크롭이 끝난 상태다. train.py를 돌릴 때 반드시
`--crop_mode full`을 줘서 재탐지·재크롭을 하지 않게 해야 한다. inscribed로 이미 테두리가
잘려나간 이미지를 다시 YOLO에 넣으면 탐지가 실패하거나 이중 크롭이 발생한다.

사용:
    .venv\\Scripts\\python.exe precrop_dataset.py --source datasets/umbrella --test_ratio 0.15
"""
import argparse
import csv
import shutil
import sys
from pathlib import Path

import cv2
from ultralytics import YOLO

sys.path.insert(0, str(Path(__file__).parent))
from crop import crop_umbrella, DEFAULT_CROP_MODE  # noqa: E402

COCO_UMBRELLA_CLASS = 25

# 시행착오 기록: 얼굴 검출기로 "걸린 것만" 세게 재크롭하는 2단계 방식을 시도했으나,
# 크롭된 결과물에 대한 재검사조차 여러 장을 놓쳤다(육안 확인으로 발견). 어떤 민감도로도
# 탐지기를 신뢰할 수 없다고 결론짓고, **탐지 성공 여부와 무관하게 전체에 동일한 고정
# 음수 패딩을 적용**하는 것으로 최종 확정했다. 기하학적 규칙이라 탐지 실패의 영향을 받지 않는다.


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="datasets/umbrella")
    ap.add_argument("--detector", default="yolov8n.pt")
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--crop_mode", default=DEFAULT_CROP_MODE)
    ap.add_argument("--padding", type=float, default=-0.20,
                     help="음수로 더 세게 자름 -> 사람이 프레임에 붙어있는 촬영 특성상 안전 마진 확보")
    ap.add_argument("--test_ratio", type=float, default=0.15)
    ap.add_argument("--out", default=None, help="미지정 시 --source 그대로(원본 옆에 crops/ 생성)")
    args = ap.parse_args()

    src = Path(args.source)
    out_root = Path(args.out) if args.out else src / "crops"
    exts = {".jpg", ".jpeg", ".png"}
    images = sorted(p for p in src.iterdir() if p.is_file() and p.suffix.lower() in exts)
    print(f"대상: {len(images)}장")

    model = YOLO(args.detector)

    cropped, failed = [], []
    tmp_dir = out_root / "_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    for i, path in enumerate(images, 1):
        img = cv2.imread(str(path))
        if img is None:
            failed.append((path.name, "read_error"))
            continue

        results = model.predict(img, conf=args.conf, classes=[COCO_UMBRELLA_CLASS], verbose=False)
        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            failed.append((path.name, "no_umbrella_detected"))
            continue

        best = boxes[boxes.conf.argmax()]
        bbox = best.xyxy[0].tolist()
        crop = crop_umbrella(img, bbox, mode=args.crop_mode, padding=args.padding)
        if crop is None or crop.size == 0:
            failed.append((path.name, "crop_too_small"))
            continue

        out_path = tmp_dir / path.name
        cv2.imwrite(str(out_path), crop)
        cropped.append(out_path)

        if i % 50 == 0:
            print(f"  ...{i}/{len(images)}")

    print(f"\n크롭 성공: {len(cropped)}장 / 실패(제외): {len(failed)}장 (padding={args.padding} 고정 적용)")
    fail_path = src.parent / "precrop_failed.csv"
    with open(fail_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file", "reason"])
        w.writerows(failed)
    print(f"실패 목록: {fail_path}")

    if not cropped:
        print("크롭된 이미지가 없다. 종료.")
        return

    n_test = max(1, round(len(cropped) * args.test_ratio))
    n_train = len(cropped) - n_test
    train_imgs, test_imgs = cropped[:n_train], cropped[n_train:]

    train_dir, test_dir = src / "train" / "good", src / "test" / "good"
    train_dir.mkdir(parents=True, exist_ok=True)
    test_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    for i, p in enumerate(train_imgs, 1):
        name = f"normal_{i:04d}.jpg"
        shutil.copy2(p, train_dir / name)
        manifest.append({"split": "train/good", "new_name": name, "original": p.name})
    for i, p in enumerate(test_imgs, 1):
        name = f"test_normal_{i:04d}.jpg"
        shutil.copy2(p, test_dir / name)
        manifest.append({"split": "test/good", "new_name": name, "original": p.name})

    with open(src / "manifest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["split", "new_name", "original"])
        w.writeheader()
        w.writerows(manifest)

    shutil.rmtree(tmp_dir, ignore_errors=True)

    print(f"train/good {len(train_imgs)}장, test/good {len(test_imgs)}장")
    print("주의: 이 데이터는 이미 크롭됨. train.py 실행 시 --crop_mode full 필수.")


if __name__ == "__main__":
    main()
