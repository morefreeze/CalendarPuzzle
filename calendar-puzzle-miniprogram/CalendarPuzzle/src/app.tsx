import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './app.scss';

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch(() => {
    console.log('App launched.');
  });

  return (
    <View className="App">
      <View className="title">Calendar Puzzle Game</View>
      {children}
    </View>
  );
}

export default App;
