package dev.billisan.global.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

@Configuration
public class MqttConfig {

	@Value("${mqtt.broker-url}")
	private String brokerUrl;

	@Value("${mqtt.client-id}")
	private String clientId;

	/**
	 * EDGE-* 요청/응답 페이로드를 JSON으로 주고받는 MQTT 핸들러들이 공용으로 쓴다.
	 * JavaTimeModule 없이는 LocalDateTime 필드(예: EDGE-DEVICE-001의 occurredAt)
	 * 파싱이 실패한다 — EDGE-RENT-001은 날짜 필드가 없어서 지금까지 안 드러났다.
	 */
	@Bean
	public ObjectMapper objectMapper() {
		return new ObjectMapper()
				.registerModule(new JavaTimeModule())
				.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
	}

	@Bean
	public MqttPahoClientFactory mqttClientFactory() {
		DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
		MqttConnectOptions options = new MqttConnectOptions();
		options.setServerURIs(new String[] { brokerUrl });
		options.setCleanSession(true);
		options.setAutomaticReconnect(true);
		factory.setConnectionOptions(options);
		return factory;
	}

	@Bean
	public MessageChannel mqttOutputChannel() {
		return new DirectChannel();
	}

	@Bean
	@ServiceActivator(inputChannel = "mqttOutputChannel")
	public MessageHandler mqttOutbound() {
		MqttPahoMessageHandler messageHandler = new MqttPahoMessageHandler(
			clientId + "-pub",
			mqttClientFactory()
		);
		messageHandler.setAsync(true);
		messageHandler.setDefaultQos(1);
		return messageHandler;
	}
}
