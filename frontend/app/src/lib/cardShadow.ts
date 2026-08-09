import type { ViewStyle } from 'react-native'

// 카드형 View에 공통으로 쓰는 은은한 그림자(2026-08-09, HomeScreen.tsx에서 처음 적용한 값을
// 공용화). iOS의 shadow* 계열과 Android의 elevation을 함께 줘야 두 플랫폼 모두에서 보인다.
export const cardShadow: ViewStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 2,
  elevation: 1,
}
