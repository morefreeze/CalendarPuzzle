import React from 'react';
import { View, Text } from '@tarojs/components';

interface GridCellProps {
  label: string;
  section: string;
  x: number;
  y: number;
  canDrop?: boolean;
}

const GridCell: React.FC<GridCellProps> = ({ label, section, canDrop = false }) => {
  const sectionColors = {
    'month': '#FFB6C1',
    'day': '#90EE90',
    'weekday': '#87CEFA',
    'empty': '#FFFFFF',
    'uncover': '#F0E68C'
  };

  const cellStyle = {
    width: '70px',
    height: '70px',
    border: '1px solid black',
    boxSizing: 'border-box' as const,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: sectionColors[section as keyof typeof sectionColors] || '#FFFFFF',
    cursor: canDrop ? 'pointer' : 'default',
    fontSize: '14px',
    fontWeight: 'bold'
  };

  return (
    <View style={cellStyle}>
      <Text>{label}</Text>
    </View>
  );
};

export default GridCell;