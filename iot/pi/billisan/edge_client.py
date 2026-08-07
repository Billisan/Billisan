"""Spring과의 Edge 요청/응답 (MQTT). 요청을 보내고 응답이 올 때까지 대기한다."""
import json
import threading

from .config import EDGE_REQUEST_TOPIC_TMPL, spring_signal_logger
from .orin_client import STATION_ID


class EdgeClient:
    """
    Pi -> Spring Edge 요청-응답 (EDGE-RENT-001, EDGE-RETURN-003, EDGE-DEVICE-001 등 공용).
    한 번에 하나의 요청만 대기한다고 가정한 PoC 단순화 버전 - operation_id 기준으로만 매칭한다.
    """

    def __init__(self, mqtt_client):
        self.mqtt_client = mqtt_client
        self.lock = threading.Lock()
        self.pending = {}    # operation_id -> threading.Event
        self.responses = {}  # operation_id -> 응답 payload

    def handle_response_message(self, operation_id: str, payload: dict):
        with self.lock:
            self.responses[operation_id] = payload
            waiter = self.pending.get(operation_id)
        if waiter is not None:
            waiter.set()

    def send_request(self, operation_id: str, payload: dict, timeout_seconds: float = 20.0):
        with self.lock:
            waiter = threading.Event()
            self.pending[operation_id] = waiter
            self.responses.pop(operation_id, None)

        topic = EDGE_REQUEST_TOPIC_TMPL.format(station_id=STATION_ID, operation_id=operation_id)
        self.mqtt_client.publish(topic, json.dumps(payload), qos=1)
        spring_signal_logger.info(f"OUT MQTT-Spring topic={topic} payload={json.dumps(payload, ensure_ascii=False)}")
        print(f"[Pi] Edge 요청 발행: {operation_id} -> {topic}")

        got = waiter.wait(timeout=timeout_seconds)
        with self.lock:
            self.pending.pop(operation_id, None)
            response = self.responses.pop(operation_id, None)

        if not got or response is None:
            print(f"[Pi] Edge 응답 타임아웃: {operation_id}")
            return None
        print(f"[Pi] Edge 응답 수신: {operation_id} -> {response}")
        return response
