import unittest
from calendar_puzzle.dancing_link.dl import Node, Dlx, cap

class TestNode(unittest.TestCase):
    def test_node_init(self):
        node = Node((0, 0), 5)
        self.assertEqual(node.name, 5)
        self.assertEqual(node.up, node)
        self.assertEqual(node.down, node)
        self.assertEqual(node.left, node)
        self.assertEqual(node.right, node)

class TestDlx(unittest.TestCase):
    def test_dlx_init(self):
        matrix = [[0, 0, 1, 0, 1, 1, 0],
                [1, 0, 0, 1, 0, 0, 1],
                [0, 1, 1, 0, 0, 1, 0],
                [1, 0, 0, 1, 0, 0, 0],
                [0, 1, 0, 0, 0, 0, 1],
                [0, 0, 0, 1, 1, 0, 1]]
        dlx = Dlx(matrix)
        self.assertIsNotNone(dlx.head)

        # Check if the column nodes are correctly linked
        col_node = dlx.head.right
        for i in range(7):
            self.assertEqual(col_node.name, f"h{cap[i]}")
            self.assertEqual(col_node.size, sum(row[i] for row in matrix))
            col_node = col_node.right

        # Check if the row nodes are correctly linked
        mx, n, m = dlx.display_mx()
        self.assertEqual(len(matrix), n)
        for row_idx, row in enumerate(matrix):
            self.assertEqual(len(matrix[row_idx]), m)
            for col_idx, val in enumerate(row):
                if val:
                    self.assertGreater(len(mx[row_idx][col_idx]), 0, f'({row_idx}, {col_idx}) should not be empty')
                else:
                    self.assertEqual(len(mx[row_idx][col_idx]), 0)


    # def test_choose_column(self):
    #     matrix = [[0, 0, 1, 0, 1, 1, 0],
    #               [1, 0, 0, 1, 0, 0, 1]]
    #     dlx = Dlx(matrix)
    #     col = dlx.choose_column()
    #     self.assertEqual(col.name, 3)

    # def test_search(self):
    #     matrix = [[0, 0, 1, 0, 1, 1, 0],
    #               [1, 0, 0, 1, 0, 0, 1],
    #               [0, 1, 1, 0, 0, 1, 0],
    #               [1, 0, 0, 1, 0, 0, 0],
    #               [0, 1, 0, 0, 0, 0, 1],
    #               [0, 0, 0, 1, 1, 0, 1]]
    #     dlx = Dlx(matrix)
    #     solutions = list(dlx.search())
    #     expected_solutions = [[(0, 2), (0, 4), (0, 5), (1, 0), (1, 3), (1, 6), (2, 1), (2, 2), (2, 5), (3, 0), (3, 3)],
    #                           [(0, 2), (0, 4), (0, 5), (1, 0), (1, 3), (1, 6), (2, 1), (2, 2), (2, 5), (3, 0), (4, 1), (4, 6)],
    #                           [(0, 2), (0, 4), (0, 5), (1, 0), (1, 3), (1, 6), (2, 1), (2, 2), (2, 5), (4, 1), (5, 3), (5, 4), (5, 6)],
    #                           [(0, 2), (0, 4), (0, 5), (1, 0), (1, 3), (1, 6), (3, 0), (3, 3), (4, 1), (4, 6), (5, 3), (5, 4)]]
    #     self.assertEqual(len(solutions), len(expected_solutions))
    #     for solution, expected in zip(solutions, expected_solutions):
    #         self.assertEqual(sorted(solution), sorted(expected))

if __name__ == '__main__':
    unittest.main()
