import { useState, useCallback } from 'react';

// 月份名称映射
const MONTH_NAMES = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
};

// 星期名称映射
const WEEKDAY_NAMES = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
};

// 生成按顺序排列的自定义棋盘
export const generateOrderedCustomBoard = (selectedDate = null) => {
  const targetDate = selectedDate || new Date();
  const currentMonth = targetDate.getMonth() + 1; // 1-12
  const currentDay = targetDate.getDate(); // 1-31
  const currentWeekday = targetDate.getDay(); // 0-6 (Sunday-Saturday)

  // 创建8x7的棋盘
  const board = Array(8).fill(null).map(() => Array(7).fill(null));
  
  // 第一行：按顺序放置月份（1-6月）
  for (let i = 0; i < 6; i++) {
    board[0][i] = {
      type: 'month',
      value: MONTH_NAMES[i + 1],
      isCurrent: (i + 1) === currentMonth,
      originalValue: i + 1
    };
  }
  board[0][6] = { type: 'empty', value: null }; // 最后一个位置为空
  
  // 第二行：按顺序放置月份（7-12月）
  for (let i = 0; i < 6; i++) {
    board[1][i] = {
      type: 'month',
      value: MONTH_NAMES[i + 7],
      isCurrent: (i + 7) === currentMonth,
      originalValue: i + 7
    };
  }
  board[1][6] = { type: 'empty', value: null }; // 最后一个位置为空
  
  // 第三行：按顺序放置日期（1-7日）
  for (let i = 0; i < 7; i++) {
    board[2][i] = {
      type: 'day',
      value: i + 1,
      isCurrent: (i + 1) === currentDay,
      originalValue: i + 1
    };
  }
  
  // 第四行：按顺序放置日期（8-14日）
  for (let i = 0; i < 7; i++) {
    board[3][i] = {
      type: 'day',
      value: i + 8,
      isCurrent: (i + 8) === currentDay,
      originalValue: i + 8
    };
  }
  
  // 第五行：按顺序放置日期（15-21日）
  for (let i = 0; i < 7; i++) {
    board[4][i] = {
      type: 'day',
      value: i + 15,
      isCurrent: (i + 15) === currentDay,
      originalValue: i + 15
    };
  }
  
  // 第六行：按顺序放置日期（22-28日）
  for (let i = 0; i < 7; i++) {
    board[5][i] = {
      type: 'day',
      value: i + 22,
      isCurrent: (i + 22) === currentDay,
      originalValue: i + 22
    };
  }
  
  // 第七行：按顺序放置日期（29-31日）和星期（Sun-Wed）
  board[6][0] = {
    type: 'day',
    value: 29,
    isCurrent: 29 === currentDay,
    originalValue: 29
  };
  board[6][1] = {
    type: 'day',
    value: 30,
    isCurrent: 30 === currentDay,
    originalValue: 30
  };
  board[6][2] = {
    type: 'day',
    value: 31,
    isCurrent: 31 === currentDay,
    originalValue: 31
  };
  
  // 放置星期（Sun-Wed）
  for (let i = 0; i < 4; i++) {
    board[6][i + 3] = {
      type: 'weekday',
      value: WEEKDAY_NAMES[i],
      isCurrent: i === currentWeekday,
      originalValue: i
    };
  }
  
  // 第八行：剩余位置和星期（Thu-Sat）
  for (let i = 0; i < 4; i++) {
    board[7][i] = { type: 'empty', value: null };
  }
  
  // 放置星期（Thu-Sat）
  for (let i = 0; i < 3; i++) {
    board[7][i + 4] = {
      type: 'weekday',
      value: WEEKDAY_NAMES[i + 4],
      isCurrent: (i + 4) === currentWeekday,
      originalValue: i + 4
    };
  }
  
  return board;
};

// 获取当天需要遮盖的单元格坐标
export const getTodayCoverCells = (boardLayout) => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const currentWeekday = today.getDay();
  
  const coverCells = [];
  
  boardLayout.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell && cell.isCurrent) {
        coverCells.push({ x, y, type: cell.type, value: cell.value });
      }
    });
  });
  
  return coverCells;
};

// 自定义棋盘生成器组件
const CustomBoardGenerator = ({ selectedDate, onBoardGenerated }) => {
  const [customBoard, setCustomBoard] = useState(null);
  const [coverCells, setCoverCells] = useState([]);
  
  const generateBoard = useCallback(() => {
    const board = generateOrderedCustomBoard(selectedDate);
    const covers = getTodayCoverCells(board);
    
    setCustomBoard(board);
    setCoverCells(covers);
    
    if (onBoardGenerated) {
      onBoardGenerated(board, covers);
    }
  }, [selectedDate, onBoardGenerated]);
  
  // 当选择日期改变时重新生成棋盘
  useState(() => {
    generateBoard();
  }, [generateBoard]);
  
  return {
    customBoard,
    coverCells,
    generateBoard
  };
};

export default CustomBoardGenerator;