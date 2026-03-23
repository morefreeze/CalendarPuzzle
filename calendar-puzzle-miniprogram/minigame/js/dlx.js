// Dancing Links (DLX) algorithm for exact cover problems

function DLXNode(coordinate, name) {
  this.coordinate = coordinate;
  this.name = name;
  this.up = this;
  this.down = this;
  this.left = this;
  this.right = this;
  this.head = this;
  this.size = 0;
}

function appendCol(colHead, newNode) {
  newNode.head = colHead;
  newNode.up = colHead.up;
  newNode.down = colHead;
  colHead.up.down = newNode;
  colHead.up = newNode;
  colHead.size += 1;
}

function appendRow(first, newNode) {
  newNode.right = first;
  newNode.left = first.left;
  first.left.right = first.left = newNode;
}

var CAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function DLX(mx, rowNames) {
  var n = mx.length;
  var m = mx[0].length;
  this.head = new DLXNode([0, 0], 'head');
  this.nodes = {};
  this.solution = [];
  this.rowNames = rowNames;

  for (var j = 0; j < m; j++) {
    var node = new DLXNode([0, j + 1], 'h' + CAP[j]);
    this.nodes[j] = node;
    node.left = this.head.left;
    node.right = this.head;
    this.head.left.right = node;
    this.head.left = node;
  }

  for (var i = 0; i < n; i++) {
    var first = null;
    for (var jj = 0; jj < m; jj++) {
      if (mx[i][jj]) {
        var colNode = this.nodes[jj];
        var newNode = new DLXNode([i + 1, jj + 1], CAP[jj] + (i + 1));
        if (!first) first = newNode;
        appendCol(colNode, newNode);
        appendRow(first, newNode);
      }
    }
  }
}

DLX.prototype.search = function () {
  var results = [];
  this._search(0, results);
  return results;
};

DLX.prototype._search = function (k, results) {
  if (this.head.right === this.head) {
    results.push(this.solution.slice());
    return;
  }
  var col = this._chooseColumn();
  this._cover(col);
  var row = col.down;
  while (row !== col) {
    this.solution.push(row);
    var j = row.right;
    while (j !== row) { this._cover(j.head); j = j.right; }
    this._search(k + 1, results);
    if (results.length > 0) return;
    row = this.solution.pop();
    j = row.left;
    while (j !== row) { this._uncover(j.head); j = j.left; }
    row = row.down;
  }
  this._uncover(col);
};

DLX.prototype.countAll = function () {
  var count = { n: 0 };
  this._countAll(0, count);
  return count.n;
};

DLX.prototype._countAll = function (k, count) {
  if (this.head.right === this.head) {
    count.n++;
    return;
  }
  var col = this._chooseColumn();
  if (col.size === 0) return;
  this._cover(col);
  var row = col.down;
  while (row !== col) {
    this.solution.push(row);
    var j = row.right;
    while (j !== row) { this._cover(j.head); j = j.right; }
    this._countAll(k + 1, count);
    row = this.solution.pop();
    j = row.left;
    while (j !== row) { this._uncover(j.head); j = j.left; }
    row = row.down;
  }
  this._uncover(col);
};

DLX.prototype._chooseColumn = function () {
  var col = this.head.right, min = Infinity, node = this.head.right;
  while (node !== this.head) {
    if (node.size < min) { min = node.size; col = node; }
    node = node.right;
  }
  return col;
};

DLX.prototype._cover = function (c) {
  c.left.right = c.right; c.right.left = c.left;
  var row = c.down;
  while (row !== c) {
    var j = row.right;
    while (j !== row) { j.down.up = j.up; j.up.down = j.down; j.head.size--; j = j.right; }
    row = row.down;
  }
};

DLX.prototype._uncover = function (c) {
  var row = c.up;
  while (row !== c) {
    var j = row.left;
    while (j !== row) { j.head.size++; j.down.up = j; j.up.down = j; j = j.left; }
    row = row.up;
  }
  c.left.right = c; c.right.left = c;
};

module.exports = { DLX: DLX };
