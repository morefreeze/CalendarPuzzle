#!/usr/bin/env python3
"""Test direct Board.b format integration"""

import sys
sys.path.insert(0, '.')

from board import Board
from game_id import GameIDGeneratorV3
from constants import INITIAL_BLOCK_TYPES

def test_board_internal_construction():
    """Test that generate_game_id uses Board internally without API change"""
    
    # Test with legacy API (no Board parameter)
    dropped_blocks = [
        {'id': 'I', 'x': 0, 'y': 0},
        {'id': 'L', 'x': 3, 'y': 1}
    ]
    
    # Create custom board layout
    board_layout = [[' ' for _ in range(7)] for _ in range(7)]
    board_layout[0][0] = '#'
    board_layout[1][1] = '#'
    
    # Use legacy API - should internally construct Board
    game_id = GameIDGeneratorV3.generate_game_id(
        dropped_blocks,
        [b for b in INITIAL_BLOCK_TYPES if b['id'] not in ['I', 'L']],
        board_layout
    )
    
    print(f"Generated game ID: {game_id}")
    
    # Decode back
    decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
    
    print(f"Decoded board dimensions: {len(decoded_board)}x{len(decoded_board[0])}")
    print(f"Decoded blocks: {decoded_blocks}")
    print(f"Remaining types: {[b['id'] for b in decoded_remaining]}")
    
    # Verify board state matches
    print("\nOriginal board layout:")
    for row in board_layout:
        print(''.join(row))
    
    print("\nDecoded board state:")
    for row in decoded_board:
        print(''.join(row))
    
    return decoded_board == board_layout

if __name__ == "__main__":
    success = test_board_internal_construction()
    
    print(f"\nBoard internal construction test: {'PASSED' if success else 'FAILED'}")