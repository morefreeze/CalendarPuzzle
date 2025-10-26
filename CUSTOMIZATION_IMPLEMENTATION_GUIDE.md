# 自定义功能实现代码修改指南

## 🚀 概述

本指南提供了实现自定义棋盘和方块功能的具体代码修改步骤。按照以下步骤可以逐步为日历拼图游戏添加用户自定义功能。

## 📁 文件结构修改

### 1. 后端修改 (Python)

#### 1.1 扩展 `constants.py`

在文件末尾添加自定义配置常量：

```python
# 自定义配置相关常量
CUSTOM_BOARD_MIN_ROWS = 6
CUSTOM_BOARD_MAX_ROWS = 12
CUSTOM_BOARD_MIN_COLS = 6
CUSTOM_BOARD_MAX_COLS = 12

CUSTOM_BOARD_CELL_TYPES = {
    'EMPTY': 0,      # 空格子
    'BLOCKED': 1,    # 阻挡格子
    'MARKED': 2,     # 特殊标记格子
    'NORMAL': 3      # 普通可放置格子
}

# 预设布局模板
CUSTOM_BOARD_TEMPLATES = {
    'blank': {
        'name': '空白棋盘',
        'description': '所有格子都可以放置方块',
        'layout': 'blank'
    },
    'calendar': {
        'name': '日历布局',
        'description': '类似原版日历的布局',
        'layout': 'calendar'
    },
    'symmetric': {
        'name': '对称图案',
        'description': '对称的阻挡模式',
        'layout': 'symmetric'
    },
    'random': {
        'name': '随机生成',
        'description': '随机生成阻挡模式',
        'layout': 'random'
    }
}

# 难度级别配置
DIFFICULTY_LEVELS = {
    'easy': {
        'board_size': {'rows': 6, 'cols': 6},
        'blocked_ratio': 0.1,
        'block_types': 8,
        'max_blocked': 4
    },
    'medium': {
        'board_size': {'rows': 8, 'cols': 7},
        'blocked_ratio': 0.15,
        'block_types': 6,
        'max_blocked': 8
    },
    'hard': {
        'board_size': {'rows': 10, 'cols': 10},
        'blocked_ratio': 0.25,
        'block_types': 4,
        'max_blocked': 25
    }
}
```

#### 1.2 创建 `custom_config.py`

创建新的文件来处理自定义配置：

