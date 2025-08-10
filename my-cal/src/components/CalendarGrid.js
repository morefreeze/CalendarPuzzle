import React, { useState, useRef } from 'react';
import { useDrop } from 'react-dnd';
import GridCell from './GridCell';
import DraggableBlock from './DraggableBlock';

const CELL_SIZE = 70;
const GAP_SIZE = 2;

const CalendarGrid = () => {
  const [droppedBlocks, setDroppedBlocks] = useState([]);
  const [previewBlock, setPreviewBlock] = useState(null);
  const gridRef = useRef(null);

  const calculateDropPosition = (item, monitor) => {
    if (!gridRef.current) {
      return null;
    }
    const gridRect = gridRef.current.getBoundingClientRect();
    const clientOffset = monitor.getClientOffset();
    const initialClientOffset = monitor.getInitialClientOffset();
    const initialSourceClientOffset = monitor.getInitialSourceClientOffset();

    if (!clientOffset || !initialClientOffset || !initialSourceClientOffset) {
      return null;
    }

    const xPos = clientOffset.x - gridRect.left;
    const yPos = clientOffset.y - gridRect.top;
    const dragOffsetX = initialClientOffset.x - initialSourceClientOffset.x;
    const dragOffsetY = initialClientOffset.y - initialSourceClientOffset.y;
    const blockCellOffsetX = Math.floor(dragOffsetX / item.cellSize);
    const blockCellOffsetY = Math.floor(dragOffsetY / item.cellSize);
    const gridX = Math.floor(xPos / (CELL_SIZE + GAP_SIZE));
    const gridY = Math.floor(yPos / (CELL_SIZE + GAP_SIZE));

    return {
      x: gridX - blockCellOffsetX,
      y: gridY - blockCellOffsetY,
    };
  };

  const [, drop] = useDrop({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      const position = calculateDropPosition(item, monitor);
      if (position) {
        const newBlock = { ...item, ...position };
        setDroppedBlocks(prev => [...prev, newBlock]);
      }
      setPreviewBlock(null); // Clear preview on drop
    },
    hover: (item, monitor) => {
      if (!monitor.isOver()) {
        if (previewBlock) {
          setPreviewBlock(null);
        }
        return;
      }

      const position = calculateDropPosition(item, monitor);
      if (position) {
        const newPreview = { ...item, ...position };
        if (!previewBlock || previewBlock.x !== newPreview.x || previewBlock.y !== newPreview.y || previewBlock.id !== item.id) {
          setPreviewBlock(newPreview);
        }
      }
    }
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = Array.from({length: 31}, (_, i) => i + 1);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  const [blockTypes, setBlockTypes] = useState([
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
  ]);

  const rotateShape = (shape) => {
    const rows = shape.length;
    const cols = shape[0].length;
    const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        newShape[col][rows - 1 - row] = shape[row][col];
      }
    }
    return newShape;
  };

  const flipShape = (shape) => {
    return shape.map(row => row.slice().reverse());
  };

  const handleRotate = (blockId) => {
    const newBlockTypes = blockTypes.map(block => {
      if (block.id === blockId) {
        return { ...block, shape: rotateShape(block.shape) };
      }
      return block;
    });
    setBlockTypes(newBlockTypes);
  };

  const handleFlip = (blockId) => {
    const newBlockTypes = blockTypes.map(block => {
      if (block.id === blockId) {
        return { ...block, shape: flipShape(block.shape) };
      }
      return block;
    });
    setBlockTypes(newBlockTypes);
  };

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
        
        {previewBlock && (() => {
          const position = calculateBlockPosition(previewBlock);
          return (
            <div
              style={{
                position: 'absolute',
                left: position.left,
                top: position.top,
                width: previewBlock.shape[0].length * CELL_SIZE,
                height: previewBlock.shape.length * CELL_SIZE,
                backgroundColor: 'transparent',
                pointerEvents: 'none',
                zIndex: 5,
                opacity: 0.5
              }}
            >
              {previewBlock.shape.map((row, rowIndex) => (
                <div key={rowIndex} style={{ display: 'flex' }}>
                  {row.map((cell, cellIndex) => (
                    cell ? (
                      <div
                        key={cellIndex}
                        style={{
                          width: `${CELL_SIZE}px`,
                          height: `${CELL_SIZE}px`,
                          backgroundColor: previewBlock.color,
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
        })()}
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
            onRotate={() => handleRotate(block.id)}
            onFlip={() => handleFlip(block.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default CalendarGrid;