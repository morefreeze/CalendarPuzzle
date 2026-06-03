# Medium-Hint Mismatch Dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pop a modal when the player drops a block that contradicts an active medium hint (wrong block on a hinted cell, OR right block at wrong location), with a one-tap take-back-and-reselect, an opt-out for the puzzle, and an explicit close that lets the next mismatch re-fire.

**Architecture:** Pure-function detection in `hint.js` (`findMediumMismatch` + `setMediumMismatchIgnored`), suppression flag piggybacking on `hintState.mediumMismatchIgnored` (round-trips through the existing `restoreHintState` path), modal UI in `gameScene.js` mirroring the `staminaConfirm` modal pattern.

**Tech Stack:** Plain JS (no TypeScript), `node --test` for hint.js tests (no harness for gameScene), WeChat mini-game Canvas API via `R` (`./render`) helpers, hint state via `Hint` (`./hint`).

**Spec:** `docs/superpowers/specs/2026-05-27-medium-hint-mismatch-dialog-design.md`

---

## File Structure

- `calendar-puzzle-miniprogram/minigame/js/hint.js` — three additive changes: one new field in `createHintState`, one new round-trip line in `restoreHintState`, two new exported functions (`findMediumMismatch`, `setMediumMismatchIgnored`). Pure functions only; no `wx.*` calls.
- `calendar-puzzle-miniprogram/minigame/js/gameScene.js` — three additive changes: two new module-scope `var`s for modal state, a detection call at the end of `placeBlock`, a render block after `staminaConfirm`, and a tap handler near the existing `slotModal` handler. No refactor of existing flow.
- `calendar-puzzle-miniprogram/tests/hint.test.js` — 8 new `test(...)` cases covering both helpers and the `restoreHintState` field round-trip.
- `calendar-puzzle-miniprogram/minigame/CHANGELOG.md` — one new `[0.6.0]` entry summarising the feature and manual-test path.

---

## Task 1: hint.js — add `mediumMismatchIgnored` field + restore round-trip

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js:7-17` (`createHintState`)
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js:65-73` (`restoreHintState` return object)
- Test: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write failing test for `createHintState` default**

Append to `calendar-puzzle-miniprogram/tests/hint.test.js`:

```js
test('createHintState initialises mediumMismatchIgnored to false', function () {
  var s = H.createHintState('p-mm-1');
  assert.strictEqual(s.mediumMismatchIgnored, false);
});
```

- [ ] **Step 2: Run the new test — verify it fails**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | grep -E "mediumMismatchIgnored|fail" | head -5`

Expected: a line like `not ok` or `Expected: false / Actual: undefined`. The field doesn't exist yet.

- [ ] **Step 3: Add the field in `createHintState`**

Edit `calendar-puzzle-miniprogram/minigame/js/hint.js`.

`old_string`:

```js
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
```

`new_string`:

```js
function createHintState(puzzleId) {
  return {
    puzzleId: puzzleId,
    weakLocked: {},
    mediumLocked: {},
    strongLocked: {},
    usedWeak: 0,
    usedMedium: 0,
    usedStrong: 0,
    mediumMismatchIgnored: false,
  };
}
```

- [ ] **Step 4: Re-run the new test — verify it passes**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | tail -10`

Expected: tests pass, no `not ok` lines.

- [ ] **Step 5: Write failing tests for `restoreHintState` round-trip**

Append to `calendar-puzzle-miniprogram/tests/hint.test.js`:

```js
test('restoreHintState defaults mediumMismatchIgnored to false when absent', function () {
  var saved = { puzzleId: 'p-mm-rt-1', weakLocked: {}, mediumLocked: {}, strongLocked: {}, usedWeak: 0, usedMedium: 0, usedStrong: 0 };
  var s = H.restoreHintState(saved, 'p-mm-rt-1');
  assert.strictEqual(s.mediumMismatchIgnored, false);
});

test('restoreHintState round-trips mediumMismatchIgnored: true', function () {
  var saved = { puzzleId: 'p-mm-rt-2', weakLocked: {}, mediumLocked: {}, strongLocked: {}, usedWeak: 0, usedMedium: 0, usedStrong: 0, mediumMismatchIgnored: true };
  var s = H.restoreHintState(saved, 'p-mm-rt-2');
  assert.strictEqual(s.mediumMismatchIgnored, true);
});
```