```python
import json
import random
from datetime import datetime
from constants import *

class CustomConfig:
    def __init__(self):
        self.config = {
            'board_size': {'rows': BOARD_ROWS, 'cols': BOARD_COLS},
            'blocked_cells': [],
            'available_blocks': list(BLOCK_TYPE_MAPPING.keys()),
            'difficulty': 'normal',
            'template': 'blank',
            'created_at': datetime.now().isoformat()
        }
    
    def set_board_size(self, rows, cols):
        """设置棋盘尺寸"""
        if CUSTOM_BOARD_MIN_ROWS <= rows <= CUSTOM_BOARD_MAX_ROWS:
            self.config['board_size']['rows'] = rows
        if CUSTOM_BOARD_MIN_COLS <= cols <= CUSTOM_BOARD_MAX_COLS:
            self.config['board_size']['cols'] = cols
        return self
    
    def set_blocked_cells(self, blocked_cells):
        """设置阻挡格子"""
        rows = self.config['board_size']['rows']
        cols = self.config['board_size']['cols']
        
        # 验证阻挡格子坐标是否有效
        valid_blocked = []
        for cell in blocked_cells:
            if 0 <= cell['x'] < cols and 0 <= cell['y'] < rows:
                valid_blocked.append(cell)
        
        self.config['blocked_cells'] = valid_blocked
        return self
    
    def set_available_blocks(self, block_types):
        """设置可用方块类型"""
        valid_blocks = []
        for block_id in block_types:
            if block_id in BLOCK_TYPE_MAPPING:
                valid_blocks.append(block_id)
        
        self.config['available_blocks'] = valid_blocks
        return self
    
    def set_difficulty(self, difficulty):
        """设置难度级别"""
        if difficulty in DIFFICULTY_LEVELS:
            self.config['difficulty'] = difficulty
            # 应用预设配置
            preset = DIFFICULTY_LEVELS[difficulty]
            self.set_board_size(preset['board_size']['rows'], preset['board_size']['cols'])
        return self
    
    def generate_random_blocked_cells(self, ratio=0.15):
        """随机生成阻挡格子"""
        rows = self.config['board_size']['rows']
        cols = self.config['board_size']['cols']
        total_cells = rows * cols
        num_blocked = int(total_cells * ratio)
        
        blocked_cells = []
        available_positions = [(x, y) for x in range(cols) for y in range(rows)]
        
        # 随机选择阻挡位置
        for _ in range(min(num_blocked, len(available_positions))):
            if available_positions:
                x, y = random.choice(available_positions)
                blocked_cells.append({'x': x, 'y': y})
                available_positions.remove((x, y))
        
        self.set_blocked_cells(blocked_cells)
        return self
    
    def generate_symmetric_blocked_cells(self):
        """生成对称的阻挡模式"""
        rows = self.config['board_size']['rows']
        cols = self.config['board_size']['cols']
        blocked_cells = []
        
        # 基于棋盘中心对称生成阻挡
        center_x = cols // 2
        center_y = rows // 2
        
        # 生成四分之一区域的阻挡，然后对称复制
        quarter_blocked = []
        max_blocked = min(8, (rows * cols) // 8)
        
        for _ in range(max_blocked):
            x = random.randint(0, center_x - 1)
            y = random.randint(0, center_y - 1)
            if (x, y) not in [(pos['x'], pos['y']) for pos in quarter_blocked]:
                quarter_blocked.append({'x': x, 'y': y})
        
        # 对称复制到其他象限
        for cell in quarter_blocked:
            x, y = cell['x'], cell['y']
            # 四个象限的对称位置
            positions = [
                {'x': x, 'y': y},
                {'x': cols - 1 - x, 'y': y},
                {'x': x, 'y': rows - 1 - y},
                {'x': cols - 1 - x, 'y': rows - 1 - y}
            ]
            
            for pos in positions:
                if 0 <= pos['x'] < cols and 0 <= pos['y'] < rows:
                    if pos not in blocked_cells:
                        blocked_cells.append(pos)
        
        self.set_blocked_cells(blocked_cells)
        return self
    
    def to_dict(self):
        """转换为字典格式"""
        return self.config.copy()
    
    def to_json(self):
        """转换为JSON字符串"""
        return json.dumps(self.config, indent=2, ensure_ascii=False)
    
    @classmethod
    def from_dict(cls, config_dict):
        """从字典创建配置"""
        config = cls()
        config.config.update(config_dict)
        return config
    
    @classmethod
    def from_json(cls, json_str):
        """从JSON字符串创建配置"""
        config_dict = json.loads(json_str)
        return cls.from_dict(config_dict)

# 预设配置生成器
def create_easy_config():
    """创建简单难度配置"""
    return (CustomConfig()
            .set_difficulty('easy')
            .generate_random_blocked_cells(0.1)
            .set_available_blocks(['I-block', 'L-block', 'O-block', 'T-block']))

def create_medium_config():
    """创建中等难度配置"""
    return (CustomConfig()
            .set_difficulty('medium')
            .generate_random_blocked_cells(0.15)
            .set_available_blocks(list(BLOCK_TYPE_MAPPING.keys())))

def create_hard_config():
    """创建困难难度配置"""
    return (CustomConfig()
            .set_difficulty('hard')
            .generate_symmetric_blocked_cells()
            .set_available_blocks(['I-block', 'L-block', 'T-block', 'Z-block']))

def create_blank_config(rows=8, cols=7):
    """创建空白棋盘配置"""
    return (CustomConfig()
            .set_board_size(rows, cols)
            .set_blocked_cells([])
            .set_available_blocks(list(BLOCK_TYPE_MAPPING.keys())))
```

#### 1.3 修改 `board.py`

扩展 `Board` 类以支持自定义配置：

