import { Text, TextInput, View } from 'react-native'

interface TextFieldProps {
  label?: string
  labelClassName?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  hasError?: boolean
  errorMessage?: string
  multiline?: boolean
  numberOfLines?: number
}

export function TextField({
  label,
  labelClassName = 'text-sm font-medium text-text-secondary',
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  hasError,
  errorMessage,
  multiline,
  numberOfLines,
}: TextFieldProps) {
  return (
    <View className="w-full gap-1">
      {label && <Text className={labelClassName}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={`w-full rounded-xl border px-4 py-3 text-base text-text ${
          multiline ? 'min-h-[220px]' : ''
        } ${hasError ? 'border-error-text bg-error-bg' : 'border-disabled'}`}
      />
      {hasError && errorMessage && <Text className="text-xs font-medium text-error-text">{errorMessage}</Text>}
    </View>
  )
}
