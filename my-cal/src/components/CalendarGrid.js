import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import GridCell from './GridCell';
import DraggableBlock from './DraggableBlock';

export const CELL_SIZE = 70;
export const CELL_BOARDER = 1;
const GAP_SIZE = 0;

const boardLayoutData = [
  [{ type: 'month', value: 'Jan' }, { type: 'month', value: 'Feb' }, { type: 'month', value: 'Mar' }, { type: 'month', value: 'Apr' }, { type: 'month', value: 'May' }, { type: 'month', value: 'Jun' }, { type: 'empty', value: null }],
  [{ type: 'month', value: 'Jul' }, { type: 'month', value: 'Aug' }, { type: 'month', value: 'Sep' }, { type: 'month', value: 'Oct' }, { type: 'month', value: 'Nov' }, { type: 'month', value: 'Dec' }, { type: 'empty', value: null }],
  [{ type: 'day', value: 1 }, { type: 'day', value: 2 }, { type: 'day', value: 3 }, { type: 'day', value: 4 }, { type: 'day', value: 5 }, { type: 'day', value: 6 }, { type: 'day', value: 7 }],
  [{ type: 'day', value: 8 }, { type: 'day', value: 9 }, { type: 'day', value: 10 }, { type: 'day', value: 11 }, { type: 'day', value: 12 }, { type: 'day', value: 13 }, { type: 'day', value: 14 }],
  [{ type: 'day', value: 15 }, { type: 'day', value: 16 }, { type: 'day', value: 17 }, { type: 'day', value: 18 }, { type: 'day', value: 19 }, { type: 'day', value: 20 }, { type: 'day', value: 21 }],
  [{ type: 'day', value: 22 }, { type: 'day', value: 23 }, { type: 'day', value: 24 }, { type: 'day', value: 25 }, { type: 'day', value: 26 }, { type: 'day', value: 27 }, { type: 'day', value: 28 }],
  [{ type: 'day', value: 29 }, { type: 'day', value: 30 }, { type: 'day', value: 31 }, { type: 'weekday', value: 'Sun' }, { type: 'weekday', value: 'Mon' }, { type: 'weekday', value: 'Tue' }, { type: 'weekday', value: 'Wed' }],
  [ { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'weekday', value: 'Thu' }, { type: 'weekday', value: 'Fri' }, { type: 'weekday', value: 'Sat' }]
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

  // 第三个参数excludeId用于排除正在移动的方块自身
  const isValidPlacement = useCallback((block, newCoords, excludeId = null) => {
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

    // 排除正在移动的方块
    const allDroppedCells = droppedBlocksRef.current
      .filter(b => excludeId === null || b.id !== excludeId)
      .flatMap(b =>
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
  }, [uncoverableCells, droppedBlocksRef]);

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

  // 定义所有方块类型，包括原始的和新增的
  const [blockTypes, setBlockTypes] = useState([
    { id: 'I-block', label: 'I', color: '#00FFFF', shape: [[1, 1, 1, 1]] },
    // { id: 'O-block', label: 'O', color: '#FFFF00', shape: [[1, 1], [1, 1]] },
    { id: 'T-block', label: 'T', color: '#800080', shape: [[0, 1, 0], [0, 1, 0], [1, 1, 1]] },
    { id: 'L-block', label: 'L', color: '#FFA500', shape: [[1, 0], [1, 0], [1, 0], [1, 1]] },
    { id: 'S-block', label: 'S', color: '#00FF00', shape: [[0, 1, 1], [1, 1, 0]] },
    { id: 'Z-block', label: 'Z', color: '#0000FF', shape: [[1, 1, 0], [0, 1, 0], [0, 1, 1]] },
    { id: 'N-block', label: 'N', color: '#A52A2A', shape: [[1, 1, 1, 0], [0, 0, 1, 1]] },
    { id: 'Q-block', label: 'Q', color: '#FFC0CB', shape: [[1, 1, 0], [1, 1, 1]] },
    { id: 'Y-block', label: 'Y', color: '#9370DB', shape: [[1, 0, 0],[1, 0, 0], [1, 1, 1]] },
    { id: 'U-block', label: 'U', color: '#FF6347', shape: [[1, 0, 1], [1, 1, 1]] },
    { id: 'l-block', label: 'l', color: '#008000', shape: [[1, 0], [1, 0], [1, 1]] },
  ]);

  const [, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      console.debug('Drop event triggered:', item);

      // Use alternative calculation if needed
      let position = calculateDropPosition(item, monitor);
      console.debug('Calculated drop position:', position);

      // 传递item.id作为excludeId，排除正在移动的方块自身
      const isPlacementValid = position && isValidPlacement(item, position, item.id);
      console.log('Placement validity:', isPlacementValid);
      if (isPlacementValid) {
        const newBlock = { ...item, ...position };
        console.log('Placing block:', newBlock);

        // 检查是否是已放置的方块被移动
        const existingBlockIndex = droppedBlocksRef.current.findIndex(b => b.id === item.id);
        if (existingBlockIndex >= 0) {
          // 更新已放置方块的位置
          setDroppedBlocks(prev => {
            const updatedBlocks = [...prev];
            updatedBlocks[existingBlockIndex] = newBlock;
            return updatedBlocks;
          });
          console.log('Updated existing block position:', item.id);
        } else {
          // 添加新方块
          setDroppedBlocks(prev => [...prev, newBlock]);
          setBlockTypes(prev => prev.filter(block => block.id !== item.id));
          console.log('Added new block:', item.id);
        }
      } else {
        console.log('Placement invalid. Reasons:');
        if (!position) {
          console.debug('- Could not calculate drop position');
        } else {
          console.debug('- Position is valid but placement rules not satisfied');
        }
      }
      console.log('drop preview cleared');
      setPreviewBlock(null);
    },
    hover: (item, monitor) => {
      console.debug('Hover event triggered:', item);
      // Log hover client offset for comparison
      const clientOffset = monitor.getClientOffset();
      console.debug('Hover clientOffset:', clientOffset);

      // 当鼠标不在网格上方或clientOffset为null时，立即清除预览
      if (!monitor.isOver() || !clientOffset) {
        console.log('Mouse not over grid or clientOffset is null, clearing preview');
        setPreviewBlock(null);
        return;
      }

      // 获取网格元素的位置和尺寸
      if (gridRef.current) {
        const gridRect = gridRef.current.getBoundingClientRect();
        // 检查clientOffset是否在网格范围内
        if (
          clientOffset.x < gridRect.left || 
          clientOffset.x > gridRect.right || 
          clientOffset.y < gridRect.top || 
          clientOffset.y > gridRect.bottom
        ) {
          console.log('Mouse outside grid bounds, clearing preview');
          setPreviewBlock(null);
          return;
        }
      }

      const position = calculateDropPosition(item, monitor);
      console.debug('Calculated hover position:', position);
      if (position) {
        const isValid = isValidPlacement(item, position, item.id);
        console.debug('Hover position validity:', isValid);
        const newPreview = { ...item, ...position, isValid };
        if (!previewBlock || previewBlock.x !== newPreview.x || previewBlock.y !== newPreview.y || previewBlock.id !== item.id || previewBlock.isValid !== isValid) {
          console.debug('Updating preview block:', newPreview);
          setPreviewBlock(newPreview);
        }
      } else {
        // 如果无法计算位置，也清除预览
        setPreviewBlock(null);
      }
    }
  }), [calculateDropPosition, previewBlock, isValidPlacement]);

  // 添加额外的调试日志
  useEffect(() => {
    console.debug('Block types updated:', blockTypes);
  }, [blockTypes]);


  // 顺时针旋转90度
  const rotateShape = (shape) => {
    console.debug('Original shape for rotation:', shape);
    const rows = shape.length;
    const cols = shape[0].length;
    const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        newShape[col][rows - 1 - row] = shape[row][col];
      }
    }
    console.debug('Rotated shape:', newShape);
    return newShape;
  };

  // 水平翻转
  const flipShape = (shape) => {
    console.debug('Original shape for flipping:', shape);
    const newShape = shape.map(row => [...row].reverse());
    console.debug('Flipped shape:', newShape);
    return newShape;
  };

  // 使用setTimeout模拟异步更新，测试useCallback的依赖追踪机制
  const handleRotate = (blockId) => {
    console.log('--- Rotating block ---');
    console.log('Block ID:', blockId);
    // 添加小延迟模拟异步操作
    setTimeout(() => {
      setBlockTypes(prev => {
        console.debug('Current blockTypes:', prev);
        const updated = prev.map(b => {
          if (b.id === blockId) {
            const newShape = rotateShape(b.shape);
            console.log('Block shape updated from', b.shape, 'to', newShape);
            return { ...b, shape: newShape };
          }
          return b;
        });
        console.debug('Updated blockTypes:', updated);
        return updated;
      });
    }, 100);
  };

  const handleFlip = (blockId) => {
    console.log('Flipping block:', blockId);
    setBlockTypes(prev => {
      const updated = prev.map(b => {
        if (b.id === blockId) {
          const newShape = flipShape(b.shape);
          return { ...b, shape: newShape };
        }
        return b;
      });
      return updated;
    });
  };

  // 为已放置的方块添加旋转和翻转功能
  const handlePlacedBlockRotate = (blockId) => {
    console.log('--- Rotating placed block ---', blockId);
    setDroppedBlocks(prev => {
      const updated = prev.map(b => {
        if (b.id === blockId) {
          const newShape = rotateShape(b.shape);
          console.log('Old shape:', b.shape);
          console.log('New shape:', newShape);
          return { ...b, shape: newShape };
        }
        return b;
      });
      return updated;
    });
  };

  const handlePlacedBlockFlip = (blockId) => {
    console.log('Flipping placed block:', blockId);
    setDroppedBlocks(prev => {
      const updated = prev.map(b => {
        if (b.id === blockId) {
          const newShape = flipShape(b.shape);
          console.log('Old shape:', b.shape);
          console.log('New shape:', newShape);
          return { ...b, shape: newShape };
        }
        return b;
      });
      return updated;
    });
  };

  const calculateBlockPosition = (block) => ({
    left: block.x * (CELL_SIZE + GAP_SIZE),
    top: block.y * (CELL_SIZE + GAP_SIZE),
  });


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        ref={(el) => {
          drop(el);
          gridRef.current = el;
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
        {droppedBlocks.map((block) => {
          // Calculate position based on grid coordinates
          const position = calculateBlockPosition(block);

          // 不立即从droppedBlocks移除，而是允许拖动到新位置
          const handleBlockDrag = () => {
            console.log('Starting to drag placed block:', block.id);
          };

          // 处理已放置方块拖动结束后的逻辑
          const handleBlockDragEnd = (didDrop) => {
            // 如果方块没有被放置在有效位置，将其返回面板
            if (!didDrop) {
              console.log('Block dragged out of board, returning to panel:', block.id);
              // 从droppedBlocks中移除
              setDroppedBlocks(prev => prev.filter(b => b.id !== block.id));
              // 添加回blockTypes
              setBlockTypes(prev => [...prev, block]);
              setPreviewBlock(null);
            } else {
              console.log('Block moved to new position:', block.id);
              // 位置更新由drop处理函数完成
            }
          };

          // 处理双击事件 - 将方块返回面板
          const handleDoubleClick = (blockId) => {
            console.log('Double clicked block, returning to panel:', blockId);
            // 从droppedBlocks中移除
            setDroppedBlocks(prev => prev.filter(b => b.id !== blockId));
            // 添加回blockTypes
            setBlockTypes(prev => [...prev, block]);
          };

          return (
            <DraggableBlock
            key={`dropped-${block.id}`}
            id={block.id}
            label={block.label}
            color={block.color}
            shape={block.shape}
            onRotate={() => handlePlacedBlockRotate(block.id)}
            onFlip={() => handlePlacedBlockFlip(block.id)}
            onDragStart={handleBlockDrag}
            onDragEnd={handleBlockDragEnd}
            onDoubleClick={handleDoubleClick}
            isPlaced={true}
            style={{ position: 'absolute', left: `${position.left}px`, top: `${position.top}px` }}
          />
          );
        })}
      </div>

      {/* 确保同一行中的方块容器大小相同 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {blockTypes.map(block => (
          <DraggableBlock
            key={block.id}
            id={block.id}
            label={block.label}
            color={block.color}
            shape={block.shape}
            // 添加日志追踪传递的shape值
            onDragStart={() => console.log('CalendarGrid: Dragging block with shape:', block.shape)}
            onRotate={() => handleRotate(block.id)}
            onFlip={() => handleFlip(block.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default CalendarGrid;