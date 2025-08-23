#!/usr/bin/env python3
"""
测试solve_for_web.py的新输出格式是否正确
"""
import json
import os
import sys
import tempfile
from solve_for_web import main

def test_solver_format():
    """测试求解器的输出格式"""
    
    # 创建测试输入文件
    test_input = {
        "droppedBlocks": [
            {
                "id": "I-block",
                "x": 1,
                "y": 2,
                "shape": [[1, 1, 1]]
            }
        ],
        "remainingBlockTypes": [
            {
                "id": "L-block",
                "label": "L",
                "color": "#FFA500",
                "shape": [[1, 0], [1, 0], [1, 1]]
            }
        ]
    }
    
    # 创建临时文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_input:
        json.dump(test_input, temp_input)
        input_file = temp_input.name
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_output:
        output_file = temp_output.name
    
    try:
        # 运行求解器
        main(input_file, output_file)
        
        # 读取输出
        with open(output_file, 'r') as f:
            solution = json.load(f)
        
        print("求解器输出格式验证：")
        print(f"输出文件: {output_file}")
        print(f"输出键: {list(solution.keys())}")
        
        # 验证必需字段
        required_fields = {'boardData', 'boardLayout', 'dimensions', 'droppedBlocks', 'remainingBlockTypes'}
        if not required_fields.issubset(set(solution.keys())):
            print("❌ 缺少必需字段")
            return False
        
        # 验证数据类型
        assert isinstance(solution['boardData'], list), "boardData应该是列表"
        assert isinstance(solution['boardLayout'], list), "boardLayout应该是列表"
        assert isinstance(solution['dimensions'], dict), "dimensions应该是字典"
        assert isinstance(solution['droppedBlocks'], list), "droppedBlocks应该是列表"
        assert isinstance(solution['remainingBlockTypes'], list), "remainingBlockTypes应该是列表"
        assert solution['remainingBlockTypes'] == [], "剩余块应该为空数组"
        
        # 验证数据一致性
        board_rows = len(solution['boardData'])
        board_cols = len(solution['boardData'][0]) if board_rows > 0 else 0
        assert solution['dimensions']['rows'] == board_rows, "dimensions.rows不匹配"
        assert solution['dimensions']['cols'] == board_cols, "dimensions.cols不匹配"
        assert len(solution['boardLayout']) == board_rows, "boardLayout行数不匹配"
        
        print("✅ 格式验证通过")
        print(f"棋盘尺寸: {board_rows}x{board_cols}")
        print(f"放置方块数: {len(solution['droppedBlocks'])}")
        
        # 打印示例数据
        print("\n示例数据:")
        print(f"boardData[0]: {solution['boardData'][0][:5]}...")
        print(f"boardLayout[0]: {solution['boardLayout'][0]}")
        print(f"dimensions: {solution['dimensions']}")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False
    finally:
        # 清理临时文件
        if os.path.exists(input_file):
            os.unlink(input_file)
        if os.path.exists(output_file):
            os.unlink(output_file)

if __name__ == '__main__':
    test_solver_format()