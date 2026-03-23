# Puzzle Switching Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the random single-shot puzzle switching with full enumeration of connected dig combinations, random/manual switching modes, and async solution counting.

**Architecture:** Three layers of change — (1) DLX gets a count-all mode, (2) puzzleGenerator gets combination enumeration and solution counting, (3) gameScene gets new UI for mode toggle, switch button, thumbnail panel, and solution count display. The puzzle object carries `allCombinations` so gameScene can switch puzzles without re-solving.

**Tech Stack:** Pure JS (WeChat mini-game canvas), DLX exact cover solver, no external dependencies.

---

### File Structure

| File | Role | Changes |
|------|------|---------|
| `minigame/js/dlx.js` | DLX solver | Add `countAll()` method that searches all solutions and returns count |
| `minigame/js/puzzleGenerator.js` | Puzzle generation | Add `enumAllDigCombinations()`, `puzzleFromCombo()`, `countSolutionsForCombo()`, `solveBoardForCombo()`. Modify `generatePuzzle()` return value. Export new functions. |
| `minigame/js/gameScene.js` | Game UI scene | Replace "换题" button with mode toggle + switch button. Add thumbnail selection panel. Add async solution count display. Handle `onSwitchPuzzle` callback. |
| `minigame/js/main.js` | Scene controller | Change `onRestart` callback to `onSwitchPuzzle(puzzle, comboIndex)` that rebuilds scene without re-solving. |

---

### Task 1: Add `countAll()` to DLX

**Files:**
- Modify: `minigame/js/dlx.js:62-88`

- [ ] **Step 1: Add `countAll` method**

Add after `DLX.prototype.search` (line 66). This is a new method that reuses the existing `_cover`/`_uncover`/`_chooseColumn` internals but counts all solutions instead of collecting them and returning after the first:

```js
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
```

- [ ] **Step 2: Verify no syntax errors**

Open `minigame/` in WeChat Developer Tools, confirm no console errors on load.

- [ ] **Step 3: Commit**

```bash
git add minigame/js/dlx.js
git commit -m "feat: add countAll method to DLX for exhaustive solution counting"
```

---

### Task 2: Add combination enumeration and solution counting to puzzleGenerator

**Files:**
- Modify: `minigame/js/puzzleGenerator.js:119-189`

- [ ] **Step 1: Add `buildBlockAdjacency` helper**

Add after `digFloor` function (line 141). This builds a map of which block labels are adjacent on the solved board (share a cell edge). Used by `enumAllDigCombinations` to check connectivity:

```js
function buildBlockAdjacency(sb) {
  var letters = SHAPES.map(function(s) { return s.n; });
  var adj = {};
  for (var i = 0; i < letters.length; i++) adj[letters[i]] = {};
  var dirs = [[-1,0],[0,-1],[0,1],[1,0]];
  for (var y = 0; y < sb.length; y++) {
    for (var x = 0; x < sb[y].length; x++) {
      var ch = sb[y][x];
      if (letters.indexOf(ch) < 0) continue;
      for (var d = 0; d < dirs.length; d++) {
        var ny = y + dirs[d][0], nx = x + dirs[d][1];
        if (ny >= 0 && ny < sb.length && nx >= 0 && nx < sb[ny].length) {
          var nc = sb[ny][nx];
          if (nc !== ch && letters.indexOf(nc) >= 0) adj[ch][nc] = true;
        }
      }
    }
  }
  return adj;
}
```

- [ ] **Step 2: Add `isConnected` helper**

Add right after `buildBlockAdjacency`. Checks if a subset of block labels forms a connected subgraph using BFS:

```js
function isConnected(subset, adj) {
  if (subset.length <= 1) return true;
  var visited = {};
  var queue = [subset[0]];
  visited[subset[0]] = true;
  while (queue.length > 0) {
    var cur = queue.shift();
    var neighbors = adj[cur] || {};
    for (var k in neighbors) {
      if (!visited[k] && subset.indexOf(k) >= 0) {
        visited[k] = true;
        queue.push(k);
      }
    }
  }
  for (var i = 0; i < subset.length; i++) {
    if (!visited[subset[i]]) return false;
  }
  return true;
}
```

