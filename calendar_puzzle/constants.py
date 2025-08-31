"""Calendar Puzzle 游戏常量定义

这个模块包含游戏中使用的所有常量定义，确保前后端一致性。
"""

# 方块类型定义
INITIAL_BLOCK_TYPES = [
    {'id': 'I-block', 'label': 'I', 'color': '#00FFFF', 'shape': [[1, 1, 1, 1]]},
    {'id': 'T-block', 'label': 'T', 'color': '#800080', 'shape': [[0, 1, 0], [0, 1, 0], [1, 1, 1]]},
    {'id': 'L-block', 'label': 'L', 'color': '#FFA500', 'shape': [[1, 0], [1, 0], [1, 0], [1, 1]]},
    {'id': 'S-block', 'label': 'S', 'color': '#00FF00', 'shape': [[0, 1, 1], [1, 1, 0]]},
    {'id': 'Z-block', 'label': 'Z', 'color': '#FF0000', 'shape': [[1, 1, 0], [0, 1, 0], [0, 1, 1]]},
    {'id': 'N-block', 'label': 'N', 'color': '#A52A2A', 'shape': [[1, 1, 1, 0], [0, 0, 1, 1]]},
    {'id': 'Q-block', 'label': 'Q', 'color': '#FFC0CB', 'shape': [[1, 1, 0], [1, 1, 1]]},
    {'id': 'V-block', 'label': 'V', 'color': '#9370DB', 'shape': [[1, 0, 0], [1, 0, 0], [1, 1, 1]]},
    {'id': 'U-block', 'label': 'U', 'color': '#FF6347', 'shape': [[1, 0, 1], [1, 1, 1]]},
    {'id': 'J-block', 'label': 'J', 'color': '#008000', 'shape': [[1, 0], [1, 0], [1, 1]]}
]

# 方块类型映射（用于前后端通信）
BLOCK_TYPE_MAPPING = {
    'I': 'I-block',
    'T': 'T-block',
    'L': 'L-block',
    'S': 'S-block',
    'Z': 'Z-block',
    'N': 'N-block',
    'Q': 'Q-block',
    'Y': 'V-block',
    'U': 'U-block',
    'l': 'J-block'
}

# 棋盘布局常量
BOARD_BLOCK = '#'
DATE_BLOCK = '*'
EMPTY_CELL = ' '
DIGGED_CELL = '@'

# 棋盘尺寸
BOARD_ROWS = 8
BOARD_COLS = 7
BOARD_WIDTH = 7
BOARD_HEIGHT = 8
