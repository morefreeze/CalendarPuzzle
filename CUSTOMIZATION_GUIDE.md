# 日历拼图游戏自定义功能使用手册

## 📋 概述

本手册描述了如何为日历拼图游戏添加自定义功能，包括自定义棋盘大小、挖去格子以及自选方块等高级功能。当前版本的游戏基于固定的8x7日历布局，但可以通过以下指导进行扩展。

## 🎯 自定义功能列表

### 1. 棋盘自定义
- ✅ **棋盘尺寸**：支持自定义行数和列数（默认8x7）
- ✅ **格子类型**：可自定义普通格子、阻挡格子、特殊标记格子
- ✅ **布局模式**：支持空白棋盘、预设模板、完全自定义布局

### 2. 方块自定义
- ✅ **方块集合**：可自定义可用的方块类型和数量
- ✅ **方块属性**：支持自定义颜色、标签、形状
- ✅ **方块限制**：可设置每种方块的使用次数限制

### 3. 游戏规则自定义
- ✅ **挖去格子**：支持手动指定要挖去的格子位置
- ✅ **胜利条件**：可自定义胜利条件（填满所有格子、覆盖特定标记等）
- ✅ **难度设置**：支持简单、中等、困难等不同难度级别

## 🔧 实现方案

### 后端API扩展

#### 1. 自定义棋盘API

**请求格式：**
```json
{
  "customBoard": {
    "rows": 10,
    "cols": 8,
    "layout": [
      ["empty", "block", "empty", "empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "block", "empty", "empty", "empty"],
      // ... 更多行
    ],
    "blockedCells": [
      {"x": 1, "y": 0},
      {"x": 4, "y": 1}
    ]
  },
  "customBlocks": [
    {
      "id": "custom-I",
      "label": "I",
      "color": "#FF0000",
      "shape": [[1, 1, 1, 1, 1]],
      "maxCount": 2
    },
    // ... 更多自定义方块
  ]
}
```

**响应格式：**
```json
{
  "gameId": "custom_abc123",
  "boardData": [[...]],
  "dimensions": {"rows": 10, "cols": 8},
  "availableBlocks": [...],
  "success": true
}
```

#### 2. 扩展现有API

在现有的`/api/game-id`接口中添加自定义参数：

```json
{
  "droppedBlocks": [...],
  "customConfig": {
    "boardSize": {"rows": 10, "cols": 8},
    "blockedCells": [{"x": 1, "y": 2}, ...],
    "availableBlocks": ["I-block", "L-block", "T-block"],
    "difficulty": "medium"
  }
}
```

### 前端界面扩展

#### 1. 自定义模式选择器

添加一个新的组件`CustomGameMode.js`：

```jsx
const CustomGameMode = () => {
  const [config, setConfig] = useState({
    boardSize: { rows: 8, cols: 7 },
    blockedCells: [],
    availableBlocks: [],
    difficulty: 'normal'
  });

  return (
    <div className="custom-mode-panel">
      <h3>自定义游戏设置</h3>
      
      {/* 棋盘尺寸设置 */}
      <div className="board-size-config">
        <label>棋盘尺寸：</label>
        <input type="number" value={config.boardSize.rows} 
               onChange={(e) => updateBoardSize('rows', e.target.value)} />
        <span>×</span>
        <input type="number" value={config.boardSize.cols} 
               onChange={(e) => updateBoardSize('cols', e.target.value)} />
      </div>
      
      {/* 阻挡格子设置 */}
      <div className="blocked-cells-config">
        <label>阻挡格子：</label>
        <BlockedCellsEditor onChange={updateBlockedCells} />
      </div>
      
      {/* 方块选择 */}
      <div className="blocks-selection">
        <label>可用方块：</label>
        <BlockSelector onChange={updateAvailableBlocks} />
      </div>
      
      <button onClick={startCustomGame}>开始自定义游戏</button>
    </div>
  );
};
```

#### 2. 阻挡格子编辑器

创建可视化编辑器让用户点击选择阻挡格子：

```jsx
const BlockedCellsEditor = ({ rows, cols, onChange }) => {
  const [blockedCells, setBlockedCells] = useState([]);

  const toggleCell = (x, y) => {
    const newBlocked = blockedCells.some(cell => cell.x === x && cell.y === y)
      ? blockedCells.filter(cell => !(cell.x === x && cell.y === y))
      : [...blockedCells, { x, y }];
    
    setBlockedCells(newBlocked);
    onChange(newBlocked);
  };

  return (
    <div className="blocked-cells-grid" 
         style={{ gridTemplateColumns: `repeat(${cols}, 30px)` }}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const x = i % cols;
        const y = Math.floor(i / cols);
        const isBlocked = blockedCells.some(cell => cell.x === x && cell.y === y);
        
        return (
          <div key={`${x}-${y}`}
               className={`cell ${isBlocked ? 'blocked' : 'normal'}`}
               onClick={() => toggleCell(x, y)}
               style={{ width: 30, height: 30 }} />
        );
      })}
    </div>
  );
};
```