- [ ] **Step 3: Add `enumAllDigCombinations`**

Add right after `isConnected`. Enumerates all C(10, digCount) subsets, filters by connectivity:

```js
function enumAllDigCombinations(sb, digCount) {
  var letters = SHAPES.map(function(s) { return s.n; });
  var adj = buildBlockAdjacency(sb);
  var results = [];

  function combine(start, current) {
    if (current.length === digCount) {
      if (isConnected(current, adj)) results.push(current.slice());
      return;
    }
    if (start >= letters.length) return;
    var remaining = letters.length - start;
    if (current.length + remaining < digCount) return;
    for (var i = start; i < letters.length; i++) {
      current.push(letters[i]);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return results;
}
```

- [ ] **Step 4: Add `puzzleFromCombo`**

Add right after `enumAllDigCombinations`. Converts a solved board + combo into prePlaced/remaining without re-solving:

```js
function puzzleFromCombo(sb, combo) {
  var all = boardToPlaced(sb);
  var pre = all.filter(function(b) { return combo.indexOf(b.label) < 0; });
  var rem = all.filter(function(b) { return combo.indexOf(b.label) >= 0; }).map(function(b) {
    var orig = null;
    for (var i = 0; i < initialBlockTypes.length; i++) {
      if (initialBlockTypes[i].id === b.id) { orig = initialBlockTypes[i]; break; }
    }
    return { id: orig.id, label: orig.label, color: orig.color, shape: orig.shape.map(function(r) { return r.slice(); }), key: orig.key };
  });
  return { prePlacedBlocks: pre, remainingBlocks: rem };
}
```

- [ ] **Step 5: Add `solveBoardForCombo` and `countSolutionsForCombo`**

Add right after `puzzleFromCombo`. Builds a DLX matrix for only the combo blocks (not all 10) and counts solutions:

```js
function solveBoardForCombo(sb, combo) {
  // Build a board with only combo blocks removed
  var b = [];
  for (var y = 0; y < sb.length; y++) {
    var row = [];
    for (var x = 0; x < sb[y].length; x++) {
      if (combo.indexOf(sb[y][x]) >= 0) row.push(EMPTY);
      else row.push(sb[y][x]);
    }
    b.push(row);
  }
  // Only use combo shapes
  var comboShapes = SHAPES.filter(function(s) { return combo.indexOf(s.n) >= 0; });
  var sc = comboShapes.length;
  var ep = [];
  for (var i = 0; i < ROWS; i++) {
    for (var j = 0; j < COLS; j++) {
      if (b[i][j] === EMPTY) ep.push([i, j]);
    }
  }
  if (ep.length === 0) return 0;
  var mx = [], rn = ['head'], vis = {};
  for (var ii = 0; ii < ROWS; ii++) {
    for (var jj = 0; jj < COLS; jj++) {
      for (var k = 0; k < sc; k++) {
        var oris = allOri(comboShapes[k].g);
        for (var o = 0; o < oris.length; o++) {
          var nb = fitPut(b, ii, jj, oris[o], comboShapes[k].n);
          if (!nb) continue;
          var tc = sc + ep.length, row2 = [];
          for (var fi = 0; fi < tc; fi++) row2.push(0);
          row2[k] = 1;
          for (var p = 0; p < ep.length; p++) {
            if (nb[ep[p][0]][ep[p][1]] === comboShapes[k].n) row2[sc + p] = 1;
          }
          var key = row2.join('');
          if (!vis[key]) {
            vis[key] = 1;
            mx.push(row2);
            rn.push(nb.map(function(r) { return r.join(''); }).join('\n'));
          }
        }
      }
    }
  }
  if (!mx.length) return 0;
  var dlx = new DLX(mx, rn);
  return dlx.countAll();
}

function countSolutionsForCombo(sb, combo) {
  return solveBoardForCombo(sb, combo);
}
```

