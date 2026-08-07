#!/usr/bin/env python3
"""
Billisan Jetson Orin 서비스 진입점 (AI 추론 노드).

역할별 구현은 orin/ 패키지에 있고, 이 파일은 조립해 기동만 한다.
  - 얼굴 인증 / 우산 파손 검증 (InsightFace + ONNX)
  - Pi <-> Orin : ZeroMQ (orin/messaging.py, orin/service.py)
  - 카메라 프리뷰 : Flask (orin/preview.py)
"""
import os
import threading
import time

from insightface.app import FaceAnalysis

from orin.camera import SharedCamera
from orin.config import (
    CAMERA_INDEX, FRAME_WIDTH, FRAME_HEIGHT, DAMAGE_CHECK_DIR, STREAM_TOKEN,
)
from orin.inspection import UmbrellaInspectorOnnx, QualityConfig
from orin.preview import flask_app, bind
from orin.service import OrinService


if __name__ == "__main__":
    print("[1/4] buffalo_l 모델 로딩 중...")
    import onnxruntime as ort
    available = ort.get_available_providers()
    if "CUDAExecutionProvider" in available:
        # [OOM 영구 패치] 기본 설정은 아레나를 2^n으로 무한 확장(gpu_mem_limit 무제한 +
        # kNextPowerOfTwo)해서 buffalo_l 5개 세션이 통합 메모리를 선점하고, 뒤에 로드되는
        # 우산 검증 TRT 엔진이 OOM(NvMap error 12)으로 죽는다. 필요한 만큼만 잡게 제한.
        cuda_options = {
            "arena_extend_strategy": "kSameAsRequested",   # 요청량만큼만 확장
            "gpu_mem_limit": str(2 * 1024 ** 3),            # 세션당 2GB 상한
            "cudnn_conv_algo_search": "HEURISTIC",          # EXHAUSTIVE 탐색의 메모리 스파이크 회피
        }
        providers = [("CUDAExecutionProvider", cuda_options), "CPUExecutionProvider"]
        ctx_id = 0
        print("    CUDAExecutionProvider 감지됨 - GPU로 실행합니다 (아레나 제한 적용)")
    else:
        providers = ["CPUExecutionProvider"]
        ctx_id = -1
        print("    CUDAExecutionProvider 없음 - CPU로 실행합니다")

    face_app = FaceAnalysis(name="buffalo_l", providers=providers)
    face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))

    print(f"[2/4] 파손우산 검증 모델 로딩 중... ({DAMAGE_CHECK_DIR}, ONNX 전용 - torch 불필요)")
    try:
        inspector = UmbrellaInspectorOnnx(
            model_dir=DAMAGE_CHECK_DIR,
            detector_onnx_path=os.path.join(DAMAGE_CHECK_DIR, "yolov8n.onnx"),
            quality=QualityConfig(),
        )
        print(f"    로딩 완료: {inspector.contract!r}")
    except Exception as e:
        # 검증기 로딩 실패해도 얼굴인식·대여/반납 흐름은 계속 동작해야 한다 -
        # INSPECT_UMBRELLA만 못 쓰게 되고 나머지는 정상 진행.
        print(f"    로딩 실패, INSPECT_UMBRELLA는 비활성화됩니다: {e}")
        inspector = None

    print("[3/4] 카메라 시작...")
    camera = SharedCamera(CAMERA_INDEX, width=FRAME_WIDTH, height=FRAME_HEIGHT)

    print("[4/4] ZeroMQ 연결 및 ORIN_READY 발행...")
    service = OrinService(camera, face_app, inspector=inspector)
    time.sleep(0.5)  # slow joiner 대비
    service.send_ready()
    service.start_heartbeat()

    bind(camera, service)  # 프리뷰가 참조할 카메라·서비스 연결
    threading.Thread(target=service.command_loop, daemon=True).start()

    print(f"\n브라우저에서 http://<젯슨IP>:8080/?token={STREAM_TOKEN} 접속")
    flask_app.run(host="0.0.0.0", port=8080, threaded=True)