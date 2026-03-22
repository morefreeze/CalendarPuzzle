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
import { BlockType, PlacedBlock, UncoverableCell } from '../types/game';
import { generatePuzzle, getHintShape, DIFFICULTY_CONFIG, type Difficulty, type GeneratedPuzzle } from '../utils/puzzleGenerator';
import './SimpleBoard.scss';

const CELL_RPX = 90;

const SimpleBoard = () => {
  const [timer, setTimer] = useState(0);
  const [droppedBlocks, setDroppedBlocks] = useState<PlacedBlock[]>([]);
  const [prePlacedBlocks, setPrePlacedBlocks] = useState<PlacedBlock[]>([]);
  const [blockTypes, setBlockTypes] = useState<BlockType[]>(initialBlockTypes);
  const [isGameWon, setIsGameWon] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockType | null>(null);
  const [message, setMessage] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [puzzle, setPuzzle] = useState<GeneratedPuzzle | null>(null);
  const [hintMode, setHintMode] = useState(false);
  const [hintedBlocks, setHintedBlocks] = useState<Set<string>>(new Set());

  // Drag state
  const [draggingBlock, setDraggingBlock] = useState<BlockType | null>(null);
  const [ghostStyle, setGhostStyle] = useState({ left: '0px', top: '0px' });
  const draggingBlockRef = useRef<BlockType | null>(null);
  const boardRectRef = useRef<{ left: number; top: number } | null>(null);
  const cellSizePxRef = useRef(0);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: -1, y: -1 });

  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  // All blocks on board = pre-placed (locked) + player-dropped
  const allBoardBlocks = useMemo(
    () => [...prePlacedBlocks, ...droppedBlocks],
    [prePlacedBlocks, droppedBlocks]
  );

  const totalBlockCount = useMemo(() => {
    if (!puzzle) return initialBlockTypes.length;
    return puzzle.remainingBlocks.length;
  }, [puzzle]);

  useEffect(() => {
    const sysInfo = Taro.getSystemInfoSync();
    cellSizePxRef.current = CELL_RPX * sysInfo.windowWidth / 750;
  }, []);

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

  useEffect(() => {
    const t = setTimeout(updateBoardRect, 150);
    return () => clearTimeout(t);
  }, [droppedBlocks.length, updateBoardRect]);

  // Timer
  useEffect(() => {
    if (!difficulty || isGameWon || isGenerating) return;
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [difficulty, isGameWon, isGenerating]);

  // Win check — player needs to place all remaining blocks
  useEffect(() => {
    if (!difficulty || isGameWon || !puzzle) return;
    if (droppedBlocks.length === puzzle.remainingBlocks.length) {
      // Check that all coverable cells are covered by allBoardBlocks
      if (checkGameWin(allBoardBlocks, uncoverableCells)) {
        setIsGameWon(true);
        setMessage('恭喜通关！');
      }
    }
  }, [droppedBlocks, isGameWon, uncoverableCells, difficulty, puzzle, allBoardBlocks]);

  useEffect(() => {
    if (message && !isGameWon) {
      const timeout = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timeout);
    }
  }, [message, isGameWon]);

  const getBlockAtCell = useCallback((x: number, y: number): PlacedBlock | undefined => {
    return allBoardBlocks.find(b =>
      b.shape.some((row, dy) =>
        row.some((cell, dx) =>
          cell === 1 && b.x + dx === x && b.y + dy === y
        )
      )
    );
  }, [allBoardBlocks]);

  const isPrePlacedBlock = useCallback((blockId: string): boolean => {
    return prePlacedBlocks.some(b => b.id === blockId);
  }, [prePlacedBlocks]);

  // --- Difficulty selection ---
  const handleSelectDifficulty = useCallback((diff: Difficulty) => {
    setIsGenerating(true);
    setMessage('正在生成谜题...');

    // Use setTimeout to let UI update before heavy computation
    setTimeout(() => {
      const result = generatePuzzle(diff);
      if (result) {
        setPuzzle(result);
        setDifficulty(diff);
        setPrePlacedBlocks(result.prePlacedBlocks);
        setDroppedBlocks([]);
        setBlockTypes(result.remainingBlocks);
        setTimer(0);
        setIsGameWon(false);
        setSelectedBlock(null);
        setMessage(`${DIFFICULTY_CONFIG[diff].label}模式 - 放置 ${result.remainingBlocks.length} 个方块`);
      } else {
        setMessage('生成失败，请重试');
      }
      setIsGenerating(false);
    }, 50);
  }, []);

  const DRAG_THRESHOLD = 10;

  const handlePaletteTouchStart = useCallback((block: BlockType, e: any) => {
    const touch = e.touches[0];
    draggingBlockRef.current = block;
    hasDraggedRef.current = false;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    dragPosRef.current = { x: touch.clientX, y: touch.clientY };
    updateBoardRect();
  }, [updateBoardRect]);

  const handlePaletteTouchMove = useCallback((e: any) => {
    if (!draggingBlockRef.current) return;
    const touch = e.touches[0];
    dragPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (!hasDraggedRef.current) {
      const dx = touch.clientX - touchStartPosRef.current.x;
      const dy = touch.clientY - touchStartPosRef.current.y;
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      hasDraggedRef.current = true;
      setDraggingBlock(draggingBlockRef.current);
    }

    const cs = cellSizePxRef.current;
    setGhostStyle({
      left: `${touch.clientX - cs}px`,
      top: `${touch.clientY - cs}px`,
    });
  }, []);

  const handlePaletteTouchEnd = useCallback((e: any) => {
    const block = draggingBlockRef.current;
    if (!block) return;

    if (!hasDraggedRef.current) {
      if (hintMode) {
        applyHint(block);
      } else {
        setSelectedBlock(block);
        setMessage(`已选择: ${block.label}`);
      }
      draggingBlockRef.current = null;
      setDraggingBlock(null);
      return;
    }

    const touch = e.changedTouches?.[0];
    const finalX = touch ? touch.clientX : dragPosRef.current.x;
    const finalY = touch ? touch.clientY : dragPosRef.current.y;

    const boardRect = boardRectRef.current;
    const cs = cellSizePxRef.current;

    if (boardRect && cs > 0) {
      const ghostLeft = finalX - cs;
      const ghostTop = finalY - cs;
      const relX = ghostLeft - boardRect.left;
      const relY = ghostTop - boardRect.top;
      const cellX = Math.round(relX / cs);
      const cellY = Math.round(relY / cs);

      if (cellX >= 0 && cellX < 7 && cellY >= 0 && cellY < 8) {
        const isValid = isValidPlacement(
          block, { x: cellX, y: cellY },
          allBoardBlocks, uncoverableCells, block.id
        );
        if (isValid) {
          const newBlock: PlacedBlock = { ...block, x: cellX, y: cellY };
          setDroppedBlocks(prev => [...prev, newBlock]);
          setBlockTypes(prev => prev.filter(b => b.id !== block.id));
          setSelectedBlock(null);
          setMessage('放置成功！');
        } else {
          setMessage('无法放置！');
        }
      } else {
        setMessage('超出棋盘范围');
      }
    }

    draggingBlockRef.current = null;
    setDraggingBlock(null);
  }, [allBoardBlocks, uncoverableCells]);

  const handleCellTap = useCallback((x: number, y: number) => {
    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap = (now - last.time < 350) && last.x === x && last.y === y;
    lastTapRef.current = { time: now, x, y };

    if (isDoubleTap) {
      const placedBlock = getBlockAtCell(x, y);
      if (placedBlock && !isPrePlacedBlock(placedBlock.id)) {
        setDroppedBlocks(prev => prev.filter(b => b.id !== placedBlock.id));
        const restored: BlockType = {
          id: placedBlock.id, label: placedBlock.label,
          color: placedBlock.color, shape: placedBlock.shape,
          key: placedBlock.key || placedBlock.id.charAt(0).toLowerCase(),
        };
        setBlockTypes(prev => [...prev, restored]);
        setSelectedBlock(null);
        setMessage('已移除方块');
      }
      return;
    }

    if (!selectedBlock) return;
    const isValid = isValidPlacement(
      selectedBlock, { x, y }, allBoardBlocks, uncoverableCells, selectedBlock.id
    );
    if (isValid) {
      const newBlock: PlacedBlock = { ...selectedBlock, x, y };
      setDroppedBlocks(prev => [...prev, newBlock]);
      setBlockTypes(prev => prev.filter(b => b.id !== selectedBlock.id));
      setSelectedBlock(null);
      setMessage('放置成功！');
    } else {
      setMessage('无法放置！');
    }
  }, [selectedBlock, allBoardBlocks, uncoverableCells, getBlockAtCell, isPrePlacedBlock]);

  const handleRotateSelected = useCallback(() => {
    if (!selectedBlock) return;
    if (hintedBlocks.has(selectedBlock.id)) {
      setMessage('该方块方向已锁定');
      return;
    }
    setSelectedBlock(prev => prev ? { ...prev, shape: rotateShape(prev.shape) } : null);
    setBlockTypes(prev => prev.map(b =>
      b.id === selectedBlock.id ? { ...b, shape: rotateShape(b.shape) } : b
    ));
  }, [selectedBlock, hintedBlocks]);

  const handleFlipSelected = useCallback(() => {
    if (!selectedBlock) return;
    if (hintedBlocks.has(selectedBlock.id)) {
      setMessage('该方块方向已锁定');
      return;
    }
    setSelectedBlock(prev => prev ? { ...prev, shape: flipShape(prev.shape) } : null);
    setBlockTypes(prev => prev.map(b =>
      b.id === selectedBlock.id ? { ...b, shape: flipShape(b.shape) } : b
    ));
  }, [selectedBlock, hintedBlocks]);

  const handleRemoveBlock = useCallback((blockId: string) => {
    if (isPrePlacedBlock(blockId)) return;
    const block = droppedBlocks.find(b => b.id === blockId);
    if (block) {
      setDroppedBlocks(prev => prev.filter(b => b.id !== blockId));
      const restored: BlockType = {
        id: block.id, label: block.label, color: block.color,
        shape: block.shape, key: block.key || block.id.charAt(0).toLowerCase(),
      };
      setBlockTypes(prev => [...prev, restored]);
      setSelectedBlock(null);
      setMessage('已移除方块');
    }
  }, [droppedBlocks, isPrePlacedBlock]);

  const resetGame = useCallback(() => {
    setDroppedBlocks([]);
    setPrePlacedBlocks([]);
    setBlockTypes(initialBlockTypes);
    setIsGameWon(false);
    setTimer(0);
    setSelectedBlock(null);
    setDraggingBlock(null);
    draggingBlockRef.current = null;
    setMessage('');
    setDifficulty(null);
    setPuzzle(null);
    setHintMode(false);
    setHintedBlocks(new Set());
  }, []);

  const restartSameDifficulty = useCallback(() => {
    if (difficulty) {
      setHintMode(false);
      setHintedBlocks(new Set());
      handleSelectDifficulty(difficulty);
    }
  }, [difficulty, handleSelectDifficulty]);

  const toggleHintMode = useCallback(() => {
    setHintMode(prev => {
      if (!prev) {
        setMessage('提示模式：选择一个方块查看正确方向');
      } else {
        setMessage('');
      }
      return !prev;
    });
  }, []);

  const applyHint = useCallback((block: BlockType) => {
    if (!puzzle) return;
    const hintShape = getHintShape(puzzle.solvedBoard, block.label);
    if (!hintShape) return;

    setBlockTypes(prev => prev.map(b =>
      b.id === block.id ? { ...b, shape: hintShape } : b
    ));
    if (selectedBlock?.id === block.id) {
      setSelectedBlock(prev => prev ? { ...prev, shape: hintShape } : null);
    }
    setHintedBlocks(prev => new Set(prev).add(block.id));
    setHintMode(false);
    setMessage(`已提示 ${block.label} 的正确方向`);
  }, [puzzle, selectedBlock]);

  // --- Difficulty selection screen ---
  if (!difficulty) {
    return (
      <View className='simple-board'>
        <Text className='header-timer'>日历谜题</Text>
        <Text className='difficulty-subtitle'>选择难度开始游戏</Text>
        <View className='difficulty-list'>
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((diff) => {
            const config = DIFFICULTY_CONFIG[diff];
            return (
              <View
                key={diff}
                className={`difficulty-btn difficulty-${diff}`}
                onClick={() => handleSelectDifficulty(diff)}
              >
                <Text className='difficulty-btn-label'>{config.label}</Text>
                <Text className='difficulty-btn-desc'>放置 {config.digCount} 个方块</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (isGenerating) {
    return (
      <View className='loading-container'>
        <Text>正在生成谜题...</Text>
      </View>
    );
  }

  const ghostCellSize = cellSizePxRef.current;

  return (
    <View className='simple-board'>
      <View className='header-row'>
        <Text className='header-timer'>
          {formatTime(timer)}
        </Text>
        <Text className='header-difficulty'>
          {DIFFICULTY_CONFIG[difficulty].label}
        </Text>
      </View>

      <Text className='header-count'>
        已放置: {droppedBlocks.length} / {totalBlockCount}
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
          <Text>旋转</Text>
        </View>
        <View
          className={`btn ${selectedBlock ? 'btn-flip' : 'btn-disabled'}`}
          onClick={handleFlipSelected}
        >
          <Text>翻转</Text>
        </View>
        <View
          className={`btn ${hintMode ? 'btn-hint-active' : 'btn-hint'}`}
          onClick={toggleHintMode}
        >
          <Text>提示</Text>
        </View>
        <View className='btn btn-reset' onClick={restartSameDifficulty}>
          <Text>换题</Text>
        </View>
        <View className='btn btn-back' onClick={resetGame}>
          <Text>返回</Text>
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
              const isLocked = blockAtCell && isPrePlacedBlock(blockAtCell.id);

              let bgColor: string | undefined;
              let cellClass = 'board-cell';
              if (blockAtCell) {
                bgColor = blockAtCell.color;
                if (isLocked) cellClass += ' cell-locked';
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
                  style={bgColor ? { backgroundColor: bgColor, opacity: isLocked ? 0.6 : 0.9 } : undefined}
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
            已选择: {selectedBlock.label} (点击棋盘放置)
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
      {blockTypes.length > 0 && (
        <>
          <Text className='palette-title'>
            待放置方块 ({blockTypes.length})
          </Text>

          <View className='palette-list'>
            {blockTypes.map((block: BlockType) => {
              const isHinted = hintedBlocks.has(block.id);
              let itemClass = 'palette-item';
              if (selectedBlock?.id === block.id) itemClass += ' palette-item-selected';
              if (hintMode && !isHinted) itemClass += ' palette-item-hint-target';
              if (isHinted) itemClass += ' palette-item-hinted';
              return (
              <View
                key={block.id}
                className={itemClass}
                catchMove
                onTouchStart={(e) => handlePaletteTouchStart(block, e)}
                onTouchMove={handlePaletteTouchMove}
                onTouchEnd={handlePaletteTouchEnd}
              >
                <Text className='palette-item-label'>
                  {isHinted ? `${block.label} ✓` : block.label}
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
              );
            })}
          </View>
        </>
      )}

      {/* Placed Blocks List (only player-placed, removable) */}
      {droppedBlocks.length > 0 && (
        <View className='placed-section'>
          <Text className='placed-title'>
            已放置 (双击棋盘移除)
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

      {/* Ghost block following finger during drag */}
      {draggingBlock && (
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
      )}
    </View>
  );
};

export default SimpleBoard;
