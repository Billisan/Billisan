#!/usr/bin/env python3
"""
Billisan Pi 서비스 진입점.

역할별 구현은 billisan/ 패키지에 있고, 이 파일은 각 계층을 조립해 기동만 한다.
  - Kiosk -> Pi   : WebSocket (billisan/kiosk_ws.py)
  - Pi -> Spring  : MQTT Edge 요청/응답 (billisan/edge_client.py)
  - Spring -> Pi  : MQTT 명령 (billisan/spring_mqtt.py)
  - Pi <-> Orin   : ZeroMQ (billisan/orin_client.py)
  - 물리 제어     : 서보/홀센서 (billisan/hardware.py)

주의:
- mTLS 아직 미적용 - EC2 80(->1883 리다이렉트) 평문/익명으로 테스트 중.
"""
import json
import threading
import time

import paho.mqtt.client as mqtt
import RPi.GPIO as GPIO

from billisan.config import (
    BROKER_HOST, BROKER_PORT, COMMAND_SUB_TOPIC, EDGE_RESPONSE_SUB_TOPIC,
    EDGE_RESPONSE_TOPIC_PREFIX, HEALTH_PUB_TOPIC_TMPL, KIOSK_API_PORT,
    spring_signal_logger,
)
from billisan.edge_client import EdgeClient
from billisan.hardware import close_servo
from billisan.kiosk_ws import flask_app
from billisan.runtime import _runtime
from billisan.utils import _iso
from billisan.spring_mqtt import handle_spring_command
from billisan.orin_client import OrinClient, STATION_ID, PI_DEVICE_ID, PI_BOOT_ID, SCHEMA_VERSION


def main():
    # 문서 A-8.0: 기본·부팅 상태는 LOCKED.
    # Orin/브로커 연결보다 먼저 잠근다 - 이 둘이 늦거나 실패해도 슬롯은 잠겨 있어야 하므로.
    close_servo(reason="부팅 초기화")

    print(f"[Pi] Orin(ZeroMQ) 클라이언트 초기화... (piBootId={PI_BOOT_ID})")
    orin_client = OrinClient()

    print("[Pi] ORIN_READY 대기 중...")
    while not orin_client.orin_ready:
        time.sleep(0.5)
    print("[Pi] Orin 준비 완료")
    print(f"\n{'='*50}")
    print("  이 파이의 piBootId (스프링 테스트 도구에 넣을 targetBootId):")
    print(f"  {PI_BOOT_ID}")
    print(f"{'='*50}\n")

    edge_client_holder = {}  # on_message가 참조할 수 있도록 나중에 채움 (mqtt_client 필요)

    def on_connect(client, userdata, flags, rc, properties=None):
        if rc == 0:
            print(f"[Pi] 스프링 브로커 연결됨 ({BROKER_HOST}:{BROKER_PORT})")
            client.subscribe(COMMAND_SUB_TOPIC, qos=1)
            client.subscribe(EDGE_RESPONSE_SUB_TOPIC, qos=1)
            print(f"[Pi] 명령 토픽 구독: {COMMAND_SUB_TOPIC}")
            print(f"[Pi] Edge 응답 토픽 구독: {EDGE_RESPONSE_SUB_TOPIC}")

            # piBootId를 pi/health에 retain으로 발행 - 나중에 붙는 클라이언트(테스트 도구 등)가
            # 매번 콘솔에서 값을 복사하지 않고 이 토픽만 구독해서 최신 piBootId를 바로 받아가게 한다.
            # (연결이 실제로 완료된 뒤에만 발행해야 하므로 on_connect 안에서 처리)
            health_payload = {
                "schemaVersion": SCHEMA_VERSION,
                "stationId": STATION_ID,
                "deviceId": PI_DEVICE_ID,
                "piBootId": PI_BOOT_ID,
                "status": "ONLINE",
                "occurredAt": _iso(),
            }
            health_topic = HEALTH_PUB_TOPIC_TMPL.format(station_id=STATION_ID)
            client.publish(health_topic, json.dumps(health_payload), qos=1, retain=True)
            spring_signal_logger.info(f"OUT MQTT-Spring topic={health_topic} payload={json.dumps(health_payload, ensure_ascii=False)}")
            print(f"[Pi] piBootId를 pi/health에 발행함 (retain): {health_topic}")
        else:
            print(f"[Pi] 브로커 연결 실패 (code={rc})")

    def on_message(client, userdata, msg):
        spring_signal_logger.info(f"IN  MQTT-Spring topic={msg.topic} payload={msg.payload.decode('utf-8', errors='replace')}")

        if msg.topic.startswith(EDGE_RESPONSE_TOPIC_PREFIX):
            operation_id = msg.topic.rsplit("/", 1)[-1]
            try:
                payload = json.loads(msg.payload.decode("utf-8"))
            except json.JSONDecodeError:
                print(f"[Pi] Edge 응답 JSON 파싱 실패: {msg.payload[:80]}")
                return
            edge_client_holder["client"].handle_response_message(operation_id, payload)
            return

        try:
            command = json.loads(msg.payload.decode("utf-8"))
        except json.JSONDecodeError:
            print(f"[Pi] 잘못된 명령 무시: {msg.payload[:80]}")
            return
        # 각 명령을 별도 스레드로 처리 (send_command가 최대 17초까지 블로킹하므로,
        # 그 사이 다른 명령의 MQTT 수신이 막히지 않게 함)
        threading.Thread(
            target=handle_spring_command,
            args=(orin_client, client, command),
            daemon=True,
        ).start()

    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"{PI_DEVICE_ID}-command-bridge")
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    mqtt_client.connect(BROKER_HOST, BROKER_PORT, keepalive=30)
    mqtt_client.loop_start()  # 백그라운드 스레드 - Flask가 메인 스레드를 쓸 수 있게

    edge_client_holder["client"] = EdgeClient(mqtt_client)

    # Flask 라우트(/api/v1/kiosk/rent 등)가 참조할 수 있게 전역 홀더 채우기
    _runtime["orin_client"] = orin_client
    _runtime["edge_client"] = edge_client_holder["client"]

    # 터치센서는 이제 상시 감시하지 않고, UNLOCK 처리 흐름(wait_for_occupancy_change) 안에서만
    # 확인한다. 하나의 센서를 여러 곳이 동시에 해석하면 충돌하므로 이렇게 일원화했다.

    print(f"[Pi] Kiosk REST API 시작: http://<파이IP>:{KIOSK_API_PORT}/api/v1/kiosk/rent (또는 /return)")
    print("[Pi] 명령 브리지 + Kiosk API 대기 중... (Ctrl+C 종료)")
    flask_app.run(host="0.0.0.0", port=KIOSK_API_PORT, threaded=True)


if __name__ == "__main__":
    try:
        main()
    finally:
        GPIO.cleanup()
