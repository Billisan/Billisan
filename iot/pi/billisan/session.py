"""Kiosk 세션 저장소. 프로세스 메모리에만 존재하며 재시작 시 사라진다."""
import threading
import time
import uuid

from .config import SESSION_TTL_SECONDS


_sessions = {}          # sessionId -> 세션 dict
_sessions_lock = threading.Lock()



def _find_session_by_key(client_key, mode, station_id):
    with _sessions_lock:
        for sess in _sessions.values():
            if (sess["clientSessionKey"] == client_key and sess["mode"] == mode
                    and sess["stationId"] == station_id and sess["status"] == "ACTIVE"
                    and sess["expiresAt"] > time.time()):
                return sess
    return None


def _create_session(mode, station_id, client_key):
    sess = {
        "sessionId": str(uuid.uuid4()),
        "mode": mode,
        "status": "ACTIVE",
        "stationId": station_id,
        "clientSessionKey": client_key,
        "kioskStep": "FACE_GUIDE",
        "userRef": None,           # Kiosk로 절대 내보내지 않음 (12-I 개인정보 경계)
        "authenticated": False,
        "phase": "IDLE",          # IDLE|AUTH_CAPTURE|PHYSICAL - KSK-CANCEL-001 허용 경계 판정
        "terminals": {},           # requestId -> 캐시된 Result payload (멱등성: 재전송 시 재실행 금지)
        "context": {},
        "faceGuidance": None,
        "inspectionResult": None,
        "expiresAt": time.time() + SESSION_TTL_SECONDS,
    }
    with _sessions_lock:
        _sessions[sess["sessionId"]] = sess
    return sess
