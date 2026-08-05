package dev.billisan.weather.service;

import dev.billisan.global.exception.WeatherProviderUnavailableException;
import dev.billisan.weather.dto.WeatherForecastResponse;
import dev.billisan.weather.dto.WeatherForecastResponse.Item;
import dev.billisan.weather.dto.WeatherForecastResponse.Item.Condition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 12-R WEATHER-001 — 기상청 API 허브 초단기예보 지점 조회(`getUltraSrtFcst`, typ02)를 역삼
 * (역삼역 인근) 고정 격자좌표로 호출한다(2026-08-04 팀 결정). Request의
 * {@code latitude}/{@code longitude}는 향후 다지점 확장을 위해 계약상 계속 받되, 현재
 * 구현은 사용하지 않고 항상 역삼 값을 반환한다 — P0는 대여소 1곳 데모라 위치 선택 UI 자체가
 * 없다.
 *
 * <p>발표시각은 매시 30분(예: 06:30)이고 API는 발표 후 약 10분 뒤부터 조회 가능해, 안전하게
 * 45분을 기준으로 최신 발표시각을 계산한다 — 그 전이면 직전 시간의 30분을 쓴다.
 */
@Service
public class WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter BASE_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter BASE_TIME_FORMAT = DateTimeFormatter.ofPattern("HHmm");
    private static final int PUBLISH_AVAILABLE_MINUTE = 45;

    private static final String CATEGORY_PRECIPITATION_PROBABILITY = "POP";
    private static final String CATEGORY_PRECIPITATION_TYPE = "PTY";
    private static final String CATEGORY_SKY = "SKY";

    private final RestClient restClient;
    private final String apiKey;
    private final int nx;
    private final int ny;

    public WeatherService(
            RestClient.Builder restClientBuilder,
            @Value("${weather.kma.base-url}") String baseUrl,
            @Value("${weather.kma.api-key:}") String apiKey,
            @Value("${weather.kma.nx}") int nx,
            @Value("${weather.kma.ny}") int ny) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.nx = nx;
        this.ny = ny;
    }

    public WeatherForecastResponse shortTerm(double latitude, double longitude) {
        LocalDateTime baseTime = latestBaseTime(LocalDateTime.now(KST));
        KmaForecastEnvelope envelope = fetch(baseTime);

        String resultCode = envelope.response() == null || envelope.response().header() == null
                ? null
                : envelope.response().header().resultCode();
        if (!"00".equals(resultCode)) {
            String resultMsg = envelope.response() == null || envelope.response().header() == null
                    ? "unknown"
                    : envelope.response().header().resultMsg();
            throw new WeatherProviderUnavailableException(
                    "기상청 API 응답 코드가 정상이 아닙니다: resultCode=%s, resultMsg=%s".formatted(resultCode, resultMsg));
        }

        List<KmaForecastEnvelope.Item> items = envelope.response().body() == null
                || envelope.response().body().items() == null
                || envelope.response().body().items().item() == null
                ? List.of()
                : envelope.response().body().items().item();

        return new WeatherForecastResponse(baseTime, toForecastItems(items), "KMA");
    }

    private KmaForecastEnvelope fetch(LocalDateTime baseTime) {
        String uri = UriComponentsBuilder.newInstance()
                .path("/getUltraSrtFcst")
                .queryParam("pageNo", 1)
                .queryParam("numOfRows", 1000)
                .queryParam("dataType", "JSON")
                .queryParam("base_date", BASE_DATE_FORMAT.format(baseTime))
                .queryParam("base_time", BASE_TIME_FORMAT.format(baseTime))
                .queryParam("nx", nx)
                .queryParam("ny", ny)
                .queryParam("authKey", apiKey)
                .build()
                .toUriString();

        try {
            KmaForecastEnvelope envelope = restClient.get().uri(uri).retrieve().body(KmaForecastEnvelope.class);
            if (envelope == null) {
                throw new WeatherProviderUnavailableException("기상청 API 응답 본문이 비어 있습니다.");
            }
            return envelope;
        } catch (WeatherProviderUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.warn("기상청 API 호출 실패({}): {}", e.getClass().getSimpleName(), e.getMessage());
            throw new WeatherProviderUnavailableException("기상청 API 호출에 실패했습니다.", e);
        }
    }

    /** 기상청 응답은 카테고리(POP/PTY/SKY/...)별로 행이 갈라져 오므로 fcstDate+fcstTime 기준으로 병합한다. */
    private List<Item> toForecastItems(List<KmaForecastEnvelope.Item> rawItems) {
        Map<String, Map<String, String>> byTimeSlot = new LinkedHashMap<>();
        for (KmaForecastEnvelope.Item item : rawItems) {
            String slotKey = item.fcstDate() + item.fcstTime();
            byTimeSlot.computeIfAbsent(slotKey, key -> new LinkedHashMap<>()).put(item.category(), item.fcstValue());
        }

        return byTimeSlot.entrySet().stream()
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .map(entry -> toItem(entry.getKey(), entry.getValue()))
                .toList();
    }

    private Item toItem(String slotKey, Map<String, String> categories) {
        LocalDateTime forecastAt = LocalDateTime.parse(slotKey, DateTimeFormatter.ofPattern("yyyyMMddHHmm"));
        int precipitationProbability = parseIntOrZero(categories.get(CATEGORY_PRECIPITATION_PROBABILITY));
        Condition condition = resolveCondition(categories.get(CATEGORY_PRECIPITATION_TYPE), categories.get(CATEGORY_SKY));
        return new Item(forecastAt, precipitationProbability, condition);
    }

    /** 기상청 PTY(강수형태)·SKY(하늘상태) 코드표 — 응답 계약의 5종 Condition으로 단순화한다. */
    private static Condition resolveCondition(String pty, String sky) {
        if (pty != null) {
            switch (pty) {
                case "1", "4", "5", "6" -> {
                    return Condition.RAIN;
                }
                case "2" -> {
                    return Condition.SNOW;
                }
                case "3", "7" -> {
                    return Condition.SNOW;
                }
                case "0" -> {
                    // 강수 없음 — 아래 SKY로 판단
                }
                default -> {
                    return Condition.UNKNOWN;
                }
            }
        }
        if (sky == null) {
            return Condition.UNKNOWN;
        }
        return switch (sky) {
            case "1" -> Condition.CLEAR;
            case "3", "4" -> Condition.CLOUDY;
            default -> Condition.UNKNOWN;
        };
    }

    private static int parseIntOrZero(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static LocalDateTime latestBaseTime(LocalDateTime nowKst) {
        LocalDateTime candidate = nowKst.withMinute(30).withSecond(0).withNano(0);
        if (nowKst.getMinute() < PUBLISH_AVAILABLE_MINUTE) {
            candidate = candidate.minusHours(1);
        }
        return candidate;
    }
}
