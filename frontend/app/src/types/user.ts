// USER-001(PROJECT_GUIDE.md §5.3) 공식 응답: userId, displayName, schoolName만 반환한다.
// 2026-08-04에 마이페이지 목업 확인 후 Mock에 한해 studentNumber를 임시로 표시했었으나,
// 2026-08-06 실제 서버 연동 확인 결과 studentNumber가 응답에 없어 화면 표시를 제거했다
// (사용자 확인, MyPageScreen.tsx 참고).
export interface MyPageProfile {
  userId: string
  displayName: string
  schoolName: string
}
