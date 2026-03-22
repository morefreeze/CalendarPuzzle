import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
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

const SimpleBoard = () => {
  const { gameId, loading: initLoading } = useGameInitialization();
  const [timer, setTimer] = useState(0);
  const [droppedBlocks, setDroppedBlocks] = useState<PlacedBlock[]>([]);
  const [blockTypes, setBlockTypes] = useState<BlockType[]>(initialBlockTypes);
  const [isGameWon, setIsGameWon] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockType | null>(null);
  const [message, setMessage] = useState('');

  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

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

  // handleRemoveBlock must be defined before handleCellClick (no hoisting with const)
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

  const handleCellClick = useCallback((x: number, y: number) => {
    if (!selectedBlock) {
      // If no block selected, check if clicking a placed block to remove it
      const placedBlock = getBlockAtCell(x, y);
      if (placedBlock) {
        handleRemoveBlock(placedBlock.id);
        return;
      }
      setMessage('Please select a block first');
      return;
    }

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
  }, [selectedBlock, droppedBlocks, uncoverableCells, getBlockAtCell, handleRemoveBlock]);

  const handleBlockSelect = useCallback((block: BlockType) => {
    setSelectedBlock(block);
    setMessage(`Selected: ${block.label} - Click on board to place`);
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

  const resetGame = useCallback(() => {
    setDroppedBlocks([]);
    setBlockTypes(initialBlockTypes);
    setIsGameWon(false);
    setTimer(0);
    setSelectedBlock(null);
    setMessage('');
  }, []);

  if (initLoading) {
    return (
      <View className='loading-container'>
        <Text>Loading...</Text>
      </View>
    );
  }

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

      {/* Control Buttons — use View+Text instead of Button to avoid WeChat native button styles */}
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

              // Determine background: placed block color > uncoverable > cell type
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
                  onClick={() => !isEmpty && handleCellClick(x, y)}
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
      {selectedBlock && (
        <View className='preview-container'>
          <Text className='preview-label'>
            Selected: {selectedBlock.label}
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
            Placed Blocks (Click to remove)
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
    </View>
  );
};

export default SimpleBoard;
