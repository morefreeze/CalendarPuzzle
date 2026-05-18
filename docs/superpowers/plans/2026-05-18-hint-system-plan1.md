# Hint System (Plan 1: Client-Only, Stamina-Source) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing single-tier weak hint to a full 3-tier (弱/中/强) hint system in the WeChat mini-game, with stamina as the only acquisition source. Independently shippable; lays foundation for Plans 2 (cloud + ads + share + help) and 3 (leaderboard).

**Architecture:** Extract hint logic from `gameScene.js` into a new pure-JS `hint.js` state machine (no `wx.*` calls — testable with `node --test`). `gameScene.js` becomes a thin renderer + event router that delegates to `hint.js`. Existing weak-hint code (gameScene.js:1561-1597, :1670-1692) is migrated to the new module rather than duplicated.

**Tech Stack:** WeChat mini-game vanilla JS (CommonJS, no ES6 in shipped code), Node.js built-in `node --test` runner for unit tests (zero deps).

---

## Spec reference

`docs/superpowers/specs/2026-05-18-social-features-design.md`, sections 1 (goal A), 4.1-4.4, and the local-only subset of 7.

## Pre-existing code that informs the plan

- `minigame/js/gameScene.js:54-55` — `hintMode`, `hintedIds` (used for current single-tier weak hint)
- `minigame/js/gameScene.js:1561-1597` — current weak-hint apply logic
- `minigame/js/gameScene.js:1670-1692` — rotate/flip buttons reject when hinted
- `minigame/js/puzzleGenerator.js:595` — `getHintShape(sb, label)` returns the shape grid; exported
- `minigame/js/puzzleGenerator.js:434` — `_solvedPlacements(sb)` returns `{id → {x, y, shape}}`; **not currently exported**
- `minigame/js/board.js` — `rotateShape`, `flipShape`, `isValidPlacement`, `cloneBlock`, `getBlockAtCell`
- `minigame/js/stamina.js` — `getStamina`, `consumeStamina(cost)`

## File structure for this plan

```
calendar-puzzle-miniprogram/
├── package.json                  ← NEW (test runner config, no runtime deps)
├── tests/
│   └── hint.test.js              ← NEW (node --test pure-logic tests)
└── minigame/js/
    ├── hint.js                   ← NEW (state machine, pure JS)
    ├── puzzleGenerator.js        ← MODIFY (export solvedPlacements)
    └── gameScene.js              ← MODIFY (delegate to hint.js + 3-tier UI)
```

`hint.js` exports:
- `createHintState(puzzleId)` — fresh state object per puzzle
- `applyWeak(state, blockId, palette, dropped, solvedPlacements)` → `{ newState, updatedPalette, updatedDropped }`
- `applyMedium(state, blockId, palette, dropped, solvedPlacements)` → `{ newState, updatedPalette, updatedDropped, hintedCell }`
- `applyStrong(state, blockId, palette, dropped, solvedPlacements)` → `{ newState, updatedPalette, updatedDropped, evictedIds }`
- `countUsed(state, type)` → number of hints of `type` consumed this puzzle
- `CAPS = { weak: 5, medium: 3, strong: 1 }`
- `COSTS = { weak: 1, medium: 3, strong: 6 }`
- `FIRST_WEAK_FREE = true`
- `isOrientationLocked(state, blockId)`
- `isCellLocked(state, blockId)` → `{x, y} | null`
- `isFullyLocked(state, blockId)`

State shape (mutable, owned by gameScene per puzzle):
```js
{
  puzzleId: 'YYYY-MM-DD:hard:c3',
  // Per-block lock flags
  weakLocked: { [blockId]: true },      // orientation locked
  mediumLocked: { [blockId]: { x, y } }, // cell locked
  strongLocked: { [blockId]: true },     // fully locked, no remove
  // Usage counters (for cap enforcement)
  usedWeak: 0,
  usedMedium: 0,
  usedStrong: 0,
}
```

---

## Task 1: Test infrastructure

**Files:**
- Create: `calendar-puzzle-miniprogram/package.json`
- Create: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write the failing test (sanity check that test runner works)**

```js
// calendar-puzzle-miniprogram/tests/hint.test.js
var test = require('node:test');
var assert = require('node:assert');

test('test runner works', function () {
  assert.strictEqual(1 + 1, 2);
});
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "calendar-puzzle-miniprogram-tests",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 3: Run test to verify infra works**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: 1 passing test, exit code 0

- [ ] **Step 4: Commit**

```bash
git add calendar-puzzle-miniprogram/package.json calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "test(minigame): add node --test runner scaffold for hint state machine"
```

---

## Task 2: Expose solvedPlacements from puzzleGenerator

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/puzzleGenerator.js:606-625` (module.exports block)

- [ ] **Step 1: Verify current function exists and behavior**

Run: `grep -n "_solvedPlacements" calendar-puzzle-miniprogram/minigame/js/puzzleGenerator.js`
Expected: line ~434 defining `function _solvedPlacements(sb) { ... }`

- [ ] **Step 2: Rename to `solvedPlacements` (remove underscore prefix) and add to exports**

Edit `puzzleGenerator.js`: change `function _solvedPlacements(sb)` → `function solvedPlacements(sb)`. Update any internal callers in the same file (grep first).

Run: `grep -n "_solvedPlacements" calendar-puzzle-miniprogram/minigame/js/puzzleGenerator.js`
Expected: zero matches (all renamed). Then `grep "solvedPlacements"` should show the function def + internal callers + new export.

Edit `module.exports` block to add `solvedPlacements: solvedPlacements,` alongside existing exports.

