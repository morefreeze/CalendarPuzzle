#!/usr/bin/env python3
"""
Calendar Puzzle Game ID Generator V3
Ultra-compact 54-base encoding for game state serialization

Features:
- 54-base encoding (0-9, A-Z, a-z, *, #)
- 49-bit uncoverable cells mask
- 10-bit remaining block types mask  
- 10 bits per placed block (4b type + 3b x + 3b y)
- Supports up to 10 blocks total
- Round-trip encoding/decoding

Usage:
    python3 game_id.py              # Run all tests
    python3 game_id.py --quick      # Quick single test
    python3 game_id.py --perf        # Performance benchmark
"""

import sys
import time
import calendar_puzzle.board as board_module  # 添加Board模块引用
from typing import List, Dict
from calendar_puzzle.constants import INITIAL_BLOCK_TYPES, BOARD_WIDTH, BOARD_HEIGHT

# 使用统一常量
DEFAULT_BLOCK_TYPES = INITIAL_BLOCK_TYPES
DEFAULT_BOARD_WIDTH = BOARD_WIDTH
DEFAULT_BOARD_HEIGHT = BOARD_HEIGHT

# Constants
BASE54_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz*#"


class GameIDGeneratorV3:
    """Game state serialization with ultra-compact encoding"""
    
    @staticmethod
    def _encode_base54(n: int) -> str:
        """Encode integer to base54 string"""
        if n == 0:
            return BASE54_CHARS[0]
        
        result = []
        while n > 0:
            result.append(BASE54_CHARS[n % 54])
            n //= 54
        
        return ''.join(reversed(result))
    
    @staticmethod
    def _decode_base54(s: str) -> int:
        """Decode base54 string to integer"""
        result = 0
        for char in s:
            value = BASE54_CHARS.index(char)
            result = result * 54 + value
        return result
    
    @staticmethod
    def _pack_game_state(board_layout: List[List[str]], 
                        dropped_blocks: List[Dict], 
                        remaining_types: List[Dict]) -> int:
        """Pack game state directly from Board.b format"""
        result = 0
        
        # Build uncoverable mask directly from Board.b
        uncoverable_mask = 0
        for row in range(DEFAULT_BOARD_HEIGHT):
            for col in range(DEFAULT_BOARD_WIDTH):
                if board_layout[row][col] == '#':
                    uncoverable_mask |= 1 << (row * DEFAULT_BOARD_WIDTH + col)
        
        # Build remaining types mask (10 bits)
        remaining_mask = 0
        all_block_ids = [block['id'] for block in DEFAULT_BLOCK_TYPES]
        remaining_ids = {block['id'] for block in remaining_types}
        
        for i, block_id in enumerate(all_block_ids):
            if block_id in remaining_ids:
                remaining_mask |= 1 << i
        
        # Start with uncoverable mask
        result = uncoverable_mask
        
        # Add remaining types (shifted left by 49)
        result = (result << 10) | remaining_mask
        
        # Add blocks (each 10 bits: 4b type + 3b x + 3b y)
        for block in reversed(dropped_blocks):  # Reverse to pack LSB-first
            try:
                type_idx = next(i for i, b in enumerate(DEFAULT_BLOCK_TYPES) 
                              if b['id'] == block['id'])
            except StopIteration:
                continue
                
            x, y = block['x'], block['y']
            if not (0 <= x < 8 and 0 <= y < 8):  # 3 bits each
                continue
                
            block_data = (type_idx << 6) | (x << 3) | y
            result = (result << 10) | block_data
        
        return result
    
    @staticmethod
    def _unpack_game_state(compact_data: int) -> tuple:
        """Unpack game state from single integer to Board.b format"""
        
        if compact_data == 0:
            # Return empty board in Board.b format
            board_state = [[' ' for _ in range(DEFAULT_BOARD_WIDTH)] 
                          for _ in range(DEFAULT_BOARD_HEIGHT)]
            return board_state, [], DEFAULT_BLOCK_TYPES
        
        temp_data = compact_data
        
        # Count blocks by bit length
        total_bits = compact_data.bit_length()
        block_bits = max(0, total_bits - 59)  # 49 + 10 = 59 header bits
        num_blocks = block_bits // 10
        
        # Extract blocks from LSB
        blocks = []
        for i in range(num_blocks):
            shift = i * 10
            if shift >= total_bits - 59:
                break
                
            block_data = (temp_data >> shift) & ((1 << 10) - 1)
            
            type_idx = (block_data >> 6) & 0xF
            x = (block_data >> 3) & 0x7
            y = block_data & 0x7
            
            if type_idx < len(DEFAULT_BLOCK_TYPES):
                block_info = DEFAULT_BLOCK_TYPES[type_idx]
                blocks.append({
                    'id': block_info['id'],
                    'x': x,
                    'y': y,
                    'shape': block_info['shape']
                })
        
        # Remove blocks from data
        temp_data >>= (num_blocks * 10)
        
        # Extract remaining types (10 bits)
        remaining_mask = temp_data & ((1 << 10) - 1)
        temp_data >>= 10
        
        # Extract uncoverable cells (remaining bits)
        uncoverable_mask = temp_data
        
        # Build board state in Board.b format
        board_state = [[' ' for _ in range(DEFAULT_BOARD_WIDTH)] 
                      for _ in range(DEFAULT_BOARD_HEIGHT)]
        
        # Mark uncoverable cells
        for row in range(DEFAULT_BOARD_HEIGHT):
            for col in range(DEFAULT_BOARD_WIDTH):
                if uncoverable_mask & (1 << (row * DEFAULT_BOARD_WIDTH + col)):
                    board_state[row][col] = '#'
        
        # Mark placed blocks
        for block in reversed(blocks):  # Reverse to maintain original order
            shape = block['shape']
            x, y = block['x'], block['y']
            
            for dy, row_data in enumerate(shape):
                for dx, cell in enumerate(row_data):
                    if cell == 1:
                        board_y = y + dy
                        board_x = x + dx
                        if 0 <= board_y < DEFAULT_BOARD_HEIGHT and 0 <= board_x < DEFAULT_BOARD_WIDTH:
                            board_state[board_y][board_x] = block['id'][0]
        
        # Build remaining types
        remaining_types = []
        for i in range(10):
            if remaining_mask & (1 << i):
                remaining_types.append(DEFAULT_BLOCK_TYPES[i])
        
        return board_state, list(reversed(blocks)), remaining_types
    
    @staticmethod
    def generate_game_id(dropped_blocks: List[Dict], 
                        remaining_types: List[Dict] = None,
                        board_layout: List[List[str]] = None) -> str:
        """Generate game ID from Board.b format"""
        
        if remaining_types is None:
            # Default: all blocks except dropped ones
            dropped_ids = {block['id'] for block in dropped_blocks}
            remaining_types = [block for block in DEFAULT_BLOCK_TYPES 
                             if block['id'] not in dropped_ids]
        
        if board_layout is None:
            # Default empty board
            board_layout = [[' ' for _ in range(DEFAULT_BOARD_WIDTH)] 
                           for _ in range(DEFAULT_BOARD_HEIGHT)]
        
        compact_data = GameIDGeneratorV3._pack_game_state(
            board_layout, dropped_blocks, remaining_types)
        
        return GameIDGeneratorV3._encode_base54(compact_data)
    
    @staticmethod
    def decode_game_id(game_id: str) -> tuple:
        """Decode game ID back to Board.b format"""
        compact_data = GameIDGeneratorV3._decode_base54(game_id)
        return GameIDGeneratorV3._unpack_game_state(compact_data)


