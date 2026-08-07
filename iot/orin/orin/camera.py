"""카메라 프레임 공유와 얼굴 가이드 영역 판정."""
import threading

import cv2

from .config import (
    GUIDE_CX_FRAC, GUIDE_CY_FRAC, GUIDE_RX_FRAC_OF_HEIGHT,
    GUIDE_RY_FRAC_OF_HEIGHT, GUIDE_NEAR_MARGIN, VISIBLE_HEIGHT_RATIO,
)


class SharedCamera:
    """카메라를 한 곳에서만 열고, 다른 모든 곳은 여기서 최신 프레임만 읽어간다."""

    def __init__(self, index=0, width=None, height=None):
        self.cap = cv2.VideoCapture(index)
        if not self.cap.isOpened():
            raise RuntimeError(f"카메라를 열 수 없습니다 (index={index})")

        # MJPG를 해상도보다 먼저 지정해야 한다. 무압축(YUYV)으로 잡히면 USB 대역폭 때문에
        # 1280x720이 7.5fps로 떨어지지만, MJPG면 같은 해상도에서 30fps가 나온다.
        self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        if width:
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        if height:
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

        actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = self.cap.get(cv2.CAP_PROP_FPS)
        fourcc_int = int(self.cap.get(cv2.CAP_PROP_FOURCC))
        actual_fourcc = "".join(chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4))
        print(f"[Camera] 요청={width}x{height} MJPG -> 실제={actual_w}x{actual_h} "
              f"{actual_fourcc} @{actual_fps:.0f}fps")
        if (actual_w, actual_h) != (width, height):
            print(f"[Camera] 경고: 요청 해상도가 그대로 적용되지 않음 "
                  f"(카메라 지원 목록 확인: v4l2-ctl -d /dev/video{index} --list-formats-ext)")
        if actual_fourcc != "MJPG":
            print(f"[Camera] 경고: MJPG가 아닌 {actual_fourcc}로 협상됨 - 프레임레이트가 낮을 수 있음")

        self.latest_frame = None
        self.lock = threading.Lock()
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while True:
            ok, frame = self.cap.read()
            if ok:
                with self.lock:
                    self.latest_frame = frame

    def get_frame(self):
        with self.lock:
            return None if self.latest_frame is None else self.latest_frame.copy()


def is_within_guide(bbox, frame_width, frame_height) -> bool:
    x1, y1, x2, y2 = bbox
    face_cx = (x1 + x2) / 2
    face_cy = (y1 + y2) / 2

    visible_height = frame_height * VISIBLE_HEIGHT_RATIO
    crop_top = (frame_height - visible_height) / 2

    guide_cx = GUIDE_CX_FRAC * frame_width
    guide_cy = crop_top + GUIDE_CY_FRAC * visible_height
    guide_rx = GUIDE_RX_FRAC_OF_HEIGHT * visible_height * GUIDE_NEAR_MARGIN
    guide_ry = GUIDE_RY_FRAC_OF_HEIGHT * visible_height * GUIDE_NEAR_MARGIN

    return ((face_cx - guide_cx) / guide_rx) ** 2 + ((face_cy - guide_cy) / guide_ry) ** 2 <= 1.0