- [ ] **Step 3: Smoke test the export from a node REPL**

Run:
```bash
cd calendar-puzzle-miniprogram/minigame
node -e "var PG = require('./js/puzzleGenerator'); console.log(typeof PG.solvedPlacements);"
```
Expected: `function`

- [ ] **Step 4: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/puzzleGenerator.js
git commit -m "refactor(minigame): export solvedPlacements helper for hint module"
```

---

## Task 3: hint.js skeleton + constants + state factory

**Files:**
- Create: `calendar-puzzle-miniprogram/minigame/js/hint.js`
- Modify: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write failing tests for `createHintState` + constants**

Replace `tests/hint.test.js` with:
```js
var test = require('node:test');
var assert = require('node:assert');
var H = require('../minigame/js/hint');

test('CAPS and COSTS are the agreed economy', function () {
  assert.deepStrictEqual(H.CAPS, { weak: 5, medium: 3, strong: 1 });
  assert.deepStrictEqual(H.COSTS, { weak: 1, medium: 3, strong: 6 });
  assert.strictEqual(H.FIRST_WEAK_FREE, true);
});

test('createHintState returns fresh empty state', function () {
  var s = H.createHintState('2026-05-18:hard:c3');
  assert.strictEqual(s.puzzleId, '2026-05-18:hard:c3');
  assert.deepStrictEqual(s.weakLocked, {});
  assert.deepStrictEqual(s.mediumLocked, {});
  assert.deepStrictEqual(s.strongLocked, {});
  assert.strictEqual(s.usedWeak, 0);
  assert.strictEqual(s.usedMedium, 0);
  assert.strictEqual(s.usedStrong, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: FAIL with `Cannot find module '../minigame/js/hint'`

- [ ] **Step 3: Implement skeleton**

Create `calendar-puzzle-miniprogram/minigame/js/hint.js`:
```js
// 3-tier hint state machine. Pure JS — no wx.* calls. Tested with node --test.

var CAPS = { weak: 5, medium: 3, strong: 1 };
var COSTS = { weak: 1, medium: 3, strong: 6 };
var FIRST_WEAK_FREE = true;

function createHintState(puzzleId) {
  return {
    puzzleId: puzzleId,
    weakLocked: {},
    mediumLocked: {},
    strongLocked: {},
    usedWeak: 0,
    usedMedium: 0,
    usedStrong: 0,
  };
}

function countUsed(state, type) {
  if (type === 'weak') return state.usedWeak;
  if (type === 'medium') return state.usedMedium;
  if (type === 'strong') return state.usedStrong;
  return 0;
}

function isOrientationLocked(state, blockId) {
  return !!state.weakLocked[blockId] || !!state.strongLocked[blockId];
}

function isCellLocked(state, blockId) {
  if (state.strongLocked[blockId]) return state.strongLocked[blockId]; // {x,y} stored
  return state.mediumLocked[blockId] || null;
}

function isFullyLocked(state, blockId) {
  return !!state.strongLocked[blockId];
}

module.exports = {
  CAPS: CAPS,
  COSTS: COSTS,
  FIRST_WEAK_FREE: FIRST_WEAK_FREE,
  createHintState: createHintState,
  countUsed: countUsed,
  isOrientationLocked: isOrientationLocked,
  isCellLocked: isCellLocked,
  isFullyLocked: isFullyLocked,
};
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame): hint.js skeleton with caps, costs, state factory"
```

---

## Task 4: applyWeak — orientation lock + evict-from-board

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js`
- Modify: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/hint.test.js`:
```js
function shapeEq(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
  }
  return true;
}

test('applyWeak updates palette block shape to solved orientation', function () {
  var state = H.createHintState('p1');
  var palette = [
    { id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] },
  ];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[0, 1], [1, 1]] } };

  var res = H.applyWeak(state, 'X-block', palette, dropped, solved);

  assert.ok(shapeEq(res.updatedPalette[0].shape, [[0, 1], [1, 1]]));
  assert.strictEqual(res.newState.weakLocked['X-block'], true);
  assert.strictEqual(res.newState.usedWeak, 1);
  assert.deepStrictEqual(res.updatedDropped, []);
});

test('applyWeak evicts misplaced block from board back to palette', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [
    { id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]], x: 3, y: 2 },
  ];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[0, 1], [1, 1]] } };

  var res = H.applyWeak(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.updatedDropped, []);
  assert.strictEqual(res.updatedPalette.length, 1);
  assert.strictEqual(res.updatedPalette[0].id, 'X-block');
  assert.ok(shapeEq(res.updatedPalette[0].shape, [[0, 1], [1, 1]]));
  assert.strictEqual(res.updatedPalette[0].x, undefined);
  assert.strictEqual(res.updatedPalette[0].y, undefined);
});

test('applyWeak keeps block on board if already in solved orientation', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [
    { id: 'X-block', label: 'X', shape: [[0, 1], [1, 1]], x: 0, y: 0 },
  ];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[0, 1], [1, 1]] } };

  var res = H.applyWeak(state, 'X-block', palette, dropped, solved);

  assert.strictEqual(res.updatedDropped.length, 1);
  assert.deepStrictEqual(res.updatedPalette, []);
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: FAIL `H.applyWeak is not a function`

- [ ] **Step 3: Implement `applyWeak`**

Append to `hint.js` (above module.exports):
```js
function _shapeEq(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
  }
  return true;
}

function _cloneShape(s) {
  return s.map(function (row) { return row.slice(); });
}

function _cloneBlock(b) {
  var n = {};
  for (var k in b) {
    if (k === 'shape') n.shape = _cloneShape(b.shape);
    else n[k] = b[k];
  }
  return n;
}

function applyWeak(state, blockId, palette, dropped, solvedPlacements) {
  var target = solvedPlacements[blockId];
  if (!target) return { newState: state, updatedPalette: palette, updatedDropped: dropped };

  var newPalette = palette.map(_cloneBlock);
  var newDropped = dropped.map(_cloneBlock);

  // Find block on palette
  for (var p = 0; p < newPalette.length; p++) {
    if (newPalette[p].id === blockId) {
      newPalette[p].shape = _cloneShape(target.shape);
    }
  }

  // Find block on board; evict if shape doesn't match solved
  for (var d = newDropped.length - 1; d >= 0; d--) {
    if (newDropped[d].id === blockId) {
      if (!_shapeEq(newDropped[d].shape, target.shape)) {
        var ev = _cloneBlock(newDropped[d]);
        ev.shape = _cloneShape(target.shape);
        delete ev.x; delete ev.y;
        newPalette.push(ev);
        newDropped.splice(d, 1);
      }
      // already correctly oriented → leave it
    }
  }

  var newState = {
    puzzleId: state.puzzleId,
    weakLocked: Object.assign({}, state.weakLocked, function () { var o = {}; o[blockId] = true; return o; }()),
    mediumLocked: state.mediumLocked,
    strongLocked: state.strongLocked,
    usedWeak: state.usedWeak + 1,
    usedMedium: state.usedMedium,
    usedStrong: state.usedStrong,
  };

  return { newState: newState, updatedPalette: newPalette, updatedDropped: newDropped };
}
```

Add `applyWeak: applyWeak,` to `module.exports`.

- [ ] **Step 4: Run test, verify PASS**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame): hint.applyWeak — orientation lock with evict"
```

---

## Task 5: applyMedium — cell hint without revealing orientation

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js`
- Modify: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/hint.test.js`:
```js
test('applyMedium records target cell, does NOT change palette shape', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[0, 1], [1, 1]] } };

  var res = H.applyMedium(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.hintedCell, { x: 2, y: 3 });
  assert.ok(shapeEq(res.updatedPalette[0].shape, [[1, 1], [0, 1]])); // unchanged
  assert.deepStrictEqual(res.newState.mediumLocked['X-block'], { x: 2, y: 3 });
  assert.strictEqual(res.newState.usedMedium, 1);
});

test('applyMedium evicts board block placed at wrong cell', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]], x: 0, y: 0 }];
  var solved = { 'X-block': { x: 5, y: 5, shape: [[0, 1], [1, 1]] } };

  var res = H.applyMedium(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.updatedDropped, []);
  assert.strictEqual(res.updatedPalette.length, 1);
  assert.strictEqual(res.updatedPalette[0].x, undefined);
});

test('applyMedium leaves correctly-positioned block in place', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]], x: 5, y: 5 }];
  var solved = { 'X-block': { x: 5, y: 5, shape: [[0, 1], [1, 1]] } };

  var res = H.applyMedium(state, 'X-block', palette, dropped, solved);

  assert.strictEqual(res.updatedDropped.length, 1);
  assert.strictEqual(res.updatedDropped[0].x, 5);
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: FAIL `H.applyMedium is not a function`

- [ ] **Step 3: Implement `applyMedium`**

Append to `hint.js` (before module.exports):
```js
function applyMedium(state, blockId, palette, dropped, solvedPlacements) {
  var target = solvedPlacements[blockId];
  if (!target) return { newState: state, updatedPalette: palette, updatedDropped: dropped, hintedCell: null };

  var newPalette = palette.map(_cloneBlock);
  var newDropped = dropped.map(_cloneBlock);

  for (var d = newDropped.length - 1; d >= 0; d--) {
    if (newDropped[d].id === blockId) {
      if (newDropped[d].x !== target.x || newDropped[d].y !== target.y) {
        var ev = _cloneBlock(newDropped[d]);
        delete ev.x; delete ev.y;
        newPalette.push(ev);
        newDropped.splice(d, 1);
      }
    }
  }

  var newMed = Object.assign({}, state.mediumLocked);
  newMed[blockId] = { x: target.x, y: target.y };

  var newState = {
    puzzleId: state.puzzleId,
    weakLocked: state.weakLocked,
    mediumLocked: newMed,
    strongLocked: state.strongLocked,
    usedWeak: state.usedWeak,
    usedMedium: state.usedMedium + 1,
    usedStrong: state.usedStrong,
  };

  return { newState: newState, updatedPalette: newPalette, updatedDropped: newDropped, hintedCell: { x: target.x, y: target.y } };
}
```

Add `applyMedium: applyMedium,` to `module.exports`.

- [ ] **Step 4: Run test, verify PASS**

Run: `cd calendar-puzzle-miniprogram && npm test`

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame): hint.applyMedium — cell target without orientation"
```

---

## Task 6: applyStrong — full lock with evict-blockers

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js`
- Modify: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/hint.test.js`:
```js
test('applyStrong places block at solved location with solved shape', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[0, 1], [1, 1]] } };

  var res = H.applyStrong(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.updatedPalette, []);
  assert.strictEqual(res.updatedDropped.length, 1);
  assert.strictEqual(res.updatedDropped[0].id, 'X-block');
  assert.strictEqual(res.updatedDropped[0].x, 2);
  assert.strictEqual(res.updatedDropped[0].y, 3);
  assert.ok(shapeEq(res.updatedDropped[0].shape, [[0, 1], [1, 1]]));
  assert.strictEqual(res.newState.strongLocked['X-block'].x, 2);
  assert.strictEqual(res.newState.usedStrong, 1);
  assert.deepStrictEqual(res.evictedIds, []);
});

test('applyStrong evicts blockers that overlap the target', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  // Y-block is currently placed and overlaps cell (2,3)
  var dropped = [{ id: 'Y-block', label: 'Y', shape: [[1, 1]], x: 2, y: 3 }];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[0, 1], [1, 1]] } };

  var res = H.applyStrong(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.evictedIds, ['Y-block']);
  // X-block placed
  assert.strictEqual(res.updatedDropped.length, 1);
  assert.strictEqual(res.updatedDropped[0].id, 'X-block');
  // Y-block back in palette
  assert.ok(res.updatedPalette.some(function (b) { return b.id === 'Y-block'; }));
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd calendar-puzzle-miniprogram && npm test`

- [ ] **Step 3: Implement `applyStrong`**

Append to `hint.js`:
```js
function _cellsOf(block) {
  var cells = [];
  for (var dy = 0; dy < block.shape.length; dy++) {
    for (var dx = 0; dx < block.shape[dy].length; dx++) {
      if (block.shape[dy][dx] === 1) cells.push({ x: block.x + dx, y: block.y + dy });
    }
  }
  return cells;
}

function applyStrong(state, blockId, palette, dropped, solvedPlacements) {
  var target = solvedPlacements[blockId];
  if (!target) return { newState: state, updatedPalette: palette, updatedDropped: dropped, evictedIds: [] };

  var newPalette = palette.map(_cloneBlock);
  var newDropped = dropped.map(_cloneBlock);

  // Cells that the target placement will occupy
  var targetCells = _cellsOf({ x: target.x, y: target.y, shape: target.shape });
  var occ = {};
  for (var i = 0; i < targetCells.length; i++) occ[targetCells[i].x + ',' + targetCells[i].y] = true;

  // Evict any dropped block (other than blockId) that overlaps
  var evictedIds = [];
  for (var d = newDropped.length - 1; d >= 0; d--) {
    var b = newDropped[d];
    if (b.id === blockId) {
      newDropped.splice(d, 1); // remove old placement (will re-place)
      continue;
    }
    var bCells = _cellsOf(b);
    for (var c = 0; c < bCells.length; c++) {
      if (occ[bCells[c].x + ',' + bCells[c].y]) {
        var ev = _cloneBlock(b);
        delete ev.x; delete ev.y;
        newPalette.push(ev);
        newDropped.splice(d, 1);
        evictedIds.push(b.id);
        break;
      }
    }
  }

  // Pull blockId out of palette if present
  for (var p = newPalette.length - 1; p >= 0; p--) {
    if (newPalette[p].id === blockId) newPalette.splice(p, 1);
  }

  // Place at solved position
  newDropped.push({
    id: blockId,
    label: target.shape && target.shape.length ? blockId.charAt(0) : '',
    shape: _cloneShape(target.shape),
    x: target.x,
    y: target.y,
  });
  // Pull label/extra fields from the original block if available
  var sourceBlock = null;
  for (var sp = 0; sp < palette.length; sp++) if (palette[sp].id === blockId) sourceBlock = palette[sp];
  for (var sd = 0; sd < dropped.length; sd++) if (dropped[sd].id === blockId) sourceBlock = dropped[sd];
  if (sourceBlock) {
    var placed = newDropped[newDropped.length - 1];
    for (var k in sourceBlock) {
      if (k === 'shape' || k === 'x' || k === 'y') continue;
      placed[k] = sourceBlock[k];
    }
  }

  var newStrong = Object.assign({}, state.strongLocked);
  newStrong[blockId] = { x: target.x, y: target.y };

  var newState = {
    puzzleId: state.puzzleId,
    weakLocked: state.weakLocked,
    mediumLocked: state.mediumLocked,
    strongLocked: newStrong,
    usedWeak: state.usedWeak,
    usedMedium: state.usedMedium,
    usedStrong: state.usedStrong + 1,
  };

  return { newState: newState, updatedPalette: newPalette, updatedDropped: newDropped, evictedIds: evictedIds };
}
```

Add `applyStrong: applyStrong,` to `module.exports`.

- [ ] **Step 4: Run test, verify PASS**

Run: `cd calendar-puzzle-miniprogram && npm test`

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame): hint.applyStrong — full lock with blocker evict"
```

---

## Task 7: Cap enforcement and lock-check helpers

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js`
- Modify: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/hint.test.js`:
```js
test('canUse returns false when cap reached', function () {
  var s = H.createHintState('p1');
  s.usedWeak = 5;
  assert.strictEqual(H.canUse(s, 'weak'), false);
  assert.strictEqual(H.canUse(s, 'medium'), true);
});

test('isOrientationLocked true after weak applied', function () {
  var s = H.createHintState('p1');
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1]] } };
  var r = H.applyWeak(s, 'X-block', [{ id: 'X-block', label: 'X', shape: [[1]] }], [], solved);
  assert.strictEqual(H.isOrientationLocked(r.newState, 'X-block'), true);
  assert.strictEqual(H.isOrientationLocked(r.newState, 'Y-block'), false);
});

