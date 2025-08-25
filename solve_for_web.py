import sys
import json
import os
import sys
from calendar_puzzle.dancing_link.calendar import Game, FasterGame
from calendar_puzzle.shape import Shape
import numpy as np

# 形状映射，用于将求解器中的形状映射到前端的形状
SHAPE_MAPPING = {
    'I': 'I-block',
    'T': 'T-block',
    'L': 'L-block',
    'S': 'S-block',
    'Z': 'Z-block',
    'N': 'N-block',
    'Q': 'Q-block',
    'V': 'V-block',
    'U': 'U-block',
    'J': 'J-block'
}

# 主函数
def main(input_file, output_file):
    try:
        # 读取前端发送的游戏状态
        with open(input_file, 'r') as f:
            game_state = json.load(f)

        # 初始化求解器
        g = FasterGame()
        # g = Game()

        # 设置当前已放置的方块
        dropped_blocks = game_state.get('droppedBlocks', [])
        for block in dropped_blocks:
            # 找到对应的形状
            shape_label = next((k for k, v in SHAPE_MAPPING.items() if v == block['id']), None)
            if shape_label:
                # 将前端的形状格式转换为求解器的形状格式
                shape_matrix = []
                for row in block['shape']:
                    shape_matrix.append([' ' if cell == 0 else shape_label for cell in row])
                shape = Shape(shape_matrix)
                # 放置方块
                x, y = block['x'], block['y']
                # 前端x是横轴，y是纵轴，所以要换一下
                succ, new_b = g.fit_put(y, x, shape)
                g.board.remaining_shapes = [s for s in g.board.remaining_shapes if s.name != shape_label]

                if succ:
                    g.board.b = new_b
                else:
                    print(f"Failed to place shape at position ({x}, {y})", file=sys.stderr)

        # 求解
        g.solve(find_one_exit=True)

        # 直接使用g.board而不是转换为numpy数组
        board = g.board.b
        rows = len(board)
        cols = len(board[0]) if rows > 0 else 0

        # 构建完整的解决方案格式，与server.py的新格式保持一致
        solution = {
            'boardData': board,
            'boardLayout': [''.join(map(str, row)) for row in board],
            'dimensions': {'rows': rows, 'cols': cols},
            'droppedBlocks': [],
            'remainingBlockTypes': []  # 解决后剩余块为空
        }

        # 记录每个形状的位置
        shape_positions = {}
        for y in range(rows):
            for x in range(cols):
                shape_label = board[y][x]
                if shape_label != ' ':
                    if shape_label not in shape_positions:
                        shape_positions[shape_label] = []
                    shape_positions[shape_label].append((x, y))

        # 处理每个形状
        for shape_label, positions in shape_positions.items():
            # 计算形状的边界框
            xs, ys = zip(*positions)
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)

            # 创建形状矩阵
            shape_matrix = []
            for y in range(min_y, max_y + 1):
                row = []
                for x in range(min_x, max_x + 1):
                    row.append(1 if (x, y) in positions else 0)
                shape_matrix.append(row)

            # 转换为前端坐标
            frontend_x, frontend_y = min_x, min_y

            # 添加到解决方案
            if shape_label in SHAPE_MAPPING:
                solution['droppedBlocks'].append({
                    'id': SHAPE_MAPPING[shape_label],
                    'label': shape_label,
                    'x': frontend_x,
                    'y': frontend_y,
                    'shape': shape_matrix
                })

        # 保存解决方案到临时文件
        with open(output_file, 'w') as f:
            json.dump(solution, f)

        print(f'save solution to {output_file}')

    except Exception as e:
        print(f'错误: {str(e)}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('用法: python solve_for_web.py <输入文件> <输出文件>', file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    main(input_file, output_file)