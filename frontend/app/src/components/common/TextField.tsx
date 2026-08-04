import { Text, TextInput, View } from 'react-native'

interface TextFieldProps {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  hasError?: boolean
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  hasError,
}: TextFieldProps) {
  return (
    <View className="w-full gap-1">
      {label && (
        <Text className="text-sm font-medium text-text-secondary">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        className={`w-full rounded-xl border px-4 py-3 text-base text-text ${
          hasError ? 'border-error-text bg-error-bg' : 'border-disabled'
        }`}
      />
    </View>
  )
}