- [ ] **Step 6: Modify `generatePuzzle` to include allCombinations**

Replace current `generatePuzzle` function (lines 161-172):

```js
function generatePuzzle(diff, date) {
  var sb = solveBoard(date || new Date());
  if (!sb) return null;
  var digCount = DIFFICULTY_CONFIG[diff].digCount;
  var allCombos = enumAllDigCombinations(sb, digCount);
  if (!allCombos.length) return null;
  var idx = Math.floor(Math.random() * allCombos.length);
  var combo = allCombos[idx];
  var parts = puzzleFromCombo(sb, combo);
  return {
    prePlacedBlocks: parts.prePlacedBlocks,
    remainingBlocks: parts.remainingBlocks,
    difficulty: diff,
    solvedBoard: sb,
    allCombinations: allCombos,
    currentComboIndex: idx,
  };
}
```

- [ ] **Step 7: Update module.exports**

Replace the existing exports (lines 185-189):

```js
module.exports = {
  generatePuzzle: generatePuzzle,
  getHintShape: getHintShape,
  puzzleFromCombo: puzzleFromCombo,
  countSolutionsForCombo: countSolutionsForCombo,
  DIFFICULTY_CONFIG: DIFFICULTY_CONFIG,
};
```

- [ ] **Step 8: Verify in WeChat Developer Tools**

Open the game, select a difficulty. Confirm puzzle loads without errors. Check console for any issues.

- [ ] **Step 9: Commit**

```bash
git add minigame/js/puzzleGenerator.js
git commit -m "feat: enumerate all connected dig combinations and add solution counting"
```

---

### Task 3: Update main.js to support puzzle switching without re-solving

**Files:**
- Modify: `minigame/js/main.js:32-62`

- [ ] **Step 1: Add `switchPuzzle` function and update callbacks**

Replace `startGame` function and update `goToSelect` callback usage. The key change: `onSwitchPuzzle` receives a full puzzle object (with new combo applied) and rebuilds the scene without calling `solveBoard` again:

```js
function startGame(difficulty) {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = null;

  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u6B63\u5728\u751F\u6210\u8C1C\u9898...', W / 2, H / 2);

  setTimeout(function () {
    var puzzle = PG.generatePuzzle(difficulty);
    if (!puzzle) {
      goToSelect();
      return;
    }
    launchGameScene(difficulty, puzzle);
  }, 50);
}

function launchGameScene(difficulty, puzzle) {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = createGameScene(difficulty, puzzle, safeInsets, menuRect, {
    onSwitchPuzzle: function (newPuzzle) {
      launchGameScene(difficulty, newPuzzle);
    },
    onBack: function () {
      goToSelect();
    },
  });
  currentScene.dirty = true;
}
```

- [ ] **Step 2: Verify in WeChat Developer Tools**

Open the game, confirm scene loads correctly. The "换题" button won't work with new callback yet (that's Task 4).

- [ ] **Step 3: Commit**

```bash
git add minigame/js/main.js
git commit -m "feat: add launchGameScene for puzzle switching without re-solving"
```

---

### Task 4: Redesign control bar — mode toggle and switch button

**Files:**
- Modify: `minigame/js/gameScene.js:9-27` (state), `minigame/js/gameScene.js:112-127` (control layout), `minigame/js/gameScene.js:246-251` (control rendering), `minigame/js/gameScene.js:487-493` (restart action handler)

- [ ] **Step 1: Add switching state variables**

Add after `var diffLabel = ...` (line 26):

```js
  var switchMode = 'random'; // 'random' or 'manual'
  var selectPanelOpen = false;
  var solutionCount = -1; // -1 = not computed, 0+ = computed
  var solutionCountText = '\u89E3\u6CD5: \u8BA1\u7B97\u4E2D...';
  var playedCombos = {};
  playedCombos[puzzle.currentComboIndex] = true;
```

