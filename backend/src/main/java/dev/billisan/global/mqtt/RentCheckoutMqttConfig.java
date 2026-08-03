package dev.billisan.global.mqtt;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;

/** EDGE-RENT-001 요청 토픽 구독. 기존 {@link MqttConfig}의 테스트 토픽/채널과는 분리한다. */
@Configuration
public class RentCheckoutMqttConfig {

    private static final String REQUEST_TOPIC = "billisan/v1/stations/+/edge/requests/EDGE-RENT-001";

    private final MqttPahoClientFactory mqttClientFactory;
    private final String clientId;

    public RentCheckoutMqttConfig(
            MqttPahoClientFactory mqttClientFactory,
            @Value("${mqtt.client-id}") String clientId) {
        this.mqttClientFactory = mqttClientFactory;
        this.clientId = clientId;
    }

    @Bean
    public MessageChannel rentCheckoutRequestChannel() {
        return new DirectChannel();
    }

    @Bean
    public MqttPahoMessageDrivenChannelAdapter rentCheckoutRequestInboundAdapter() {
        MqttPahoMessageDrivenChannelAdapter adapter = new MqttPahoMessageDrivenChannelAdapter(
                clientId + "-rent-checkout-sub",
                mqttClientFactory,
                REQUEST_TOPIC);
        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(rentCheckoutRequestChannel());
        return adapter;
    }
}
