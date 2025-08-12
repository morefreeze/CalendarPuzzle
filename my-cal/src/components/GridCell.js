import React from 'react';
import { useDrop } from 'react-dnd';
import { CELL_SIZE, CELL_BOARDER } from './CalendarGrid';

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
    accept: 'CELL_BLOCK',
    drop: () => undefined,
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDropHere: !!monitor.canDrop()
    })
  });

  const cellStyle = {
    width: `${CELL_SIZE}px`,
    height: `${CELL_SIZE}px`,
    border: `${CELL_BOARDER}px solid black`,
    boxSizing: 'border-box',
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