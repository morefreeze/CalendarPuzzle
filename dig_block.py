from random import sample
import sys
def dig(board, dig_num=4):
    assert(len(board) >= 8)
    letters = 'ADLISlZTGO'
    dig_lets = ''.join(sample(letters, k=dig_num))
    print(f'dig letters {dig_lets}')
    for x in dig_lets:
        board = [line.replace(x, 'X') for line in board]
    print(''.join(board))
    return board

if __name__ == "__main__":
    board = [line for line in sys.stdin]
    dig(board, 4 if len(sys.argv) <= 1 else int(sys.argv[1]))
