# 提案：前后端交互架构重构

## 一、问题背景

### 1.1 当前状态

小程序前端目前通过 `wx.request` 调用后端 API，核心问题在于 API 地址被硬编码为本地地址：

```typescript
// api.tsx 第4行
const API_BASE_URL = 'http://localhost:5001/api';
```

这种设计存在以下问题：

| 问题类型 | 具体表现 | 影响 |
|---------|---------|-----|
| 环境问题 | localhost 无法在生产环境访问 | 小程序无法正常工作 |
| 配置问题 | 无环境区分机制 | 开发、测试、生产环境无法切换 |
| 部署问题 | 后端服务无法本地部署 | 用户无法获得求解器功能 |

### 1.2 业务影响

当前设计导致的核心业务问题：

1. **功能缺失**：求解器 API 无法调用，用户无法获得解题提示
2. **体验断裂**：游戏只能本地游玩，丧失云端求解的核心价值
3. **扩展受限**：未来无法添加排行榜、分享到微信等功能

### 1.3 技术约束

项目面临的技术约束条件：

- Python 后端无法在用户本地环境运行
- 微信小程序有严格的域名白名单限制
- Dancing Links 算法实现复杂，短期内无法迁移到 JavaScript

## 二、解决方案

### 2.1 方案对比分析

| 方案 | 优点 | 缺点 | 推荐场景 |
|-----|------|------|---------|
| **方案 A：云端部署后端** | 完整保留 Python 求解器 | 需要服务器资源，有运维成本 | 长期运营项目 |
| **方案 B：微信云函数** | 无需自建服务器，原生集成 | 运行时有资源限制，超时风险 | 小型应用，快速上线 |
| **方案 C：JS 求解器** | 完全无后端依赖 | 实现复杂，可能有性能问题 | 技术验证，原型开发 |
| **方案 D：混合方案** | 灵活配置，渐进式迁移 | 需要维护多套逻辑 | 平滑过渡项目 |

### 2.2 推荐方案：云端部署后端 + 环境配置

经过综合评估，推荐采用**方案 A**作为主方案，配合完善的**环境配置系统**实现平滑部署。

## 三、架构设计

### 3.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        微信小程序端                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  游戏核心逻辑 │  │  状态管理    │  │  API 通信层          │  │
│  │  useGame     │  │  useSolver   │  │  api.ts              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │               │
│         └─────────────────┴──────────────────────┘               │
│                           │                                      │
│                           ▼                                      │
│              ┌────────────────────────┐                          │
│              │  环境配置层             │                          │
│              │  config/api.ts         │                          │
│              └───────────┬────────────┘                          │
│                          │                                       │
│                          ▼                                       │
│              ┌────────────────────────┐                          │
│              │  wx.request            │                          │
│              └───────────┬────────────┘                          │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           │ HTTPS 请求
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     云端服务器（可部署）                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Flask API Server (server.py)                           │    │
│  │  ├── POST /api/game-id       → 生成游戏 ID              │    │
│  │  ├── POST /api/solution      → 求解当前布局             │    │
│  │  └── GET  /api/health        → 健康检查                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                      │
│                          ▼                                      │
│              ┌────────────────────────┐                          │
│              │  Dancing Links 求解器  │                          │
│              │  solve_for_web.py     │                          │
│              └────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 API 接口规范

#### 3.2.1 健康检查接口

```http
GET /api/health
```

**响应示例（200）：**
```json
{
  "status": "healthy",
  "timestamp": 1709312400,
  "service": "calendar-puzzle-api",
  "version": "1.0.0"
}
```

#### 3.2.2 生成游戏 ID 接口

```http
POST /api/game-id
Content-Type: application/json
```

**请求参数：**
```typescript
interface GameIdRequest {
  droppedBlocks?: PlacedBlock[];  // 已放置的方块
  remainingBlockTypes?: BlockType[];  // 剩余方块
  day?: number;   // 日期（可选，默认今天）
  month?: number; // 月份（可选，默认本月）
}
```

