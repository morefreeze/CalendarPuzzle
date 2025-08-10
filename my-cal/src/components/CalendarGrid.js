import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import GridCell from './GridCell';
import DraggableBlock from './DraggableBlock';

const CELL_SIZE = 70;
const GAP_SIZE = 2;

const boardLayoutData = [
  [{type: 'month', value: 'Jan'}, {type: 'month', value: 'Feb'}, {type: 'month', value: 'Mar'}, {type: 'month', value: 'Apr'}, {type: 'month', value: 'May'}, {type: 'month', value: 'Jun'}, {type: 'month', value: 'Jul'}],
  [{type: 'month', value: 'Aug'}, {type: 'month', value: 'Sep'}, {type: 'month', value: 'Oct'}, {type: 'month', value: 'Nov'}, {type: 'month', value: 'Dec'}, {type: 'empty', value: null}, {type: 'empty', value: null}],
  [{type: 'day', value: 1}, {type: 'day', value: 2}, {type: 'day', value: 3}, {type: 'day', value: 4}, {type: 'day', value: 5}, {type: 'day', value: 6}, {type: 'day', value: 7}],
  [{type: 'day', value: 8}, {type: 'day', value: 9}, {type: 'day', value: 10}, {type: 'day', value: 11}, {type: 'day', value: 12}, {type: 'day', value: 13}, {type: 'day', value: 14}],
  [{type: 'day', value: 15}, {type: 'day', value: 16}, {type: 'day', value: 17}, {type: 'day', value: 18}, {type: 'day', value: 19}, {type: 'day', value: 20}, {type: 'day', value: 21}],
  [{type: 'day', value: 22}, {type: 'day', value: 23}, {type: 'day', value: 24}, {type: 'day', value: 25}, {type: 'day', value: 26}, {type: 'day', value: 27}, {type: 'day', value: 28}],
  [{type: 'day', value: 29}, {type: 'day', value: 30}, {type: 'day', value: 31}, {type: 'weekday', value: 'Sun'}, {type: 'weekday', value: 'Mon'}, {type: 'weekday', value: 'Tue'}, {type: 'weekday', value: 'Wed'}],
  [{type: 'weekday', value: 'Thu'}, {type: 'weekday', value: 'Fri'}, {type: 'weekday', value: 'Sat'}, {type: 'empty', value: null}, {type: 'empty', value: null}, {type: 'empty', value: null}, {type: 'empty', value: null}]
];

