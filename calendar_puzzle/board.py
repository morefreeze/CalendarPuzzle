import datetime
import random
import copy
from typing import List

from calendar_puzzle.shape import (EMPTY_SHAPE, Shape, ShapeU, ShapeG, ShapeI, ShapeL, Shapel,
                                   ShapeQ, ShapeS, ShapeN, ShapeT, ShapeZ,
                                   build_mx)

BLOCK = '*'

class Game(object):
    board = None
    shapes: List[Shape] = []  # [shape, ...]
    n, m = 8, 7
    visited = set()

    def __init__(self, dt=datetime.date.today()) -> None:
        super().__init__()
        self.shapes = [ShapeU(), ShapeG(), ShapeI(), ShapeL(), Shapel(), ShapeQ(), ShapeS(), ShapeN(), ShapeT(), ShapeZ()]
        # random.shuffle(self.shapes)
        self.board = Board(build_mx(self.n, self.m), self.shapes)
        self.mark_date(dt)
        self.visited = set()
        self.cnt = 0
        self.should_exit = False
        self.wf = None
        self.dt = dt

    def mark_date(self, dt=None):
        dt = self.dt if dt is None else dt
        weekday = dt.weekday()
        month, day = dt.month, dt.day
        self.board.b[0][6] = '#'
        self.board.b[1][6] = '#'
        self.board.b[7][0] = '#'
        self.board.b[7][1] = '#'
        self.board.b[7][2] = '#'
        self.board.b[7][3] = '#'
        self.board.b[(month-1)//6][(month-1)%6] = BLOCK
        self.board.b[2+(day-1)//7][(day-1)%7] = BLOCK
        if weekday == 6:
            self.board.b[6][3] = BLOCK
        elif 0 <= weekday <= 2:
            self.board.b[6][4+weekday] = BLOCK
        else:
            self.board.b[7][1+weekday] = BLOCK

    def solve(self, find_one_exit=True):
        self.try_put(find_one_exit)

    def try_put(self, find_one_exit):
        if False and len(self.board.remaining_shapes) == 6:
            print(self.cnt)
            print(self)
            self.cnt = 0
        if len(self.board.remaining_shapes) == 0:
            print('solve!')
            print(self)
            self.save()
            if find_one_exit:
                self.should_exit = True
            return
        found_empty = False
        for x in range(self.n):
            for y in range(self.m):
                if self.board.b[x][y] == ' ':
                    found_empty = True
                    break
            if found_empty:
                break
        for i in range(self.n):
            for j in range(self.m):
                for k, shape in enumerate(self.board.remaining_shapes):
                    for ss in shape.all_shapes():
                        succ, new_b = self.fit_put(i, j, ss)
                        if new_b[x][y] != ' ' and succ:
                            self.cnt += 1
                            self.board.b, ori_b = new_b, copy.deepcopy(self.board.b)
                            self.board.remaining_shapes = self.board.remaining_shapes[:k] + self.board.remaining_shapes[k+1:]
                            if self.board not in self.visited:
                                self.visited.add(self.board)
                                self.try_put(find_one_exit)
                                if self.should_exit:
                                    return
                            self.board.remaining_shapes = self.board.remaining_shapes[:k] + [shape] + self.board.remaining_shapes[k:]
                            self.board.b = ori_b

    def fit_put(self, x, y, shape: Shape):
        if len(shape.grid) == 0:
            return True
        n, m = len(shape.grid), len(shape.grid[0])
        new_b = copy.deepcopy(self.board.b)
        succ = True
        for i in range(n):
            for j in range(m):
                if shape.grid[i][j] == ' ':
                    continue
                if not (0 <= x+i < self.n and 0 <= y+j < self.m):
                    succ = False
                    break
                if new_b[x+i][y+j] == ' ':
                    new_b[x+i][y+j] = shape.grid[i][j]
                else:
                    succ = False
                    break
            if not succ:
                break
        return succ, new_b

    def save(self):
        if self.wf is None:
            self.wf = open(self.dt.strftime('%Y%m%d'), 'w')
        self.wf.write(str(self))
        self.wf.write('\n')

    def __str__(self):
        return '\n'.join(['{' + ''.join(row) + '}' for row in self.board.b])


class Board(object):
    b = EMPTY_SHAPE
    remaining_shapes = []

    def __init__(self, b, remaining_shapes) -> None:
        super().__init__()
        self.b, self.remaining_shapes = b, remaining_shapes

    def __str__(self):
        board_str = '\n'.join(['{' + ''.join(row) + '}' for row in self.b])
        return f'{board_str}\nwith remaining shapes\n' + '\n'.join(map(str, sorted(self.remaining_shapes)))

    def __hash__(self) -> int:
        return hash(self.__str__())

    def __eq__(self, other):
        if not isinstance(other, type(self)): return NotImplemented
        return self.__str__() == other.__str__()
