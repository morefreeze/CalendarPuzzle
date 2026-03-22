export interface GameState {
  timer: number;
  gameId: string;
  droppedBlocks: PlacedBlock[];
  remainingBlocks: BlockType[];
  isGameWon: boolean;
  isFetchingSolution: boolean;
  solutionTime: number | null;
  solutionError: string | null;
}

export interface PlacedBlock {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  key?: string;
  x: number;
  y: number;
}

export interface BlockType {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  key: string;
}

export interface Solution {
  droppedBlocks: PlacedBlock[];
  blocks?: PlacedBlock[];
}

export interface BoardCell {
  type: 'month' | 'day' | 'weekday' | 'empty';
  value: string | number | null;
}

export interface UncoverableCell {
  x: number;
  y: number;
}

export interface GameIdRequest {
  droppedBlocks: PlacedBlock[];
  remainingBlockTypes: BlockType[];
  day?: number;
  month?: number;
}

export interface GameIdResponse {
  gameId: string;
}

export interface SolutionRequest {
  gameId: string;
  droppedBlocks: PlacedBlock[];
  uncoverableCells: UncoverableCell[];
  blockTypes: BlockType[];
}

export interface SolutionErrorResponse {
  solveTime?: number;
  suggestion?: string;
  error?: string;
}

export interface TouchEvent {
  touches: Touch[];
  timeStamp: number;
}

export interface Touch {
  identifier: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
}

export interface DragState {
  isDragging: boolean;
  currentBlock: BlockType | null;
  dragOffset: { x: number; y: number };
  startPosition: { x: number; y: number };
}

export interface PreviewBlock {
  id: string;
  label: string;
  color: string;
  shape: number[][];
  x: number;
  y: number;
  isValid: boolean;
}

export interface TimerState {
  timer: number;
  isRunning: boolean;
}

export interface SolverState {
  isFetching: boolean;
  solutionTime: number | null;
  solutionError: string | null;
  solution: Solution | null;
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
