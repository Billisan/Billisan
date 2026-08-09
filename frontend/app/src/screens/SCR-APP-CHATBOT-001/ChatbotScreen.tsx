import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useMutation } from '@tanstack/react-query'
import * as Crypto from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated'
import { sendChatbotMessage } from '../../api/chatbotApi'
import { Screen } from '../../components/layout/Screen'
import type { RootStackParamList } from '../../navigation/RootStackNavigator'
import type { ChatbotActionType } from '../../types/chatbot'
import { CHATBOT_ACTION_TYPE, CHATBOT_ERROR_CODE } from '../../types/chatbot'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  action?: { type: ChatbotActionType; label: string }
  fallback?: boolean
}

// P0 지원 Intent 6종(PROJECT_GUIDE.md §6)과 1:1 대응하는 추천 질문.
const SUGGESTED_QUESTIONS = [
  '우산 대여는 어떻게 하나요?',
  '반납은 어떻게 하나요?',
  '대여 기간을 연장하고 싶어요',
  '우산을 분실했어요',
  '미정산 금액이 있나요?',
  '가까운 대여소를 알려주세요',
]

// INITIAL 화면 인사 문구(목업 반영, 2026-08-05 사용자 확인) — CHATBOT-001 응답이 아닌 화면 로컬 상수.
const GREETING_MESSAGE =
  '안녕하세요, 빌리예요! 우산 대여 서비스 이용 중 궁금하신 점을 무엇이든 도와드릴게요.'

// 서버 타임스탬프가 없어(§5.13) 화면 진입 시각을 그대로 표시(사용자 확인, 2026-08-05).
function formatTimeLabel(date: Date) {
  const hours = date.getHours()
  const period = hours < 12 ? '오전' : '오후'
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  const displayMinutes = date.getMinutes().toString().padStart(2, '0')
  return `오늘, ${period} ${displayHour}:${displayMinutes}`
}

