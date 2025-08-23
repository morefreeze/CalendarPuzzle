# Calendar Puzzle Python Core

日历拼图的核心Python算法实现，基于Dancing Links (DLX)算法的高效求解器。

## 🧠 算法核心

### Dancing Links (DLX) 算法

DLX算法由Donald Knuth提出，用于解决精确覆盖问题。在本项目中，我们将日历拼图问题转化为精确覆盖问题，然后使用DLX算法高效求解。

#### 算法原理

1. **问题建模**：将拼图问题转化为0-1矩阵
2. **数据结构**：使用双向十字链表存储矩阵
3. **搜索策略**：递归回溯 + 启发式剪枝
4. **优化技巧**：最小列优先 + 对称性消除

### 核心组件

#### 1. DLX数据结构 (`dl.py`)

```python
class Node:
    """DLX链表节点"""
    coordinate: Tuple[int, int]  # 节点坐标
    up/down/left/right: Node     # 四个方向链接
    head: Node                   # 所属列头
    size: int                    # 列大小（仅列头）

class Dlx:
    """DLX算法实现"""
    
    def __init__(self, matrix, row_names):
        """从0-1矩阵构建DLX结构"""
        
    def search(self):
        """生成所有可行解"""
        yield solution
        
    def cover(self, col):
        """删除列及其相关行 - O(1)时间"""
        
    def uncover(self, col):
        """恢复列及其相关行 - O(1)时间"""
```

#### 2. 日历游戏逻辑 (`calendar.py`)

```python
class FasterGame:
    """高效的游戏求解器"""
    
    def build_shape(self):
        """构建形状矩阵"""
        
    def gen_shape_in_board(self):
        """生成所有可能的形状放置位置"""
        
    def solve(self, find_one_exit=True):
        """求解拼图"""
```

#### 3. 游戏板管理 (`board.py`)

```python
class Game:
    """基础游戏逻辑"""
    
    def mark_date(self, dt):
        """根据日期标记特殊位置"""
        
    def fit_put(self, x, y, shape):
        """检查形状是否可以放置在指定位置"""
        
    def try_put(self, find_one_exit):
        """递归尝试所有可能的放置"""
```

#### 4. 形状定义 (`shape.py`)

```python
class Shape:
    """拼图形状基类"""
    
    def rotate(self, times=1):
        """旋转形状"""
        
    def h_mirror(self):
        """水平镜像"""
        
    def v_mirror(self):
        """垂直镜像"""
        
    def all_shapes(self):
        """生成所有变换后的形状"""
```

## 🚀 快速开始

### 基本使用

```python
from calendar_puzzle.dancing_link.calendar import FasterGame
import datetime

# 创建今日挑战
game = FasterGame(datetime.date.today())

# 求解并显示结果
game.solve(find_one_exit=True)
```

### 自定义日期

```python
# 创建特定日期的挑战
game = FasterGame(datetime.date(2024, 1, 1))
game.solve()
```

### 性能测试

```python
import time

game = FasterGame()
start = time.time()
game.solve(find_one_exit=True)
print(f"求解时间: {time.time() - start:.3f}秒")
```

## 🔧 高级用法

### 自定义形状集合

```python
from calendar_puzzle.shape import ShapeU, ShapeV, ShapeI
from calendar_puzzle.board import Game

# 创建自定义形状集合
shapes = [ShapeU(), ShapeV(), ShapeI()]
game = Game(shapes=shapes)
```

### 获取所有解

```python
game = FasterGame()
solutions = list(game.solve(find_one_exit=False))
print(f"找到 {len(solutions)} 个解")
```

### 自定义验证逻辑

```python
class CustomGame(FasterGame):
    def fit_put(self, x, y, shape):
        # 自定义放置验证逻辑
        if self.is_magic_position(x, y):
            return False, self.board.b
        return super().fit_put(x, y, shape)
```

## 🧪 测试套件

### 运行测试

