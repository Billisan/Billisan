// 12-R에 STATION-001 API 계약 자체가 없다(PROJECT_GUIDE.md §4 — P1·NOT_ACTIVE_P0).
// 아래 형태는 사용자가 작성한 "커스텀 캠퍼스 지도" 스펙(2026-08-05)을 그대로 따른 잠정 구조 —
// 실제 GET /stations 계약이 정해지면 이 타입만 맞춰 바꾸면 되도록 최소한으로 유지한다.
export interface Station {
  id: number
  name: string
  x: number // 0~1 비율 좌표
  y: number // 0~1 비율 좌표
  availableCount: number
  description?: string
}
