import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

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
  const [isRevealed, setIsRevealed] = useState(false)
  const showClear = !multiline && value.length > 0
  const iconCount = (secureTextEntry ? 1 : 0) + (showClear ? 1 : 0)

  return (
    <View className="w-full gap-1">
      {label && <Text className={labelClassName}>{label}</Text>}
      <View className="justify-center">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry && !isRevealed}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          className={`w-full rounded-xl border px-4 py-3 text-base text-text ${
            iconCount === 2 ? 'pr-20' : iconCount === 1 ? 'pr-11' : ''
          } ${multiline ? 'min-h-[220px]' : ''} ${hasError ? 'border-error-text bg-error-bg' : 'border-disabled'}`}
        />
        {showClear && (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={8}
            className={`absolute ${secureTextEntry ? 'right-11' : 'right-3'}`}
          >
            <MaterialCommunityIcons name="close-circle" size={18} color="#5F5E5E" />
          </Pressable>
        )}
        {secureTextEntry && (
          <Pressable
            onPress={() => setIsRevealed((prev) => !prev)}
            hitSlop={8}
            className="absolute right-3"
          >
            <MaterialCommunityIcons
              name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#5F5E5E"
            />
          </Pressable>
        )}
      </View>
      {hasError && errorMessage && <Text className="text-xs font-medium text-error-text">{errorMessage}</Text>}
    </View>
  )
}
