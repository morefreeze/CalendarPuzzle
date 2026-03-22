import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Button, Text } from '@tarojs/components';
import GridCell from './GridCell';
import DraggableBlock from './DraggableBlock';
import {
  CELL_SIZE,
  CELL_BOARDER,
  GAP_SIZE,
  boardLayoutData,
  initialBlockTypes,
  formatTime,
  getUncoverableCells,
  checkGameWin,
  isValidPlacement
} from './InitBoard';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { useGameTimer } from '../hooks/useGameTimer';
import { useGamePersistence } from '../hooks/useGamePersistence';
import { useSolver } from '../hooks/useSolver';
import { logAction, logDebug, logError } from '../utils/logger';
import { BlockType, PlacedBlock, UncoverableCell } from '../types/game';

const PlayBoard = () => {
  const { gameId, loading: initLoading } = useGameInitialization();
  const { timer, resetTimer } = useGameTimer(gameId || '', false);
  const { loadGameState, clearGameState } = useGamePersistence(
    gameId || '',
    [],
    initialBlockTypes
  );
  const { fetchSolution, isFetching, solutionTime, solutionError } = useSolver(
    gameId || '',
    [],
    initialBlockTypes,
    []
  );

  const [droppedBlocks, setDroppedBlocks] = useState<PlacedBlock[]>([]);
  const [previewBlock, setPreviewBlock] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [blockTypes, setBlockTypes] = useState<BlockType[]>(initialBlockTypes);
  const [isGameWon, setIsGameWon] = useState(false);

  const gridRef = useRef<any>(null);
  const droppedBlocksRef = useRef(droppedBlocks);
  droppedBlocksRef.current = droppedBlocks;

  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  useEffect(() => {
    if (gameId) {
      const savedState = loadGameState(gameId);
      if (savedState) {
        try {
          setDroppedBlocks(savedState.droppedBlocks || []);
          setBlockTypes(savedState.remainingBlocks || initialBlockTypes);
          logDebug('Game state loaded from storage');
        } catch (error) {
          logError('Failed to load saved game state:', error);
        }
      }
    }
  }, [gameId, loadGameState]);

  useEffect(() => {
    if (droppedBlocks.length > 0 && !isGameWon) {
      const won = checkGameWin(droppedBlocks, uncoverableCells);
      if (won) {
        setIsGameWon(true);
        logAction('Game won! Victory achieved');
      }
    }
  }, [droppedBlocks, isGameWon, uncoverableCells]);

  const clearGameStateHandler = useCallback(() => {
    if (gameId) {
      clearGameState(gameId);
      setDroppedBlocks([]);
      setBlockTypes(initialBlockTypes);
      setIsGameWon(false);
      resetTimer();
      Taro.reLaunch({ url: '/pages/index/index' });
    }
  }, [gameId, clearGameState, resetTimer]);

  const calculateDropPosition = useCallback((touchX: number, touchY: number) => {
    if (!gridRef.current) {
      return null;
    }
    const gridRect = gridRef.current.getBoundingClientRect();
    const xPos = touchX - gridRect.left;
    const yPos = touchY - gridRect.top;
    const gridX = Math.floor(xPos / (CELL_SIZE + GAP_SIZE));
    const gridY = Math.floor(yPos / (CELL_SIZE + GAP_SIZE));
    return { x: gridX, y: gridY };
  }, []);

  const handleRotate = useCallback((blockId: string) => {
    setBlockTypes(prev => {
      const updated = prev.map((b: BlockType) => {
        if (b.id === blockId) {
          const rows = b.shape.length;
          const cols = b.shape[0].length;
          const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              newShape[col][rows - 1 - row] = b.shape[row][col];
            }
          }
          return { ...b, shape: newShape };
        }
        return b;
      });
      return updated;
    });
  }, []);

  const handleFlip = useCallback((blockId: string) => {
    setBlockTypes(prev => {
      const updated = prev.map((b: BlockType) => {
        if (b.id === blockId) {
          return { ...b, shape: b.shape.map((row: number[]) => [...row].reverse()) };
        }
        return b;
      });
      return updated;
    });
  }, []);

  const calculateBlockPosition = useCallback((block: PlacedBlock) => ({
    left: block.x * (CELL_SIZE + GAP_SIZE),
    top: block.y * (CELL_SIZE + GAP_SIZE),
  }), []);

  const handleBlockDragEnd = useCallback((didDrop: boolean, blockId: string) => {
    if (!didDrop) {
      setDroppedBlocks(prev => prev.filter((b: PlacedBlock) => b.id !== blockId));
      const blockToReturn = droppedBlocksRef.current.find((b: PlacedBlock) => b.id === blockId);
      if (blockToReturn) {
        setBlockTypes(prev => [...prev, blockToReturn as BlockType]);
      }
      setPreviewBlock(null);
    }
  }, []);

  const handleDoubleClick = useCallback((blockId: string) => {
    logAction('Double clicked block, returning to panel:', blockId);
    setDroppedBlocks(prev => {
      const blockIndex = prev.findIndex((b: PlacedBlock) => b.id === blockId);
      if (blockIndex === -1) {
        logDebug('Block not found in droppedBlocks:', blockId);
        return prev;
      }
      const blockToReturn = prev[blockIndex];
      setBlockTypes(prevTypes => {
        const existingIds = new Set(prevTypes.map((b: BlockType) => b.id));
        if (!existingIds.has(blockId)) {
          return [...prevTypes, blockToReturn as BlockType];
        }
        return prevTypes;
      });
      return prev.filter((b: PlacedBlock) => b.id !== blockId);
    });
  }, []);

  const handleDrop = useCallback((block: BlockType, position: { x: number; y: number }) => {
    const isPlacementValid = isValidPlacement(
      block,
      position,
      droppedBlocksRef.current,
      uncoverableCells,
      null
    );

    if (isPlacementValid) {
      const newBlock = { ...block, ...position };
      const existingBlockIndex = droppedBlocksRef.current.findIndex((b: PlacedBlock) => b.id === block.id);
      if (existingBlockIndex >= 0) {
        setDroppedBlocks(prev => {
          const updatedBlocks = [...prev];
          updatedBlocks[existingBlockIndex] = newBlock;
          return updatedBlocks;
        });
      } else {
        setDroppedBlocks(prev => [...prev, newBlock]);
        setBlockTypes(prev => prev.filter((b: BlockType) => b.id !== block.id));
      }
    }
    setPreviewBlock(null);
  }, [uncoverableCells]);

  if (initLoading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Text>Loading game...</Text>
      </View>
    );
  }

  return (
    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
        Time: {formatTime(timer)}
      </Text>

      <View style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '10px',
        fontSize: '14px',
        color: '#666'
      }}>
        <Text>Game ID: {gameId}</Text>
      </View>

      <View style={{
        fontSize: '12px',
        color: '#888',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        Placed: {droppedBlocks.length} / {initialBlockTypes.length} blocks
      </View>

      <View style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Button
          onClick={fetchSolution}
          disabled={isFetching}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: isFetching ? '#cccccc' : '#4CAF50',
            color: 'white'
          }}
        >
          {isFetching ? 'Solving...' : 'Get Solution'}
        </Button>

        <Button
          onClick={clearGameStateHandler}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#f44336',
            color: 'white'
          }}
        >
          Restart
        </Button>
      </View>

      {solutionTime !== null && (
        <View style={{
          fontSize: '16px',
          color: '#2196F3',
          marginBottom: '10px',
          fontWeight: 'bold'
        }}>
          Solving time: {solutionTime.toFixed(3)}s
        </View>
      )}

      {solutionError && (
        <View style={{
          fontSize: '14px',
          color: '#f44336',
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          border: '1px solid #f44336',
          maxWidth: '300px',
          textAlign: 'center'
        }}>
          {solutionError}
        </View>
      )}

      {isGameWon && (
        <View style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#FF4500',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          Congratulations, you won!
        </View>
      )}

      <View
        ref={gridRef}
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
            const isUncovered = uncoverableCells.some((c: UncoverableCell) => c.x === x && c.y === y);
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
            <View
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
              {previewBlock.shape.map((row: number[], rowIndex: number) => (
                <View key={rowIndex} style={{ display: 'flex' }}>
                  {row.map((cell: number, cellIndex: number) => (
                    cell ? (
                      <View
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
                      <View
                        key={cellIndex}
                        style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                      />
                    )
                  ))}
                </View>
              ))}
            </View>
          );
        })()}

        {droppedBlocks.map((block: PlacedBlock) => {
          const position = calculateBlockPosition(block);
          return (
            <DraggableBlock
              key={`dropped-${block.id}`}
              id={block.id}
              label={block.label}
              color={block.color}
              shape={block.shape}
              onDragEnd={(didDrop: boolean) => handleBlockDragEnd(didDrop, block.id)}
              onDoubleClick={() => handleDoubleClick(block.id)}
              isPlaced={true}
              style={{ position: 'absolute', left: `${position.left}px`, top: `${position.top}px` }}
            />
          );
        })}
      </View>

      <View style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {blockTypes.map((block: BlockType) => (
          <DraggableBlock
            key={block.id}
            id={block.id}
            label={block.label}
            color={block.color}
            shape={block.shape}
            onRotate={() => handleRotate(block.id)}
            onFlip={() => handleFlip(block.id)}
            isPlaced={false}
          />
        ))}
      </View>
    </View>
  );
};

export default PlayBoard;
