import React from 'react';
import { useDrop } from 'react-dnd';

const GridCell = ({ label, section, x, y, canDrop = false, drop }) => {
  const sectionColors = {
    'months': '#FFB6C1',      // 浅粉色
    'days': '#90EE90',        // 浅绿色
    'weekdays': '#87CEFA',    // 浅蓝色
    'main-grid': '#D3D3D3',   // 浅灰色
    'extra-block': '#F08080'  // 浅珊瑚色
  };

  const [{ isOver, canDropHere }, dropRef] = useDrop({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      if (canDrop) {
        return { x, y };
      }
      return undefined;
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDropHere: !!monitor.canDrop()
    })
  });

  const cellStyle = {
    width: '70px',
    height: '70px',
    border: '1px solid black',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: sectionColors[section] || '#FFFFFF',
    opacity: isOver && canDropHere ? 0.5 : 1
  };

  return (
    <div 
      ref={canDrop ? dropRef : null} 
      style={cellStyle}
    >
      {label}
    </div>
  );
};

export default GridCell;