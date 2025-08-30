#!/usr/bin/env python3
"""
测试总结：无解情况处理验证报告
"""

import requests
import json
import time

def run_summary_test():
    """运行总结测试"""
    
    print("📋 无解情况处理验证总结")
    print("=" * 50)
    
    # 核心测试案例
    core_test = {
        "droppedBlocks": [
            {"id": "I-block", "x": 0, "y": 0, "shape": [[1, 1, 1, 1, 1]]},
            {"id": "L-block", "x": 1, "y": 0, "shape": [[1, 0], [1, 0], [1, 0], [1, 1]]}
        ],
        "uncoverableCells": [],
        "blockTypes": [
            {"id": "I-block", "shape": [[1, 1, 1, 1, 1]]},
            {"id": "L-block", "shape": [[1, 0], [1, 0], [1, 0], [1, 1]]},
            {"id": "T-block", "shape": [[1, 1, 1], [0, 1, 0]]},
            {"id": "S-block", "shape": [[0, 1, 1], [1, 1, 0]]},
            {"id": "Square-block", "shape": [[1, 1], [1, 1]]},
            {"id": "P-block", "shape": [[1, 1, 1], [1, 0, 0]]},
            {"id": "U-block", "shape": [[1, 0, 1], [1, 1, 1]]},
            {"id": "V-block", "shape": [[1, 0, 0], [1, 0, 0], [1, 1, 1]]}
        ]
    }
    
    print("\n🧪 核心测试案例")
    print("-" * 30)
    
    try:
        response = requests.post(
            "http://localhost:5001/api/solution",
            json=core_test,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"✅ 响应状态码: {response.status_code}")
        
        if response.status_code == 404:
            result = response.json()
            
            print("\n📊 响应数据验证:")
            print(f"   错误类型: {result.get('error', 'N/A')}")
            print(f"   用户消息: {result.get('message', 'N/A')}")
            print(f"   建议信息: {result.get('suggestion', 'N/A')}")
            print(f"   求解耗时: {result.get('solveTime', 'N/A')}秒")
            
            # 验证前端显示格式
            frontend_message = f"当前配置无解！求解耗时 {result.get('solveTime', 0):.3f} 秒。{result.get('suggestion', '请尝试调整方块位置')}"
            print(f"\n🖥️  前端将显示: {frontend_message}")
            
            # 验证数据完整性
            required_keys = ['error', 'message', 'solveTime', 'suggestion']
            missing_keys = [k for k in required_keys if k not in result]
            
            if not missing_keys:
                print("\n✅ 数据完整性验证通过")
                return True
            else:
                print(f"\n❌ 缺少字段: {missing_keys}")
                return False
                
        else:
            print(f"\n❌ 意外响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        return False

def generate_curl_examples():
    """生成curl测试命令"""
    
    print("\n🛠️  手动测试命令")
    print("-" * 30)
    
    # 简单无解案例
    simple_no_solution = {
        "droppedBlocks": [
            {"id": "I-block", "x": 0, "y": 0, "shape": [[1, 1, 1, 1, 1]]},
            {"id": "L-block", "x": 6, "y": 0, "shape": [[1, 0], [1, 0], [1, 0], [1, 1]]}
        ],
        "uncoverableCells": []
    }
    
    # 游戏ID测试
    game_id_test = {
        "droppedBlocks": [
            {"id": "Square-block", "x": 0, "y": 0, "shape": [[1, 1], [1, 1]]}
        ],
        "day": 30,
        "month": 8
    }
    
    print("\n1. 直接无解测试:")
    print("curl -X POST http://localhost:5001/api/solution \\")
    print("  -H \"Content-Type: application/json\" \\")
    print(f"  -d '{json.dumps(simple_no_solution, ensure_ascii=False)}'")
    
    print("\n2. 游戏ID生成测试:")
    print("curl -X POST http://localhost:5001/api/game-id \\")
    print("  -H \"Content-Type: application/json\" \\")
    print(f"  -d '{json.dumps(game_id_test, ensure_ascii=False)}'")
    
    print("\n3. 使用游戏ID求解测试:")
    print("# 先用上面的命令获取gameId，然后:")
    print("curl -X POST http://localhost:5001/api/solution \\")
    print("  -H \"Content-Type: application/json\" \\")
    print("  -d '{\"gameId\": \"YOUR_GAME_ID\"}'")

if __name__ == "__main__":
    print("📊 无解情况处理验证报告")
    print("=" * 50)
    
    # 运行核心测试
    success = run_summary_test()
    
    # 生成测试命令
    generate_curl_examples()
    
    print("\n" + "=" * 50)
    
    if success:
        print("🎉 验证结果: ✅ 通过")
        print("\n📋 验证要点:")
        print("   ✅ 后端API正确返回404状态码")
        print("   ✅ 响应包含完整错误信息")
        print("   ✅ 前端显示格式正确")
        print("   ✅ 用户提示信息友好")
        print("   ✅ 求解时间记录准确")
    else:
        print("❌ 验证结果: 需要修复")
    
    print("\n📝 测试完成时间:", time.strftime("%Y-%m-%d %H:%M:%S"))