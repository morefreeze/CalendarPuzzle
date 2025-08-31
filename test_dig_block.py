#!/usr/bin/env python3
"""
简化测试框架：每个测试用例只验证输入输出
"""

from math import exp
import unittest
import sys
import os
import random

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dig_block import dig, dig_floor

class TestDigBlockSimple(unittest.TestCase):
    
    def test_dig_basic(self):
        """测试dig函数基本功能"""
        board = [
            "UUUUUUU\n",
            "VVVVVVV\n",
            "IIIIIII\n",
            "LLLLLLL\n",
            "JJJJJJJ\n",
            "QQQQQQQ\n",
            "SSSSSSS\n",
            "NNNNNNN\n"
        ]
        
        random.seed(42)  # 固定种子
        result_board, dig_lets = dig(board.copy(), 2)
        expected_board = [
            "@@@@@@@\n",
            "@@@@@@@\n",
            "IIIIIII\n",
            "LLLLLLL\n",
            "JJJJJJJ\n",
            "QQQQQQQ\n",
            "SSSSSSS\n",
            "NNNNNNN\n"
        ]
        
        # 直接断言要移除的字母数量
        self.assertEqual(dig_lets, 'VU')
        self.assertEqual(result_board, expected_board)
    
    def test_dig_zero(self):
        """测试dig_num=0时不变"""
        board = [
            "UVILJS\n",
            "TQZUNV\n",
            "IJSLQT\n",
            "ZUNVIS\n",
            "LQTZUN\n",
            "VISLQT\n",
            "ZUNVIS\n",
            "LQTZUN\n"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig(board.copy(), 0)
        
        self.assertEqual(dig_lets, '')
        self.assertEqual(result_board, board)
    
    def test_dig_all_letters(self):
        """测试dig移除所有字母"""
        board = [
            "UVIJLZ\n",
            "TQSNQU\n",
            "VILJZT\n",
            "QSNUVI\n",
            "LJZQTN\n",
            "SUVILJ\n",
            "ZTQSNU\n",
            "VILJZT\n"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig(board.copy(), 99)
        expected_board = [
            "@@@@@@\n",
            "@@@@@@\n",
            "@@@@@@\n",
            "@@@@@@\n",
            "@@@@@@\n",
            "@@@@@@\n",
            "@@@@@@\n",
            "@@@@@@\n",
        ]
        
        self.assertEqual(dig_lets, 'VUJZSQTILN')
        self.assertEqual(result_board, expected_board)

    def test_dig_floor_basic(self):
        """测试dig_floor函数基本功能"""
        board = [
            "UUU\n",
            "VVV\n",
            "III\n",
        ]
        
        random.seed(42)
        result, dig_lets = dig_floor(board.copy(), 2)
        expected_board = [
            'UUU\n',
            '@@@\n',
            '@@@\n',
        ]
        
        # 断言：应该移除2个字母的所有实例
        self.assertEqual(dig_lets, 'IV')
        self.assertEqual(result, expected_board)
    
    def test_dig_floor_zero(self):
        """测试dig_floor dig_num=0时不变"""
        board = [
            "UVI\n",
            "LJS"
        ]
        
        random.seed(42)
        result, dig_lets = dig_floor(board.copy(), 0)
        
        self.assertEqual(dig_lets, '')
        self.assertEqual(result, board)
    
    def test_dig_floor_single_letter(self):
        """测试dig_floor单字母情况"""
        board = [
            "UUU\n",
            "UUU",
        ]
        
        random.seed(42)
        result, dig_lets = dig_floor(board.copy(), 1)
        expected_board = [
            '@@@\n',
            '@@@',
        ]
        
        # 断言：单个字母的所有实例被移除
        self.assertEqual(dig_lets, 'U')
        self.assertEqual(result, expected_board)
    
    def test_dig_floor_no_letters(self):
        """测试dig_floor无字母情况"""
        board = ["###\n", "###"]
        
        random.seed(42)
        result, dig_lets = dig_floor(board.copy(), 3)
        
        self.assertEqual(dig_lets, '')
        self.assertEqual(result, board)

    def test_real_board_layout_dig_num_1(self):
        """测试真实棋盘布局dig_num=1"""
        board = [
            "LIIIIJ#\n",
            "L*TTTJ#\n",
            "LZZTJJQ\n",
            "LLZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV"
        ]
        expected = [
            "LIIIIJ#\n",
            "L*TTTJ#\n",
            "LZZTJJQ\n",
            "LLZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NN@\n",
            "UUSS*N@\n",
            "####@@@"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig(board.copy(), 1)
        
        # 直接断言棋盘和要移除的字母
        self.assertEqual(dig_lets, 'V')
        self.assertEqual(result_board, expected)

    def test_real_board_layout_dig_num_3(self):
        """测试真实棋盘布局dig_num=3"""
        board = [
            "LIIIIJ#\n",
            "L*TTTJ#\n",
            "LZZTJJQ\n",
            "LLZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig(board.copy(), 3)

        expected = [
            "LIIII@#\n",
            "L*TTT@#\n",
            "LZZT@@Q\n",
            "LLZTNQQ\n",
            "@@ZZNQQ\n",
            "@SS*NN@\n",
            "@@SS*N@\n",
            "####@@@"
        ]
        
        self.assertEqual(dig_lets, 'VUJ')
        self.assertEqual(result_board, expected)

    def test_real_board_layout_dig_num_5(self):
        """测试真实棋盘布局dig_num=5"""
        board = [
            "LIIIIJ#\n",
            "L*TTTJ#\n",
            "LZZTJJQ\n",
            "LLZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig(board.copy(), 5)
        expected = [
            "LIIII@#\n",
            "L*TTT@#\n",
            "L@@T@@Q\n",
            "LL@TNQQ\n",
            "@@@@NQQ\n",
            "@@@*NN@\n",
            "@@@@*N@\n",
            "####@@@"
        ]
        
        self.assertEqual(dig_lets, 'VUJZS')
        self.assertEqual(result_board, expected)

    def test_real_board_layout_dig_floor_num_2(self):
        """测试真实棋盘布局dig_floor_num=2"""
        board = [
            "LIIIIJ#\n",
            "L*TTTJ#\n",
            "LZZTJJQ\n",
            "LLZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV\n"
        ]
        expected = [
            "@@@@@J#\n",
            "@*TTTJ#\n",
            "@ZZTJJQ\n",
            "@@ZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV\n"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig_floor(board.copy(), 2)
        
        # 直接断言修改后的棋盘
        self.assertEqual(result_board, expected)
        self.assertEqual(dig_lets, 'IL')

    def test_real_board_layout_dig_floor_num_4(self):
        """测试真实棋盘布局dig_floor_num=4"""
        board = [
            "LIIIIJ#\n",
            "L*TTTJ#\n",
            "LZZTJJQ\n",
            "LLZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV\n"
        ]
        expected = [
            "@@@@@J#\n",
            "@*@@@J#\n",
            "@@@@JJQ\n",
            "@@@@NQQ\n",
            "UU@@NQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV\n"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig_floor(board.copy(), 4)
        
        # 直接断言修改后的棋盘和移除的字母
        self.assertEqual(result_board, expected)
        self.assertEqual(dig_lets, 'ILZT')

    def test_real_board_layout_dig_floor_num_6(self):
        """测试真实棋盘布局dig_floor_num=6"""
        board = [
            "LIIIIJ#\n",
            "L*TTTJ#\n",
            "LZZTJJQ\n",
            "LLZTNQQ\n",
            "UUZZNQQ\n",
            "USS*NNV\n",
            "UUSS*NV\n",
            "####VVV\n"
        ]
        expected = [
            "@@@@@@#\n",
            "@*@@@@#\n",
            "@@@@@@Q\n",
            "@@@@@QQ\n",
            "UU@@@QQ\n",
            "USS*@@V\n",
            "UUSS*@V\n",
            "####VVV\n"
        ]
        
        random.seed(42)
        result_board, dig_lets = dig_floor(board.copy(), 6)
        
        # 直接断言修改后的棋盘和移除的字母
        self.assertEqual(result_board, expected)
        self.assertEqual(dig_lets, 'ILZTJN')
    

if __name__ == '__main__':
    unittest.main(verbosity=2)