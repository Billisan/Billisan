"""업무 체인 - 얼굴 인증과 대여/반납 전체 흐름. 하드웨어와 Spring을 오케스트레이션한다."""
import time
import uuid

from .config import INSPECT_RESULT_HOLD_SECONDS, KIOSK_MASK_USER_INFO
from .hardware import execute_lock_operation
from .runtime import _update_inventory_cache
from .utils import _iso, _edge_error_code, _fix_mojibake, _mask_name, _mask_student_id
from .orin_client import PI_DEVICE_ID, PI_BOOT_ID


_GUIDANCE_MESSAGES = {
    "CENTER_FACE": "얼굴을 가이드 안으로 맞춰주세요",
    "NONE": "카메라를 바라봐 주세요",
    "SHOW_UMBRELLA": "우산을 카메라에 잘 보이게 들어주세요",
}


def _make_progress(on_progress):
    def progress(stage, message):
        print(f"[Pi] ({stage}) {message}")
        if on_progress:
            on_progress(stage, message)
    return progress


def _make_guidance_relay(progress, on_guidance=None):
    """같은 guidanceCode 연속 수신은 1회만 통과시키는 릴레이 생성기."""
    last = {"code": object()}

    def relay(cmd_id, guidance_code):
        if last["code"] == guidance_code:
            return
        last["code"] = guidance_code
        if on_guidance:
            on_guidance(guidance_code)
        progress("GUIDANCE", _GUIDANCE_MESSAGES.get(guidance_code, guidance_code or ""))
    return relay


def perform_face_auth(orin_client, session_id, on_progress=None, on_guidance=None,
                       auth_request_id=None):
    """
    [v3.0 KSK-AUTH-001] 얼굴 인증 단계만 수행. 반환 (auth_result, user_ref|None).
    on_guidance(code): v3.0 Event 릴레이 훅. userRef는 Kiosk로 절대 내보내지 말 것.
    """
    progress = _make_progress(on_progress)
    progress("AUTH_STARTED", "얼굴 인증 중...")
    orin_client.progress_callback = _make_guidance_relay(progress, on_guidance)
    orin_payload = {
        "authRequestId": auth_request_id or str(uuid.uuid4()),
        "sessionId": session_id,
        "operation": "AUTHENTICATE",
    }
    try:
        orin_result = orin_client.send_command("AUTHENTICATE_FACE", request_id=str(uuid.uuid4()),
                                                payload=orin_payload, timeout_seconds=15.0)
    finally:
        orin_client.progress_callback = None
    auth_result = orin_result.get("result") or {}
    return auth_result, auth_result.get("userRef")


