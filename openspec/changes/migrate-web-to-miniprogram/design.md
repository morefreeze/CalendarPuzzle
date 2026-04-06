# Technical Design: Migrate Web Frontend to WeChat Mini Program

## Architecture Overview

### Current Web Architecture
```
my-cal/
├── components/
│   ├── PlayBoard.js      # Main game logic with drag-drop
│   ├── DraggableBlock.js # Individual block component
│   ├── CalendarGrid.js   # Grid wrapper
│   ├── GridCell.js       # Individual cell
│   └── InitBoard.js     # Constants and utilities
└── utils/
    └── logger.js         # Logging utilities

Dependencies:
- react-dnd + react-dnd-html5-backend (drag-drop)
- localStorage (persistence)
- fetch (API calls)
```

### Target Mini Program Architecture
```
calendar-puzzle-miniprogram/CalendarPuzzle/src/
├── components/
│   ├── PlayBoard.tsx       # Main game logic (NEW)
│   ├── DraggableBlock.tsx   # Touch-based drag-drop (MODIFIED)
│   ├── CalendarGrid.tsx     # Grid wrapper (MODIFIED)
│   ├── GridCell.tsx         # Individual cell (MODIFIED)
│   └── InitBoard.tsx       # Constants and utilities (NEW)
├── hooks/
│   ├── useGameTimer.tsx     # Timer management (NEW)
│   ├── useGamePersistence.tsx # Storage management (NEW)
│   └── useSolver.tsx       # API integration (NEW)
├── utils/
│   ├── logger.tsx           # Logging utilities (NEW)
│   ├── api.tsx              # API client (NEW)
│   └── storage.tsx         # Storage wrapper (NEW)
└── types/
    └── game.tsx            # TypeScript types (NEW)

Dependencies:
- Taro touch events (drag-drop replacement)
- wx.setStorageSync (persistence)
- wx.request (API calls)
```

## Technical Decisions

### 1. Drag-and-Drop System

#### Problem
`react-dnd` and `react-dnd-html5-backend` don't work in WeChat mini programs because:
- They rely on HTML5 Drag and Drop API
- Mini programs don't support standard DOM events
- Touch events are handled differently

#### Solution: Custom Touch-Based Drag System

**Component Structure:**
```typescript
// DraggableBlock.tsx
interface DraggableBlockProps {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  onDragStart: () => void;
  onDragEnd: (didDrop: boolean) => void;
  onRotate: () => void;
  onFlip: () => void;
  isPlaced: boolean;
}

// Touch event handlers
onTouchStart: Begin drag, record initial position
onTouchMove: Update preview position, validate placement
onTouchEnd: Finalize placement or return to panel
onLongPress: Trigger flip (500ms threshold)
onTap: Trigger rotation
```

**Touch Event Flow:**
```
1. User touches block
   → onTouchStart fires
   → Set isDragging = true
   → Record initial touch coordinates
   → Start long-press timer

2. User moves finger
   → onTouchMove fires
   → Calculate new position
   → Update preview block
   → Validate placement (green/red)
   → Reset long-press timer

3. User releases finger
   → onTouchEnd fires
   → Clear long-press timer
   → If valid: place block
   → If invalid: return to panel
   → Set isDragging = false

4. Long press detected
   → Trigger flip
   → Update shape
   → Continue drag with new shape
```

**Position Calculation:**
```typescript
const calculateGridPosition = (
  touchX: number,
  touchY: number,
  gridRect: DOMRect
): { x: number; y: number } => {
  const cellSize = 70; // CELL_SIZE
  const gapSize = 0; // GAP_SIZE
  const relativeX = touchX - gridRect.left;
  const relativeY = touchY - gridRect.top;
  const gridX = Math.floor(relativeX / (cellSize + gapSize));
  const gridY = Math.floor(relativeY / (cellSize + gapSize));
  return { x: gridX, y: gridY };
};
```

### 2. State Management

#### Game State Structure
```typescript
interface GameState {
  timer: number;
  gameId: string;
  droppedBlocks: PlacedBlock[];
  remainingBlocks: BlockType[];
  isGameWon: boolean;
  isFetchingSolution: boolean;
  solutionTime: number | null;
  solutionError: string | null;
}

interface PlacedBlock {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  x: number;
  y: number;
}

interface BlockType {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  key: string; // Keyboard shortcut
}
```

