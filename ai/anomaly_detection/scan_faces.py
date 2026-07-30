"""수집한 학습 원본 이미지에 사람 얼굴이 찍혔는지 1차 스캔한다.

DATA_COLLECTION.md §9: "프레임에 사람·얼굴 진입 금지" 위반 여부를 사람이 판단하기 전에
후보를 걸러내는 용도. Haar cascade는 오탐·누락이 있으므로 최종 판단은 사람이 한다
(자동 삭제하지 않는다).

사용:
    .venv\\Scripts\\python.exe scan_faces.py --source datasets/umbrella --out face_scan_report.csv
"""
import argparse
import csv
from pathlib import Path

import cv2


def build_detectors():
    base = Path(cv2.data.haarcascades)
    return {
        "frontal": cv2.CascadeClassifier(str(base / "haarcascade_frontalface_default.xml")),
        "profile": cv2.CascadeClassifier(str(base / "haarcascade_profileface.xml")),
    }


def scan_image(path: Path, detectors: dict) -> list[tuple[str, tuple]]:
    img = cv2.imread(str(path))
    if img is None:
        return [("READ_ERROR", ())]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    hits = []
    for name, detector in detectors.items():
        if detector.empty():
            continue
        faces = detector.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )
        for (x, y, w, h) in faces:
            hits.append((name, (int(x), int(y), int(w), int(h))))
        if name == "profile":
            flipped = cv2.flip(gray, 1)
            faces_flipped = detector.detectMultiScale(
                flipped, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
            )
            for (x, y, w, h) in faces_flipped:
                fw = gray.shape[1]
                hits.append(("profile_mirrored", (int(fw - x - w), int(y), int(w), int(h))))
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="datasets/umbrella", help="스캔할 폴더 (재귀)")
    ap.add_argument("--out", default="face_scan_report.csv")
    args = ap.parse_args()

    src = Path(args.source)
    exts = {".jpg", ".jpeg", ".png"}
    images = sorted(p for p in src.rglob("*") if p.suffix.lower() in exts)
    print(f"스캔 대상: {len(images)}장 (in {src})")

    detectors = build_detectors()
    for d in detectors.values():
        if d.empty():
            print("⚠️ Haar cascade 로드 실패 — opencv-python 데이터 경로 확인 필요")
            return

    rows = []
    flagged = 0
    for i, path in enumerate(images, 1):
        hits = scan_image(path, detectors)
        if hits:
            flagged += 1
            for kind, box in hits:
                rows.append({
                    "file": str(path.relative_to(src)),
                    "detector": kind,
                    "box": box,
                })
        if i % 50 == 0:
            print(f"  ...{i}/{len(images)}")

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["file", "detector", "box"])
        writer.writeheader()
        writer.writerows(rows)

    unique_files = sorted({r["file"] for r in rows})
    print(f"\n총 {len(images)}장 중 얼굴 후보 검출: {len(unique_files)}장 ({len(unique_files)/max(len(images),1)*100:.1f}%)")
    print(f"상세 리포트: {args.out}")
    print("\n의심 파일 목록:")
    for f in unique_files:
        print(f"  {f}")


if __name__ == "__main__":
    main()
