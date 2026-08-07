#!/usr/bin/env python3
"""
Pi ↔ Orin ZeroMQ 클라이언트 (문서 12-I A-6.ZMQ 기준 요청-응답 구조)

토폴로지 (문서 A-6.ZMQ-1 그대로):
  Command 채널: Pi PUB bind  -> Orin SUB connect
  Event 채널:   Pi SUB bind  <- Orin PUB connect
  (Pi가 두 endpoint를 전부 bind, Orin이 connect)

흐름:
  1. Orin이 뜨면 ORIN_READY 이벤트를 보낸다 (Pi는 이걸 받기 전엔 Command 금지)
  2. Pi가 AUTHENTICATE_FACE Command를 발행 (commandId, expiresAt 포함)
  3. Orin이 그 세션 동안 인식 시도 -> 매칭되거나 만료되면 Terminal Result(COMMAND_RESULT/COMMAND_FAILED) 1회 전송
  4. Pi는 같은 commandId로 결과를 받아 상위 흐름(서보 제어 등)에 반영

주의: 이 파일은 Pi<->Orin 구간만 다룬다. Spring과의 MQTT 연동(EDGE-AUTH-001 등)은 별도 작업.
"""
import json
import os
import time
import uuid
import threading
import logging
from logging.handlers import RotatingFileHandler
import zmq

# ---- 신호 송수신 로그 (DB·영속 저널 대신 회전 로그 파일만 사용 - 문서 원칙) ----
LOG_DIR = os.environ.get("BILLISAN_LOG_DIR", "./logs")


def _setup_signal_logger(logger_name: str, file_name: str):
    """기기별로 별도 로그 파일을 만드는 재사용 가능한 헬퍼."""
    os.makedirs(LOG_DIR, exist_ok=True)
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)
    if not logger.handlers:  # 모듈이 여러 번 import돼도 핸들러 중복 등록 방지
        handler = RotatingFileHandler(
            os.path.join(LOG_DIR, file_name), maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(handler)
    return logger


orin_signal_logger = _setup_signal_logger("orin_signals", "orin_signals.log")

# ---- 배포 설정 (문서: ZEROMQ_COMMAND_ENDPOINT, ZEROMQ_EVENT_ENDPOINT) ----
ZEROMQ_COMMAND_BIND_PORT = 5557   # Pi가 bind, Orin이 connect (명령 채널)
ZEROMQ_EVENT_BIND_PORT = 5556    # Pi가 bind, Orin이 connect (이벤트 채널)

# ---- 식별자 (실제로는 Spring이 발급한 값으로 교체 필요, 지금은 고정 placeholder) ----
STATION_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "billisan-station-01"))
PI_DEVICE_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "pi-01"))
PI_BOOT_ID = str(uuid.uuid4())  # 이 프로세스가 뜰 때마다 새로 생성

# ---- ZeroMQ Prefix (문서 A-6.ZMQ-1 그대로) ----
COMMAND_PREFIX_TMPL = "billisan.zmq.v1.orin.command.{command_type}"
EVENT_PREFIX_TMPL = "billisan.zmq.v1.orin.event.{event_type}"
HEALTH_PREFIX = "billisan.zmq.v1.orin.health"
HEALTH_TIMEOUT_SECONDS = 6.0  # 이 시간 동안 헬스비트가 없으면 Orin 오프라인 간주 (발행 주기 2초 x 3회 유실)

SCHEMA_VERSION = "1.0"


