import React from 'react';
import { View, Text } from '@tarojs/components';
import { CELL_BOARDER } from './InitBoard';

interface GridCellProps {
  label?: string;
  section?: string;
  x: number;
  y: number;
  canDrop?: boolean;
  size?: number;
}

const GridCell: React.FC<GridCellProps> = ({
  label = '',
  section = 'main-grid',
  x,
  y,
  canDrop = false,
  size = 70
}) => {
  const sectionColors: Record<string, string> = {
    'month': '#FFB6C1',
    'day': '#90EE90',
    'weekday': '#87CEFA',
    'main-grid': '#D3D3D3',
    'extra-block': '#F08080',
    'uncover': '#F0E68C'
  };

  const cellStyle = {
    width: `${size}px`,
    height: `${size}px`,
    border: `${CELL_BOARDER}px solid black`,
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: sectionColors[section] || '#FFFFFF',
    cursor: canDrop ? 'pointer' : 'default'
  };

  return (
    <View style={cellStyle}>
      <Text style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
        {label}
      </Text>
    </View>
  );
};

export default GridCell;
