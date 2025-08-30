# generate each shape which put in a board, present it as a row of dancing link
# convert matrix to an array and use it as a row of dancing link
import datetime
import copy
from itertools import zip_longest
from typing import Tuple
from calendar_puzzle.board import BOARD_BLOCK, DATE_BLOCK, Board, Game, COLOR_MAP
from calendar_puzzle.dancing_link.dl import Dlx, Node
from calendar_puzzle.shape import Shape
from colorama import Fore


class FasterGame(Game):
    # if build_shape again
    _modified = False
    def __init__(self, dt=None) -> None:
        if dt is None:
            dt = datetime.date.today()
        super().__init__(dt)
        self.build_shape()
    
    def build_shape(self):
        mx, row_names = [], ['head']
        for row, row_name in self.gen_shape_in_board():
            mx.append(row)
            row_names.append(row_name)
        self.dlx = Dlx(mx, row_names)
        self.modified = False
    
    def fit_put(self, x, y: int, shape: Shape) -> Tuple[bool, list[list]]:
        """
        Check if a shape can fit at position (x, y) and return the updated board.
        This method handles the dancing link constraints by ensuring:
        1. The shape fits within board boundaries
        2. The shape doesn't overlap with existing blocks or marked cells
        3. The shape only covers empty cells and doesn't conflict with other shapes
        """
        if len(shape.grid) == 0:
            return True, self.board.b
        
        n, m = len(shape.grid), len(shape.grid[0])
        new_b = copy.deepcopy(self.board.b)
        succ = True
        
        # Check if shape can fit at position (x, y)
        for i in range(n):
            for j in range(m):
                if shape.grid[i][j] == ' ':
                    continue
                
                # Check boundaries
                if not (0 <= x+i < self.n and 0 <= y+j < self.m):
                    succ = False
                    break
                
                # Check if the cell is available for placement
                cell_content = new_b[x+i][y+j]
                if cell_content == ' ':
                    # Empty cell, can place shape
                    new_b[x+i][y+j] = shape.name
                elif cell_content == shape.name:
                    # Already occupied by the same shape, this is valid
                    continue
                elif cell_content in [DATE_BLOCK, BOARD_BLOCK]:
                    # Marked cells (date/weekday) cannot be covered
                    succ = False
                    break
                else:
                    # Cell occupied by another shape, conflict
                    succ = False
                    break
            
            if not succ:
                break
        
        self._modified = self._modified or succ
        return succ, new_b
        
    def gen_shape_in_board(self):
        shape_n = len(self.board.remaining_shapes)
        row_visit = set()
        nn = len(self.board.remaining_shapes)
        for i in range(self.n):
            for j in range(self.m):
                if self.board.b[i][j] == ' ':
                    nn += 1
        for i in range(self.n):
            for j in range(self.m):
                for k, shape in enumerate(self.board.remaining_shapes):
                    for ss in shape.all_shapes():
                        succ, new_b = self.fit_put(i, j, ss)
                        if succ:
                            row_int = board_k2int(new_b, k, ss, shape_n)
                            if row_int not in row_visit:
                                row_visit.add(row_int)
                                row_arr = fill_up_lead_zeros(int2arr(row_int), nn)
                                row_name = '\n'.join([''.join(row) for row in new_b])
                                yield row_arr, row_name

    def solve(self, find_one_exit=True):
        if self._modified:
            self.build_shape()
        for solution in self.dlx.search():
            b_str = []
            for step in solution:
                new_b_str = self.dlx.row_names[step.coordinate[0]]
                if len(b_str) == 0:
                    b_str = list(new_b_str)
                    continue
                assert(len(b_str) == len(new_b_str))
                for i in range(len(b_str)):
                    if b_str[i] != new_b_str[i] and b_str[i] == ' ':
                        b_str[i] = new_b_str[i]
            colored_output = []
            self.board.b = board_str2b(b_str)
            for char in b_str:
                color = COLOR_MAP.get(char, Fore.WHITE)
                colored_output.append(f"{color}{char}{Fore.RESET}")
            print(''.join(colored_output))
            if find_one_exit:
                return True
        return False
    

int2board: dict[int, list[list]] = dict()
def board_k2int(b: list[list], k: int, ss: Shape, n: int) -> int:
    # convert board matrix to an array and concat k to it
    # to form a row of dancing link
    result = 1 << k
    p = 1 << n
    for i in range(len(b)):
        for j in range(len(b[i])):
            if b[i][j] not in (ss.name, ' '):
                # either empty(except marked) grid and shape can be treated as row
                continue
            if b[i][j] == ss.name:
                result |= p
            p <<= 1
    int2board[result] = b.copy()
    return result

def node2board(node: Node) -> list[list]:
    result = 1 << (node.coordinate[1]-1)
    head = node
    node = head.right
    while node != head:
        result |= 1 << (node.coordinate[1] - 1)
        node = node.right
    return int2board[result]

def int2arr(k:int) -> list[int]:
    return [int(c) for c in bin(k)[2:]]

def fill_up_lead_zeros(arr: list, nn: int) -> list:
    if nn - len(arr) <= 0:
        return arr
    return [0]*(nn-len(arr)) + arr


def board_str2b(b_str: str) -> list[list]:
    """将扁平化的棋盘字符串转换为二维棋盘列表
    
    Args:
        b_str: 扁平化的棋盘字符串，例如 "       \n       \n..."
        
    Returns:
        8x7的二维棋盘列表
    """
    lines = ''.join(b_str).split('\n')
    return [list(line) for line in lines]