```python
from custom_config import CustomConfig

class Board:
    def __init__(self, custom_config=None):
        """初始化棋盘，支持自定义配置"""
        if custom_config:
            self.config = custom_config
            self.rows = custom_config.config['board_size']['rows']
            self.cols = custom_config.config['board_size']['cols']
            self.blocked_cells = custom_config.config['blocked_cells']
        else:
            # 使用默认配置
            self.config = CustomConfig()
            self.rows = BOARD_ROWS
            self.cols = BOARD_COLS
            self.blocked_cells = []
        
        # 初始化网格
        self.grid = [[0 for _ in range(self.cols)] for _ in range(self.rows)]
        self._apply_blocked_cells()
    
    def _apply_blocked_cells(self):
        """应用阻挡格子设置"""
        for cell in self.blocked_cells:
            x, y = cell['x'], cell['y']
            if 0 <= x < self.cols and 0 <= y < self.rows:
                self.grid[y][x] = CUSTOM_BOARD_CELL_TYPES['BLOCKED']
    
    def is_valid_position(self, x, y):
        """检查位置是否有效（非阻挡且未越界）"""
        if not (0 <= x < self.cols and 0 <= y < self.rows):
            return False
        return self.grid[y][x] != CUSTOM_BOARD_CELL_TYPES['BLOCKED']
    
    def can_place_shape(self, shape, start_x, start_y):
        """检查是否可以在指定位置放置形状"""
        for dy, row in enumerate(shape):
            for dx, cell in enumerate(row):
                if cell:
                    x, y = start_x + dx, start_y + dy
                    if not self.is_valid_position(x, y):
                        return False
        return True
    
    def place_shape(self, shape, start_x, start_y, block_id):
        """在指定位置放置形状"""
        if not self.can_place_shape(shape, start_x, start_y):
            return False
        
        for dy, row in enumerate(shape):
            for dx, cell in enumerate(row):
                if cell:
                    x, y = start_x + dx, start_y + dy
                    self.grid[y][x] = block_id
        return True
    
    def get_available_positions(self, shape):
        """获取形状的所有可用放置位置"""
        positions = []
        shape_height = len(shape)
        shape_width = len(shape[0])
        
        for y in range(self.rows - shape_height + 1):
            for x in range(self.cols - shape_width + 1):
                if self.can_place_shape(shape, x, y):
                    positions.append({'x': x, 'y': y})
        
        return positions
    
    def get_board_state(self):
        """获取当前棋盘状态"""
        return {
            'grid': self.grid,
            'rows': self.rows,
            'cols': self.cols,
            'blocked_cells': self.blocked_cells,
            'empty_cells': self._count_empty_cells(),
            'total_cells': self.rows * self.cols
        }
    
    def _count_empty_cells(self):
        """计算空格子数量"""
        count = 0
        for row in self.grid:
            for cell in row:
                if cell == 0:
                    count += 1
        return count
```

#### 1.4 扩展 `server.py`

添加新的API端点来处理自定义配置：

```python
from custom_config import CustomConfig, create_easy_config, create_medium_config, create_hard_config, create_blank_config

# 添加新的API端点
@app.route('/api/custom/config', methods=['POST'])
def create_custom_config():
    """创建自定义配置"""
    try:
        data = request.get_json()
        
        # 支持快速预设
        if 'preset' in data:
            preset = data['preset']
            if preset == 'easy':
                config = create_easy_config()
            elif preset == 'medium':
                config = create_medium_config()
            elif preset == 'hard':
                config = create_hard_config()
            elif preset == 'blank':
                rows = data.get('rows', 8)
                cols = data.get('cols', 7)
                config = create_blank_config(rows, cols)
            else:
                return jsonify({'error': 'Unknown preset'}), 400
        
        # 支持详细配置
        elif 'customConfig' in data:
            config_data = data['customConfig']
            config = CustomConfig()
            
            # 设置棋盘尺寸
            if 'boardSize' in config_data:
                size = config_data['boardSize']
                config.set_board_size(size['rows'], size['cols'])
            
            # 设置阻挡格子
            if 'blockedCells' in config_data:
                config.set_blocked_cells(config_data['blockedCells'])
            
            # 设置可用方块
            if 'availableBlocks' in config_data:
                config.set_available_blocks(config_data['availableBlocks'])
            
            # 设置难度
            if 'difficulty' in config_data:
                config.set_difficulty(config_data['difficulty'])
            
            # 生成随机阻挡
            if 'generateBlocked' in config_data:
                if config_data['generateBlocked'] == 'random':
                    ratio = config_data.get('blockedRatio', 0.15)
                    config.generate_random_blocked_cells(ratio)
                elif config_data['generateBlocked'] == 'symmetric':
                    config.generate_symmetric_blocked_cells()
        
        else:
            return jsonify({'error': 'No configuration provided'}), 400
        
        # 生成配置ID
        config_id = f"custom_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # 保存配置（这里可以保存到数据库或文件）
        # save_custom_config(config_id, config.to_dict())
        
        return jsonify({
            'configId': config_id,
            'config': config.to_dict(),
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/custom/config/<config_id>', methods=['GET'])
def get_custom_config(config_id):
    """获取自定义配置"""
    try:
        # 这里从数据库或文件加载配置
        # config = load_custom_config(config_id)
        
        # 临时返回示例配置
        config = create_medium_config()
        
        return jsonify({
            'configId': config_id,
            'config': config.to_dict(),
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/custom/game', methods=['POST'])
def create_custom_game():
    """创建自定义游戏"""
    try:
        data = request.get_json()
        
        # 获取配置
        if 'configId' in data:
            # 从配置ID加载
            config_response = get_custom_config(data['configId'])
            config_data = json.loads(config_response.data)['config']
            config = CustomConfig.from_dict(config_data)
        elif 'customConfig' in data:
            # 直接使用提供的配置
            config = CustomConfig.from_dict(data['customConfig'])
        else:
            return jsonify({'error': 'No configuration provided'}), 400
        
        # 创建自定义棋盘
        board = Board(config)
        
        # 生成游戏ID
        game_id = f"custom_game_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # 获取可用方块
        available_blocks = config.config['available_blocks']
        
        # 生成棋盘数据
        board_data = board.get_board_state()
        
        return jsonify({
            'gameId': game_id,
            'boardData': board_data['grid'],
            'dimensions': {
                'rows': board_data['rows'],
                'cols': board_data['cols']
            },
            'availableBlocks': available_blocks,
            'blockedCells': board_data['blocked_cells'],
            'totalCells': board_data['total_cells'],
            'emptyCells': board_data['empty_cells'],
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 扩展原有的游戏ID生成接口
@app.route('/api/game-id', methods=['POST'])
def generate_game_id_with_custom():
    """扩展的游戏ID生成接口，支持自定义配置"""
    try:
        data = request.get_json()
        
        # 检查是否有自定义配置
        if 'customConfig' in data:
            return create_custom_game()  # 使用自定义配置创建游戏
        
        # 原有的逻辑保持不变
        return generate_game_id_original(data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_game_id_original(data):
    """原有的游戏ID生成逻辑"""
    # 这里复制原有的generate_game_id函数逻辑
    # ... 原有代码保持不变
    pass
```

