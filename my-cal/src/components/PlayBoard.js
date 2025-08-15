import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import GridCell from './GridCell';
import DraggableBlock from './DraggableBlock';
import {
  CELL_SIZE,
  CELL_BOARDER,
  GAP_SIZE,
  boardLayoutData,
  initialBlockTypes,
  formatTime,
  useGameInitialization,
  getUncoverableCells,
  LONG_PRESS_THRESHOLD
} from './InitBoard';

// 判断游戏是否胜利
const checkGameWin = (droppedBlocks, uncoverableCells) => {
  // 条件1: 所有方块都被使用
  if (droppedBlocks.length !== initialBlockTypes.length) {
    return false;
  }

  // 条件2: 检查是否所有可放置的格子都被覆盖
  // 获取所有可放置的格子(非empty且非uncoverable)
  const placeableCells = [];
  boardLayoutData.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (
        cell.type !== 'empty' &&
        !uncoverableCells.some(u => u.x === x && u.y === y)
      ) {
        placeableCells.push({ x, y });
      }
    });
  });

  // 获取所有已放置方块覆盖的格子
  const coveredCells = droppedBlocks.flatMap(block =>
    block.shape.flatMap((row, rIdx) =>
      row.map((cell, cIdx) =>
        cell === 1 ? { x: block.x + cIdx, y: block.y + rIdx } : null
      )
    ).filter(Boolean)
  );

  // 检查每个可放置的格子是否被覆盖
  return placeableCells.every(cell =>
    coveredCells.some(covered => covered.x === cell.x && covered.y === cell.y)
  );
}

// 顺时针旋转90度
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

// 水平翻转
const flipShape = (shape) => {
  return shape.map(row => [...row].reverse());
};

