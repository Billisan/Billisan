import type { WeatherForecast } from '../types/weather'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800
const HOUR_MS = 60 * 60 * 1000

// WEATHER-001(PROJECT_GUIDE.md §5.12) 대응 Mock. DEC-SF-003(공급자·호출 경계)가 여전히 미확정이라
// 실제 외부 공급자는 호출하지 않고, 문서에 정의된 대로 provider를 "UNDECIDED"로 고정한다.
// (2026-08-04 사용자 확인 — 위젯 UI는 목업대로 구현하되 실제 연동은 보류)
export function getShortTermWeather(): Promise<WeatherForecast> {
  const now = Date.now()
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        baseTime: new Date(now).toISOString(),
        items: [
          { forecastAt: new Date(now).toISOString(), precipitationProbability: 0, condition: 'CLOUDY' },
          { forecastAt: new Date(now + HOUR_MS).toISOString(), precipitationProbability: 10, condition: 'CLOUDY' },
          {
            forecastAt: new Date(now + 2 * HOUR_MS).toISOString(),
            precipitationProbability: 30,
            condition: 'CLOUDY',
          },
          { forecastAt: new Date(now + 3 * HOUR_MS).toISOString(), precipitationProbability: 60, condition: 'RAIN' },
          { forecastAt: new Date(now + 4 * HOUR_MS).toISOString(), precipitationProbability: 70, condition: 'RAIN' },
        ],
        provider: 'UNDECIDED',
      })
    }, delay)
  })
}
