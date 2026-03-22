import { useState } from 'react';
import { api } from '../utils/api';
import { Solution, PlacedBlock, BlockType, UncoverableCell } from '../types/game';

export const useSolver = (
  gameId: string,
  droppedBlocks: PlacedBlock[],
  blockTypes: BlockType[],
  uncoverableCells: UncoverableCell[]
) => {
  const [isFetching, setIsFetching] = useState(false);
  const [solutionTime, setSolutionTime] = useState<number | null>(null);
  const [solutionError, setSolutionError] = useState<string | null>(null);

  const fetchSolution = async (): Promise<Solution | null> => {
    setIsFetching(true);
    setSolutionTime(null);
    setSolutionError(null);

    const startTime = Date.now();

    try {
      const solution = await api.fetchSolution({
        gameId,
        droppedBlocks,
        blockTypes,
        uncoverableCells
      });

      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000;
      setSolutionTime(elapsedTime);

      return solution;
    } catch (error: any) {
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000;
      setSolutionTime(elapsedTime);

      if (error.message) {
        setSolutionError(error.message);
      } else {
        setSolutionError('Failed to fetch solution. Please try again.');
      }
      return null;
    } finally {
      setIsFetching(false);
    }
  };

  return { fetchSolution, isFetching, solutionTime, solutionError };
};