#### State Persistence Strategy
```typescript
// storage.tsx
export const storage = {
  saveGameState: (gameId: string, state: GameState) => {
    try {
      const key = `calendarPuzzleState_${gameId}`;
      wx.setStorageSync(key, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save game state:', error);
    }
  },

  loadGameState: (gameId: string): GameState | null => {
    try {
      const key = `calendarPuzzleState_${gameId}`;
      const data = wx.getStorageSync(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load game state:', error);
      return null;
    }
  },

  saveTimer: (gameId: string, timer: number) => {
    try {
      const key = `calendarPuzzleTimer_${gameId}`;
      wx.setStorageSync(key, timer.toString());
    } catch (error) {
      console.error('Failed to save timer:', error);
    }
  },

  loadTimer: (gameId: string): number => {
    try {
      const key = `calendarPuzzleTimer_${gameId}`;
      const data = wx.getStorageSync(key);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error('Failed to load timer:', error);
      return 0;
    }
  },

  clearGameState: (gameId: string) => {
    try {
      wx.removeStorageSync(`calendarPuzzleState_${gameId}`);
      wx.removeStorageSync(`calendarPuzzleTimer_${gameId}`);
    } catch (error) {
      console.error('Failed to clear game state:', error);
    }
  }
};
```

### 3. Timer System

#### Timer Hook
```typescript
// useGameTimer.tsx
export const useGameTimer = (gameId: string, isGameWon: boolean) => {
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isGameWon) {
      stopTimer();
      return;
    }

    const savedTimer = storage.loadTimer(gameId);
    setTimer(savedTimer);

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        const newTimer = prev + 1;
        storage.saveTimer(gameId, newTimer);
        return newTimer;
      });
    }, 1000);

    return () => stopTimer();
  }, [gameId, isGameWon]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    setTimer(0);
    storage.saveTimer(gameId, 0);
  };

  return { timer, resetTimer };
};
```

### 4. API Integration

