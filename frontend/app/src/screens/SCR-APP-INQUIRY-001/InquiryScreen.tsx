import { useNavigation } from '@react-navigation/native'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { submitInquiry } from '../../api/inquiryApi'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { SelectField } from '../../components/common/SelectField'
import { TextField } from '../../components/common/TextField'
import { Screen } from '../../components/layout/Screen'
import { INQUIRY_TYPES } from '../../types/inquiry'

// INQUIRY-001은 12-R 미확정(DEFERRED_NOT_CONTRACTED) — types/inquiry.ts·api/inquiryApi.ts 주석 참고.
export function InquiryScreen() {
  const navigation = useNavigation()
  const [type, setType] = useState('')
  const [typePickerVisible, setTypePickerVisible] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const inquiryMutation = useMutation({
    mutationFn: submitInquiry,
    onSuccess: () => setSubmitted(true),
  })

  const hasEmptyField = type.trim() === '' || title.trim() === '' || content.trim() === ''

  const handleSubmit = () => {
    setAttemptedSubmit(true)
    if (hasEmptyField) {
      return
    }
    inquiryMutation.mutate({ type, title, content })
  }

  if (submitted) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-lg font-bold text-text">문의가 접수됐어요</Text>
          <Text className="text-center text-sm text-text-secondary">
            확인 후 순차적으로 답변드릴게요.
          </Text>
          <Button label="마이페이지로 돌아가기" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 py-6">
        <SelectField
          label="유형"
          value={type}
          options={INQUIRY_TYPES}
          onSelect={setType}
          placeholder="문의 유형을 선택해주세요"
          hasError={attemptedSubmit && type.trim() === ''}
          visible={typePickerVisible}
          onOpen={() => setTypePickerVisible(true)}
          onClose={() => setTypePickerVisible(false)}
        />
        <TextField
          label="제목"
          value={title}
          onChangeText={setTitle}
          placeholder="제목을 입력해주세요"
          hasError={attemptedSubmit && title.trim() === ''}
        />
        <TextField
          label="내용"
          value={content}
          onChangeText={setContent}
          placeholder="문의 내용을 입력해주세요"
          multiline
          numberOfLines={12}
          hasError={attemptedSubmit && content.trim() === ''}
        />
        {attemptedSubmit && hasEmptyField && (
          <Text className="text-sm font-medium text-error-text">
            유형·제목·내용을 모두 입력해주세요
          </Text>
        )}
        {inquiryMutation.isError && <ErrorBanner message="문의 접수에 실패했어요. 다시 시도해주세요" />}
        <Button label="문의하기" onPress={handleSubmit} disabled={inquiryMutation.isPending} />
      </ScrollView>
    </Screen>
  )
}
