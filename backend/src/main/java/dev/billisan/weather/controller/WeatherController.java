package dev.billisan.weather.controller;

import dev.billisan.weather.dto.WeatherForecastResponse;
import dev.billisan.weather.service.WeatherService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class WeatherController {

    private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    @GetMapping("/api/v1/weather/short-term")
    public ResponseEntity<WeatherForecastResponse> getShortTerm(
            @RequestHeader("X-Request-Id") UUID requestId,
            @RequestParam double latitude,
            @RequestParam double longitude) {
        return ResponseEntity.ok(weatherService.shortTerm(latitude, longitude));
    }
}