- [ ] **Step 6: Run — confirm only the round-trip-true test fails**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | grep "not ok" | head -5`

Expected: one failure mentioning `round-trips mediumMismatchIgnored: true` (the default-false test passes by accident because `saved.mediumMismatchIgnored === true` is `false`, which assigns nothing and the returned object lacks the field — so `s.mediumMismatchIgnored` is `undefined`, which is `!== false`. So actually BOTH may fail. Either way, at least one failure must mention `mediumMismatchIgnored`.)

If neither fails, stop and recheck — the test file probably wasn't saved.

- [ ] **Step 7: Add the round-trip line in `restoreHintState`**

Edit `calendar-puzzle-miniprogram/minigame/js/hint.js`.

`old_string`:

```js
  return {
    puzzleId: puzzleId,
    weakLocked: _cloneBoolMap(saved.weakLocked),
    mediumLocked: _cloneCellsMap(saved.mediumLocked),
    strongLocked: _cloneStrongMap(saved.strongLocked),
    usedWeak: typeof saved.usedWeak === 'number' ? saved.usedWeak : 0,
    usedMedium: typeof saved.usedMedium === 'number' ? saved.usedMedium : 0,
    usedStrong: typeof saved.usedStrong === 'number' ? saved.usedStrong : 0,
  };
}
```

`new_string`:

```js
  return {
    puzzleId: puzzleId,
    weakLocked: _cloneBoolMap(saved.weakLocked),
    mediumLocked: _cloneCellsMap(saved.mediumLocked),
    strongLocked: _cloneStrongMap(saved.strongLocked),
    usedWeak: typeof saved.usedWeak === 'number' ? saved.usedWeak : 0,
    usedMedium: typeof saved.usedMedium === 'number' ? saved.usedMedium : 0,
    usedStrong: typeof saved.usedStrong === 'number' ? saved.usedStrong : 0,
    mediumMismatchIgnored: saved.mediumMismatchIgnored === true,
  };
}
```

- [ ] **Step 8: Re-run all hint tests — confirm green**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | tail -10`

Expected: all tests pass, including the three new ones added in this task.

- [ ] **Step 9: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame/hint): mediumMismatchIgnored field + restoreHintState round-trip"
```

---

## Task 2: hint.js — `findMediumMismatch` pure function + tests

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js` — add function before `module.exports` (around line 330), add to exports
- Test: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write five failing tests covering all branches**

Append to `calendar-puzzle-miniprogram/tests/hint.test.js`:

```js
function _cellEq(a, b) { return a.x === b.x && a.y === b.y; }
function _cellsContain(set, c) { for (var i = 0; i < set.length; i++) if (_cellEq(set[i], c)) return true; return false; }
function _isSubset(sub, sup) { for (var i = 0; i < sub.length; i++) if (!_cellsContain(sup, sub[i])) return false; return true; }

test('findMediumMismatch returns null when mediumLocked is empty', function () {
  var s = H.createHintState('p-fm-1');
  var cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  assert.strictEqual(H.findMediumMismatch(s, 'A-block', cells), null);
});

test('findMediumMismatch returns null when block covers all its own hint cells', function () {
  var s = H.createHintState('p-fm-2');
  s.mediumLocked['A-block'] = [{ x: 2, y: 3 }, { x: 3, y: 3 }];
  var coversAll = [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }];
  assert.strictEqual(H.findMediumMismatch(s, 'A-block', coversAll), null);
});

test('findMediumMismatch returns right-block-wrong-loc when block misses any own hint cell', function () {
  var s = H.createHintState('p-fm-3');
  s.mediumLocked['A-block'] = [{ x: 2, y: 3 }, { x: 3, y: 3 }];
  var missesOne = [{ x: 2, y: 3 }, { x: 2, y: 4 }];
  var r = H.findMediumMismatch(s, 'A-block', missesOne);
  assert.deepStrictEqual(r, { kind: 'right-block-wrong-loc', blockId: 'A-block' });
});

test('findMediumMismatch returns wrong-block-on-hint when foreign block covers another hint cell', function () {
  var s = H.createHintState('p-fm-4');
  s.mediumLocked['A-block'] = [{ x: 2, y: 3 }];
  var foreign = [{ x: 2, y: 3 }, { x: 3, y: 3 }];
  var r = H.findMediumMismatch(s, 'B-block', foreign);
  assert.deepStrictEqual(r, { kind: 'wrong-block-on-hint', placedBlockId: 'B-block', hintedBlockId: 'A-block' });
});

test('findMediumMismatch prioritises right-block-wrong-loc over wrong-block-on-hint', function () {
  var s = H.createHintState('p-fm-5');
  s.mediumLocked['A-block'] = [{ x: 2, y: 3 }, { x: 3, y: 3 }];
  s.mediumLocked['B-block'] = [{ x: 5, y: 5 }];
  // A-block is the placed block, misses one of its own cells (3,3), AND covers B-block's (5,5)
  var weird = [{ x: 2, y: 3 }, { x: 5, y: 5 }];
  var r = H.findMediumMismatch(s, 'A-block', weird);
  assert.deepStrictEqual(r, { kind: 'right-block-wrong-loc', blockId: 'A-block' });
});
```

