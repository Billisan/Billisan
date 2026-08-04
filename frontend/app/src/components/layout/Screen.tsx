import type { ReactNode } from 'react'
import type { Edge } from 'react-native-safe-area-context'
import { SafeAreaView } from 'react-native-safe-area-context'

interface ScreenProps {
  children: ReactNode
  background?: 'default' | 'white'
  edges?: readonly Edge[]
}

// 하단 탭 화면(홈/지도/내역조회/마이페이지)과 로그인 화면만 bg-background(연한 회색)를 쓰고,
// 그 외 화면(문의하기 등)은 background="white"로 흰 배경을 쓴다(2026-08-04 사용자 확인).
// edges: AppHeader를 쓰는 화면(홈/마이페이지)은 상단 세이프 에어리어를 AppHeader가 직접 흰 배경으로
// 채우므로 Screen에서는 top을 빼고 넘긴다(그래야 헤더 흰 배경이 상태바 영역까지 이어짐).
export function Screen({ children, background = 'default', edges = ['top', 'right', 'bottom', 'left'] }: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 ${background === 'white' ? 'bg-white' : 'bg-background'}`}
    >
      {children}
    </SafeAreaView>
  )
}
