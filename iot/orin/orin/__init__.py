"""
Billisan Jetson Orin 서비스 패키지 (AI 추론 노드).

계층 구조 (의존은 위에서 아래로만):

    config      상수·DB 설정        (의존 없음)
    camera      카메라 공유·가이드 판정 -> config
    messaging   ZMQ 이벤트 발행 믹스인  -> config
    face_auth   얼굴 인증 세션 믹스인   -> config, camera
    inspection  우산 검증 세션 믹스인   -> config
    service     OrinService (믹스인 조합 + 명령 루프) -> 위 전부
    preview     Flask 프리뷰 스트림    -> config, camera
"""
