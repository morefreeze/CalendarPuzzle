// Dancing Links (DLX) algorithm for exact cover problems
// Ported from Python calendar_puzzle/dancing_link/dl.py

class DLXNode {
  coordinate: [number, number];
  name: string;
  up: DLXNode;
  down: DLXNode;
  left: DLXNode;
  right: DLXNode;
  head: DLXNode;
  size: number;

  constructor(coordinate: [number, number], name: string) {
    this.coordinate = coordinate;
    this.name = name;
    this.up = this;
    this.down = this;
    this.left = this;
    this.right = this;
    this.head = this;
    this.size = 0;
  }
}

function appendCol(colHead: DLXNode, newNode: DLXNode): void {
  newNode.head = colHead;
  newNode.up = colHead.up;
  newNode.down = colHead;
  colHead.up.down = newNode;
  colHead.up = newNode;
  colHead.size += 1;
}

function appendRow(first: DLXNode, newNode: DLXNode): void {
  newNode.right = first;
  newNode.left = first.left;
  first.left.right = first.left = newNode;
}

const CAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export class DLX {
  head: DLXNode;
  nodes: Map<number, DLXNode>;
  solution: DLXNode[];
  rowNames: string[];

  constructor(mx: number[][], rowNames: string[]) {
    const n = mx.length;
    const m = mx[0].length;
    this.head = new DLXNode([0, 0], 'head');
    this.nodes = new Map();
    this.solution = [];
    this.rowNames = rowNames;

    // Create column headers
    for (let j = 0; j < m; j++) {
      const node = new DLXNode([0, j + 1], `h${CAP[j]}`);
      this.nodes.set(j, node);
      node.left = this.head.left;
      node.right = this.head;
      this.head.left.right = node;
      this.head.left = node;
    }

    // Create rows
    for (let i = 0; i < n; i++) {
      let first: DLXNode | null = null;
      for (let j = 0; j < m; j++) {
        if (mx[i][j]) {
          const colNode = this.nodes.get(j)!;
          const newNode = new DLXNode([i + 1, j + 1], `${CAP[j]}${i + 1}`);
          if (!first) {
            first = newNode;
          }
          appendCol(colNode, newNode);
          appendRow(first, newNode);
        }
      }
    }
  }

  *search(k = 0): Generator<DLXNode[]> {
    if (this.head.right === this.head) {
      yield [...this.solution];
      return;
    }

    const col = this.chooseColumn();
    this.cover(col);
    let row = col.down;
    while (row !== col) {
      this.solution.push(row);
      let j = row.right;
      while (j !== row) {
        this.cover(j.head);
        j = j.right;
      }
      yield* this.search(k + 1);
      row = this.solution.pop()!;
      j = row.left;
      while (j !== row) {
        this.uncover(j.head);
        j = j.left;
      }
      row = row.down;
    }
    this.uncover(col);
  }

  private chooseColumn(): DLXNode {
    let col = this.head.right;
    let minValue = Infinity;
    let node = this.head.right;
    while (node !== this.head) {
      if (node.size < minValue) {
        minValue = node.size;
        col = node;
      }
      node = node.right;
    }
    return col;
  }

  private cover(colHead: DLXNode): void {
    colHead.left.right = colHead.right;
    colHead.right.left = colHead.left;
    let row = colHead.down;
    while (row !== colHead) {
      let j = row.right;
      while (j !== row) {
        j.down.up = j.up;
        j.up.down = j.down;
        j.head.size -= 1;
        j = j.right;
      }
      row = row.down;
    }
  }

  private uncover(colHead: DLXNode): void {
    let row = colHead.up;
    while (row !== colHead) {
      let j = row.left;
      while (j !== row) {
        j.head.size += 1;
        j.down.up = j;
        j.up.down = j;
        j = j.left;
      }
      row = row.up;
    }
    colHead.left.right = colHead;
    colHead.right.left = colHead;
  }
}
