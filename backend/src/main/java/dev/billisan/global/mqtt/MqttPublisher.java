package dev.billisan.global.mqtt;

import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

@Component
public class MqttPublisher {

	private final MessageChannel mqttOutputChannel;

	public MqttPublisher(MessageChannel mqttOutputChannel) {
		this.mqttOutputChannel = mqttOutputChannel;
	}

	public void publish(String topic, String payload) {
		Message<String> message = MessageBuilder
			.withPayload(payload)
			.setHeader(MqttHeaders.TOPIC, topic)
			.build();
		mqttOutputChannel.send(message);
	}
}
