# generate each shape which put in a board, present it as a row of dancing link
# convert matrix to an array and use it as a row of dancing link
import datetime
from itertools import zip_longest
from calendar_puzzle.board import Board, Game, COLOR_MAP
from calendar_puzzle.dancing_link.dl import Dlx, Node
from calendar_puzzle.shape import Shape
from colorama import Fore


class FasterGame(Game):
    def __init__(self, dt=datetime.date.today()) -> None:
        super().__init__(dt)
        mx, row_names = [], ['head']
        for row, row_name in self.gen_shape_in_board():
            mx.append(row)
            row_names.append(row_name)
        self.dlx = Dlx(mx, row_names)
        
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
        for solution in self.dlx.search():
            b_str = ''
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
            for char in b_str:
                color = COLOR_MAP.get(char, Fore.WHITE)
                colored_output.append(f"{color}{char}{Fore.RESET}")
            print(''.join(colored_output))
            if find_one_exit:
                return

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