import datetime
from tqdm import tqdm
from calendar_puzzle.board import Game
from calendar_puzzle.dancing_link.calendar import FasterGame
from calendar_puzzle.shape import Shape, ShapeS, ShapeN

if __name__ == '__main__':
    dt = datetime.date.today()
    for i in tqdm(range(30)):
        print()
        # g = Game(dt=dt)
        g = FasterGame(dt=dt)
        # print(g.board)
        g.solve(find_one_exit=True)
        print(dt)
        dt += datetime.timedelta(days=1)