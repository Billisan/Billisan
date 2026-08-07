"""Kiosk Operation 핸들러 7종 (12-I v3.0). 각 함수가 하나의 업무 Operation을 처리한다.

임포트되는 순간 @_kiosk_op 데코레이터로 프로토콜 계층에 자동 등록된다."""
from .config import KIOSK_MASK_USER_INFO
from .flows import perform_face_auth, perform_rent_or_return
from .hardware import touch_debounced
from .kiosk_protocol import _kiosk_op, _get_session
from .runtime import _runtime, _get_inventory_cache, _flow_lock
from .session import _create_session, _find_session_by_key, _sessions, _sessions_lock
from .utils import _iso_ts, _edge_error_code, _fix_mojibake, _mask_name, _mask_student_id
from .orin_client import STATION_ID


# ---- KSK-STATION-001: 대여소 상태 조회 ----
@_kiosk_op("KIOSK.STATION_SUMMARY")
def _op_station(conn, base, sid, rid, cid, payload):
    conn.ack(base, sid, rid, cid)
    if payload.get("stationId") not in (None, STATION_ID):
        conn.error(sid, rid, cid, "STATION_MISMATCH", "다른 대여소 ID")
        return
    occupied = touch_debounced()
    orin_client = _runtime["orin_client"]
    orin_ok = orin_client is not None and orin_client.orin_connected()

    # 재고 출처 우선순위: 스프링 권위값(EDGE-DEVICE-001 응답 캐시) > 로컬 센서 추정
    # 12-I: Pi는 업무 수치를 임의 생성하지 않는다 -> 스프링 값이 있으면 그걸 그대로 중계하고
    # stale=false. 없으면 기존처럼 로컬 센서 관측을 stale=true로 정직하게 표시한다.
    cached_inv, cached_at = _get_inventory_cache()
    if cached_inv is not None:
        inventory = cached_inv
        observed_at = cached_at
        stale = False
        rentable = (inventory.get("rentableSlotCount") or 0) > 0
        returnable = (inventory.get("emptyReturnSlotCount") or 0) > 0
    else:
        inventory = {"rentableSlotCount": 1 if occupied else 0,
                     "emptyReturnSlotCount": 0 if occupied else 1}
        observed_at = _iso_ts()
        stale = True  # Spring Summary 미연동 상태임을 정직하게 표시
        rentable = occupied
        returnable = not occupied

    blocking = ([] if orin_ok else ["DEVICE_OFFLINE"]) \
               + ([] if rentable else ["NO_RENTAL_SLOT"]) \
               + ([] if returnable else ["NO_RETURN_SLOT"])
    conn.send(f"{base}.RESULT", sid, rid, cid, {
        "stationId": STATION_ID,
        "observedAt": observed_at,
        "stale": stale,
        "operating": {"status": "OPEN" if orin_ok else "UNAVAILABLE", "opensAt": None, "closesAt": None},
        "inventory": inventory,
        "availability": {"rentAvailable": rentable and orin_ok,
                          "returnAvailable": returnable and orin_ok,
                          "blockingReasons": blocking},
    })


# ---- KSK-SESSION-001: 세션 열기 ----
@_kiosk_op("KIOSK.SESSION.OPEN")
def _op_session_open(conn, base, sid, rid, cid, payload):
    conn.ack(base, None, rid, cid)
    mode = payload.get("mode")
    station_id = payload.get("stationId")
    client_key = payload.get("clientSessionKey")
    if mode not in ("RENT", "RETURN") or not client_key:
        conn.error(None, rid, cid, "SESSION_CONFLICT", "mode/clientSessionKey 누락")
        return
    if station_id not in (None, STATION_ID):
        conn.error(None, rid, cid, "STATION_MISMATCH", "다른 대여소 ID")
        return

    # 복구: lastKnownSessionId가 살아 있으면 그대로 반환 (12-I: 명령 재실행 금지)
    last_known = payload.get("lastKnownSessionId")
    if last_known:
        with _sessions_lock:
            existing = _sessions.get(last_known)
        if existing is not None:
            conn.send(f"{base}.RESULT", existing["sessionId"], rid, cid, {
                "sessionId": existing["sessionId"], "mode": existing["mode"],
                "status": existing["status"], "expiresAt": _iso_ts(existing["expiresAt"]),
            })
            return

    # 같은 (clientSessionKey, mode, stationId) 활성 세션 재사용 (12-I 멱등성)
    sess = _find_session_by_key(client_key, mode, STATION_ID)
    if sess is None:
        sess = _create_session(mode, STATION_ID, client_key)
        print(f"[Pi][Kiosk-WS] 세션 생성: {sess['sessionId']} (mode={mode})")
    conn.send(f"{base}.RESULT", sess["sessionId"], rid, cid, {
        "sessionId": sess["sessionId"], "mode": sess["mode"],
        "status": sess["status"], "expiresAt": _iso_ts(sess["expiresAt"]),
    })


