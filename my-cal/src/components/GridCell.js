import React from 'react';
import { useDrop } from 'react-dnd';

const GridCell = ({ label, section, x, y, canDrop = false }) => {
  const sectionColors = {
    'months': '#FFB6C1',
    'days': '#90EE90',
    'weekdays': '#87CEFA',
    'main-grid': '#D3D3D3',
    'extra-block': '#F08080'
  };

  const [{ isOver, canDropHere }, dropRef] = useDrop({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      if (canDrop) {
        return { x, y, section };
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