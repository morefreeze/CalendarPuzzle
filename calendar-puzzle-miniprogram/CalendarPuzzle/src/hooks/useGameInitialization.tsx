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