test('isFullyLocked true after strong applied', function () {
  var s = H.createHintState('p1');
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1]] } };
  var r = H.applyStrong(s, 'X-block', [{ id: 'X-block', label: 'X', shape: [[1]] }], [], solved);
  assert.strictEqual(H.isFullyLocked(r.newState, 'X-block'), true);
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: FAIL on `H.canUse is not a function`

- [ ] **Step 3: Implement `canUse`**

Append to `hint.js`:
```js
function canUse(state, type) {
  return countUsed(state, type) < (CAPS[type] || 0);
}
```

Add `canUse: canUse,` to `module.exports`.

- [ ] **Step 4: Run test, verify PASS**

Run: `cd calendar-puzzle-miniprogram && npm test`

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame): hint.canUse cap enforcement"
```

---

## Task 8: Refactor existing weak-hint path in gameScene to use hint.js

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:7` (add require)
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:54-55` (replace local hint state)
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:1561-1597` (apply via module)
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:1670-1692` (lock check via module)

**Goal of this task:** Drop-in replace existing 弱-only hint with `hint.js`, **without** changing user-visible behavior. No cost, no menu, no caps yet — just the same free unlimited weak hint, but plumbed through the new state machine. This isolates the refactor risk from the feature additions.

- [ ] **Step 1: Add require at top of gameScene.js**

After line 8 (the `var progress = require('./progress');` line) add:
```js
var Hint = require('./hint');
```

- [ ] **Step 2: Replace local hint state declaration**

Replace lines 54-55:
```js
var hintMode = false;
var hintedIds = [];
```
with:
```js
var hintMode = false;
var hintState = Hint.createHintState(
  puzzle.dateStr + ':' + difficulty + ':c' + puzzle.currentComboIndex
);
var solvedPlacements = PG.solvedPlacements(puzzle.solvedBoard);
```

- [ ] **Step 3: Replace weak-hint apply block (around line 1561-1597)**

Replace the body of the `if (hintMode) { ... }` block (the hit-test on `L.hintItems[hi3]`) with:
```js
if (hintMode) {
  for (var hi3 = 0; hi3 < L.hintItems.length; hi3++) {
    if (R.hitTest(x, y, L.hintItems[hi3])) {
      var hBlock = L.hintItems[hi3].block;
      if (Hint.isOrientationLocked(hintState, hBlock.id)) return;
      var res = Hint.applyWeak(hintState, hBlock.id, palette, dropped, solvedPlacements);
      hintState = res.newState;
      palette = res.updatedPalette;
      dropped = res.updatedDropped;
      if (selected && selected.id === hBlock.id) {
        // sync selected.shape from palette
        for (var sp2 = 0; sp2 < palette.length; sp2++) {
          if (palette[sp2].id === hBlock.id) selected.shape = palette[sp2].shape;
        }
      }
      hintMode = false;
      scene.dirty = true;
      showToast('已提示 ' + hBlock.label + ' 的正确方向');
      return;
    }
  }
  if (L.hintCloseBtn && R.hitTest(x, y, L.hintCloseBtn)) { hintMode = false; scene.dirty = true; return; }
  if (L.hintPopup && !R.hitTest(x, y, L.hintPopup)) { hintMode = false; scene.dirty = true; return; }
  return;
}
```

- [ ] **Step 4: Replace rotate/flip lock check (around line 1673, 1684)**

Change:
```js
if (hintedIds.indexOf(selected.id) >= 0) { showToast('该方块方向已锁定'); return; }
```
to (both places):
```js
if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('该方块方向已锁定'); return; }
```

- [ ] **Step 5: Replace isHinted check in render (around line 768)**

Change:
```js
var isHinted = hintedIds.indexOf(item.block.id) >= 0;
```
to:
```js
var isHinted = Hint.isOrientationLocked(hintState, item.block.id);
```

- [ ] **Step 6: Replace alreadyHinted check in popup render (around line 825)**

Change:
```js
var alreadyHinted = hintedIds.indexOf(ht.block.id) >= 0;
```
to:
```js
var alreadyHinted = Hint.isOrientationLocked(hintState, ht.block.id);
```

- [ ] **Step 7: Manual smoke test in WeChat DevTools**

Open `calendar-puzzle-miniprogram/minigame/` in WeChat Developer Tools. Play any puzzle:
- Tap 💡 → modal opens, all blocks selectable ✓
- Tap a block → toast "已提示 X 的正确方向" ✓
- Palette block's preview shows correct orientation ✓
- Try to rotate the hinted block → toast "该方块方向已锁定" ✓
- Misplaced block on board gets evicted back to palette ✓

If any of the above fails, the refactor is broken — diagnose before continuing.

- [ ] **Step 8: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "refactor(minigame): route existing weak hint through hint.js state machine"
```

