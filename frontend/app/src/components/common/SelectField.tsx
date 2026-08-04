import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'

interface SelectFieldProps {
  label?: string
  labelClassName?: string
  value: string
  options: readonly string[]
  onSelect: (value: string) => void
  placeholder?: string
  hasError?: boolean
  errorMessage?: string
  visible: boolean
  onOpen: () => void
  onClose: () => void
}

export function SelectField({
  label,
  labelClassName = 'text-sm font-medium text-text-secondary',
  value,
  options,
  onSelect,
  placeholder,
  hasError,
  errorMessage,
  visible,
  onOpen,
  onClose,
}: SelectFieldProps) {
  return (
    <View className="w-full gap-1">
      {label && <Text className={labelClassName}>{label}</Text>}
      <Pressable
        onPress={onOpen}
        className={`w-full flex-row items-center justify-between rounded-xl border px-4 py-3 ${
          hasError ? 'border-error-text bg-error-bg' : 'border-disabled'
        }`}
      >
        <Text className={`text-base ${value ? 'text-text' : 'text-text-secondary'}`}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color="#1E2A38" />
      </Pressable>
      {hasError && errorMessage && <Text className="text-xs font-medium text-error-text">{errorMessage}</Text>}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable className="rounded-t-2xl bg-white pb-6 pt-2" onPress={() => {}}>
            <View className="mx-auto mb-2 h-1 w-10 rounded-full bg-disabled" />
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    onSelect(option)
                    onClose()
                  }}
                  className={`px-6 py-4 ${option === value ? 'bg-secondary' : ''}`}
                >
                  <Text
                    className={`text-base ${
                      option === value ? 'font-bold text-text' : 'text-text'
                    }`}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
