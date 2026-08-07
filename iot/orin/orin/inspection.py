"""우산 파손 검증 세션 - OrinService에 믹스인으로 결합된다.

중요: 검증 결과는 서보 동작을 막지 않는다. 값만 Pi를 거쳐 스프링으로 전달되는
별도 채널이며, 물리 반납 흐름과 완전히 독립적이다.
"""
import sys
import time

import cv2

from .config import (
    DAMAGE_CHECK_DIR, DAMAGE_CHECK_MIRROR, INSPECT_SESSION_DEFAULT_SECONDS,
    GUIDANCE_INTERVAL,
)

# 검증기 모듈은 외부 경로(damage_check_v1)에 있어 sys.path 삽입 후 임포트해야 한다.
# 진입점(orin_service.py)이 검증기 인스턴스를 만들 때 쓰도록 여기서 재노출한다.
sys.path.insert(0, DAMAGE_CHECK_DIR)
from umbrella_inspector_onnx import UmbrellaInspectorOnnx, QualityConfig  # noqa: E402

__all__ = ["InspectionMixin", "UmbrellaInspectorOnnx", "QualityConfig"]


class InspectionMixin:
    """_run_inspect_session.

    결합 클래스가 제공해야 하는 것: self.inspector, self.camera,
    self.overlay_bbox / overlay_labels / overlay_lock, self.processed_commands, self.send_event."""

    def _run_inspect_session(self, command, command_id, request_id, station_id):
        """INSPECT_UMBRELLA 명령 하나를 처리하고 Terminal 이벤트를 반환한다."""
        if self.inspector is None:
            print("[Orin] INSPECT_UMBRELLA 수신 - 검증기 미로딩, 실행 불가")
            terminal_event = self.send_event(
                "COMMAND_RESULT", command_id, request_id, station_id, "FAILED",
                {"result": "FAILED", "reason": "INSPECTOR_NOT_LOADED"},
                command_type="INSPECT_UMBRELLA",
            )
        else:
            session_id = command.get("sessionId", "")
            return_id = command.get("returnAttemptId") or command.get("returnId")
            print(f"[Orin] INSPECT_UMBRELLA 수신 - 검증 세션 시작 (sessionId={session_id}, "
                  f"최대 {INSPECT_SESSION_DEFAULT_SECONDS:.0f}초)")

            def grab_frame():
                frame = self.camera.get_frame()
                if frame is None:
                    return None
                # 학습 데이터가 전부 좌우반전 상태 - 추론도 동일하게 반전해야 함 (README 명시)
                return cv2.flip(frame, 1) if DAMAGE_CHECK_MIRROR else frame

            # 인증 세션과 같은 패턴: 확신 판정(NORMAL/DAMAGED)이 나오면 즉시 종료,
            # UNCERTAIN/FAILED(우산 미검출 등)이면 만료 전까지 재시도하며
            # SHOW_UMBRELLA 가이던스를 보낸다. 만료 시 마지막 판정을 그대로 보고.
            expires_at_ts = time.time() + INSPECT_SESSION_DEFAULT_SECONDS
            last_guidance_sent = 0.0
            inspect_payload = {"result": "FAILED", "reason": "NO_FRAME"}

            while True:
                attempt = self.inspector.inspect(grab_frame, session_id, return_id)
                attempt.pop("_local", None)  # rawScore 등 로컬 전용 값은 스프링에 안 보냄
                inspect_payload = attempt
                verdict = inspect_payload.get("result", "FAILED")

                with self.overlay_lock:
                    self.overlay_bbox = None
                    self.overlay_labels = [f"INSPECT: {verdict}",
                                            f"conf={inspect_payload.get('confidence')}"]

                if verdict == "NORMAL":
                    break  # 정상 - 즉시 종료

                if verdict == "DAMAGED":
                    # 우산 펴는 과정의 순간 프레임 오탐 방지: 1초 간격으로 2회 재확인.
                    # 3장 연속 DAMAGED일 때만 파손 확정. 재확인 중 NORMAL이 나오면
                    # 정상 확정, UNCERTAIN 등이 나오면 확정 보류하고 세션 계속.
                    damaged_streak = True
                    for i in range(2):
                        time.sleep(1.0)
                        recheck = self.inspector.inspect(grab_frame, session_id, return_id)
                        recheck.pop("_local", None)
                        recheck_verdict = recheck.get("result", "FAILED")
                        inspect_payload = recheck
                        with self.overlay_lock:
                            self.overlay_bbox = None
                            self.overlay_labels = [f"INSPECT 재확인 {i + 1}/2: {recheck_verdict}",
                                                    f"conf={recheck.get('confidence')}"]
                        print(f"[Orin] DAMAGED 재확인 {i + 1}/2: {recheck_verdict}")
                        if recheck_verdict != "DAMAGED":
                            damaged_streak = False
                            break
                    if damaged_streak:
                        break  # 3연속 DAMAGED - 파손 확정
                    if inspect_payload.get("result") == "NORMAL":
                        break  # 재확인 중 정상 판정 - 정상 확정
                    verdict = inspect_payload.get("result", "FAILED")
                    # UNCERTAIN/FAILED - 아래 만료/가이던스 경로로 세션 계속

                if time.time() >= expires_at_ts:
                    break  # 세션 만료 - 마지막 판정(UNCERTAIN 등) 그대로 보고

                if time.time() - last_guidance_sent > GUIDANCE_INTERVAL:
                    self.send_event("COMMAND_PROGRESS", command_id, request_id, station_id,
                                     "PROCESSING",
                                     {"status": "GUIDANCE", "guidanceCode": "SHOW_UMBRELLA"},
                                     command_type="INSPECT_UMBRELLA")
                    last_guidance_sent = time.time()
                time.sleep(0.2)

            result = inspect_payload.get("result", "FAILED")
            terminal_status = "FAILED" if result == "FAILED" else "SUCCEEDED"

            print(f"[Orin] 파손 검증 완료: result={result}, "
                  f"confidence={inspect_payload.get('confidence')}, "
                  f"latencyMs={inspect_payload.get('latencyMs')}")

            terminal_event = self.send_event(
                "COMMAND_RESULT", command_id, request_id, station_id,
                terminal_status, inspect_payload,
                command_type="INSPECT_UMBRELLA",
            )

        # 멱등 캐시 저장은 호출부(command_loop)가 담당한다 - 여기서는 결과만 반환.
        return terminal_event
