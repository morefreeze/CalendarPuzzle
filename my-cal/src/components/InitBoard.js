import { useState, useRef, useEffect } from 'react';

// 常量定义
export const CELL_SIZE = 70;
export const CELL_BOARDER = 1;
export const GAP_SIZE = 0;

export const LONG_PRESS_THRESHOLD = 500; // 长按阈值，单位ms

// 棋盘布局数据
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

// 定义所有方块类型
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

// 通过后端API获取游戏ID
export const fetchGameId = async (blockTypes, boardLayout, day = null, month = null) => {
  const payload = {
    droppedBlocks: [], // 初始状态没有放置的方块
    remainingBlockTypes: blockTypes,
    ...(day && { day }),
    ...(month && { month })
  };
  
  const response = await fetch('http://localhost:5001/api/game-id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch game ID: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.gameId;
};

// 格式化时间显示
export const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// 初始化游戏ID和计时器的钩子
export const useGameInitialization = () => {
  const [timer, setTimer] = useState(0);
  const [gameId, setGameId] = useState('');
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        // 获取当前日期
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;
        
        // 从后端API获取游戏ID
        const newGameId = await fetchGameId(initialBlockTypes, boardLayoutData, day, month);
        setGameId(newGameId);
        setLoading(false);

        // 从localStorage获取保存的计时器值
        const savedTimer = localStorage.getItem(`calendarPuzzleTimer_${newGameId}`);
        if (savedTimer) {
          setTimer(parseInt(savedTimer, 10));
        }

        // 启动计时器
        timerRef.current = setInterval(() => {
          setTimer(prevTimer => {
            const newTimer = prevTimer + 1;
            // 保存计时器值到localStorage
            localStorage.setItem(`calendarPuzzleTimer_${newGameId}`, newTimer.toString());
            return newTimer;
          });
        }, 1000);
      } catch (error) {
        console.error('Failed to initialize game:', error);
        // 降级到本地生成（用于离线场景）
        const fallbackGameId = Math.abs(Date.now()).toString(36);
        setGameId(fallbackGameId);
        setLoading(false);
      }
    };

    initializeGame();

    // 清除计时器
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { timer, gameId, loading };
};

// 获取不可覆盖的单元格
export const getUncoverableCells = () => {
  const today = new Date();
  const currentMonth = today.toLocaleString('en-US', { month: 'short' });
  const currentDay = today.getDate();
  const currentWeekday = today.toLocaleString('en-US', { weekday: 'short' });

  const coords = [];
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