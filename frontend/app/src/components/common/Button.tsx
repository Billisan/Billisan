import { Pressable, Text } from 'react-native'

interface ButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
}

export function Button({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-2xl px-6 py-4 ${
        disabled ? 'bg-disabled' : 'bg-primary active:opacity-80'
      }`}
    >
      <Text className="text-base font-bold text-text">{label}</Text>
    </Pressable>
  )
}
