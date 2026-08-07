"""서보·홀센서 제어와 물리 동작 실행. 하드웨어에 직접 접근하는 유일한 계층."""
import threading
import time

import RPi.GPIO as GPIO
from adafruit_servokit import ServoKit

from .config import (
    PCA9685_ADDRESS, PCA9685_CHANNELS, SERVO_CHANNEL,
    SERVO_PULSE_MIN, SERVO_PULSE_MAX, OPEN_ANGLE, CLOSE_ANGLE,
    SLOT_SENSOR_GPIO_PIN, SLOT_SENSOR_ACTIVE_HIGH,
    SENSOR_POLL_INTERVAL, SENSOR_DEBOUNCE_COUNT,
    OCCUPANCY_DIRECTION_CHECK, STABILIZE_SECONDS, PICKUP_TIMEOUT_SECONDS,
    RELOCK_DELAY_REMOVE_SECONDS, RELOCK_DELAY_INSERT_SECONDS,
)
from .utils import _iso


_kit = ServoKit(channels=PCA9685_CHANNELS, address=PCA9685_ADDRESS)
_servo = _kit.servo[SERVO_CHANNEL]
_servo.set_pulse_width_range(SERVO_PULSE_MIN, SERVO_PULSE_MAX)

servo_lock = threading.Lock()
current_lock_state = "UNKNOWN"  # OPEN / CLOSED / UNKNOWN


def open_servo(reason: str):
    global current_lock_state
    with servo_lock:
        print(f"[Pi] 서보 OPEN (angle={OPEN_ANGLE}, 원인={reason})")
        _servo.angle = OPEN_ANGLE
        current_lock_state = "OPEN"


def close_servo(reason: str):
    global current_lock_state
    with servo_lock:
        print(f"[Pi] 서보 CLOSE (angle={CLOSE_ANGLE}, 원인={reason})")
        _servo.angle = CLOSE_ANGLE
        current_lock_state = "CLOSED"


def read_touch_raw() -> bool:
    """슬롯 점유 센서 원시 판독. True = 자석 감지(= 우산 삽입됨/OCCUPIED)."""
    level_high = GPIO.input(SLOT_SENSOR_GPIO_PIN) == GPIO.HIGH
    return level_high if SLOT_SENSOR_ACTIVE_HIGH else not level_high


def touch_debounced() -> bool:
    """
    SENSOR_DEBOUNCE_COUNT회 판독의 다수결로 확정 (리드 채터링/순간 노이즈 무시).
    다수결인 이유: 기존 all() 방식은 True 확정엔 3연속을 요구하면서 False는 1회로
    확정하는 비대칭이라, 리드 접점이 튀면 '제거됨'으로 오판할 수 있었다.
    """
    readings = []
    for _ in range(SENSOR_DEBOUNCE_COUNT):
        readings.append(read_touch_raw())
        time.sleep(SENSOR_POLL_INTERVAL)
    return sum(readings) > SENSOR_DEBOUNCE_COUNT // 2


def _lock_status_enum():
    """내부 상태(OPEN/CLOSED)를 문서 enum(UNLOCKED/LOCKED)으로 변환"""
    return {"OPEN": "UNLOCKED", "CLOSED": "LOCKED"}.get(current_lock_state, "UNKNOWN")


def _occupancy_status_enum(touched: bool) -> str:
    return "OCCUPIED" if touched else "EMPTY"


def wait_for_occupancy_target(target_touched: bool, timeout_seconds: float) -> bool:
    """
    점유 상태가 '지정한 목표 상태'로 안정적으로 도달하는지 확인한다.
    wait_for_occupancy_change와 달리 방향이 고정이라, 반대 방향 변화는 성공으로 인정하지 않는다.
      - 대여(REMOVE): target_touched=False (우산이 빠져 EMPTY가 되어야 함)
      - 반납(INSERT): target_touched=True  (우산이 들어와 OCCUPIED가 되어야 함)
    (문서: 감지 후 200ms 안정화 -> 최종 재확인, 순간 노이즈로 완료 확정 금지)
    """
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if touch_debounced() == target_touched:
            time.sleep(STABILIZE_SECONDS)
            if touch_debounced() == target_touched:
                return True
        time.sleep(0.05)
    return False


def wait_for_occupancy_change(initial_touched: bool, timeout_seconds: float) -> bool:
    """
    UNLOCK으로 열어둔 뒤, 터치 상태가 initial_touched와 반대로 안정적으로 바뀌는지 확인한다.
    (문서: DRV5032 감지 후 200ms 안정화 -> 최종 재확인, 순간 노이즈로 완료 확정 금지)
    반환: True=변화 확인됨(실제 제거/삽입 감지), False=시간 안에 확인 못 함(타임아웃)
    """
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        current = touch_debounced()
        if current != initial_touched:
            time.sleep(STABILIZE_SECONDS)
            if touch_debounced() != initial_touched:
                return True
        time.sleep(0.05)
    return False


