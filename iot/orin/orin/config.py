"""전역 설정 상수. 다른 모듈에 의존하지 않는 최하위 계층."""
import os
import time
import uuid

# ---- 파손우산 검증 모듈 경로 (AI 담당자 인도분, damage_check_v1) ----
# 실제 sys.path 삽입과 임포트는 inspection.py가 담당한다 (설정과 로딩 책임 분리).
DAMAGE_CHECK_DIR = os.environ.get("DAMAGE_CHECK_DIR", "/home/billisan/AIoT/damage_check_v1")

DB_CONFIG = dict(
    dbname="billisan_face",
    user="billisan_app",
    password="change-me",
    host="localhost",
)

CAMERA_INDEX = 0
# 카메라 지원 목록(v4l2-ctl --list-formats-ext) 중 16:9 최저 해상도.
# 이 카메라의 16:9는 1280x720 / 1920x1080 / 2560x1440 뿐이며, 나머지는 4:3이다.
# (이전 720x480은 지원 목록에 없는 값이라 드라이버가 임의로 다른 해상도로 협상했음)
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720
TOP_K = 5
SIMILARITY_THRESHOLD = 0.45  # POL-AUTH-004 확정값
GUIDANCE_INTERVAL = 1.0      # 비종료 안내 이벤트를 몇 초에 한 번 보낼지
AUTH_SESSION_DEFAULT_SECONDS = 15.0  # expiresAt 절대시각 대신 로컬 상대시간으로 카운트
AUTH_WARMUP_SECONDS = 1.5   # 인증 시작 전 대기 (즉시 매칭으로 인한 급전환 방지, 카메라는 유지)

# 프리뷰 영상에 얼굴 bbox 사각형 + det/sim 수치를 그릴지 여부.
# False(기본) = 깨끗한 영상만 송출. 키오스크는 공용 화면이라 인식 수치가 노출되면
# 보기에도 지저분하고, 12-I 개인정보 경계상 '원시 유사도'는 사용자에게 보이지 않는 편이 맞다.
# 디버깅 중 얼굴 인식 상태를 눈으로 확인하려면 True로 바꿀 것.
PREVIEW_OVERLAY = False
INSPECT_SESSION_DEFAULT_SECONDS = 15.0  # 파손 검증도 인증처럼 세션 방식: 확신 판정까지 재시도

# 파손 검증 학습 데이터가 전부 좌우반전 상태라, 추론도 반전해야 한다 (README 명시 사항)
DAMAGE_CHECK_MIRROR = True

STREAM_TOKEN = "change-me"

# ---- 얼굴 가이드 영역 (프론트엔드 FaceGuideOverlay 반영, 이전 verify_face.py와 동일 로직) ----
GUIDE_CX_FRAC = 0.5
GUIDE_CY_FRAC = 0.5
GUIDE_RX_FRAC_OF_HEIGHT = 0.45 * (11 / 12) * (200 / 260)
GUIDE_RY_FRAC_OF_HEIGHT = (120 / 260) * (11 / 12)
GUIDE_NEAR_MARGIN = 1.0
VISIBLE_HEIGHT_RATIO = 0.9

# ---- ZeroMQ 접속 설정 (Pi가 bind, Orin이 connect) ----
PI_IP = "127.0.0.1"  # 파이 IP - 바뀌면 여기만 수정
ZEROMQ_COMMAND_PORT = 5557  # Pi가 bind한 명령 채널 -> Orin이 SUB connect
ZEROMQ_EVENT_PORT = 5556    # Pi가 bind한 이벤트 채널 -> Orin이 PUB connect

COMMAND_PREFIX = "billisan.zmq.v1.orin.command."
EVENT_PREFIX_TMPL = "billisan.zmq.v1.orin.event.{event_type}"
HEALTH_PREFIX = "billisan.zmq.v1.orin.health"
HEALTH_INTERVAL_SECONDS = 2.0  # 헬스비트 발행 주기 (Pi 타임아웃 6초 = 3회 유실 허용)

SCHEMA_VERSION = "1.0"
ORIN_DEVICE_ID = "orin-01"
ORIN_BOOT_ID = str(uuid.uuid4())  # 이 프로세스가 뜰 때마다 새로 생성


def _iso(ts=None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts if ts else time.time()))