#### 3. 方块选择器

允许用户选择可用的方块类型：

```jsx
const BlockSelector = ({ availableBlocks, onChange }) => {
  const allBlockTypes = [
    { id: 'I-block', name: 'I形', shape: [[1,1,1,1]] },
    { id: 'L-block', name: 'L形', shape: [[1,0],[1,0],[1,1]] },
    { id: 'T-block', name: 'T形', shape: [[0,1,0],[1,1,1]] },
    // ... 其他方块类型
  ];

  return (
    <div className="block-selector">
      {allBlockTypes.map(block => (
        <div key={block.id} className="block-option">
          <input type="checkbox" 
                 checked={availableBlocks.includes(block.id)}
                 onChange={(e) => {
                   const newBlocks = e.target.checked
                     ? [...availableBlocks, block.id]
                     : availableBlocks.filter(id => id !== block.id);
                   onChange(newBlocks);
                 }} />
          <span>{block.name}</span>
          <div className="block-preview">
            {/* 显示方块形状的预览 */}
          </div>
        </div>
      ))}
    </div>
  );
};
```

## 📖 使用步骤

### 步骤1：启用自定义模式

1. 在游戏主界面点击"自定义游戏"按钮
2. 进入自定义设置面板
3. 选择"创建新配置"或"加载现有配置"

### 步骤2：设置棋盘参数

1. **调整棋盘尺寸**：
   - 输入行数（推荐范围：6-12）
   - 输入列数（推荐范围：6-10）
   - 点击"应用尺寸"预览效果

2. **设置阻挡格子**：
   - 在可视化网格中点击格子来设置阻挡
   - 阻挡格子将显示为深色，不能被方块覆盖
   - 可以设置多个阻挡格子

3. **选择布局模板**：
   - 空白棋盘：所有格子都可放置
   - 标准日历：类似原版的月份和日期布局
   - 对称图案：创建对称的阻挡模式
   - 随机生成：自动生成有趣的布局

### 步骤3：配置方块集合

1. **选择可用方块**：
   - 从方块库中选择要使用的方块类型
   - 可以全选或只选择特定几种
   - 每种方块可以设置使用数量限制

2. **自定义方块属性**：
   - 修改方块颜色：点击颜色选择器
   - 修改方块标签：输入自定义文字
   - 预览方块形状：实时显示方块外观

3. **高级设置**：
   - 设置方块是否可以旋转
   - 设置方块是否可以翻转
   - 设置每种方块的最大使用次数

### 步骤4：保存和开始游戏

1. **保存配置**：
   - 输入配置名称
   - 选择保存位置（本地/云端）
   - 添加描述信息

2. **开始游戏**：
   - 点击"开始自定义游戏"
   - 系统将根据配置生成新的游戏
   - 可以分享配置给其他玩家

## 🎮 高级功能

### 难度级别设置

- **简单**：棋盘较小（6×6），阻挡格子少，方块种类多
- **中等**：标准棋盘（8×7），适量阻挡，标准方块集合
- **困难**：大型棋盘（10×10），大量阻挡，有限方块选择
- **自定义**：完全由用户定义所有参数

### 游戏模式

1. **经典模式**：填满所有非阻挡格子
2. **标记模式**：必须覆盖所有特殊标记
3. **限制模式**：在限定步数或时间内完成
4. **创造模式**：自由创建图案和设计

### 分享功能

- **生成分享码**：将自定义配置编码为分享码
- **导入配置**：通过分享码加载他人配置
- **社区分享**：上传到配置分享平台
- **版本管理**：保存配置的历史版本

## 🔍 故障排除

### 常见问题

1. **棋盘尺寸限制**：
   - 最大支持12×12的棋盘
   - 过大的棋盘可能影响性能
   - 建议保持行数和列数在合理范围内

2. **方块放置问题**：
   - 确保选择的方块集合能够填满棋盘
   - 阻挡格子不要设置过多
   - 检查方块形状是否适合棋盘布局

3. **配置保存失败**：
   - 检查配置名称是否有效
   - 确保有足够存储空间
   - 验证配置数据的完整性

### 性能优化建议

1. **棋盘尺寸**：建议不超过10×10
2. **方块数量**：建议不超过15种
3. **阻挡格子**：建议不超过总格子的30%
4. **预览功能**：可以关闭实时预览以提高性能

## 📚 扩展阅读

### 相关文件

- `server.py`：后端API接口定义
- `constants.py`：游戏常量和配置
- `board.py`：棋盘逻辑实现
- `PlayBoard.js`：前端主界面组件
- `InitBoard.js`：棋盘初始化逻辑

### 开发指南

如需进一步开发和扩展自定义功能，请参考：
- [开发文档](DEVELOPMENT.md)
- [API文档](API.md)
- [贡献指南](CONTRIBUTING.md)

---

*本手册将持续更新，如有疑问请联系开发团队。*