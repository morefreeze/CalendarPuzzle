import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  boardLayoutData,
  initialBlockTypes,
  getUncoverableCells,
  checkGameWin,
  rotateShape,
  flipShape,
  formatTime,
  fetchGameId,
  fetchSolution
} from '../utils/gameUtils';
import GridCell from './GridCell';
import BlockComponent from './BlockComponent';

const CELL_SIZE = 70;
const GAP_SIZE = 0;

interface Block {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  x?: number;
  y?: number;
  key?: string;
}

const CalendarGame: React.FC = () => {
  const [droppedBlocks, setDroppedBlocks] = useState<Block[]>([]);
  const [availableBlocks, setAvailableBlocks] = useState<Block[]>(initialBlockTypes);
  const [previewBlock, setPreviewBlock] = useState<Block | null>(null);
  const [isGameWon, setIsGameWon] = useState(false);
  const [timer, setTimer] = useState(0);
  const [gameId, setGameId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingSolution, setIsFetchingSolution] = useState(false);
  const [solutionTime, setSolutionTime] = useState<number | null>(null);
  const [solutionError, setSolutionError] = useState<string | null>(null);

  const gridRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const selectedBlockRef = useRef<string | null>(null);

  // 获取不可覆盖的单元格
  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  // 初始化游戏
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // 获取当前日期
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;
        
        // 获取游戏ID
        const newGameId = await fetchGameId(initialBlockTypes, boardLayoutData, day, month);
        setGameId(newGameId);

        // 从本地存储加载游戏状态
        const savedState = Taro.getStorageSync(`calendarPuzzleState_${newGameId}`);
        if (savedState) {
          setDroppedBlocks(savedState.droppedBlocks || []);
          setAvailableBlocks(savedState.availableBlocks || initialBlockTypes);
        }

        // 从本地存储加载计时器
        const savedTimer = Taro.getStorageSync(`calendarPuzzleTimer_${newGameId}`);
        if (savedTimer) {
          setTimer(parseInt(savedTimer, 10));
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize game:', error);
        // 降级处理
        const fallbackGameId = Math.abs(Date.now()).toString(36);
        setGameId(fallbackGameId);
        setIsLoading(false);
      }
    };

    initializeGame();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 启动计时器
  useEffect(() => {
    if (!isLoading && !isGameWon) {
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          const newTimer = prev + 1;
          if (gameId) {
            Taro.setStorageSync(`calendarPuzzleTimer_${gameId}`, newTimer.toString());
          }
          return newTimer;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading, isGameWon, gameId]);

  // 保存游戏状态
  useEffect(() => {
    if (gameId && !isLoading) {
      const gameState = {
        droppedBlocks,
        availableBlocks,
        timestamp: Date.now()
      };
      Taro.setStorageSync(`calendarPuzzleState_${gameId}`, gameState);
    }
  }, [droppedBlocks, availableBlocks, gameId, isLoading]);

  // 检查游戏胜利
  useEffect(() => {
    if (droppedBlocks.length > 0 && !isGameWon) {
      const won = checkGameWin(droppedBlocks, uncoverableCells);
      if (won) {
        setIsGameWon(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }
  }, [droppedBlocks, uncoverableCells, isGameWon]);

  // 计算方块在棋盘上的位置
  const calculateBlockPosition = (block: Block) => ({
    left: (block.x || 0) * (CELL_SIZE + GAP_SIZE),
    top: (block.y || 0) * (CELL_SIZE + GAP_SIZE),
  });

  // 检查放置位置是否有效
  const isValidPlacement = useCallback((block: Block, x: number, y: number) => {
    const blockCells = [];
    block.shape.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell === 1) {
          blockCells.push({
            x: x + colIndex,
            y: y + rowIndex,
          });
        }
      });
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
    const allDroppedCells = droppedBlocks
      .flatMap(b =>
        b.shape.flatMap((row, rIdx) =>
          row.map((c, cIdx) => (c === 1 ? { x: b.x! + cIdx, y: b.y! + rIdx } : null))
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

  // 处理方块放置
  const handleBlockDrop = useCallback((block: Block, x: number, y: number) => {
    if (isValidPlacement(block, x, y)) {
      const newBlock = { ...block, x, y };
      
      // 检查是否是已放置的方块被移动
      const existingIndex = droppedBlocks.findIndex(b => b.id === block.id);
      if (existingIndex >= 0) {
        const updatedBlocks = [...droppedBlocks];
        updatedBlocks[existingIndex] = newBlock;
        setDroppedBlocks(updatedBlocks);
      } else {
        // 添加新方块
        setDroppedBlocks(prev => [...prev, newBlock]);
        setAvailableBlocks(prev => prev.filter(b => b.id !== block.id));
      }
    }
    setPreviewBlock(null);
  }, [droppedBlocks, isValidPlacement]);

  // 处理方块返回面板
  const handleReturnToPanel = useCallback((blockId: string) => {
    const block = droppedBlocks.find(b => b.id === blockId);
    if (block) {
      const { x, y, ...blockWithoutPosition } = block;
      setAvailableBlocks(prev => [...prev, blockWithoutPosition]);
      setDroppedBlocks(prev => prev.filter(b => b.id !== blockId));
    }
  }, [droppedBlocks]);

  // 处理方块旋转
  const handleRotate = useCallback((blockId: string, isPlaced: boolean = false) => {
    if (isPlaced) {
      setDroppedBlocks(prev => prev.map(block => {
        if (block.id === blockId) {
          const newShape = rotateShape(block.shape);
          return { ...block, shape: newShape };
        }
        return block;
      }));
    } else {
      setAvailableBlocks(prev => prev.map(block => {
        if (block.id === blockId) {
          const newShape = rotateShape(block.shape);
          return { ...block, shape: newShape };
        }
        return block;
      }));
    }
  }, []);

  // 处理方块翻转
  const handleFlip = useCallback((blockId: string, isPlaced: boolean = false) => {
    if (isPlaced) {
      setDroppedBlocks(prev => prev.map(block => {
        if (block.id === blockId) {
          const newShape = flipShape(block.shape);
          return { ...block, shape: newShape };
        }
        return block;
      }));
    } else {
      setAvailableBlocks(prev => prev.map(block => {
        if (block.id === blockId) {
          const newShape = flipShape(block.shape);
          return { ...block, shape: newShape };
        }
        return block;
      }));
    }
  }, []);

  // 清除游戏状态
  const clearGameState = useCallback(() => {
    if (gameId) {
      Taro.removeStorageSync(`calendarPuzzleState_${gameId}`);
      Taro.removeStorageSync(`calendarPuzzleTimer_${gameId}`);
    }
    setDroppedBlocks([]);
    setAvailableBlocks(initialBlockTypes);
    setIsGameWon(false);
    setTimer(0);
    setSolutionTime(null);
    setSolutionError(null);
  }, [gameId]);

  // 获取解决方案
  const handleGetSolution = async () => {
    if (!gameId) return;
    
    setIsFetchingSolution(true);
    setSolutionTime(null);
    setSolutionError(null);
    
    const startTime = Date.now();
    
    try {
      const solution = await fetchSolution(gameId, droppedBlocks, uncoverableCells);
      
      const endTime = Date.now();
      setSolutionTime((endTime - startTime) / 1000);
      
      // 应用解决方案
      if (solution.droppedBlocks) {
        setDroppedBlocks(solution.droppedBlocks);
        const placedBlockIds = solution.droppedBlocks.map((b: any) => b.id);
        setAvailableBlocks(initialBlockTypes.filter(b => !placedBlockIds.includes(b.id)));
      }
    } catch (error: any) {
      setSolutionError(error.message || '获取解决方案失败');
    } finally {
      setIsFetchingSolution(false);
    }
  };

  // 处理触摸事件
  const handleTouchStart = useCallback((e: any) => {
    const { clientX, clientY } = e.touches[0];
    touchStartRef.current = {
      x: clientX,
      y: clientY,
      time: Date.now()
    };
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    if (!touchStartRef.current) return;
    
    const { clientX, clientY } = e.touches[0];
    const deltaX = clientX - touchStartRef.current.x;
    const deltaY = clientY - touchStartRef.current.y;
    
    // 计算预览位置
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const gridX = Math.floor((clientX - rect.left) / (CELL_SIZE + GAP_SIZE));
      const gridY = Math.floor((clientY - rect.top) / (CELL_SIZE + GAP_SIZE));
      
      if (selectedBlockRef.current) {
        const block = [...availableBlocks, ...droppedBlocks].find(b => b.id === selectedBlockRef.current);
        if (block) {
          const preview = { ...block, x: gridX, y: gridY };
          setPreviewBlock(preview);
        }
      }
    }
  }, [availableBlocks, droppedBlocks]);

  const handleTouchEnd = useCallback((e: any) => {
    if (!touchStartRef.current || !selectedBlockRef.current) return;
    
    const duration = Date.now() - touchStartRef.current.time;
    
    if (duration < 300) {
      // 短按 - 放置方块
      if (previewBlock) {
        handleBlockDrop(previewBlock, previewBlock.x || 0, previewBlock.y || 0);
      }
    }
    
    touchStartRef.current = null;
    selectedBlockRef.current = null;
    setPreviewBlock(null);
  }, [previewBlock, handleBlockDrop]);

  if (isLoading) {
    return <View style={{ padding: 20, textAlign: 'center' }}><Text>加载中...</Text></View>;
  }

  return (
    <View style={{ padding: 20, backgroundColor: '#f5f5f5' }}>
      {/* 游戏标题和计时器 */}
      <View style={{ marginBottom: 20, textAlign: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>
          日历拼图游戏
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 10 }}>
          <Text style={{ fontSize: 16 }}>游戏ID: {gameId}</Text>
          <Text style={{ fontSize: 16, color: '#007AFF' }}>时间: {formatTime(timer)}</Text>
        </View>
        {isGameWon && (
          <Text style={{ fontSize: 20, color: '#00C851', fontWeight: 'bold', marginTop: 10 }}>
            🎉 恭喜！游戏胜利！ 🎉
          </Text>
        )}
      </View>

      {/* 棋盘 */}
      <View style={{ marginBottom: 20 }}>
        <View
          ref={gridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${boardLayoutData[0].length}, ${CELL_SIZE}px)`,
            gap: `${GAP_SIZE}px`,
            border: '2px solid #333',
            padding: '10px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            position: 'relative',
            margin: '0 auto',
            width: 'fit-content'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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

          {/* 已放置的方块 */}
          {droppedBlocks.map((block) => {
            const position = calculateBlockPosition(block);
            return (
              <BlockComponent
                key={`placed-${block.id}`}
                block={block}
                isPlaced={true}
                position={position}
                onRotate={() => handleRotate(block.id, true)}
                onFlip={() => handleFlip(block.id, true)}
                onReturn={() => handleReturnToPanel(block.id)}
              />
            );
          })}

          {/* 预览方块 */}
          {previewBlock && (
            <BlockComponent
              block={previewBlock}
              isPlaced={true}
              position={calculateBlockPosition(previewBlock)}
              isPreview={true}
            />
          )}
        </View>
      </View>

      {/* 控制按钮 */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
        <Button
          type="primary"
          size="mini"
          onClick={clearGameState}
          style={{ margin: 0 }}
        >
          重新开始
        </Button>
        <Button
          type="primary"
          size="mini"
          onClick={handleGetSolution}
          loading={isFetchingSolution}
          style={{ margin: 0 }}
        >
          获取提示
        </Button>
      </View>

      {/* 解决方案信息 */}
      {(solutionTime || solutionError) && (
        <View style={{ textAlign: 'center', marginBottom: 20 }}>
          {solutionTime && (
            <Text style={{ color: '#007AFF', marginBottom: 5 }}>
              解决方案耗时: {solutionTime.toFixed(2)}秒
            </Text>
          )}
          {solutionError && (
            <Text style={{ color: '#FF4444' }}>
              {solutionError}
            </Text>
          )}
        </View>
      )}

      {/* 可用的方块 */}
      <View>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
          可用方块 ({availableBlocks.length})
        </Text>
        <ScrollView
          scrollX
          style={{ whiteSpace: 'nowrap', padding: 10 }}
        >
          <View style={{ flexDirection: 'row', gap: 15 }}>
            {availableBlocks.map(block => (
              <BlockComponent
                key={block.id}
                block={block}
                isPlaced={false}
                onRotate={() => handleRotate(block.id, false)}
                onFlip={() => handleFlip(block.id, false)}
                onSelect={() => {
                  selectedBlockRef.current = block.id;
                  setPreviewBlock(block);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default CalendarGame;