#!/usr/bin/env python3
"""
测试server.py的新格式是否正确
"""
import json
import os
import sys
import tempfile

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from calendar_puzzle.board import Game as CalendarGame
from game_id import GameIDGeneratorV3
from calendar_puzzle.constants import INITIAL_BLOCK_TYPES

def get_board_with_date(day=None, month=None):
    """使用CalendarGame生成标准棋盘布局"""
    import datetime
    
    if day is None or month is None:
        dt = datetime.date.today()
    else:
        dt = datetime.date(datetime.date.today().year, month, day)
    
    game = CalendarGame(dt)
    return game.board.b  # 返回8x7棋盘

def test_new_format():
    """测试新的游戏状态格式"""
    
    # 测试数据
    dropped_blocks = [
        {"id": "I-block", "x": 1, "y": 2}
    ]
    
    # 获取标准棋盘
    board_data = get_board_with_date(day=15, month=12)
    
    # 计算剩余方块
    placed_block_ids = {block['id'] for block in dropped_blocks}
    remaining_block_types = [block_type for block_type in INITIAL_BLOCK_TYPES 
                           if block_type['id'] not in placed_block_ids]
    
    # 生成游戏ID
    id_generator = GameIDGeneratorV3()
    board_data, game_id = id_generator.generate_game_id(
        dropped_blocks, remaining_block_types, board_data
    )
    
    # 构造新的游戏状态格式
    game_state = {
        'boardData': board_data,
        'boardLayout': [''.join(map(str, row)) for row in board_data],
        'dimensions': {'rows': len(board_data), 'cols': len(board_data[0])},
        'droppedBlocks': dropped_blocks,
        'remainingBlockTypes': remaining_block_types,
        'gameId': game_id
    }
    
    # 构造解决方案格式
    solution_state = {
        'boardData': board_data,
        'boardLayout': [''.join(map(str, row)) for row in board_data],
        'dimensions': {'rows': len(board_data), 'cols': len(board_data[0])},
        'droppedBlocks': dropped_blocks + [
            {"id": "L-block", "x": 3, "y": 0, "shape": [[1, 1], [1, 0]]}
        ],
        'remainingBlockTypes': [],  # 解决后为空
        'solveTime': 1.234,
        'gameId': game_id
    }
    
    # 保存测试文件
    temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    
    # 保存input.json
    input_file = os.path.join(temp_dir, f'{game_id}_input.json')
    with open(input_file, 'w') as f:
        json.dump(game_state, f, indent=2)
    
    # 保存output.json
    output_file = os.path.join(temp_dir, f'{game_id}_output.json')
    with open(output_file, 'w') as f:
        json.dump(solution_state, f, indent=2)
    
    print(f"测试文件已保存：")
    print(f"Input: {input_file}")
    print(f"Output: {output_file}")
    
    # 验证格式
    print("\n验证格式一致性：")
    print(f"Input keys: {list(game_state.keys())}")
    print(f"Output keys: {list(solution_state.keys())}")
    
    # 检查关键字段
    required_keys = {'boardData', 'boardLayout', 'dimensions', 'droppedBlocks', 'remainingBlockTypes'}
    assert required_keys.issubset(set(game_state.keys())), "Input格式不完整"
    assert required_keys.issubset(set(solution_state.keys())), "Output格式不完整"
    assert solution_state['remainingBlockTypes'] == [], "Output应该剩余块为空"
    
    print("✅ 格式验证通过")

if __name__ == '__main__':
    test_new_format()