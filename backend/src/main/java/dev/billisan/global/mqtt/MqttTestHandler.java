package dev.billisan.global.mqtt;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

@Component
public class MqttTestHandler {

	private static final Logger log = LoggerFactory.getLogger(MqttTestHandler.class);
	private static final String TEST_RESPONSE_TOPIC = "umbrella/test/response";

	private final MqttPublisher mqttPublisher;

	public MqttTestHandler(MqttPublisher mqttPublisher) {
		this.mqttPublisher = mqttPublisher;
	}

	@ServiceActivator(inputChannel = "mqttInputChannel")
	public void handle(Message<String> message) {
		log.info("MQTT 메시지 수신: {}", message.getPayload());
		mqttPublisher.publish(TEST_RESPONSE_TOPIC, "hello-raspberry");
	}
}
