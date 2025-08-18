from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import time  # 添加时间模块用于计时
import logging  # 添加日志模块
from solve_for_web import main
from game_id import GameIDGeneratorV3
from calendar_puzzle.board import Game as CalendarGame
from calendar_puzzle.constants import DATE_BLOCK, INITIAL_BLOCK_TYPES, BLOCK_TYPE_MAPPING, BOARD_BLOCK


# 配置日志 - 包含文件名和行号便于调试
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# 初始化GameID生成器
id_generator = GameIDGeneratorV3()

def get_board_with_date(day=None, month=None):
    """使用CalendarGame生成标准棋盘布局
    
    Args:
        day: 日期(1-31)，默认使用当前日期
        month: 月份(1-12)，默认使用当前月份
    
    Returns:
        8x7棋盘数组，包含BLOCK标记的不可放置格子
    """
    import datetime
    
    if day is None or month is None:
        dt = datetime.date.today()
    else:
        dt = datetime.date(datetime.date.today().year, month, day)
    
    game = CalendarGame(dt)
    return game.board.b  # 返回8x7棋盘



@app.route('/api/game-id', methods=['POST'])
def generate_game_id_api():
    """前端调用此接口生成Game ID"""
    try:
        data = request.json
        dropped_blocks = data.get('droppedBlocks', [])
        remaining_block_types = data.get('remainingBlockTypes')
        
        # 支持自定义日期
        day = data.get('day')
        month = data.get('month')
        
        # 使用CalendarGame生成标准棋盘
        board_data = get_board_with_date(day, month)
        
        # 计算剩余方块类型（从初始方块中移除已放置的方块）
        if remaining_block_types is None:
            placed_block_ids = {block['id'] for block in dropped_blocks}
            remaining_block_types = [block_type for block_type in INITIAL_BLOCK_TYPES if block_type['id'] not in placed_block_ids]
        
        # 生成Game ID
        try:
            board_data, game_id = id_generator.generate_game_id(dropped_blocks, remaining_block_types, board_data)
        except ValueError as e:
            return jsonify({
                'error': f'Invalid input: {str(e)}',
                'success': False
            }), 400
        except Exception as e:
            logging.error(f"Unexpected error generating game ID: ", exc_info=e)
            return jsonify({
                'error': 'Internal server error',
                'success': False
            }), 500
        
        return jsonify({
            'gameId': game_id,
            'boardData': board_data,
            'boardLayout': [''.join(map(str, row)) for row in board_data],
            'dimensions': {'rows': len(board_data), 'cols': len(board_data[0])},  # 告知前端实际尺寸
            'success': True
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/api/solution', methods=['POST'])
def get_solution():
    try:
        # 获取前端发送的游戏状态
        data = request.json
        game_id = data.get('gameId')
        dropped_blocks = data.get('droppedBlocks', [])
        # uncoverable_cells = data.get('uncoverableCells', [])

        # 计算剩余方块类型（从初始方块中移除已放置的方块）
        remaining_block_types = []
        placed_block_ids = {block['id'] for block in dropped_blocks}
        for block_type in INITIAL_BLOCK_TYPES:
            if block_type['id'] not in placed_block_ids:
                remaining_block_types.append(block_type)
        
        # 验证gameId是否匹配
        expected_game_id = generate_game_id(dropped_blocks, remaining_block_types, BOARD_LAYOUT_DATA)
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
                # 'uncoverableCells': uncoverable_cells
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