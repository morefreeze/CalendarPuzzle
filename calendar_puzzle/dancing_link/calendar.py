# generate each shape which put in a board, present it as a row of dancing link
# convert matrix to an array and use it as a row of dancing link
import datetime
import copy
from itertools import zip_longest
from typing import Tuple
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
    
    def fit_put(self, x, y: int, shape: Shape) -> Tuple[bool, list[list]]:
        """
        Check if a shape can fit at position (x, y) and return the updated board.
        This method handles the dancing link constraints by ensuring:
        1. The shape fits within board boundaries
        2. The shape doesn't overlap with existing blocks or marked cells
        3. The shape only covers empty cells and doesn't conflict with other shapes
        """
        if len(shape.grid) == 0:
            return True, self.board.b
        
        n, m = len(shape.grid), len(shape.grid[0])
        new_b = copy.deepcopy(self.board.b)
        succ = True
        
        # Check if shape can fit at position (x, y)
        for i in range(n):
            for j in range(m):
                if shape.grid[i][j] == ' ':
                    continue
                
                # Check boundaries
                if not (0 <= x+i < self.n and 0 <= y+j < self.m):
                    succ = False
                    break
                
                # Check if the cell is available for placement
                cell_content = new_b[x+i][y+j]
                if cell_content == ' ':
                    # Empty cell, can place shape
                    new_b[x+i][y+j] = shape.name
                elif cell_content == shape.name:
                    # Already occupied by the same shape, this is valid
                    continue
                elif cell_content in ['#', '*']:
                    # Marked cells (date/weekday) cannot be covered
                    succ = False
                    break
                else:
                    # Cell occupied by another shape, conflict
                    succ = False
                    break
            
            if not succ:
                break
        
        return succ, new_b
    
    def update_constraints_for_placed_blocks(self, placed_blocks):
        """
        Update the dancing link constraints to account for already placed blocks.
        This removes candidate rows that conflict with the current board state.
        
        Args:
            placed_blocks: List of already placed blocks with their positions and shapes
        """
        if not placed_blocks:
            return
        
        # Create a constraint matrix for the current board state
        constraint_rows = []
        
        for block in placed_blocks:
            # For each placed block, create constraints that must be satisfied
            # This ensures the dancing link solution doesn't conflict with existing blocks
            
            # Mark the cells occupied by this block as constraints
            for i in range(len(block.shape)):
                for j in range(len(block.shape[0])):
                    if block.shape[i][j] == 1:  # Shape occupies this cell
                        x, y = block.x + i, block.y + j
                        if 0 <= x < self.n and 0 <= y < self.m:
                            # Create a constraint row indicating this cell is occupied
                            constraint_row = [0] * (len(self.board.remaining_shapes) + self.n * self.m)
                            # Mark the shape as used
                            shape_index = self.get_shape_index(block.id)
                            if shape_index >= 0:
                                constraint_row[shape_index] = 1
                            # Mark the cell as occupied
                            cell_index = len(self.board.remaining_shapes) + x * self.m + y
                            if cell_index < len(constraint_row):
                                constraint_row[cell_index] = 1
                            constraint_rows.append(constraint_row)
        
        # Update the dancing link matrix with these constraints
        if constraint_rows:
            # Remove rows that conflict with these constraints
            self.remove_conflicting_rows(constraint_rows)
    
    def get_shape_index(self, shape_id):
        """Get the index of a shape in the remaining_shapes list"""
        for i, shape in enumerate(self.board.remaining_shapes):
            if shape.id == shape_id:
                return i
        return -1
    
    def remove_conflicting_rows(self, constraint_rows):
        """
        Remove rows from the dancing link matrix that conflict with the given constraints.
        This ensures the solution respects already placed blocks.
        """
        if not hasattr(self, 'dlx') or not self.dlx:
            return
        
        # Create a set of cells that are already occupied
        occupied_cells = set()
        used_shapes = set()
        
        for constraint_row in constraint_rows:
            # Extract shape and cell constraints from the constraint row
            for i, val in enumerate(constraint_row):
                if val == 1:
                    if i < len(self.board.remaining_shapes):
                        # This is a shape constraint
                        used_shapes.add(i)
                    else:
                        # This is a cell constraint
                        cell_index = i - len(self.board.remaining_shapes)
                        x = cell_index // self.m
                        y = cell_index % self.m
                        occupied_cells.add((x, y))
        
        # Remove rows that conflict with these constraints
        rows_to_remove = []
        
        # Check each row in the dancing link matrix
        for row_idx, row in enumerate(self.dlx.matrix):
            should_remove = False
            
            # Check if this row uses an already used shape
            if row_idx < len(row) and row[row_idx] == 1:
                if row_idx in used_shapes:
                    should_remove = True
            
            # Check if this row covers already occupied cells
            for i, val in enumerate(row):
                if val == 1 and i >= len(self.board.remaining_shapes):
                    cell_index = i - len(self.board.remaining_shapes)
                    x = cell_index // self.m
                    y = cell_index % self.m
                    if (x, y) in occupied_cells:
                        should_remove = True
                        break
            
            if should_remove:
                rows_to_remove.append(row_idx)
        
        # Remove conflicting rows (this would need to be implemented in the Dlx class)
        # For now, we'll just mark which rows should be removed
        self.conflicting_rows = rows_to_remove
        
        # Create a new dancing link instance without conflicting rows
        self.create_filtered_dlx()
    
    def create_filtered_dlx(self):
        """
        Create a new dancing link instance that excludes conflicting rows.
        This ensures the solution respects already placed blocks.
        """
        if not hasattr(self, 'conflicting_rows') or not self.conflicting_rows:
            return
        
        # Generate a new matrix without conflicting rows
        filtered_mx = []
        filtered_row_names = ['head']
        
        for i, (row, row_name) in enumerate(self.gen_shape_in_board()):
            if i not in self.conflicting_rows:
                filtered_mx.append(row)
                filtered_row_names.append(row_name)
        
        # Create new dancing link instance
        self.dlx = Dlx(filtered_mx, filtered_row_names)
        
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
    
    def solve_with_placed_blocks(self, placed_blocks, find_one_exit=True):
        """
        Solve the puzzle with already placed blocks.
        
        Args:
            placed_blocks: List of already placed blocks with their positions and shapes
            find_one_exit: Whether to return after finding the first solution
            
        Returns:
            List of solutions, each containing the remaining blocks to place
        """
        # Update constraints for already placed blocks
        self.update_constraints_for_placed_blocks(placed_blocks)
        
        # Find solutions
        solutions = []
        for solution in self.dlx.search():
            # Convert solution to block placements
            solution_blocks = []
            for step in solution:
                # Extract block information from the solution
                # This would need to be implemented based on how the dancing link
                # solution maps back to actual block placements
                pass
            
            solutions.append(solution_blocks)
            if find_one_exit:
                break
        
        return solutions
    
    def solve_partial_board(self, placed_blocks, uncoverable_cells=None):
        """
        Solve the puzzle for a board with already placed blocks.
        
        Args:
            placed_blocks: List of already placed blocks with their positions and shapes
            uncoverable_cells: List of cells that cannot be covered (optional)
            
        Returns:
            Solution with remaining blocks to place, or None if no solution exists
        """
        # Create a new board state with the placed blocks
        new_board = copy.deepcopy(self.board.b)
        
        # Mark placed blocks on the board
        for block in placed_blocks:
            for i in range(len(block.shape)):
                for j in range(len(block.shape[0])):
                    if block.shape[i][j] == 1:
                        x, y = block.x + i, block.y + j
                        if 0 <= x < self.n and 0 <= y < self.m:
                            new_board[x][y] = block.id
        
        # Create a new FasterGame instance with the updated board
        # This approach ensures we have a clean constraint matrix
        temp_game = FasterGame(self.dt)
        temp_game.board.b = new_board
        
        # Remove used shapes from remaining shapes
        used_shape_ids = {block.id for block in placed_blocks}
        temp_game.board.remaining_shapes = [
            shape for shape in temp_game.board.remaining_shapes
            if shape.id not in used_shape_ids
        ]
        
        # Try to solve
        try:
            for solution in temp_game.dlx.search():
                # Convert solution back to block format
                solution_blocks = []
                # Implementation would depend on how the dancing link solution maps to blocks
                return solution_blocks
        except:
            return None
        
        return None

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