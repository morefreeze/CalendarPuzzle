// Puzzle generator: solve the calendar puzzle with DLX, then dig blocks for difficulty
// Ported from Python calendar.py, board.py, shape.py, dig_block.py

import { DLX } from './dlx';
import { PlacedBlock } from '../types/game';
import { initialBlockTypes, boardLayoutData } from '../components/InitBoard';

// --- Constants ---
const BOARD_ROWS = 8;
const BOARD_COLS = 7;
const BOARD_BLOCK = '#';
const DATE_BLOCK = '*';
const EMPTY_CELL = ' ';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; digCount: number }> = {
  easy:   { label: '简单', digCount: 2 },
  medium: { label: '中等', digCount: 4 },
  hard:   { label: '困难', digCount: 6 },
  expert: { label: '专家', digCount: 8 },
};

// --- Shape definitions (character grids, matching Python) ---
interface ShapeDef {
  name: string; // single char like 'U'
  grid: string[][];
}

function parseShapeGrid(rows: string[], name: string): string[][] {
  const maxLen = Math.max(...rows.map(r => r.length));
  return rows.map(r => {
    const padded = r.padEnd(maxLen, ' ');
    return padded.split('').map(c => c === name ? name : ' ');
  });
}

const SHAPE_DEFS: ShapeDef[] = [
  { name: 'U', grid: parseShapeGrid(['UU', 'U', 'UU'], 'U') },
  { name: 'V', grid: parseShapeGrid(['VVV', 'V', 'V'], 'V') },
  { name: 'I', grid: parseShapeGrid(['IIII'], 'I') },
  { name: 'L', grid: parseShapeGrid(['LLLL', 'L'], 'L') },
  { name: 'J', grid: parseShapeGrid(['JJJ', 'J'], 'J') },
  { name: 'Q', grid: parseShapeGrid(['Q', 'QQ', 'QQ'], 'Q') },
  { name: 'S', grid: parseShapeGrid([' SS', 'SS'], 'S') },
  { name: 'N', grid: parseShapeGrid(['  NN', 'NNN'], 'N') },
  { name: 'T', grid: parseShapeGrid(['TTT', ' T', ' T'], 'T') },
  { name: 'Z', grid: parseShapeGrid([' ZZ', ' Z', 'ZZ'], 'Z') },
];

// Map from shape letter to block id
const LETTER_TO_BLOCK_ID: Record<string, string> = {};
const BLOCK_ID_TO_LETTER: Record<string, string> = {};
for (const bt of initialBlockTypes) {
  LETTER_TO_BLOCK_ID[bt.label] = bt.id;
  BLOCK_ID_TO_LETTER[bt.id] = bt.label;
}

// --- Shape rotation/mirror utilities ---
function rotateGrid(grid: string[][]): string[][] {
  const n = grid.length;
  const m = grid[0].length;
  const result: string[][] = [];
  for (let j = 0; j < m; j++) {
    const row: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      row.push(grid[i][j]);
    }
    result.push(row);
  }
  return result;
}

function hMirrorGrid(grid: string[][]): string[][] {
  return grid.map(row => [...row].reverse());
}

function gridToString(grid: string[][]): string {
  return grid.map(r => r.join('')).join('\n');
}

function allOrientations(grid: string[][]): string[][][] {
  const visited = new Set<string>();
  const results: string[][][] = [];

  const tryAdd = (g: string[][]) => {
    const key = gridToString(g);
    if (!visited.has(key)) {
      visited.add(key);
      results.push(g);
    }
  };

  // Original + 3 rotations
  let cur = grid;
  for (let i = 0; i < 4; i++) {
    tryAdd(cur);
    cur = rotateGrid(cur);
  }

  // H-mirror + 3 rotations
  cur = hMirrorGrid(grid);
  for (let i = 0; i < 4; i++) {
    tryAdd(cur);
    cur = rotateGrid(cur);
  }

  return results;
}

// --- Board creation ---
function createBoard(): string[][] {
  const board: string[][] = [];
  for (let i = 0; i < BOARD_ROWS; i++) {
    board.push(new Array(BOARD_COLS).fill(EMPTY_CELL));
  }
  return board;
}

