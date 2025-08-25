# Calendar Puzzle - 日历拼图游戏

这是一个基于经典日历拼图游戏的现代化实现，结合了高效的算法求解器和友好的用户界面。项目包含两个主要部分：
- **Python后端**：使用Dancing Links算法实现的高效求解器
- **React前端**：现代化的交互式游戏界面

## 🎮 游戏介绍

日历拼图是一个经典的逻辑拼图游戏，目标是将10个不同形状的木块完美填入一个8x7的日历网格中。网格包含月份和日期的特殊标记，玩家需要绕过这些标记来放置所有木块。

### 游戏特点
- **每日挑战**：根据当天日期自动生成独特的拼图布局
- **智能提示**：集成AI求解器，提供解题思路和验证
- **多平台支持**：Web版本 + 微信小程序版本
- **实时验证**：拖拽放置时即时检查有效性

## 🧠 核心算法 - Dancing Links (DLX)

### 算法概述

本项目使用Donald Knuth提出的Dancing Links算法（简称DLX）来解决精确覆盖问题。该算法是解決组合优化问题的经典算法，特别适用于拼图类问题。

### 性能表现

- **求解速度**：平均<100ms找到完整解
- **内存使用**：O(n×m)空间复杂度，n为可能放置数，m为约束条件数
- **扩展性**：可轻松扩展到更大尺寸的拼图

## 🖥️ React前端实现

### 技术栈
- **React 18** + **TypeScript** - 现代化组件架构
- **Canvas API** - 高性能图形渲染
- **CSS Grid** - 响应式布局
- **Web Workers** - 后台计算不阻塞UI

### 核心组件架构

```
src/
├── components/
│   ├── GameBoard.js      # 游戏主面板
│   ├── ShapeSelector.js  # 形状选择器
│   ├── CalendarGrid.js   # 日历网格
│   └── SolverPanel.js    # 求解器界面
├── hooks/
│   ├── useGameState.js   # 游戏状态管理
│   └── useSolver.js      # AI求解器集成
└── utils/
    ├── shapeRenderer.js  # 形状渲染工具
    └── validator.js      # 位置验证逻辑
```

### 交互特性

- **拖拽放置**：支持鼠标和触摸操作
- **实时预览**：拖拽时显示放置预览
- **撤销重做**：完整的操作历史栈
- **响应式设计**：适配桌面和移动设备

## 🏗️ 项目结构

```
CalendarPuzzle/
├── calendar_puzzle/          # Python核心算法
│   ├── dancing_link/         # DLX算法实现
│   ├── board.py             # 游戏板逻辑
│   ├── shape.py             # 形状定义
│   └── constants.py         # 游戏常量
├── my-cal/                   # React前端
│   ├── src/
│   │   ├── components/       # React组件
│   │   └── utils/           # 工具函数
├── calendar-puzzle-miniprogram/  # 微信小程序版本
├── server.py                # Flask后端API
├── daily.py                 # 每日挑战生成器
└── requirements.txt         # Python依赖
```

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- npm或yarn

### 安装运行

#### 方案1：本地开发环境

```bash
# 克隆项目
git clone https://github.com/your-username/CalendarPuzzle.git
cd CalendarPuzzle

# 安装Python依赖
pip install -r requirements.txt

# 启动后端API服务
python server.py

# 启动React前端
cd my-cal
npm install
npm start
```

#### 方案2：Docker一键部署（推荐）

```bash
# 克隆项目
git clone https://github.com/your-username/CalendarPuzzle.git
cd CalendarPuzzle

# 使用Docker Compose启动所有服务
# 前端：http://localhost:3000
# 后端：http://localhost:5000
docker-compose up -d

# 验证部署
curl http://localhost:5000/api/health
curl http://localhost:3000/api/health
```

#### 方案3：一键部署脚本（最简单）