# ---- KSK-AUTH-001: 얼굴 인증 ----
@_kiosk_op("KIOSK.FACE_AUTH")
def _op_auth(conn, base, sid, rid, cid, payload):
    sess = _get_session(conn, base, sid, rid, cid, require_active=False)
    if sess is None:
        return
    auth_request_id = payload.get("authRequestId") or rid

    # 멱등성: 같은 authRequestId 재전송은 세션이 종료됐어도 기존 Terminal 반환
    # (12-I: "ACK/Result 유실은 같은 ID로 재전송 - 기존 진행·Terminal을 반환")
    cached = sess["terminals"].get(auth_request_id)
    if cached is not None:
        conn.ack(base, sid, rid, cid)
        conn.send(f"{base}.RESULT", sid, rid, cid, cached)
        return
    if sess["status"] != "ACTIVE":
        conn.ack(base, sid, rid, cid, error_code="SESSION_EXPIRED")
        conn.error(sid, rid, cid, "SESSION_EXPIRED", f"세션 상태={sess['status']}")
        return

    orin_client = _runtime["orin_client"]
    if orin_client is None or not orin_client.orin_connected():
        conn.ack(base, sid, rid, cid, error_code="ORIN_WEBSOCKET_UNAVAILABLE")
        conn.error(sid, rid, cid, "ORIN_WEBSOCKET_UNAVAILABLE", "AI 노드(Orin) 오프라인")
        return
    if not _flow_lock.acquire(blocking=False):
        conn.ack(base, sid, rid, cid, error_code="CAMERA_CAPTURE_IN_PROGRESS")
        conn.error(sid, rid, cid, "CAMERA_CAPTURE_IN_PROGRESS", "다른 작업 진행 중")
        return

    conn.ack(base, sid, rid, cid)
    sess["phase"] = "AUTH_CAPTURE"
    sess["kioskStep"] = "AUTH_PROCESSING"
    try:
        def on_guidance(code):
            sess["faceGuidance"] = code
            conn.send(f"{base}.EVENT", sid, rid, cid, {
                "sessionId": sid, "authRequestId": auth_request_id,
                "status": "GUIDANCE", "guidanceCode": code,
                "progressMode": "INDETERMINATE",
            })

        conn.send(f"{base}.EVENT", sid, rid, cid, {
            "sessionId": sid, "authRequestId": auth_request_id,
            "status": "AUTH_PROCESSING", "guidanceCode": None,
            "progressMode": "INDETERMINATE",
        })
        auth_result, user_ref = perform_face_auth(
            orin_client, sid, on_guidance=on_guidance, auth_request_id=auth_request_id)
    finally:
        sess["phase"] = "IDLE"
        _flow_lock.release()

    authenticated = auth_result.get("status") == "MATCHED"
    sess["authenticated"] = authenticated
    sess["userRef"] = user_ref if authenticated else None

    # [EDGE-AUTH-001 부활 - 팀 결정] 인증 성공 시 스프링에 사용자 정보/자격 조회.
    # 목적: FACE_AUTH.RESULT에 이름/학번을 실어 "OOO님 환영합니다" 화면 지원.
    # fail-open 설계: 스프링 미구현/타임아웃이면 이름 없이(null) 인증은 그대로 성공 처리
    # -> 백엔드 배포 전에도 데모가 죽지 않는다.
    user_name, student_id = None, None
    eligible, blocking_reasons = authenticated, []
    if authenticated:
        edge_client = _runtime["edge_client"]
        auth_lookup = edge_client.send_request("EDGE-AUTH-001", {
            "authRequestId": auth_request_id,   # 멱등 키 (재전송 시 동일)
            "sessionId": sid,
            "stationId": STATION_ID,
            "userRef": user_ref,
        }, timeout_seconds=5.0)
        if auth_lookup is None:
            print("[Pi] EDGE-AUTH-001 응답 없음(미구현/타임아웃) - 이름 없이 인증 진행")
        else:
            lookup_err = _edge_error_code(auth_lookup)
            if lookup_err:
                # 예: USER_NOT_FOUND - 얼굴은 맞았지만 서비스 이용 자격이 없음
                print(f"[Pi] EDGE-AUTH-001 자격 거절: {lookup_err}")
                eligible = False
                blocking_reasons = [lookup_err]
            else:
                user_name = _fix_mojibake(auth_lookup.get("name"))
                student_id = auth_lookup.get("userId")
                if KIOSK_MASK_USER_INFO:
                    user_name = _mask_name(user_name)
                    student_id = _mask_student_id(student_id)
                sess["context"]["userName"] = user_name
                sess["context"]["studentId"] = student_id

    sess["kioskStep"] = ("RENT_READY" if sess["mode"] == "RENT" else "RETURN_READY") \
        if (authenticated and eligible) else "FACE_GUIDE"

    # eligibility: EDGE-AUTH-001이 팀 결정으로 "필요X"라 Spring 자격 재검증 없이
    # Orin 매칭 결과만 반영한다 (자격 정책이 생기면 여기서 확장).
    result_payload = {
        "sessionId": sid,
        "authRequestId": auth_request_id,
        "authenticated": authenticated,
        "eligibility": {"eligible": eligible, "blockingReasons": blocking_reasons},
        "kioskStep": sess["kioskStep"],
        "userMessageCode": (auth_result.get("status", "ERROR")
                             if authenticated or not blocking_reasons else blocking_reasons[0]),
        "retryable": not authenticated,
        # [EDGE-AUTH-001] 환영 화면용 - 스프링 미구현/조회실패면 null (프론트 null 방어 필수)
        "userName": user_name,
        "studentId": student_id,
    }
    sess["terminals"][auth_request_id] = result_payload
    conn.send(f"{base}.RESULT", sid, rid, cid, result_payload)


