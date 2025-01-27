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
      const gridRect = gridRef.current.getBoundingClientRect();
      const dropResult = monitor.getDropResult();
      
      if (dropResult) {
        const newBlock = {
          ...item,
          x: dropResult.x,
          y: dropResult.y,
          gridOffsetX: gridRect.left,
          gridOffsetY: gridRect.top
        };
        setDroppedBlocks(prev => [...prev, newBlock]);
      }
    }
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = Array.from({length: 31}, (_, i) => i + 1);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const CELL_SIZE = 70;

  const renderGrid = () => {
    const grid = [];

    // 月份行
    grid.push(
      months.map((month, index) => (
        <GridCell 
          key={`month-${index}`} 
          label={month} 
          section="months"
          x={index}
          y={0}
          canDrop={true}
          drop={drop}
        />
      ))
    );

    // 日期行
    grid.push(
      days.map((day, index) => (
        <GridCell 
          key={`day-${index}`} 
          label={day} 
          section="days"
          x={index}
          y={1}
          canDrop={true}
          drop={drop}
        />
      ))
    );

    // 星期行
    grid.push(
      weekdays.map((day, index) => (
        <GridCell 
          key={`weekday-${index}`} 
          label={day} 
          section="weekdays"
          x={index}
          y={2}
          canDrop={true}
          drop={drop}
        />
      ))
    );

    return grid;
  };

  const blockTypes = [
    {
      id: 'I-block',
      label: 'I',
      color: '#00FFFF', // 青色
      shape: [
        [1, 1, 1, 1]  // 长条形
      ]
    },
    {
      id: 'O-block',
      label: 'O',
      color: '#FFFF00', // 黄色
      shape: [
        [1, 1],
        [1, 1]  // 正方形
      ]
    },
    {
      id: 'T-block',
      label: 'T',
      color: '#800080', // 紫色
      shape: [
        [0, 1, 0],
        [1, 1, 1]  // T形
      ]
    },
    {
      id: 'L-block',
      label: 'L',
      color: '#FFA500', // 橙色
      shape: [
        [1, 0],
        [1, 0],
        [1, 1]  // L形
      ]
    },
    {
      id: 'S-block',
      label: 'S',
      color: '#00FF00', // 绿色
      shape: [
        [0, 1, 1],
        [1, 1, 0]  // S形
      ]
    }
  ];

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
          gap: '2px',
          marginBottom: '20px',
          position: 'relative'
        }}
      >
        {renderGrid().flat()}
        {droppedBlocks.map((block, index) => (
          <div 
            key={`dropped-${index}`}
            style={{
              position: 'absolute',
              left: block.x * CELL_SIZE,
              top: block.y * CELL_SIZE,
              width: block.shape[0].length * CELL_SIZE,  // 使用 CELL_SIZE 而不是 BLOCK_CELL_SIZE
              height: block.shape.length * CELL_SIZE,    // 使用 CELL_SIZE 而不是 BLOCK_CELL_SIZE
              backgroundColor: block.color,
              opacity: 0.8,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10,  // 添加 z-index 确保块在网格上方
              pointerEvents: 'none'  // 防止块阻挡后续拖放
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
                    border: '1px solid rgba(0,0,0,0.2)'
                  }} 
                />
              ) : null
            ))}
          </div>
        ))}
        </div>
      ))}
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
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