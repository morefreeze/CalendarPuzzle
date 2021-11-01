import datetime
import random
import copy
from typing import List

from calendar_puzzle.shape import (EMPTY_SHAPE, Shape, ShapeAO, ShapeG, ShapeI, ShapeL, Shapel,
                                   ShapeO, ShapeS, ShapeSS, ShapeT, ShapeZ,
                                   build_mx)

BLOCK = '*'

class Game(object):
    board = None
    shapes: List[Shape]  = [] # [shape, ...]
    n, m = 8, 7
    visited = set()

    def __init__(self, dt=datetime.date.today()) -> None:
        super().__init__()
        self.shapes = [ShapeAO(), ShapeG(), ShapeI(), ShapeL(), Shapel(), ShapeO(), ShapeS(), ShapeSS(), ShapeT(), ShapeZ()]
        random.shuffle(self.shapes)
        self.board = Board(build_mx(self.n, self.m), self.shapes)
        self.mark_date(dt)
        self.visited = set()
        self.cnt = 0
    
    def mark_date(self, dt):
        weekday = dt.weekday()
        month, day = dt.month, dt.day
        self.board.b[0][6] = '#'
        self.board.b[1][6] = '#'
        self.board.b[7][0] = '#'
        self.board.b[7][1] = '#'
        self.board.b[7][2] = '#'
        self.board.b[7][3] = '#'
        self.board.b[(month-1)//6][(month-1)%6] = '*'
        self.board.b[2+(day-1)//7][(day-1)%7] = '*'
        if weekday == 6:
            self.board.b[6][3] = '*'
        elif 0 <= weekday <= 2:
            self.board.b[6][4+weekday] = '*'
        else:
            self.board.b[7][1+weekday] = '*'
    
    def solve(self):
        self.try_put()

    def try_put(self):
        if len(self.board.remind_shapes) == 6:
            print(self.cnt)
            print(self)
            self.cnt = 0
        if len(self.board.remind_shapes) == 0:
            print('solve!')
            print(self)
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
                for k, shape in enumerate(self.board.remind_shapes):
                    for ss in shape.all_shapes():
                        succ, new_b = self.fit_put(i, j, ss)
                        if new_b[x][y] != ' ' and succ:
                            self.cnt += 1
                            self.board.b, ori_b = new_b, copy.deepcopy(self.board.b)
                            self.board.remind_shapes = self.board.remind_shapes[:k] + self.board.remind_shapes[k+1:]
                            if self.board not in self.visited:
                                self.visited.add(self.board)
                                self.try_put()
                            self.board.remind_shapes = self.board.remind_shapes[:k] + [shape] + self.board.remind_shapes[k:]
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
    
    def __str__(self):
        return '\n'.join(['{' + ''.join(row) + '}' for row in self.board.b])


class Board(object):
    b = EMPTY_SHAPE
    remind_shapes = []

    def __init__(self, b, remind_shapes) -> None:
        super().__init__()
        self.b, self.remind_shapes = b, remind_shapes

    def __str__(self):
        board_str = '\n'.join(['{' + ''.join(row) + '}' for row in self.b])
        return f'{board_str}\nwith remind shapes\n' + '\n'.join(map(str, sorted(self.remind_shapes)))

    def __hash__(self) -> int:
        return hash(self.__str__())
    
    def __eq__(self, other):
        if not isinstance(other, type(self)): return NotImplemented
        return self.__str__() == other.__str__()
