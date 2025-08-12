import React from 'react';
import { useDrag } from 'react-dnd';
import PropTypes from 'prop-types';
import { CELL_BOARDER } from './CalendarGrid';

const DraggableBlock = ({ 
  id, 
  label, 
  color = 'lightblue', 
  shape = [[1]],
  onRotate,
  onFlip
}) => {
  const CELL_SIZE = 20;
  const GAP_SIZE = 3;
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'BLOCK',
    item: { id, label, color, shape, cellSize: CELL_SIZE },
    drop: (item, monitor) => {
      console.log('Drop block event triggered:', item);
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }));

  const renderBlockShape = () => {
    return shape.map((row, rowIndex) => (
      <div key={rowIndex} style={{ display: 'flex' }}>
        {row.map((cell, cellIndex) => (
          <div 
            key={cellIndex} 
            style={{
              width: `${CELL_SIZE}px`, 
              height: `${CELL_SIZE}px`, 
              gap: `${GAP_SIZE}px`,
              backgroundColor: cell ? color : 'transparent',
              border: cell ? `${CELL_BOARDER}px solid black` : '1px solid transparent',
              boxSizing: 'border-box'
            }} 
          />
        ))}
      </div>
    ));
  };

  return (
    <div style={{
      backgroundColor: '#f0f0f0',
      border: '1px solid #333',
      display: 'inline-block',
      padding: '5px',
      margin: '5px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div
        ref={drag}
        style={{
          opacity: isDragging ? 0.5 : 1,
          cursor: 'move',
        }}
      >
        {renderBlockShape()}
      </div>
      <div>
        <button onClick={onRotate}>Rotate</button>
        <button onClick={onFlip}>Flip</button>
      </div>
    </div>
  );
};

DraggableBlock.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
  shape: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  onRotate: PropTypes.func,
  onFlip: PropTypes.func
};

export default DraggableBlock;