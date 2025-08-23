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
    """前端调用此接口生成Game ID
    
    HTTP API 接口文档
    
    接口信息:
    - URL: /api/game-id
    - 方法: POST
    - Content-Type: application/json
    
    请求参数:
    - droppedBlocks (Array, 可选): 已放置的方块列表
      - 元素格式: {"id": "I-block", "x": 0, "y": 0}
      - id: 方块类型ID (如 "I-block", "L-block", "T-block"等)
      - x: 方块在棋盘上的x坐标 (列, 0-6)
      - y: 方块在棋盘上的y坐标 (行, 0-7)
    - remainingBlockTypes (Array, 可选): 剩余可用的方块类型
      - 如果不提供, 系统会自动从初始方块中移除已放置的方块
    - day (Number, 可选): 日期 (1-31), 默认为当前日期
    - month (Number, 可选): 月份 (1-12), 默认为当前月份
    
    响应数据:
    成功响应 (200 OK):
    {
      "gameId": 2083123359786657970,        // 生成的游戏ID (整数哈希值)
      "boardData": [[" "," "," "," "," "," "," "]...],  // 8x7棋盘数据
      "boardLayout": ["       ", "       ", ...],  // 棋盘的一维字符串表示
      "dimensions": {"rows": 8, "cols": 7},  // 棋盘尺寸信息
      "success": true
    }
    
    错误响应 (400/500):
    {
      "error": "Invalid input: [具体错误信息]",
      "success": false
    }
    
    使用示例:
    curl -X POST http://localhost:5001/api/game-id \
      -H "Content-Type: application/json" \
      -d '{
        "droppedBlocks": [
          {"id": "I-block", "x": 1, "y": 2},
          {"id": "L-block", "x": 3, "y": 0}
        ],
        "day": 15,
        "month": 12
      }'
    """
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
    """求解给定游戏状态的解决方案
    
    该接口接收与generate_game_id相同的参数，直接计算游戏ID并求解。
    消除了手动计算剩余方块类型的重复逻辑。
    
    请求参数:
    - droppedBlocks (Array): 已放置的方块列表
      - 格式: [{"id": "I-block", "x": 0, "y": 0}, ...]
    - remainingBlockTypes (Array, 可选): 剩余可用的方块类型
      - 如果不提供, 使用初始方块出去已放置方块
    - day (Number, 可选): 日期 (1-31), 默认当前日期
    - month (Number, 可选): 月份 (1-12), 默认当前月份
    
    响应数据:
    成功 (200):
    {
      "boardData": [[" "," "," "," "," "," "," "]...],  // 8x7棋盘数据
      "boardLayout": ["       ", "       ", ...],  // 棋盘的一维字符串表示
      "dimensions": {"rows": 8, "cols": 7},  // 棋盘尺寸信息
      "droppedBlocks": [...],  // 解决方案中的方块放置信息
      "remainingBlockTypes": [],  // 解决后剩余方块为空数组
      "solveTime": 1.234,  // 求解耗时(秒)
      "gameId": "abc123...",  // 游戏ID字符串
      "success": true
    }
    
    失败 (404):
    {
      "error": "no solution found",
      "solveTime": 0.123,
      "success": false
    }
    
    错误 (500):
    {
      "error": "具体错误信息",
      "success": false
    }
    """
    try:
        # 获取前端发送的游戏状态 - 与generate_game_id相同的参数格式
        data = request.json
        dropped_blocks = data.get('droppedBlocks', [])
        remaining_block_types = data.get('remainingBlockTypes')
        
        # 支持自定义日期 - 与generate_game_id保持一致
        day = data.get('day')
        month = data.get('month')
        
        # 使用CalendarGame生成标准棋盘 - 与generate_game_id相同逻辑
        board_data = get_board_with_date(day, month)
        
        # 计算游戏ID - 复用generate_game_id的完整逻辑
        try:
            board_data, game_id = id_generator.generate_game_id(
                dropped_blocks, 
                remaining_block_types, 
                board_data
            )
        except ValueError as e:
            return jsonify({
                'error': f'Invalid input: {str(e)}',
                'success': False
            }), 400
        except Exception as e:
            logging.error(f"Error generating game ID: {str(e)}")
            return jsonify({
                'error': 'Failed to generate game ID',
                'success': False
            }), 500

        # 将游戏状态保存到临时文件
        temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        temp_input = os.path.join(temp_dir, f'{game_id}_input.json')
        temp_output = os.path.join(temp_dir, f'{game_id}_output.json')

        # 构造完整的游戏状态
        game_state = {
            'boardData': board_data,
            'boardLayout': [''.join(map(str, row)) for row in board_data],
            'dimensions': {'rows': len(board_data), 'cols': len(board_data[0])},
            'droppedBlocks': dropped_blocks,
            'remainingBlockTypes': remaining_block_types
        }

        # 保存完整游戏状态
        with open(temp_input, 'w') as f:
            json.dump(game_state, f, indent=2)

        # 开始计时
        start_time = time.time()

        # 调用求解函数
        try:
            main(temp_input, temp_output)
        except Exception as e:
            logging.error(f"Solver error: {str(e)}")
            return jsonify({'error': f'Solver error: {str(e)}'}), 500

        # 结束计时
        end_time = time.time()
        solve_time = round(end_time - start_time, 3)

        # 读取求解结果（solve_for_web.py现在直接输出完整格式）
        with open(temp_output, 'r') as f:
            complete_solution = json.load(f)

        # 检查解决方案
        if not complete_solution or 'droppedBlocks' not in complete_solution or not complete_solution['droppedBlocks']:
            return jsonify({
                'error': 'no solution found',
                'solveTime': solve_time
            }), 404

        # 添加solveTime和gameId（solve_for_web.py可能不会包含这些）
        complete_solution['solveTime'] = solve_time
        complete_solution['gameId'] = game_id

        # 保存完整解决方案状态
        with open(temp_output, 'w') as f:
            json.dump(complete_solution, f, indent=2)

        return jsonify(complete_solution)

    except Exception as e:
        logging.error(f"Unexpected error in get_solution: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)