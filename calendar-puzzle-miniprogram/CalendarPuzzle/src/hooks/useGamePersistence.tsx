import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { PlacedBlock, BlockType } from '../types/game';

export const useGamePersistence = (
  gameId: string,
  droppedBlocks: PlacedBlock[],
  remainingBlocks: BlockType[]
) => {
  useEffect(() => {
    if (gameId) {
      storage.saveGameState(gameId, droppedBlocks, remainingBlocks);
    }
  }, [gameId, droppedBlocks, remainingBlocks]);

  const loadGameState = (gameId: string): { droppedBlocks: PlacedBlock[]; remainingBlocks: BlockType[] } | null => {
    return storage.loadGameState(gameId);
  };

  const clearGameState = (gameId: string) => {
    storage.clearGameState(gameId);
  };

  return { loadGameState, clearGameState };
};