- [ ] **Step 2: Start async solution count on scene creation**

Add right after the state variables from step 1:

```js
  // Async solution count
  setTimeout(function () {
    var combo = puzzle.allCombinations[puzzle.currentComboIndex];
    solutionCount = PG.countSolutionsForCombo(puzzle.solvedBoard, combo);
    solutionCountText = '\u89E3\u6CD5: ' + solutionCount;
    scene.dirty = true;
  }, 50);
```

- [ ] **Step 3: Redesign control bar layout**

Replace the controls section in `computeLayout` (lines 112-127). Change from 5 equal buttons to: 3 action buttons (旋转/翻转/提示) on left, mode toggle + switch button on right, and 返回 below:

```js
    // Controls — row 1: action buttons + switch area
    var btnGap = 6;
    var btnH = 28;
    L.ctrlY = y;
    L.ctrlBtns = [];

    // Left: rotate, flip, hint (3 buttons)
    var leftBtnW = Math.floor((W * 0.45 - pad - 2 * btnGap) / 3);
    var leftLabels = ['\u65CB\u8F6C', '\u7FFB\u8F6C', '\u63D0\u793A'];
    var leftColors = ['#4CAF50', '#2196F3', '#FF9800'];
    var leftActions = ['rotate', 'flip', 'hint'];
    for (var i = 0; i < 3; i++) {
      L.ctrlBtns.push({
        x: pad + i * (leftBtnW + btnGap), y: y, w: leftBtnW, h: btnH,
        label: leftLabels[i], color: leftColors[i], action: leftActions[i],
      });
    }

    // Right: mode toggle + switch button
    var rightX = W * 0.5;
    var modeW = 40;
    L.modeToggle = { x: rightX, y: y, w: modeW, h: btnH };
    var switchW = W - rightX - modeW - btnGap - pad;
    var totalCombos = puzzle.allCombinations.length;
    L.ctrlBtns.push({
      x: rightX + modeW + btnGap, y: y, w: switchW, h: btnH,
      label: '\u6362\u9898(' + totalCombos + ')', color: '#F44336', action: 'restart',
    });

    y += btnH + 4;

    // Controls — row 2: back button (centered, smaller)
    var backW = 60;
    L.ctrlBtns.push({
      x: (W - backW) / 2, y: y, w: backW, h: 24,
      label: '\u8FD4\u56DE', color: '#757575', action: 'back',
    });
    y += 24 + 8;
```

- [ ] **Step 4: Update control bar rendering**

Replace the Controls rendering section (around lines 246-251). Add mode toggle rendering and solution count display:

```js
    // Controls
    for (var ci = 0; ci < L.ctrlBtns.length; ci++) {
      var cb = L.ctrlBtns[ci];
      var disabled = !selected && (cb.action === 'rotate' || cb.action === 'flip');
      R.button(ctx, cb.x, cb.y, cb.w, cb.h, cb.label, disabled ? '#ccc' : cb.color, '#fff', 4);
    }

    // Mode toggle
    if (L.modeToggle) {
      var mt = L.modeToggle;
      var mLabel = switchMode === 'random' ? '\u968F\u673A' : '\u624B\u52A8';
      var mColor = switchMode === 'random' ? '#9C27B0' : '#009688';
      R.roundRect(ctx, mt.x, mt.y, mt.w, mt.h, 4, mColor);
      R.text(ctx, mLabel, mt.x + mt.w / 2, mt.y + mt.h / 2, 10, '#fff', 'center', 'middle');
    }
```

- [ ] **Step 5: Add solution count to header display**

Add after the Count line rendering (after line 239):

```js
    // Solution count (async)
    R.text(ctx, solutionCountText, W - pad, L.countY, 12, '#999', 'right');
```

