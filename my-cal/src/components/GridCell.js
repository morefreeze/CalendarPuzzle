import React from 'react';
import { useDrop } from 'react-dnd';
import { CELL_SIZE } from './CalendarGrid';

const GridCell = ({ label, section, x, y, canDrop = false }) => {
  const sectionColors = {
    'months': '#FFB6C1',
    'days': '#90EE90',
    'weekdays': '#87CEFA',
    'main-grid': '#D3D3D3',
    'extra-block': '#F08080',
    'uncover': '#F0E68C'
  };

  const [{ isOver, canDropHere }, dropRef] = useDrop({
    accept: 'CELLBLOCK',
    drop: () => undefined,
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDropHere: !!monitor.canDrop()
    })
  });

  const cellStyle = {
    width: `${CELL_SIZE}px`,
    height: `${CELL_SIZE}px`,
    border: '1px solid black',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: sectionColors[section] || '#FFFFFF',
    opacity: isOver && canDropHere ? 0.5 : 1,
    cursor: canDrop ? 'pointer' : 'default'
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