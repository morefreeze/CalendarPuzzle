#!/usr/bin/env python3
"""
Test suite for Calendar Puzzle Game ID Generator V3
Using pytest framework for comprehensive testing
"""

import pytest

from game_id import GameIDGeneratorV3
from calendar_puzzle.constants import INITIAL_BLOCK_TYPES, BOARD_WIDTH, BOARD_HEIGHT


class TestGameIDGeneratorV3:
    """Test cases for GameIDGeneratorV3"""
    
    def test_empty_game(self):
        """Test empty game state generation"""
        board_layout, game_id = GameIDGeneratorV3.generate_game_id([])
        
        # Should return valid board layout and game ID
        assert isinstance(board_layout, list)
        assert len(board_layout) == BOARD_HEIGHT
        assert len(board_layout[0]) == BOARD_WIDTH
        assert isinstance(game_id, str)
        assert len(game_id) > 0
        
        # Test decode round-trip
        decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
        assert isinstance(decoded_board, list)
        assert len(decoded_blocks) == 0
        assert len(decoded_remaining) == len(INITIAL_BLOCK_TYPES)
    
    def test_single_block(self):
        """Test single block placement"""
        blocks = [{'id': 'I-block', 'x': 0, 'y': 0}]
        board_layout, game_id = GameIDGeneratorV3.generate_game_id(blocks)
        
        assert isinstance(game_id, str)
        assert game_id != "0"  # Should not be zero for non-empty game
        
        # Test decode
        decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
        assert len(decoded_blocks) == 1
        assert decoded_blocks[0]['id'] == 'I-block'
        assert decoded_blocks[0]['x'] == 0
        assert decoded_blocks[0]['y'] == 0
    
    def test_multiple_blocks(self):
        """Test multiple block placement"""
        blocks = [
            {'id': 'I-block', 'x': 0, 'y': 0},
            {'id': 'L-block', 'x': 3, 'y': 1}
        ]
        board_layout, game_id = GameIDGeneratorV3.generate_game_id(blocks)
        
        assert isinstance(game_id, str)
        
        # Test decode
        decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
        assert len(decoded_blocks) == 2
        
        # Check block order and properties
        block_ids = [block['id'] for block in decoded_blocks]
        assert 'I-block' in block_ids
        assert 'L-block' in block_ids
    
    def test_with_uncoverable_cells(self):
        """Test game with uncoverable cells"""
        # Create board with uncoverable cells
        board_data = [[' ' for _ in range(BOARD_WIDTH)] for _ in range(BOARD_HEIGHT)]
        board_data[3][3] = '#'
        board_data[4][4] = '#'
        
        board_layout, game_id = GameIDGeneratorV3.generate_game_id([], board_data=board_data)
        
        assert isinstance(game_id, str)
        
        # Test decode
        decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
        assert decoded_board[3][3] == '#'
        assert decoded_board[4][4] == '#'
    
    def test_round_trip_consistency(self):
        """Test encode/decode consistency"""
        test_cases = [
            [],  # Empty
            [{'id': 'I-block', 'x': 1, 'y': 2}],  # Single block
            [{'id': 'I-block', 'x': 0, 'y': 0}, {'id': 'L-block', 'x': 3, 'y': 1}],  # Multiple
            [  # Complex case
                {'id': 'I-block', 'x': 2, 'y': 1},
                {'id': 'T-block', 'x': 4, 'y': 2},
                {'id': 'U-block', 'x': 1, 'y': 4}
            ]
        ]
        
        for blocks in test_cases:
            # Generate game ID
            board_layout, original_id = GameIDGeneratorV3.generate_game_id(blocks)
            
            # Decode and re-encode should be consistent
            decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(original_id)
            
            # Re-encode the decoded state
            re_encoded_id = GameIDGeneratorV3.generate_game_id(decoded_blocks)[1]
            
            # The game IDs should be the same
            assert original_id == re_encoded_id, f"Round-trip failed for blocks: {blocks}"
    
    def test_consistency_repeated_generation(self):
        """Test that generating the same game state always produces the same ID"""
        blocks = [
            {'id': 'I-block', 'x': 1, 'y': 2},
            {'id': 'L-block', 'x': 3, 'y': 0}
        ]
        
        # Generate multiple times
        ids = [GameIDGeneratorV3.generate_game_id(blocks)[1] for _ in range(5)]
        
        # All should be identical
        assert all(id == ids[0] for id in ids)
    
    def test_base54_encoding(self):
        """Test base54 encoding/decoding"""
        test_values = [0, 1, 54, 100, 1000, 123456789, 2**32 - 1]
        
        for value in test_values:
            encoded = GameIDGeneratorV3._encode_base54(value)
            decoded = GameIDGeneratorV3._decode_base54(encoded)
            assert decoded == value, f"Failed for value {value}: {encoded} -> {decoded}"
    
    def test_edge_cases(self):
        """Test edge cases and boundary conditions"""
        # Maximum coordinates
        max_coord_blocks = [{'id': 'I-block', 'x': 7, 'y': 7}]
        board_layout, game_id = GameIDGeneratorV3.generate_game_id(max_coord_blocks)
        
        decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
        assert decoded_blocks[0]['x'] == 7
        assert decoded_blocks[0]['y'] == 7
        
        # Minimum coordinates
        min_coord_blocks = [{'id': 'I-block', 'x': 0, 'y': 0}]
        board_layout, game_id = GameIDGeneratorV3.generate_game_id(min_coord_blocks)
        
        decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
        assert decoded_blocks[0]['x'] == 0
        assert decoded_blocks[0]['y'] == 0
    
    def test_invalid_block_handling(self):
        """Test handling of invalid block data"""
        # This should not crash, though behavior might be undefined
        # We're testing that the system is robust
        try:
            GameIDGeneratorV3.generate_game_id([{'id': 'invalid-block', 'x': 0, 'y': 0}])
        except Exception as e:
            # Should handle gracefully, not crash
            assert isinstance(e, (ValueError, KeyError, StopIteration))
    
    def test_remaining_types_calculation(self):
        """Test automatic calculation of remaining block types"""
        blocks = [{'id': 'I-block', 'x': 0, 'y': 0}]
        
        # When remaining_types is None, it should be calculated
        board_layout, game_id = GameIDGeneratorV3.generate_game_id(blocks)
        
        decoded_board, decoded_blocks, decoded_remaining = GameIDGeneratorV3.decode_game_id(game_id)
        
        # Should not contain the placed block
        remaining_ids = [block['id'] for block in decoded_remaining]
        assert 'I-block' not in remaining_ids
        
        # Should contain all other blocks
        original_ids = [block['id'] for block in INITIAL_BLOCK_TYPES]
        assert len(remaining_ids) == len(original_ids) - 1


