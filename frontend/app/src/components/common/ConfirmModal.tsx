import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Modal, Pressable, Text, View } from 'react-native'

interface ConfirmModalProps {
  visible: boolean
  title: string
  description: string
  warningText?: string
  cancelLabel?: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'danger'
  // 확인 버튼 자체를 눌러도 반응 안 하게 막는다(PROJECT_GUIDE.md §9.1 "전송 중 중복 Tap 차단") —
  // 호출부에서 mutation의 isPending을 넘겨 중복 제출을 막는 용도(2026-08-09 코드 리뷰 반영).
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({
  visible,
  title,
  description,
  warningText,
  cancelLabel = '취소',
  confirmLabel,
  confirmVariant = 'primary',
  disabled = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onCancel}>
        <Pressable
          className="relative w-full gap-5 rounded-2xl bg-white px-8 pb-8 pt-16"
          onPress={() => {}}
        >
          <Pressable onPress={onCancel} hitSlop={8} className="absolute right-4 top-4 z-10">
            <MaterialCommunityIcons name="close" size={24} color="#1E2A38" />
          </Pressable>

          <View className="items-center gap-2">
            <Text className="text-lg font-bold text-text">{title}</Text>
            <Text className="text-sm text-text-secondary">{description}</Text>
          </View>

          {warningText && (
            <View className="rounded-xl bg-error-bg px-4 py-3">
              <Text className="text-center text-sm font-medium text-error-text">{warningText}</Text>
            </View>
          )}

          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 items-center justify-center rounded-2xl border border-disabled px-4 py-4 active:opacity-70"
            >
              <Text className="text-base font-bold text-text">{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={disabled}
              className={`flex-1 items-center justify-center rounded-2xl px-4 py-4 active:opacity-80 ${
                confirmVariant === 'danger' ? 'bg-error-cta' : 'bg-primary'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              <Text
                className={`text-base font-bold ${confirmVariant === 'danger' ? 'text-white' : 'text-text'}`}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