// SCR-APP-CHATBOT-001(app-screen-flow.md §2.9). 대화 이력은 이 컴포넌트의 로컬 state에만 유지되고
// 화면을 벗어나면 사라진다(§6 "영속 저장 금지" 원칙).
export function ChatbotScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [errorState, setErrorState] = useState<'timeout' | 'error' | null>(null)
  const [sessionStartedAt] = useState(() => new Date())
  // KeyboardAvoidingView의 Android 'height' behavior가 동작하지 않아(edge-to-edge 상태에서 RN 코어의
  // Keyboard 이벤트가 불안정한 게 흔한 원인) reanimated의 네이티브 키보드 인셋 추적으로 교체(2026-08-05).
  // 새 라이브러리 추가가 아니라 이미 package.json에 있는 react-native-reanimated를 처음 사용하는 것.
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true })
  const keyboardAvoidingStyle = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }))
  const scrollViewRef = useRef<ScrollView>(null)

  // 새 메시지가 쌓이거나(onContentSizeChange) 키보드가 올라올 때(keyboardDidShow) 최신 대화가
  // 화면 밖으로 가려지지 않도록 맨 아래로 스크롤한다(2026-08-09 코드 리뷰 반영).
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    })
    return () => subscription.remove()
  }, [])

  const mutation = useMutation({
    mutationFn: sendChatbotMessage,
    onSuccess: (response) => {
      setErrorState(null)
      setMessages((prev) => [
        ...prev,
        {
          id: response.messageId,
          role: 'assistant',
          text: response.answer,
          action: response.action,
          fallback: response.fallback,
        },
      ])
    },
    onError: (error: Error) => {
      setErrorState(
        error.message === CHATBOT_ERROR_CODE.CHATBOT_PROVIDER_TIMEOUT ? 'timeout' : 'error',
      )
    },
  })

  const handleSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || mutation.isPending) {
      return
    }

    setMessages((prev) => [...prev, { id: Crypto.randomUUID(), role: 'user', text: trimmed }])
    setInput('')
    setErrorState(null)
    mutation.mutate({ requestId: Crypto.randomUUID(), message: trimmed })
  }

  const handleRetry = () => {
    if (mutation.isPending) {
      return
    }
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    if (!lastUserMessage) {
      return
    }
    setErrorState(null)
    mutation.mutate({ requestId: Crypto.randomUUID(), message: lastUserMessage.text })
  }

  const goToInquiry = () => {
    navigation.navigate('Tabs', { screen: 'MyPage', params: { screen: 'Inquiry' } })
  }

  const handleAction = (action: { type: ChatbotActionType; label: string }) => {
    if (action.type === CHATBOT_ACTION_TYPE.OPEN_MY_PAGE) {
      navigation.navigate('Tabs', { screen: 'MyPage', params: { screen: 'MyPageHome' } })
      return
    }
    if (action.type === CHATBOT_ACTION_TYPE.OPEN_INQUIRY) {
      goToInquiry()
      return
    }
    if (action.type === CHATBOT_ACTION_TYPE.OPEN_HISTORY) {
      navigation.navigate('Tabs', { screen: 'History' })
      return
    }
    // OPEN_MAP(Phase 8 지도)은 대상 화면이 아직 없어 버튼만 두고 라우팅은 자리만 둔다.
  }

  return (
    <Screen background="white" edges={['right', 'bottom', 'left']}>
      <Animated.View style={[{ flex: 1 }, keyboardAvoidingStyle]}>
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerClassName="gap-4 px-6 py-6"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <View className="self-center rounded-full bg-background px-3 py-1">
            <Text className="text-xs text-text-secondary">{formatTimeLabel(sessionStartedAt)}</Text>
          </View>

          <View className="max-w-[85%] self-start rounded-3xl rounded-tl-none bg-background px-4 py-3">
            <Text className="text-base text-text">{GREETING_MESSAGE}</Text>
          </View>

          <View className="self-start rounded-2xl border border-disabled bg-white">
            {SUGGESTED_QUESTIONS.map((question, index) => (
              <Pressable
                key={question}
                onPress={() => handleSend(question)}
                className={`px-3 py-3 active:opacity-60 ${
                  index < SUGGESTED_QUESTIONS.length - 1 ? 'border-b border-disabled' : ''
                }`}
              >
                <Text className="text-base text-text">{question}</Text>
              </Pressable>
            ))}
          </View>

          {messages.map((message) => (
            <View
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'self-end rounded-tr-none bg-primary'
                  : 'self-start rounded-tl-none bg-background'
              }`}
            >
              <Text className="text-lg text-text">{message.text}</Text>
              {message.fallback && (
                <Text className="mt-1 text-xs text-text-secondary">정적 안내로 답변드렸어요</Text>
              )}
              {message.role === 'assistant' &&
                message.action &&
                message.action.type !== CHATBOT_ACTION_TYPE.NONE && (
                  <Pressable
                    onPress={() => handleAction(message.action!)}
                    className="mt-2 flex-row items-center gap-1 self-start rounded-full border border-disabled bg-white px-3 py-2 active:opacity-70"
                  >
                    <Text className="text-xs font-bold text-text">{message.action.label}</Text>
                    <Text className="text-xs font-bold text-text">→</Text>
                  </Pressable>
                )}
            </View>
          ))}

          {mutation.isPending && (
            <View className="max-w-[85%] self-start rounded-2xl bg-secondary px-4 py-3">
              <Text className="text-sm text-text-secondary">답변을 준비하고 있어요...</Text>
            </View>
          )}

          {errorState && (
            <View className="gap-2 rounded-2xl bg-error-bg px-4 py-3">
              <Text className="text-sm font-medium text-error-text">
                {errorState === 'timeout' ? '응답이 지연되고 있어요' : '답변을 받지 못했어요'}
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleRetry}
                  disabled={mutation.isPending}
                  className={`rounded-full bg-error-cta px-4 py-2 ${
                    mutation.isPending ? 'opacity-40' : 'active:opacity-80'
                  }`}
                >
                  <Text className="text-xs font-bold text-white">다시 시도</Text>
                </Pressable>
                <Pressable
                  onPress={goToInquiry}
                  className="rounded-full border border-disabled px-4 py-2 active:opacity-70"
                >
                  <Text className="text-xs font-bold text-text">문의하기</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        <View className="flex-row items-center gap-2 border-t border-disabled p-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="궁금한 점을 물어보세요"
            editable={!mutation.isPending}
            className="flex-1 rounded-full border border-disabled p-3 text-base text-text"
          />
          <Pressable
            onPress={() => handleSend(input)}
            disabled={mutation.isPending || input.trim() === ''}
            className={`items-center justify-center rounded-full bg-primary p-3 ${
              mutation.isPending || input.trim() === '' ? 'opacity-40' : 'active:opacity-80'
            }`}
          >
            <MaterialCommunityIcons name="send" size={20} color="#1E2A38" />
          </Pressable>
        </View>
      </Animated.View>
    </Screen>
  )
}
