import { View } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import SimpleBoard from '../../components/SimpleBoard';
import './index.scss';

export default function Index() {
  useLoad(() => {
    console.log('Page loaded.');
  });

  return (
    <View className='index'>
      <SimpleBoard />
    </View>
  );
}
