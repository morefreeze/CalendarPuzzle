import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import GridCell from './GridCell';
import DraggableBlock from './DraggableBlock';

export const CELL_SIZE = 70;
export const CELL_BOARDER = 1;
const GAP_SIZE = 0;

const boardLayoutData = [
  [{ type: 'month', value: 'Jan' }, { type: 'month', value: 'Feb' }, { type: 'month', value: 'Mar' }, { type: 'month', value: 'Apr' }, { type: 'month', value: 'May' }, { type: 'month', value: 'Jun' }, { type: 'month', value: 'Jul' }],
  [{ type: 'month', value: 'Aug' }, { type: 'month', value: 'Sep' }, { type: 'month', value: 'Oct' }, { type: 'month', value: 'Nov' }, { type: 'month', value: 'Dec' }, { type: 'empty', value: null }, { type: 'empty', value: null }],
  [{ type: 'day', value: 1 }, { type: 'day', value: 2 }, { type: 'day', value: 3 }, { type: 'day', value: 4 }, { type: 'day', value: 5 }, { type: 'day', value: 6 }, { type: 'day', value: 7 }],
  [{ type: 'day', value: 8 }, { type: 'day', value: 9 }, { type: 'day', value: 10 }, { type: 'day', value: 11 }, { type: 'day', value: 12 }, { type: 'day', value: 13 }, { type: 'day', value: 14 }],
  [{ type: 'day', value: 15 }, { type: 'day', value: 16 }, { type: 'day', value: 17 }, { type: 'day', value: 18 }, { type: 'day', value: 19 }, { type: 'day', value: 20 }, { type: 'day', value: 21 }],
  [{ type: 'day', value: 22 }, { type: 'day', value: 23 }, { type: 'day', value: 24 }, { type: 'day', value: 25 }, { type: 'day', value: 26 }, { type: 'day', value: 27 }, { type: 'day', value: 28 }],
  [{ type: 'day', value: 29 }, { type: 'day', value: 30 }, { type: 'day', value: 31 }, { type: 'weekday', value: 'Sun' }, { type: 'weekday', value: 'Mon' }, { type: 'weekday', value: 'Tue' }, { type: 'weekday', value: 'Wed' }],
  [{ type: 'weekday', value: 'Thu' }, { type: 'weekday', value: 'Fri' }, { type: 'weekday', value: 'Sat' }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }]
];

