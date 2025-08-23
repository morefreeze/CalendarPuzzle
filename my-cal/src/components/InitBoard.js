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
  { id: 'V-block', label: 'V', color: '#9370DB', shape: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], key: 'y' },
  { id: 'U-block', label: 'U', color: '#FF6347', shape: [[1, 0, 1], [1, 1, 1]], key: 'u' },
  { id: 'J-block', label: 'J', color: '#008000', shape: [[1, 0], [1, 0], [1, 1]], key: 'e' },
];

// 生成基于方块类型和棋盘状态的唯一游戏ID
export const generateGameId = (blockTypes, boardLayout) => {
  // 对blockTypes进行排序以确保一致性
  const sortedBlockTypes = [...blockTypes].sort((a, b) => a.id.localeCompare(b.id));
  // 生成方块类型的字符串表示
  const blocksStr = sortedBlockTypes.map(block => `${block.id}:${JSON.stringify(block.shape)}`).join('|');
  // 生成棋盘布局的字符串表示
  const boardStr = JSON.stringify(boardLayout);
  // 使用简单的哈希算法生成唯一ID
  let hash = 0;
  const str = blocksStr + boardStr;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash).toString(36);
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
  const timerRef = useRef(null);

  useEffect(() => {
    // 生成游戏ID
    const newGameId = generateGameId(initialBlockTypes, boardLayoutData);
    setGameId(newGameId);

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

    // 清除计时器
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { timer, gameId };
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