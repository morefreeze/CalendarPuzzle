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

const CELL_RPX = 90;

const SimpleBoard = () => {
  const { gameId, loading: initLoading } = useGameInitialization();
  const [timer, setTimer] = useState(0);
  const [droppedBlocks, setDroppedBlocks] = useState<PlacedBlock[]>([]);
  const [blockTypes, setBlockTypes] = useState<BlockType[]>(initialBlockTypes);
  const [isGameWon, setIsGameWon] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockType | null>(null);
  const [message, setMessage] = useState('');

  // Drag state — use refs for position to avoid re-render lag during touchMove
  const [draggingBlock, setDraggingBlock] = useState<BlockType | null>(null);
  const [ghostStyle, setGhostStyle] = useState({ left: '0px', top: '0px' });
  const draggingBlockRef = useRef<BlockType | null>(null);
  const boardRectRef = useRef<{ left: number; top: number } | null>(null);
  const cellSizePxRef = useRef(0);
  const dragPosRef = useRef({ x: 0, y: 0 });

  // Double-tap detection
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: -1, y: -1 });

  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  // Calculate cell size in px
  useEffect(() => {
    const sysInfo = Taro.getSystemInfoSync();
    cellSizePxRef.current = CELL_RPX * sysInfo.windowWidth / 750;
  }, []);

  // Get board bounding rect
  const updateBoardRect = useCallback(() => {
    Taro.createSelectorQuery()
      .select('.board-container')
      .boundingClientRect((rect) => {
        if (rect) {
          boardRectRef.current = { left: rect.left, top: rect.top };
        }
      })
      .exec();
  }, []);

  // Update board rect after layout changes
  useEffect(() => {
    const timer = setTimeout(updateBoardRect, 150);
    return () => clearTimeout(timer);
  }, [droppedBlocks.length, updateBoardRect]);

  // Timer — stops on win
  useEffect(() => {
    if (initLoading || isGameWon) return;
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [initLoading, isGameWon]);

  // Check win condition
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

  const getBlockAtCell = useCallback((x: number, y: number): PlacedBlock | undefined => {
    return droppedBlocks.find(b =>
      b.shape.some((row, dy) =>
        row.some((cell, dx) =>
          cell === 1 && b.x + dx === x && b.y + dy === y
        )
      )
    );
  }, [droppedBlocks]);

  // --- Drag: start from palette item ---
  const handlePaletteTouchStart = useCallback((block: BlockType, e: any) => {
    const touch = e.touches[0];
    draggingBlockRef.current = block;
    dragPosRef.current = { x: touch.clientX, y: touch.clientY };
    const cs = cellSizePxRef.current;
    setGhostStyle({
      left: `${touch.clientX - cs}px`,
      top: `${touch.clientY - cs}px`,
    });
    setDraggingBlock(block);
    setSelectedBlock(block);
    updateBoardRect();
  }, [updateBoardRect]);

  // --- Drag: overlay captures all touchMove ---
  const handleOverlayTouchMove = useCallback((e: any) => {
    const touch = e.touches[0];
    dragPosRef.current = { x: touch.clientX, y: touch.clientY };
    const cs = cellSizePxRef.current;
    setGhostStyle({
      left: `${touch.clientX - cs}px`,
      top: `${touch.clientY - cs}px`,
    });
  }, []);

  // --- Drag: overlay captures touchEnd, calculate drop ---
  const handleOverlayTouchEnd = useCallback((e: any) => {
    const block = draggingBlockRef.current;
    if (!block) return;

    const touch = e.changedTouches?.[0];
    const finalX = touch ? touch.clientX : dragPosRef.current.x;
    const finalY = touch ? touch.clientY : dragPosRef.current.y;

    const boardRect = boardRectRef.current;
    const cs = cellSizePxRef.current;

    if (boardRect && cs > 0) {
      // Ghost top-left is at (finger - cs), so use that for cell calculation
      const ghostLeft = finalX - cs;
      const ghostTop = finalY - cs;
      const relX = ghostLeft - boardRect.left;
      const relY = ghostTop - boardRect.top;
      const cellX = Math.round(relX / cs);
      const cellY = Math.round(relY / cs);

      if (cellX >= 0 && cellX < 7 && cellY >= 0 && cellY < 8) {
        const isValid = isValidPlacement(
          block, { x: cellX, y: cellY },
          droppedBlocks, uncoverableCells, block.id
        );
        if (isValid) {
          const newBlock: PlacedBlock = { ...block, x: cellX, y: cellY };
          setDroppedBlocks(prev => [...prev, newBlock]);
          setBlockTypes(prev => prev.filter(b => b.id !== block.id));
          setSelectedBlock(null);
          setMessage('Block placed!');
        } else {
          setMessage('Invalid placement!');
        }
      } else {
        setMessage('Dropped outside the board');
      }
    }

    draggingBlockRef.current = null;
    setDraggingBlock(null);
  }, [droppedBlocks, uncoverableCells]);

  // --- Board cell: double-tap to remove, single-tap to place selected ---
  const handleCellTap = useCallback((x: number, y: number) => {
    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap = (now - last.time < 350) && last.x === x && last.y === y;
    lastTapRef.current = { time: now, x, y };

    if (isDoubleTap) {
      // Double-tap: remove placed block
      const placedBlock = getBlockAtCell(x, y);
      if (placedBlock) {
        setDroppedBlocks(prev => prev.filter(b => b.id !== placedBlock.id));
        const restored: BlockType = {
          id: placedBlock.id, label: placedBlock.label,
          color: placedBlock.color, shape: placedBlock.shape,
          key: placedBlock.key || placedBlock.id.charAt(0).toLowerCase(),
        };
        setBlockTypes(prev => [...prev, restored]);
        setSelectedBlock(null);
        setMessage('Block removed');
      }
      return;
    }

    // Single-tap: place selected block
    if (!selectedBlock) return;
    const isValid = isValidPlacement(
      selectedBlock, { x, y }, droppedBlocks, uncoverableCells, selectedBlock.id
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
  }, [selectedBlock, droppedBlocks, uncoverableCells, getBlockAtCell]);

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
        id: block.id, label: block.label, color: block.color,
        shape: block.shape, key: block.key || block.id.charAt(0).toLowerCase(),
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
    draggingBlockRef.current = null;
    setMessage('');
  }, []);

  if (initLoading) {
    return (
      <View className='loading-container'>
        <Text>Loading...</Text>
      </View>
    );
  }

  const ghostCellSize = cellSizePxRef.current;

  return (
    <View className='simple-board'>
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
                  onClick={() => !isEmpty && handleCellTap(x, y)}
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
            Placed Blocks (double-tap board to remove)
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

      {/* Full-screen drag overlay — captures all touch events during drag */}
      {draggingBlock && (
        <View
          className='drag-overlay'
          catchMove
          onTouchMove={handleOverlayTouchMove}
          onTouchEnd={handleOverlayTouchEnd}
        >
          {/* Ghost block following finger */}
          <View className='drag-ghost' style={ghostStyle}>
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
        </View>
      )}
    </View>
  );
};

export default SimpleBoard;