### 2. 前端修改 (JavaScript/React)

#### 2.1 创建 `CustomGameMode.js`

```jsx
import React, { useState, useEffect } from 'react';
import './CustomGameMode.css';

const CustomGameMode = ({ onStartGame, onBack }) => {
  const [config, setConfig] = useState({
    boardSize: { rows: 8, cols: 7 },
    blockedCells: [],
    availableBlocks: [],
    difficulty: 'normal',
    template: 'blank'
  });
  
  const [presets, setPresets] = useState([
    { id: 'easy', name: '简单', description: '6×6棋盘，少量阻挡' },
    { id: 'medium', name: '中等', description: '8×7标准棋盘' },
    { id: 'hard', name: '困难', name: '10×10棋盘，大量阻挡' },
    { id: 'blank', name: '空白棋盘', description: '自定义尺寸的空白棋盘' }
  ]);
  
  const [allBlockTypes, setAllBlockTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewBoard, setPreviewBoard] = useState(null);

  useEffect(() => {
    // 加载所有可用的方块类型
    fetchAvailableBlocks();
  }, []);

  useEffect(() => {
    // 当配置改变时更新预览
    updatePreview();
  }, [config]);

  const fetchAvailableBlocks = async () => {
    try {
      const response = await fetch('/api/block-types');
      const data = await response.json();
      setAllBlockTypes(data.blockTypes || []);
      
      // 默认选择所有方块
      if (config.availableBlocks.length === 0) {
        setConfig(prev => ({
          ...prev,
          availableBlocks: data.blockTypes.map(bt => bt.id) || []
        }));
      }
    } catch (error) {
      console.error('Failed to fetch block types:', error);
      // 使用默认方块类型
      const defaultBlocks = ['I-block', 'L-block', 'O-block', 'T-block', 'J-block', 'S-block', 'Z-block'];
      setAllBlockTypes(defaultBlocks.map(id => ({ id, name: id })));
    }
  };

  const updatePreview = async () => {
    // 生成预览棋盘
    try {
      const response = await fetch('/api/custom/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customConfig: config })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreviewBoard(data.boardData);
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  const handlePresetSelect = (presetId) => {
    setLoading(true);
    
    // 使用预设配置
    fetch('/api/custom/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preset: presetId, rows: config.boardSize.rows, cols: config.boardSize.cols })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setConfig({
          boardSize: data.config.board_size,
          blockedCells: data.config.blocked_cells,
          availableBlocks: data.config.available_blocks,
          difficulty: data.config.difficulty,
          template: presetId
        });
      }
      setLoading(false);
    })
    .catch(error => {
      console.error('Failed to load preset:', error);
      setLoading(false);
    });
  };

  const handleBoardSizeChange = (dimension, value) => {
    const newSize = { ...config.boardSize };
    newSize[dimension] = Math.max(6, Math.min(12, parseInt(value) || 6));
    
    setConfig(prev => ({
      ...prev,
      boardSize: newSize
    }));
  };

  const handleBlockedCellsChange = (newBlockedCells) => {
    setConfig(prev => ({
      ...prev,
      blockedCells: newBlockedCells
    }));
  };

  const handleAvailableBlocksChange = (blockId, checked) => {
    const newAvailableBlocks = checked
      ? [...config.availableBlocks, blockId]
      : config.availableBlocks.filter(id => id !== blockId);
    
    setConfig(prev => ({
      ...prev,
      availableBlocks: newAvailableBlocks
    }));
  };

  const handleGenerateBlocked = (type) => {
    setLoading(true);
    
    fetch('/api/custom/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customConfig: {
          ...config,
          generateBlocked: type,
          blockedRatio: type === 'random' ? 0.15 : 0.2
        }
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setConfig(prev => ({
          ...prev,
          blockedCells: data.config.blocked_cells
        }));
      }
      setLoading(false);
    })
    .catch(error => {
      console.error('Failed to generate blocked cells:', error);
      setLoading(false);
    });
  };

  const handleStartGame = () => {
    if (config.availableBlocks.length === 0) {
      alert('请至少选择一种方块类型');
      return;
    }

    setLoading(true);
    
    // 创建自定义游戏
    fetch('/api/custom/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customConfig: config })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        onStartGame(data);
      } else {
        alert('创建游戏失败: ' + (data.error || '未知错误'));
      }
      setLoading(false);
    })
    .catch(error => {
      console.error('Failed to create custom game:', error);
      alert('创建游戏失败，请检查网络连接');
      setLoading(false);
    });
  };

  const handleSaveConfig = () => {
    const configName = prompt('请输入配置名称：');
    if (configName) {
      // 保存配置到本地存储
      const savedConfigs = JSON.parse(localStorage.getItem('customConfigs') || '{}');
      savedConfigs[configName] = {
        ...config,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('customConfigs', JSON.stringify(savedConfigs));
      alert('配置已保存');
    }
  };

  const handleLoadConfig = () => {
    const savedConfigs = JSON.parse(localStorage.getItem('customConfigs') || '{}');
    const configNames = Object.keys(savedConfigs);
    
    if (configNames.length === 0) {
      alert('没有保存的配置');
      return;
    }
    
    const selectedName = prompt('选择要加载的配置：\n' + configNames.join('\n'));
    if (selectedName && savedConfigs[selectedName]) {
      setConfig(savedConfigs[selectedName]);
    }
  };

  return (
    <div className="custom-game-mode">
      <div className="custom-header">
        <h2>自定义游戏设置</h2>
        <button className="back-button" onClick={onBack}>返回</button>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">加载中...</div>
        </div>
      )}

      <div className="custom-content">
        {/* 预设选择 */}
        <div className="preset-section">
          <h3>快速预设</h3>
          <div className="preset-grid">
            {presets.map(preset => (
              <div key={preset.id} className="preset-card" onClick={() => handlePresetSelect(preset.id)}>
                <h4>{preset.name}</h4>
                <p>{preset.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 棋盘设置 */}
        <div className="board-settings">
          <h3>棋盘设置</h3>
          <div className="setting-group">
            <label>棋盘尺寸：</label>
            <div className="size-inputs">
              <input 
                type="number" 
                min="6" max="12" 
                value={config.boardSize.rows}
                onChange={(e) => handleBoardSizeChange('rows', e.target.value)}
              />
              <span>×</span>
              <input 
                type="number" 
                min="6" max="12" 
                value={config.boardSize.cols}
                onChange={(e) => handleBoardSizeChange('cols', e.target.value)}
              />
            </div>
          </div>

          <div className="setting-group">
            <label>阻挡格子：</label>
            <div className="blocked-controls">
              <button onClick={() => handleGenerateBlocked('random')}>随机生成</button>
              <button onClick={() => handleGenerateBlocked('symmetric')}>对称生成</button>
              <button onClick={() => handleBlockedCellsChange([])}>清除所有</button>
            </div>
            <BlockedCellsEditor
              rows={config.boardSize.rows}
              cols={config.boardSize.cols}
              blockedCells={config.blockedCells}
              onChange={handleBlockedCellsChange}
            />
          </div>
        </div>

        {/* 方块选择 */}
        <div className="blocks-settings">
          <h3>可用方块</h3>
          <div className="block-selection-grid">
            {allBlockTypes.map(blockType => (
              <div key={blockType.id} className="block-option">
                <label>
                  <input
                    type="checkbox"
                    checked={config.availableBlocks.includes(blockType.id)}
                    onChange={(e) => handleAvailableBlocksChange(blockType.id, e.target.checked)}
                  />
                  <span>{blockType.name}</span>
                </label>
              </div>
            ))}
          </div>
          <div className="block-controls">
            <button onClick={() => setConfig(prev => ({...prev, availableBlocks: allBlockTypes.map(bt => bt.id)}))}>
              全选
            </button>
            <button onClick={() => setConfig(prev => ({...prev, availableBlocks: []}))}>
              全不选
            </button>
          </div>
        </div>

        {/* 预览 */}
        {previewBoard && (
          <div className="preview-section">
            <h3>预览</h3>
            <BoardPreview 
              boardData={previewBoard}
              rows={config.boardSize.rows}
              cols={config.boardSize.cols}
            />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="action-buttons">
          <button className="save-button" onClick={handleSaveConfig}>保存配置</button>
          <button className="load-button" onClick={handleLoadConfig}>加载配置</button>
          <button className="start-button" onClick={handleStartGame}>开始游戏</button>
        </div>
      </div>
    </div>
  );
};

// 阻挡格子编辑器组件
const BlockedCellsEditor = ({ rows, cols, blockedCells, onChange }) => {
  const toggleCell = (x, y) => {
    const isBlocked = blockedCells.some(cell => cell.x === x && cell.y === y);
    const newBlockedCells = isBlocked
      ? blockedCells.filter(cell => !(cell.x === x && cell.y === y))
      : [...blockedCells, { x, y }];
    
    onChange(newBlockedCells);
  };

  return (
    <div 
      className="blocked-cells-grid"
      style={{ 
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 25px)`,
        gap: '1px',
        marginTop: '10px'
      }}
    >
      {Array.from({ length: rows * cols }, (_, i) => {
        const x = i % cols;
        const y = Math.floor(i / cols);
        const isBlocked = blockedCells.some(cell => cell.x === x && cell.y === y);
        
        return (
          <div
            key={`${x}-${y}`}
            className={`blocked-cell ${isBlocked ? 'blocked' : 'normal'}`}
            onClick={() => toggleCell(x, y)}
            style={{
              width: '25px',
              height: '25px',
              border: '1px solid #ccc',
              cursor: 'pointer',
              backgroundColor: isBlocked ? '#666' : '#fff'
            }}
          />
        );
      })}
    </div>
  );
};

