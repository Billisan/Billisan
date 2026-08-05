import type { AlertItem } from '../types/alert'
import { ALERT_ACTION_TYPE, ALERT_TYPE } from '../types/alert'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// 5개 type 각 1건씩 구성, 그중 일부는 action이 있는 케이스로(§5.11 action.type 3종 확인용).
const MOCK_ITEMS: AlertItem[] = [
  {
    alertKey: 'RENTAL_DUE_SOON:mock-rental-001',
    type: ALERT_TYPE.RENTAL_DUE_SOON,
    title: '반납 기한이 얼마 남지 않았어요',
    message: '중앙도서관 1층에서 대여한 우산의 반납 기한이 1시간 남았어요.',
    occurredAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    action: { type: ALERT_ACTION_TYPE.NONE, targetId: null },
  },
  {
    alertKey: 'UNSETTLED:mock-settlement-001',
    type: ALERT_TYPE.UNSETTLED,
    title: '미정산 금액이 있어요',
    message: '연체료 3,000원이 정산되지 않았어요. 마이페이지에서 결제해주세요.',
    occurredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    action: { type: ALERT_ACTION_TYPE.OPEN_MY_PAGE, targetId: 'mock-settlement-001' },
  },
  {
    alertKey: 'RETURN_COMPLETED:mock-rental-002',
    type: ALERT_TYPE.RETURN_COMPLETED,
    title: '반납이 완료됐어요',
    message: '학생회관 앞에 우산을 반납했어요. 이용해주셔서 감사해요.',
    occurredAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    action: { type: ALERT_ACTION_TYPE.OPEN_HISTORY, targetId: 'mock-rental-002' },
  },
  {
    alertKey: 'ADMIN_REVIEW:mock-rental-004',
    type: ALERT_TYPE.ADMIN_REVIEW,
    title: '관리자 확인이 진행 중이에요',
    message: '신고하신 우산 파손 건을 관리자가 확인하고 있어요.',
    occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    action: { type: ALERT_ACTION_TYPE.OPEN_MY_PAGE, targetId: 'mock-rental-004' },
  },
  {
    alertKey: 'RECOVERY_REQUIRED:mock-rental-005',
    type: ALERT_TYPE.RECOVERY_REQUIRED,
    title: '회수가 필요해요',
    message: '반납 실패로 회수가 필요한 우산이 있어요.',
    occurredAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    action: { type: ALERT_ACTION_TYPE.NONE, targetId: null },
  },
]

// ALERT-001(PROJECT_GUIDE.md §5.11) 대응 Mock. 실제 네트워크 호출 없음.
export function getAlerts(): Promise<AlertItem[]> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_ITEMS)
    }, delay)
  })
}
