from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import time  # 添加时间模块用于计时
import logging  # 添加日志模块
from solve_for_web import main

# 配置日志
logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# 方块类型和棋盘布局数据（与webapp保持一致）
INITIAL_BLOCK_TYPES = [
    {'id': 'I-block', 'label': 'I', 'color': '#FF69B4', 'shape': [[1, 1, 1, 1, 1]]},
    {'id': 'T-block', 'label': 'T', 'color': '#00BFFF', 'shape': [[1, 1, 1], [0, 1, 0]]},
    {'id': 'L-block', 'label': 'L', 'color': '#FFD700', 'shape': [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 1, 1]]},
    {'id': 'S-block', 'label': 'S', 'color': '#32CD32', 'shape': [[0, 1, 1], [1, 1, 0]]},
    {'id': 'Z-block', 'label': 'Z', 'color': '#FF4500', 'shape': [[1, 1, 0], [0, 1, 1]]},
    {'id': 'N-block', 'label': 'N', 'color': '#8A2BE2', 'shape': [[1, 1, 1, 1], [0, 0, 0, 1]]},
    {'id': 'Q-block', 'label': 'Q', 'color': '#A0522D', 'shape': [[1, 1], [1, 1]]},
    {'id': 'Y-block', 'label': 'Y', 'color': '#9370DB', 'shape': [[1, 0, 0], [1, 0, 0], [1, 1, 1]]},
    {'id': 'U-block', 'label': 'U', 'color': '#FF6347', 'shape': [[1, 0, 1], [1, 1, 1]]},
    {'id': 'l-block', 'label': 'l', 'color': '#008000', 'shape': [[1, 0], [1, 0], [1, 1]]}
]

BOARD_LAYOUT_DATA = [
    [{'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}],
    [{'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}],
    [{'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}],
    [{'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}],
    [{'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}],
    [{'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}],
    [{'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}, {'type': 'normal'}]
]

def generate_game_id(block_types, board_layout):
    """生成与webapp相同的游戏ID"""
    # 对block_types进行排序以确保一致性
    sorted_block_types = sorted(block_types, key=lambda x: x['id'])
    # 生成方块类型的字符串表示
    blocks_str = '|'.join([f"{block['id']}:{json.dumps(block['shape'], separators=(',', ':'))}" for block in sorted_block_types])
    # 生成棋盘布局的字符串表示
    board_str = json.dumps(board_layout, separators=(',', ':'))
    # 使用简单的哈希算法生成唯一ID
    hash_val = 0
    str_combined = blocks_str + board_str
    for char in str_combined:
        hash_val = ((hash_val << 5) - hash_val) + ord(char)
        hash_val = hash_val & 0xFFFFFFFF  # 转换为32位整数
    return str(abs(hash_val))

@app.route('/api/solution', methods=['POST'])
def get_solution():
    try:
        # 获取前端发送的游戏状态
        data = request.json
        game_id = data.get('gameId')
        dropped_blocks = data.get('droppedBlocks', [])
        uncoverable_cells = data.get('uncoverableCells', [])

        # 验证gameId是否匹配
        expected_game_id = generate_game_id(INITIAL_BLOCK_TYPES, BOARD_LAYOUT_DATA)
        if game_id != expected_game_id:
            logging.warning(f"game_id mismatch: received '{game_id}', expected '{expected_game_id}'")

        # 将游戏状态保存到临时文件，以便Python求解器读取
        temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        temp_input = os.path.join(temp_dir, f'{expected_game_id}_input.json')
        temp_output = os.path.join(temp_dir, f'{expected_game_id}_output.json')

        with open(temp_input, 'w') as f:
            json.dump({
                'droppedBlocks': dropped_blocks,
                'uncoverableCells': uncoverable_cells
            }, f)

        # 开始计时
        start_time = time.time()

        # 直接调用求解函数
        try:
            main(temp_input, temp_output)
        except Exception as e:
            return jsonify({'error': f'something wrong: {str(e)}'}), 500

        # 结束计时
        end_time = time.time()
        solve_time = round(end_time - start_time, 3)  # 保留3位小数

        # 读取求解器输出的解决方案
        with open(temp_output, 'r') as f:
            solution = json.load(f)

        # 检查是否有解决方案
        if not solution or 'blocks' not in solution or not solution['blocks']:
            return jsonify({
                'error': 'no solution found',
                'solveTime': solve_time
            }), 404

        # 添加求解时间到返回结果
        solution['solveTime'] = solve_time

        return jsonify(solution)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)