from collections import defaultdict

from pyparsing import col


class Node:
    def __init__(self, coordinate, name):
        self.coordinate = coordinate
        self.name = name
        self.up = self
        self.down = self
        self.left = self
        self.right = self
        self.size = 0

def append_col(col_head, new_node):
    new_node.up = col_head.up
    new_node.down = col_head
    col_head.up.down = new_node
    col_head.up = new_node

def append_row(first, new_node):
    new_node.right = first
    new_node.left = first.left
    first.left.right = first.left = new_node

cap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
# implement dancing link basic data struct
class Dlx:
    # build dancing link from matrix must at least one row and one column, its value should be 0 or 1
    def __init__(self, mx):
        n, m = len(mx), len(mx[0])
        self.head = Node((0,0), "head")
        self.nodes: dict[int, Node] = {}
        self.solution = []

        for j in range(m):
            node = Node((0, j+1), f"h{cap[j]}")
            self.nodes[j] = node
            node.left = self.head.left
            node.right = self.head
            self.head.left.right = node
            self.head.left = node

        self.print_dlx()

        for i in range(n):
            prev = None
            first = None
            for j in range(m):
                if mx[i][j]:
                    col_node = self.nodes[j]
                    new_node = Node((i+1, j+1), f"{cap[j]}{i+1}")
                    if not first:
                        first = new_node
                    append_col(col_node, new_node)
                    append_row(first, new_node)
                    
                    col_node.size += 1
        self.print_dlx()

    def search(self, k=0):
        if self.head.right == self.head:
            yield self.solution
            return

        col = self.choose_column()
        self.cover(col)
        row = col.down
        while row != col:
            self.solution.append(row.name)
            j = row.right
            while j != row:
                self.cover(j.head)
                j = j.right
            yield from self.search(k + 1)
            row = self.solution.pop()
            j = row.left
            while j != row:
                self.uncover(j.head)
                j = j.left
        self.uncover(col)

    def choose_column(self):
        col = self.head.right
        min_value = float('inf')
        for node in self.iter_columns():
            if node.name < min_value:
                min_value = node.name
                col = node
        return col

    def iter_columns(self):
        node = self.head.right
        while node != self.head:
            yield node
            node = node.right

    def cover(self, col):
        col.left.right = col.right
        col.right.left = col.left
        row = col.down
        while row != col:
            j = row.right
            while j != row:
                j.down.up = j.up
                j.up.down = j.down
                j.head.value -= 1
                j = j.right
            row = row.down

    def uncover(self, col):
        row = col.up
        while row != col:
            j = row.left
            while j != row:
                j.head.value += 1
                j.down.up = j
                j.up.down = j
                j = j.left
            row = row.up
        col.left.right = col
        col.right.left = col

    def print_dlx(self):
        """
        Print the matrix in a human-readable format.
        """
        display_mx, n, m = self.display_mx()
        for i in range(n+1):
            for j in range(m+1):
                print(f'\t{display_mx[i][j]}', end=" ")
            print()

    def display_mx(self):
        display_mx = defaultdict(lambda: defaultdict(str))
        n, m = 0, 0
        for col in self.iter_columns():
            node = col.down
            while node != col:
                display_mx[node.coordinate[0]-1][node.coordinate[1]-1] = node.name
                n = max(n, node.coordinate[0])
                m = max(m, node.coordinate[1])
                node = node.down
        return display_mx, n, m