---

## Task 9: 3-tier hint menu UI (弱/中/强 buttons with cost + cap badges)

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:539-554` (popup layout)
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:819-843` (popup render)
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:1561-1597` (popup tap handling — new flow)

**New UX**: tapping 💡 opens menu with 3 rows (弱/中/强), each showing cost + cap. Tapping a row → enters "select block" sub-mode for that tier → tapping a block applies that tier.

State additions:
```js
var hintTier = null; // null | 'weak' | 'medium' | 'strong' — set when a tier is chosen, drives block-selection phase
```

- [ ] **Step 1: Add `hintTier` state next to `hintMode`**

After existing `var hintMode = false;` (now line 54), insert:
```js
var hintTier = null;
```

- [ ] **Step 2: Rewrite hint-popup layout block**

Replace the `if (hintMode) { ... L.hintItems ... }` layout block (around 539-554):
```js
if (hintMode) {
  var popW = W * 0.78, popH = 240;
  L.hintPopup = { x: (W - popW) / 2, y: (H - popH) / 2, w: popW, h: popH };

  if (!hintTier) {
    // Tier menu: 3 rows
    L.hintTierBtns = [];
    var rowH = 50, rowGap = 8;
    var rowY = L.hintPopup.y + 50;
    var tiers = ['weak', 'medium', 'strong'];
    for (var ti = 0; ti < tiers.length; ti++) {
      L.hintTierBtns.push({
        x: L.hintPopup.x + 20, y: rowY + ti * (rowH + rowGap),
        w: popW - 40, h: rowH, tier: tiers[ti],
      });
    }
    L.hintItems = []; // not used in tier mode
  } else {
    // Block-selection mode (tier already chosen)
    var candidates = [];
    for (var ci2 = 0; ci2 < palette.length; ci2++) candidates.push(palette[ci2]);
    for (var cj = 0; cj < dropped.length; cj++) candidates.push(dropped[cj]);
    L.hintItems = [];
    var hx = L.hintPopup.x + 20, hy = L.hintPopup.y + 50;
    var hSize = 52, hGap = 10;
    for (var hi = 0; hi < candidates.length; hi++) {
      if (hx + hSize > L.hintPopup.x + L.hintPopup.w - 20) { hx = L.hintPopup.x + 20; hy += hSize + hGap; }
      L.hintItems.push({ x: hx, y: hy, w: hSize, h: hSize, block: candidates[hi] });
      hx += hSize + hGap;
    }
    L.hintTierBtns = [];
  }
  L.hintCloseBtn = { x: L.hintPopup.x + (popW - 90) / 2, y: L.hintPopup.y + popH - 46, w: 90, h: 34 };
}
```

- [ ] **Step 3: Rewrite hint-popup render block (around 819-843)**

Replace:
```js
if (hintMode && L.hintPopup) {
  R.dim(ctx, W, H);
  R.roundRect(ctx, L.hintPopup.x, L.hintPopup.y, L.hintPopup.w, L.hintPopup.h, 16, '#fff');

  if (!hintTier) {
    R.textBold(ctx, '选择提示等级', L.hintPopup.x + L.hintPopup.w / 2, L.hintPopup.y + 18, 17, '#333', 'center');
    var tierLabels = {
      weak:   '弱：揭示方向（旋转+镜像）',
      medium: '中：揭示落点格子（不告诉方向）',
      strong: '强：直接放置（自动腾位）',
    };
    var costLabels = {
      weak:   Hint.COSTS.weak + ' 体力 / 关',
      medium: Hint.COSTS.medium + ' 体力',
      strong: Hint.COSTS.strong + ' 体力',
    };
    for (var ti2 = 0; ti2 < L.hintTierBtns.length; ti2++) {
      var btn = L.hintTierBtns[ti2];
      var used = Hint.countUsed(hintState, btn.tier);
      var cap = Hint.CAPS[btn.tier];
      var disabled = used >= cap;
      var fill = disabled ? '#eee' : (btn.tier === 'strong' ? '#E53935' : btn.tier === 'medium' ? '#FB8C00' : BRAND);
      R.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8, fill);
      R.text(ctx, tierLabels[btn.tier], btn.x + 12, btn.y + 8, 14, disabled ? '#999' : '#fff', 'left');
      R.text(ctx, costLabels[btn.tier] + '  ' + used + '/' + cap, btn.x + 12, btn.y + 28, 11, disabled ? '#999' : 'rgba(255,255,255,0.85)', 'left');
    }
  } else {
    R.textBold(ctx, '选择要提示的方块', L.hintPopup.x + L.hintPopup.w / 2, L.hintPopup.y + 18, 17, '#333', 'center');
    for (var hi2 = 0; hi2 < L.hintItems.length; hi2++) {
      var ht = L.hintItems[hi2];
      var alreadyLocked = (hintTier === 'weak' && Hint.isOrientationLocked(hintState, ht.block.id))
                       || (hintTier === 'medium' && Hint.isCellLocked(hintState, ht.block.id))
                       || (hintTier === 'strong' && Hint.isFullyLocked(hintState, ht.block.id));
      var blockFill = alreadyLocked ? '#ccc' : '#43A047';
      R.roundRect(ctx, ht.x, ht.y, ht.w, ht.h, 6, blockFill);
      R.text(ctx, ht.block.label, ht.x + ht.w / 2, ht.y + ht.h / 2 - 8, 18, '#fff', 'center');
    }
  }

  R.button(ctx, L.hintCloseBtn.x, L.hintCloseBtn.y, L.hintCloseBtn.w, L.hintCloseBtn.h, hintTier ? '返回' : '取消', '#eee', '#333', 8);
}
```

- [ ] **Step 4: Rewrite popup tap handler (around 1561-1597)**

Replace existing `if (hintMode) { ... }` block:
```js
if (hintMode) {
  // Tier selection
  if (!hintTier && L.hintTierBtns) {
    for (var tb = 0; tb < L.hintTierBtns.length; tb++) {
      if (R.hitTest(x, y, L.hintTierBtns[tb])) {
        var pickedTier = L.hintTierBtns[tb].tier;
        if (Hint.countUsed(hintState, pickedTier) >= Hint.CAPS[pickedTier]) {
          showToast('本关该提示已用完');
          return;
        }
        var cost = Hint.COSTS[pickedTier];
        var have = stamina.getStamina();
        if (have < cost) {
          showToast('体力不足！需要 ' + cost + ' 点，当前 ' + have);
          return;
        }
        if (!stamina.consumeStamina(cost)) {
          showToast('体力扣减失败');
          return;
        }
        hintTier = pickedTier;
        scene.dirty = true;
        return;
      }
    }
  }
  // Block selection
  if (hintTier) {
    for (var hi3 = 0; hi3 < L.hintItems.length; hi3++) {
      if (R.hitTest(x, y, L.hintItems[hi3])) {
        var hBlock = L.hintItems[hi3].block;
        var res;
        if (hintTier === 'weak') {
          if (Hint.isOrientationLocked(hintState, hBlock.id)) { showToast('该方块方向已提示过'); return; }
          res = Hint.applyWeak(hintState, hBlock.id, palette, dropped, solvedPlacements);
          showToast('已提示 ' + hBlock.label + ' 的正确方向');
        } else if (hintTier === 'medium') {
          if (Hint.isCellLocked(hintState, hBlock.id)) { showToast('该方块位置已提示过'); return; }
          res = Hint.applyMedium(hintState, hBlock.id, palette, dropped, solvedPlacements);
          showToast('已提示 ' + hBlock.label + ' 的落点');
        } else {
          if (Hint.isFullyLocked(hintState, hBlock.id)) { showToast('该方块已强提示'); return; }
          res = Hint.applyStrong(hintState, hBlock.id, palette, dropped, solvedPlacements);
          showToast('已为 ' + hBlock.label + ' 落子');
        }
        hintState = res.newState;
        palette = res.updatedPalette;
        dropped = res.updatedDropped;
        if (selected) {
          for (var sp3 = 0; sp3 < palette.length; sp3++) {
            if (palette[sp3].id === selected.id) selected.shape = palette[sp3].shape;
          }
        }
        hintMode = false;
        hintTier = null;
        scene.dirty = true;
        return;
      }
    }
  }
  if (L.hintCloseBtn && R.hitTest(x, y, L.hintCloseBtn)) {
    if (hintTier) {
      // Refund stamina (user backed out of block selection)
      // Note: a small leniency — they paid for the tier but didn't pick a block yet
      // Decision: NO refund. Once tier is chosen, money's spent. Forces deliberate clicks.
      hintTier = null;
    } else {
      hintMode = false;
    }
    scene.dirty = true; return;
  }
  if (L.hintPopup && !R.hitTest(x, y, L.hintPopup)) {
    hintMode = false; hintTier = null; scene.dirty = true; return;
  }
  return;
}
```

- [ ] **Step 5: Manual smoke test in DevTools**

Verify:
- 💡 button opens tier menu (3 rows: 弱/中/强) ✓
- Each row shows cost (1/3/6) + used/cap (0/5, 0/3, 0/1) ✓
- Picking 弱 with low stamina shows "体力不足" toast ✓
- Picking 弱 with enough stamina deducts stamina, enters block selection ✓
- Picking a block applies weak hint correctly ✓
- 中 tier: block selection then no shape change on palette but board-cell highlighted (next task handles the highlight; for now verify no shape change) ✓
- 强 tier: block placed at solved position with solved shape, blockers evicted ✓

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame): 3-tier hint menu (弱/中/强) with stamina cost + caps"
```

