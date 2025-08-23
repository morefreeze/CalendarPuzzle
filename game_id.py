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
from typing import Tuple
from calendar_puzzle.board import Game, Board, SHAPE_MAP, build_mx
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
        
        data = compact_data
        
        # Extract blocks from LSB
        blocks = []
        
        # Calculate number of blocks (each 10 bits)
        max_blocks = 10
        num_blocks = 0
        
        # First, count how many blocks we have
        temp = data
        for i in range(max_blocks):
            block_data = temp & ((1 << 10) - 1)
            if block_data == 0 and i > 0:
                break
            num_blocks += 1
            temp >>= 10
        
        # Extract actual blocks
        for i in range(num_blocks):
            shift = i * 10
            block_data = (data >> shift) & ((1 << 10) - 1)
            
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
        
        # Remove block data to get to header
        header_data = data >> (num_blocks * 10)
        
        # Extract remaining types (lower 10 bits of header)
        remaining_mask = header_data & ((1 << 10) - 1)
        
        # Extract uncoverable cells (remaining bits)
        uncoverable_mask = header_data >> 10
        
        # Build board state in Board.b format
        board_state = [[' ' for _ in range(DEFAULT_BOARD_WIDTH)] 
                      for _ in range(DEFAULT_BOARD_HEIGHT)]
        
        # Mark uncoverable cells
        for row in range(DEFAULT_BOARD_HEIGHT):
            for col in range(DEFAULT_BOARD_WIDTH):
                if uncoverable_mask & (1 << (row * DEFAULT_BOARD_WIDTH + col)):
                    board_state[row][col] = '#'
        
        # Mark placed blocks (in original order)
        for block in blocks:
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
        
        return board_state, blocks, remaining_types
    
    @staticmethod
    def generate_game_id(dropped_blocks: List[Dict], 
                        remaining_types: List[Dict] = None,
                        board_data: List[List[str]] = None) -> Tuple[List[List[str]], str]:
        """Generate game ID from game state using Board instance internally
        Args:
        board_layout: 8x7 board layout, no block on the board, default is None
        return:
        board_layout: 8x7 board layout, with block on the board
        game_id: game id
        """
        
        # 构造Board实例作为唯一数据源
        n, m = DEFAULT_BOARD_HEIGHT, DEFAULT_BOARD_WIDTH
        if board_data is not None and len(board_data) > 0:
            n, m = len(board_data), len(board_data[0])
        
        if remaining_types is None:
            dropped_ids = {block['id'] for block in dropped_blocks}
            remaining_types = [block for block in DEFAULT_BLOCK_TYPES 
                             if block['id'] not in dropped_ids]
        
        remaining_shapes = [SHAPE_MAP[block['id']]() for block in remaining_types]
        board = Board(build_mx(n, m), remaining_shapes)
        # 如果提供了board_layout，同步到Board实例
        if board_data is not None:
            for y, row in enumerate(board_data):
                for x, cell in enumerate(row):
                    if y < len(board.b) and x < len(board.b[0]):
                        board.b[y][x] = cell
        
        game = Game()
        game.board = board
        for block in dropped_blocks:
            _, game.board.b = game.fit_put(block['x'], block['y'], SHAPE_MAP[block['id']]())
        
        # 使用 _pack_game_state 生成紧凑数据，然后编码为base54
        compact_data = GameIDGeneratorV3._pack_game_state(game.board.b, dropped_blocks, remaining_types)
        game_id = GameIDGeneratorV3._encode_base54(compact_data)
        
        return game.board.b, game_id
    
    @staticmethod
    def decode_game_id(game_id: str) -> tuple:
        """Decode game ID back to Board.b format"""
        compact_data = GameIDGeneratorV3._decode_base54(game_id)
        return GameIDGeneratorV3._unpack_game_state(compact_data)
