// USER-001(PROJECT_GUIDE.md §5.3) 공식 응답: userId, displayName, schoolName만 반환하고
// studentNumber는 응답하지 않는다고 명시되어 있다. 다만 마이페이지 목업 확인 후 화면에
// 학번 표시가 필요하다고 사용자가 확인해서(2026-08-04), Mock에 한해 studentNumber를 임시로
// 추가한다 — 실제 계약에 포함되면 그때 정식 반영한다.
export interface MyPageProfile {
  userId: string
  displayName: string
  schoolName: string
  studentNumber: string
}
