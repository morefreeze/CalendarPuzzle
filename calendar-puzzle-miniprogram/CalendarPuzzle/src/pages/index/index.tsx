import { View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import CalendarGame from '../../components/CalendarGame'
import './index.scss'

export default function Index () {
  useLoad(() => {
    console.log('Page loaded.')
  })

  return (
    <View className='index'>
      <CalendarGame />
    </View>
  )
}