def _create_test_board():
    """Create a test board with uncoverable cells"""
    board = [[' ' for _ in range(DEFAULT_BOARD_WIDTH)] 
             for _ in range(DEFAULT_BOARD_HEIGHT)]
    board[3][3] = '#'
    board[4][4] = '#'
    return board

def _run_basic_tests():
    """Run comprehensive tests"""
    print("🧪 Testing Game ID Generator V3...")
    
    # Test 1: Empty game
    empty_id = GameIDGeneratorV3.generate_game_id([])
    print(f"Empty game ID: {empty_id}")
    board_state, blocks, remaining_types = GameIDGeneratorV3.decode_game_id(empty_id)
    print(f"Decoded blocks: {len(blocks)}")
    assert len(blocks) == 0
    assert len(remaining_types) == 10
    print("✅ Empty game test passed")
    
    # Test 2: Single block
    single_block = [{'id': 'I', 'x': 0, 'y': 0}]
    single_id = GameIDGeneratorV3.generate_game_id(single_block)
    print(f"Single block ID: {single_id}")
    board_state, blocks, remaining_types = GameIDGeneratorV3.decode_game_id(single_id)
    print(f"Decoded blocks: {len(blocks)}")
    assert len(blocks) == 1
    assert blocks[0]['id'] == 'I'
    print("✅ Single block test passed")
    
    # Test 3: Multiple blocks
    multi_blocks = [
        {'id': 'I', 'x': 0, 'y': 0},
        {'id': 'L', 'x': 3, 'y': 1}
    ]
    multi_id = GameIDGeneratorV3.generate_game_id(multi_blocks)
    print(f"Multi-block ID: {multi_id}")
    board_state, blocks, remaining_types = GameIDGeneratorV3.decode_game_id(multi_id)
    print(f"Decoded blocks: {len(blocks)}")
    assert len(blocks) == 2
    print("✅ Multi-block test passed")
    
    # Test 4: With uncoverable cells
    board_layout = [[' ' for _ in range(DEFAULT_BOARD_WIDTH)] 
                   for _ in range(DEFAULT_BOARD_HEIGHT)]
    board_layout[3][3] = '#'
    board_layout[4][4] = '#'
    uncoverable_id = GameIDGeneratorV3.generate_game_id([], board_layout=board_layout)
    print(f"Uncoverable cells ID: {uncoverable_id}")
    board_state, blocks, remaining_types = GameIDGeneratorV3.decode_game_id(uncoverable_id)
    assert board_state[3][3] == '#'
    assert board_state[4][4] == '#'
    print("✅ Uncoverable cells test passed")
    
    # Test 5: Round-trip consistency
    test_cases = [
        [],
        [{'id': 'I', 'x': 1, 'y': 2}],
        [{'id': 'I', 'x': 0, 'y': 0}, {'id': 'L', 'x': 3, 'y': 1}],
    ]
    
    for i, blocks in enumerate(test_cases):
        original = GameIDGeneratorV3.generate_game_id(blocks)
        board_state, decoded_blocks, remaining_types = GameIDGeneratorV3.decode_game_id(original)
        reconstructed = GameIDGeneratorV3.generate_game_id(decoded_blocks)
        
        print(f"Round-trip {i+1}: {original} -> {reconstructed}")
        assert original == reconstructed
        print(f"✅ Round-trip {i+1} passed")
    
    print("🎉 All basic tests passed!")

