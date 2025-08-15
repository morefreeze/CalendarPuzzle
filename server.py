from flask import Flask, request, jsonify
import json
import os
from solve_for_web import main

app = Flask(__name__)

@app.route('/api/solution', methods=['POST'])
def get_solution():
    try:
        # 获取前端发送的游戏状态
        data = request.json
        game_id = data.get('gameId')
        dropped_blocks = data.get('droppedBlocks', [])
        uncoverable_cells = data.get('uncoverableCells', [])

        # 将游戏状态保存到临时文件，以便Python求解器读取
        temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        temp_input = os.path.join(temp_dir, f'{game_id}_input.json')
        temp_output = os.path.join(temp_dir, f'{game_id}_output.json')

        with open(temp_input, 'w') as f:
            json.dump({
                'droppedBlocks': dropped_blocks,
                'uncoverableCells': uncoverable_cells
            }, f)

        # 直接调用求解函数
        try:
            main(temp_input, temp_output)
        except Exception as e:
            return jsonify({'error': f'求解器错误: {str(e)}'}), 500

        # 读取求解器输出的解决方案
        with open(temp_output, 'r') as f:
            solution = json.load(f)

        return jsonify(solution)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)