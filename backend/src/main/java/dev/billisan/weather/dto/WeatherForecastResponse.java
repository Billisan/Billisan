package dev.billisan.weather.dto;

import java.time.LocalDateTime;
import java.util.List;

/** 12-R WEATHER-001(`PROVISIONAL_API`) 응답 계약. */
public record WeatherForecastResponse(LocalDateTime baseTime, List<Item> items, String provider) {

    public record Item(LocalDateTime forecastAt, int precipitationProbability, Condition condition) {
        public enum Condition {
            CLEAR, CLOUDY, RAIN, SNOW, UNKNOWN
        }
    }
}
