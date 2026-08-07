"""Spring이 미는 MQTT 명령 처리와 Terminal 이벤트 발행."""
import json
import uuid

import paho.mqtt.client as mqtt

from .config import EVENT_PUB_TOPIC_TMPL, spring_signal_logger
from .hardware import execute_lock_operation
from .runtime import processed_spring_commands
from .utils import _iso
from .orin_client import OrinClient, PI_DEVICE_ID, PI_BOOT_ID, SCHEMA_VERSION


def send_terminal_event(mqtt_client, command_id, request_id, station_id, terminal_status, result):
    """Terminal 이벤트를 만들어 스프링에 발행하고, 중복 재수신 대비 캐시에 저장한다."""
    event = {
        "schemaVersion": SCHEMA_VERSION,
        "messageId": str(uuid.uuid4()),
        "eventId": str(uuid.uuid4()),
        "commandId": command_id,
        "requestId": request_id,
        "stationId": station_id,
        "sourceDeviceId": PI_DEVICE_ID,
        "sourceBootId": PI_BOOT_ID,
        "eventType": "COMMAND_RESULT",
        "terminalStatus": terminal_status,
        "occurredAt": _iso(),
        "result": result,
    }
    processed_spring_commands[command_id] = event
    topic = EVENT_PUB_TOPIC_TMPL.format(station_id=station_id, event_type="COMMAND_RESULT")
    mqtt_client.publish(topic, json.dumps(event), qos=1)
    spring_signal_logger.info(f"OUT MQTT-Spring topic={topic} payload={json.dumps(event, ensure_ascii=False)}")
    print(f"[Pi][4/4] 스프링으로 결과 전송 완료: {topic}")


def handle_physical_command(mqtt_client, command_id, request_id, station_id, command_type, payload):
    """
    LOCK/UNLOCK - 스프링이 직접 미는 물리 명령 (관리자 수동 조작 등).
    Kiosk 주도 대여/반납 흐름도 같은 로직(execute_lock_operation)을 재사용한다.
    """
    slot_id = payload.get("slotId")
    operation_type = payload.get("operationType", command_type)

    print(f"[Pi][2/4] 물리 명령 처리: slotId={slot_id}, operationType={operation_type}")

    terminal_status, result_code, evidence = execute_lock_operation(operation_type, slot_id, command_id)

    result = {
        "slotId": slot_id,
        "operationType": operation_type,
        "resultCode": result_code,
        "evidence": evidence,
    }

    send_terminal_event(mqtt_client, command_id, request_id, station_id, terminal_status, result)


def handle_face_profile_sync(orin_client, mqtt_client, command_id, request_id, station_id, payload):
    """FACE_PROFILE_SYNC - operation(REGISTER/REREGISTER/DELETE)에 따라 Orin에 relay."""
    operation = payload.get("operation")
    orin_command_type = {
        "REGISTER": "REGISTER_FACE",
        "REREGISTER": "REREGISTER_FACE",
        "DELETE": "DELETE_FACE",
    }.get(operation)

    if orin_command_type is None:
        print(f"[Pi] 알 수 없는 operation 무시: {operation}")
        send_terminal_event(mqtt_client, command_id, request_id, station_id, "FAILED",
                             {"errorCode": "UNKNOWN_OPERATION"})
        return

    print(f"[Pi][2/4] 젯슨으로 전달 (ZeroMQ {orin_command_type})")
    orin_payload = {
        "userRef": payload.get("userRef"),
        "operation": operation,
        "templateVersion": payload.get("templateVersion"),
    }
    orin_result = orin_client.send_command(orin_command_type, request_id=request_id, payload=orin_payload, timeout_seconds=15.0)

    print(f"[Pi][3/4] 젯슨 결과 수신: terminalStatus={orin_result.get('terminalStatus')}, "
          f"result={orin_result.get('result')}")

    send_terminal_event(mqtt_client, command_id, request_id, station_id,
                         orin_result.get("terminalStatus", "FAILED"), orin_result.get("result"))


def handle_query_profile_state(orin_client, mqtt_client, command_id, request_id, station_id, payload):
    """QUERY_PROFILE_STATE - Orin에 그대로 relay."""
    print("[Pi][2/4] 젯슨으로 전달 (ZeroMQ QUERY_PROFILE_STATE)")
    orin_payload = {"userRef": payload.get("userRef")}
    orin_result = orin_client.send_command("QUERY_PROFILE_STATE", request_id=request_id, payload=orin_payload, timeout_seconds=10.0)

    print(f"[Pi][3/4] 젯슨 결과 수신: terminalStatus={orin_result.get('terminalStatus')}, "
          f"result={orin_result.get('result')}")

    send_terminal_event(mqtt_client, command_id, request_id, station_id,
                         orin_result.get("terminalStatus", "FAILED"), orin_result.get("result"))


def handle_spring_command(orin_client: OrinClient, mqtt_client: mqtt.Client, command: dict):
    command_id = command.get("commandId")
    command_type = command.get("commandType")
    request_id = command.get("requestId")
    station_id = command.get("stationId")
    target_boot_id = command.get("targetBootId")
    payload = command.get("payload") or {}

    print(f"[Pi][1/4] 스프링 명령 수신: commandType={command_type}, commandId={command_id}")

    if target_boot_id and target_boot_id != PI_BOOT_ID:
        print(f"[Pi] targetBootId 불일치(Stale) - 무시 (수신={target_boot_id}, 현재={PI_BOOT_ID})")
        return

    if command_id in processed_spring_commands:
        print(f"[Pi] 중복 commandId={command_id} - 재실행 없이 기존 결과 재전송")
        cached = processed_spring_commands[command_id]
        topic = EVENT_PUB_TOPIC_TMPL.format(station_id=station_id, event_type=cached["eventType"])
        mqtt_client.publish(topic, json.dumps(cached), qos=1)
        spring_signal_logger.info(f"OUT MQTT-Spring(재전송) topic={topic} payload={json.dumps(cached, ensure_ascii=False)}")
        return

    if command_type in ("LOCK", "UNLOCK"):
        handle_physical_command(mqtt_client, command_id, request_id, station_id, command_type, payload)
    elif command_type == "FACE_PROFILE_SYNC":
        handle_face_profile_sync(orin_client, mqtt_client, command_id, request_id, station_id, payload)
    elif command_type == "QUERY_PROFILE_STATE":
        handle_query_profile_state(orin_client, mqtt_client, command_id, request_id, station_id, payload)
    else:
        print(f"[Pi] 미지원 commandType 무시: {command_type}")
