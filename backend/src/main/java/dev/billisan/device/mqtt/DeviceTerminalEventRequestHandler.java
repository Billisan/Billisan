package dev.billisan.device.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.billisan.device.dto.DeviceTerminalEventRequest;
import dev.billisan.device.dto.DeviceTerminalEventResponse;
import dev.billisan.device.service.DeviceTerminalEventService;
import dev.billisan.global.exception.RentalNotFoundException;
import dev.billisan.global.exception.UnsupportedDeviceEventException;
import dev.billisan.global.mqtt.MqttPublisher;
import dev.billisan.global.response.ApiError;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

/** EDGE-DEVICE-001 — 요청 메시지를 받아 장치 Terminal 이벤트를 처리하고 응답을 발행한다. */
@Component
public class DeviceTerminalEventRequestHandler {

    private static final Logger log = LoggerFactory.getLogger(DeviceTerminalEventRequestHandler.class);
    private static final Pattern REQUEST_TOPIC_PATTERN =
            Pattern.compile("^billisan/v1/stations/([^/]+)/edge/requests/EDGE-DEVICE-001$");
    private static final String RESPONSE_TOPIC_TEMPLATE = "billisan/v1/stations/%s/edge/responses/EDGE-DEVICE-001";

    private final DeviceTerminalEventService deviceTerminalEventService;
    private final MqttPublisher mqttPublisher;
    private final ObjectMapper objectMapper;

    public DeviceTerminalEventRequestHandler(
            DeviceTerminalEventService deviceTerminalEventService,
            MqttPublisher mqttPublisher,
            ObjectMapper objectMapper) {
        this.deviceTerminalEventService = deviceTerminalEventService;
        this.mqttPublisher = mqttPublisher;
        this.objectMapper = objectMapper;
    }

    @ServiceActivator(inputChannel = "deviceTerminalEventRequestChannel")
    public void handle(Message<String> message) {
        String topic = (String) message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);
        Matcher matcher = REQUEST_TOPIC_PATTERN.matcher(topic == null ? "" : topic);
        if (!matcher.matches()) {
            log.warn("EDGE-DEVICE-001 요청 토픽 형식이 올바르지 않습니다: {}", topic);
            return;
        }
        UUID stationId = UUID.fromString(matcher.group(1));

        DeviceTerminalEventRequest request;
        try {
            request = objectMapper.readValue(message.getPayload(), DeviceTerminalEventRequest.class);
        } catch (Exception e) {
            publishError(stationId, "INVALID_REQUEST", "요청 본문을 읽을 수 없습니다.");
            return;
        }

        try {
            DeviceTerminalEventResponse response = deviceTerminalEventService.recordTerminalEvent(request);
            publish(stationId, response);
        } catch (RentalNotFoundException e) {
            publishError(stationId, "RENTAL_NOT_FOUND", e.getMessage());
        } catch (UnsupportedDeviceEventException e) {
            publishError(stationId, "UNSUPPORTED_DEVICE_EVENT", e.getMessage());
        } catch (Exception e) {
            log.error("EDGE-DEVICE-001 처리 중 예상치 못한 예외가 발생했습니다: stationId={}", stationId, e);
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
            log.error("EDGE-DEVICE-001 응답 발행에 실패했습니다: stationId={}", stationId, e);
        }
    }
}
