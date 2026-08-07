"""전역 설정 상수와 신호 로거. 다른 모듈에 의존하지 않는 최하위 계층."""
import RPi.GPIO as GPIO

from .orin_client import STATION_ID, _setup_signal_logger

# ---- 신호 로그 (구간별 송수신 원문 기록) ----
spring_signal_logger = _setup_signal_logger("spring_signals", "spring_signals.log")
kiosk_signal_logger = _setup_signal_logger("kiosk_signals", "kiosk_signals.log")

# ---- EC2 브로커 (Pi-Spring MQTT 구간) ----
BROKER_HOST = "localhost"
BROKER_PORT = 80  # iptables로 18883에 리다이렉트됨 (443은 백엔드 몫이라 테스트는 80 사용)

# ---- 토픽 (문서 A-6.MQTT-1 그대로) ----
COMMAND_SUB_TOPIC = f"billisan/v1/stations/{STATION_ID}/pi/commands/+"
EVENT_PUB_TOPIC_TMPL = "billisan/v1/stations/{station_id}/pi/events/{event_type}"
HEALTH_PUB_TOPIC_TMPL = "billisan/v1/stations/{station_id}/pi/health"

# ---- Edge 요청-응답 토픽 (문서 A-5, Pi가 먼저 요청하고 Spring이 응답) ----
EDGE_REQUEST_TOPIC_TMPL = "billisan/v1/stations/{station_id}/edge/requests/{operation_id}"
EDGE_RESPONSE_SUB_TOPIC = f"billisan/v1/stations/{STATION_ID}/edge/responses/+"
EDGE_RESPONSE_TOPIC_PREFIX = f"billisan/v1/stations/{STATION_ID}/edge/responses/"

# commandId -> 처리 결과 (재실행 방지, 문서 MQTT-AC-004)
processed_spring_commands = {}

# ---- Kiosk Local API ----
KIOSK_API_PORT = 5000

# 세션 만료 시간
SESSION_TTL_SECONDS = 600.0

# 키오스크 사용자 정보 노출 설정 - v3.0 계약은 원래 Kiosk에 식별정보 미노출이 원칙이었으나
# 팀 결정으로 대여 성공 화면에 이름/학번을 표시하기로 함 (문서 개정 필요 항목).
# 공용 화면 어깨너머 노출이 걱정되면 아래 마스킹을 켜면 됨 (홍길동 -> 홍*동, 202600006 -> 2026***06).
KIOSK_MASK_USER_INFO = False

# ---- 서보 (MG90S + PCA9685, 문서 A-8.0: 기본·부팅 상태는 LOCKED) ----
PCA9685_ADDRESS = 0x60
PCA9685_CHANNELS = 16
SERVO_CHANNEL = 0
# 펄스 범위는 angle 숫자를 실제 회전각으로 변환하는 '환율'이다. MG996R 실측 캘리브레이션 값.
# (1000~2000은 물리 가동범위의 절반만 쓰게 되어 모션이 작았음 -> 500~2500으로 확장)
SERVO_PULSE_MIN = 500
SERVO_PULSE_MAX = 2500
OPEN_ANGLE = 140   # 개방 위치 (실측: 이 이상은 끝단 버징 발생 여지가 있어 여유 확보)
CLOSE_ANGLE = 30   # 잠금 위치 (부팅 기본값 - 문서 A-8.0: 기본 상태 LOCKED)

# ---- 슬롯 점유 센서 (홀 센서 - 자석 감지식) ----
# 우산(자석 부착)이 슬롯에 완전히 삽입되면 자석이 센서에 근접 -> "감지" = OCCUPIED.
# 함수 이름(read_touch_raw/touch_debounced)은 호출부 호환을 위해 유지한다.
SLOT_SENSOR_GPIO_PIN = 17          # BCM. 기존 터치센서 자리 그대로
SLOT_SENSOR_ACTIVE_HIGH = True     # 자석 감지 시 OUT이 HIGH면 True, LOW면 False.
                                   #   3선 리드/홀 '모듈'은 제품마다 달라서 실측으로 확정할 것.
                                   #   DRV5032 단품(오픈드레인)이면 False + PULL="up" 조합.
SLOT_SENSOR_PULL = "down"          # "down" / "up" / "none".
                                   #   3선 모듈(능동 출력)은 down 또는 none,
                                   #   DRV5032 단품은 반드시 "up".
SENSOR_POLL_INTERVAL = 0.05
SENSOR_DEBOUNCE_COUNT = 3          # 연속 판독 횟수 (리드 접점 채터링/자석 경계 떨림 흡수)

_PULL_MAP = {"down": GPIO.PUD_DOWN, "up": GPIO.PUD_UP, "none": GPIO.PUD_OFF}
# 점유 '방향' 검사 사용 여부.
#   False(기본) = 시작 상태에서 반대로 '변화'하면 성공 (방향 무관).
#   True        = 대여는 OCCUPIED->EMPTY, 반납은 EMPTY->OCCUPIED만 성공 + 시작 상태 사전검사.
# 현재 False인 이유: 슬롯이 여러 개인데 홀센서는 1개뿐이라, 스프링이 배정한 슬롯과
# 센서가 보는 슬롯이 달라서 사전조건 검사가 정상 상황을 막는 사례가 발생함
# (예: 실제로는 우산이 있는데 센서는 비점유로 읽어 SLOT_ALREADY_EMPTY로 거절).
# 슬롯별 센서가 갖춰지면 True로 되돌릴 것.
OCCUPANCY_DIRECTION_CHECK = False

STABILIZE_SECONDS = 0.2       # 문서: DRV5032 200ms 안정화 후 최종 확인
PICKUP_TIMEOUT_SECONDS = 30   # UNLOCK 후 실제 제거/삽입 확인을 기다리는 최대 시간
INSPECT_RESULT_HOLD_SECONDS = 2.0  # 검증 결과를 키오스크에 알린 뒤 다음 단계로 넘어가기까지 대기.
                                   # 사용자가 검증 결과 화면을 인지할 시간을 준다.
# 점유 변화 감지 -> 재잠금 사이의 여유 시간 (끼임·충돌 방지).
# 방향에 따라 필요한 시간이 다르다:
#   대여(REMOVE) - 센서가 떨어진 뒤에도 우산을 슬롯 밖으로 빼내는 동작이 남아 있어 넉넉히.
#   반납(INSERT) - 이미 꽂아 넣은 상태에서 센서가 붙는 것이라 손만 빠지면 되므로 짧게.
# (타임아웃 실패 경로에서는 지연 없이 즉시 잠근다 - 무단 인출 방지 우선)
RELOCK_DELAY_REMOVE_SECONDS = 5.0   # 대여
RELOCK_DELAY_INSERT_SECONDS = 2.0   # 반납

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(SLOT_SENSOR_GPIO_PIN, GPIO.IN, pull_up_down=_PULL_MAP[SLOT_SENSOR_PULL])
