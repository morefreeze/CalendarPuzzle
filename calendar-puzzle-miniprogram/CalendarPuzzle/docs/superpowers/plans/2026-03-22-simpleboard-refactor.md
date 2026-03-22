# SimpleBoard Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SimpleBoard work correctly in WeChat mini-program by replacing web-only CSS patterns with WeChat-compatible Flexbox + SCSS classes.

**Architecture:** Replace all inline styles and CSS Grid in SimpleBoard.tsx with SCSS classes using Flexbox row-column nesting and rpx units. Fix peripheral bugs in storage.tsx, useGameInitialization.tsx, and types/game.tsx.

**Tech Stack:** Taro 4.1.5, React 18, TypeScript, SCSS, WeChat mini-program

**Spec:** `docs/superpowers/specs/2026-03-22-simpleboard-refactor-design.md`

**Note:** No test framework is configured in this project. Verification is done via `npm run build:weapp` (compile check) and manual testing in WeChat Developer Tools.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/game.tsx` | Modify | Add optional `key` field to `PlacedBlock` |
| `src/utils/storage.tsx` | Modify | Add missing logger import |
| `src/hooks/useGameInitialization.tsx` | Modify | Remove duplicate data, import from InitBoard |
| `src/components/SimpleBoard.scss` | Create | All styles for SimpleBoard |
| `src/components/SimpleBoard.tsx` | Rewrite | Flexbox layout, className refs, fix interactions |

---

### Task 1: Fix peripheral bugs

**Files:**
- Modify: `src/utils/storage.tsx:1` (add import)
- Modify: `src/types/game.tsx:12-19` (add key to PlacedBlock)
- Modify: `src/hooks/useGameInitialization.tsx:1-28` (remove duplicates)

- [ ] **Step 1: Add missing import to storage.tsx**

Add at line 2 of `src/utils/storage.tsx`:

```typescript
import { logDebug, logError } from './logger';
```

The file uses `logDebug()` and `logError()` throughout but never imports them.

- [ ] **Step 2: Add optional `key` field to PlacedBlock interface**

In `src/types/game.tsx`, change the `PlacedBlock` interface to:

```typescript
export interface PlacedBlock {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  key?: string;
  x: number;
  y: number;
}
```

The `key` is optional because PlacedBlock objects from API/storage may not have it. SimpleBoard always sets it when placing blocks locally.

- [ ] **Step 3: Remove duplicate data from useGameInitialization.tsx**

Replace the entire file `src/hooks/useGameInitialization.tsx` with:

```typescript
import { useState, useEffect } from 'react';
import { logDebug } from '../utils/logger';

export const useGameInitialization = () => {
  const [gameId, setGameId] = useState('demo-board');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    logDebug('Demo mode: No API initialization needed');
  }, []);

  return { gameId, loading };
};
```

This removes the duplicated `initialBlockTypes` and `boardLayoutData` (which are already defined in `InitBoard.tsx`) and the unused imports (`useRef`, `storage`, `BlockType`, `BoardCell`).

- [ ] **Step 4: Verify build**

Run: `cd CalendarPuzzle && npm run build:weapp 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.tsx src/types/game.tsx src/hooks/useGameInitialization.tsx
git commit -m "fix: add missing imports and remove duplicate data definitions"
```

---

### Task 2: Create SimpleBoard.scss

**Files:**
- Create: `src/components/SimpleBoard.scss`

- [ ] **Step 1: Create the SCSS file**

Create `src/components/SimpleBoard.scss` with all styles needed by the refactored SimpleBoard. Every class listed here will be referenced in Task 3.

```scss
// SimpleBoard.scss — WeChat mini-program compatible styles
// Uses rpx units and Flexbox only (no CSS Grid)

.simple-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx;
  box-sizing: border-box;
}

// Header
.header-timer {
  font-size: 48rpx;
  font-weight: bold;
  margin-bottom: 16rpx;
  color: #333;
}

