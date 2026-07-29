"""잔여 얼굴-의심 후보 목록을 콘택트시트(그리드 썸네일)로 묶어서 한 번에 육안 검수한다.

사용:
    .venv\\Scripts\\python.exe make_contact_sheet.py --list residual.txt --source datasets/umbrella --out sheets --per_sheet 12
"""
import argparse
from pathlib import Path

import cv2
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", required=True, help="파일명 목록 (한 줄에 하나)")
    ap.add_argument("--source", default="datasets/umbrella")
    ap.add_argument("--out", default="sheets")
    ap.add_argument("--per_sheet", type=int, default=12)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--thumb", type=int, default=320)
    args = ap.parse_args()

    names = [l.strip() for l in open(args.list, encoding="utf-8") if l.strip()]
    src = Path(args.source)
    out = Path(args.out)
    out.mkdir(exist_ok=True)

    rows = -(-args.per_sheet // args.cols)
    sheet_w = args.cols * args.thumb
    sheet_h = rows * (args.thumb + 30)

    for sheet_idx in range(0, len(names), args.per_sheet):
        chunk = names[sheet_idx: sheet_idx + args.per_sheet]
        canvas = np.full((sheet_h, sheet_w, 3), 40, dtype=np.uint8)
        for i, name in enumerate(chunk):
            path = src / name
            img = cv2.imread(str(path))
            r, c = divmod(i, args.cols)
            y0, x0 = r * (args.thumb + 30), c * args.thumb
            if img is None:
                continue
            h, w = img.shape[:2]
            scale = args.thumb / max(h, w)
            resized = cv2.resize(img, (int(w * scale), int(h * scale)))
            rh, rw = resized.shape[:2]
            canvas[y0:y0 + rh, x0:x0 + rw] = resized
            label = f"{sheet_idx + i}:{name[4:19]}"
            cv2.putText(canvas, label, (x0 + 4, y0 + args.thumb + 22),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        sheet_path = out / f"sheet_{sheet_idx // args.per_sheet:02d}.jpg"
        cv2.imwrite(str(sheet_path), canvas, [cv2.IMWRITE_JPEG_QUALITY, 85])
        print(f"wrote {sheet_path}")


if __name__ == "__main__":
    main()