**响应示例（200）：**
```json
{
  "gameId": "abc123xyz",
  "boardData": [
    [" ", " ", " ", " ", " ", " ", " "],
    [" ", " ", "M", " ", " ", " ", " "],
    ...
  ],
  "boardLayout": ["       ", "  M    ", ...],
  "dimensions": { "rows": 8, "cols": 7 },
  "droppedBlocks": [],
  "remainingBlockTypes": [
    { "id": "I-block", "label": "I", "color": "#FF6B6B", "shape": [[0,0]] }
  ],
  "success": true
}
```

**错误响应（400/500）：**
```json
{
  "error": "Invalid input: ...",
  "success": false
}
```

#### 3.2.3 求解接口

```http
POST /api/solution
Content-Type: application/json
```

**请求参数：**
```typescript
interface SolutionRequest {
  gameId: string;           // 游戏 ID
  droppedBlocks: PlacedBlock[];   // 已放置的方块
  uncoverableCells: UncoverableCell[];  // 不可覆盖的单元格
  blockTypes: BlockType[];      // 剩余方块类型
}
```

**成功响应（200）：**
```json
{
  "boardData": [...],
  "droppedBlocks": [
    { "id": "I-block", "x": 0, "y": 0, "shape": [...] }
  ],
  "solveTime": 1.234,
  "gameId": "abc123xyz",
  "success": true
}
```

**无解响应（404）：**
```json
{
  "error": "no solution found",
  "solveTime": 0.567,
  "suggestion": "请尝试移除某些方块或调整方块位置",
  "success": false
}
```

### 3.3 环境配置设计

#### 3.3.1 配置文件结构

```
config/
├── index.ts           # 统一配置导出
├── api.ts             # API 地址配置
├── development.ts     # 开发环境配置
├── production.ts      # 生产环境配置
└── test.ts            # 测试环境配置
```

#### 3.3.2 API 配置实现

```typescript
// config/api.ts

// 环境类型定义
type Environment = 'development' | 'production' | 'test';

// API 配置接口
interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryCount: number;
}

// 环境配置
const configs: Record<Environment, ApiConfig> = {
  development: {
    baseUrl: 'http://localhost:5001/api',
    timeout: 10000,
    retryCount: 3
  },
  production: {
    baseUrl: 'https://your-api-domain.com/api',
    timeout: 15000,
    retryCount: 2
  },
  test: {
    baseUrl: 'http://localhost:5001/api',
    timeout: 10000,
    retryCount: 1
  }
};

// 获取当前环境
const getCurrentEnvironment = (): Environment => {
  // 优先使用环境变量
  if (process.env.TARO_ENV === 'production') {
    return 'production';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  return 'development';
};

// 导出当前环境配置
export const apiConfig: ApiConfig = configs[getCurrentEnvironment()];

// 便捷访问
export const API_BASE_URL = apiConfig.baseUrl;
export const API_TIMEOUT = apiConfig.timeout;
```

#### 3.3.3 环境变量配置

```typescript
// .env.development
TARO_APP_API_BASE_URL=http://localhost:5001/api
TARO_APP_ENABLE_LOGGING=true

// .env.production
TARO_APP_API_BASE_URL=https://calendar-puzzle-api.example.com/api
TARO_APP_ENABLE_LOGGING=false
```

### 3.4 API 通信层重构

#### 3.4.1 统一请求封装

