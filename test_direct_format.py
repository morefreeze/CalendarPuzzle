#!/usr/bin/env python3
"""Test direct Board.b format integration"""

import sys
sys.path.insert(0, '.')

from board import Board
from game_id import GameIDGeneratorV3
from constants import INITIAL_BLOCK_TYPES

def test_direct_format():
    """Test using Board.b directly without format conversion"""
    
    # Create a simple game state
    board = Board()
    
    # Place some blocks using Board's fit_put
    block1 = INITIAL_BLOCK_TYPES[0]  # L-block
    block2 = INITIAL_BLOCK_TYPES[1]  # T-block
    
    # Simulate placing blocks
    dropped_blocks = [
        {'id': block1['id'], 'x': 0, 'y': 0},
        {'id': block2['id'], 'x': 3, 'y': 0}
    ]
    
    # Mark some uncoverable cells
    board.b[0][0] = '#'
    board.b[0][1] = '#'
    
    # Use from_board method
    game_id = GameIDGeneratorV3.from_board(
        board, 
        dropped_blocks, 
        [b for b in INITIAL_BLOCK_TYPES if b['id'] not in [block1['id'], block2['id']]]
    )
    
    print(f"Generated game ID: {game_id}")
    
    # Decode back
    decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
    
    print(f"Decoded board dimensions: {len(decoded_board)}x{len(decoded_board[0])}")
    print(f"Decoded blocks: {decoded_blocks}")
    print(f"Remaining types: {[b['id'] for b in decoded_remaining]}")
    
    # Verify board state matches
    print("\nOriginal board state:")
    for row in board.b:
        print(''.join(row))
    
    print("\nDecoded board state:")
    for row in decoded_board:
        print(''.join(row))
    
    return decoded_board == board.b

if __name__ == "__main__":
    success = test_direct_format()
    print(f"\nTest {'PASSED' if success else 'FAILED'}")