class OrinClient:
    def __init__(self):
        ctx = zmq.Context()

        # Command 채널: Pi가 PUB bind
        self.command_pub = ctx.socket(zmq.PUB)
        self.command_pub.bind(f"tcp://*:{ZEROMQ_COMMAND_BIND_PORT}")

        # Event 채널: Pi가 SUB bind (모든 이벤트 prefix 구독)
        self.event_sub = ctx.socket(zmq.SUB)
        self.event_sub.bind(f"tcp://*:{ZEROMQ_EVENT_BIND_PORT}")
        self.event_sub.setsockopt_string(zmq.SUBSCRIBE, "")
        self.event_sub.setsockopt(zmq.RCVTIMEO, 1000)

        self.lock = threading.Lock()
        self.orin_ready = False
        self.orin_boot_id = None
        self.command_sequence = 0  # (stationId, targetDeviceId, targetBootId) 범위 - 지금은 Orin 1대뿐이라 단순 카운터

        # commandId -> Terminal 결과 캐시 (문서: 같은 commandId 중복 시 재실행 없이 기존 결과 반환)
        self.terminal_results = {}
        # commandId -> 결과를 기다리는 threading.Event (동기적으로 기다릴 때 사용)
        self.pending_waiters = {}
        # commandId -> 마지막 비종료 이벤트 시그니처 (같은 가이던스 반복 수신 시 콘솔 출력 억제)
        self._last_nonterminal = {}
        # COMMAND_PROGRESS 수신 시 호출되는 훅: fn(command_id, guidance_code)
        # (키오스크 WS로 "얼굴을 가이드 안으로" 실시간 안내를 릴레이할 때 씀. 미설정 시 무시)
        self.progress_callback = None

        # [Orin 헬스비트] 마지막 수신 시각. 한 번도 못 받았으면 None (구버전 Orin 하위호환)
        self.last_health_at = None
        self._offline_logged = False

        threading.Thread(target=self._event_loop, daemon=True).start()

    # ---------- 이벤트 수신 ----------
    def _event_loop(self):
        while True:
            try:
                topic_bytes, payload_bytes = self.event_sub.recv_multipart()
            except zmq.Again:
                continue
            except ValueError:
                print("[Pi] 잘못된 멀티파트 메시지 무시 (프레임 개수 불일치)")
                continue

            topic = topic_bytes.decode("utf-8")
            try:
                payload = json.loads(payload_bytes.decode("utf-8"))
            except json.JSONDecodeError:
                print(f"[Pi] JSON 파싱 실패: {payload_bytes[:80]}")
                continue

            if topic == HEALTH_PREFIX:
                # 헬스비트는 2초마다 오는 순수 생존신호라 orin_signals.log에는 남기지 않는다
                # (콘솔에도 출력 안 함 - 상태 전환 시에만 아래에서 print).
                if self.last_health_at is None:
                    print("[Pi] Orin 헬스비트 수신 시작")
                elif self._offline_logged:
                    print("[Pi] Orin 헬스비트 복구 - 온라인 전환")
                    self._offline_logged = False
                self.last_health_at = time.time()
                continue

            orin_signal_logger.info(f"IN  ZMQ-Orin topic={topic} payload={json.dumps(payload, ensure_ascii=False)}")

            if not topic.startswith("billisan.zmq.v1.orin.event."):
                print(f"[Pi] 알 수 없는 토픽 무시: {topic}")
                continue

            event_type = payload.get("eventType")

            if event_type == "ORIN_READY":
                with self.lock:
                    self.orin_ready = True
                    self.orin_boot_id = payload.get("sourceBootId")
                    self.command_sequence = 0  # 새 Boot면 시퀀스 리셋
                    self.last_health_at = time.time()  # READY도 생존 신호로 취급
                print(f"[Pi] ORIN_READY 수신 (orinBootId={self.orin_boot_id})")
                continue

            self._handle_command_event(payload)

    def _handle_command_event(self, payload):
        command_id = payload.get("commandId")
        terminal_status = payload.get("terminalStatus")
        event_type = payload.get("eventType")

        # ACCEPTED/PROGRESS(PROCESSING)는 비종료 - 상태가 바뀔 때만 콘솔에 찍는다.
        # (Orin이 가이던스를 1초 간격으로 보내므로, 전부 찍으면 로그가 도배된다.
        #  전체 원문은 orin_signal_logger가 파일에 이미 남기고 있음.)
        if terminal_status not in ("SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED"):
            result = payload.get("result") or {}
            guidance_code = result.get("guidanceCode")
            signature = (event_type, guidance_code)
            if self._last_nonterminal.get(command_id) != signature:
                self._last_nonterminal[command_id] = signature
                print(f"[Pi] 이벤트 수신: eventType={event_type}, commandId={command_id}, "
                      f"guidanceCode={guidance_code}")
            callback = self.progress_callback
            if event_type == "COMMAND_PROGRESS" and callback is not None:
                try:
                    callback(command_id, guidance_code)
                except Exception as e:  # 릴레이 실패가 이벤트 루프를 죽이면 안 됨
                    print(f"[Pi] progress_callback 오류 무시: {e}")
            return

        print(f"[Pi] 이벤트 수신: eventType={event_type}, commandId={command_id}, terminalStatus={terminal_status}")

        with self.lock:
            self._last_nonterminal.pop(command_id, None)
            if command_id in self.terminal_results:
                # 이미 Terminal을 받은 commandId에 대한 상충 이벤트 - 기록만, 상태 변경 안 함
                print(f"[Pi] 경고: commandId={command_id} 중복 Terminal (CONFLICTING_TERMINAL_EVENT), 무시")
                return
            self.terminal_results[command_id] = payload
            waiter = self.pending_waiters.get(command_id)

        if waiter is not None:
            waiter.set()

    def orin_connected(self) -> bool:
        """Orin 생존 판정: ORIN_READY를 받았고, 헬스비트가 타임아웃 안에 살아있는가.
        헬스비트를 한 번도 못 받은 경우(구버전 Orin)는 orin_ready만으로 판정한다 (하위호환)."""
        if not self.orin_ready:
            return False
        if self.last_health_at is None:
            return True  # 구버전 Orin: 헬스비트 미지원 - READY 기반 판정으로 폴백
        alive = (time.time() - self.last_health_at) < HEALTH_TIMEOUT_SECONDS
        if not alive and not self._offline_logged:
            print(f"[Pi] 경고: Orin 헬스비트 {HEALTH_TIMEOUT_SECONDS:.0f}초 이상 끊김 - 오프라인 간주")
            self._offline_logged = True
        return alive

    # ---------- 명령 발행 ----------
    def send_command(self, command_type: str, request_id: str, payload: dict, timeout_seconds: float = 15.0) -> dict:
        """
        Command를 발행하고 Terminal Result를 동기적으로 기다린다.
        반환: Terminal Event의 전체 payload dict (또는 타임아웃 시 로컬 생성된 TIMED_OUT dict)
        """
        with self.lock:
            if not self.orin_ready:
                raise RuntimeError("ORIN_READY를 아직 못 받았습니다. Command를 보낼 수 없습니다.")
            self.command_sequence += 1
            command_id = str(uuid.uuid4())
            now = time.time()
            command = {
                "schemaVersion": SCHEMA_VERSION,
                "messageId": str(uuid.uuid4()),
                "commandId": command_id,
                "requestId": request_id,
                "stationId": STATION_ID,
                "sourceDeviceId": PI_DEVICE_ID,
                "targetDeviceId": "orin-01",  # 실제로는 등록된 Orin 장치 ID
                "targetBootId": self.orin_boot_id,
                "commandSequence": self.command_sequence,
                "commandType": command_type,
                "issuedAt": _iso(now),
                "expiresAt": _iso(now + timeout_seconds),
                "payload": payload,
            }
            waiter = threading.Event()
            self.pending_waiters[command_id] = waiter

        topic = COMMAND_PREFIX_TMPL.format(command_type=command_type)
        self.command_pub.send_multipart([
            topic.encode("utf-8"),
            json.dumps(command).encode("utf-8"),
        ])
        orin_signal_logger.info(f"OUT ZMQ-Orin topic={topic} payload={json.dumps(command, ensure_ascii=False)}")
        print(f"[Pi] Command 발행: {topic} (commandId={command_id})")

        got_result = waiter.wait(timeout=timeout_seconds + 2.0)  # 여유 2초 더 기다림

        with self.lock:
            self.pending_waiters.pop(command_id, None)
            result = self.terminal_results.get(command_id)

        if not got_result or result is None:
            return {
                "commandId": command_id,
                "terminalStatus": "TIMED_OUT",
                "result": {"errorCode": "ZEROMQ_RESULT_TIMEOUT"},
            }
        return result


