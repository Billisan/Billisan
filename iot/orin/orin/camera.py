"""카메라 프레임 공유와 얼굴 가이드 영역 판정."""
import threading
import time

import cv2

from .config import (
    GUIDE_CX_FRAC, GUIDE_CY_FRAC, GUIDE_RX_FRAC_OF_HEIGHT,
    GUIDE_RY_FRAC_OF_HEIGHT, GUIDE_NEAR_MARGIN, VISIBLE_HEIGHT_RATIO,
)


class SharedCamera:
    """카메라를 한 곳에서만 열고, 다른 모든 곳은 여기서 최신 프레임만 읽어간다."""

    # 연속 실패가 이 횟수를 넘으면 장치를 다시 연다 (USB 재연결·드라이버 리셋 대응)
    REOPEN_AFTER_FAILURES = 30
    READ_FAIL_SLEEP = 0.1        # 실패 시 대기 - 없으면 busy-loop로 CPU를 100% 태운다

    def __init__(self, index=0, width=None, height=None):
        # 재연결 시 같은 설정으로 다시 열기 위해 보관
        self.index = index
        self.width = width
        self.height = height
        self.consecutive_failures = 0
        self._healthy = True

        self.cap = self._open()
        if not self.cap.isOpened():
            raise RuntimeError(f"카메라를 열 수 없습니다 (index={index})")

        self._report_negotiated()

        self.latest_frame = None
        self.lock = threading.Lock()
        threading.Thread(target=self._loop, daemon=True).start()

    def _open(self):
        """장치를 열고 포맷·해상도를 설정한다. 최초 기동과 재연결에서 공용으로 쓴다."""
        cap = cv2.VideoCapture(self.index)
        # MJPG를 해상도보다 먼저 지정해야 한다. 무압축(YUYV)으로 잡히면 USB 대역폭 때문에
        # 1280x720이 7.5fps로 떨어지지만, MJPG면 같은 해상도에서 30fps가 나온다.
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        if self.width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        if self.height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        return cap

    def _report_negotiated(self):
        """드라이버가 실제로 협상한 값을 출력한다 (요청과 다를 수 있음)."""
        actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = self.cap.get(cv2.CAP_PROP_FPS)
        fourcc_int = int(self.cap.get(cv2.CAP_PROP_FOURCC))
        actual_fourcc = "".join(chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4))
        print(f"[Camera] 요청={self.width}x{self.height} MJPG -> 실제={actual_w}x{actual_h} "
              f"{actual_fourcc} @{actual_fps:.0f}fps")
        if (actual_w, actual_h) != (self.width, self.height):
            print(f"[Camera] 경고: 요청 해상도가 그대로 적용되지 않음 "
                  f"(지원 목록 확인: v4l2-ctl -d /dev/video{self.index} --list-formats-ext)")
        if actual_fourcc != "MJPG":
            print(f"[Camera] 경고: MJPG가 아닌 {actual_fourcc}로 협상됨 - 프레임레이트가 낮을 수 있음")

    def _reopen(self):
        """장치를 닫고 다시 연다. USB 재연결이나 드라이버 리셋 상황을 회복하기 위한 경로."""
        print(f"[Camera] 연속 실패 {self.consecutive_failures}회 - 장치 재연결 시도")
        try:
            self.cap.release()
        except Exception as e:
            print(f"[Camera] release 실패(무시): {e}")
        time.sleep(0.5)  # 장치가 정리될 시간을 준다
        self.cap = self._open()
        # 성공·실패와 무관하게 카운터를 리셋한다. 실패했다고 그대로 두면 다음 루프에서
        # 곧바로(31회째) 다시 _reopen이 호출되어, 무거운 VideoCapture 해제/생성이
        # 매 0.1초마다 반복된다 - 원래 막으려던 자원 낭비가 형태만 바꿔 재발한다.
        # 리셋해두면 다음 재시도는 REOPEN_AFTER_FAILURES회(약 3초) 뒤가 된다.
        self.consecutive_failures = 0
        if self.cap.isOpened():
            print("[Camera] 재연결 성공")
            self._report_negotiated()
            self._healthy = True
        else:
            print(f"[Camera] 재연결 실패 - 약 {self.REOPEN_AFTER_FAILURES * self.READ_FAIL_SLEEP:.0f}초 후 재시도")

    def _loop(self):
        while True:
            try:
                ok, frame = self.cap.read()
            except Exception as e:
                # 장치가 사라지면 read 자체가 예외를 던지는 경우가 있다
                print(f"[Camera] read 예외: {e}")
                ok, frame = False, None

            if ok:
                if self.consecutive_failures:
                    print(f"[Camera] 프레임 수신 복구 (실패 {self.consecutive_failures}회 후)")
                    self.consecutive_failures = 0
                    self._healthy = True
                with self.lock:
                    self.latest_frame = frame
                continue

            # --- 실패 경로 ---
            # 대기 없이 재시도하면 초당 수만 번 루프를 돌며 코어 하나를 100% 점유한다.
            # Jetson은 그 발열로 thermal throttling이 걸려 AI 추론까지 느려지므로 반드시 쉰다.
            self.consecutive_failures += 1
            if self.consecutive_failures == 1:
                print("[Camera] 프레임 수신 실패 - 재시도 중")
            if self.consecutive_failures >= self.REOPEN_AFTER_FAILURES:
                self._healthy = False
                self._reopen()
            time.sleep(self.READ_FAIL_SLEEP)

    def is_healthy(self) -> bool:
        """최근 프레임 수신이 정상인지. 헬스비트·상태 보고에 쓸 수 있다."""
        return self._healthy

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