def execute_lock_operation(operation_type: str, slot_id: str, command_id: str,
                            expected_transition: str = None):
    """
    실제 서보 제어 + evidence 생성 (재사용 가능한 핵심 로직).
    handle_physical_command(스프링이 직접 LOCK/UNLOCK을 미는 경우)와
    대여/반납 체인이 공용으로 쓴다.

    expected_transition: 업무가 기대하는 점유 변화 방향.
      "REMOVE" - 대여: OCCUPIED -> EMPTY (우산을 꺼냄)
      "INSERT" - 반납: EMPTY -> OCCUPIED (우산을 꽂음)
      None     - 방향 미지정(레거시/스프링 직접 명령): 기존처럼 '상태가 바뀌면' 성공
    방향을 지정하면 사전조건(시작 상태)까지 검사하므로, 반대 방향 움직임이나
    이미 잘못된 상태에서 시작한 경우를 성공으로 오인하지 않는다.

    반환: (terminal_status, result_code, evidence)
    """
    before_occupancy = _occupancy_status_enum(touch_debounced())
    before_lock = _lock_status_enum()
    observed_at = _iso()

    try:
        if operation_type == "UNLOCK":
            initial_touched = touch_debounced()
            use_direction = OCCUPANCY_DIRECTION_CHECK and expected_transition in ("REMOVE", "INSERT")

            # --- 사전조건 검사 (방향 검사 활성화 시에만) ---
            # 대여인데 슬롯이 비어 있거나, 반납인데 이미 우산이 있으면 물리 동작을 시작하지 않는다.
            precondition_ok = True
            if use_direction:
                if expected_transition == "REMOVE" and not initial_touched:
                    precondition_ok = False
                    result_code = "SLOT_ALREADY_EMPTY"
                elif expected_transition == "INSERT" and initial_touched:
                    precondition_ok = False
                    result_code = "SLOT_ALREADY_OCCUPIED"

            if not precondition_ok:
                print(f"[Pi] 사전조건 불일치로 개방하지 않음: {result_code} "
                      f"(기대 방향={expected_transition}, 현재={'점유' if initial_touched else '비점유'})")
                terminal_status = "FAILED"
            else:
                open_servo(reason=f"물리 동작 (commandId={command_id})")

                # 실패 코드는 기대 방향이 있으면 그 방향 기준으로, 없으면 시작 상태 기준으로 정한다.
                if expected_transition == "REMOVE":
                    fail_code = "WITHDRAWAL_NOT_DETECTED"
                elif expected_transition == "INSERT":
                    fail_code = "INSERTION_NOT_DETECTED"
                else:
                    fail_code = "WITHDRAWAL_NOT_DETECTED" if initial_touched else "INSERTION_NOT_DETECTED"

                if use_direction:
                    target_touched = (expected_transition == "INSERT")
                    print(f"[Pi] 물리 완료 확인 대기 중... (최대 {PICKUP_TIMEOUT_SECONDS:.0f}초, "
                          f"{'우산 삽입' if target_touched else '우산 인출'} 대기, "
                          f"현재={'점유' if initial_touched else '비점유'} -> "
                          f"목표={'점유' if target_touched else '비점유'})")
                    reached = wait_for_occupancy_target(target_touched, PICKUP_TIMEOUT_SECONDS)
                else:
                    # 방향 무관 - 시작 상태에서 '변화'가 감지되면 성공 (센서 1개 구성에서의 기본 동작)
                    print(f"[Pi] 물리 완료 확인 대기 중... (최대 {PICKUP_TIMEOUT_SECONDS:.0f}초, "
                          f"상태 변화 대기, 기준={'점유' if initial_touched else '비점유'})")
                    reached = wait_for_occupancy_change(initial_touched, PICKUP_TIMEOUT_SECONDS)

                if reached:
                    # 방향 검사(OCCUPANCY_DIRECTION_CHECK)가 꺼져 있어도 업무 방향은 알고 있으므로
                    # 지연 시간 선택에는 그대로 활용한다. 방향 미지정이면 긴 쪽(안전)으로.
                    relock_delay = (RELOCK_DELAY_INSERT_SECONDS if expected_transition == "INSERT"
                                     else RELOCK_DELAY_REMOVE_SECONDS)
                    if relock_delay > 0:
                        print(f"[Pi] 점유 변화 감지 - {relock_delay:.1f}초 후 재잠금 "
                              f"({'손이 빠져나갈' if expected_transition == 'INSERT' else '우산을 빼낼'} 여유)")
                        time.sleep(relock_delay)
                    close_servo(reason="물리 완료 확인됨 - 자동 재잠금")
                    terminal_status = "SUCCEEDED"
                    result_code = "OK"
                else:
                    # 문서 원칙: 미완료 시에도 안전을 위해 재잠금하되, 완료로 보고하지 않는다.
                    close_servo(reason="확인 타임아웃 - 안전을 위해 재잠금")
                    terminal_status = "FAILED"
                    result_code = fail_code

        elif operation_type == "LOCK":
            close_servo(reason=f"물리 동작 (commandId={command_id})")
            terminal_status = "SUCCEEDED"
            result_code = "OK"
        else:
            raise ValueError(f"알 수 없는 operationType: {operation_type}")

    except Exception as e:
        print(f"[Pi] 서보 동작 실패: {e}")
        terminal_status = "FAILED"
        result_code = "LOCK_OPERATION_FAILED"

    after_occupancy = _occupancy_status_enum(touch_debounced())
    after_lock = _lock_status_enum()

    evidence = {
        "schemaVersion": 1,
        "observedAt": observed_at,
        "before": {"occupancyStatus": before_occupancy, "lockStatus": before_lock},
        "after": {"occupancyStatus": after_occupancy, "lockStatus": after_lock},
        "stability": {"windowMillis": int(STABILIZE_SECONDS * 1000), "sampleCount": SENSOR_DEBOUNCE_COUNT},
        # 센서 자체 고장 진단(단선 등)은 아직 미구현이라 항상 OK로 둔다 - 실제 헬스체크 로직 필요.
        "sensorHealth": {"occupancy": "OK", "lock": "OK"},
    }

    print(f"[Pi] 물리 동작 완료: {operation_type} -> {terminal_status}/{result_code} "
          f"(before={before_occupancy}/{before_lock}, after={after_occupancy}/{after_lock})")

    return terminal_status, result_code, evidence
