from calendar_puzzle.board import Game
from calendar_puzzle.shape import Shape, ShapeS, ShapeSS

if __name__ == '__main__':
    g = Game()
    s = ShapeS()
    print(g.board)
    g.solve()