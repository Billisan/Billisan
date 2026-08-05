package dev.billisan.weather.service;

import java.util.List;

/**
 * 기상청 API 허브 typ02(VilageFcstInfoService_2.0) 공통 응답 봉투 — getUltraSrtFcst 외
 * getVilageFcst·getUltraSrtNcst도 동일 구조를 쓴다(기상청 공공데이터 표준 Envelope).
 */
public record KmaForecastEnvelope(Response response) {

    public record Response(Header header, Body body) {
    }

    public record Header(String resultCode, String resultMsg) {
    }

    public record Body(Items items) {
    }

    public record Items(List<Item> item) {
    }

    public record Item(String category, String fcstDate, String fcstTime, String fcstValue) {
    }
}