- [ ] **Step 6: Update restart action handler for random/manual modes**

Replace the `action === 'restart'` block (lines 487-493):

```js
        } else if (action === 'restart') {
          if (switchMode === 'manual') {
            selectPanelOpen = true;
            scene.dirty = true;
          } else {
            // Random mode: pick a random unplayed combo
            var combos = puzzle.allCombinations;
            var available = [];
            for (var ai = 0; ai < combos.length; ai++) {
              if (!playedCombos[ai]) available.push(ai);
            }
            if (available.length === 0) {
              // All played, reset
              playedCombos = {};
              for (var ai2 = 0; ai2 < combos.length; ai2++) available.push(ai2);
            }
            var newIdx = available[Math.floor(Math.random() * available.length)];
            playedCombos[newIdx] = true;
            var parts = PG.puzzleFromCombo(puzzle.solvedBoard, combos[newIdx]);
            var newPuzzle = {
              prePlacedBlocks: parts.prePlacedBlocks,
              remainingBlocks: parts.remainingBlocks,
              difficulty: difficulty,
              solvedBoard: puzzle.solvedBoard,
              allCombinations: combos,
              currentComboIndex: newIdx,
            };
            callbacks.onSwitchPuzzle(newPuzzle);
          }
```

- [ ] **Step 7: Add mode toggle touch handler**

Add in `onTouchEnd`, before the control buttons loop (before the `for (var ci = 0; ...)` line around 470):

```js
    // Mode toggle
    if (L.modeToggle && R.hitTest(x, y, L.modeToggle)) {
      switchMode = switchMode === 'random' ? 'manual' : 'random';
      scene.dirty = true;
      return;
    }
```

- [ ] **Step 8: Verify in WeChat Developer Tools**

Open game, verify:
- Mode toggle switches between 随机/手动
- 换题 button shows total count
- Random mode switches puzzle on tap
- Solution count appears in header
- 返回 button still works

- [ ] **Step 9: Commit**

```bash
git add minigame/js/gameScene.js
git commit -m "feat: redesign control bar with mode toggle, switch button, and solution count"
```

---

### Task 5: Add thumbnail selection panel for manual mode

**Files:**
- Modify: `minigame/js/gameScene.js` (layout, render, touch handler sections)

- [ ] **Step 1: Add panel layout computation**

Add in `computeLayout`, after the hint popup section (after line 217), inside the `if (selectPanelOpen)` guard:

```js
    // Select panel popup
    if (selectPanelOpen) {
      var spW = W * 0.9, spH = H * 0.75;
      L.selectPanel = { x: (W - spW) / 2, y: (H - spH) / 2, w: spW, h: spH };
      L.selectCloseBtn = { x: L.selectPanel.x + (spW - 80) / 2, y: L.selectPanel.y + spH - 45, w: 80, h: 30 };

      // Thumbnail grid
      var combos = puzzle.allCombinations;
      var thumbCS = 6; // cell size for thumbnail
      var thumbW = thumbCS * 7 + 8; // 7 cols + padding
      var thumbH = thumbCS * 8 + 20; // 8 rows + label
      var thumbGap = 8;
      var cols = Math.floor((spW - 30) / (thumbW + thumbGap));
      if (cols < 1) cols = 1;

      L.selectItems = [];
      var sx = L.selectPanel.x + 15, sy = L.selectPanel.y + 45;
      var col = 0;
      for (var si = 0; si < combos.length; si++) {
        var ix = sx + col * (thumbW + thumbGap);
        var iy = sy + Math.floor(si / cols) * (thumbH + thumbGap);
        L.selectItems.push({ x: ix, y: iy, w: thumbW, h: thumbH, comboIndex: si });
        col = (col + 1) % cols;
      }

      // Scroll support: total content height
      L.selectContentH = Math.ceil(combos.length / cols) * (thumbH + thumbGap);
      L.selectVisibleH = spH - 90; // title + close button space
    }
```