def _run_performance_test():
    """Run performance benchmark"""
    print("\n⚡ Performance test...")
    
    test_blocks = [
        {'id': 'I', 'x': 0, 'y': 0},
        {'id': 'L', 'x': 1, 'y': 1},
        {'id': 'T', 'x': 2, 'y': 2},
        {'id': 'U', 'x': 3, 'y': 3},
    ]
    
    start = time.time()
    iterations = 1000
    
    for _ in range(iterations):
        game_id = GameIDGeneratorV3.generate_game_id(test_blocks)
        decoded = GameIDGeneratorV3.decode_game_id(game_id)
    
    elapsed = time.time() - start
    rate = iterations / elapsed
    
    print(f"Encoded/decoded {iterations} times in {elapsed:.3f}s")
    print(f"Rate: {rate:.0f} operations/second")
    print(f"Average ID length: {len(game_id)} chars")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "--quick":
            # Quick single test
            block = [{'id': 'I', 'x': 2, 'y': 3}]
            game_id = GameIDGeneratorV3.generate_game_id(block)
            decoded = GameIDGeneratorV3.decode_game_id(game_id)
            print(f"Quick test: {game_id} -> {len(decoded['dropped_blocks'])} blocks")
        elif sys.argv[1] == "--perf":
            _run_performance_test()
        elif sys.argv[1] == "--debug":
            # Debug mode - print board state
            import datetime
            
            # 创建测试场景
            test_blocks = [
                {'id': 'I', 'x': 1, 'y': 2, 'shape': [[1,1,1,1]]},
                {'id': 'L', 'x': 3, 'y': 0, 'shape': [[1,0], [1,0], [1,0], [1,1]]}
            ]
            
            # 使用CalendarGame生成带日期的棋盘
            game = board_module.Game(datetime.date.today())
            print("=== Debug Mode ===")
            print("Board state:")
            print(game.board)
            print()
            
            # 直接使用Board.b格式
            game_id = GameIDGeneratorV3.generate_game_id(test_blocks, board_layout=game.board.b)
            print(f"Generated Game ID: {game_id}")
            
            # 解码并显示
            board_state, blocks, remaining_types = GameIDGeneratorV3.decode_game_id(game_id)
            print(f"Decoded blocks count: {len(blocks)}")
            print(f"Remaining types: {[b['id'] for b in remaining_types]}")
        else:
            print("Usage: python3 game_id.py [--quick|--perf|--debug]")
    else:
        _run_basic_tests()