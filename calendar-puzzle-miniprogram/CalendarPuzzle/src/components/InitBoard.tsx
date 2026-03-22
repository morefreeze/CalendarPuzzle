import { UncoverableCell } from '../types/game';

export const CELL_SIZE = 70;
export const CELL_BOARDER = 1;
export const GAP_SIZE = 0;
export const LONG_PRESS_THRESHOLD = 500;

export const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const getUncoverableCells = (): UncoverableCell[] => {
  const today = new Date();
  const currentMonth = today.toLocaleString('en-US', { month: 'short' });
  const currentDay = today.getDate();
  const currentWeekday = today.toLocaleString('en-US', { weekday: 'short' });

  const coords: UncoverableCell[] = [];
  boardLayoutData.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (
        (cell.type === 'month' && cell.value === currentMonth) ||
        (cell.type === 'day' && cell.value === currentDay) ||
        (cell.type === 'weekday' && cell.value === currentWeekday)
      ) {
        coords.push({ x, y });
      }
    });
  });
  return coords;
};

export const checkGameWin = (
  droppedBlocks: any[],
  uncoverableCells: UncoverableCell[]
): boolean => {
  if (droppedBlocks.length !== initialBlockTypes.length) {
    return false;
  }

  const placeableCells: UncoverableCell[] = [];
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

  const coveredCells = droppedBlocks.flatMap((block: any) =>
    block.shape.flatMap((row: number[], rIdx: number) =>
      row.map((cell: number, cIdx: number) =>
        cell === 1 ? { x: block.x + cIdx, y: block.y + rIdx } : null
      )
    ).filter(Boolean)
  );

  return placeableCells.every(cell =>
    coveredCells.some((covered: any) => covered.x === cell.x && covered.y === cell.y)
  );
};

export const rotateShape = (shape: number[][]): number[][] => {
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

export const flipShape = (shape: number[][]): number[][] => {
  return shape.map(row => [...row].reverse());
};

export const isValidPlacement = (
  block: any,
  newCoords: { x: number; y: number },
  droppedBlocks: any[],
  uncoverableCells: UncoverableCell[],
  excludeId: string | null = null
): boolean => {
  if (!block || !block.shape || !Array.isArray(block.shape)) {
    return false;
  }

  const blockCells: { x: number; y: number }[] = [];
  block.shape.forEach((row: number[], rowIndex: number) => {
    if (Array.isArray(row)) {
      row.forEach((cell: number, colIndex: number) => {
        if (cell === 1) {
          blockCells.push({
            x: newCoords.x + colIndex,
            y: newCoords.y + rowIndex,
          });
        }
      });
    }
  });

  for (const cell of blockCells) {
    if (
      cell.y < 0 || cell.y >= boardLayoutData.length ||
      cell.x < 0 || cell.x >= boardLayoutData[0].length ||
      boardLayoutData[cell.y][cell.x].type === 'empty'
    ) {
      return false;
    }
  }

  const allDroppedCells = droppedBlocks
    .filter((b: any) => excludeId === null || b.id !== excludeId)
    .flatMap((b: any) =>
      b.shape.flatMap((row: number[], rIdx: number) =>
        row.map((c: number, cIdx: number) => (c === 1 ? { x: b.x + cIdx, y: b.y + rIdx } : null))
      ).filter(Boolean)
    );

  for (const blockCell of blockCells) {
    if (allDroppedCells.some((d: any) => d.x === blockCell.x && d.y === blockCell.y)) {
      return false;
    }
    if (uncoverableCells.some(u => u.x === blockCell.x && u.y === blockCell.y)) {
      return false;
    }
  }

  return true;
};

export const initialBlockTypes = [
  { id: 'I-block', label: 'I', color: '#00FFFF', shape: [[1, 1, 1, 1]], key: 'i' },
  { id: 'T-block', label: 'T', color: '#800080', shape: [[0, 1, 0], [0, 1, 0], [1, 1, 1]], key: 't' },
  { id: 'L-block', label: 'L', color: '#FFA500', shape: [[1, 0], [1, 0], [1, 0], [1, 1]], key: 'l' },
  { id: 'S-block', label: 'S', color: '#00FF00', shape: [[0, 1, 1], [1, 1, 0]], key: 's' },
  { id: 'Z-block', label: 'Z', color: '#0000FF', shape: [[1, 1, 0], [0, 1, 0], [0, 1, 1]], key: 'z' },
  { id: 'N-block', label: 'N', color: '#A52A2A', shape: [[1, 1, 1, 0], [0, 0, 1, 1]], key: 'n' },
  { id: 'Q-block', label: 'Q', color: '#FFC0CB', shape: [[1, 1, 0], [1, 1, 1]], key: 'q' },
  { id: 'V-block', label: 'V', color: '#9370DB', shape: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], key: 'v' },
  { id: 'U-block', label: 'U', color: '#FF6347', shape: [[1, 0, 1], [1, 1, 1]], key: 'u' },
  { id: 'J-block', label: 'J', color: '#008000', shape: [[1, 0], [1, 0], [1, 1]], key: 'j' },
];

export const boardLayoutData = [
  [{ type: 'month', value: 'Jan' }, { type: 'month', value: 'Feb' }, { type: 'month', value: 'Mar' }, { type: 'month', value: 'Apr' }, { type: 'month', value: 'May' }, { type: 'month', value: 'Jun' }, { type: 'empty', value: null }],
  [{ type: 'month', value: 'Jul' }, { type: 'month', value: 'Aug' }, { type: 'month', value: 'Sep' }, { type: 'month', value: 'Oct' }, { type: 'month', value: 'Nov' }, { type: 'month', value: 'Dec' }, { type: 'empty', value: null }],
  [{ type: 'day', value: 1 }, { type: 'day', value: 2 }, { type: 'day', value: 3 }, { type: 'day', value: 4 }, { type: 'day', value: 5 }, { type: 'day', value: 6 }, { type: 'day', value: 7 }],
  [{ type: 'day', value: 8 }, { type: 'day', value: 9 }, { type: 'day', value: 10 }, { type: 'day', value: 11 }, { type: 'day', value: 12 }, { type: 'day', value: 13 }, { type: 'day', value: 14 }],
  [{ type: 'day', value: 15 }, { type: 'day', value: 16 }, { type: 'day', value: 17 }, { type: 'day', value: 18 }, { type: 'day', value: 19 }, { type: 'day', value: 20 }, { type: 'day', value: 21 }],
  [{ type: 'day', value: 22 }, { type: 'day', value: 23 }, { type: 'day', value: 24 }, { type: 'day', value: 25 }, { type: 'day', value: 26 }, { type: 'day', value: 27 }, { type: 'day', value: 28 }],
  [{ type: 'day', value: 29 }, { type: 'day', value: 30 }, { type: 'day', value: 31 }, { type: 'weekday', value: 'Sun' }, { type: 'weekday', value: 'Mon' }, { type: 'weekday', value: 'Tue' }, { type: 'weekday', value: 'Wed' }],
  [{ type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'weekday', value: 'Thu' }, { type: 'weekday', value: 'Fri' }, { type: 'weekday', value: 'Sat' }]
];