// 棋盘预览组件
const BoardPreview = ({ boardData, rows, cols }) => {
  if (!boardData) return null;

  return (
    <div 
      className="board-preview"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 20px)`,
        gap: '1px',
        marginTop: '10px'
      }}
    >
      {boardData.map((row, y) =>
        row.map((cell, x) => (
          <div
            key={`${x}-${y}`}
            className="preview-cell"
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: cell === 1 ? '#666' : (cell > 1 ? '#4CAF50' : '#f0f0f0'),
              border: '1px solid #ddd'
            }}
          />
        ))
      )}
    </div>
  );
};

export default CustomGameMode;
```

#### 2.2 创建 `CustomGameMode.css`

```css
.custom-game-mode {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.custom-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid #eee;
}

.custom-header h2 {
  margin: 0;
  color: #333;
}

.back-button {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.back-button:hover {
  background: #e5e5e5;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  background: white;
  padding: 20px;
  border-radius: 8px;
  font-size: 18px;
  color: #333;
}

.custom-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.preset-section {
  grid-column: 1 / -1;
}

.preset-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.preset-card {
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.preset-card:hover {
  border-color: #4CAF50;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.preset-card h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.preset-card p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.board-settings, .blocks-settings {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #eee;
}

.board-settings h3, .blocks-settings h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.size-inputs {
  display: flex;
  align-items: center;
  gap: 10px;
}

.size-inputs input {
  width: 60px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
}

.blocked-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.blocked-controls button {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.blocked-controls button:hover {
  background: #f0f0f0;
}

.blocked-cell {
  transition: background-color 0.2s;
}

.blocked-cell:hover {
  background-color: #e0e0e0 !important;
}

.blocked-cell.blocked {
  background-color: #666 !important;
}

.block-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.block-option label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.block-option label:hover {
  background: #f0f0f0;
}

.block-option input[type="checkbox"] {
  margin: 0;
}

.block-controls {
  display: flex;
  gap: 10px;
}

.block-controls button {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.preview-section {
  grid-column: 1 / -1;
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #eee;
}

.preview-section h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.action-buttons {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

.action-buttons button {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.save-button {
  background: #2196F3;
  color: white;
}

.save-button:hover {
  background: #1976D2;
}

.load-button {
  background: #FF9800;
  color: white;
}

.load-button:hover {
  background: #F57C00;
}

.start-button {
  background: #4CAF50;
  color: white;
}

.start-button:hover {
  background: #45a049;
}

@media (max-width: 768px) {
  .custom-content {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .preset-grid {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
  }
}
```

#### 2.3 修改主应用组件

在主要的应用组件中添加自定义模式的入口：

```jsx
// 在 App.js 或主组件中添加
import CustomGameMode from './CustomGameMode';

function App() {
  const [gameMode, setGameMode] = useState('normal'); // 'normal' or 'custom'
  const [customGameData, setCustomGameData] = useState(null);

  const handleStartCustomGame = (gameData) => {
    setCustomGameData(gameData);
    setGameMode('custom');
  };

  const handleBackToMenu = () => {
    setGameMode('normal');
    setCustomGameData(null);
  };

  if (gameMode === 'custom') {
    return (
      <div className="App">
        <PlayBoard 
          customGameData={customGameData}
          onBackToMenu={handleBackToMenu}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <div className="game-menu">
        <h1>日历拼图游戏</h1>
        <div className="menu-buttons">
          <button onClick={() => setGameMode('normal')}>普通模式</button>
          <button onClick={() => setGameMode('custom-setup')}>自定义模式</button>
        </div>
      </div>
      
      {gameMode === 'custom-setup' && (
        <CustomGameMode 
          onStartGame={handleStartCustomGame}
          onBack={() => setGameMode('normal')}
        />
      )}
      
      {gameMode === 'normal' && (
        <PlayBoard />
      )}
    </div>
  );
}
```

#### 2.4 修改 `PlayBoard.js` 以支持自定义游戏

```jsx
// 在 PlayBoard.js 中添加对自定义游戏的支持
const PlayBoard = ({ customGameData, onBackToMenu }) => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customConfig, setCustomConfig] = useState(null);

  useEffect(() => {
    if (customGameData) {
      setIsCustomMode(true);
      setCustomConfig(customGameData);
      // 使用自定义数据初始化游戏
      initializeCustomGame(customGameData);
    } else {
      setIsCustomMode(false);
      // 正常初始化
      initializeNormalGame();
    }
  }, [customGameData]);

  const initializeCustomGame = (gameData) => {
    // 使用自定义配置初始化游戏
    setBoardLayoutData(gameData.boardData);
    setDimensions({ rows: gameData.dimensions.rows, cols: gameData.dimensions.cols });
    setAvailableBlocks(gameData.availableBlocks);
    setBlockedCells(gameData.blockedCells || []);
    // ... 其他初始化逻辑
  };

  const handleBackToMenu = () => {
    if (onBackToMenu) {
      onBackToMenu();
    }
  };

  return (
    <div className="play-board">
      {isCustomMode && (
        <div className="custom-mode-header">
          <button onClick={handleBackToMenu}>返回菜单</button>
          <span>自定义游戏模式</span>
        </div>
      )}
      
      {/* 原有的棋盘渲染逻辑 */}
      <div className="board-container">
        {/* ... 棋盘渲染代码 */}
      </div>
      
      {/* ... 其他组件 */}
    </div>
  );
};
```

## 🔧 数据库设计（可选）

如果需要保存用户配置，可以添加以下数据库表：

```sql
-- 用户自定义配置表
CREATE TABLE custom_configs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config_data JSON NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_public (is_public)
);

-- 配置使用统计表
CREATE TABLE config_usage_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_id VARCHAR(50),
    usage_count INT DEFAULT 0,
    success_rate FLOAT,
    average_completion_time INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (config_id) REFERENCES custom_configs(id)
);
```

## 🧪 测试用例

添加以下测试文件：

### `test_custom_config.py`

```python
import unittest
from custom_config import CustomConfig, create_easy_config, create_hard_config

class TestCustomConfig(unittest.TestCase):
    def setUp(self):
        self.config = CustomConfig()
    
    def test_board_size_validation(self):
        # 测试有效的棋盘尺寸
        self.config.set_board_size(8, 7)
        self.assertEqual(self.config.config['board_size']['rows'], 8)
        self.assertEqual(self.config.config['board_size']['cols'], 7)
        
        # 测试无效的棋盘尺寸
        self.config.set_board_size(20, 20)  # 超出最大值
        self.assertNotEqual(self.config.config['board_size']['rows'], 20)
    
    def test_blocked_cells_validation(self):
        # 测试有效的阻挡格子
        blocked_cells = [{'x': 1, 'y': 2}, {'x': 3, 'y': 4}]
        self.config.set_blocked_cells(blocked_cells)
        self.assertEqual(len(self.config.config['blocked_cells']), 2)
        
        # 测试无效的阻挡格子（越界）
        invalid_blocked = [{'x': 100, 'y': 100}]
        self.config.set_blocked_cells(invalid_blocked)
        self.assertEqual(len(self.config.config['blocked_cells']), 0)
    
    def test_preset_configs(self):
        # 测试预设配置
        easy_config = create_easy_config()
        self.assertEqual(easy_config.config['difficulty'], 'easy')
        
        hard_config = create_hard_config()
        self.assertEqual(hard_config.config['difficulty'], 'hard')
        self.assertGreater(len(hard_config.config['blocked_cells']), 0)
    
    def test_random_blocked_generation(self):
        # 测试随机阻挡生成
        self.config.set_board_size(8, 7)
        self.config.generate_random_blocked_cells(0.1)
        
        blocked_count = len(self.config.config['blocked_cells'])
        expected_count = int(8 * 7 * 0.1)
        
        self.assertGreater(blocked_count, 0)
        self.assertLessEqual(blocked_count, expected_count + 2)  # 允许小误差
    
    def test_symmetric_blocked_generation(self):
        # 测试对称阻挡生成
        self.config.set_board_size(8, 8)  # 使用正方形棋盘便于对称
        self.config.generate_symmetric_blocked_cells()
        
        blocked_cells = self.config.config['blocked_cells']
        self.assertGreater(len(blocked_cells), 0)
        
        # 验证对称性（简化验证）
        center_x, center_y = 4, 4
        symmetric_count = 0
        
        for cell in blocked_cells:
            x, y = cell['x'], cell['y']
            # 检查是否存在对称的阻挡格子
            symmetric_x = 7 - x  # 8x8棋盘的中心对称
            symmetric_y = 7 - y
            
            if any(c['x'] == symmetric_x and c['y'] == symmetric_y for c in blocked_cells):
                symmetric_count += 1
        
        # 至少应该有一些对称的阻挡格子
        self.assertGreater(symmetric_count, 0)

if __name__ == '__main__':
    unittest.main()
```

## 📊 性能优化建议

1. **棋盘尺寸限制**：
   - 前端限制最大12×12
   - 后端验证尺寸参数
   - 对大棋盘添加性能警告

2. **阻挡格子优化**：
   - 限制阻挡格子数量不超过总格子的30%
   - 使用高效的数据结构存储阻挡位置
   - 缓存阻挡格子的查询结果

3. **方块选择优化**：
   - 限制同时选择的方块类型数量
   - 对方块形状进行预处理和缓存
   - 使用Web Worker进行复杂计算

4. **预览功能优化**：
   - 使用防抖技术减少API调用
   - 添加预览加载状态
   - 对小棋盘使用客户端计算

## 🎯 部署注意事项

1. **向后兼容性**：
   - 保持原有API接口不变
   - 新功能使用独立的API端点
   - 提供降级方案

2. **安全性考虑**：
   - 验证所有用户输入
   - 限制API调用频率
   - 对配置数据进行消毒处理

3. **监控和日志**：
   - 记录自定义配置的使用情况
   - 监控API性能
   - 跟踪错误和异常情况

---

这个实现指南提供了完整的代码修改方案，包括后端API扩展、前端界面开发、数据存储设计和测试用例。按照这些步骤可以逐步为日历拼图游戏添加强大的自定义功能。