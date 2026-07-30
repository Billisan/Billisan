"""YOLOv8n 웹캠 실시간 사물 인식 검증 스크립트.

Jetson Orin Nano 온디바이스 추론 PoC 전에, 개발 PC에서 모델 로딩 →
카메라 프레임 취득 → 추론 → 시각화 파이프라인이 도는지 확인하는 용도.

사용 예:
    python detect_webcam.py                    # 기본 카메라(0), 자동 디바이스
    python detect_webcam.py --camera 1         # 두 번째 카메라
    python detect_webcam.py --device cpu       # CPU 강제
    python detect_webcam.py --conf 0.5         # 신뢰도 임계값 조정
    python detect_webcam.py --record out.mp4   # 결과 영상 저장

종료: q 또는 ESC
"""

import argparse
import time
from collections import deque
from pathlib import Path

import cv2
import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="YOLOv8n webcam detection check")
    parser.add_argument("--model", default=str(ROOT / "yolov8n.pt"), help="모델 가중치 경로")
    parser.add_argument("--camera", type=int, default=0, help="카메라 인덱스")
    parser.add_argument("--width", type=int, default=1280, help="캡처 가로 해상도")
    parser.add_argument("--height", type=int, default=720, help="캡처 세로 해상도")
    parser.add_argument("--imgsz", type=int, default=640, help="추론 입력 크기")
    parser.add_argument("--conf", type=float, default=0.35, help="신뢰도 임계값")
    parser.add_argument("--device", default=None, help="cuda:0 / cpu (미지정 시 자동)")
    parser.add_argument("--record", default=None, help="결과 영상 저장 경로(.mp4)")
    return parser.parse_args()


def open_camera(index: int, width: int, height: int) -> cv2.VideoCapture:
    """Windows에서는 DSHOW 백엔드가 초기화가 빠르고 안정적이다."""
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(index)  # 백엔드 폴백
    if not cap.isOpened():
        raise RuntimeError(
            f"카메라 {index}번을 열 수 없습니다. "
            "다른 앱이 점유 중이거나 인덱스가 틀렸을 수 있습니다."
        )
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    return cap


def main() -> None:
    args = parse_args()

    device = args.device or ("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"[env] torch {torch.__version__} / cuda_available={torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"[env] gpu: {torch.cuda.get_device_name(0)}")
    print(f"[env] device: {device}")

    model = YOLO(args.model)
    model.to(device)
    print(f"[model] {args.model} / classes={len(model.names)}")

    cap = open_camera(args.camera, args.width, args.height)
    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[camera] index={args.camera} resolution={actual_w}x{actual_h}")

    writer = None
    if args.record:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.record, fourcc, 20.0, (actual_w, actual_h))

    latencies: deque[float] = deque(maxlen=30)
    window = "YOLOv8n webcam (q/ESC to quit)"

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[warn] 프레임을 읽지 못했습니다. 종료합니다.")
                break

            started = time.perf_counter()
            results = model.predict(
                frame,
                imgsz=args.imgsz,
                conf=args.conf,
                device=device,
                verbose=False,
            )
            latencies.append((time.perf_counter() - started) * 1000)

            annotated = results[0].plot()
            avg_ms = sum(latencies) / len(latencies)
            overlay = f"{avg_ms:5.1f} ms  |  {1000 / avg_ms:4.1f} FPS  |  {device}  |  objects: {len(results[0].boxes)}"
            cv2.putText(
                annotated, overlay, (12, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA,
            )

            if writer is not None:
                writer.write(annotated)

            cv2.imshow(window, annotated)
            if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                break
    finally:
        cap.release()
        if writer is not None:
            writer.release()
            print(f"[record] saved: {args.record}")
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
