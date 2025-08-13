import { View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import CalendarGrid from '../../components/CalendarGrid'
import './index.scss'

export default function Index () {
  useLoad(() => {
    console.log('Page loaded.')
  })

  return (
    <View className='index'>
      <CalendarGrid />
    </View>
  )
}