```bash
# 使部署脚本可执行
chmod +x deploy.sh

# 启动开发环境（本地运行）
./deploy.sh dev

# 启动测试环境（Docker）
./deploy.sh test

# 启动生产环境（Docker + Nginx）
./deploy.sh prod

# 其他命令
./deploy.sh stop   # 停止所有服务
./deploy.sh logs   # 查看日志
./deploy.sh clean  # 清理环境
```

### 方案4：手动生产环境部署

```bash
# 生产环境启动
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 使用Nginx反向代理
sudo apt-get install nginx
sudo cp nginx.conf /etc/nginx/sites-available/calendar-puzzle
sudo ln -s /etc/nginx/sites-available/calendar-puzzle /etc/nginx/sites-enabled/
sudo nginx -s reload
```

### 使用示例

```python
from calendar_puzzle.dancing_link.calendar import FasterGame
import datetime

# 创建今日挑战
game = FasterGame(datetime.date.today())

# 求解并显示结果
game.solve(find_one_exit=True)
```

## 🎯 游戏规则详解

### 游戏板布局
- **尺寸**：8行7列的网格
- **特殊区域**：
  - 月份标记：位于顶部，标记当前月份
  - 日期标记：标记当天日期
  - 星期标记：标记当天星期

### 形状集合
游戏包含10种不同形状，每种形状都有独特的几何特性：

| 形状 | 大小 | 特点 |
|------|------|------|
| U形 | 4格 | 对称U型 |
| V形 | 4格 | 直角V型 |
| I形 | 4格 | 直线型 |
| L形 | 5格 | 长L型 |
| J形 | 4格 | 短J型 |
| Q形 | 4格 | 正方形 |
| S形 | 4格 | 曲折型 |
| N形 | 5格 | 长N型 |
| T形 | 4格 | T字型 |
| Z形 | 4格 | 对角Z型 |

### 胜利条件
- 所有10个形状必须全部放入网格
- 不能覆盖任何特殊标记（月份、日期、星期）
- 形状之间不能重叠

## 📸 游戏截图

### Web版本界面
*游戏主界面展示*
- 左侧：日历网格和当前日期标记
- 右侧：形状选择器和操作面板
- 底部：求解器控制按钮

### 解题过程
*动态求解演示*
- 形状拖拽：实时预览放置效果
- 无效位置：红色高亮提示
- 成功放置：绿色确认动画

### 每日挑战
*日期变化效果*
- 自动更新：根据系统日期调整布局
- 唯一解：每个日期对应唯一有效解
- 历史回顾：可查看任意日期的拼图

## 🧪 算法测试

### 测试覆盖
- **单元测试**：形状旋转/镜像变换
- **集成测试**：完整求解流程验证
- **性能测试**：不同复杂度下的求解时间
- **边界测试**：特殊日期（闰年、月末等）

### 基准测试
```bash
# 运行完整测试套件
python -m pytest test_*.py -v

# 性能基准测试
python test_end_to_end.py --benchmark
```

## 🤝 贡献指南

### 开发环境设置
```bash
# 安装开发依赖
pip install -r requirements-dev.txt

# 代码格式化
black calendar_puzzle/

# 类型检查
mypy calendar_puzzle/

# 运行测试
pytest tests/
```

### 提交规范
- 使用语义化提交消息
- 添加适当的测试用例
- 更新相关文档
- 通过CI检查

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙋‍♂️ 联系方式

- **Issues**: [GitHub Issues](https://github.com/your-username/CalendarPuzzle/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/CalendarPuzzle/discussions)
- **Email**: your.email@example.com

## 🔮 未来规划

- [ ] AI难度调节：根据用户水平自适应调整
- [ ] 多人对战：实时对战模式
- [ ] 成就系统：解锁新形状和皮肤
- [ ] 数据同步：跨设备进度同步
- [ ] AR版本：增强现实游戏体验

---

**⭐ 如果这个项目对你有帮助，请给个Star！**