- [ ] **Step 2: Run — confirm all five fail**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | grep "not ok" | head -10`

Expected: at least 5 `not ok` lines, all referencing `findMediumMismatch`.

- [ ] **Step 3: Implement `findMediumMismatch`**

Edit `calendar-puzzle-miniprogram/minigame/js/hint.js`.

`old_string`:

```js
module.exports = {
  CAPS: CAPS,
```

`new_string`:

```js
// Returns the first medium-hint violation caused by placing `blockId` at the
// cells in `blockCells`. Priority: a block that has its own active medium
// hint and fails to cover all of its hint cells wins over a block (own or
// foreign) that happens to land on another block's hint cells. Pure function.
//   state: hintState
//   blockId: string — the block that was just dropped
//   blockCells: Array<{x, y}> — the cells `blockId` occupies after the drop
// Returns:
//   null — no violation
//   { kind: 'right-block-wrong-loc', blockId } — own hint not fully covered
//   { kind: 'wrong-block-on-hint', placedBlockId, hintedBlockId } — covers
//     another block's hint cell
function findMediumMismatch(state, blockId, blockCells) {
  if (!state || !state.mediumLocked) return null;
  var ownHint = state.mediumLocked[blockId];
  if (ownHint && ownHint.length > 0) {
    // Scenario B — does blockCells contain every hinted cell?
    var coversAll = true;
    for (var i = 0; i < ownHint.length; i++) {
      var hc = ownHint[i];
      var found = false;
      for (var j = 0; j < blockCells.length; j++) {
        if (blockCells[j].x === hc.x && blockCells[j].y === hc.y) { found = true; break; }
      }
      if (!found) { coversAll = false; break; }
    }
    if (!coversAll) return { kind: 'right-block-wrong-loc', blockId: blockId };
  }
  // Scenario A — does blockCells intersect any other block's mediumLocked cells?
  for (var hintedId in state.mediumLocked) {
    if (!Object.prototype.hasOwnProperty.call(state.mediumLocked, hintedId)) continue;
    if (hintedId === blockId) continue;
    var cells = state.mediumLocked[hintedId];
    if (!cells || cells.length === 0) continue;
    for (var ci = 0; ci < cells.length; ci++) {
      for (var bi = 0; bi < blockCells.length; bi++) {
        if (blockCells[bi].x === cells[ci].x && blockCells[bi].y === cells[ci].y) {
          return { kind: 'wrong-block-on-hint', placedBlockId: blockId, hintedBlockId: hintedId };
        }
      }
    }
  }
  return null;
}

module.exports = {
  CAPS: CAPS,
```

- [ ] **Step 4: Add `findMediumMismatch` to exports**

Edit `calendar-puzzle-miniprogram/minigame/js/hint.js`.

`old_string`:

```js
  isMediumExhausted: isMediumExhausted,
  applyWeak: applyWeak,
```

`new_string`:

```js
  isMediumExhausted: isMediumExhausted,
  findMediumMismatch: findMediumMismatch,
  applyWeak: applyWeak,
```

- [ ] **Step 5: Run the new five tests — confirm green**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | tail -10`

Expected: full suite passes, including the five `findMediumMismatch` tests.

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame/hint): findMediumMismatch pure-function detector"
```

---

## Task 3: hint.js — `setMediumMismatchIgnored` + immutability test

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js` — add function near `findMediumMismatch`, add to exports
- Test: `calendar-puzzle-miniprogram/tests/hint.test.js`

- [ ] **Step 1: Write failing test**

Append to `calendar-puzzle-miniprogram/tests/hint.test.js`:

```js
test('setMediumMismatchIgnored returns new state with flag true, original untouched', function () {
  var s = H.createHintState('p-set-1');
  var s2 = H.setMediumMismatchIgnored(s);
  assert.strictEqual(s2.mediumMismatchIgnored, true);
  assert.strictEqual(s.mediumMismatchIgnored, false, 'original state must not be mutated');
  assert.notStrictEqual(s2, s, 'must return a new object reference');
});
```

- [ ] **Step 2: Run — confirm it fails**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | grep "not ok" | head -3`

Expected: one `not ok` referencing `setMediumMismatchIgnored`.

- [ ] **Step 3: Add the function (place it directly below `findMediumMismatch`)**

Edit `calendar-puzzle-miniprogram/minigame/js/hint.js`.

`old_string`:

```js
  return null;
}

module.exports = {
```

`new_string`:

```js
  return null;
}

// Immutable setter for the per-puzzle "stop bugging me about medium mismatches"
// flag. Caller writes the returned state back into hintState; the field
// survives save/reload via restoreHintState.
function setMediumMismatchIgnored(state) {
  return Object.assign({}, state, { mediumMismatchIgnored: true });
}

