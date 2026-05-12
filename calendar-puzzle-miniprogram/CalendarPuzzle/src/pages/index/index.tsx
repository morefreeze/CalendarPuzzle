import { View } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import SimpleBoard from '../../components/SimpleBoard';
import { getShareablePuzzle, buildSharePath, buildShareTitle } from '../../utils/shareState';
import './index.scss';

export default function Index() {
  useLoad(() => {
    Taro.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  });

  useShareAppMessage(() => {
    const p = getShareablePuzzle();
    return {
      title: buildShareTitle(p),
      path: buildSharePath(p),
    };
  });

  useShareTimeline(() => {
    const p = getShareablePuzzle();
    const query = p ? `d=${p.difficulty}&s=${p.seed}&date=${p.dateStr}` : '';
    return {
      title: buildShareTitle(p),
      query,
    };
  });

  return (
    <View className='index'>
      <SimpleBoard />
    </View>
  );
}
