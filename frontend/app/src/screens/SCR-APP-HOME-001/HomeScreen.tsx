import { View } from 'react-native'
import Logo from '../../assets/logo.svg'
import { Screen } from '../../components/layout/Screen'

export function HomeScreen() {
  return (
    <Screen>
      <View className="mt-10 items-center">
        <Logo width={144} height={67} />
      </View>
    </Screen>
  )
}
