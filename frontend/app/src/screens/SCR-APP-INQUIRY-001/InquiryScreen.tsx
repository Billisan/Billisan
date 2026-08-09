import { useNavigation } from '@react-navigation/native'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { submitInquiry } from '../../api/inquiryApi'
import { Button } from '../../components/common/Button'
import { ConfirmModal } from '../../components/common/ConfirmModal'
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
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)

  const inquiryMutation = useMutation({
    mutationFn: submitInquiry,
    onSuccess: () => {
      setConfirmModalVisible(false)
      navigation.goBack()
    },
    onError: () => setConfirmModalVisible(false),
  })

  const hasEmptyField = type.trim() === '' || title.trim() === '' || content.trim() === ''

  const handleSubmit = () => {
    setAttemptedSubmit(true)
    if (hasEmptyField) {
      return
    }
    setConfirmModalVisible(true)
  }

  return (
    <Screen background="white" edges={['right', 'bottom', 'left']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 pt-10">
        <SelectField
          label="유형"
          labelClassName="mb-2 text-base font-semibold text-text-secondary"
          value={type}
          options={INQUIRY_TYPES}
          onSelect={setType}
          placeholder="문의 유형을 선택해주세요"
          hasError={attemptedSubmit && type.trim() === ''}
          errorMessage="유형을 선택해주세요"
          visible={typePickerVisible}
          onOpen={() => setTypePickerVisible(true)}
          onClose={() => setTypePickerVisible(false)}
        />
        <TextField
          label="제목"
          labelClassName="mb-2 text-base font-semibold text-text-secondary"
          value={title}
          onChangeText={setTitle}
          placeholder="제목을 입력해주세요"
          hasError={attemptedSubmit && title.trim() === ''}
          errorMessage="제목을 입력해주세요"
        />
        <TextField
          label="내용"
          labelClassName="mb-2 text-base font-semibold text-text-secondary"
          value={content}
          onChangeText={setContent}
          placeholder="문의 내용을 입력해주세요"
          multiline
          numberOfLines={12}
          hasError={attemptedSubmit && content.trim() === ''}
          errorMessage="내용을 입력해주세요"
        />
        {inquiryMutation.isError && <ErrorBanner message="문의 접수에 실패했어요. 다시 시도해주세요" />}
        <Button label="문의하기" onPress={handleSubmit} disabled={inquiryMutation.isPending} />
      </ScrollView>

      <ConfirmModal
        visible={confirmModalVisible}
        title="접수하시겠습니까?"
        description="확인 후 순차적으로 답변드리겠습니다."
        confirmLabel="접수하기"
        confirmVariant="primary"
        disabled={inquiryMutation.isPending}
        onCancel={() => setConfirmModalVisible(false)}
        onConfirm={() => inquiryMutation.mutate({ type, title, content })}
      />
    </Screen>
  )
}
