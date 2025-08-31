from random import sample, choice
import sys

from calendar_puzzle.constants import DIGGED_CELL
from calendar_puzzle.shape import AllShapes

def dig(board, dig_num=4):
    letters = [k.name for k in AllShapes]
    dig_num = min(dig_num, len(letters))
    dig_lets = ''.join(sample(letters, k=dig_num))
    print(f'dig letters {dig_lets}')
    for x in dig_lets:
        board = [line.replace(x, DIGGED_CELL) for line in board]
    print(''.join(board))
    return board, dig_lets

def dig_floor(board, dig_num=4):
    """
    从随机字母方块开始，移除相邻的字母方块，直到达到dig_num要求
    
    算法：
    1. 找到所有字母方块及其位置
    2. 使用BFS从随机起始点找到相邻字母方块
    3. 如果相邻方块不足，随机选择剩余字母的所有实例补足
    4. 按顺序移除方块直到达到dig_num
    """
    
    # 找到所有字母方块的位置，建立字母到位置的映射
    letters = [k.name for k in AllShapes]
    letter_positions = {}  # char -> list of (x, y)
    
    for y, line in enumerate(board):
        for x, char in enumerate(line):
            if char in letters:
                if char not in letter_positions:
                    letter_positions[char] = []
                letter_positions[char].append((x, y))
    
    if not letter_positions:
        print("No letter blocks found on board")
        return board, ''
    
    # 使用BFS找到相邻的字母方块
    to_remove = []
    
    start_char = choice(list(letter_positions.keys()))
    # 4个方向的偏移
    directions = [(-1, 0), (0, -1), (0, 1), (1, 0)]
    # BFS逻辑：从随机起始方块开始找相邻字母
    while len(to_remove) < dig_num:
        to_remove.append(start_char)
        
        next_letters = []
        for x, y in letter_positions[start_char]:
            for dx, dy in directions:
                nx, ny = x + dx, y + dy
                if 0 <= nx < len(board[y]) and 0 <= ny < len(board):
                    neighbor_char = board[ny][nx]
                    if neighbor_char in letters and neighbor_char not in to_remove:
                        next_letters.append(neighbor_char)
        del letter_positions[start_char]
        if next_letters:
            start_char = choice(next_letters)
        elif len(letter_positions) > 0:
            start_char = choice(list(letter_positions.keys()))
        else:
            break
    
    print(f"dig_floor: removing {len(to_remove)} blocks: {''.join(to_remove)}")
    
    for x in to_remove:
        board = [line.replace(x, DIGGED_CELL) for line in board]
    print(''.join(board))
    return board, ''.join(to_remove)

if __name__ == "__main__":
    board = [line for line in sys.stdin]
    
    if len(sys.argv) > 1 and sys.argv[1] == "--floor":
        # 使用新的dig_floor模式
        dig_num = 4 if len(sys.argv) <= 2 else int(sys.argv[2])
        dig_floor(board, dig_num)
    else:
        # 使用原始的随机移除模式
        dig_num = 4 if len(sys.argv) <= 1 else int(sys.argv[1])
        dig(board, dig_num)
