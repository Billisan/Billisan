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
  const hasError = loginMutation.isError

  const handleLogin = () => {
    loginMutation.mutate(
      { identifier, password },
      {
        // 비밀번호는 성공·실패 관계없이 요청 직후 즉시 비운다(PROJECT_GUIDE.md §9.3).
        onSettled: () => setPassword(''),
      },
    )
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
            onChangeText={(value) => {
              setIdentifier(value)
              loginMutation.reset()
            }}
            placeholder="이메일을 입력해주세요"
            hasError={hasError}
          />
          <TextField
            label="비밀번호"
            value={password}
            onChangeText={(value) => {
              setPassword(value)
              loginMutation.reset()
            }}
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
