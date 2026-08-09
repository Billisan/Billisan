import type { Station } from '../types/station'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// 가상 캠퍼스 곳곳에 흩어진 대여소 — 초록(3개 이상)/노랑(1~2개)/빨강(0개) 케이스가 골고루
// 섞이도록 구성. 좌표·이름은 사용자가 실기기 렌더링 기준으로 직접 조정한 값(2026-08-09).
const MOCK_STATIONS: Station[] = [
  { id: 1, name: '예술관', x: 0.26, y: 0.67, availableCount: 4, description: '예술관 앞' },
  { id: 2, name: '박물관', x: 0.55, y: 0.69, availableCount: 2, description: '박물관 1층 로비 옆' },
  { id: 3, name: '공학관', x: 0.63, y: 0.53, availableCount: 0, description: '공학관 정문 앞' },
  { id: 5, name: '중앙도서관', x: 0.48, y: 0.51, availableCount: 1, description: '중앙도서관 1층 입구' },
  { id: 6, name: '기숙사', x: 0.46, y: 0.14, availableCount: 3, description: '기숙사 정문 앞' },
  { id: 7, name: '강의동', x: 0.56, y: 0.33, availableCount: 0, description: '강의동 앞 거치대' },
  { id: 8, name: '체육관', x: 0.15, y: 0.48, availableCount: 3, description: '체육관 입구' },
  { id: 9, name: '인문관', x: 0.27, y: 0.56, availableCount: 1, description: '인문관 앞' },
  { id: 10, name: '산학협력관', x: 0.73, y: 0.50, availableCount: 0, description: '산학협력관 앞' },
  { id: 11, name: '경영관', x: 0.35, y: 0.48, availableCount: 2, description: '경영관 입구' },
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