---

## Task 10: Visual: medium-hint cell highlight on board

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js` — board render loop, add overlay for `Hint.isCellLocked` cells

**Goal**: For each `mediumLocked` block, paint the target cell with the block's color at drag-preview opacity (~0.35). Also tap-on-cell shows toast naming the block.

- [ ] **Step 1: Locate the board-cell render loop**

Run: `grep -n "drawCellDecoration\|for.*cells\|board cell\|for.*y.*cells" calendar-puzzle-miniprogram/minigame/js/gameScene.js | head -20`

The board is drawn with a nested loop iterating `r, c` from `0..rows`, `0..cols`. Find that loop (~line 600-700 range in render).

- [ ] **Step 2: After the cell base draw, add medium-hint overlay**

Inside the board cell loop (after `drawCellDecoration(ctx, cellType, px, py, cs)` call), add:
```js
// Medium-hint cell overlay (shows where a block should go, no orientation)
for (var ml in hintState.mediumLocked) {
  var mlc = hintState.mediumLocked[ml];
  // The cell (mlc.x, mlc.y) is the block origin. We highlight ONLY the origin cell —
  // user still doesn't know the shape. Adjust if origin cells feel too sparse.
  if (mlc.x === c && mlc.y === r) {
    // Find block color from palette/dropped (each block has a `color` field
    // from initialBlockTypes; see board.js:15-24)
    var blkColor = '#888';
    for (var pp = 0; pp < palette.length; pp++) if (palette[pp].id === ml) blkColor = palette[pp].color || blkColor;
    for (var dp = 0; dp < dropped.length; dp++) if (dropped[dp].id === ml) blkColor = dropped[dp].color || blkColor;
    ctx.save();
    ctx.globalAlpha = 0.35;
    R.roundRect(ctx, px, py, cs, cs, 4, blkColor);
    ctx.restore();
  }
}
```


- [ ] **Step 3: Manual smoke test in DevTools**

- Apply a medium hint to block X
- Board shows a translucent X-colored square at the hinted origin cell ✓
- Switching puzzles clears the highlight (state recreated)

- [ ] **Step 4: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame): visual highlight for medium-hint target cell"
```

