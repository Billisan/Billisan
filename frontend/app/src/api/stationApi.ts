import type { Station } from '../types/station'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// 가상 캠퍼스 곳곳에 흩어진 대여소 10개 — 초록(3개 이상)/노랑(1~2개)/빨강(0개) 케이스가
// 골고루 섞이도록 구성. 좌표는 src/assets/campus-map.svg(2026-08-06 변경본)의 실제 건물
// 도형 bounding box 중심을 viewBox(912x1300) 기준 0~1 비율로 환산한 값(2026-08-06 확인).
// SVG에 '후문' 라벨이 없어(북문·동문만 존재) 후문 대여소는 제외하고, 강의동·체육관·
// 인문관·AI 연구관을 새 대여소로 추가(2026-08-06 사용자 확인).
const MOCK_STATIONS: Station[] = [
  { id: 1, name: '정문', x: 0.5, y: 0.96, availableCount: 4, description: '캠퍼스 정문 앞 거치대' },
  { id: 2, name: '학생회관', x: 0.83, y: 0.45, availableCount: 2, description: '학생회관 1층 로비 옆' },
  { id: 3, name: '공학관', x: 0.59, y: 0.39, availableCount: 0, description: '공학관 정문 앞' },
  { id: 4, name: '중앙광장', x: 0.72, y: 0.58, availableCount: 5, description: '캠퍼스 중앙 광장' },
  { id: 5, name: '중앙도서관', x: 0.52, y: 0.16, availableCount: 1, description: '중앙도서관 1층' },
  { id: 6, name: '기숙사', x: 0.82, y: 0.07, availableCount: 3, description: '기숙사 정문 앞' },
  { id: 7, name: '강의동', x: 0.52, y: 0.78, availableCount: 0, description: '강의동 앞 거치대' },
  { id: 8, name: '체육관', x: 0.86, y: 0.78, availableCount: 3, description: '체육관 입구' },
  { id: 9, name: '인문관', x: 0.37, y: 0.37, availableCount: 1, description: '인문관 앞' },
  { id: 10, name: 'AI 연구관', x: 0.91, y: 0.21, availableCount: 0, description: 'AI 연구관 앞' },
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