#### API Client
```typescript
// api.tsx
const API_BASE_URL = 'http://localhost:5001/api';

export const api = {
  fetchGameId: async (
    droppedBlocks: PlacedBlock[],
    remainingBlockTypes: BlockType[]
  ): Promise<string> => {
    try {
      const response = await new Promise<{ gameId: string }>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/game-id`,
          method: 'POST',
          data: { droppedBlocks, remainingBlockTypes },
          success: (res) => resolve(res.data),
          fail: (err) => reject(err)
        });
      });
      return response.gameId;
    } catch (error) {
      console.error('Failed to fetch game ID:', error);
      throw error;
    }
  },

  fetchSolution: async (
    gameId: string,
    droppedBlocks: PlacedBlock[],
    blockTypes: BlockType[],
    uncoverableCells: { x: number; y: number }[]
  ): Promise<Solution> => {
    try {
      const response = await new Promise<Solution>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/solution`,
          method: 'POST',
          data: {
            gameId,
            droppedBlocks: droppedBlocks.map(b => ({
              id: b.id,
              x: b.x,
              y: b.y,
              shape: b.shape
            })),
            uncoverableCells,
            blockTypes: blockTypes.map(b => ({
              id: b.id,
              shape: b.shape
            }))
          },
          success: (res) => {
            if (res.statusCode === 404) {
              reject({ status: 404, data: res.data });
            } else if (res.statusCode !== 200) {
              reject({ status: res.statusCode, data: res.data });
            } else {
              resolve(res.data);
            }
          },
          fail: (err) => reject(err)
        });
      });
      return response;
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error('No solution exists for current configuration');
      }
      console.error('Failed to fetch solution:', error);
      throw error;
    }
  }
};
```

#### Solver Hook
```typescript
// useSolver.tsx
export const useSolver = (
  gameId: string,
  droppedBlocks: PlacedBlock[],
  blockTypes: BlockType[],
  uncoverableCells: { x: number; y: number }[]
) => {
  const [isFetching, setIsFetching] = useState(false);
  const [solutionTime, setSolutionTime] = useState<number | null>(null);
  const [solutionError, setSolutionError] = useState<string | null>(null);

  const fetchSolution = async () => {
    setIsFetching(true);
    setSolutionTime(null);
    setSolutionError(null);

    const startTime = Date.now();

    try {
      const solution = await api.fetchSolution(
        gameId,
        droppedBlocks,
        blockTypes,
        uncoverableCells
      );

      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000;
      setSolutionTime(elapsedTime);

      return solution;
    } catch (error: any) {
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000;
      setSolutionTime(elapsedTime);

      if (error.message.includes('No solution')) {
        setSolutionError(
          `Current configuration has no solution! Solving time: ${elapsedTime.toFixed(3)}s. Please try adjusting block positions`
        );
      } else {
        setSolutionError(`Failed to fetch solution: ${error.message}`);
      }
      return null;
    } finally {
      setIsFetching(false);
    }
  };

  return { fetchSolution, isFetching, solutionTime, solutionError };
};
```

### 5. Game Initialization

#### Initialization Hook
```typescript
// useGameInitialization.tsx
export const useGameInitialization = () => {
  const [gameId, setGameId] = useState('');
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    const initialize = async () => {
      try {
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;

        const newGameId = await api.fetchGameId([], initialBlockTypes);
        setGameId(newGameId);
        initializedRef.current = true;
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize game:', error);
        const fallbackGameId = Math.abs(Date.now()).toString(36);
        setGameId(fallbackGameId);
        initializedRef.current = true;
        setLoading(false);
      }
    };

    initialize();
  }, []);

  return { gameId, loading };
};
```

### 6. Victory Detection

#### Victory Check Function
```typescript
const checkGameWin = (
  droppedBlocks: PlacedBlock[],
  uncoverableCells: { x: number; y: number }[]
): boolean => {
  if (droppedBlocks.length !== initialBlockTypes.length) {
    return false;
  }

  const placeableCells: { x: number; y: number }[] = [];
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

  const coveredCells = droppedBlocks.flatMap(block =>
    block.shape.flatMap((row, rIdx) =>
      row.map((cell, cIdx) =>
        cell === 1 ? { x: block.x + cIdx, y: block.y + rIdx } : null
      )
    ).filter(Boolean) as { x: number; y: number }[]
  );

  return placeableCells.every(cell =>
    coveredCells.some(covered => covered.x === cell.x && covered.y === cell.y)
  );
};
```

### 7. Component Hierarchy

```
App
└── Index (page)
    └── CalendarGrid
        └── PlayBoard
            ├── TimerDisplay
            ├── GameInfo (game IDs, block count)
            ├── ControlButtons (Get Solution, Restart)
            ├── SolutionDisplay (error/time)
            ├── VictoryMessage
            ├── GameBoard (grid)
            │   ├── GridCell (56 cells)
            │   ├── PreviewBlock
            │   └── PlacedBlocks
            │       └── DraggableBlock
            └── BlockPanel
                └── DraggableBlock (remaining blocks)
```

### 8. Touch Interaction Patterns

#### Single Tap (Rotation)
```typescript
const handleTap = (blockId: string) => {
  if (!isDragging) return;

  const rotatedShape = rotateShape(currentBlock.shape);
  setCurrentBlock(prev => ({ ...prev, shape: rotatedShape }));
};
```

#### Long Press (Flip)
```typescript
const handleLongPress = (blockId: string) => {
  if (!isDragging) return;

  const flippedShape = flipShape(currentBlock.shape);
  setCurrentBlock(prev => ({ ...prev, shape: flippedShape }));
};
```

#### Double Tap (Return to Panel)
```typescript
const handleDoubleTap = (blockId: string) => {
  if (!isPlaced) return;

  setDroppedBlocks(prev => prev.filter(b => b.id !== blockId));
  setRemainingBlocks(prev => [...prev, findBlockById(blockId)]);
};
```

### 9. Performance Optimizations

#### Memoization
```typescript
// Memoize expensive calculations
const uncoverableCells = useMemo(() => getUncoverableCells(), []);
const isValidPlacement = useCallback((block, coords) => {
  // Validation logic
}, [uncoverableCells, droppedBlocks]);
```

#### Debouncing
```typescript
// Debounce touch events
const debouncedTouchMove = useMemo(
  () => debounce(handleTouchMove, 16), // ~60fps
  []
);
```

#### Virtual Scrolling (if needed)
```typescript
// For large lists, use virtual scrolling
<VirtualList
  height={500}
  itemSize={70}
  data={blocks}
  renderItem={renderBlock}
/>
```

### 10. Error Handling

#### Global Error Boundary
```typescript
class ErrorBoundary extends Component {
  componentDidCatch(error, errorInfo) {
    logger.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
```

#### API Error Handling
```typescript
const handleApiError = (error: any) => {
  if (error.statusCode === 404) {
    showToast('No solution exists');
  } else if (error.statusCode >= 500) {
    showToast('Server error, please try again');
  } else {
    showToast('Network error, check connection');
  }
};
```

## Migration Strategy

### Phase 1: Core Infrastructure (Days 1-2)
1. Set up TypeScript types
2. Create utility modules (api, storage, logger)
3. Implement custom hooks (useGameTimer, useGamePersistence, useSolver)
4. Set up error boundary

### Phase 2: Drag-and-Drop System (Days 3-4)
1. Implement touch event handlers in DraggableBlock
2. Create preview block system
3. Implement placement validation
4. Add rotation/flip gestures

### Phase 3: Game Logic Integration (Days 5-6)
1. Migrate PlayBoard component
2. Integrate timer system
3. Add solver API integration
4. Implement victory detection

### Phase 4: Polish and Testing (Days 7-8)
1. Add loading states
2. Implement error messages
3. Add victory animation
4. Test on real devices
5. Performance optimization

## Testing Strategy

### Unit Tests
- Hook logic (useGameTimer, useSolver)
- Utility functions (rotateShape, flipShape, checkGameWin)
- API client (mock wx.request)

### Integration Tests
- Complete game flow
- State persistence
- API integration

### E2E Tests
- Real device testing
- Touch gesture testing
- Performance testing

## Deployment

### Build Process
```bash
# Development
npm run dev:weapp

# Production
npm run build:weapp
```

### WeChat Developer Tools
1. Open `dist` folder in WeChat Developer Tools
2. Test on simulator
3. Upload for review
4. Submit for release