def _run_operation_flow(conn, base, sid, rid, cid, sess, flow_type, stage_mapper, extra_ids):
    """RENT/RETURN 공통: 체인 실행 + stage->v3.0 Event 매핑 + Result 캐시."""
    orin_client = _runtime["orin_client"]
    edge_client = _runtime["edge_client"]
    if orin_client is None or not orin_client.orin_connected():
        conn.ack(base, sid, rid, cid, error_code="ORIN_WEBSOCKET_UNAVAILABLE")
        conn.error(sid, rid, cid, "ORIN_WEBSOCKET_UNAVAILABLE", "AI 노드(Orin) 오프라인")
        return None
    if not _flow_lock.acquire(blocking=False):
        conn.ack(base, sid, rid, cid, error_code="PHYSICAL_OPERATION_IN_PROGRESS")
        conn.error(sid, rid, cid, "PHYSICAL_OPERATION_IN_PROGRESS", "다른 작업 진행 중")
        return None
    conn.ack(base, sid, rid, cid)
    sess["phase"] = "PHYSICAL"
    context = sess["context"]
    try:
        def on_progress(stage, message):
            for event_payload in stage_mapper(stage, message, context):
                conn.send(f"{base}.EVENT", sid, rid, cid, event_payload)

        def on_guidance(code):
            for event_payload in stage_mapper("GUIDANCE_CODE", code, context):
                conn.send(f"{base}.EVENT", sid, rid, cid, event_payload)

        final_status, final_result, context = perform_rent_or_return(
            orin_client, edge_client, STATION_ID, sid, flow_type,
            sess["userRef"], extra_ids=extra_ids,
            on_progress=on_progress, on_guidance=on_guidance, context=context)
    finally:
        sess["phase"] = "IDLE"
        _flow_lock.release()
    return final_status, final_result, context


