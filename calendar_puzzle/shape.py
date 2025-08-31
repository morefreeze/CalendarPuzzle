
def build_mx(n, m):
    grid = []
    for i in range(n):
        grid.append([' '] * m)
    return grid

def EMPTY_SHAPE():
    return [[]]

class Shape(object):
    _name = None
    grid = EMPTY_SHAPE()
    rotate_grid = []

    def __init__(self, grid):
        # align each row and column is same
        n = len(grid)
        m = max([len(row) for row in grid])
        self.grid = build_mx(n, m)
        for i, row in enumerate(grid):
            for j, col in enumerate(row):
                self.grid[i][j] = col
        self.rotate_grid = [self.grid]
    
    @property
    def name(self):
        if self._name is None:
            for row in self.grid:
                for col in row:
                    if col != ' ':
                        self._name = col
                        return col
        return self._name
    
    def all_shapes(self):
        visited = {self}
        yield self
        for i in range(4):
            out = Shape(self.rotate(i))
            if out not in visited:
                yield out
                visited.add(out)
        h_out = Shape(self.h_mirror())
        if h_out not in visited:
            yield h_out
            visited.add(h_out)
            for i in range(4):
                out = Shape(h_out.rotate(i))
                if out not in visited:
                    yield out
                    visited.add(out)
        v_out = Shape(self.v_mirror())
        if v_out not in visited:
            yield v_out
            visited.add(v_out)
            for i in range(4):
                out = Shape(v_out.rotate(i))
                if out not in visited:
                    yield out
                    visited.add(out)
        return

    def rotate(self, tim=1):
        if len(self.grid) == 0:
            return EMPTY_SHAPE
        tim = tim % 4
        last_grid = self.rotate_grid[-1]
        for t in range(len(self.rotate_grid), tim+1):
            n, m = len(last_grid), len(last_grid[0])
            new_grid = build_mx(m, n)  # swap n and m
            for i in range(n):
                for j in range(m):
                    new_grid[m-j-1][i] = last_grid[i][j]
            self.rotate_grid.append(new_grid)
            last_grid = new_grid
        return self.rotate_grid[tim]

    def v_mirror(self):
        if len(self.grid) == 0:
            return [[]]
        n, m = len(self.grid), len(self.grid[0])
        new_grid = build_mx(n, m)
        for i in range(n):
            for j in range(m):
                new_grid[i][j], new_grid[n-i-1][j] = self.grid[n-i-1][j], self.grid[i][j]
        return new_grid

    def h_mirror(self):
        if len(self.grid) == 0:
            return EMPTY_SHAPE()
        n, m = len(self.grid), len(self.grid[0])
        new_grid = build_mx(n, m)
        for j in range(m):
            for i in range(n):
                new_grid[i][j], new_grid[i][m-j-1] = self.grid[i][m-j-1], self.grid[i][j]
        return new_grid
    
    def __str__(self) -> str:
        return '\n'.join([''.join(row) for row in self.grid])
    
    def __hash__(self) -> int:
        return hash(self.__str__())
    
    def __eq__(self, other):
        if not isinstance(other, type(self)): return NotImplemented
        return self.__str__() == other.__str__()
    
    def __lt__(self, rhs):
        return self.name < rhs.name

class ShapeU(Shape):
    def __init__(self):
        grid = [
            'UU',
            'U',
            'UU'
        ]
        super().__init__(grid)

class ShapeV(Shape):
    def __init__(self):
        grid = [
            'VVV',
            'V',
            'V'
        ]
        super().__init__(grid)

class ShapeI(Shape):
    def __init__(self):
        grid = [
            'IIII',
        ]
        super().__init__(grid)

class ShapeL(Shape):
    def __init__(self):
        grid = [
            'LLLL',
            'L',
        ]
        super().__init__(grid)

class ShapeJ(Shape):
    def __init__(self):
        grid = [
            'JJJ',
            'J',
        ]
        super().__init__(grid)

class ShapeQ(Shape):
    def __init__(self):
        grid = [
            'Q',
            'QQ',
            'QQ',
        ]
        super().__init__(grid)

class ShapeS(Shape):
    def __init__(self):
        grid = [
            ' SS',
            'SS',
        ]
        super().__init__(grid)

class ShapeN(Shape):
    def __init__(self):
        grid = [
            '  NN',
            'NNN',
        ]
        super().__init__(grid)


class ShapeT(Shape):
    def __init__(self):
        grid = [
            'TTT',
            ' T',
            ' T',
        ]
        super().__init__(grid)

class ShapeZ(Shape):
    def __init__(self):
        grid = [
            ' ZZ',
            ' Z',
            'ZZ',
        ]
        super().__init__(grid)

AllShapes = [
    ShapeU(),
    ShapeV(),
    ShapeI(),
    ShapeL(),
    ShapeJ(),
    ShapeQ(),
    ShapeS(),
    ShapeN(),
    ShapeT(),
    ShapeZ(),
]
