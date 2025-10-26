// 自定义配置类，用于创建自定义游戏配置
class CustomConfig {
  constructor({
    boardSize = { rows: 8, cols: 7 },
    blockTypes = [],
    layoutType = 'calendar',
    difficulty = 'medium',
    dateInfo = null
  } = {}) {
    this.boardSize = boardSize;
    this.blockTypes = blockTypes;
    this.layoutType = layoutType;
    this.difficulty = difficulty;
    this.dateInfo = dateInfo;
  }

  // 验证配置是否有效
  validate() {
    if (!this.boardSize || !this.boardSize.rows || !this.boardSize.cols) {
      throw new Error('Board size must be specified');
    }
    
    if (this.boardSize.rows < 6 || this.boardSize.rows > 12 || 
        this.boardSize.cols < 6 || this.boardSize.cols > 12) {
      throw new Error('Board size must be between 6x6 and 12x12');
    }
    
    if (!this.blockTypes || this.blockTypes.length === 0) {
      throw new Error('At least one block type must be selected');
    }
    
    if (!['blank', 'calendar', 'symmetric', 'random'].includes(this.layoutType)) {
      throw new Error('Invalid layout type');
    }
    
    if (!['easy', 'medium', 'hard'].includes(this.difficulty)) {
      throw new Error('Invalid difficulty level');
    }
    
    return true;
  }

  // 转换为API请求格式
  toApiFormat() {
    this.validate();
    
    return {
      boardSize: this.boardSize,
      selectedBlockTypes: this.blockTypes,
      customLayout: {
        type: this.layoutType
      },
      difficulty: this.difficulty,
      dateInfo: this.dateInfo
    };
  }

  // 获取难度级别配置
  static getDifficultyLevels() {
    return [
      {
        id: 'easy',
        name: 'Easy',
        description: 'Larger board with more space',
        boardSize: { rows: 10, cols: 9 }
      },
      {
        id: 'medium',
        name: 'Medium',
        description: 'Standard board size',
        boardSize: { rows: 8, cols: 7 }
      },
      {
        id: 'hard',
        name: 'Hard',
        description: 'Smaller board with limited space',
        boardSize: { rows: 6, cols: 6 }
      }
    ];
  }

  // 获取布局模板
  static getLayoutTemplates() {
    return [
      {
        id: 'blank',
        name: 'Blank',
        description: 'Empty board with no obstacles'
      },
      {
        id: 'calendar',
        name: 'Calendar',
        description: 'Traditional calendar layout with date blocks'
      },
      {
        id: 'symmetric',
        name: 'Symmetric',
        description: 'Symmetrically placed obstacles'
      },
      {
        id: 'random',
        name: 'Random',
        description: 'Randomly placed obstacles'
      }
    ];
  }

  // 获取可用的方块类型
  static getAvailableBlockTypes() {
    return [
      { id: 'I-block', name: 'I Block', shape: 'I' },
      { id: 'T-block', name: 'T Block', shape: 'T' },
      { id: 'L-block', name: 'L Block', shape: 'L' },
      { id: 'S-block', name: 'S Block', shape: 'S' },
      { id: 'Z-block', name: 'Z Block', shape: 'Z' },
      { id: 'N-block', name: 'N Block', shape: 'N' },
      { id: 'Q-block', name: 'Q Block', shape: 'Q' },
      { id: 'V-block', name: 'V Block', shape: 'V' },
      { id: 'U-block', name: 'U Block', shape: 'U' },
      { id: 'J-block', name: 'J Block', shape: 'J' }
    ];
  }

  // 获取棋盘尺寸限制
  static getBoardSizeLimits() {
    return {
      minRows: 6,
      maxRows: 12,
      minCols: 6,
      maxCols: 12
    };
  }
}

export default CustomConfig;