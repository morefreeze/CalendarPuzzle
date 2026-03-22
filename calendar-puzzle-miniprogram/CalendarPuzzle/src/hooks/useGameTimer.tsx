import { useState, useEffect, useRef } from 'react';
import { storage } from '../utils/storage';

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
