# Calendar Puzzle React Frontend

日历拼图的现代化React前端实现，提供直观、响应式的游戏体验。

## 🎮 功能特性

### 核心功能
- **拖拽交互**：支持鼠标和触摸设备的形状拖拽
- **实时验证**：放置时即时检查有效性
- **撤销重做**：完整的操作历史栈
- **智能提示**：集成AI求解器提供解题建议
- **响应式设计**：完美适配桌面和移动设备

### 技术特性
- **TypeScript**：类型安全的现代化开发
- **React Hooks**：优雅的状态管理
- **Canvas渲染**：高性能图形绘制
- **Web Workers**：后台计算不阻塞主线程
- **PWA支持**：可安装为桌面应用

## 🏗️ 项目结构

```
src/
├── components/           # React组件
│   ├── GameBoard.js      # 游戏主面板
│   ├── ShapeSelector.js  # 形状选择器
│   ├── CalendarGrid.js   # 日历网格组件
│   ├── Shape.js          # 单个形状组件
│   └── SolverPanel.js    # 求解器控制面板
├── hooks/               # 自定义Hooks
│   ├── useGameState.js  # 游戏状态管理
│   ├── useSolver.js     # AI求解器集成
│   └── useDragDrop.js   # 拖拽逻辑封装
├── utils/               # 工具函数
│   ├── shapeRenderer.js # 形状渲染工具
│   ├── validator.js     # 位置验证逻辑
│   └── constants.js     # 游戏常量
├── styles/              # 样式文件
│   ├── GameBoard.css
│   ├── Shape.css
│   └── App.css
└── App.js              # 应用入口
```

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm start
```
访问 http://localhost:3000 查看应用。

### 构建生产版本
```bash
npm run build
```

## 🎯 核心组件详解

### GameBoard - 游戏主面板
管理整个游戏状态，协调各子组件的交互。

```javascript
const GameBoard = () => {
  const {
    board, shapes, selectedShape,
    placeShape, removeShape, resetGame
  } = useGameState();
  
  return (
    <div className="game-board">
      <CalendarGrid board={board} />
      <ShapeSelector shapes={shapes} />
      <SolverPanel />
    </div>
  );
};
```

### ShapeSelector - 形状选择器
展示所有可用形状，支持拖拽选择。

```javascript
const ShapeSelector = ({ shapes }) => {
  return (
    <div className="shape-selector">
      {shapes.map(shape => (
        <Shape 
          key={shape.id}
          shape={shape}
          draggable={true}
          onDragStart={handleDragStart}
        />
      ))}
    </div>
  );
};
```

### CalendarGrid - 日历网格
8x7的日历网格，显示当前日期标记和可放置区域。

```javascript
const CalendarGrid = ({ board }) => {
  return (
    <div className="calendar-grid">
      {board.map((row, i) => (
        <div key={i} className="grid-row">
          {row.map((cell, j) => (
            <Cell 
              key={`${i}-${j}`}
              cell={cell}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
```

## 🎨 样式系统

### CSS变量主题
```css
:root {
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --error-color: #ff4d4f;
  --warning-color: #faad14;
  
  --cell-size: 40px;
  --grid-gap: 2px;
  --border-radius: 4px;
}
```

### 响应式断点
```css
@media (max-width: 768px) {
  :root {
    --cell-size: 30px;
  }
  
  .game-board {
    flex-direction: column;
  }
}
```

## 🔧 开发指南

### 状态管理
使用React Context + useReducer管理复杂游戏状态：

```javascript
const GameContext = createContext();

const gameReducer = (state, action) => {
  switch (action.type) {
    case 'PLACE_SHAPE':
      return {
        ...state,
        board: updateBoard(state.board, action.payload),
        shapes: state.shapes.filter(s => s.id !== action.payload.shapeId)
      };
    case 'RESET_GAME':
      return initialState;
    default:
      return state;
  }
};
```

### 拖拽实现
使用HTML5 Drag and Drop API：

```javascript
const useDragDrop = () => {
  const [draggedShape, setDraggedShape] = useState(null);
  
  const handleDragStart = (e, shape) => {
    setDraggedShape(shape);
    e.dataTransfer.setData('application/json', JSON.stringify(shape));
  };
  
  const handleDrop = (e, position) => {
    e.preventDefault();
    const shape = JSON.parse(e.dataTransfer.getData('application/json'));
    if (isValidPlacement(shape, position)) {
      placeShape(shape, position);
    }
  };
  
  return { handleDragStart, handleDrop };
};
```

### AI求解器集成
通过Web Workers在后台运行求解算法：

```javascript
// worker.js
self.onmessage = function(e) {
  const { board, shapes } = e.data;
  const solution = solvePuzzle(board, shapes);
  self.postMessage({ solution });
};

// useSolver.js
const useSolver = () => {
  const [isSolving, setIsSolving] = useState(false);
  
  const solve = async (board, shapes) => {
    setIsSolving(true);
    const worker = new Worker('/solver-worker.js');
    
    worker.postMessage({ board, shapes });
    
    return new Promise((resolve) => {
      worker.onmessage = (e) => {
        setIsSolving(false);
        resolve(e.data.solution);
      };
    });
  };
  
  return { solve, isSolving };
};
```

## 📱 响应式设计

### 桌面布局
- 三栏布局：网格 | 形状选择器 | 控制面板
- 固定网格大小，形状面板可滚动

### 移动布局
- 垂直堆叠：网格在上，形状选择器在下
- 自适应网格大小，触摸优化

### 断点策略
```javascript
const ResponsiveGame = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
};
```

## 🧪 测试

### 单元测试
```bash
npm test
```

### 端到端测试
```bash
npm run test:e2e
```

### 性能测试
```bash
npm run test:performance
```

## 🚀 部署

### 本地开发部署

需要同时启动后端API服务和前端React应用：

```bash
# 启动Python API服务（端口5000）
python server.py

# 启动React前端（端口3000）
cd my-cal
npm start
```

### 生产部署

#### 方案1：Docker Compose（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  backend:
    build: 
      context: ..
      dockerfile: Dockerfile.backend
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - PORT=5000

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    environment:
      - REACT_APP_API_URL=http://localhost:5000
```

#### 方案2：独立Docker容器

**后端容器** (`../Dockerfile.backend`):
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "server.py"]
```

**前端容器** (`Dockerfile.frontend`):
```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 方案3：单服务器部署

在同一台服务器上部署前后端：

```bash
# 安装依赖
pip install -r requirements.txt
cd my-cal && npm install && npm run build

# 启动服务（使用进程管理器）
# 后端
python server.py &
# 前端静态服务
npx serve -s build -l 3000 &
```

### 环境配置

创建 `.env.production`：
```bash
# API配置
REACT_APP_API_URL=http://your-domain.com:5000

# 性能优化
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_CACHE_DURATION=3600

# 调试开关
REACT_APP_DEBUG=false
```

### Nginx反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /path/to/my-cal/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

### 健康检查

```bash
# 检查后端API
curl http://localhost:5000/api/health

# 检查前端页面
curl -I http://localhost:3000

# 检查完整链路
curl http://localhost:3000/api/solve -X POST -H "Content-Type: application/json" -d '{"date": "2024-01-01"}'
```

## 📄 环境变量

```bash
# .env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENABLE_ANALYTICS=true
```

## 🤝 贡献指南

1. Fork项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 创建Pull Request

## 📄 许可证

MIT License - 查看 [LICENSE](../LICENSE) 文件了解详情。