function markDate(board: string[][], date: Date): void {
  // Board blocks (corners)
  board[0][6] = BOARD_BLOCK;
  board[1][6] = BOARD_BLOCK;
  board[7][0] = BOARD_BLOCK;
  board[7][1] = BOARD_BLOCK;
  board[7][2] = BOARD_BLOCK;
  board[7][3] = BOARD_BLOCK;

  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();         // 1-31
  // JS getDay(): 0=Sun, need to convert to Python weekday: 0=Mon
  const jsDay = date.getDay();
  const weekday = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 6=Sun

  // Mark month
  board[Math.floor((month - 1) / 6)][(month - 1) % 6] = DATE_BLOCK;
  // Mark day
  board[2 + Math.floor((day - 1) / 7)][(day - 1) % 7] = DATE_BLOCK;
  // Mark weekday
  if (weekday === 6) {
    board[6][3] = DATE_BLOCK; // Sunday
  } else if (weekday >= 0 && weekday <= 2) {
    board[6][4 + weekday] = DATE_BLOCK; // Mon, Tue, Wed
  } else {
    board[7][1 + weekday] = DATE_BLOCK; // Thu(4), Fri(5), Sat -- wait
  }
}

// --- DLX matrix building ---
function fitPut(board: string[][], x: number, y: number, shapeGrid: string[][], shapeName: string): string[][] | null {
  const n = shapeGrid.length;
  const m = shapeGrid[0].length;
  const newBoard = board.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (shapeGrid[i][j] === ' ') continue;
      const bx = x + i;
      const by = y + j;
      if (bx < 0 || bx >= BOARD_ROWS || by < 0 || by >= BOARD_COLS) return null;
      if (newBoard[bx][by] !== EMPTY_CELL) return null;
      newBoard[bx][by] = shapeName;
    }
  }
  return newBoard;
}

function boardToRow(board: string[][], shapeIdx: number, shapeName: string, shapeCount: number, emptyPositions: [number, number][]): number[] {
  const totalCols = shapeCount + emptyPositions.length;
  const row: number[] = new Array(totalCols).fill(0);
  row[shapeIdx] = 1;
  for (let p = 0; p < emptyPositions.length; p++) {
    const [i, j] = emptyPositions[p];
    if (board[i][j] === shapeName) {
      row[shapeCount + p] = 1;
    }
  }
  return row;
}

function rowToKey(row: number[]): string {
  return row.join('');
}

export function solveBoard(date: Date): string[][] | null {
  const board = createBoard();
  markDate(board, date);

  const shapeCount = SHAPE_DEFS.length;

  // Find all empty positions
  const emptyPositions: [number, number][] = [];
  for (let i = 0; i < BOARD_ROWS; i++) {
    for (let j = 0; j < BOARD_COLS; j++) {
      if (board[i][j] === EMPTY_CELL) {
        emptyPositions.push([i, j]);
      }
    }
  }

  const mx: number[][] = [];
  const rowNames: string[] = ['head'];
  const visitedRows = new Set<string>();

  // Generate all valid placements
  for (let i = 0; i < BOARD_ROWS; i++) {
    for (let j = 0; j < BOARD_COLS; j++) {
      for (let k = 0; k < shapeCount; k++) {
        const shapeDef = SHAPE_DEFS[k];
        for (const orientation of allOrientations(shapeDef.grid)) {
          const newBoard = fitPut(board, i, j, orientation, shapeDef.name);
          if (newBoard) {
            const rowArr = boardToRow(newBoard, k, shapeDef.name, shapeCount, emptyPositions);
            const key = rowToKey(rowArr);
            if (!visitedRows.has(key)) {
              visitedRows.add(key);
              mx.push(rowArr);
              rowNames.push(newBoard.map(r => r.join('')).join('\n'));
            }
          }
        }
      }
    }
  }

  if (mx.length === 0) return null;

  const dlx = new DLX(mx, rowNames);
  for (const solution of dlx.search()) {
    // Merge solution into board
    const result = board.map(r => [...r]);
    for (const step of solution) {
      const boardStr = rowNames[step.coordinate[0]];
      const lines = boardStr.split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (let j = 0; j < lines[i].length; j++) {
          if (result[i][j] === EMPTY_CELL && lines[i][j] !== EMPTY_CELL) {
            result[i][j] = lines[i][j];
          }
        }
      }
    }
    return result;
  }
  return null;
}