```bash
# 运行所有测试
python -m pytest tests/

# 运行特定测试
python -m pytest tests/test_dlx.py -v

# 性能测试
python tests/benchmark.py
```

### 测试覆盖

- **单元测试**：形状变换、DLX操作
- **集成测试**：完整求解流程
- **性能测试**：不同复杂度下的性能
- **边界测试**：特殊日期和边界条件

## 📈 算法优化

### 1. 启发式搜索

使用最小列优先策略：

```python
def choose_column(self):
    """选择大小最小的列，减少搜索空间"""
    col = self.head.right
    min_value = float('inf')
    for node in self.iter_columns():
        if node.size < min_value:
            min_value = node.size
            col = node
    return col
```

### 2. 对称性消除

避免重复计算等价形状：

```python
def all_shapes(self):
    """生成所有唯一变换后的形状"""
    visited = set()
    for transform in self._generate_transforms():
        if transform not in visited:
            yield transform
            visited.add(transform)
```

### 3. 缓存优化

缓存中间结果：

```python
@lru_cache(maxsize=1024)
def board_hash(self, board_state):
    """缓存棋盘状态的哈希值"""
    return hash(str(board_state))
```

## 🎮 形状详解

### 形状集合

游戏包含10种标准形状：

| 形状类 | 网格表示 | 大小 | 变换数量 |
|--------|----------|------|----------|
| ShapeU | UU\nU\nUU | 4 | 8 |
| ShapeV | VVV\nV\nV | 4 | 8 |
| ShapeI | IIII | 4 | 2 |
| ShapeL | LLLL\nL | 5 | 8 |
| ShapeJ | JJJ\nJ | 4 | 8 |
| ShapeQ | Q\nQQ\nQQ | 4 | 1 |
| ShapeS |  SS\nSS | 4 | 4 |
| ShapeN |   NN\nNNN | 5 | 8 |
| ShapeT | TTT\n T\n T | 4 | 8 |
| ShapeZ |  ZZ\n  Z\nZZ | 4 | 4 |

### 形状变换

每个形状支持以下变换：
- **旋转**：90°, 180°, 270°
- **镜像**：水平镜像、垂直镜像
- **组合变换**：旋转+镜像

## 🔍 调试工具

### 可视化调试

```python
from calendar_puzzle.dancing_link.dl import Dlx
import pprint

# 创建DLX实例
dlx = Dlx(matrix, row_names)

# 打印矩阵结构
dlx.print_dlx()

# 逐步调试搜索过程
def debug_search(self):
    print("开始搜索...")
    for step, solution in enumerate(self.search()):
        print(f"找到解 #{step + 1}: {solution}")
        if step >= 5:  # 限制输出
            break
```

### 性能分析

```python
import cProfile
import pstats

# 性能分析
cProfile.run('game.solve()', 'profile.stats')
stats = pstats.Stats('profile.stats')
stats.sort_stats('cumulative').print_stats(10)
```

## 📚 相关资源

### 学术论文
- Donald Knuth: "Dancing Links" (2000)
- DLX算法详解：[arXiv:cs/0011047](https://arxiv.org/abs/cs/0011047)

### 算法实现
- [Knuth's Original Paper](https://www-cs-faculty.stanford.edu/~knuth/papers/dancing-color.ps.gz)
- [DLX Algorithm Visualization](https://www.ocf.berkeley.edu/~jchu/publicportal/sudoku/sudoku.paper.html)

### 类似项目
- [Sudoku DLX Solver](https://github.com/mattflow/sudoku-dlx)
- [Polyomino Topics](https://github.com/topics/polyominoes)

## 🤝 贡献指南

### 开发环境

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

1. 创建特性分支：`git checkout -b feature/amazing-feature`
2. 添加测试：`pytest tests/`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建Pull Request

## 📄 许可证

MIT License - 查看项目根目录的 [LICENSE](../LICENSE) 文件了解详情。