def perform_rent_or_return(orin_client, edge_client, station_id, session_id, flow_type,
                            user_ref, extra_ids=None, on_progress=None, on_guidance=None,
                            context=None):
    """
    [v3.0 KSK-RENT-001 / KSK-RETURN-001] 인증 이후 체인.
    RENT:   EDGE-RENT-001 -> 물리 -> EDGE-DEVICE-001
    RETURN: EDGE-RETURN-001 -> 검수 -> EDGE-INSPECT-001 -> EDGE-RETURN-003 -> 물리 -> EDGE-DEVICE-001
    반환: (final_status, final_result, context). context에는 rentalId/returnAttemptId/
    slotNumber/inspectionResult 등 진행 중 확보한 값이 채워진다 (Event 발행용).
    """
    extra_ids = extra_ids or {}
    context = context if context is not None else {}
    progress = _make_progress(on_progress)
    _relay_guidance = _make_guidance_relay(progress, on_guidance)

    return_attempt_id = None
    rental_id_from_create = None

    if flow_type == "RETURN":
        # [v3.0 계약 순서] EDGE-RETURN-001(반납 시도 생성) -> 검수 -> EDGE-INSPECT-001
        # -> EDGE-RETURN-003(검수 후 SLOT 원자 선정) -> 물리 -> EDGE-DEVICE-001.
        # returnAttemptId는 이제 Pi가 만들지 않고 스프링이 발급한다 (RETURN-001 응답).
        progress("RETURN_REQUESTED", "반납 시도 생성 중...")
        create_payload = {
            "requestId": extra_ids.get("returnRequestId", str(uuid.uuid4())),  # 반납 도메인 멱등 키
            "sessionId": session_id,
            "stationId": station_id,
            "userRef": user_ref,
        }
        create_response = edge_client.send_request("EDGE-RETURN-001", create_payload, timeout_seconds=30.0)
        if create_response is None:
            progress("SLOT_TIMEOUT", "반납 시도 생성 응답 없음")
            return "FAILED", {"resultCode": "EDGE_REQUEST_TIMEOUT", "operationId": "EDGE-RETURN-001"}, context
        err_code = _edge_error_code(create_response)
        if err_code:
            progress("FAILED", f"반납 시도 생성 실패: {err_code}")
            return "FAILED", {"resultCode": err_code, "operationId": "EDGE-RETURN-001",
                               "message": create_response.get("message")}, context
        return_attempt_id = create_response.get("returnAttemptId")
        rental_id_from_create = create_response.get("rentalId")
        context["returnAttemptId"] = return_attempt_id
        context["rentalId"] = rental_id_from_create

        # 파손 검증 - 서보 개방 전 수행 (사용자가 우산을 들고 카메라에 보여주는 배치).
        # 검증 완료가 SLOT 선정의 선행 조건일 뿐, 검증 *결과*는 물리 반납을 막지 않는다
        # (v3.0: "DAMAGED|UNCERTAIN|FAILED여도 안전하면 물리 반납을 계속하고 ADMIN_REVIEW로 격리").
        progress("INSPECTION_STARTED", "우산을 카메라에 보여주세요 - 파손 검증 중...")
        orin_client.progress_callback = _relay_guidance
        try:
            inspect_orin_result = orin_client.send_command(
                "INSPECT_UMBRELLA", request_id=str(uuid.uuid4()),
                payload={"sessionId": session_id, "returnAttemptId": return_attempt_id},
                # Orin 최악 경로: 세션 15초 + DAMAGED 재확인 2초 + 결과 표시 홀드 2초 = 19초.
                # 여기에 여유를 둬 21초 (orin_client가 +2초 더 기다려 실제 23초).
                timeout_seconds=21.0,
            )
        finally:
            orin_client.progress_callback = None
        inspect_body = inspect_orin_result.get("result") or {}
        inspect_verdict = inspect_body.get("result", "FAILED")
        process_status = "FAILED" if inspect_verdict == "FAILED" else "COMPLETED"

        # context를 progress보다 먼저 채운다 - progress 콜백이 만드는 키오스크 이벤트가
        # ctx["inspectionResult"]를 읽으므로, 순서가 뒤바뀌면 결과가 null로 나간다.
        context["inspectionResult"] = inspect_verdict
        progress("INSPECTION_DONE", f"파손 검증 결과: {inspect_verdict}")

        # 결과를 키오스크에 알린 뒤, 사용자가 확인할 시간을 주고 다음 단계로 진행
        if INSPECT_RESULT_HOLD_SECONDS > 0:
            time.sleep(INSPECT_RESULT_HOLD_SECONDS)

        inspection_request_payload = {
            "returnAttemptId": return_attempt_id,
            "inspectionRequestId": str(uuid.uuid4()),
            "processStatus": process_status,
            "result": inspect_verdict,
            "confidence": inspect_body.get("confidence"),
            "modelVersion": inspect_body.get("modelVersion"),
            "errorCode": None if process_status == "COMPLETED" else "INSPECTION_PROCESS_FAILED",
            "inferenceNode": "JETSON_ORIN",
        }
        inspection_response = edge_client.send_request(
            "EDGE-INSPECT-001", inspection_request_payload, timeout_seconds=20.0,
        )
        if inspection_response is None:
            print("[Pi] EDGE-INSPECT-001 응답 타임아웃 - 검수 결과는 유실됐지만 반납 흐름은 계속 진행")
        else:
            print(f"[Pi] EDGE-INSPECT-001 응답: reviewRequired={inspection_response.get('reviewRequired')}, "
                  f"slotServiceStatus={inspection_response.get('slotServiceStatus')}")

        # 검수 저장 뒤 SLOT 원자 선정 (v3.0: "Inspection 결과 저장 뒤 EDGE-RETURN-003에서 SLOT을 원자 선정한다")
        operation_id = "EDGE-RETURN-003"
        edge_request_payload = {"returnAttemptId": return_attempt_id, "stationId": station_id}
    else:
        operation_id = "EDGE-RENT-001"
        edge_request_payload = {
            "rentalRequestId": extra_ids.get("rentalRequestId", str(uuid.uuid4())),
            "sessionId": session_id,
            "stationId": station_id,
            "userRef": user_ref,  # 불투명 가명키 - 학번(user_id) 전송 금지 (12-I)
        }

    progress("SLOT_REQUESTED", "스프링에 슬롯 요청 중...")
    edge_response = edge_client.send_request(operation_id, edge_request_payload, timeout_seconds=30.0)

    if edge_response is None:
        progress("SLOT_TIMEOUT", "슬롯 요청 응답 없음")
        return "FAILED", {"resultCode": "EDGE_REQUEST_TIMEOUT", "operationId": operation_id}, context

    err_code = _edge_error_code(edge_response)
    if err_code:
        # 예: USER_NOT_FOUND - 슬롯도 물리 명령도 존재하지 않으니 서보를 절대 건드리면 안 된다.
        progress("FAILED", f"슬롯 요청 실패: {err_code}")
        return "FAILED", {"resultCode": err_code, "operationId": operation_id,
                           "message": edge_response.get("message")}, context

    slot_id = edge_response.get("checkoutSlotId") or edge_response.get("returnSlotId")
    device_op = edge_response.get("deviceOperation") or {}
    physical_command_id = device_op.get("commandId", str(uuid.uuid4()))
    operation_type = device_op.get("operationType", "UNLOCK")
    context["slotId"] = slot_id
    context["slotNumber"] = edge_response.get("slotNumber")
    if flow_type == "RETURN":
        context["returnSlotId"] = slot_id
    else:
        context["rentalId"] = edge_response.get("rentalId")
        context["checkoutSlotId"] = slot_id
        # [계약 확장] 스프링이 응답에 담아주는 사용자 표시 정보 -> 키오스크 대여 완료 화면용.
        # (v3.0 원문에는 없던 필드 - 팀 결정으로 추가됨. name 한글 모지바케는 여기서 복구)
        user_name = _fix_mojibake(edge_response.get("name"))
        student_id = edge_response.get("userId")
        if KIOSK_MASK_USER_INFO:
            user_name = _mask_name(user_name)
            student_id = _mask_student_id(student_id)
        # RENT-001 응답에 이름이 있으면 최신값 사용, 없으면 EDGE-AUTH-001 때 받아둔 값 유지
        context["userName"] = user_name or context.get("userName")
        context["studentId"] = student_id or context.get("studentId")

    progress("SLOT_ASSIGNED", f"슬롯 배정됨 (slotId={slot_id}) - 잠금 해제 중...")

    # 업무 방향을 명시: 대여는 우산을 꺼내는 것(REMOVE), 반납은 꽂는 것(INSERT)
    expected_transition = "INSERT" if flow_type == "RETURN" else "REMOVE"
    terminal_status, result_code, evidence = execute_lock_operation(
        operation_type, slot_id, physical_command_id, expected_transition=expected_transition)

    progress("PHYSICAL_DONE" if terminal_status == "SUCCEEDED" else "PHYSICAL_FAILED",
              f"물리 동작 완료 (resultCode={result_code})" if terminal_status == "SUCCEEDED"
              else f"물리 동작 미완료 (resultCode={result_code})")

    progress("COMMIT_REQUESTED", "스프링에 완료 커밋 요청 중...")
    device_request_payload = {
        "eventId": str(uuid.uuid4()),
        "commandId": physical_command_id,
        "stationId": station_id,
        "targetDeviceId": PI_DEVICE_ID,
        "piBootId": PI_BOOT_ID,
        "orinBootId": None,
        "slotId": slot_id,
        "rentalId": edge_response.get("rentalId") if flow_type != "RETURN" else rental_id_from_create,
        "returnAttemptId": return_attempt_id,
        "operationType": operation_type,
        "eventType": "OPERATION_COMPLETED" if terminal_status == "SUCCEEDED" else "OPERATION_FAILED",
        "resultCode": result_code,
        "occurredAt": _iso(),
        "evidence": evidence,
    }
    device_response = edge_client.send_request("EDGE-DEVICE-001", device_request_payload, timeout_seconds=30.0)

    if device_response is None:
        progress("COMMIT_TIMEOUT", "커밋 응답 없음")
        return "FAILED", {"resultCode": "EDGE_DEVICE_TIMEOUT", "evidence": evidence}, context

    commit_err = _edge_error_code(device_response)  # 예: INTERNAL_ERROR - 물리 성공/서버 커밋 실패
    reconciliation = device_response.get("reconciliationStatus")
    context["domainStatus"] = device_response.get("domainStatus")
    context["reconciliationStatus"] = reconciliation
    # [계약 확장] 커밋 응답에 실려오는 대여소 재고(우산 보유 슬롯 수 등)를 캐시하고
    # 키오스크 완료 화면으로 중계한다. 스프링이 안 내려주면 None -> 프론트는 null 방어.
    context["inventory"] = _update_inventory_cache(device_response.get("inventory"))
    if terminal_status == "SUCCEEDED" and reconciliation == "CONSISTENT":
        progress("COMMIT_SUCCEEDED", "커밋 완료")
        # (보류) 반납 후 건조 기능: 커밋 성공 시점이 트리거 지점.
        # 구현 시 여기서 return_motor.run_after_return() 호출 (flow_type == "RETURN" 조건으로).
        final_result = {"resultCode": result_code, "slotId": slot_id,
                         "domainStatus": device_response.get("domainStatus"), "evidence": evidence}
        return "SUCCEEDED", final_result, context
    else:
        # 문서 원칙: 물리 성공·DB 실패, 증거 불충분 등은 RECOVERY_REQUIRED로 처리한다.
        progress("RECOVERY_REQUIRED", "커밋 실패 - 관리자 확인 필요"
                 + (f" (서버 에러: {commit_err})" if commit_err else ""))
        final_result = {"resultCode": "RECOVERY_REQUIRED", "slotId": slot_id,
                         "serverError": commit_err,
                         "domainStatus": device_response.get("domainStatus"), "evidence": evidence}
        return "FAILED", final_result, context
