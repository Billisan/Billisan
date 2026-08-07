"""얼굴 인증 세션 - OrinService에 믹스인으로 결합된다.

pgvector 유사도 검색과 가이드 판정을 조합해 인증 1회를 세션으로 수행한다."""
import time

from .camera import is_within_guide
from .config import (
    TOP_K, SIMILARITY_THRESHOLD, GUIDANCE_INTERVAL, AUTH_WARMUP_SECONDS,
)


class FaceAuthMixin:
    """_query_top_match / _pick_largest_face / _run_authenticate_session.

    결합 클래스가 제공해야 하는 것: self.conn (pgvector 커넥션), self.camera, self.face_app,
    self.overlay_bbox / overlay_labels / overlay_lock, self.send_event."""

    def _query_top_match(self, embedding):
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT user_ref, 1 - (embedding <=> %s) AS similarity
            FROM face_profile
            ORDER BY embedding <=> %s
            LIMIT %s;
            """,
            (embedding, embedding, TOP_K),
        )
        rows = cur.fetchall()
        cur.close()
        return rows

    def _pick_largest_face(self, faces):
        def area(f):
            x1, y1, x2, y2 = f.bbox
            return (x2 - x1) * (y2 - y1)
        return max(faces, key=area)

    def _run_authenticate_session(self, command_id, request_id, station_id, expires_at_ts):
        """
        AUTHENTICATE_FACE Command 하나를 처리한다.
        만료 전까지 반복 시도하다가, 매칭되면 즉시 종료 / 안 되면 Timeout으로 종료.
        """
        ever_saw_face = False
        last_guidance_sent = 0.0

        # 인증 시작 전 워밍업: 페이지 진입 직후 즉시 매칭돼 화면이 순간 전환되는 것을 방지.
        # 카메라/프리뷰는 별도 스레드라 계속 살아있고, 매칭 시작만 늦춘다.
        print(f"[Orin] 인증 워밍업 {AUTH_WARMUP_SECONDS:.1f}초 대기 후 매칭 시작...")
        time.sleep(AUTH_WARMUP_SECONDS)

        while time.time() < expires_at_ts:
            frame = self.camera.get_frame()
            if frame is None:
                time.sleep(0.1)
                continue

            faces = self.face_app.get(frame)
            frame_height, frame_width = frame.shape[:2]

            if not faces:
                with self.overlay_lock:
                    self.overlay_bbox = None
                    self.overlay_labels = ["FACE_NOT_DETECTED"]
                if time.time() - last_guidance_sent > GUIDANCE_INTERVAL:
                    self.send_event("COMMAND_PROGRESS", command_id, request_id, station_id,
                                     "PROCESSING", {"status": "GUIDANCE", "guidanceCode": "NONE"},
                                     command_type="AUTHENTICATE_FACE")
                    last_guidance_sent = time.time()
                time.sleep(0.1)
                continue

            ever_saw_face = True
            target = self._pick_largest_face(faces)

            if not is_within_guide(target.bbox, frame_width, frame_height):
                with self.overlay_lock:
                    self.overlay_bbox = target.bbox
                    self.overlay_labels = ["Move into guide"]
                if time.time() - last_guidance_sent > GUIDANCE_INTERVAL:
                    self.send_event("COMMAND_PROGRESS", command_id, request_id, station_id,
                                     "PROCESSING", {"status": "GUIDANCE", "guidanceCode": "CENTER_FACE"},
                                     command_type="AUTHENTICATE_FACE")
                    last_guidance_sent = time.time()
                time.sleep(0.1)
                continue

            rows = self._query_top_match(target.normed_embedding)
            top_sim = rows[0][1] if rows else None
            top_user = rows[0][0] if rows else None

            with self.overlay_lock:
                self.overlay_bbox = target.bbox
                self.overlay_labels = [f"det={target.det_score:.2f}", f"sim={top_sim:.4f}" if top_sim else "no rows"]

            if top_sim is not None and top_sim >= SIMILARITY_THRESHOLD:
                # 매칭 성공 - Terminal
                return self.send_event(
                    "COMMAND_RESULT", command_id, request_id, station_id, "SUCCEEDED",
                    {"status": "MATCHED", "userRef": str(top_user), "guidanceCode": "NONE", "modelVersion": "buffalo_l"},
                    command_type="AUTHENTICATE_FACE",
                )

            time.sleep(0.1)

        # 만료 - Terminal (실패)
        result_status = "REJECTED" if ever_saw_face else "FACE_NOT_DETECTED"
        return self.send_event(
            "COMMAND_RESULT", command_id, request_id, station_id, "TIMED_OUT",
            {"status": result_status, "userRef": None, "guidanceCode": "NONE", "modelVersion": "buffalo_l"},
            command_type="AUTHENTICATE_FACE",
        )
