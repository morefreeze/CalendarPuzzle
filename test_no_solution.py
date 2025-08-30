#!/usr/bin/env python3
"""
测试无解情况的处理
"""
import json
import os
import sys
import tempfile
from solve_for_web import main

def test_no_solution():
    """测试无解情况"""
    
    # 创建一个无解的游戏状态：所有方块都放置但无法完成
    test_input = {
        "droppedBlocks": [
            {
                "id": "I-block",
                "x": 0,
                "y": 0,
                "shape": [[1, 1, 1, 1, 1]]
            },
            {
                "id": "T-block", 
                "x": 1,
                "y": 1,
                "shape": [[1, 1, 1], [0, 1, 0]]
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
        
        print("无解测试：")
        print(f"输出文件: {output_file}")
        print(f"解决方案: {json.dumps(solution, indent=2)}")
        
        # 验证无解情况
        if len(solution['droppedBlocks']) == 0:
            print("✅ 无解情况正确处理 - 返回空解决方案")
            return True
        else:
            print("❌ 无解情况处理错误 - 不应返回解决方案")
            return False
            
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
    success = test_no_solution()
    sys.exit(0 if success else 1)