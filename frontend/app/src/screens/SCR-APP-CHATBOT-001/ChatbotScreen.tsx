import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
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

let requestSeq = 0

// SCR-APP-CHATBOT-001(app-screen-flow.md §2.9). 대화 이력은 이 컴포넌트의 로컬 state에만 유지되고
// 화면을 벗어나면 사라진다(§6 "영속 저장 금지" 원칙).
export function ChatbotScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [errorState, setErrorState] = useState<'timeout' | 'error' | null>(null)

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
      setErrorState(error.message === CHATBOT_ERROR_CODE.CHATBOT_PROVIDER_TIMEOUT ? 'timeout' : 'error')
    },
  })

  const handleSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || mutation.isPending) {
      return
    }

    requestSeq += 1
    setMessages((prev) => [...prev, { id: `user-${requestSeq}`, role: 'user', text: trimmed }])
    setInput('')
    setErrorState(null)
    mutation.mutate({ requestId: `mock-request-${requestSeq}`, message: trimmed })
  }

  const handleRetry = () => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    if (!lastUserMessage) {
      return
    }
    requestSeq += 1
    setErrorState(null)
    mutation.mutate({ requestId: `mock-request-${requestSeq}`, message: lastUserMessage.text })
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
    // OPEN_HISTORY(Phase 8)·OPEN_MAP(Phase 9)은 대상 화면이 아직 없어 버튼만 두고 라우팅은 자리만 둔다.
  }

  return (
    <Screen background="white">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 py-6">
          {messages.length === 0 && (
            <View className="gap-3">
              <Text className="text-base font-bold text-text">무엇을 도와드릴까요?</Text>
              <View className="flex-row flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <Pressable
                    key={question}
                    onPress={() => handleSend(question)}
                    className="rounded-full border border-disabled px-4 py-2 active:opacity-70"
                  >
                    <Text className="text-sm text-text">{question}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((message) => (
            <View
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user' ? 'self-end bg-primary' : 'self-start bg-secondary'
              }`}
            >
              <Text className="text-sm text-text">{message.text}</Text>
              {message.fallback && (
                <Text className="mt-1 text-xs text-text-secondary">정적 안내로 답변드렸어요</Text>
              )}
              {message.role === 'assistant' &&
                message.action &&
                message.action.type !== CHATBOT_ACTION_TYPE.NONE && (
                  <Pressable
                    onPress={() => handleAction(message.action!)}
                    className="mt-2 self-start rounded-full bg-white px-3 py-2 active:opacity-70"
                  >
                    <Text className="text-xs font-bold text-text">{message.action.label}</Text>
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
                  className="rounded-full bg-error-cta px-4 py-2 active:opacity-80"
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

        <View className="flex-row items-center gap-2 border-t border-disabled px-4 py-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="궁금한 점을 물어보세요"
            editable={!mutation.isPending}
            className="flex-1 rounded-full border border-disabled px-4 py-3 text-base text-text"
          />
          <Pressable
            onPress={() => handleSend(input)}
            disabled={mutation.isPending || input.trim() === ''}
            className={`items-center justify-center rounded-full p-3 ${
              mutation.isPending || input.trim() === '' ? 'bg-disabled' : 'bg-primary active:opacity-80'
            }`}
          >
            <MaterialCommunityIcons name="send" size={20} color="#1E2A38" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}
