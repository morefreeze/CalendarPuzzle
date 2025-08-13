import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { DndProvider } from 'react-dnd';
import CalendarGrid from './components/CalendarGrid';
import { HTML5Backend } from 'react-dnd-html5-backend';

import './app.scss';

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch(() => {
    console.log('App launched.');
  });

  // children 是将要会渲染的页面
  return (
    <DndProvider backend={HTML5Backend}>
      <View className="App">
        <View className="title">日历拼图游戏</View>
        <CalendarGrid />
      </View>
    </DndProvider>
  );
}

export default App;