const CalendarGrid = () => {
  const [droppedBlocks, setDroppedBlocks] = useState([]);
  const [previewBlock, setPreviewBlock] = useState(null);
  const gridRef = useRef(null);
  const droppedBlocksRef = useRef(droppedBlocks);
  droppedBlocksRef.current = droppedBlocks;

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

    const allDroppedCells = droppedBlocksRef.current.flatMap(b =>
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
  }, [uncoverableCells]);

  const calculateDropPosition = useCallback((item, monitor) => {
    if (!gridRef.current) {
      console.log('calculateDropPosition: gridRef.current is null');
      return null;
    }
    const gridRect = gridRef.current.getBoundingClientRect();
    const clientOffset = monitor.getClientOffset();
    const initialClientOffset = monitor.getInitialClientOffset();
    const initialSourceClientOffset = monitor.getInitialSourceClientOffset();
    const offset = monitor.getDifferenceFromInitialOffset();
    console.log('offset', offset);

    if (!offset) {
      console.log('calculateDropPosition: offset is null');
      return null;
    }
    if (!clientOffset) {
      console.log('calculateDropPosition: clientOffset is null');
      return null;
    }
    if (!initialClientOffset) {
      console.log('calculateDropPosition: initialClientOffset is null');
      return null;
    }
    if (!initialSourceClientOffset) {
      console.log('calculateDropPosition: initialSourceClientOffset is null');
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

    return { x: gridX - blockCellOffsetX, y: gridY - blockCellOffsetY };
  }, []);

  const [blockTypes, setBlockTypes] = useState([
    { id: 'I-block', label: 'I', color: '#00FFFF', shape: [[1, 1, 1, 1]] },
    { id: 'O-block', label: 'O', color: '#FFFF00', shape: [[1, 1], [1, 1]] },
    { id: 'T-block', label: 'T', color: '#800080', shape: [[0, 1, 0], [1, 1, 1]] },
    { id: 'L-block', label: 'L', color: '#FFA500', shape: [[1, 0], [1, 0], [1, 1]] },
    { id: 'S-block', label: 'S', color: '#00FF00', shape: [[0, 1, 1], [1, 1, 0]] }
  ]);

  const [, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      console.log('Drop event triggered:', item);

      // Use alternative calculation if needed
      let position = calculateDropPosition(item, monitor);
      console.log('Calculated drop position:', position);

      const isPlacementValid = position && isValidPlacement(item, position);
      console.log('Placement validity:', isPlacementValid);
      if (isPlacementValid) {
        const newBlock = { ...item, ...position };
        console.log('Adding new block:', newBlock);
        setDroppedBlocks(prev => [...prev, newBlock]);
        setBlockTypes(prev => prev.filter(block => block.id !== item.id));
      } else {
        console.log('Placement invalid. Reasons:');
        if (!position) {
          console.log('- Could not calculate drop position');
        } else {
          console.log('- Position is valid but placement rules not satisfied');
        }
      }
      setPreviewBlock(null);
    },
    hover: (item, monitor) => {
      console.log('Hover event triggered:', item);
      // Log hover client offset for comparison
      const clientOffset = monitor.getClientOffset();
      console.log('Hover clientOffset:', clientOffset);

      if (!monitor.isOver()) {
        console.log('Mouse not over grid, clearing preview');
        if (previewBlock) setPreviewBlock(null);
        return;
      }
      const position = calculateDropPosition(item, monitor);
      console.log('Calculated hover position:', position);
      if (position) {
        const isValid = isValidPlacement(item, position);
        console.log('Hover position validity:', isValid);
        const newPreview = { ...item, ...position, isValid };
        if (!previewBlock || previewBlock.x !== newPreview.x || previewBlock.y !== newPreview.y || previewBlock.id !== item.id || previewBlock.isValid !== isValid) {
          console.log('Updating preview block:', newPreview);
          setPreviewBlock(newPreview);
        }
      }
    }
  }), [calculateDropPosition, previewBlock, isValidPlacement]);

  // 添加额外的调试日志
  useEffect(() => {
    console.log('Block types updated:', blockTypes);
  }, [blockTypes]);


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

  // 在 CalendarGrid 组件的顶部附近添加这个 effect
  useEffect(() => {
    console.log('Dropped blocks updated:', droppedBlocks);
  }, [droppedBlocks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        ref={(el) => {
          drop(el);
          gridRef.current = el;
          console.log('gridRef set:', el !== null);
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${boardLayoutData[0].length}, ${CELL_SIZE}px)`,
          gap: `${GAP_SIZE}px`,
          marginBottom: '20px',
          position: 'relative',
          border: '10px solid #333',
          padding: '0px'
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
                          gap: `${GAP_SIZE}px`,
                          backgroundColor: previewBlock.isValid ? previewBlock.color : 'red',
                          border: `${CELL_BOARDER}px solid rgba(0,0,0,0.3)`,
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

        {/* Render dropped blocks as draggable components */}
        {droppedBlocks.map((block, index) => {
          const position = calculateBlockPosition(block);
          return (
            <div
              key={`dropped-${index}`}
              style={{
                position: 'absolute',
                left: position.left,
                top: position.top,
                gap: `${GAP_SIZE}px`,
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
                          gap: `${GAP_SIZE}px`,
                          backgroundColor: block.color,
                          border: `${CELL_BOARDER}px solid rgba(0,0,0,0.3)`,
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