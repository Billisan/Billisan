import type { Station } from '../types/station'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// 가상 캠퍼스 곳곳에 흩어진 대여소 7개 — 초록(3개 이상)/노랑(1~2개)/빨강(0개) 케이스가
// 골고루 섞이도록 구성(2026-08-05 사용자 확인). 좌표는 src/assets/campus-map.svg의
// 건물·광장 배치에 맞춘 0~1 비율 값.
const MOCK_STATIONS: Station[] = [
  { id: 1, name: '정문', x: 0.5, y: 0.95, availableCount: 4, description: '캠퍼스 정문 앞 거치대' },
  { id: 2, name: '학생회관', x: 0.23, y: 0.23, availableCount: 2, description: '학생회관 1층 로비 옆' },
  { id: 3, name: '공학관', x: 0.77, y: 0.23, availableCount: 0, description: '공학관 정문 앞' },
  { id: 4, name: '중앙광장', x: 0.5, y: 0.5, availableCount: 5, description: '캠퍼스 중앙 광장' },
  { id: 5, name: '중앙도서관', x: 0.23, y: 0.78, availableCount: 1, description: '중앙도서관 1층' },
  { id: 6, name: '기숙사', x: 0.77, y: 0.78, availableCount: 3, description: '기숙사 정문 앞' },
  { id: 7, name: '후문', x: 0.5, y: 0.05, availableCount: 0, description: '캠퍼스 후문 앞 거치대' },
]

// STATION-001 대응 Mock. 실제 네트워크 호출 없음 — 나중에 실제 GET /stations로 교체하기 쉽도록
// 응답 형태(Station[])만 맞춰둔다.
export function getStations(): Promise<Station[]> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_STATIONS)
    }, delay)
  })
}
