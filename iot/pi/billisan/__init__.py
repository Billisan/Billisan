"""
Billisan Pi 서비스 패키지.

계층 구조 (의존은 위에서 아래로만 흐른다 - 순환 참조 방지):

    orin_client Orin ZeroMQ 클라이언트  (의존 없음)
    config      상수·로거          -> orin_client
    utils       순수 헬퍼           -> config
    runtime     프로세스 공유 상태   -> utils
    edge_client Spring MQTT 요청/응답 -> config, utils, runtime
    hardware    서보·홀센서·물리동작  -> config, utils
    session     Kiosk 세션 저장소    -> config, utils
    flows       업무 체인(인증/대여/반납) -> 위 전부
    kiosk_ws    Kiosk WebSocket 계층 -> 위 전부
    spring_mqtt Spring 명령 수신 처리 -> 위 전부
"""
