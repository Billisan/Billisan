// INQUIRY-001은 12-R 확정 13개 API에 속하지 않는 DEFERRED_NOT_CONTRACTED 항목이라, 아래 타입은
// 문서 계약이 아니라 이번 Phase에서 새로 설계한 잠정(Mock 전용) 구조다. 실제 API 계약이 정해지면
// 다시 맞춘다.
// 문의 유형은 실제 연장(EXTENSION)·신고(INCIDENT) 기능 구현이 아니라 문의 내용을 분류하는
// 카테고리 라벨일 뿐이다(해당 기능 자체는 여전히 DEFERRED_NOT_CONTRACTED).
export const INQUIRY_TYPES = [
  '대여/반납 문의',
  '반납기한 연장',
  '분실/파손 신고',
  '결제/정산 문의',
  '대여소/시설 문의',
  '계정/로그인 문의',
  '기타',
] as const

export type InquiryType = (typeof INQUIRY_TYPES)[number]

export interface InquiryRequest {
  type: string
  title: string
  content: string
}

export interface InquiryResponse {
  inquiryId: string
  submittedAt: string
}