module.exports = {
```

- [ ] **Step 4: Add to exports**

Edit `calendar-puzzle-miniprogram/minigame/js/hint.js`.

`old_string`:

```js
  findMediumMismatch: findMediumMismatch,
  applyWeak: applyWeak,
```

`new_string`:

```js
  findMediumMismatch: findMediumMismatch,
  setMediumMismatchIgnored: setMediumMismatchIgnored,
  applyWeak: applyWeak,
```

- [ ] **Step 5: Run — confirm green**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js 2>&1 | tail -10`

Expected: full suite passes.

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "feat(minigame/hint): setMediumMismatchIgnored immutable setter"
```

---

## Task 4: gameScene — modal state vars + trigger in `placeBlock`

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:118-120` (declarations region)
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:440-465` (`placeBlock` function)

- [ ] **Step 1: Add the two new module-scope state vars near `slotModal`**

Run: `sed -n '117,121p' calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected output (must match before editing):

```js
  // ---- Save-slot modal state ----
  var slotModal = null;               // null | 'save-picker' | 'overwrite-warning'
  var slotPickerSelectedIdx = 0;      // 0..2
  var slotPickerLayoutCache = null;   // cached layout for the active modal
```

Edit `calendar-puzzle-miniprogram/minigame/js/gameScene.js`.

`old_string`:

```js
  // ---- Save-slot modal state ----
  var slotModal = null;               // null | 'save-picker' | 'overwrite-warning'
  var slotPickerSelectedIdx = 0;      // 0..2
  var slotPickerLayoutCache = null;   // cached layout for the active modal
```

`new_string`:

```js
  // ---- Save-slot modal state ----
  var slotModal = null;               // null | 'save-picker' | 'overwrite-warning'
  var slotPickerSelectedIdx = 0;      // 0..2
  var slotPickerLayoutCache = null;   // cached layout for the active modal

  // ---- Medium-hint mismatch modal state ----
  // null when no dialog open. Set by placeBlock() to one of:
  //   { kind: 'right-block-wrong-loc', blockId }
  //   { kind: 'wrong-block-on-hint', placedBlockId, hintedBlockId }
  var mediumMismatchModal = null;
  var mediumMismatchLayoutCache = null;
```

- [ ] **Step 2: Confirm `placeBlock` state before editing**

Run: `sed -n '440,465p' calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected output (must match before editing):

```js
  function placeBlock(block, cx, cy, fromX, fromY) {
    var nb = B.cloneBlock(block);
    nb.x = cx; nb.y = cy;
    dropped.push(nb);
    palette = palette.filter(function (b) { return b.id !== block.id; });
    selected = null;
    // Tutorial advance: step 3 (drag a piece) clears as soon as the player
    // places anything via drag.
    if (tutorialMode && tutorialStep === 3) tutorialStep = 4;
    // Kick snap animation from the drag-release position to the target cell.
    if (fromX != null && fromY != null && L.cellSize) {
      snapAnims.push({
        id: nb.id,
        fromX: fromX, fromY: fromY,
        toX: L.boardX + cx * L.cellSize,
        toY: L.boardY + cy * L.cellSize,
        start: Date.now(),
        shape: nb.shape,
        color: nb.color,
      });
    }
    try { wx.vibrateShort && wx.vibrateShort({ type: 'medium' }); } catch (e) {}
    scene.dirty = true;
    _tempSlot.markDirty(captureState());
    checkWin();
  }
```

If output differs, STOP and reconcile line numbers before continuing.

- [ ] **Step 3: Insert the mismatch check just before `checkWin()`**

Edit `calendar-puzzle-miniprogram/minigame/js/gameScene.js`.

`old_string`:

```js
    try { wx.vibrateShort && wx.vibrateShort({ type: 'medium' }); } catch (e) {}
    scene.dirty = true;
    _tempSlot.markDirty(captureState());
    checkWin();
  }
```

`new_string`:

```js
    try { wx.vibrateShort && wx.vibrateShort({ type: 'medium' }); } catch (e) {}
    scene.dirty = true;
    _tempSlot.markDirty(captureState());
    if (!hintState.mediumMismatchIgnored) {
      var bCells = [];
      for (var sy = 0; sy < nb.shape.length; sy++) {
        for (var sx = 0; sx < nb.shape[sy].length; sx++) {
          if (nb.shape[sy][sx] === 1) bCells.push({ x: nb.x + sx, y: nb.y + sy });
        }
      }
      var mm = Hint.findMediumMismatch(hintState, nb.id, bCells);
      if (mm) {
        mediumMismatchModal = mm;
        return;
      }
    }
    checkWin();
  }
```

- [ ] **Step 4: Smoke-test that the file still parses**

Run: `node --check calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected: no output, exit code 0.

- [ ] **Step 5: Confirm hint.js tests still pass (no regression)**

Run: `cd calendar-puzzle-miniprogram && npm test 2>&1 | tail -6`

