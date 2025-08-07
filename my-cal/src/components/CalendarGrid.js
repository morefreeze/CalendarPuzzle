import React, { useState, useRef } from 'react';
import { useDrop } from 'react-dnd';
import GridCell from './GridCell';
import DraggableBlock from './DraggableBlock';

const CalendarGrid = () => {
  const [droppedBlocks, setDroppedBlocks] = useState([]);
  const gridRef = useRef(null);

  const [, drop] = useDrop({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      const dropResult = monitor.getDropResult();
      if (dropResult) {
        const newBlock = {
          ...item,
          x: dropResult.x,
          y: dropResult.y,
          section: dropResult.section
        };
        setDroppedBlocks(prev => [...prev, newBlock]);
      }
    }
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = Array.from({length: 31}, (_, i) => i + 1);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const CELL_SIZE = 70;
  const GAP_SIZE = 2;

  const renderGrid = () => {
    const grid = [];

    // 月份行 - 第0行
    grid.push(
      months.slice(0, 12).map((month, index) => (
        <GridCell 
          key={`month-${index}`} 
          label={month} 
          section="months"
          x={index}
          y={0}
          canDrop={true}
        />
      ))
    );

    // 日期行 - 第1行
    grid.push(
      days.slice(0, 31).map((day, index) => (
        <GridCell 
          key={`day-${index}`} 
          label={day.toString()} 
          section="days"
          x={index}
          y={1}
          canDrop={true}
        />
      ))
    );

    // 星期行 - 第2行
    grid.push(
      weekdays.slice(0, 7).map((day, index) => (
        <GridCell 
          key={`weekday-${index}`} 
          label={day} 
          section="weekdays"
          x={index}
          y={2}
          canDrop={true}
        />
      ))
    );

    return grid;
  };

  const blockTypes = [
    {
      id: 'I-block',
      label: 'I',
      color: '#00FFFF',
      shape: [[1, 1, 1, 1]]
    },
    {
      id: 'O-block',
      label: 'O',
      color: '#FFFF00',
      shape: [[1, 1], [1, 1]]
    },
    {
      id: 'T-block',
      label: 'T',
      color: '#800080',
      shape: [[0, 1, 0], [1, 1, 1]]
    },
    {
      id: 'L-block',
      label: 'L',
      color: '#FFA500',
      shape: [[1, 0], [1, 0], [1, 1]]
    },
    {
      id: 'S-block',
      label: 'S',
      color: '#00FF00',
      shape: [[0, 1, 1], [1, 1, 0]]
    }
  ];

  // 计算块在网格中的精确位置
  const calculateBlockPosition = (block) => {
    const left = block.x * (CELL_SIZE + GAP_SIZE);
    const top = block.y * (CELL_SIZE + GAP_SIZE);
    return { left, top };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div 
        ref={(el) => {
          drop(el);
          gridRef.current = el;
        }}
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 70px)', 
          gap: `${GAP_SIZE}px`,
          marginBottom: '20px',
          position: 'relative',
          border: '2px solid #333',
          padding: '10px'
        }}
      >
        {renderGrid().flat()}
        
        {droppedBlocks.map((block, index) => {
          const position = calculateBlockPosition(block);
          return (
            <div 
              key={`dropped-${index}`}
              style={{
                position: 'absolute',
                left: position.left,
                top: position.top,
                width: block.shape[0].length * CELL_SIZE,
                height: block.shape.length * CELL_SIZE,
                backgroundColor: 'transparent',
                pointerEvents: 'none',
                zIndex: 10
              }}
            >
              {block.shape.map((row, rowIndex) => (
                <div key={rowIndex} style={{ display: 'flex' }}>
                  {row.map((cell, cellIndex) => (
                    cell ? (
                      <div 
                        key={cellIndex} 
                        style={{
                          width: `${CELL_SIZE}px`,
                          height: `${CELL_SIZE}px`,
                          backgroundColor: block.color,
                          border: '1px solid rgba(0,0,0,0.3)',
                          boxSizing: 'border-box'
                        }} 
                      />
                    ) : (
                      <div 
                        key={cellIndex} 
                        style={{
                          width: `${CELL_SIZE}px`,
                          height: `${CELL_SIZE}px`
                        }} 
                      />
                    )
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {blockTypes.map(block => (
          <DraggableBlock 
            key={block.id} 
            id={block.id} 
            label={block.label}
            color={block.color}
            shape={block.shape}
          />
        ))}
      </div>
    </div>
  );
};

export default CalendarGrid;