```typescript
// utils/api.ts

import { API_BASE_URL, API_TIMEOUT } from '../config/api';
import { logError, logDebug } from './logger';
import { GameIdRequest, GameIdResponse, SolutionRequest, Solution } from '../types/game';

interface RequestOptions {
  url: string;
  method: 'GET' | 'POST';
  data?: any;
  timeout?: number;
}

const request = async <T>(options: RequestOptions): Promise<T> => {
  const { url, method, data, timeout = API_TIMEOUT } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    wx.request({
      url: url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json'
      },
      timeout,
      success: (res) => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        logDebug(`API request completed in ${elapsedTime}s: ${method} ${url}`);

        if (res.statusCode === 200) {
          resolve(res.data as T);
        } else if (res.statusCode === 404) {
          reject({
            status: 404,
            data: res.data,
            message: 'Resource not found'
          });
        } else {
          reject({
            status: res.statusCode,
            data: res.data,
            message: `HTTP ${res.statusCode}`
          });
        }
      },
      fail: (err) => {
        logError(`API request failed: ${method} ${url}`, err);
        reject({
          status: 0,
          data: null,
          message: err.errMsg || 'Network error'
        });
      }
    });
  });
};

// API 服务
export const api = {
  async fetchGameId(payload: GameIdRequest): Promise<GameIdResponse> {
    logDebug('Fetching game ID:', payload);

    const response = await request<GameIdResponse & { success: boolean }>({
      url: '/game-id',
      method: 'POST',
      data: payload
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to generate game ID');
    }

    return response;
  },

  async fetchSolution(payload: SolutionRequest): Promise<Solution> {
    logDebug('Fetching solution:', payload);

    const response = await request<Solution & { success: boolean; error?: string }>({
      url: '/solution',
      method: 'POST',
      data: payload
    });

    if (!response.success) {
      // 404 表示无解，这是预期内的错误
      if (response.status === 404) {
        throw new Error('No solution found for current configuration');
      }
      throw new Error(response.error || 'Failed to fetch solution');
    }

    return response;
  },

  async checkHealth(): Promise<{ status: string }> {
    return request({
      url: '/health',
      method: 'GET'
    });
  }
};
```

## 四、部署方案

### 4.1 后端部署选项

#### 4.1.1 方案一：Railway（推荐）

**优势：**
- 免费额度充足，适合小项目
- 自动部署 GitHub 仓库
- 提供自定义域名
- 支持环境变量配置

**部署步骤：**
```bash
# 1. 创建 Railway 项目
railway init

# 2. 设置环境变量
railing var set PORT=5001

# 3. 部署
railway up

# 4. 获取访问地址
railway domain
```

**配置示例（railway.json）：**
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "python server.py",
    "restartPolicy": {
      "type": "ON_FAILURE",
      "delay": 5
    }
  }
}
```

#### 4.1.2 方案二：Fly.io

**优势：**
- 全球多区域部署
- 低延迟访问
- 适合有全球化需求的项目

**部署步骤：**
```bash
# 1. 安装 Fly CLI
brew install flyctl

# 2. 登录
flyctl auth login

# 3. 创建应用
flyctl apps create calendar-puzzle-api

# 4. 部署
flyctl deploy

# 5. 添加自定义域名
flyctl certs add api.calendar-puzzle.com
```

**Dockerfile：**
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5001

CMD ["python", "server.py"]
```

#### 4.1.3 方案三：Heroku

**优势：**
- 老牌 PaaS，文档完善
- 免费额度可用

**部署步骤：**
```bash
# 1. 安装 Heroku CLI
brew install heroku/brew/heroku

# 2. 登录
heroku login

# 3. 创建应用
heroku create calendar-puzzle-api

# 4. 部署
git push heroku main

# 5. 查看地址
heroku open
```

### 4.2 微信小程序配置

#### 4.2.1 域名白名单配置

在小程序后台（微信公众平台）配置：

1. 进入「开发管理」→「开发设置」
2. 在「服务器域名」中添加：
   - request 合法域名：`https://your-api-domain.com`
   - socket 合法域名：如需 WebSocket

#### 4.2.2 小程序代码配置

```typescript
// app.config.ts
export default defineAppConfig({
  pages: [
    'pages/index/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'Calendar Puzzle',
    navigationBarTextStyle: 'black'
  },
  // 网络超时配置
  networkTimeout: {
    request: 15000,
    connectSocket: 10000
  }
});
```

## 五、备选方案：微信云函数

### 5.1 方案概述

如果不想自建后端服务器，可以将 Python 逻辑迁移到微信云函数。但需要注意：

- 微信云函数运行时为 Node.js，非 Python
- 需要用 JavaScript/TypeScript 重写求解器，或使用 Serverless Container

### 5.2 Serverless Container 方案

微信云开发支持 Serverless Container，可以运行任意语言：

```typescript
// cloudfunctions/solve/index.js
const { Cloud } = require('qcloud-serverless-sdk');

// 初始化云开发
const cloud = new Cloud({
  env: process.env.QUMIAO_CLOUD_ENV
});

exports.main = async (event, context) => {
  const { droppedBlocks, blockTypes, day, month } = event;

  // 调用外部 Python 服务或使用 JS 求解器
  const solution = await solvePuzzle(droppedBlocks, blockTypes, day, month);

  return {
    solution,
    solveTime: Date.now() - context.timestamp * 1000
  };
};
```

