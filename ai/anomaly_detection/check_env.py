"""설치 검증용 스크립트. 카메라 창을 띄우지 않고 환경만 점검한다.

    python check_env.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> None:
    print(f"python      : {sys.version.split()[0]}  ({sys.executable})")

    import torch

    print(f"torch       : {torch.__version__}")
    print(f"cuda build  : {torch.version.cuda}")
    print(f"cuda avail  : {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"gpu         : {torch.cuda.get_device_name(0)}")

    import cv2

    print(f"opencv      : {cv2.__version__}")

    import ultralytics
    from ultralytics import YOLO

    print(f"ultralytics : {ultralytics.__version__}")

    # 더미 이미지로 추론 1회 — 가중치 로딩과 forward pass 확인
    import numpy as np

    model = YOLO(str(ROOT / "yolov8n.pt"))
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    dummy = np.zeros((640, 640, 3), dtype=np.uint8)
    results = model.predict(dummy, device=device, verbose=False)
    print(f"inference   : OK on {device} / classes={len(model.names)} / boxes={len(results[0].boxes)}")

    # 카메라 오픈 가능 여부만 확인하고 즉시 반납
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if cap.isOpened():
        ok, frame = cap.read()
        shape = frame.shape if ok else None
        print(f"camera 0    : OK / frame={shape}")
    else:
        print("camera 0    : 열 수 없음 (다른 앱 점유 또는 미연결)")
    cap.release()


if __name__ == "__main__":
    main()
