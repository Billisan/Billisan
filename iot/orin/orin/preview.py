"""Flask 프리뷰 스트림 - 키오스크가 카메라 영상을 보는 경로."""
import time

import cv2
from flask import Flask, Response, request, abort

from .config import PREVIEW_OVERLAY, STREAM_TOKEN

flask_app = Flask(__name__)

# main에서 주입 (프리뷰가 참조할 카메라/서비스 핸들)
_ctx = {"camera": None, "service": None}


def bind(camera, service):
    """진입점에서 카메라·서비스를 연결한다."""
    _ctx["camera"] = camera
    _ctx["service"] = service


# ---------------- Flask Preview (명령과 무관하게 항상 제공) ----------------

def generate_frames():
    while True:
        frame = _ctx["camera"].get_frame()
        if frame is None:
            time.sleep(0.05)
            continue

        if PREVIEW_OVERLAY:
            display = frame.copy()
            bbox, labels = _ctx["service"].get_overlay()
            if bbox is not None:
                x1, y1, x2, y2 = [int(v) for v in bbox]
                cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 0), 2)
                for i, line in enumerate(labels):
                    cv2.putText(display, line, (x1, max(y1 - 10, 20) - i * 24),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        else:
            display = frame  # 오버레이 없으면 복사 불필요 (프레임당 copy 비용 절약)

        ok, buffer = cv2.imencode(".jpg", display)
        if not ok:
            continue
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")


@flask_app.route("/video")
def video():
    if request.args.get("token", "") != STREAM_TOKEN:
        abort(403)
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@flask_app.route("/")
def index():
    return f'<html><body style="margin:0;background:#000"><img src="/video?token={STREAM_TOKEN}" style="width:100%"></body></html>'


if __name__ == "__main__":
    print("[1/4] buffalo_l 모델 로딩 중...")
