export const API_CONFIG = {
  baseUrl: 'https://calendar-puzzle-api.example.com',
  endpoints: {
    getGameId: '/api/game/id',
    getSolution: '/api/game/solution'
  }
};

export const GAME_CONFIG = {
  gridWidth: 7,
  gridHeight: 8,
  cellSize: 70,
  localStorageKey: 'calendarPuzzleGameState',
  autoSaveInterval: 1000, // 1秒
  maxUndoSteps: 10
};

export const BLOCK_COLORS = {
  A: '#FF6B6B',
  B: '#4ECDC4',
  C: '#45B7D1',
  D: '#96CEB4',
  E: '#FECA57',
  F: '#FF9FF3',
  G: '#54A0FF',
  H: '#5F27CD',
  I: '#00D2D3',
  J: '#FF9F43'
};

export const SECTION_COLORS = {
  'month': '#FFB6C1',
  'day': '#90EE90',
  'weekday': '#87CEFA',
  'empty': '#FFFFFF',
  'uncover': '#F0E68C'
};