### 5.3 注意事项

| 限制项 | 说明 | 应对策略 |
|-------|------|---------|
| 冷启动 | Serverless 有冷启动延迟 | 保持活跃调用，设置预热 |
| 超时限制 | 云函数默认 5 秒超时 | 申请延长时间或优化算法 |
| 资源限制 | CPU/内存有限制 | 限制求解复杂度 |
| 费用 | 超出免费额度收费 | 监控用量，合理规划 |

## 六、实施计划

### 6.1 任务分解

| 阶段 | 任务 | 预估工时 | 优先级 |
|-----|------|---------|--------|
| **阶段一：配置层** | 创建环境配置文件 | 2h | P0 |
| | 重构 API 通信层 | 4h | P0 |
| | 添加类型定义 | 1h | P1 |
| **阶段二：部署** | 选择并部署后端服务 | 4h | P0 |
| | 配置域名和 HTTPS | 2h | P1 |
| **阶段三：集成** | 更新小程序配置 | 1h | P0 |
| | 测试完整流程 | 2h | P1 |
| **阶段四：优化** | 添加错误处理 | 2h | P2 |
| | 添加重试机制 | 2h | P2 |

### 6.2 详细任务清单

#### 阶段一：配置层

- [ ] 创建 `config/index.ts` 统一配置
- [ ] 创建 `config/api.ts` API 配置
- [ ] 创建 `.env.development` 开发环境变量
- [ ] 创建 `.env.production` 生产环境变量
- [ ] 重构 `utils/api.ts` 通信层
- [ ] 更新 `utils/logger.ts` 添加环境判断
- [ ] 更新 `src/types/game.tsx` 补充类型

#### 阶段二：部署

- [ ] 选择部署平台（Railway/Fly.io/Heroku）
- [ ] 创建部署配置（Dockerfile/railway.json）
- [ ] 部署后端服务
- [ ] 配置自定义域名
- [ ] 申请 SSL 证书
- [ ] 更新生产环境变量

#### 阶段三：集成

- [ ] 在小程序后台配置域名白名单
- [ ] 测试本地开发环境
- [ ] 测试生产环境
- [ ] 验证求解功能

### 6.3 验收标准

1. ✅ 开发环境：本地运行，API 指向 localhost:5001
2. ✅ 生产环境：线上运行，API 指向云端地址
3. ✅ 切换环境：修改环境变量即可切换，无需改代码
4. ✅ 错误处理：网络错误有友好的用户提示
5. ✅ 部署验证：微信开发助手可正常打开并使用求解功能

## 七、风险与应对

### 7.1 技术风险

| 风险 | 可能性 | 影响 | 应对措施 |
|-----|-------|------|---------|
| 云端服务不稳定 | 中 | 用户无法使用求解 | 添加本地缓存和错误提示 |
| 域名解析慢 | 低 | 首次请求超时 | 使用 CDN 加速 |
| API 版本不兼容 | 低 | 请求失败 | 版本号控制，向后兼容 |

### 7.2 运营风险

| 风险 | 可能性 | 影响 | 应对措施 |
|-----|-------|------|---------|
| 云服务费用超支 | 低 | 额外支出 | 设置用量告警，使用免费额度 |
| 域名过期 | 低 | 服务中断 | 设置日历提醒 |
| 小程序审核被拒 | 低 | 无法上线 | 遵守平台规范 |

## 八、附录

### 8.1 相关文件清单

| 文件路径 | 说明 |
|---------|------|
| `src/utils/api.tsx` | API 通信层（待重构） |
| `src/types/game.tsx` | 类型定义（待补充） |
| `config/api.ts` | API 配置（待创建） |
| `server.py` | Flask 后端（已有） |
| `solve_for_web.py` | 求解器（已有） |

### 8.2 外部资源

- **Railway 文档**：https://docs.railway.app
- **Fly.io 文档**：https://fly.io/docs
- **微信小程序网络请求**：https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html
- **Taro 环境配置**：https://docs.taro.zone/docs/env