# ---- KSK-RENT-001: 우산 대여 ----
@_kiosk_op("KIOSK.RENT")
def _op_rent(conn, base, sid, rid, cid, payload):
    sess = _get_session(conn, base, sid, rid, cid, require_active=False)
    if sess is None:
        return
    rental_request_id = payload.get("rentalRequestId") or rid
    # 멱등성 우선: 종료된 세션이어도 같은 rentalRequestId 재전송은 기존 Result 반환
    cached = sess["terminals"].get(rental_request_id)
    if cached is not None:
        conn.ack(base, sid, rid, cid)
        conn.send(f"{base}.RESULT", sid, rid, cid, cached)
        return
    if sess["status"] != "ACTIVE":
        conn.ack(base, sid, rid, cid, error_code="SESSION_EXPIRED")
        conn.error(sid, rid, cid, "SESSION_EXPIRED", f"세션 상태={sess['status']}")
        return
    if sess["mode"] != "RENT" or not sess["authenticated"]:
        conn.ack(base, sid, rid, cid, error_code="USER_NOT_ELIGIBLE")
        conn.error(sid, rid, cid, "USER_NOT_ELIGIBLE", "인증되지 않았거나 RENT 세션이 아님")
        return

    def mapper(stage, message, ctx):
        common = {"sessionId": sid, "rentalRequestId": rental_request_id,
                  "checkoutSlotId": ctx.get("checkoutSlotId"),
                  "slotNumber": ctx.get("slotNumber"), "userMessageCode": stage}
        if stage == "SLOT_ASSIGNED":
            return [dict(common, status="RENT_SLOT_READY", kioskStep="RENT_PROCESSING"),
                    dict(common, status="WAITING_PHYSICAL_REMOVAL", kioskStep="REMOVE_UMBRELLA")]
        return []

    outcome = _run_operation_flow(conn, base, sid, rid, cid, sess, "RENT", mapper,
                                   {"rentalRequestId": rental_request_id})
    if outcome is None:
        return
    final_status, final_result, ctx = outcome
    succeeded = final_status == "SUCCEEDED"
    sess["kioskStep"] = "COMPLETED" if succeeded else (
        "RECOVERY_REQUIRED" if (final_result or {}).get("resultCode") == "RECOVERY_REQUIRED" else "FAILED")
    if succeeded:
        sess["status"] = "COMPLETED"
    result_payload = {
        "sessionId": sid,
        "rentalRequestId": rental_request_id,
        "terminalStatus": final_status,
        "status": "RENT_COMPLETED" if succeeded else sess["kioskStep"],
        "rentalId": ctx.get("rentalId"),
        "checkoutSlotId": ctx.get("checkoutSlotId"),
        "slotNumber": ctx.get("slotNumber"),
        # rentedAt/dueAt은 Spring 확정값 - 현행 응답기/스프링이 안 주면 null 유지
        "rentalSummary": ({"rentalId": ctx.get("rentalId"),
                            "rentedAt": None, "dueAt": None} if succeeded else None),
        # [계약 확장] 완료 시점의 대여소 재고 (스프링 권위값. 미제공 시 null)
        "inventory": ctx.get("inventory"),
        # [계약 확장 - 팀 결정] 대여 완료 화면 표시용 사용자 정보 (스프링 RENT-001 응답 유래)
        "userName": ctx.get("userName"),
        "studentId": ctx.get("studentId"),
        "userMessageCode": (final_result or {}).get("resultCode"),
    }
    sess["terminals"][rental_request_id] = result_payload
    conn.send(f"{base}.RESULT", sid, rid, cid, result_payload)