const PlayBoard = () => {
  // 游戏初始化
  const { timer, gameId } = useGameInitialization();

  // 游戏状态
  const [droppedBlocks, setDroppedBlocks] = useState([]);
  const [previewBlock, setPreviewBlock] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [keyboardBlock, setKeyboardBlock] = useState(null);
  const [blockTypes, setBlockTypes] = useState(initialBlockTypes);
  const [isGameWon, setIsGameWon] = useState(false);

  const dragRef = useRef(null);
  const gridRef = useRef(null);
  const droppedBlocksRef = useRef(droppedBlocks);
  droppedBlocksRef.current = droppedBlocks;

  // 不可覆盖的单元格
  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  // 监听方块放置变化，检查是否胜利
  useEffect(() => {
    if (droppedBlocks.length > 0 && !isGameWon) {
      const won = checkGameWin(droppedBlocks, uncoverableCells);
      if (won) {
        setIsGameWon(true);
        console.log('游戏胜利!');
      }
    }
  }, [droppedBlocks, isGameWon, uncoverableCells]);

  // 监听鼠标移动
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (gridRef.current) {
        const gridRect = gridRef.current.getBoundingClientRect();
        const x = e.clientX - gridRect.left;
        const y = e.clientY - gridRect.top;
        setMousePosition({ x, y });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 检查放置位置是否有效
  const isValidPlacement = useCallback((block, newCoords, excludeId = null) => {
    if (!block || !block.shape || !Array.isArray(block.shape)) {
      return false;
    }

    const blockCells = [];
    block.shape.forEach((row, rowIndex) => {
      if (Array.isArray(row)) {
        row.forEach((cell, colIndex) => {
          if (cell === 1) {
            blockCells.push({
              x: newCoords.x + colIndex,
              y: newCoords.y + rowIndex,
            });
          }
        });
      }
    });

    // 检查边界和空单元格
    for (const cell of blockCells) {
      if (
        cell.y < 0 || cell.y >= boardLayoutData.length ||
        cell.x < 0 || cell.x >= boardLayoutData[0].length ||
        boardLayoutData[cell.y][cell.x].type === 'empty'
      ) {
        return false;
      }
    }

    // 检查与其他方块的碰撞
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

  // 计算放置位置
  const calculateDropPosition = useCallback((item, monitor) => {
    if (!gridRef.current) {
      return null;
    }
    const gridRect = gridRef.current.getBoundingClientRect();
    const clientOffset = monitor.getClientOffset();
    const initialClientOffset = monitor.getInitialClientOffset();
    const initialSourceClientOffset = monitor.getInitialSourceClientOffset();
    const offset = monitor.getDifferenceFromInitialOffset();

    if (!offset || !clientOffset || !initialClientOffset || !initialSourceClientOffset) {
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

  // 键盘事件处理
  useEffect(() => {
    const keyDownTimes = new Map();

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const key = e.key?.toLowerCase();
      if (!key) return;

      if (!keyDownTimes.has(key)) {
        keyDownTimes.set(key, Date.now());
      }

      const block = blockTypes.find(b => b.key?.toLowerCase() === key);

      if (block) {
        e.preventDefault();

        if (previewBlock && previewBlock.isDragging) {
          if (previewBlock.id !== block.id) {
            const newPreviewBlock = {
              ...block,
              x: previewBlock.x,
              y: previewBlock.y,
              isValid: true,
              isDragging: true
            };
            setPreviewBlock(newPreviewBlock);
          }
        } else {
          if (gridRef.current) {
            const x = Math.floor(mousePosition.x / (CELL_SIZE + GAP_SIZE));
            const y = Math.floor(mousePosition.y / (CELL_SIZE + GAP_SIZE));

            const newPreviewBlock = {
              ...block,
              x: x - Math.floor(block.shape[0].length / 2),
              y: y - Math.floor(block.shape.length / 2),
              isValid: true,
              isDragging: true
            };

            setPreviewBlock(newPreviewBlock);
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key?.toLowerCase();
      if (!key || !keyDownTimes.has(key)) {
        return;
      }

      const pressDuration = Date.now() - keyDownTimes.get(key);
      keyDownTimes.delete(key);

      const block = blockTypes.find(b => b.key?.toLowerCase() === key);

        if (block && previewBlock && previewBlock.isDragging && previewBlock.id === block.id) {
          if (pressDuration >= LONG_PRESS_THRESHOLD) {
            const flippedShape = flipShape(previewBlock.shape);
            const flippedBlock = {
              ...previewBlock,
              shape: flippedShape
            };

            const isValid = isValidPlacement(flippedBlock, { x: flippedBlock.x, y: flippedBlock.y });

            setPreviewBlock({
              ...flippedBlock,
              isValid
            });
          } else {
            const rotatedShape = rotateShape(previewBlock.shape);
            const rotatedBlock = {
              ...previewBlock,
              shape: rotatedShape
            };

            const isValid = isValidPlacement(rotatedBlock, { x: rotatedBlock.x, y: rotatedBlock.y });

            setPreviewBlock({
              ...rotatedBlock,
              isValid
            });
          }
        }
      };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [blockTypes, mousePosition, previewBlock, isValidPlacement]);

  // 鼠标移动时更新预览方块位置
  useEffect(() => {
    if (previewBlock && previewBlock.isDragging) {
      const x = Math.floor(mousePosition.x / (CELL_SIZE + GAP_SIZE));
      const y = Math.floor(mousePosition.y / (CELL_SIZE + GAP_SIZE));

      const newX = x - Math.floor(previewBlock.shape[0].length / 2);
      const newY = y - Math.floor(previewBlock.shape.length / 2);

      const isValid = isValidPlacement(previewBlock, { x: newX, y: newY });

      if (previewBlock.x !== newX || previewBlock.y !== newY || previewBlock.isValid !== isValid) {
        setPreviewBlock(prev => ({
          ...prev,
          x: newX,
          y: newY,
          isValid
        }));
      }
    }
  }, [mousePosition, previewBlock, isValidPlacement]);

  // 获取解决方案
  const fetchSolution = async () => {
    try {
      // 构建并打印curl请求用于调试
      const requestBody = JSON.stringify({
        gameId,
        droppedBlocks: droppedBlocks.map(block => ({
          id: block.id,
          x: block.x,
          y: block.y,
          shape: block.shape
        })),
        uncoverableCells
      });

      const curlCommand = `curl -X POST -H "Content-Type: application/json" -d '${requestBody}' http://localhost:5001/api/solution`;
      console.log('完整的curl请求:');
      console.log(curlCommand);

      // 调用API端点获取解决方案
      const response = await fetch('http://localhost:5001/api/solution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          // 发送当前游戏状态
          droppedBlocks: droppedBlocks.map(block => ({
            id: block.id,
            x: block.x,
            y: block.y,
            shape: block.shape
          })),
          uncoverableCells
        })
      });

      if (!response.ok) {
        throw new Error(`API响应错误: ${response.status}`);
      }

      const solution = await response.json();
      applySolution(solution);
    } catch (err) {
      console.error(`获取解决方案错误: ${err.message}`);
      alert('获取解决方案失败，请确保Python服务器正在运行');
    }
  };

  // 应用解决方案
  const applySolution = (solution) => {
    // 清空当前已放置的方块
    setDroppedBlocks([]);

    // 根据解决方案放置方块
    const newDroppedBlocks = solution.blocks.map(block => {
      // 找到对应的方块类型
      const blockType = initialBlockTypes.find(b => b.label === block.label);
      if (!blockType) return null;

      return {
        ...blockType,
        x: block.x,
        y: block.y,
        shape: block.shape
      };
    }).filter(Boolean);

    setDroppedBlocks(newDroppedBlocks);

    // 更新剩余方块类型
    const placedBlockIds = newDroppedBlocks.map(block => block.id);
    const remainingBlocks = initialBlockTypes.filter(block => !placedBlockIds.includes(block.id));
    setBlockTypes(remainingBlocks);

    // 检查是否游戏胜利
    const won = checkGameWin(newDroppedBlocks, uncoverableCells);
    if (won) {
      setIsGameWon(true);
    }
  };

  // 鼠标释放时放置方块
  useEffect(() => {
    const handleMouseUp = () => {
      if (previewBlock && previewBlock.isDragging) {
        const isPlacementValid = isValidPlacement(previewBlock, { x: previewBlock.x, y: previewBlock.y });

        if (isPlacementValid) {
          const newBlock = { ...previewBlock };
          delete newBlock.isDragging;
          delete newBlock.isValid;

          setDroppedBlocks(prev => [...prev, newBlock]);
          setBlockTypes(prev => prev.filter(block => block.id !== newBlock.id));
        }

        setPreviewBlock(null);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [previewBlock, isValidPlacement]);

  // 拖放逻辑
  const [, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item, monitor) => {
      let position = calculateDropPosition(item, monitor);
      const isPlacementValid = position && isValidPlacement(item, position, item.id);
      if (isPlacementValid) {
        const newBlock = { ...item, ...position };

        const existingBlockIndex = droppedBlocksRef.current.findIndex(b => b.id === item.id);
        if (existingBlockIndex >= 0) {
          setDroppedBlocks(prev => {
            const updatedBlocks = [...prev];
            updatedBlocks[existingBlockIndex] = newBlock;
            return updatedBlocks;
          });
        } else {
          setDroppedBlocks(prev => [...prev, newBlock]);
          setBlockTypes(prev => prev.filter(block => block.id !== item.id));
        }
      }
      setPreviewBlock(null);
    },
    hover: (item, monitor) => {
      const clientOffset = monitor.getClientOffset();

      if (!monitor.isOver() || !clientOffset) {
        setPreviewBlock(null);
        return;
      }

      if (gridRef.current) {
        const gridRect = gridRef.current.getBoundingClientRect();
        if (
          clientOffset.x < gridRect.left ||
          clientOffset.x > gridRect.right ||
          clientOffset.y < gridRect.top ||
          clientOffset.y > gridRect.bottom
        ) {
          setPreviewBlock(null);
          return;
        }
      }

      const position = calculateDropPosition(item, monitor);
      if (position) {
        const isValid = isValidPlacement(item, position, item.id);
        const newPreview = { ...item, ...position, isValid };
        if (!previewBlock || previewBlock.x !== newPreview.x || previewBlock.y !== newPreview.y || previewBlock.id !== item.id || previewBlock.isValid !== isValid) {
          setPreviewBlock(newPreview);
        }
      } else {
        setPreviewBlock(null);
      }
    }
  }), [calculateDropPosition, previewBlock, isValidPlacement]);

  // 方块操作函数
  const handlePlacedBlockRotate = (blockId) => {
    setDroppedBlocks(prev => {
      const updated = prev.map(b => {
        if (b.id === blockId) {
          const newShape = rotateShape(b.shape);
          return { ...b, shape: newShape };
        }
        return b;
      });
      return updated;
    });
  };

  const handlePlacedBlockFlip = (blockId) => {
    setDroppedBlocks(prev => {
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

  // 计算方块位置
  const calculateBlockPosition = (block) => ({
    left: block.x * (CELL_SIZE + GAP_SIZE),
    top: block.y * (CELL_SIZE + GAP_SIZE),
  });

  // 键盘方块拖动结束处理
  const handleKeyboardBlockDragEnd = (didDrop) => {
    if (!didDrop && keyboardBlock) {
      setBlockTypes(prev => [...prev, keyboardBlock]);
    }
    setKeyboardBlock(null);
  };

  // 渲染
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* 显示计时器、游戏ID和胜利状态 */}
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333', fontFamily: 'Arial, sans-serif' }}>
        Time: {formatTime(timer)}
      </div>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
        Game ID: {gameId}
      </div>
      <button
        onClick={fetchSolution}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        获取解决方案
      </button>
      {isGameWon && (
        <div style={{ 
          fontSize: '36px', 
          fontWeight: 'bold', 
          color: '#FF4500', 
          marginBottom: '20px', 
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)', 
          animation: 'pulse 1.5s infinite'
        }}>
          恭喜你，游戏胜利!
        </div>
      )}

      {/* 棋盘 */}
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
        {/* 网格单元格 */}
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

        {/* 键盘触发的拖拽方块 */}
        {keyboardBlock && (
          <DraggableBlock
            key={`keyboard-${keyboardBlock.id}`}
            id={keyboardBlock.id}
            label={keyboardBlock.label}
            color={keyboardBlock.color}
            shape={keyboardBlock.shape}
            onDragEnd={handleKeyboardBlockDragEnd}
            isPlaced={false}
            ref={(el) => {
              dragRef.current = el;
            }}
            style={{
              position: 'absolute',
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              cursor: 'move'
            }}
          />
        )}

        {/* 预览方块 */}
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

        {/* 已放置的方块 */}
        {droppedBlocks.map((block) => {
          const position = calculateBlockPosition(block);

          const handleBlockDragEnd = (didDrop) => {
            if (!didDrop) {
              setDroppedBlocks(prev => prev.filter(b => b.id !== block.id));
              setBlockTypes(prev => [...prev, block]);
              setPreviewBlock(null);
            }
          };

          const handleDoubleClick = (blockId) => {
            setDroppedBlocks(prev => prev.filter(b => b.id !== blockId));
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
              onDragEnd={handleBlockDragEnd}
              onDoubleClick={handleDoubleClick}
              isPlaced={true}
              style={{ position: 'absolute', left: `${position.left}px`, top: `${position.top}px` }}
            />
          );
        })}
      </div>

      {/* 方块选择面板 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {blockTypes.map(block => (
          <DraggableBlock
            key={block.id}
            id={block.id}
            label={block.label}
            color={block.color}
            shape={block.shape}
            isPlaced={false}
          />
        ))}
      </div>
    </div>
  );
};

export default PlayBoard;