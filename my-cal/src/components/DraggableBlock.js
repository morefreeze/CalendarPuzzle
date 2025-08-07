import React from 'react';
import { useDrag } from 'react-dnd';
import PropTypes from 'prop-types';

const DraggableBlock = ({ 
  id, 
  label, 
  color = 'lightblue', 
  shape = [[1]] 
}) => {
  const CELL_SIZE = 20; // 与网格中的CELL_SIZE保持一致的比例
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'BLOCK',
    item: { id, label, color, shape },
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
              backgroundColor: cell ? color : 'transparent',
              border: cell ? '1px solid black' : '1px solid transparent'
            }} 
          />
        ))}
      </div>
    ));
  };

  return (
    <div
      ref={drag}
      style={{
        backgroundColor: '#f0f0f0',
        border: '1px solid #333',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        display: 'inline-block',
        padding: '5px',
        margin: '5px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      {renderBlockShape()}
    </div>
  );
};

DraggableBlock.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
  shape: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))
};

export default DraggableBlock;