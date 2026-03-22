import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, Button } from '@tarojs/components';
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
  isValidPlacement,
  rotateShape,
  flipShape
} from './InitBoard';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { BlockType, PlacedBlock, UncoverableCell } from '../types/game';

// Grid offset is fixed based on layout calculation
const GRID_OFFSET_X = 20; // Left margin
const GRID_OFFSET_Y = 150; // Top margin (header + timer area)

const InteractiveBoard = () => {
  const { gameId, loading: initLoading } = useGameInitialization();
  const [timer, setTimer] = useState(0);
  const [droppedBlocks, setDroppedBlocks] = useState<PlacedBlock[]>([]);
  const [blockTypes, setBlockTypes] = useState<BlockType[]>(initialBlockTypes);
  const [isGameWon, setIsGameWon] = useState(false);
  
  const droppedBlocksRef = useRef(droppedBlocks);
  droppedBlocksRef.current = droppedBlocks;

  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  // Timer
  useEffect(() => {
    if (initLoading) return;
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [initLoading]);

  // Check win condition
  useEffect(() => {
    if (droppedBlocks.length === initialBlockTypes.length && !isGameWon) {
      setIsGameWon(true);
    }
  }, [droppedBlocks, isGameWon]);

  const calculateDropPosition = useCallback((touchX: number, touchY: number) => {
    const xPos = touchX - GRID_OFFSET_X;
    const yPos = touchY - GRID_OFFSET_Y;
    const gridX = Math.floor(xPos / (CELL_SIZE + GAP_SIZE));
    const gridY = Math.floor(yPos / (CELL_SIZE + GAP_SIZE));
    
    // Validate bounds
    if (gridX < 0 || gridX >= boardLayoutData[0].length || 
        gridY < 0 || gridY >= boardLayoutData.length) {
      return null;
    }
    
    return { x: gridX, y: gridY };
  }, []);

  const handleRotate = useCallback((blockId: string) => {
    setBlockTypes(prev => prev.map(b => 
      b.id === blockId ? { ...b, shape: rotateShape(b.shape) } : b
    ));
  }, []);

  const handleFlip = useCallback((blockId: string) => {
    setBlockTypes(prev => prev.map(b => 
      b.id === blockId ? { ...b, shape: flipShape(b.shape) } : b
    ));
  }, []);

  const handleDragStart = useCallback((blockId: string) => {
    // Could add visual feedback here
  }, []);

  const handleDragEnd = useCallback((blockId: string, touchX: number, touchY: number) => {
    const position = calculateDropPosition(touchX, touchY);
    if (!position) return;

    // Find the block being dragged
    const block = blockTypes.find(b => b.id === blockId) || 
                  droppedBlocks.find(b => b.id === blockId);
    
    if (!block) return;

    // Check if placement is valid
    const isValid = isValidPlacement(
      block,
      position,
      droppedBlocksRef.current,
      uncoverableCells,
      blockId
    );

    if (isValid) {
      // Add block to dropped blocks
      const newBlock: PlacedBlock = { ...block, ...position };
      
      setDroppedBlocks(prev => {
        const existingIndex = prev.findIndex(b => b.id === blockId);
        if (existingIndex >= 0) {
          // Update existing block position
          const updated = [...prev];
          updated[existingIndex] = newBlock;
          return updated;
        }
        // Add new block
        return [...prev, newBlock];
      });

      // Remove from available blocks if it was there
      setBlockTypes(prev => prev.filter(b => b.id !== blockId));
    }
  }, [blockTypes, droppedBlocks, uncoverableCells, calculateDropPosition]);

  const handleDoubleClick = useCallback((blockId: string) => {
    // Return block to available blocks
    const block = droppedBlocks.find(b => b.id === blockId);
    if (block) {
      setDroppedBlocks(prev => prev.filter(b => b.id !== blockId));
      // Add key property to make it compatible with BlockType
      const blockWithKey = { ...block, key: block.id.charAt(0).toLowerCase() };
      setBlockTypes(prev => [...prev, blockWithKey as BlockType]);
    }
  }, [droppedBlocks]);

  const resetGame = useCallback(() => {
    setDroppedBlocks([]);
    setBlockTypes(initialBlockTypes);
    setIsGameWon(false);
    setTimer(0);
  }, []);

  if (initLoading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
        Time: {formatTime(timer)}
      </Text>

      <Text style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
        Game ID: {gameId}
      </Text>

      <Text style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
        Placed: {droppedBlocks.length} / {initialBlockTypes.length} blocks
      </Text>

      {isGameWon && (
        <Text style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          color: '#FF4500', 
          marginBottom: '20px' 
        }}>
          🎉 Congratulations! You Won! 🎉
        </Text>
      )}

      <Button 
        onClick={resetGame}
        style={{ 
          marginBottom: '20px', 
          backgroundColor: '#f44336', 
          color: 'white',
          padding: '10px 20px'
        }}
      >
        Reset Game
      </Button>

      {/* Game Board */}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${boardLayoutData[0].length}, ${CELL_SIZE}px)`,
          gap: `${GAP_SIZE}px`,
          marginBottom: '20px',
          border: '10px solid #333',
          padding: '0px',
          position: 'relative',
          backgroundColor: '#f5f5f5'
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

        {/* Placed Blocks */}
        {droppedBlocks.map((block) => (
          <View
            key={`placed-${block.id}`}
            style={{
              position: 'absolute',
              left: block.x * (CELL_SIZE + GAP_SIZE),
              top: block.y * (CELL_SIZE + GAP_SIZE),
              pointerEvents: 'none'
            }}
          >
            {block.shape.map((row, rIdx) => (
              <View key={rIdx} style={{ display: 'flex' }}>
                {row.map((cell, cIdx) => (
                  cell ? (
                    <View
                      key={cIdx}
                      style={{
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                        backgroundColor: block.color,
                        border: `${CELL_BOARDER}px solid rgba(0,0,0,0.5)`,
                        boxSizing: 'border-box'
                      }}
                    />
                  ) : (
                    <View
                      key={cIdx}
                      style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                    />
                  )
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Available Blocks */}
      <Text style={{ fontSize: '16px', color: '#666', marginBottom: '10px' }}>
        Available Blocks ({blockTypes.length})
      </Text>

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
            onDragStart={() => handleDragStart(block.id)}
            onDragEnd={(didDrop: boolean, touchX?: number, touchY?: number) => {
              if (typeof touchX === 'number' && typeof touchY === 'number') {
                handleDragEnd(block.id, touchX, touchY);
              }
            }}
            isPlaced={false}
          />
        ))}
      </View>
    </View>
  );
};

export default InteractiveBoard;
