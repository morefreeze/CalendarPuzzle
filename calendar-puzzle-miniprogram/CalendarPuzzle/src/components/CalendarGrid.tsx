import React from 'react';
import { View } from '@tarojs/components';
import PlayBoard from './PlayBoard';

const CalendarGrid = () => {
  return (
    <View className="calendar-grid-container">
      <PlayBoard />
    </View>
  );
};

export default CalendarGrid;
