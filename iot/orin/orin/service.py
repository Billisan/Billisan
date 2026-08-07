"""OrinService - 각 기능 믹스인을 결합하고 ZeroMQ 명령 루프를 돌린다.

실제 업무 로직은 믹스인(messaging / face_auth / inspection)에 있고,
이 클래스는 '무슨 명령이 오면 누구에게 넘기는가'만 담당한다."""
import json
import threading
import time

import psycopg2
import zmq
from pgvector.psycopg2 import register_vector

from .config import (
    DB_CONFIG, PI_IP, ZEROMQ_COMMAND_PORT, ZEROMQ_EVENT_PORT, COMMAND_PREFIX,
    EVENT_PREFIX_TMPL, ORIN_BOOT_ID, AUTH_WARMUP_SECONDS, AUTH_SESSION_DEFAULT_SECONDS,
)
from .face_auth import FaceAuthMixin
from .inspection import InspectionMixin
from .messaging import MessagingMixin


class OrinService(MessagingMixin, FaceAuthMixin, InspectionMixin):
    def __init__(self, camera, face_app, inspector=None):
        self.camera = camera
        self.face_app = face_app
        self.inspector = inspector  # 파손우산 검증기 (없으면 INSPECT_UMBRELLA 실행 불가)
        self.conn = psycopg2.connect(**DB_CONFIG)
        register_vector(self.conn)

        ctx = zmq.Context()
        self.command_sub = ctx.socket(zmq.SUB)
        self.command_sub.connect(f"tcp://{PI_IP}:{ZEROMQ_COMMAND_PORT}")
        self.command_sub.setsockopt_string(zmq.SUBSCRIBE, "")
        self.command_sub.setsockopt(zmq.RCVTIMEO, 500)

        self.event_pub = ctx.socket(zmq.PUB)
        self.event_pub.connect(f"tcp://{PI_IP}:{ZEROMQ_EVENT_PORT}")

        # 표시용 최신 상태 (프리뷰 오버레이용)
        self.overlay_lock = threading.Lock()
        self.overlay_bbox = None
        self.overlay_labels = ["Idle"]

        # commandId -> 마지막 Terminal 결과 (중복 재수신 시 재실행 없이 재전송)
        self.processed_commands = {}

    def command_loop(self):
        while True:
            try:
                topic_b, payload_b = self.command_sub.recv_multipart()
            except zmq.Again:
                continue
            except ValueError:
                print("[Orin] 잘못된 멀티파트 메시지 무시")
                continue

            topic = topic_b.decode("utf-8")
            try:
                command = json.loads(payload_b.decode("utf-8"))
            except json.JSONDecodeError:
                print(f"[Orin] JSON 파싱 실패: {payload_b[:80]}")
                continue

            if not topic.startswith(COMMAND_PREFIX):
                continue

            command_id = command.get("commandId")
            command_type = command.get("commandType")
            request_id = command.get("requestId")
            station_id = command.get("stationId")
            target_boot_id = command.get("targetBootId")

            print(f"[Orin] Command 수신: {command_type} (commandId={command_id})")

            # Boot ID 불일치 - 이 명령은 이 Orin 프로세스를 위한 게 아니거나 Stale
            if target_boot_id and target_boot_id != ORIN_BOOT_ID:
                print(f"[Orin] targetBootId 불일치 - 무시 (수신={target_boot_id}, 현재={ORIN_BOOT_ID})")
                continue

            # 만료 체크
            # (간단 비교를 위해 실제로는 datetime 파싱이 필요하지만, 여기선 생략하고 세션 내부 타임아웃으로 처리)

            # 중복 commandId - 재실행 없이 기존 결과 재전송
            if command_id in self.processed_commands:
                print(f"[Orin] 중복 commandId={command_id} - 기존 결과 재전송")
                cached = self.processed_commands[command_id]
                topic_out = EVENT_PREFIX_TMPL.format(event_type=cached["eventType"])
                self.event_pub.send_multipart([topic_out.encode("utf-8"), json.dumps(cached).encode("utf-8")])
                continue

            # 명령 수락 - COMMAND_ACCEPTED는 여기서 딱 1회만 발행
            # (세션 중 진행 상황/가이던스는 COMMAND_PROGRESS로 분리)
            if command_type in ("AUTHENTICATE_FACE", "INSPECT_UMBRELLA"):
                self.send_event("COMMAND_ACCEPTED", command_id, request_id, station_id,
                                 "PROCESSING", {"status": "ACCEPTED", "guidanceCode": "NONE"},
                                 command_type=command_type)

            if command_type == "AUTHENTICATE_FACE":
                # 세션 타임아웃: expiresAt 절대시각을 파싱하지 않고, 받은 시점부터
                # 로컬 상대시간으로 AUTH_SESSION_DEFAULT_SECONDS만큼만 센다.
                # (트레이드오프: 네트워크 지연으로 명령이 아주 늦게 도착해도 도착 시점부터
                #  새로 카운트한다 - 지금은 로컬 테스트라 지연이 미미해 문제 없음)
                expires_at_ts = time.time() + AUTH_WARMUP_SECONDS + AUTH_SESSION_DEFAULT_SECONDS

                terminal_event = self._run_authenticate_session(command_id, request_id, station_id, expires_at_ts)
                self.processed_commands[command_id] = terminal_event
                print(f"[Orin] Terminal 전송 완료: commandId={command_id}, result={terminal_event['result']}")

            elif command_type == "INSPECT_UMBRELLA":
                terminal_event = self._run_inspect_session(command, command_id, request_id, station_id)
                self.processed_commands[command_id] = terminal_event
                print(f"[Orin] Terminal 전송 완료: commandId={command_id}")


            else:
                print(f"[Orin] 미지원 commandType 무시: {command_type}")

    def get_overlay(self):
        with self.overlay_lock:
            return self.overlay_bbox, list(self.overlay_labels)