def _iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


if __name__ == "__main__":
    # 반복 테스트용: 번호를 고르면 그 명령을 다시 보낸다.
    # ORIN_READY는 한 번만 받으면 되고, 그 이후로는 프로그램이 계속 떠있는 상태를 유지한다.
    #
    # 주의: pi_command_bridge.py와 같은 ZeroMQ 포트(5556/5557)를 쓰므로, 이 스크립트를
    # 돌리는 동안은 pi_command_bridge.py를 꺼두어야 한다 (둘 다 동시에 bind 못함).
    client = OrinClient()

    print("[Pi] ORIN_READY 대기 중...")
    while not client.orin_ready:
        time.sleep(0.5)

    print("[Pi] 준비 완료. (Ctrl+C로 종료)")
    try:
        while True:
            choice = input("\n1) 얼굴인증 테스트  2) 파손우산 검증 테스트\n>>> 번호 선택: ").strip()

            if choice == "1":
                result = client.send_command(
                    "AUTHENTICATE_FACE",
                    request_id=str(uuid.uuid4()),
                    payload={"authRequestId": str(uuid.uuid4()), "sessionId": str(uuid.uuid4()),
                             "operation": "AUTHENTICATE"},
                    timeout_seconds=15.0,
                )
            elif choice == "2":
                result = client.send_command(
                    "INSPECT_UMBRELLA",
                    request_id=str(uuid.uuid4()),
                    payload={"sessionId": str(uuid.uuid4()), "returnAttemptId": str(uuid.uuid4())},
                    timeout_seconds=10.0,
                )
            else:
                print("1 또는 2를 입력하세요.")
                continue

            print(f"[Pi] 최종 결과: {json.dumps(result, indent=2, ensure_ascii=False)}")
    except KeyboardInterrupt:
        print("\n[Pi] 종료합니다.")