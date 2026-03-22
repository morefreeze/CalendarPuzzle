import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  boardLayoutData,
  initialBlockTypes,
  formatTime,
  getUncoverableCells,
  isValidPlacement,
  checkGameWin,
  rotateShape,
  flipShape
} from './InitBoard';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { BlockType, PlacedBlock, UncoverableCell } from '../types/game';
import './SimpleBoard.scss';

// Calculate cell size in px from rpx (90rpx)
const CELL_RPX = 90;
const BORDER_RPX = 2;

const rpxToPx = (rpx: number): number => {
  const sysInfo = Taro.getSystemInfoSync();
  return rpx * sysInfo.windowWidth / 750;
};

const SimpleBoard = () => {
  const { gameId, loading: initLoading } = useGameInitialization();
  const [timer, setTimer] = useState(0);
  const [droppedBlocks, setDroppedBlocks] = useState<PlacedBlock[]>([]);
  const [blockTypes, setBlockTypes] = useState<BlockType[]>(initialBlockTypes);
  const [isGameWon, setIsGameWon] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockType | null>(null);
  const [message, setMessage] = useState('');

  // Drag state
  const [draggingBlock, setDraggingBlock] = useState<BlockType | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const boardRectRef = useRef<{ left: number; top: number } | null>(null);
  const cellSizePx = useRef(rpxToPx(CELL_RPX));

  // Double-tap detection
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: -1, y: -1 });

  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  // Get board position after render
  const updateBoardRect = useCallback(() => {
    const query = Taro.createSelectorQuery();
    query.select('.board-container').boundingClientRect((rect) => {
      if (rect) {
        boardRectRef.current = { left: rect.left, top: rect.top };
      }
    }).exec();
  }, []);

  useEffect(() => {
    cellSizePx.current = rpxToPx(CELL_RPX);
  }, []);

  // Update board rect after blocks change (layout may shift)
  useEffect(() => {
    setTimeout(updateBoardRect, 100);
  }, [droppedBlocks, updateBoardRect]);

  // Timer — stops on win
  useEffect(() => {
    if (initLoading || isGameWon) return;
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [initLoading, isGameWon]);

  // Check win condition using full coverage check
  useEffect(() => {
    if (!isGameWon && checkGameWin(droppedBlocks, uncoverableCells)) {
      setIsGameWon(true);
      setMessage('Congratulations! You Won!');
    }
  }, [droppedBlocks, isGameWon, uncoverableCells]);

  // Clear message after 3 seconds
  useEffect(() => {
    if (message && !isGameWon) {
      const timeout = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timeout);
    }
  }, [message, isGameWon]);

  // Helper: check if cell (x,y) is covered by any placed block
  const getBlockAtCell = useCallback((x: number, y: number): PlacedBlock | undefined => {
    return droppedBlocks.find(b =>
      b.shape.some((row, dy) =>
        row.some((cell, dx) =>
          cell === 1 && b.x + dx === x && b.y + dy === y
        )
      )
    );
  }, [droppedBlocks]);

  // --- Drag handlers ---
  const handlePaletteTouchStart = useCallback((block: BlockType, e: any) => {
    const touch = e.touches[0];
    setDraggingBlock(block);
    setSelectedBlock(block);
    setDragPos({ x: touch.clientX, y: touch.clientY });
    updateBoardRect();
  }, [updateBoardRect]);

  const handleTouchMove = useCallback((e: any) => {
    if (!draggingBlock) return;
    const touch = e.touches[0];
    setDragPos({ x: touch.clientX, y: touch.clientY });
  }, [draggingBlock]);

  const handleTouchEnd = useCallback((e: any) => {
    if (!draggingBlock) return;

    const touch = e.changedTouches?.[0];
    const finalX = touch ? touch.clientX : dragPos.x;
    const finalY = touch ? touch.clientY : dragPos.y;

    // Calculate board cell from touch position
    const boardRect = boardRectRef.current;
    const cs = cellSizePx.current;

    if (boardRect && cs > 0) {
      const relX = finalX - boardRect.left;
      const relY = finalY - boardRect.top;
      const cellX = Math.floor(relX / cs);
      const cellY = Math.floor(relY / cs);

      if (cellX >= 0 && cellX < 7 && cellY >= 0 && cellY < 8) {
        const isValid = isValidPlacement(
          draggingBlock,
          { x: cellX, y: cellY },
          droppedBlocks,
          uncoverableCells,
          draggingBlock.id
        );

        if (isValid) {
          const newBlock: PlacedBlock = { ...draggingBlock, x: cellX, y: cellY };
          setDroppedBlocks(prev => [...prev, newBlock]);
          setBlockTypes(prev => prev.filter(b => b.id !== draggingBlock.id));
          setSelectedBlock(null);
          setMessage('Block placed!');
        } else {
          setMessage('Invalid placement!');
        }
      } else {
        setMessage('Dropped outside the board');
      }
    }

    setDraggingBlock(null);
  }, [draggingBlock, dragPos, droppedBlocks, uncoverableCells]);

  // --- Board cell double-tap to remove ---
  const handleCellTap = useCallback((x: number, y: number) => {
    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap = (now - last.time < 350) && last.x === x && last.y === y;

    lastTapRef.current = { time: now, x, y };

    if (isDoubleTap) {
      const placedBlock = getBlockAtCell(x, y);
      if (placedBlock) {
        setDroppedBlocks(prev => prev.filter(b => b.id !== placedBlock.id));
        const restored: BlockType = {
          id: placedBlock.id,
          label: placedBlock.label,
          color: placedBlock.color,
          shape: placedBlock.shape,
          key: placedBlock.key || placedBlock.id.charAt(0).toLowerCase(),
        };
        setBlockTypes(prev => [...prev, restored]);
        setSelectedBlock(null);
        setMessage('Block removed');
      }
    }
  }, [getBlockAtCell]);

  // --- Click to place (fallback for non-drag) ---
  const handleCellClick = useCallback((x: number, y: number) => {
    if (!selectedBlock || draggingBlock) return;

    const isValid = isValidPlacement(
      selectedBlock,
      { x, y },
      droppedBlocks,
      uncoverableCells,
      selectedBlock.id
    );

    if (isValid) {
      const newBlock: PlacedBlock = { ...selectedBlock, x, y };
      setDroppedBlocks(prev => [...prev, newBlock]);
      setBlockTypes(prev => prev.filter(b => b.id !== selectedBlock.id));
      setSelectedBlock(null);
      setMessage('Block placed!');
    } else {
      setMessage('Invalid placement!');
    }
  }, [selectedBlock, draggingBlock, droppedBlocks, uncoverableCells]);

  const handleBlockSelect = useCallback((block: BlockType) => {
    setSelectedBlock(block);
    setMessage(`Selected: ${block.label}`);
  }, []);

  const handleRotateSelected = useCallback(() => {
    if (!selectedBlock) return;
    setSelectedBlock(prev => prev ? { ...prev, shape: rotateShape(prev.shape) } : null);
    setBlockTypes(prev => prev.map(b =>
      b.id === selectedBlock.id ? { ...b, shape: rotateShape(b.shape) } : b
    ));
    setMessage(`Rotated ${selectedBlock.label}`);
  }, [selectedBlock]);

  const handleFlipSelected = useCallback(() => {
    if (!selectedBlock) return;
    setSelectedBlock(prev => prev ? { ...prev, shape: flipShape(prev.shape) } : null);
    setBlockTypes(prev => prev.map(b =>
      b.id === selectedBlock.id ? { ...b, shape: flipShape(b.shape) } : b
    ));
    setMessage(`Flipped ${selectedBlock.label}`);
  }, [selectedBlock]);

  const handleRemoveBlock = useCallback((blockId: string) => {
    const block = droppedBlocks.find(b => b.id === blockId);
    if (block) {
      setDroppedBlocks(prev => prev.filter(b => b.id !== blockId));
      const restored: BlockType = {
        id: block.id,
        label: block.label,
        color: block.color,
        shape: block.shape,
        key: block.key || block.id.charAt(0).toLowerCase(),
      };
      setBlockTypes(prev => [...prev, restored]);
      setSelectedBlock(null);
      setMessage('Block removed');
    }
  }, [droppedBlocks]);

  const resetGame = useCallback(() => {
    setDroppedBlocks([]);
    setBlockTypes(initialBlockTypes);
    setIsGameWon(false);
    setTimer(0);
    setSelectedBlock(null);
    setDraggingBlock(null);
    setMessage('');
  }, []);

  if (initLoading) {
    return (
      <View className='loading-container'>
        <Text>Loading...</Text>
      </View>
    );
  }

  const ghostCellSize = cellSizePx.current;

  return (
    <View
      className='simple-board'
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      catchMove={!!draggingBlock}
    >
      <Text className='header-timer'>
        Time: {formatTime(timer)}
      </Text>

      <Text className='header-game-id'>
        Game ID: {gameId}
      </Text>

      <Text className='header-count'>
        Placed: {droppedBlocks.length} / {initialBlockTypes.length} blocks
      </Text>

      {message && (
        <Text className={`message ${isGameWon ? 'message-win' : 'message-info'}`}>
          {message}
        </Text>
      )}

      {/* Control Buttons */}
      <View className='controls'>
        <View
          className={`btn ${selectedBlock ? 'btn-rotate' : 'btn-disabled'}`}
          onClick={handleRotateSelected}
        >
          <Text>Rotate</Text>
        </View>
        <View
          className={`btn ${selectedBlock ? 'btn-flip' : 'btn-disabled'}`}
          onClick={handleFlipSelected}
        >
          <Text>Flip</Text>
        </View>
        <View className='btn btn-reset' onClick={resetGame}>
          <Text>Reset</Text>
        </View>
      </View>

      {/* Game Board */}
      <View className='board-container'>
        {boardLayoutData.map((row, y) => (
          <View className='board-row' key={`row-${y}`}>
            {row.map((cell, x) => {
              const isUncoverable = uncoverableCells.some(
                (c: UncoverableCell) => c.x === x && c.y === y
              );
              const blockAtCell = getBlockAtCell(x, y);
              const isEmpty = cell.type === 'empty';

              let bgColor: string | undefined;
              let cellClass = 'board-cell';
              if (blockAtCell) {
                bgColor = blockAtCell.color;
              } else if (isUncoverable) {
                cellClass += ' cell-uncoverable';
              } else if (cell.type === 'month') {
                cellClass += ' cell-month';
              } else if (cell.type === 'day') {
                cellClass += ' cell-day';
              } else if (cell.type === 'weekday') {
                cellClass += ' cell-weekday';
              } else {
                cellClass += ' cell-empty';
              }

              return (
                <View
                  key={`${y}-${x}`}
                  className={cellClass}
                  style={bgColor ? { backgroundColor: bgColor, opacity: 0.9 } : undefined}
                  onClick={() => {
                    if (isEmpty) return;
                    handleCellTap(x, y);
                    handleCellClick(x, y);
                  }}
                >
                  {!blockAtCell && !isEmpty && (
                    <Text className='cell-label'>
                      {cell.value?.toString()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Selected Block Preview */}
      {selectedBlock && !draggingBlock && (
        <View className='preview-container'>
          <Text className='preview-label'>
            Selected: {selectedBlock.label} (tap board to place)
          </Text>
          {selectedBlock.shape.map((row, rIdx) => (
            <View className='preview-row' key={`prev-row-${rIdx}`}>
              {row.map((cell, cIdx) => (
                <View
                  key={`prev-${rIdx}-${cIdx}`}
                  className='preview-cell'
                  style={{ backgroundColor: cell ? selectedBlock.color : 'transparent' }}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Available Blocks */}
      <Text className='palette-title'>
        Available Blocks ({blockTypes.length})
      </Text>

      <View className='palette-list'>
        {blockTypes.map((block: BlockType) => (
          <View
            key={block.id}
            className={`palette-item ${selectedBlock?.id === block.id ? 'palette-item-selected' : ''}`}
            onClick={() => handleBlockSelect(block)}
            onTouchStart={(e) => handlePaletteTouchStart(block, e)}
          >
            <Text className='palette-item-label'>
              {block.label}
            </Text>
            {block.shape.map((row, rIdx) => (
              <View className='palette-shape-row' key={`pal-row-${rIdx}`}>
                {row.map((cell, cIdx) => (
                  <View
                    key={`pal-${rIdx}-${cIdx}`}
                    className='palette-shape-cell'
                    style={{ backgroundColor: cell ? block.color : 'transparent' }}
                  />
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Placed Blocks List */}
      {droppedBlocks.length > 0 && (
        <View className='placed-section'>
          <Text className='placed-title'>
            Placed Blocks (double-tap on board to remove)
          </Text>
          <View className='placed-list'>
            {droppedBlocks.map((block) => (
              <View
                key={block.id}
                className='placed-btn'
                style={{ backgroundColor: block.color }}
                onClick={() => handleRemoveBlock(block.id)}
              >
                <Text>{block.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Drag Ghost — floating block following finger */}
      {draggingBlock && (
        <View
          className='drag-ghost'
          style={{
            left: `${dragPos.x - ghostCellSize}px`,
            top: `${dragPos.y - ghostCellSize}px`,
          }}
        >
          {draggingBlock.shape.map((row, rIdx) => (
            <View className='ghost-row' key={`ghost-row-${rIdx}`}>
              {row.map((cell, cIdx) => (
                <View
                  key={`ghost-${rIdx}-${cIdx}`}
                  className='ghost-cell'
                  style={{
                    width: `${ghostCellSize}px`,
                    height: `${ghostCellSize}px`,
                    backgroundColor: cell ? draggingBlock.color : 'transparent',
                    opacity: cell ? 0.7 : 0,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default SimpleBoard;