// --- Dig logic (port from dig_block.py dig_floor) ---
function digFloor(solvedBoard: string[][], digCount: number): string[] {
  const letters = SHAPE_DEFS.map(s => s.name);

  // Find all letter positions
  const letterPositions: Record<string, [number, number][]> = {};
  for (let y = 0; y < solvedBoard.length; y++) {
    for (let x = 0; x < solvedBoard[y].length; x++) {
      const ch = solvedBoard[y][x];
      if (letters.includes(ch)) {
        if (!letterPositions[ch]) letterPositions[ch] = [];
        letterPositions[ch].push([x, y]);
      }
    }
  }

  const available = Object.keys(letterPositions);
  if (available.length === 0) return [];

  const toRemove: string[] = [];
  const directions: [number, number][] = [[-1, 0], [0, -1], [0, 1], [1, 0]];

  // BFS-like: start from random block, find adjacent blocks
  let startChar = available[Math.floor(Math.random() * available.length)];

  while (toRemove.length < digCount) {
    toRemove.push(startChar);

    const nextLetters: string[] = [];
    const positions = letterPositions[startChar] || [];
    for (const [x, y] of positions) {
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < solvedBoard.length && nx >= 0 && nx < solvedBoard[ny].length) {
          const neighborChar = solvedBoard[ny][nx];
          if (letters.includes(neighborChar) && !toRemove.includes(neighborChar)) {
            nextLetters.push(neighborChar);
          }
        }
      }
    }

    delete letterPositions[startChar];

    if (nextLetters.length > 0) {
      startChar = nextLetters[Math.floor(Math.random() * nextLetters.length)];
    } else if (Object.keys(letterPositions).length > 0) {
      const remaining = Object.keys(letterPositions).filter(k => !toRemove.includes(k));
      if (remaining.length === 0) break;
      startChar = remaining[Math.floor(Math.random() * remaining.length)];
    } else {
      break;
    }
  }

  return toRemove;
}

// --- Convert solved board to PlacedBlock[] ---
function boardToPlacedBlocks(solvedBoard: string[][]): PlacedBlock[] {
  const letters = SHAPE_DEFS.map(s => s.name);
  const placedBlocks: PlacedBlock[] = [];

  for (const letter of letters) {
    // Find bounding box for this letter
    let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
    for (let r = 0; r < solvedBoard.length; r++) {
      for (let c = 0; c < solvedBoard[r].length; c++) {
        if (solvedBoard[r][c] === letter) {
          minR = Math.min(minR, r);
          minC = Math.min(minC, c);
          maxR = Math.max(maxR, r);
          maxC = Math.max(maxC, c);
        }
      }
    }
    if (maxR === -1) continue;

    // Build shape matrix
    const shape: number[][] = [];
    for (let r = minR; r <= maxR; r++) {
      const row: number[] = [];
      for (let c = minC; c <= maxC; c++) {
        row.push(solvedBoard[r][c] === letter ? 1 : 0);
      }
      shape.push(row);
    }

    const blockId = LETTER_TO_BLOCK_ID[letter];
    const blockDef = initialBlockTypes.find(b => b.id === blockId);
    if (!blockDef) continue;

    placedBlocks.push({
      id: blockDef.id,
      label: blockDef.label,
      color: blockDef.color,
      shape,
      key: blockDef.key,
      x: minC,
      y: minR,
    });
  }

  return placedBlocks;
}

// --- Main entry: generate puzzle ---
export interface GeneratedPuzzle {
  prePlacedBlocks: PlacedBlock[];
  remainingBlocks: { id: string; label: string; color: string; shape: number[][]; key: string }[];
  difficulty: Difficulty;
  solvedBoard: string[][];
}

export function generatePuzzle(difficulty: Difficulty, date?: Date): GeneratedPuzzle | null {
  const targetDate = date || new Date();
  const solvedBoard = solveBoard(targetDate);
  if (!solvedBoard) return null;

  const { digCount } = DIFFICULTY_CONFIG[difficulty];
  const dugLetters = digFloor(solvedBoard, digCount);

  const allPlaced = boardToPlacedBlocks(solvedBoard);

  const prePlacedBlocks = allPlaced.filter(b => !dugLetters.includes(b.label));
  const remainingBlocks = allPlaced
    .filter(b => dugLetters.includes(b.label))
    .map(b => {
      // Return the original shape definition (not the placed orientation) — actually we
      // want to give the player the exact shape that fits, but let them rotate/flip it.
      // Use the shape from initialBlockTypes so the player gets the default orientation.
      const original = initialBlockTypes.find(bt => bt.id === b.id)!;
      return {
        id: original.id,
        label: original.label,
        color: original.color,
        shape: original.shape,
        key: original.key,
      };
    });

  return {
    prePlacedBlocks,
    remainingBlocks,
    difficulty,
    solvedBoard,
  };
}

// Extract the solution orientation of a block from the solved board
export function getHintShape(solvedBoard: string[][], blockLabel: string): number[][] | null {
  let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
  for (let r = 0; r < solvedBoard.length; r++) {
    for (let c = 0; c < solvedBoard[r].length; c++) {
      if (solvedBoard[r][c] === blockLabel) {
        minR = Math.min(minR, r);
        minC = Math.min(minC, c);
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR === -1) return null;

  const shape: number[][] = [];
  for (let r = minR; r <= maxR; r++) {
    const row: number[] = [];
    for (let c = minC; c <= maxC; c++) {
      row.push(solvedBoard[r][c] === blockLabel ? 1 : 0);
    }
    shape.push(row);
  }
  return shape;
}