Expected: `# pass NNN`, `# fail 0`. NNN is whatever the total is now (was 220 + 8 new = 228 after Tasks 1-3 complete).

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/hint): wire findMediumMismatch into placeBlock"
```

---

## Task 5: gameScene — render the mismatch modal

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js` — add render block after the `staminaConfirm` render branch (around line 1265, the `else { L.staminaConfirmModal = null; ... }` block)

- [ ] **Step 1: Confirm anchor — the line right after the staminaConfirm reset branch**

Run: `sed -n '1259,1268p' calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected output (must match):

```js
    } else {
      L.staminaConfirmModal = null;
      L.staminaConfirmCheckbox = null;
      L.staminaConfirmConvertBtn = null;
      L.staminaConfirmNoBtn = null;
      L.staminaConfirmYesBtn = null;
    }

    // --- 获取路径 二级 menu ---
    if (sourceMenuOpen && L.sourceMenu) {
```

If different, STOP and reconcile.

- [ ] **Step 2: Insert the mismatch-modal render block**

Edit `calendar-puzzle-miniprogram/minigame/js/gameScene.js`.

`old_string`:

```js
    } else {
      L.staminaConfirmModal = null;
      L.staminaConfirmCheckbox = null;
      L.staminaConfirmConvertBtn = null;
      L.staminaConfirmNoBtn = null;
      L.staminaConfirmYesBtn = null;
    }

    // --- 获取路径 二级 menu ---
```

`new_string`:

```js
    } else {
      L.staminaConfirmModal = null;
      L.staminaConfirmCheckbox = null;
      L.staminaConfirmConvertBtn = null;
      L.staminaConfirmNoBtn = null;
      L.staminaConfirmYesBtn = null;
    }

    // --- 中提示不一致弹窗 ---
    if (mediumMismatchModal) {
      R.overlay(ctx, W, H);
      var mmW = Math.min(W * 0.78, 300), mmH = 200;
      var mmX = (W - mmW) / 2, mmY = (H - mmH) / 2;
      R.roundRect(ctx, mmX, mmY, mmW, mmH, 14, '#fff');

      // Close (×) button — top right
      var mmCloseR = 14;
      var mmCloseX = mmX + mmW - mmCloseR - 12;
      var mmCloseY = mmY + mmCloseR + 12;
      R.roundRect(ctx, mmCloseX - mmCloseR, mmCloseY - mmCloseR, mmCloseR * 2, mmCloseR * 2, mmCloseR, '#f0f0f0');
      R.textBold(ctx, '×', mmCloseX, mmCloseY, 16, '#666', 'center', 'middle');

      R.textBold(ctx, '和中提示不一致', mmX + 20, mmY + 24, 15, '#333', 'left');

      // Body — figure out which block(s) to draw + the prose around them.
      // We need block shape + color from palette OR dropped (because the
      // placed block has just been pushed into dropped).
      var mmAllBlocks = palette.concat(dropped);
      function _mmFindBlock(id) {
        for (var i = 0; i < mmAllBlocks.length; i++) if (mmAllBlocks[i].id === id) return mmAllBlocks[i];
        return null;
      }
      var mmKind = mediumMismatchModal.kind;
      var mmPlacedId = mmKind === 'right-block-wrong-loc' ? mediumMismatchModal.blockId : mediumMismatchModal.placedBlockId;
      var mmPlacedBlk = _mmFindBlock(mmPlacedId);
      var mmHintedBlk = mmKind === 'wrong-block-on-hint' ? _mmFindBlock(mediumMismatchModal.hintedBlockId) : null;

      // Draw a mini block-shape icon at (x, y), returning the width drawn.
      function _mmDrawIcon(blk, x, y) {
        if (!blk) return 0;
        var cell = 7;
        R.blockShape(ctx, blk.shape, blk.color, x, y, cell);
        return blk.shape[0].length * cell;
      }

      var bodyY = mmY + 64;
      var lineH = 22;
      if (mmKind === 'right-block-wrong-loc') {
        R.text(ctx, '你刚把', mmX + 20, bodyY, 13, '#555', 'left', 'middle');
        var afterPrefix = mmX + 20 + 38;
        var iconW = _mmDrawIcon(mmPlacedBlk, afterPrefix, bodyY - 10);
        R.text(ctx, '放到了别的位置，', afterPrefix + iconW + 6, bodyY, 13, '#555', 'left', 'middle');
        R.text(ctx, '但它的中提示还在等它。', mmX + 20, bodyY + lineH, 13, '#555', 'left', 'middle');
      } else {
        R.text(ctx, '你刚把', mmX + 20, bodyY, 13, '#555', 'left', 'middle');
        var aP = mmX + 20 + 38;
        var iw1 = _mmDrawIcon(mmPlacedBlk, aP, bodyY - 10);
        R.text(ctx, '放到了', aP + iw1 + 6, bodyY, 13, '#555', 'left', 'middle');
        var aP2 = aP + iw1 + 6 + 34;
        var iw2 = _mmDrawIcon(mmHintedBlk, aP2, bodyY - 10);
        R.text(ctx, '的中提示位置上。', aP2 + iw2 + 6, bodyY, 13, '#555', 'left', 'middle');
      }

      // Buttons
      var mmBtnW = mmW - 40;
      var mmTakeBackBtnH = 36;
      var mmTakeBackY = mmY + mmH - mmTakeBackBtnH - 36;
      R.button(ctx, mmX + 20, mmTakeBackY, mmBtnW, mmTakeBackBtnH, '取回并重新选中', '#43A047', '#fff', 8);

      var mmIgnoreH = 20;
      var mmIgnoreY = mmY + mmH - mmIgnoreH - 10;
      R.text(ctx, '本局不再提示', mmX + mmW / 2, mmIgnoreY + mmIgnoreH / 2, 12, '#999', 'center', 'middle');

      mediumMismatchLayoutCache = {
        modal: { x: mmX, y: mmY, w: mmW, h: mmH },
        closeBtn: { x: mmCloseX - mmCloseR, y: mmCloseY - mmCloseR, w: mmCloseR * 2, h: mmCloseR * 2 },
        takeBackBtn: { x: mmX + 20, y: mmTakeBackY, w: mmBtnW, h: mmTakeBackBtnH },
        ignoreBtn: { x: mmX + 20, y: mmIgnoreY, w: mmBtnW, h: mmIgnoreH + 4 },
      };
    } else {
      mediumMismatchLayoutCache = null;
    }

    // --- 获取路径 二级 menu ---
