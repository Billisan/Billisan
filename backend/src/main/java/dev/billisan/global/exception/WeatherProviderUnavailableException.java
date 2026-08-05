package dev.billisan.global.exception;

/** WEATHER-001 — 기상청 API 허브 호출 실패·비정상 응답 시. */
public class WeatherProviderUnavailableException extends RuntimeException {
    public WeatherProviderUnavailableException(String message) {
        super(message);
    }

    public WeatherProviderUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
