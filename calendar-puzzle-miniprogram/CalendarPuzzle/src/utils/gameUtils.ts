// 游戏常量定义
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

// 判断游戏是否胜利
export const checkGameWin = (droppedBlocks: any[], uncoverableCells: any[]) => {
  // 条件1: 所有方块都被使用
  if (droppedBlocks.length !== initialBlockTypes.length) {
    return false;
  }

  // 条件2: 检查是否所有可放置的格子都被覆盖
  // 获取所有可放置的格子(非empty且非uncoverable)
  const placeableCells = [];
  boardLayoutData.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (
        cell.type !== 'empty' &&
        !uncoverableCells.some((u: any) => u.x === x && u.y === y)
      ) {
        placeableCells.push({ x, y });
      }
    });
  });

  // 获取所有已放置方块覆盖的格子
  const coveredCells = droppedBlocks.flatMap((block: any) =>
    block.shape.flatMap((row: any[], rIdx: number) =>
      row.map((cell: number, cIdx: number) =>
        cell === 1 ? { x: block.x + cIdx, y: block.y + rIdx } : null
      )
    ).filter(Boolean)
  );

  // 检查每个可放置的格子是否被覆盖
  return placeableCells.every((cell: any) =>
    coveredCells.some((covered: any) => covered.x === cell.x && covered.y === cell.y)
  );
};

// 顺时针旋转90度
export const rotateShape = (shape: number[][]) => {
  const rows = shape.length;
  const cols = shape[0].length;
  const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      newShape[col][rows - 1 - row] = shape[row][col];
    }
  }
  return newShape;
};

// 水平翻转
export const flipShape = (shape: number[][]) => {
  return shape.map(row => [...row].reverse());
};

// 格式化时间显示
export const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// 通过后端API获取游戏ID
export const fetchGameId = async (blockTypes: any[], boardLayout: any[], day?: number, month?: number) => {
  const payload = {
    droppedBlocks: [], // 初始状态没有放置的方块
    remainingBlockTypes: blockTypes,
    ...(day && { day }),
    ...(month && { month })
  };
  
  try {
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
  } catch (error) {
    console.error('Failed to fetch game ID:', error);
    // 降级到本地生成（用于离线场景）
    return Math.abs(Date.now()).toString(36);
  }
};

// 通过后端API获取解决方案
export const fetchSolution = async (gameId: string, droppedBlocks: any[], uncoverableCells: any[]) => {
  const payload = {
    gameId,
    droppedBlocks: droppedBlocks.map(block => ({
      id: block.id,
      x: block.x,
      y: block.y,
      shape: block.shape
    })),
    uncoverableCells,
    blockTypes: initialBlockTypes.map(block => ({
      id: block.id,
      shape: block.shape
    }))
  };

  try {
    const response = await fetch('http://localhost:5001/api/solution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 404) {
      const errorData = await response.json();
      throw new Error('未找到解决方案，请尝试调整方块位置');
    }

    if (!response.ok) {
      throw new Error(`API响应错误: ${response.status}`);
    }

    const solution = await response.json();
    return solution;
  } catch (error) {
    console.error('Failed to fetch solution:', error);
    throw error;
  }
};