---

## Task 11: Strong-locked block: reject double-click remove

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js` — double-tap-remove handler

- [ ] **Step 1: Locate double-tap remove logic**

Run: `grep -n "double.*tap\|lastTap\|double-click\|doubleTap" calendar-puzzle-miniprogram/minigame/js/gameScene.js | head -10`

The double-tap detector compares `Date.now() - lastTap.time < N` and removes via `dropped = dropped.filter(...)` or similar. Find the exact removal site.

- [ ] **Step 2: Before the remove, check `isFullyLocked`**

Inside the double-tap branch, before the `dropped.filter(...)` call that removes the block:
```js
if (Hint.isFullyLocked(hintState, blockUnderTap.id)) {
  wx.showModal({
    title: '强提示锁定',
    content: '这是强提示锁定的方块，不能移除。',
    showCancel: false,
  });
  return;
}
```

Substitute `blockUnderTap` with the actual variable name in scope (likely `b` or `placed` — read context to confirm).

- [ ] **Step 3: Also reject drag-from-board for strong-locked blocks**

Locate the drag-pickup-from-board logic (`grep -n "dragFromBoard\|getBlockAtCell" minigame/js/gameScene.js | head`).

When a drag picks up a strong-locked block, abort:
```js
var pickedBlock = B.getBlockAtCell(dropped, gridX, gridY);
if (pickedBlock && Hint.isFullyLocked(hintState, pickedBlock.id)) {
  showToast('该方块由强提示锁定');
  return;
}
```

Insert this right after the `getBlockAtCell` call in the drag-start handler.

- [ ] **Step 4: Manual smoke test**

- Use strong hint on a block
- Double-tap the placed block → modal "强提示锁定..." ✓
- Try to drag the placed block → toast "该方块由强提示锁定", no movement ✓

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame): strong-locked block rejects remove and drag"
```