.header-game-id {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.header-count {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 16rpx;
}

.message {
  font-size: 28rpx;
  margin-bottom: 16rpx;
  font-weight: bold;
}

.message-win {
  color: #FF4500;
}

.message-info {
  color: #2196F3;
}

// Control buttons
.controls {
  display: flex;
  flex-direction: row;
  margin-bottom: 24rpx;
}

.btn {
  padding: 16rpx 32rpx;
  color: #fff;
  font-size: 28rpx;
  border-radius: 8rpx;
  text-align: center;
  margin-right: 16rpx;

  &:last-child {
    margin-right: 0;
  }
}

.btn-rotate {
  background-color: #4CAF50;
}

.btn-flip {
  background-color: #2196F3;
}

.btn-reset {
  background-color: #f44336;
}

.btn-disabled {
  background-color: #ccc;
}

// Game board
.board-container {
  margin-bottom: 32rpx;
  border: 8rpx solid #333;
  background-color: #f5f5f5;
  box-sizing: border-box;
}

.board-row {
  display: flex;
  flex-direction: row;
}

.board-cell {
  width: 90rpx;
  height: 90rpx;
  border: 2rpx solid #000;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cell-month {
  background-color: #FFB6C1;
}

.cell-day {
  background-color: #90EE90;
}

.cell-weekday {
  background-color: #87CEFA;
}

.cell-empty {
  background-color: #fff;
}

.cell-uncoverable {
  background-color: #F0E68C;
}

.cell-label {
  font-size: 22rpx;
  font-weight: bold;
  color: #333;
}

// Selected block preview
.preview-container {
  margin-bottom: 24rpx;
  padding: 16rpx;
  border: 4rpx solid #4CAF50;
  border-radius: 12rpx;
  background-color: #f0f0f0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-label {
  font-size: 28rpx;
  margin-bottom: 8rpx;
}

.preview-row {
  display: flex;
  flex-direction: row;
}

.preview-cell {
  width: 50rpx;
  height: 50rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

// Available blocks palette
.palette-title {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 16rpx;
}

.palette-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
}

.palette-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  background-color: #fff;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}

.palette-item-selected {
  border: 4rpx solid #4CAF50;
  background-color: #e8f5e9;
}

.palette-item-label {
  font-size: 24rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.palette-shape-row {
  display: flex;
  flex-direction: row;
}

.palette-shape-cell {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

// Placed blocks list
.placed-section {
  margin-top: 32rpx;
  width: 100%;
}

.placed-title {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 16rpx;
  text-align: center;
}

.placed-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
}

.placed-btn {
  padding: 10rpx 20rpx;
  font-size: 24rpx;
  color: #000;
  border-radius: 8rpx;
  text-align: center;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
}

// Loading
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SimpleBoard.scss
git commit -m "feat: add SimpleBoard SCSS styles for WeChat compatibility"
```

---

### Task 3: Rewrite SimpleBoard.tsx

**Files:**
- Rewrite: `src/components/SimpleBoard.tsx`

This is the core task. Replace the entire file with the refactored version below.

- [ ] **Step 1: Rewrite SimpleBoard.tsx**

Replace the entire contents of `src/components/SimpleBoard.tsx` with:

```tsx
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
```

Key changes from original:
- Removed: `React` import (not needed with react-jsx), `Button`, `GridCell`, `CELL_SIZE`, `CELL_BOARDER`, `GAP_SIZE`
- Added: `checkGameWin` import, `./SimpleBoard.scss` import
- All inline styles → className references to SimpleBoard.scss
- CSS Grid → Flexbox rows (board, previews, palette)
- `gap` → margin-based spacing in SCSS
- `<Button>` → `<View>` with SCSS classes
- Timer stops on win (`isGameWon` in useEffect deps)
- Win condition uses `checkGameWin()` for full coverage validation
- Block removal uses preserved `key` field from PlacedBlock (with fallback for API-sourced blocks)
- All text inside `<View>` buttons wrapped in `<Text>` for WeChat compatibility
- Cell click relaxed: only checks `!isEmpty`, lets `isValidPlacement` handle the rest
- Clicking a placed block on the board removes it (when no block is selected)

- [ ] **Step 2: Verify build**

Run: `cd CalendarPuzzle && npm run build:weapp 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SimpleBoard.tsx
git commit -m "refactor: rewrite SimpleBoard for WeChat mini-program compatibility

Replace CSS Grid with Flexbox, inline styles with SCSS classes,
fix block placement/removal interactions, fix timer and win condition."
```

---

### Task 4: Smoke test in WeChat Developer Tools

**Files:** None (manual verification)

- [ ] **Step 1: Build for WeChat**

Run: `cd CalendarPuzzle && npm run build:weapp`

- [ ] **Step 2: Manual verification checklist**

Open `dist/` folder in WeChat Developer Tools and verify:

1. Board renders as 8x7 grid with correct colors (pink=month, green=day, blue=weekday)
2. Today's date/month/weekday cells are yellow
3. Clicking a palette block selects it (green border highlight)
4. Clicking a board cell places the selected block at correct position with block color
5. Rotate button changes the selected block's shape
6. Flip button mirrors the selected block's shape
7. Clicking "Placed Blocks" button removes block and returns it to palette
8. Clicking a placed block on the board (with no block selected) removes it
9. All 10 blocks placed covering all coverable cells → win message, timer stops
10. Reset clears everything
