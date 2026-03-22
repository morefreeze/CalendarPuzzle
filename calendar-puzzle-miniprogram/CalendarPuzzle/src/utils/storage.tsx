import { GameState, PlacedBlock, BlockType } from '../types/game';
import { logDebug, logError } from './logger';

const STORAGE_PREFIX = 'calendarPuzzle';

export const storage = {
  saveGameState: (gameId: string, droppedBlocks: PlacedBlock[], remainingBlocks: BlockType[]) => {
    try {
      const key = `${STORAGE_PREFIX}State_${gameId}`;
      const state = {
        droppedBlocks,
        remainingBlocks,
        timestamp: Date.now()
      };
      wx.setStorageSync(key, JSON.stringify(state));
      logDebug(`Game state saved for game ${gameId}`);
    } catch (error) {
      logError('Failed to save game state:', error);
    }
  },

  loadGameState: (gameId: string): { droppedBlocks: PlacedBlock[]; remainingBlocks: BlockType[] } | null => {
    try {
      const key = `${STORAGE_PREFIX}State_${gameId}`;
      const data = wx.getStorageSync(key);
      if (data) {
        const parsed = JSON.parse(data);
        logDebug(`Game state loaded for game ${gameId}`);
        return parsed;
      }
      return null;
    } catch (error) {
      logError('Failed to load game state:', error);
      return null;
    }
  },

  saveTimer: (gameId: string, timer: number) => {
    try {
      const key = `${STORAGE_PREFIX}Timer_${gameId}`;
      wx.setStorageSync(key, timer.toString());
    } catch (error) {
      logError('Failed to save timer:', error);
    }
  },

  loadTimer: (gameId: string): number => {
    try {
      const key = `${STORAGE_PREFIX}Timer_${gameId}`;
      const data = wx.getStorageSync(key);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      logError('Failed to load timer:', error);
      return 0;
    }
  },

  clearGameState: (gameId: string) => {
    try {
      wx.removeStorageSync(`${STORAGE_PREFIX}State_${gameId}`);
      wx.removeStorageSync(`${STORAGE_PREFIX}Timer_${gameId}`);
      logDebug(`Game state cleared for game ${gameId}`);
    } catch (error) {
      logError('Failed to clear game state:', error);
    }
  },

  saveGameId: (gameId: string) => {
    try {
      wx.setStorageSync(`${STORAGE_PREFIX}CurrentGameId`, gameId);
      logDebug(`Current game ID saved: ${gameId}`);
    } catch (error) {
      logError('Failed to save game ID:', error);
    }
  },

  loadGameId: (): string | null => {
    try {
      const data = wx.getStorageSync(`${STORAGE_PREFIX}CurrentGameId`);
      return data || null;
    } catch (error) {
      logError('Failed to load game ID:', error);
      return null;
    }
  },

  clearAll: () => {
    try {
      wx.clearStorageSync();
      logDebug('All storage cleared');
    } catch (error) {
      logError('Failed to clear storage:', error);
    }
  }
};
