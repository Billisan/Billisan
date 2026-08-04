package dev.billisan.returns.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.billisan.global.exception.ActiveRentalNotFoundException;
import dev.billisan.global.exception.IdempotencyConflictException;
import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.global.mqtt.MqttPublisher;
import dev.billisan.global.response.ApiError;
import dev.billisan.returns.dto.ReturnAttemptRequest;
import dev.billisan.returns.dto.ReturnAttemptResponse;
import dev.billisan.returns.service.ReturnAttemptService;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

/** EDGE-RETURN-001 — 요청 메시지를 받아 반납 시도 생성을 처리하고 응답을 발행한다. */
@Component
public class ReturnAttemptRequestHandler {

    private static final Logger log = LoggerFactory.getLogger(ReturnAttemptRequestHandler.class);
    private static final Pattern REQUEST_TOPIC_PATTERN =
            Pattern.compile("^billisan/v1/stations/([^/]+)/edge/requests/EDGE-RETURN-001$");
    private static final String RESPONSE_TOPIC_TEMPLATE = "billisan/v1/stations/%s/edge/responses/EDGE-RETURN-001";

    private final ReturnAttemptService returnAttemptService;
    private final MqttPublisher mqttPublisher;
    private final ObjectMapper objectMapper;

    public ReturnAttemptRequestHandler(
            ReturnAttemptService returnAttemptService, MqttPublisher mqttPublisher, ObjectMapper objectMapper) {
        this.returnAttemptService = returnAttemptService;
        this.mqttPublisher = mqttPublisher;
        this.objectMapper = objectMapper;
    }

    @ServiceActivator(inputChannel = "returnAttemptRequestChannel")
    public void handle(Message<String> message) {
        String topic = (String) message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);
        Matcher matcher = REQUEST_TOPIC_PATTERN.matcher(topic == null ? "" : topic);
        if (!matcher.matches()) {
            log.warn("EDGE-RETURN-001 요청 토픽 형식이 올바르지 않습니다: {}", topic);
            return;
        }
        UUID stationId = UUID.fromString(matcher.group(1));

        ReturnAttemptRequest request;
        try {
            request = objectMapper.readValue(message.getPayload(), ReturnAttemptRequest.class);
        } catch (Exception e) {
            publishError(stationId, "INVALID_REQUEST", "요청 본문을 읽을 수 없습니다.");
            return;
        }

        try {
            ReturnAttemptResponse response =
                    returnAttemptService.requestReturn(request.requestId().toString(), request.userRef());
            publish(stationId, response);
        } catch (IdempotencyConflictException e) {
            publishError(stationId, "IDEMPOTENCY_CONFLICT", e.getMessage());
        } catch (UserNotFoundException e) {
            publishError(stationId, "USER_NOT_FOUND", e.getMessage());
        } catch (ActiveRentalNotFoundException e) {
            publishError(stationId, "ACTIVE_RENTAL_NOT_FOUND", e.getMessage());
        } catch (Exception e) {
            log.error("EDGE-RETURN-001 처리 중 예상치 못한 예외가 발생했습니다: stationId={}", stationId, e);
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
            log.error("EDGE-RETURN-001 응답 발행에 실패했습니다: stationId={}", stationId, e);
        }
    }
}
