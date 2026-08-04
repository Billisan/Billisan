// WEATHER-001 응답 (PROJECT_GUIDE.md §5.12) 그대로.
export type WeatherCondition = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' | 'UNKNOWN'

export interface WeatherForecastItem {
  forecastAt: string
  precipitationProbability: number
  condition: WeatherCondition
}

export interface WeatherForecast {
  baseTime: string
  items: WeatherForecastItem[]
  provider: string
}
