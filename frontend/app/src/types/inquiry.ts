// INQUIRY-001은 12-R 확정 13개 API에 속하지 않는 DEFERRED_NOT_CONTRACTED 항목이라, 아래 타입은
// 문서 계약이 아니라 이번 Phase에서 새로 설계한 잠정(Mock 전용) 구조다. 실제 API 계약이 정해지면
// 다시 맞춘다.
export interface InquiryRequest {
  type: string
  title: string
  content: string
}

export interface InquiryResponse {
  inquiryId: string
  submittedAt: string
}