- [ ] **Step 2: Add scroll state variable**

Add to the state variables section (near the top, after `var selectPanelOpen`):

```js
  var selectScrollY = 0;
```

- [ ] **Step 3: Add panel rendering**

Add in `scene.render`, after the hint popup rendering section (after the `if (hintMode)` block):

```js
    // Select panel popup
    if (selectPanelOpen && L.selectPanel) {
      R.overlay(ctx, W, H);
      var sp = L.selectPanel;
      R.roundRect(ctx, sp.x, sp.y, sp.w, sp.h, 16, '#fff');
      var totalCombos2 = puzzle.allCombinations.length;
      R.textBold(ctx, '\u9009\u62E9\u9898\u76EE (\u5171 ' + totalCombos2 + ' \u9898)', sp.x + sp.w / 2, sp.y + 18, 16, '#333', 'center');

      // Clip to visible area
      ctx.save();
      ctx.beginPath();
      ctx.rect(sp.x, sp.y + 40, sp.w, L.selectVisibleH);
      ctx.clip();

      var combos2 = puzzle.allCombinations;
      var sb = puzzle.solvedBoard;
      var tCS = 6;
      for (var si2 = 0; si2 < L.selectItems.length; si2++) {
        var item = L.selectItems[si2];
        var iy2 = item.y - selectScrollY;
        if (iy2 + item.h < sp.y + 40 || iy2 > sp.y + 40 + L.selectVisibleH) continue;

        var isCurrent = item.comboIndex === puzzle.currentComboIndex;
        var borderColor = isCurrent ? '#4CAF50' : '#ddd';
        var bgColor = isCurrent ? '#E8F5E9' : '#fafafa';
        R.roundRect(ctx, item.x, iy2, item.w, item.h, 4, bgColor, borderColor);
        if (isCurrent) {
          ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 2;
          ctx.strokeRect(item.x, iy2, item.w, item.h);
        }

        // Draw mini board
        var combo = combos2[item.comboIndex];
        var bx0 = item.x + 4, by0 = iy2 + 2;
        for (var ty = 0; ty < 8; ty++) {
          for (var tx = 0; tx < 7; tx++) {
            var ch = sb[ty][tx];
            var px2 = bx0 + tx * tCS, py2 = by0 + ty * tCS;
            if (ch === '#' || ch === '*') {
              ctx.fillStyle = ch === '*' ? '#F0E68C' : '#eee';
            } else if (combo.indexOf(ch) >= 0) {
              ctx.fillStyle = '#fff'; // dug area = white
            } else {
              // Find color for this block
              var bc = '#ccc';
              for (var bi = 0; bi < initialBlockTypes.length; bi++) {
                if (initialBlockTypes[bi].label === ch) { bc = initialBlockTypes[bi].color; break; }
              }
              ctx.fillStyle = bc;
              ctx.globalAlpha = 0.6;
            }
            ctx.fillRect(px2, py2, tCS, tCS);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 0.3;
            ctx.strokeRect(px2, py2, tCS, tCS);
          }
        }

        // Label: combo index
        R.text(ctx, '#' + (item.comboIndex + 1), item.x + item.w / 2, iy2 + item.h - 14, 9, '#999', 'center');
      }

      ctx.restore();

      // Close button
      R.button(ctx, L.selectCloseBtn.x, L.selectCloseBtn.y, L.selectCloseBtn.w, L.selectCloseBtn.h, '\u53D6\u6D88', '#eee', '#333', 6);
    }
```

Note: This requires access to `initialBlockTypes` in the render function. Add at the top of gameScene.js, after the existing requires:

```js
var initialBlockTypes = B.initialBlockTypes;
```

- [ ] **Step 4: Add panel touch handling**

Add in `onTouchEnd`, at the top of the function (before the hintMode check). Handle panel close, scroll, and thumbnail selection:

```js
    // Select panel
    if (selectPanelOpen) {
      // Close button
      if (L.selectCloseBtn && R.hitTest(x, y, L.selectCloseBtn)) {
        selectPanelOpen = false; scene.dirty = true; return;
      }
      // Click outside panel
      if (L.selectPanel && !R.hitTest(x, y, L.selectPanel)) {
        selectPanelOpen = false; scene.dirty = true; return;
      }
      // Thumbnail selection
      if (L.selectItems) {
        for (var si3 = 0; si3 < L.selectItems.length; si3++) {
          var sItem = L.selectItems[si3];
          var adjY = sItem.y - selectScrollY;
          var adjRect = { x: sItem.x, y: adjY, w: sItem.w, h: sItem.h };
          if (R.hitTest(x, y, adjRect)) {
            var newIdx2 = sItem.comboIndex;
            if (newIdx2 === puzzle.currentComboIndex) {
              selectPanelOpen = false; scene.dirty = true; return;
            }
            playedCombos[newIdx2] = true;
            var parts2 = PG.puzzleFromCombo(puzzle.solvedBoard, puzzle.allCombinations[newIdx2]);
            var newPuzzle2 = {
              prePlacedBlocks: parts2.prePlacedBlocks,
              remainingBlocks: parts2.remainingBlocks,
              difficulty: difficulty,
              solvedBoard: puzzle.solvedBoard,
              allCombinations: puzzle.allCombinations,
              currentComboIndex: newIdx2,
            };
            selectPanelOpen = false;
            callbacks.onSwitchPuzzle(newPuzzle2);
            return;
          }
        }
      }
      return;
    }
```

- [ ] **Step 5: Add scroll support for panel**

Add in `onTouchMove`, before the existing drag check. Use touch move delta to scroll the panel:

```js
    // Panel scroll
    if (selectPanelOpen && L.selectPanel) {
      if (!dragging) {
        var scrollDelta = dragStart.y - y;
        selectScrollY = Math.max(0, Math.min(selectScrollY + scrollDelta * 0.5, Math.max(0, L.selectContentH - L.selectVisibleH)));
        dragStart = { x: x, y: y };
        scene.dirty = true;
        return;
      }
    }
```

Also in `onTouchStart`, add panel scroll tracking:

```js
    if (selectPanelOpen) {
      dragStart = { x: x, y: y };
      return;
    }
```

Add this at the beginning of `onTouchStart`, before the hintMode check.

- [ ] **Step 6: Verify in WeChat Developer Tools**

Open game, verify:
- Switch to manual mode, tap 换题 -> panel appears
- Thumbnails show mini boards with colored blocks and white dug areas
- Current puzzle has green border
- Tapping a thumbnail switches puzzle
- Cancel button and outside-click close the panel
- Scrolling works if many combinations

- [ ] **Step 7: Commit**

```bash
git add minigame/js/gameScene.js
git commit -m "feat: add thumbnail selection panel for manual puzzle switching"
```

---

### Task 6: Final integration verification

**Files:** None (testing only)

- [ ] **Step 1: Test easy difficulty (3 blocks, fewer combos)**

Open game -> select 黑铁 -> verify:
- 换题 button shows correct combo count
- Random switching works
- Manual panel shows all thumbnails
- Solution count appears after brief delay

- [ ] **Step 2: Test expert difficulty (9 blocks, many combos)**

Open game -> select 钻石 -> verify:
- Combo enumeration completes (may take a moment during initial generation)
- Solution count computation completes (may take longer)
- Panel scrolling works with many thumbnails

- [ ] **Step 3: Test edge cases**

- Switch multiple times in random mode, verify "all played" resets
- Switch to manual, select current puzzle (should just close panel)
- Verify hint system still works after switching puzzles
- Verify timer resets on puzzle switch

- [ ] **Step 4: Final commit**

If any fixes were needed, commit them:

```bash
git add minigame/js/
git commit -m "fix: polish puzzle switching integration"
```