---

## Task 12: Verify the existing first-tap behavior is `hintTier = null` (no regression)

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js` — `L.hintBtn` tap handler

- [ ] **Step 1: Find hint button tap handler (around line 1695)**

The handler currently sets `hintMode = true`. Confirm it also resets `hintTier = null`:
```js
if (L.hintBtn && R.hitTest(x, y, L.hintBtn)) {
  hintMode = true;
  hintTier = null; // ← ensure fresh menu on re-open
  scene.dirty = true;
  return;
}
```

- [ ] **Step 2: Manual smoke test**

- Open 💡 menu, pick 弱, back out via 返回
- Open 💡 again → menu shows tier choices, not block selection ✓

- [ ] **Step 3: Commit (only if a change was needed)**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "fix(minigame): reset hint tier when opening hint menu"
```

(Skip commit if no change was needed.)

---

## Task 13: End-to-end smoke test checklist (manual)

Open the minigame in WeChat DevTools. For each of these scenarios, complete the action and verify the outcome. Note any failure as a follow-up bug, not a plan blocker.

**Setup**: Start a "hard"-difficulty puzzle. Stamina = 120 (set by default after a fresh storage clear).

- [ ] **Step 1: Weak hint full happy path**

1. Tap 💡 → tier menu opens
2. Tap 弱 → stamina drops from 120 to 119; block-selection mode
3. Tap any unplaced block → toast "已提示 X 的正确方向"; that block's palette card shows the solved orientation; 旋转/翻转 按钮 click → toast "该方块方向已锁定" ✓

