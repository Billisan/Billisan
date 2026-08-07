"""ZeroMQ 이벤트 발행 - OrinService에 믹스인으로 결합된다.

Pi로 나가는 모든 신호(Command 응답·READY·헬스비트)를 담당한다."""
import json
import threading
import time
import uuid

from .config import (
    EVENT_PREFIX_TMPL, HEALTH_PREFIX, HEALTH_INTERVAL_SECONDS,
    SCHEMA_VERSION, ORIN_DEVICE_ID, ORIN_BOOT_ID, _iso,
)


class MessagingMixin:
    """send_event / send_ready / start_heartbeat.

    결합 클래스가 제공해야 하는 것: self.event_pub (ZMQ PUB 소켓), self.inspector (헬스비트의
    inspectorLoaded 플래그용)."""

    def send_event(self, event_type, command_id, request_id, station_id, terminal_status, result,
                   command_type=None):
        event = {
            "schemaVersion": SCHEMA_VERSION,
            "messageId": str(uuid.uuid4()),
            "eventId": str(uuid.uuid4()),
            "commandId": command_id,
            "commandType": command_type,  # 원본 Command의 타입 에코 (로그 추적 편의, 없으면 null)
            "requestId": request_id,
            "stationId": station_id,
            "sourceDeviceId": ORIN_DEVICE_ID,
            "sourceBootId": ORIN_BOOT_ID,
            "eventType": event_type,
            "terminalStatus": terminal_status,
            "occurredAt": _iso(),
            "result": result,
        }
        topic = EVENT_PREFIX_TMPL.format(event_type=event_type)
        self.event_pub.send_multipart([topic.encode("utf-8"), json.dumps(event).encode("utf-8")])
        return event

    def start_heartbeat(self):
        """[Orin 헬스비트] HEALTH_INTERVAL 간격으로 생존 신호를 발행한다.
        Pi는 이게 HEALTH_TIMEOUT 동안 끊기면 Orin을 오프라인으로 간주하고
        새 인증/검증 요청을 fail-closed한다 (키오스크에는 DEVICE_OFFLINE 안내)."""
        def loop():
            while True:
                payload = {
                    "schemaVersion": SCHEMA_VERSION,
                    "sourceDeviceId": ORIN_DEVICE_ID,
                    "sourceBootId": ORIN_BOOT_ID,
                    "status": "ONLINE",
                    "inspectorLoaded": self.inspector is not None,
                    "occurredAt": _iso(),
                }
                try:
                    self.event_pub.send_multipart(
                        [HEALTH_PREFIX.encode("utf-8"), json.dumps(payload).encode("utf-8")])
                except Exception as e:
                    print(f"[Orin] 헬스비트 발행 실패 (무시하고 계속): {e}")
                time.sleep(HEALTH_INTERVAL_SECONDS)
        threading.Thread(target=loop, daemon=True).start()
        print(f"[Orin] 헬스비트 시작 ({HEALTH_INTERVAL_SECONDS:.0f}초 간격)")

    def send_ready(self):
        event = {
            "schemaVersion": SCHEMA_VERSION,
            "messageId": str(uuid.uuid4()),
            "eventId": str(uuid.uuid4()),
            "commandId": None,
            "requestId": None,
            "stationId": None,
            "sourceDeviceId": ORIN_DEVICE_ID,
            "sourceBootId": ORIN_BOOT_ID,
            "eventType": "ORIN_READY",
            "terminalStatus": "SUCCEEDED",
            "occurredAt": _iso(),
            "result": None,
        }
        self.event_pub.send_multipart([b"billisan.zmq.v1.orin.event.ORIN_READY", json.dumps(event).encode("utf-8")])
        print(f"[Orin] ORIN_READY 발행 (orinBootId={ORIN_BOOT_ID})")