const CalendarGrid = () => {
  const [droppedBlocks, setDroppedBlocks] = useState([]);
  const [previewBlock, setPreviewBlock] = useState(null);
  const gridRef = useRef(null);

  const uncoverableCells = useMemo(() => {
    const today = new Date();
    const currentMonth = today.toLocaleString('en-US', { month: 'short' });
    const currentDay = today.getDate();
    const currentWeekday = today.toLocaleString('en-US', { weekday: 'short' });

    const coords = [];
    boardLayoutData.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (
          (cell.type === 'month' && cell.value === currentMonth) ||
          (cell.type === 'day' && cell.value === currentDay) ||
          (cell.type === 'weekday' && cell.value === currentWeekday)
        ) {
          coords.push({ x, y });
        }
      });
    });
    return coords;
  }, []);

  const isValidPlacement = useCallback((block, newCoords) => {
    const blockCells = [];
    block.shape.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell === 1) {
          blockCells.push({
            x: newCoords.x + colIndex,
            y: newCoords.y + rowIndex,
          });
        }
      });
    });

    for (const cell of blockCells) {
      if (
        cell.y < 0 || cell.y >= boardLayoutData.length ||
        cell.x < 0 || cell.x >= boardLayoutData[0].length ||
        boardLayoutData[cell.y][cell.x].type === 'empty'
      ) {
        return false;
      }
    }

    const allDroppedCells = droppedBlocks.flatMap(b =>
      b.shape.flatMap((row, rIdx) =>
        row.map((c, cIdx) => (c === 1 ? { x: b.x + cIdx, y: b.y + rIdx } : null))
      ).filter(Boolean)
    );

    for (const blockCell of blockCells) {
      if (allDroppedCells.some(d => d.x === blockCell.x && d.y === blockCell.y)) {
        return false;
      }
      if (uncoverableCells.some(u => u.x === blockCell.x && u.y === blockCell.y)) {
        return false;
      }
    }

    return true;
  }, [droppedBlocks, uncoverableCells]);

  const calculateDropPosition = useCallback((item, monitor) => {
    if (!gridRef.current) return null;
    const gridRect = gridRef.current.getBoundingClientRect();
    const clientOffset = monitor.getClientOffset();
    const initialClientOffset = monitor.getInitialClientOffset();
    const initialSourceClientOffset = monitor.getInitialSourceClientOffset();

    if (!clientOffset || !initialClientOffset || !initialSourceClientOffset) return null;

    const xPos = clientOffset.x - gridRect.left;
    const yPos = clientOffset.y - gridRect.top;
    const dragOffsetX = initialClientOffset.x - initialSourceClientOffset.x;
    const dragOffsetY = initialClientOffset.y - initialSourceClientOffset.y;
    const blockCellOffsetX = Math.floor(dragOffsetX / item.cellSize);
    const blockCellOffsetY = Math.floor(dragOffsetY / item.cellSize);
    const gridX = Math.floor(xPos / (CELL_SIZE + GAP_SIZE));
    const gridY = Math.floor(yPos / (CELL_SIZE + GAP_SIZE));

    return { x: gridX - blockCellOffsetX, y: gridY - blockCellOffsetY };
  }, []);

  const [, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      const position = calculateDropPosition(item, monitor);
      if (position && isValidPlacement(item, position)) {
        const newBlock = { ...item, ...position };
        setDroppedBlocks(prev => [...prev, newBlock]);
        setBlockTypes(prev => prev.filter(block => block.id !== item.id));
      }
      setPreviewBlock(null);
    },
    hover: (item, monitor) => {
      if (!monitor.isOver()) {
        if (previewBlock) setPreviewBlock(null);
        return;
      }
      const position = calculateDropPosition(item, monitor);
      if (position) {
        const isValid = isValidPlacement(item, position);
        const newPreview = { ...item, ...position, isValid };
        if (!previewBlock || previewBlock.x !== newPreview.x || previewBlock.y !== newPreview.y || previewBlock.id !== item.id || previewBlock.isValid !== isValid) {
          setPreviewBlock(newPreview);
        }
      }
    }
  }), [calculateDropPosition, previewBlock, isValidPlacement]);

  const [blockTypes, setBlockTypes] = useState([
    { id: 'I-block', label: 'I', color: '#00FFFF', shape: [[1, 1, 1, 1]] },
    { id: 'O-block', label: 'O', color: '#FFFF00', shape: [[1, 1], [1, 1]] },
    { id: 'T-block', label: 'T', color: '#800080', shape: [[0, 1, 0], [1, 1, 1]] },
    { id: 'L-block', label: 'L', color: '#FFA500', shape: [[1, 0], [1, 0], [1, 1]] },
    { id: 'S-block', label: 'S', color: '#00FF00', shape: [[0, 1, 1], [1, 1, 0]] }
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

  const flipShape = (shape) => shape.map(row => row.slice().reverse());

  const handleRotate = (blockId) => {
    setBlockTypes(prev => prev.map(b => b.id === blockId ? { ...b, shape: rotateShape(b.shape) } : b));
  };

  const handleFlip = (blockId) => {
    setBlockTypes(prev => prev.map(b => b.id === blockId ? { ...b, shape: flipShape(b.shape) } : b));
  };

  const calculateBlockPosition = (block) => ({
    left: block.x * (CELL_SIZE + GAP_SIZE),
    top: block.y * (CELL_SIZE + GAP_SIZE),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div 
        ref={(el) => { drop(el); gridRef.current = el; }}
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${boardLayoutData[0].length}, ${CELL_SIZE}px)`,
          gap: `${GAP_SIZE}px`,
          marginBottom: '20px',
          position: 'relative',
          border: '2px solid #333',
          padding: '10px'
        }}
      >
        {boardLayoutData.flatMap((row, y) =>
          row.map((cell, x) => {
            const canDrop = cell.type !== 'empty';
            const isUncovered = uncoverableCells.some(c => c.x === x && c.y === y);
            return (
              <GridCell
                key={`${y}-${x}`}
                label={canDrop ? cell.value.toString() : ''}
                section={isUncovered ? 'uncover' : cell.type}
                x={x}
                y={y}
                canDrop={canDrop}
              />
            );
          })
        )}
        
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
                opacity: 0.6
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
                          backgroundColor: previewBlock.isValid ? previewBlock.color : 'red',
                          border: '1px solid rgba(0,0,0,0.3)',
                          boxSizing: 'border-box'
                        }}
                      />
                    ) : (
                      <div
                        key={cellIndex}
                        style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
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
                        style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
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