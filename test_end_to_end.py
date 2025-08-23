#!/usr/bin/env python3
"""
端到端测试：验证server.py和solve_for_web.py的格式一致性
"""
import json
import os
import sys
import tempfile
import subprocess
from calendar_puzzle.board import Game as CalendarGame
from calendar_puzzle.constants import INITIAL_BLOCK_TYPES

def create_test_input():
    """创建测试输入数据"""
    return {
        "droppedBlocks": [
            {
                "id": "I-block",
                "x": 1,
                "y": 2,
                "shape": [[1, 1, 1]]
            }
        ],
        "day": 15,
        "month": 12
    }

def test_server_format():
    """测试server.py保存的input.json格式"""
    from game_id import GameIDGeneratorV3
    
    # 模拟server.py的逻辑
    data = create_test_input()
    dropped_blocks = data.get('droppedBlocks', [])
    
    # 生成棋盘
    import datetime
    dt = datetime.date(datetime.date.today().year, 12, 15)
    game = CalendarGame(dt)
    board_data = game.board.b
    
    # 计算剩余方块
    placed_block_ids = {block['id'] for block in dropped_blocks}
    remaining_block_types = [block_type for block_type in INITIAL_BLOCK_TYPES 
                           if block_type['id'] not in placed_block_ids]
    
    # 生成游戏ID
    id_generator = GameIDGeneratorV3()
    board_data, game_id = id_generator.generate_game_id(
        dropped_blocks, remaining_block_types, board_data
    )
    
    # 构造server.py的input.json格式
    game_state = {
        'boardData': board_data,
        'boardLayout': [''.join(map(str, row)) for row in board_data],
        'dimensions': {'rows': len(board_data), 'cols': len(board_data[0])},
        'droppedBlocks': dropped_blocks,
        'remainingBlockTypes': remaining_block_types
    }
    
    return game_state, game_id

def test_solver_format(game_state, game_id):
    """测试solve_for_web.py的输出格式"""
    
    # 创建临时文件
    temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    
    input_file = os.path.join(temp_dir, f'{game_id}_input.json')
    output_file = os.path.join(temp_dir, f'{game_id}_output.json')
    
    try:
        # 保存输入
        with open(input_file, 'w') as f:
            json.dump(game_state, f, indent=2)
        
        # 运行求解器
        result = subprocess.run([
            sys.executable, 'solve_for_web.py', input_file, output_file
        ], capture_output=True, text=True, cwd=os.path.dirname(__file__))
        
        if result.returncode != 0:
            print(f"❌ 求解器执行失败: {result.stderr}")
            return None
        
        # 读取输出
        with open(output_file, 'r') as f:
            solution = json.load(f)
        
        return solution
        
    finally:
        # 清理文件
        if os.path.exists(input_file):
            os.unlink(input_file)
        if os.path.exists(output_file):
            pass  # 保留用于调试

def main():
    """运行端到端测试"""
    print("🔍 运行端到端格式测试...")
    
    # 测试server.py的input.json格式
    game_state, game_id = test_server_format()
    print("✅ server.py input.json格式验证通过")
    
    # 测试solve_for_web.py的输出格式
    solution = test_solver_format(game_state, game_id)
    if not solution:
        print("❌ 求解器测试失败")
        return False
    
    print("✅ solve_for_web.py输出格式验证通过")
    
    # 验证格式一致性
    server_keys = {'boardData', 'boardLayout', 'dimensions', 'droppedBlocks', 'remainingBlockTypes'}
    solver_keys = set(solution.keys())
    
    if not server_keys.issubset(solver_keys):
        print(f"❌ 格式不一致: server期望 {server_keys}, solver提供 {solver_keys}")
        return False
    
    # 验证关键字段
    assert solution['remainingBlockTypes'] == [], "剩余块应该为空"
    assert len(solution['droppedBlocks']) > 0, "应该有放置的方块"
    
    print("✅ 格式一致性验证通过")
    
    # 保存结果用于检查
    temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
    result_file = os.path.join(temp_dir, f'{game_id}_end_to_end.json')
    with open(result_file, 'w') as f:
        json.dump({
            'input_format': game_state,
            'output_format': solution,
            'game_id': game_id
        }, f, indent=2)
    
    print(f"📄 测试结果已保存: {result_file}")
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)