# ---- KSK-RETURN-001: 우산 반납 ----
@_kiosk_op("KIOSK.RETURN")
def _op_return(conn, base, sid, rid, cid, payload):
    sess = _get_session(conn, base, sid, rid, cid, require_active=False)
    if sess is None:
        return
    # 12-I: 반납 멱등 키는 Envelope requestId 자체 (payload에 중복 저장 안 함)
    # 멱등성 우선: 종료된 세션이어도 같은 requestId 재전송은 기존 Result 반환
    cached = sess["terminals"].get(rid)
    if cached is not None:
        conn.ack(base, sid, rid, cid)
        conn.send(f"{base}.RESULT", sid, rid, cid, cached)
        return
    if sess["status"] != "ACTIVE":
        conn.ack(base, sid, rid, cid, error_code="SESSION_EXPIRED")
        conn.error(sid, rid, cid, "SESSION_EXPIRED", f"세션 상태={sess['status']}")
        return
    if sess["mode"] != "RETURN" or not sess["authenticated"]:
        conn.ack(base, sid, rid, cid, error_code="USER_NOT_ELIGIBLE")
        conn.error(sid, rid, cid, "USER_NOT_ELIGIBLE", "인증되지 않았거나 RETURN 세션이 아님")
        return

    def mapper(stage, message, ctx):
        common = {"sessionId": sid, "requestId": rid,
                  "returnAttemptId": ctx.get("returnAttemptId"),
                  "rentalId": ctx.get("rentalId"),
                  "returnSlotId": ctx.get("returnSlotId"),
                  "slotNumber": ctx.get("slotNumber"),
                  "inspectionResult": ctx.get("inspectionResult"),
                  "progressMode": "INDETERMINATE", "userMessageCode": stage}
        if stage == "INSPECTION_STARTED":
            return [dict(common, status="INSPECTION_GUIDE", kioskStep="INSPECTION_GUIDE")]
        if stage == "GUIDANCE_CODE" and message == "SHOW_UMBRELLA":
            return [dict(common, status="INSPECTION_GUIDE", kioskStep="INSPECTION_GUIDE",
                          userMessageCode="SHOW_UMBRELLA")]
        if stage == "INSPECTION_DONE":
            return [dict(common, status="INSPECTION_PROCESSING", kioskStep="INSPECTION_GUIDE")]
        if stage == "SLOT_ASSIGNED":
            return [dict(common, status="RETURN_SLOT_ASSIGNED", kioskStep="RETURN_SLOT_GUIDE"),
                    dict(common, status="WAITING_INSERTION", kioskStep="RETURN_SLOT_GUIDE")]
        if stage == "COMMIT_REQUESTED":
            return [dict(common, status="SPRING_COMMITTING", kioskStep="RETURN_SLOT_GUIDE")]
        return []

    outcome = _run_operation_flow(conn, base, sid, rid, cid, sess, "RETURN", mapper, {"returnRequestId": rid})
    if outcome is None:
        return
    final_status, final_result, ctx = outcome
    succeeded = final_status == "SUCCEEDED"
    review = ctx.get("inspectionResult") in ("DAMAGED", "UNCERTAIN", "FAILED")
    sess["inspectionResult"] = ctx.get("inspectionResult")
    sess["kioskStep"] = ("COMPLETED" if not review else "COMPLETED") if succeeded else (
        "RECOVERY_REQUIRED" if (final_result or {}).get("resultCode") == "RECOVERY_REQUIRED" else "FAILED")
    if succeeded:
        sess["status"] = "COMPLETED"
    result_payload = {
        "sessionId": sid,
        "requestId": rid,
        "returnAttemptId": ctx.get("returnAttemptId"),
        "rentalId": ctx.get("rentalId"),
        "returnSlotId": ctx.get("returnSlotId"),
        "slotNumber": ctx.get("slotNumber"),
        "terminalStatus": final_status,
        "status": ("RETURN_COMPLETED" if not review else "ADMIN_REVIEW") if succeeded else sess["kioskStep"],
        "inspectionResult": ctx.get("inspectionResult"),
        # [계약 확장] 완료 시점의 대여소 재고 (스프링 권위값. 미제공 시 null)
        "inventory": ctx.get("inventory"),
        "userMessageCode": (final_result or {}).get("resultCode"),
    }
    sess["terminals"][rid] = result_payload
    conn.send(f"{base}.RESULT", sid, rid, cid, result_payload)


