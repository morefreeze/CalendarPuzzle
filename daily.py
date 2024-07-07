from calendar_puzzle.board import Game
from calendar_puzzle.dancing_link.calendar import FasterGame
from calendar_puzzle.shape import Shape, ShapeS, ShapeN

if __name__ == '__main__':
    # g = Game()
    g = FasterGame()
    g.solve(find_one_exit=True)
    # print(g.board)
