import datetime
from tqdm import tqdm
from calendar_puzzle.board import Game
from calendar_puzzle.shape import Shape, ShapeS, ShapeN

if __name__ == '__main__':
    dt = datetime.date.today()
    for i in tqdm(range(365)):
        g = Game(dt=dt)
        dt += datetime.timedelta(days=1)
        # print(g.board)
        g.solve(find_one_exit=True)