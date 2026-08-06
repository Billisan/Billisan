package dev.billisan.user.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.global.mqtt.MqttPublisher;
import dev.billisan.global.response.ApiError;
import dev.billisan.user.dto.AuthResultRequest;
import dev.billisan.user.dto.AuthResultResponse;
import dev.billisan.user.service.AuthResultLookupService;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

/** EDGE-AUTH-001 — 얼굴 인증 직후 userRef로 표시정보·서비스 자격을 조회해 응답을 발행한다(조회 전용, 상태 변경 없음). */
@Component
public class AuthResultRequestHandler {

    private static final Logger log = LoggerFactory.getLogger(AuthResultRequestHandler.class);
    private static final Pattern REQUEST_TOPIC_PATTERN =
            Pattern.compile("^billisan/v1/stations/([^/]+)/edge/requests/EDGE-AUTH-001$");
    private static final String RESPONSE_TOPIC_TEMPLATE = "billisan/v1/stations/%s/edge/responses/EDGE-AUTH-001";

    private final AuthResultLookupService authResultLookupService;
    private final MqttPublisher mqttPublisher;
    private final ObjectMapper objectMapper;

    public AuthResultRequestHandler(
            AuthResultLookupService authResultLookupService, MqttPublisher mqttPublisher, ObjectMapper objectMapper) {
        this.authResultLookupService = authResultLookupService;
        this.mqttPublisher = mqttPublisher;
        this.objectMapper = objectMapper;
    }

    @ServiceActivator(inputChannel = "authResultRequestChannel")
    public void handle(Message<String> message) {
        String topic = (String) message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);
        Matcher matcher = REQUEST_TOPIC_PATTERN.matcher(topic == null ? "" : topic);
        if (!matcher.matches()) {
            log.warn("EDGE-AUTH-001 요청 토픽 형식이 올바르지 않습니다: {}", topic);
            return;
        }
        UUID stationId = UUID.fromString(matcher.group(1));

        AuthResultRequest request;
        try {
            request = objectMapper.readValue(message.getPayload(), AuthResultRequest.class);
        } catch (Exception e) {
            publishError(stationId, "INVALID_REQUEST", "요청 본문을 읽을 수 없습니다.");
            return;
        }

        try {
            AuthResultResponse response = authResultLookupService.lookup(request.userRef());
            publish(stationId, response);
        } catch (UserNotFoundException e) {
            publishError(stationId, "USER_NOT_FOUND", e.getMessage());
        } catch (Exception e) {
            log.error("EDGE-AUTH-001 처리 중 예상치 못한 예외가 발생했습니다: stationId={}", stationId, e);
            publishError(stationId, "INTERNAL_ERROR", "일시적인 오류가 발생했습니다.");
        }
    }

    private void publishError(UUID stationId, String code, String message) {
        publish(stationId, new ApiError(code, message));
    }

    private void publish(UUID stationId, Object body) {
        try {
            String topic = RESPONSE_TOPIC_TEMPLATE.formatted(stationId);
            mqttPublisher.publish(topic, objectMapper.writeValueAsString(body));
        } catch (Exception e) {
            log.error("EDGE-AUTH-001 응답 발행에 실패했습니다: stationId={}", stationId, e);
        }
    }
}
