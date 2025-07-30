import React from 'react';
import { useDrag } from 'react-dnd';
import PropTypes from 'prop-types';

const DraggableBlock = ({ 
  id, 
  label, 
  color = 'lightblue', 
  shape = [[1]] 
}) => {
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
              width: '20px', 
              height: '20px', 
              backgroundColor: cell ? color : 'transparent',
              border: '1px solid black'
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
        backgroundColor: 'lightblue',
        border: '1px solid black',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        display: 'inline-block',
        padding: '5px',
        margin: '5px'
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