class TestPerformance:
    """Performance tests for GameIDGeneratorV3"""
    
    def test_performance_benchmark(self):
        """Benchmark encode/decode performance"""
        import time
        
        test_blocks = [
            {'id': 'I-block', 'x': 0, 'y': 0},
            {'id': 'L-block', 'x': 1, 'y': 1},
            {'id': 'T-block', 'x': 2, 'y': 2},
            {'id': 'U-block', 'x': 3, 'y': 3},
        ]
        
        iterations = 1000
        
        # Test encoding performance
        start = time.time()
        for _ in range(iterations):
            GameIDGeneratorV3.generate_game_id(test_blocks)
        encode_time = time.time() - start
        
        # Test decoding performance
        _, test_id = GameIDGeneratorV3.generate_game_id(test_blocks)
        start = time.time()
        for _ in range(iterations):
            GameIDGeneratorV3.decode_game_id(test_id)
        decode_time = time.time() - start
        
        # Assert reasonable performance (adjust thresholds as needed)
        assert encode_time < 1.0  # Should encode 1000 games in under 1 second
        assert decode_time < 1.0  # Should decode 1000 games in under 1 second
        
        print(f"Encoding: {iterations/encode_time:.0f} ops/sec")
        print(f"Decoding: {iterations/decode_time:.0f} ops/sec")


if __name__ == "__main__":
    # Run tests when script is executed directly
    pytest.main([__file__, "-v"])