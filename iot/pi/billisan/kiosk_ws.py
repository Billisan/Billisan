"""Flask 앱과 WebSocket 라우트. 프로토콜 처리는 kiosk_protocol, 업무는 kiosk_ops가 담당한다."""
from flask import Flask
from flask_sock import Sock

from .kiosk_protocol import _kiosk_v3_loop
from . import kiosk_ops

# kiosk_ops는 임포트되는 것 자체가 목적이다 (@_kiosk_op 데코레이터가 Operation 7종을
# 프로토콜 계층에 등록한다). __all__에 넣어 '미사용 임포트'가 아님을 명시한다.
__all__ = ["flask_app", "sock", "kiosk_ops"]

flask_app = Flask(__name__)
sock = Sock(flask_app)


@flask_app.after_request
def _add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@sock.route("/ws/v1/kiosk")
def kiosk_v3_ws(ws):
    _kiosk_v3_loop(ws)


@sock.route("/ws/v1/kiosk/")
def kiosk_v3_ws_slash(ws):
    _kiosk_v3_loop(ws)
