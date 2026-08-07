"""순수 함수 헬퍼 - 부수효과 없음. config 외에는 의존하지 않는다."""
import time


def _iso_ts(ts=None):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts if ts is not None else time.time()))


def _iso(ts=None) -> str:
    """_iso_ts와 동일 포맷. MQTT 이벤트 계층에서 쓰던 이름을 그대로 유지한다."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts if ts else time.time()))


def _mask_name(name):
    if not name or len(name) < 2:
        return name
    if len(name) == 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]


def _mask_student_id(sid):
    if not sid or len(sid) < 6:
        return sid
    keep_head, keep_tail = 4, 2
    return sid[:keep_head] + "*" * (len(sid) - keep_head - keep_tail) + sid[-keep_tail:]


def _fix_mojibake(text):
    """
    스프링이 UTF-8 문자열을 Latin-1/cp1252로 잘못 읽고 재인코딩해 보낸 경우
    ("홍길동" -> 깨진 문자열) 역변환으로 복구. 정상 한글은 아래 인코딩들로
    인코드가 불가능해 원본 그대로 반환된다 (안전).
    cp1252 케이스: UTF-8 바이트 0x9B 등이 cp1252 전용 글리프(› 등)로 나타남.
    혼합 케이스: 0x9D처럼 cp1252에 미정의된 바이트는 제어문자(U+009D)로 남아
    한 문자열 안에 latin-1/cp1252 해석이 섞임 -> 문자 단위로 바이트 복원.
    """
    if not isinstance(text, str):
        return text
    for enc in ("latin-1", "cp1252"):
        try:
            repaired = text.encode(enc).decode("utf-8")
            if repaired != text:
                return repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    # 혼합 케이스: 문자별로 latin-1(=코드포인트<256 그대로) 우선, 아니면 cp1252로 바이트 복원
    try:
        bs = bytearray()
        for ch in text:
            o = ord(ch)
            if o < 256:
                bs.append(o)
            else:
                bs += ch.encode("cp1252")
        return bs.decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _edge_error_code(response: dict):
    """
    스프링 Edge 응답이 정상 payload가 아니라 에러 payload({"code": "...", "message": "..."})인지 판정.
    정상 응답 스키마에는 code 필드가 없고, 에러 응답은 항상 code(+message)만 담겨 온다.
    반환: 에러면 code 문자열, 정상이면 None.
    (물리 동작 전에 반드시 이 검사를 거쳐야 한다 - USER_NOT_FOUND 등 에러를 성공으로
    오인해 서보를 여는 사고를 방지하기 위함.)
    """
    if response is None:
        return None
    code = response.get("code")
    if code and "message" in response and len(response) <= 3:
        return code
    return None
