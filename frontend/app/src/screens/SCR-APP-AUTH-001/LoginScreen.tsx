import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { login } from '../../api/authApi'
import Logo from '../../assets/logo.svg'
import { Button } from '../../components/common/Button'
import { TextField } from '../../components/common/TextField'
import { Screen } from '../../components/layout/Screen'
import { useAuthStore } from '../../store/useAuthStore'

// 와이어프레임 1~2번 페이지 기준. "비밀번호를 잊으셨나요?" 링크는 노션 DEC-SF-002 기준으로
// 넣지 않는다(2026-07-31 사용자 확인, PROJECT_GUIDE.md §12 참고).
export function LoginScreen() {
  const setAuth = useAuthStore((state) => state.setAuth)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: setAuth,
  })
  // 입력창을 고칠 때마다 reset()을 부르지 않는다 — 로그인 버튼을 다시 누르면 mutate()가 이전
  // 에러 상태를 자동으로 초기화하므로, 에러 문구는 재시도 시점에 자연스럽게 사라진다.
  const hasError = loginMutation.isError

  const handleLogin = () => {
    // mutate에 넘기는 { identifier, password }는 호출 시점에 동기적으로 값이 복사되므로,
    // 아래 setPassword('')는 진행 중인 요청에 영향을 주지 않는다. 응답을 기다렸다 지우면(onSettled)
    // 요청이 끝날 때까지 평문이 화면 상태에 남아있게 되어 "제출 직후 즉시 제거"(PROJECT_GUIDE.md
    // §9.3)라는 원칙에 맞지 않는다.
    loginMutation.mutate({ identifier, password })
    setPassword('')
  }

  return (
    <Screen>
      <View className="flex-1 justify-center gap-10 px-8">
        <View className="items-center gap-5">
          <Logo width={124} height={60} />
          <Text className="text-xl font-medium">빌리대학교</Text>
        </View>

        <View className="gap-6">
          <TextField
            label="이메일"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="이메일을 입력해주세요"
            hasError={hasError}
          />
          <TextField
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="비밀번호를 입력해주세요"
            hasError={hasError}
          />
          {hasError && (
            <Text className="text-sm font-medium text-error-text">계정 정보를 확인해주세요</Text>
          )}
        </View>

        <Button label="로그인" onPress={handleLogin} disabled={loginMutation.isPending} />
      </View>
    </Screen>
  )
}
