"""Kiosk WebSocket 프로토콜 인프라 - Envelope 송수신, Operation 등록/디스패치.

업무 로직은 kiosk_ops.py에 있고 이 모듈은 '어떻게 주고받는가'만 담당한다."""
import json
import time
import uuid

from .config import kiosk_signal_logger
from .session import _sessions, _sessions_lock
from .utils import _iso_ts

class _KioskWs:
    """한 WebSocket 연결에서의 v3.0 Envelope 송수신 헬퍼."""

    def __init__(self, ws):
        self.ws = ws

    def send(self, msg_type, session_id, request_id, correlation_id, payload):
        envelope = {
            "type": msg_type,
            "sessionId": session_id,
            "requestId": request_id,
            "correlationId": correlation_id,
            "expiresAt": None,
            "payload": payload,
        }
        kiosk_signal_logger.info(f"OUT WS-Kiosk {json.dumps(envelope, ensure_ascii=False)}")
        try:
            self.ws.send(json.dumps(envelope))
        except Exception as e:
            print(f"[Pi][Kiosk-WS] 전송 실패({msg_type}): {e}")

    def ack(self, base, sid, rid, cid, error_code=None):
        self.send(f"{base}.ACK", sid, rid, cid,
                  {"ackStatus": "ACCEPTED" if error_code is None else "REJECTED",
                   "acceptedAt": _iso_ts(), "errorCode": error_code})

    def error(self, sid, rid, cid, error_code, message=""):
        self.send("KIOSK.OPERATION.ERROR", sid, rid, cid,
                  {"errorCode": error_code, "message": message, "retryable": True})


def _kiosk_v3_loop(ws):
    """지속 연결: Envelope를 계속 수신해 Operation 단위로 처리한다."""
    conn = _KioskWs(ws)
    print("[Pi][Kiosk-WS] v3.0 연결 수립")
    while True:
        try:
            raw = ws.receive()
        except Exception:
            break
        if raw is None:
            break
        try:
            msg = json.loads(raw)
        except Exception:
            kiosk_signal_logger.info(f"IN  WS-Kiosk (파싱실패) {raw[:300]}")
            conn.error(None, None, None, "COMMAND_EXPIRED", "JSON 파싱 실패")
            continue
        kiosk_signal_logger.info(f"IN  WS-Kiosk {json.dumps(msg, ensure_ascii=False)}")
        try:
            _dispatch_kiosk(conn, msg)
        except Exception as e:
            print(f"[Pi][Kiosk-WS] Operation 처리 중 예외: {e}")
            conn.error(msg.get("sessionId"), msg.get("requestId"), msg.get("correlationId"),
                       "STATE_RECONCILIATION_REQUIRED", "내부 오류")
    print("[Pi][Kiosk-WS] v3.0 연결 종료")


_KIOSK_OPS = {}  # base type -> handler


def _kiosk_op(base):
    def deco(fn):
        _KIOSK_OPS[base] = fn
        return fn
    return deco


def _dispatch_kiosk(conn, msg):
    msg_type = msg.get("type", "")
    if not msg_type.endswith(".REQUEST"):
        return  # 서버는 REQUEST만 처리
    base = msg_type[: -len(".REQUEST")]
    sid = msg.get("sessionId")
    rid = msg.get("requestId") or str(uuid.uuid4())
    cid = msg.get("correlationId") or str(uuid.uuid4())
    payload = msg.get("payload") or {}

    # Envelope 만료 검사 (12-I: expiresAt이 지난 Request는 실행하지 않는다)
    expires_at = msg.get("expiresAt")
    if expires_at:
        try:
            if time.mktime(time.strptime(expires_at, "%Y-%m-%dT%H:%M:%SZ")) < time.mktime(time.gmtime()):
                conn.ack(base, sid, rid, cid, error_code="COMMAND_EXPIRED")
                conn.error(sid, rid, cid, "COMMAND_EXPIRED", "만료된 요청")
                return
        except ValueError:
            pass  # 형식 불명이면 만료 검사 생략

    handler = _KIOSK_OPS.get(base)
    if handler is None:
        conn.error(sid, rid, cid, "COMMAND_EXPIRED", f"알 수 없는 Operation: {base}")
        return
    print(f"[Pi][Kiosk-WS] {base} 수신 (sessionId={sid}, requestId={rid})")
    handler(conn, base, sid, rid, cid, payload)


def _get_session(conn, base, sid, rid, cid, require_active=True):
    with _sessions_lock:
        sess = _sessions.get(sid)
    if sess is None:
        conn.ack(base, sid, rid, cid, error_code="SESSION_NOT_FOUND")
        conn.error(sid, rid, cid, "SESSION_NOT_FOUND", "세션 없음")
        return None
    if sess["expiresAt"] < time.time() and sess["status"] == "ACTIVE":
        sess["status"] = "RECOVERY_REQUIRED"
    if require_active and sess["status"] != "ACTIVE":
        conn.ack(base, sid, rid, cid, error_code="SESSION_EXPIRED")
        conn.error(sid, rid, cid, "SESSION_EXPIRED", f"세션 상태={sess['status']}")
        return None
    return sess