```

- [ ] **Step 3: Smoke-test parsing**

Run: `node --check calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/hint): render medium-hint mismatch modal"
```

---

## Task 6: gameScene — tap handler for the modal

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:1972-1995` (`scene.onTouchEnd` opening)

- [ ] **Step 1: Confirm the touch-end opening**

Run: `sed -n '1972,1980p' calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected output (must match):

```js
  scene.onTouchEnd = function (x, y) {
    // ── Save-slot modals: intercept ALL taps while a modal is open. ──
    if (slotModal === 'save-picker' && slotPickerLayoutCache) {
      var hit = slotUI.savePickerHitTest(x, y, slotPickerLayoutCache);
      if (hit === 'cancel') {
        slotModal = null; slotPickerLayoutCache = null;
        scene.dirty = true;
        return;
      }
```

If different, STOP and reconcile.

- [ ] **Step 2: Insert mismatch-modal handler at the very top of `onTouchEnd`**

Edit `calendar-puzzle-miniprogram/minigame/js/gameScene.js`.

`old_string`:

```js
  scene.onTouchEnd = function (x, y) {
    // ── Save-slot modals: intercept ALL taps while a modal is open. ──
    if (slotModal === 'save-picker' && slotPickerLayoutCache) {
```

`new_string`:

```js
  scene.onTouchEnd = function (x, y) {
    // ── Medium-hint mismatch modal: intercept ALL taps while open. ──
    if (mediumMismatchModal && mediumMismatchLayoutCache) {
      var mmL = mediumMismatchLayoutCache;
      // Take back: remove the offending placed block + re-select it in palette.
      if (R.hitTest(x, y, mmL.takeBackBtn)) {
        var mmPlacedId = mediumMismatchModal.kind === 'right-block-wrong-loc'
          ? mediumMismatchModal.blockId
          : mediumMismatchModal.placedBlockId;
        removeDropped(mmPlacedId);
        for (var pi = palette.length - 1; pi >= 0; pi--) {
          if (palette[pi].id === mmPlacedId) { selected = palette[pi]; break; }
        }
        mediumMismatchModal = null;
        mediumMismatchLayoutCache = null;
        scene.dirty = true;
        return;
      }
      // Ignore for the rest of this puzzle (persists across reload via hintState).
      if (R.hitTest(x, y, mmL.ignoreBtn)) {
        hintState = Hint.setMediumMismatchIgnored(hintState);
        _tempSlot.markDirty(captureState());
        mediumMismatchModal = null;
        mediumMismatchLayoutCache = null;
        scene.dirty = true;
        return;
      }
      // Close — dismiss this instance only; next mismatch re-opens dialog.
      if (R.hitTest(x, y, mmL.closeBtn)) {
        mediumMismatchModal = null;
        mediumMismatchLayoutCache = null;
        scene.dirty = true;
        return;
      }
      // Tap on dialog backdrop / anywhere else — swallow, no fall-through.
      return;
    }

    // ── Save-slot modals: intercept ALL taps while a modal is open. ──
    if (slotModal === 'save-picker' && slotPickerLayoutCache) {
```

- [ ] **Step 3: Smoke-test parsing**

Run: `node --check calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected: no output, exit code 0.

- [ ] **Step 4: Re-run the full test suite — no regression**

Run: `cd calendar-puzzle-miniprogram && npm test 2>&1 | tail -6`

Expected: all tests pass; `# fail 0`. Same total as after Task 4.

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/hint): tap handler for medium-hint mismatch modal"
```

---

## Task 7: CHANGELOG entry

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/CHANGELOG.md` — prepend a new `[0.6.0]` section above the current top entry (`[0.5.5]`).

- [ ] **Step 1: Confirm CHANGELOG top**

Run: `head -3 calendar-puzzle-miniprogram/minigame/CHANGELOG.md`

Expected:

```
# Changelog

## [0.5.5] — 2026-05-25
```

If `[0.5.5]` does not appear in the top entry (e.g., PR #10 has changed the version landed), STOP and ask user how to number the new entry.

- [ ] **Step 2: Prepend the new entry**

Edit `calendar-puzzle-miniprogram/minigame/CHANGELOG.md`.

`old_string`:

```
# Changelog

## [0.5.5] — 2026-05-25
```

`new_string`:

```
# Changelog

## [0.6.0] — 2026-05-27

> 中提示位置违规检测 — drop 后如果跟中提示对不上，弹个对话框让玩家立刻取回重选。

### 改动一览

- **中提示不一致对话框**：drop 后如果（a）刚放的方块占了别的方块的中提示位，或（b）刚放的方块是被中提示的那一块但没盖全提示位，弹一个白底圆角对话框。主按钮「取回并重新选中」一键撤回 + 自动选中那块；次级文字按钮「本局不再提示」整局闭嘴；右上角 × 仅关闭这次（下次再违规还弹）。
- **跨重载**：「本局不再提示」状态搭车 `hintState.mediumMismatchIgnored` 走存档；同一道题恢复后继续闭嘴，换题或新开局自动重置。

### 详情

- `hint.js` 新增纯函数 `findMediumMismatch(state, blockId, blockCells)` + `setMediumMismatchIgnored(state)`，检测逻辑优先级：自己有中提示但没盖全 → `right-block-wrong-loc`；别的块的中提示位被占 → `wrong-block-on-hint`；都没命中返回 null。一次 drop 最多弹一次（找到第一个违规就返回）。
- `gameScene.js` `placeBlock` 末尾、`checkWin` 之前插入检测调用；触发时模态层渲染对话框、tap handler 接管所有点击直到关闭。modal state 是 in-memory（`var mediumMismatchModal = null`），不参与存档；`hintState.mediumMismatchIgnored` 持久。
- `restoreHintState` 兜底新字段：缺字段 → 默认 `false`，向后兼容历史存档。

### 测试

- `tests/hint.test.js` +8 用例：`createHintState` 字段默认值、`restoreHintState` round-trip（缺字段 + 有字段）、`findMediumMismatch` 全分支（null / right-block / wrong-block / 优先级）、`setMediumMismatchIgnored` 不可变性。
- `npm test` → **228/228 pass**。
- gameScene 模态渲染 + tap：无单元测试 harness，手测路径见下方。

### 手测路径

1. 任意题打开 → 用中提示在 A 块上揭一格 → 把 B 块（≠ A）拖到那一格 → 对话框弹出，文案带两个块的 mini-icon → 点「取回并重新选中」→ B 块回 palette 并自动选中。
2. 同上揭 A 块一格 → A 块拖到别处（没盖到提示位）→ 对话框弹「你刚把 A 放到了别的位置」→ 关 × → 下次再这样放还弹。
3. 同上揭 A 块一格 → B 块拖到提示位 → 点「本局不再提示」→ 之后再随便错放都不弹 → 退游戏 → 从存档恢复 → 错放还是不弹。换题或新开局后恢复弹。
4. 教程模式 / 存档 `initialDropped` 自动放置不走 `placeBlock` → 不弹。

## [0.5.5] — 2026-05-25
```

- [ ] **Step 3: Sanity check the prepend landed correctly**

Run: `head -8 calendar-puzzle-miniprogram/minigame/CHANGELOG.md`

Expected: first non-`# Changelog` heading is `## [0.6.0] — 2026-05-27`, and `## [0.5.5]` follows further down.

- [ ] **Step 4: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/CHANGELOG.md
git commit -m "docs(minigame): CHANGELOG 0.6.0 — medium-hint mismatch dialog"
```

---

## Task 8: Manual WeChat-DevTools smoke + evidence

`gameScene.js` is Canvas-rendered with no unit-test harness — verification is a manual walkthrough.

**Files:**
- Modify: `feature_list.json` — add entry for this feature
- Optional: append a session record to `claude-progress.md` per repo handoff convention; overwrite `session-handoff.md` with current state.

- [ ] **Step 1: Open `calendar-puzzle-miniprogram/` in WeChat DevTools (mini-game project type), hit Run**

- [ ] **Step 2: Test Path 1 — wrong-block-on-hint, take back**

Use a medium hint on block A (the L-block is convenient). On the popup, pick A. The board shows one orange-bordered hint cell.

Pick block B (e.g., T-block) from palette. Drag it onto the orange hint cell. The modal opens. The body should read: `你刚把 [T-icon] 放到了 [L-icon] 的中提示位置上。`

Tap **取回并重新选中**. Expected:
- T-block disappears from board, reappears in palette.
- T-block is auto-selected (preview row shows its shape; tap-to-place is armed).
- Orange hint cell still visible for L-block.

Screenshot the modal pre-tap and the post-tap state. Save under `feature_list.json` evidence path.

- [ ] **Step 3: Test Path 2 — right-block-wrong-loc, × dismiss, re-fire**

Drag block A (the L-block from path 1, still hinted) to ANY cell that does NOT cover the orange hint cell. Modal opens, body reads: `你刚把 [L-icon] 放到了别的位置，但它的中提示还在等它。`

Tap the **×** at top-right. Modal closes. Block A stays where you dropped it.

Drag block A elsewhere (still not covering hint). Modal **fires again**. This is the close-vs-ignore difference.

Screenshot the modal + post-close state.

- [ ] **Step 4: Test Path 3 — 本局不再提示 + reload persistence**

From a fresh modal trigger, tap **本局不再提示**. Drop another contradicting block. Modal does NOT fire.

Kill the mini-game from WeChat or hit the system back button to save → re-enter via "继续上次" / a named save slot. The same puzzle reloads. Drop another contradicting block. Modal **still** does not fire.

Now random-switch the combo or back-to-menu and pick a new difficulty. Drop a contradicting block in the new puzzle. Modal fires (state was per-puzzle).

Screenshot the pre- and post-reload behaviour.

- [ ] **Step 5: Test Path 4 — no-hint baseline**

Start a fresh puzzle. Do NOT use medium hint at all. Place blocks anywhere. Modal must NOT fire under any condition (covered by `mediumLocked` empty fast-path).

- [ ] **Step 6: Update `feature_list.json` evidence**

Add an entry for `medium-hint-mismatch-dialog`:
- `status: passing`
- Verification steps mirror Paths 1-4 above
- Screenshot paths from Steps 2-3

- [ ] **Step 7: Append session record + overwrite handoff**

Per repo convention:
- Prepend a new section to `claude-progress.md` under `## 会话记录` summarising this feature shipping
- Overwrite `session-handoff.md` with current branch state, open PR, next steps

- [ ] **Step 8: Commit evidence**

```bash
git add feature_list.json claude-progress.md session-handoff.md
git commit -m "chore(minigame/hint): record evidence for medium-hint mismatch dialog"
```

(Skip files in this list that you did not modify.)

---

## Self-Review Notes

- **Spec coverage:**
  - Spec §Trigger → Task 4 (placeBlock wiring + bCells calc inline).
  - Spec §Detection → Task 2 (`findMediumMismatch` + 5 tests covering all branches incl. priority).
  - Spec §Suppression → Tasks 1, 3 (field + setter + round-trip tests).
  - Spec §Dialog visual → Task 5 (modal render).
  - Spec §Actions (take-back / ignore / close) → Task 6 (tap handler).
  - Spec §State in gameScene → Task 4 (var decls), Task 5 (layout cache).
  - Spec §Save-slot → Task 1 (round-trip line) + Task 6 (`markDirty` after ignore).
  - Spec §Edge cases — no active hints / pre-feature slot / tutorial initialDropped / mid-mistake save / multi-violation → covered by detection short-circuits in Task 2, default-false restore in Task 1, the `if (!hintState.mediumMismatchIgnored)` guard in Task 4, and "first violation only" by `findMediumMismatch` returning early. The "block force-removed while dialog open" graceful degradation lives in Task 6's `removeDropped` defensive-no-op behaviour (existing).
  - Spec §Testing — 8 cases — Task 1 (3) + Task 2 (5) + Task 3 (1) = 9. One bonus, fine.
  - Spec §Files Touched / NOT Touched — Tasks 1-7 stay within the 4 declared files; `B.cellsOf` deliberately inlined into Task 4 per spec.

- **No placeholders left.** Every code step has the full code; every verification step has the exact command + expected output.

- **Type consistency:** `findMediumMismatch` return shape is `{ kind, blockId }` for `right-block-wrong-loc` and `{ kind, placedBlockId, hintedBlockId }` for `wrong-block-on-hint` — used consistently in Task 2 implementation, Task 4 trigger (no shape access, just sets the modal var), Task 5 render (reads `mediumMismatchModal.blockId` vs `.placedBlockId / .hintedBlockId`), and Task 6 tap handler (`mediumMismatchModal.blockId` vs `.placedBlockId`).
