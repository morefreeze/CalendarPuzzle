import unittest
from typing import List
import sys
import os

# Get the directory of the current script
parent_parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(parent_parent_dir)
from calendar_puzzle.board import Board
from calendar_puzzle.dancing_link.calendar import board_k2int, int2arr
from calendar_puzzle.shape import Shape

class TestBoardK2Int(unittest.TestCase):
    def test_empty_board(self):
        shape = Shape('A')
        board = Board([
            [' ', ' ', ' '],
            [' ', ' ', ' '],
            [' ', ' ', ' ']
        ], [shape])
        result = board_k2int(board.b, 0, shape, 2)
        self.assertEqual(result, 1)

    def test_full_board(self):
        shape = Shape('A')
        board = Board([
            ['A', 'A', 'A'],
            ['A', 'A', 'A'],
            ['A', 'A', 'A']
        ], [shape])
        result = board_k2int(board.b, 0, shape, 8)
        arr = int2arr(result)
        self.assertEqual(arr, ([1]*9) + ([0])*7 + [1])
        self.assertEqual(result, 0b11111111100000001)

if __name__ == "__main__":
    unittest.main()