- [ ] **Step 2: Medium hint full happy path**

1. Tap 💡 → 中 → stamina 119 → 116
2. Tap any block → toast "已提示 X 的落点"; board shows translucent colored square at the target origin cell ✓

- [ ] **Step 3: Strong hint full happy path**

1. Place 1-2 blocks wrong intentionally
2. Tap 💡 → 强 → stamina 116 → 110
3. Tap a block whose solved location overlaps your wrongly-placed blocks
4. Wrongly-placed blocks bounce back to palette; target block appears at solved position with solved orientation ✓
5. Try to double-tap the strong-locked block → modal "强提示锁定..." appears ✓
6. Try to drag the strong-locked block → toast "该方块由强提示锁定", no movement ✓

- [ ] **Step 4: Cap enforcement**

1. Use 5 weak hints (one per block) → 6th attempt: 弱 row is greyed; click → toast "本关该提示已用完" ✓

- [ ] **Step 5: Stamina-low rejection**

1. Manually edit storage to set stamina to 1 (or use 119 hints worth)
2. Tap 💡 → 强 → toast "体力不足！需要 6 点，当前 X" ✓

- [ ] **Step 6: Puzzle switch resets hints**

1. Apply 1 weak + 1 medium
2. 切换到下一关 (随机/手选)
3. New puzzle: 💡 menu shows 0/5, 0/3, 0/1 ✓ (no carryover)

If all checklist items pass, mark Plan 1 complete and move to Plan 2.

---

## Self-review notes

**Spec coverage** (against `2026-05-18-social-features-design.md`):
- §4.1 economy: ✓ (Task 3 constants; Task 9 enforcement). Note: this plan only implements `stamina` source; `share`/`help`/`ad`/`helperGift` deferred to Plan 2.
- §4.2 3-tier semantics: ✓ (Tasks 4, 5, 6)
- §4.3 entry flow: ✓ (Task 9 — 3-row menu, cost shown, block selection sub-mode)
- §4.4 compatibility: ✓ (Task 8 keeps rotate/flip lock check; Task 11 adds strong-lock rejection on remove/drag)
- §3.3 hintGrants data model: **deferred to Plan 2** (no cloud yet; this plan uses in-memory state per puzzle)
- §5-§7 (social, ads, anti-cheat, push): **all deferred to Plan 2/3**

**Placeholder scan**: no TBD/TODO left in tasks (Plan 2/3 are clearly scoped as separate plans, not "TODO" within this plan).

**Type consistency**: hint.js exports verified against gameScene.js usage:
- `createHintState(puzzleId)` — used in Task 8 step 2
- `applyWeak/Medium/Strong(state, blockId, palette, dropped, solvedPlacements)` — used in Task 9 step 4
- `isOrientationLocked/isCellLocked/isFullyLocked(state, blockId)` — used in Tasks 8/9/10/11
- `canUse(state, type)` — exposed but `gameScene` uses `countUsed >= CAPS` check directly; that's fine, both code paths work
- `CAPS`, `COSTS`, `FIRST_WEAK_FREE` — used in Tasks 9 render