# ---- KSK-SESSION-002: 세션 상태 조회 ----
@_kiosk_op("KIOSK.SESSION.STATE")
def _op_session_state(conn, base, sid, rid, cid, payload):
    sess = _get_session(conn, base, sid, rid, cid, require_active=False)
    if sess is None:
        return
    conn.ack(base, sid, rid, cid)
    ctx = sess["context"]
    conn.send(f"{base}.RESULT", sid, rid, cid, {
        "sessionId": sid, "mode": sess["mode"], "status": sess["status"],
        "kioskStep": sess["kioskStep"], "faceGuidance": sess["faceGuidance"],
        "eligibility": {"eligible": sess["authenticated"], "blockingReasons": []},
        "checkoutSlot": ({"slotId": ctx.get("checkoutSlotId"), "slotNumber": ctx.get("slotNumber")}
                          if ctx.get("checkoutSlotId") else None),
        "returnSlot": ({"slotId": ctx.get("returnSlotId"), "slotNumber": ctx.get("slotNumber")}
                        if ctx.get("returnSlotId") else None),
        "rentalId": ctx.get("rentalId"),
        "returnAttemptId": ctx.get("returnAttemptId"),
        "returnAttemptStatus": ctx.get("domainStatus"),
        "inspectionResult": sess["inspectionResult"],
        "progressMode": "INDETERMINATE",
        "rentalSummary": None,
        "userMessageCode": None,
        "retryable": sess["status"] == "ACTIVE",
        "expiresAt": _iso_ts(sess["expiresAt"]),
    })


# ---- KSK-CANCEL-001: 세션 취소 ----
@_kiosk_op("KIOSK.SESSION.CANCEL")
def _op_cancel(conn, base, sid, rid, cid, payload):
    sess = _get_session(conn, base, sid, rid, cid, require_active=False)
    if sess is None:
        return
    if sess["status"] in ("COMPLETED", "FAILED", "CANCELLED"):
        conn.ack(base, sid, rid, cid, error_code="SESSION_ALREADY_TERMINAL")
        # 이미 취소된 세션은 기존 cancelledAt 반환 (멱등)
        if sess["status"] == "CANCELLED":
            conn.send(f"{base}.RESULT", sid, rid, cid, {
                "sessionId": sid, "terminalStatus": "CANCELLED",
                "status": "CANCELLED", "cancelledAt": sess.get("cancelledAt")})
        else:
            conn.error(sid, rid, cid, "SESSION_ALREADY_TERMINAL", f"상태={sess['status']}")
        return
    # 12-I 취소 허용 경계: Capture·물리 작업 시작 전까지만
    if sess["phase"] != "IDLE":
        conn.ack(base, sid, rid, cid, error_code="CANCEL_NOT_ALLOWED")
        code = "CAMERA_CAPTURE_IN_PROGRESS" if sess["phase"] == "AUTH_CAPTURE" else "PHYSICAL_OPERATION_IN_PROGRESS"
        conn.error(sid, rid, cid, code, "진행 중 작업은 중단하지 않음 - 복구 흐름을 따를 것")
        return
    conn.ack(base, sid, rid, cid)
    sess["status"] = "CANCELLED"
    sess["cancelledAt"] = _iso_ts()
    print(f"[Pi][Kiosk-WS] 세션 취소: {sid} (reason={payload.get('reasonCode')})")
    conn.send(f"{base}.RESULT", sid, rid, cid, {
        "sessionId": sid, "terminalStatus": "CANCELLED",
        "status": "CANCELLED", "cancelledAt": sess["cancelledAt"]})
