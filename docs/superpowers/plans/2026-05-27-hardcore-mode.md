# Hardcore Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cross-difficulty "硬核模式" toggle to the WeChat minigame: disables hint / random-switch / picker buttons, replaces "重开" with a timer-preserving "清空", introduces a pause-menu (☰) with a one-way "放弃硬核" downgrade, and records per-day per-difficulty hardcore clears in `progress`.

**Architecture:** A new `mode.js` module owns `{ hardcore: bool }` plus capability helpers (`canUseHint`, `canSwapPuzzle`, `canRestart`). The flag threads `selectScene → main.js → gameScene` through the existing callback chain, and round-trips into save slots via `captureState`. Per-day per-difficulty hardcore clears live in `progress.js` under a new `hardcoreDays` storage key. UI changes are scoped to `selectScene` (toggle row) and `gameScene` (control-row layout + new ☰ sheet).

**Tech Stack:** WeChat minigame (`calendar-puzzle-miniprogram/minigame/`), plain JS, `node --test` for units, `wx.*StorageSync` for persistence.

**Reference spec:** `docs/superpowers/specs/2026-05-27-hardcore-mode-design.md`.

**Base branch:** `feature/medium-hint-mismatch-dialog`. Suggested implementation branch: `feature/hardcore-mode`.

**Repo-root note:** All `Run:` commands assume cwd = `calendar-puzzle-miniprogram/` (where `package.json` and `tests/` live). All file paths in this plan are relative to the **repo root** (`/Users/bytedance/mygit/CalendarPuzzle/`) for `git add` precision.

---

## File Structure

| File | Purpose | Action |
|---|---|---|
| `calendar-puzzle-miniprogram/minigame/js/mode.js` | Mode object factory + capability helpers | **Create** |
| `calendar-puzzle-miniprogram/tests/mode.test.js` | Unit tests for mode module | **Create** |
| `calendar-puzzle-miniprogram/minigame/js/progress.js` | Add `markHardcoreCleared` / `hasHardcoreCleared` + new storage key | **Modify** |
| `calendar-puzzle-miniprogram/tests/progress.hardcore.test.js` | Unit tests for hardcoreDays (no existing `progress.test.js`) | **Create** |
| `calendar-puzzle-miniprogram/minigame/js/main.js` | Thread `modeOpts` through `goToSelect` → `startGame` → `launchGameScene` → `createGameScene` | **Modify** |
| `calendar-puzzle-miniprogram/minigame/js/selectScene.js` | Hardcore toggle row UI + state + hit handler + extend `onSelect` signature | **Modify** |
| `calendar-puzzle-miniprogram/minigame/js/gameScene.js` | Mode property + control-row gating + `clearBoardKeepTimer` + ☰ pause menu + `markHardcoreCleared` call + win-modal label | **Modify** |
| `calendar-puzzle-miniprogram/tests/slotStore.test.js` | +2 cases: `mode` round-trip and old-payload absence | **Modify** |
| `calendar-puzzle-miniprogram/minigame/CHANGELOG.md` | `[0.7.0] — 2026-05-27` entry | **Modify** |

`gameScene.js` already lacks integration tests (per `session-handoff.md`: *"`createGameScene(savedState)` 至今无集成测试"*); gameScene-touching tasks therefore rely on `node --check` for syntax + the existing unit test surface for no-regression, plus the manual smoke matrix in §6.2 of the spec.

---

## Task 1: Mode module + capability helpers

**Files:**
- Create: `calendar-puzzle-miniprogram/minigame/js/mode.js`
- Create: `calendar-puzzle-miniprogram/tests/mode.test.js`

- [ ] **Step 1: Write the failing test file**

Create `calendar-puzzle-miniprogram/tests/mode.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');
var M = require('../minigame/js/mode');

test('createMode(): empty/missing opts → { hardcore: false }', function () {
  assert.deepStrictEqual(M.createMode(),         { hardcore: false });
  assert.deepStrictEqual(M.createMode(undefined),{ hardcore: false });
  assert.deepStrictEqual(M.createMode(null),     { hardcore: false });
  assert.deepStrictEqual(M.createMode({}),       { hardcore: false });
});

test('createMode(): truthy hardcore opt → { hardcore: true }; coerced to boolean', function () {
  assert.deepStrictEqual(M.createMode({ hardcore: true }),  { hardcore: true });
  assert.deepStrictEqual(M.createMode({ hardcore: 1 }),     { hardcore: true });
  assert.deepStrictEqual(M.createMode({ hardcore: false }), { hardcore: false });
  assert.deepStrictEqual(M.createMode({ hardcore: 0 }),     { hardcore: false });
});

test('createMode(): ignores unknown opts (forward-compat)', function () {
  assert.deepStrictEqual(M.createMode({ hardcore: true, ghost: 'ignored' }), { hardcore: true });
});

test('isHardcore(): true only when mode.hardcore === true', function () {
  assert.strictEqual(M.isHardcore(undefined),                 false);
  assert.strictEqual(M.isHardcore(null),                      false);
  assert.strictEqual(M.isHardcore({}),                        false);
  assert.strictEqual(M.isHardcore({ hardcore: false }),       false);
  assert.strictEqual(M.isHardcore({ hardcore: true }),        true);
});

test('canUseHint / canSwapPuzzle / canRestart: false in hardcore, true otherwise', function () {
  var hc = M.createMode({ hardcore: true });
  var nm = M.createMode({});
  assert.strictEqual(M.canUseHint(hc),    false);
  assert.strictEqual(M.canUseHint(nm),    true);
  assert.strictEqual(M.canSwapPuzzle(hc), false);
  assert.strictEqual(M.canSwapPuzzle(nm), true);
  assert.strictEqual(M.canRestart(hc),    false);
  assert.strictEqual(M.canRestart(nm),    true);
});

test('canClearBoard: true regardless of mode', function () {
  assert.strictEqual(M.canClearBoard(M.createMode({ hardcore: true })),  true);
  assert.strictEqual(M.canClearBoard(M.createMode({ hardcore: false })), true);
});

test('DEFAULT_MODE is the canonical { hardcore: false }', function () {
  assert.deepStrictEqual(M.DEFAULT_MODE, { hardcore: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `calendar-puzzle-miniprogram/`):
```bash
node --test tests/mode.test.js
```
Expected: FAIL with `Cannot find module '../minigame/js/mode'` (or similar require error).

- [ ] **Step 3: Create the implementation**

Create `calendar-puzzle-miniprogram/minigame/js/mode.js`:

```js
// Mode object lives on gameScene and rides save-slot payloads.
//
// Capability helpers are the single source of truth for "what does this
// mode allow"; gameScene render/hit-test branches consult them instead of
// hard-coding `mode.hardcore`. Future modes (timed, daily-challenge) extend
// this same surface.

var DEFAULT_MODE = { hardcore: false };

function createMode(opts) {
  opts = opts || {};
  return { hardcore: !!opts.hardcore };
}

function isHardcore(mode) {
  return !!(mode && mode.hardcore);
}

function canUseHint(mode)    { return !isHardcore(mode); }
function canSwapPuzzle(mode) { return !isHardcore(mode); }
function canRestart(mode)    { return !isHardcore(mode); }
function canClearBoard(mode) { return true; }

module.exports = {
  DEFAULT_MODE: DEFAULT_MODE,
  createMode: createMode,
  isHardcore: isHardcore,
  canUseHint: canUseHint,
  canSwapPuzzle: canSwapPuzzle,
  canRestart: canRestart,
  canClearBoard: canClearBoard,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/mode.test.js
```
Expected: all 7 tests pass.

- [ ] **Step 5: Run full suite to confirm no regression**

Run:
```bash
npm test
```
Expected: prior pass count + 7 (the new tests). Should still be all-green.

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/mode.js calendar-puzzle-miniprogram/tests/mode.test.js
git commit -m "feat(minigame/mode): mode module + capability helpers (hardcore foundation)"
```

---

## Task 2: progress.hardcoreDays — per-date per-difficulty clears

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/progress.js`
- Create: `calendar-puzzle-miniprogram/tests/progress.hardcore.test.js`

`progress.js` directly calls `wx.getStorageSync` / `wx.setStorageSync`; tests mock these on `global.wx` and reset between cases.

- [ ] **Step 1: Write the failing test file**

Create `calendar-puzzle-miniprogram/tests/progress.hardcore.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');

// Install a fresh in-memory wx shim BEFORE requiring the module, since
// progress.js does not DI the storage layer.
function installWX() {
  global.wx = {
    _s: {},
    setStorageSync: function (k, v) { this._s[k] = v; },
    getStorageSync: function (k) { return k in this._s ? this._s[k] : ''; },
  };
}
function resetWX() { if (global.wx) global.wx._s = {}; }

installWX();
var progress = require('../minigame/js/progress');

test('markHardcoreCleared: first time at (date, difficulty) returns true and persists', function () {
  resetWX();
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'expert'), true);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'), true);
});

test('markHardcoreCleared: idempotent — second call at same (date, difficulty) returns false', function () {
  resetWX();
  progress.markHardcoreCleared('2026-05-27', 'expert');
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'expert'), false);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'), true);
});

test('markHardcoreCleared: distinct (difficulty) on same date both record', function () {
  resetWX();
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'easy'),   true);
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'expert'), true);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'easy'),    true);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'),  true);
});

test('hasHardcoreCleared: false when never marked / different date / different difficulty', function () {
  resetWX();
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'), false);
  progress.markHardcoreCleared('2026-05-27', 'expert');
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-28', 'expert'), false);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'hard'),   false);
});

test('storage round-trip: hardcoreDays survives a fresh require-cycle via wx storage', function () {
  resetWX();
  progress.markHardcoreCleared('2026-05-27', 'insomnia');
  // Drop the cached module so the next require re-reads wx storage.
  delete require.cache[require.resolve('../minigame/js/progress')];
  var progress2 = require('../minigame/js/progress');
  assert.strictEqual(progress2.hasHardcoreCleared('2026-05-27', 'insomnia'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/progress.hardcore.test.js
```
Expected: FAIL with `TypeError: progress.markHardcoreCleared is not a function`.

- [ ] **Step 3: Add storage block + functions to `progress.js`**

In `calendar-puzzle-miniprogram/minigame/js/progress.js`, insert after the `markUniqueInsomnia` block (after the line that ends `return { isNew: true, count: arr.length };` plus its closing brace; before the `TUTORIAL_KEY` block):

```js
// Hardcore mode: per-day per-difficulty clear flag.
// Storage shape: { "2026-05-27": { "expert": true, "easy": true }, ... }
var HARDCORE_KEY = 'calendarPuzzleHardcoreDays';

function loadHardcore() {
  try { var r = wx.getStorageSync(HARDCORE_KEY); if (r) return JSON.parse(r); } catch (e) {}
  return {};
}

function saveHardcore(d) {
  try { wx.setStorageSync(HARDCORE_KEY, JSON.stringify(d)); } catch (e) {}
}

// Returns true on first-time-at-this-(date, difficulty); false if already set.
function markHardcoreCleared(dateStr, difficulty) {
  if (!dateStr || !difficulty) return false;
  var all = loadHardcore();
  var entry = all[dateStr] = all[dateStr] || {};
  if (entry[difficulty]) return false;
  entry[difficulty] = true;
  saveHardcore(all);
  return true;
}

function hasHardcoreCleared(dateStr, difficulty) {
  if (!dateStr || !difficulty) return false;
  var all = loadHardcore();
  var entry = all[dateStr];
  return !!(entry && entry[difficulty]);
}
```

Then add to the `module.exports = { ... };` block at the bottom of the file (before the closing `};`):

```js
  markHardcoreCleared: markHardcoreCleared,
  hasHardcoreCleared: hasHardcoreCleared,
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/progress.hardcore.test.js
```
Expected: all 5 tests pass.

- [ ] **Step 5: Run full suite**

Run:
```bash
npm test
```
Expected: no regression; total pass count += 5.

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/progress.js calendar-puzzle-miniprogram/tests/progress.hardcore.test.js
git commit -m "feat(minigame/progress): hardcoreDays — per-date per-difficulty clear tracking"
```

---

## Task 3: Thread mode through main.js → selectScene → gameScene + captureState round-trip

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/main.js`
- Modify: `calendar-puzzle-miniprogram/minigame/js/selectScene.js` (signature only — UI work is Task 4)
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`
- Modify: `calendar-puzzle-miniprogram/tests/slotStore.test.js`

Threading plan:
- `selectScene` callback `onSelect(difficulty, savedState)` → `onSelect(difficulty, savedState, modeOpts)`. (Task 5 fills the toggle UI; this task only widens the signature with `modeOpts = null` at all call sites.)
- `main.js` `startGame(d, savedState)` → `startGame(d, savedState, modeOpts)`; `launchGameScene(d, puzzle, savedState)` → `launchGameScene(d, puzzle, savedState, modeOpts)`.
- `gameScene.js`: append `modeOpts` as 7th positional arg to `createGameScene(...)`; resolve `this.mode = M.createMode(savedState && savedState.mode ? savedState.mode : modeOpts)` near scene init; include `mode: scene.mode` in `captureState()`.

- [ ] **Step 1: Write the failing slotStore test cases**

Open `calendar-puzzle-miniprogram/tests/slotStore.test.js` and append at the bottom of the file:

```js
test('slotStore: mode field round-trips on writeSlot/readSlot', function () {
  var s = fakeStorage();
  var ss = SS.create({ storage: s, now: function () { return 1716181000000; } });
  ss.writeSlot('named-1', {
    date: '2026-05-27',
    difficulty: 'expert',
    comboIndex: 1,
    placedBlocks: [],
    paletteBlocks: [],
    elapsedMs: 0,
    mode: { hardcore: true },
  });
  var got = ss.readSlot('named-1');
  assert.deepStrictEqual(got.mode, { hardcore: true });
});

test('slotStore: legacy payload without mode reads back without a mode field (caller defaults)', function () {
  var s = fakeStorage();
  var ss = SS.create({ storage: s, now: function () { return 1716181000000; } });
  ss.writeSlot('named-1', {
    date: '2026-05-27',
    difficulty: 'easy',
    comboIndex: 0,
    placedBlocks: [],
    paletteBlocks: [],
    elapsedMs: 0,
    // no mode field
  });
  var got = ss.readSlot('named-1');
  assert.strictEqual(got.mode, undefined);
});
```

- [ ] **Step 2: Run only the new slotStore tests to verify mode round-trip already works (or fails)**

Run:
```bash
node --test tests/slotStore.test.js
```
Expected: **both new tests PASS** without code changes — `slotStore` is schemaless (it stores whatever payload is given). If they fail with field-stripping, jump to Step 3a (otherwise skip 3a).

  > Step 3a (only if Step 2's first new test fails): open `calendar-puzzle-miniprogram/minigame/js/slotStore.js`, find any field-whitelist or normalization in `writeSlot`/`readSlot`, and add `mode` to the allow-list. Then re-run.

- [ ] **Step 3: Modify `gameScene.js` — accept modeOpts, resolve scene.mode, include in captureState**

In `calendar-puzzle-miniprogram/minigame/js/gameScene.js`:

**3a.** Near the top of the file, find the require block (search for `require('./hint')` to land in it). Add directly under it:

```js
var M = require('./mode');
```

**3b.** Change the export signature at line 46 from:

```js
module.exports = function createGameScene(difficulty, puzzle, safeInsets, menuRect, callbacks, savedState) {
```

to:

```js
module.exports = function createGameScene(difficulty, puzzle, safeInsets, menuRect, callbacks, savedState, modeOpts) {
```

**3c.** Find the `if (savedState) { ... }` block (starts around line 72). Immediately after that block ends (before the next non-blank line that introduces new logic — look for the next `var hintState =` around line 131; insert above any reads of `hintState`), add:

```js
  // Mode resolution: a restored save carries its own mode (preserves hardcore
  // across exit/resume); a fresh game receives modeOpts from selectScene; the
  // implicit default is non-hardcore.
  var mode = M.createMode(savedState && savedState.mode ? savedState.mode : modeOpts);
  scene.mode = mode;
```

(Place this above `var hintState = Hint.restoreHintState(...)` so later code in this task / future tasks can read `mode` freely.)

**3d.** Find `function captureState()` (line 149). Inside the returned object literal, add `mode: mode,` as a new key. The result should look like:

```js
  function captureState() {
    return {
      boundSlotId: _slotBinding.getBound(),
      date: puzzle.dateStr,
      difficulty: difficulty,
      comboIndex: puzzle.currentComboIndex,
      placedBlocks: dropped.map(B.cloneBlock),
      paletteBlocks: palette.map(B.cloneBlock),
      prePlacedBlocks: prePlaced.map(B.cloneBlock),
      elapsedMs: timer * 1000,
      hintState: hintState,
      playedCombos: Object.assign({}, playedCombos),
      mode: mode,
    };
  }
```

- [ ] **Step 4: Modify `selectScene.js` — widen onSelect signature with explicit null modeOpts at every call site**

In `calendar-puzzle-miniprogram/minigame/js/selectScene.js`, find each of the 4 `onSelect(...)` call sites (verified at lines 298, 315, 342, 392 in the current branch — re-run `grep -n "onSelect(" minigame/js/selectScene.js` if line numbers have drifted). For now, append `, null` to each call as a placeholder. The toggle wiring in Task 5 will replace the last call site's `null` with a real value.

Examples:
- `onSelect(saved.difficulty, saved);`         → `onSelect(saved.difficulty, saved, null);`
- `onSelect(pd, null);`                         → `onSelect(pd, null, null);`
- `onSelect(slotPayload.difficulty, slotPayload);` → `onSelect(slotPayload.difficulty, slotPayload, null);`
- `onSelect(d, null);`                          → `onSelect(d, null, null);`

- [ ] **Step 5: Modify `main.js` — thread modeOpts through `goToSelect → startGame → launchGameScene → createGameScene`**

In `calendar-puzzle-miniprogram/minigame/js/main.js`:

**5a.** At line ~173 (`createSelectScene` callback), change:

```js
  currentScene = createSelectScene(safeInsets, menuRect, function (difficulty, savedState) {
    startGame(difficulty, savedState);
  }, {
```

to:

```js
  currentScene = createSelectScene(safeInsets, menuRect, function (difficulty, savedState, modeOpts) {
    startGame(difficulty, savedState, modeOpts);
  }, {
```

**5b.** Change the `startGame` function signature and pass-through:

```js
function startGame(difficulty, savedState) {
```
→
```js
function startGame(difficulty, savedState, modeOpts) {
```

And at the end of `startGame`, change:
```js
    launchGameScene(difficulty, puzzle, savedState);
```
→
```js
    launchGameScene(difficulty, puzzle, savedState, modeOpts);
```

**5c.** Change `launchGameScene` signature and the final `createGameScene` call:

```js
function launchGameScene(difficulty, puzzle, savedState) {
```
→
```js
function launchGameScene(difficulty, puzzle, savedState, modeOpts) {
```

And the `createGameScene(...)` invocation (currently lines ~208-219) ends with `}, savedState);`. Change the final arg to `}, savedState, modeOpts);`.

**5d.** Find the `onSwitchPuzzle` callback inside `launchGameScene` (line ~210):

```js
    onSwitchPuzzle: function (newPuzzle) {
      launchGameScene(difficulty, newPuzzle);
    },
```

Change to:
```js
    onSwitchPuzzle: function (newPuzzle) {
      launchGameScene(difficulty, newPuzzle, null, scene.mode || null);
    },
```

Rationale: when the player taps 🎲 / 🎯, the new game inherits the current scene's mode. (In hardcore those buttons are hidden, so this branch only ever fires with non-hardcore mode — but we forward defensively anyway.) Note: `scene` is the local var holding the current gameScene returned by `createGameScene(...)`; verify by `grep -n "currentScene = createGameScene\|var scene " minigame/js/main.js`. If `scene` is not in scope here, use `currentScene.mode` (currentScene is reassigned just above).

- [ ] **Step 6: Syntax check + full test suite**

Run:
```bash
node --check minigame/js/mode.js
node --check minigame/js/gameScene.js
node --check minigame/js/selectScene.js
node --check minigame/js/main.js
node --check minigame/js/progress.js
npm test
```
Expected: all `node --check` exit 0; `npm test` green; new slotStore cases pass (+2); no regression elsewhere.

- [ ] **Step 7: Commit**

```bash
git add \
  calendar-puzzle-miniprogram/minigame/js/main.js \
  calendar-puzzle-miniprogram/minigame/js/selectScene.js \
  calendar-puzzle-miniprogram/minigame/js/gameScene.js \
  calendar-puzzle-miniprogram/tests/slotStore.test.js
git commit -m "feat(minigame/mode): thread mode through main→selectScene→gameScene + captureState round-trip"
```

---

## Task 4: selectScene — hardcore toggle row UI + per-session state

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/selectScene.js`

The toggle is rendered immediately below the 5 difficulty buttons (after the `for` loop that pushes to `btnRects`, before the info-button `ⓘ` block). State is held in scope-local `var hardcoreOn = false;` — **never** read/written to storage (per-session intent).

- [ ] **Step 1: Add `hardcoreOn` state + toggle rect storage**

Near the top of `createSelectScene` (with the other scope-local vars like `btnRects`), add:

```js
  var hardcoreOn = false;
  var hardcoreToggleRect = null;
```

- [ ] **Step 2: Render the toggle row + caption beneath difficulty buttons**

Find the end of the difficulty buttons loop in `drawScene` (it pushes to `btnRects.push(...)` and ends with `y += btnH + btnGap;`). Immediately after that loop closes, insert (use `y` from the running layout cursor):

```js
      // ── Hardcore mode toggle (per-session; not persisted) ─────────────
      var hcRowH = 36;
      var hcTrackW = 56, hcTrackH = 28;
      var hcKnobR = 11;
      var hcLabelX = (W - btnW) / 2;
      var hcTrackX = hcLabelX + btnW - hcTrackW;
      var hcTrackY = y + (hcRowH - hcTrackH) / 2;
      // Label
      R.textBold(ctx, '🔥 硬核模式', hcLabelX, y + hcRowH / 2, 16, '#333', 'left', 'middle');
      // Track + knob
      R.roundRect(ctx, hcTrackX, hcTrackY, hcTrackW, hcTrackH, hcTrackH / 2,
        hardcoreOn ? '#FF7043' : '#BDBDBD');
      var knobX = hardcoreOn
        ? hcTrackX + hcTrackW - hcKnobR - 4
        : hcTrackX + hcKnobR + 4;
      ctx.beginPath();
      ctx.arc(knobX, hcTrackY + hcTrackH / 2, hcKnobR, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      hardcoreToggleRect = { x: hcLabelX, y: y, w: btnW, h: hcRowH };
      y += hcRowH + 2;
      // Caption (small grey)
      R.text(ctx, '关闭提示・换题・券，重开变为清空棋盘',
        hcLabelX, y + 8, 11, '#888', 'left');
      y += 18;
      // ──────────────────────────────────────────────────────────────────
```

(Style nit — uses existing `R.roundRect`, `R.textBold`, `R.text` helpers already imported by this file.)

- [ ] **Step 3: Add the hit handler in `scene.onTouchEnd`**

Find `scene.onTouchEnd = function (x, y) { ... }` (line ~273). Inside, BEFORE the difficulty `btnRects` loop, add:

```js
    if (hardcoreToggleRect && R.hitTest(x, y, hardcoreToggleRect)) {
      hardcoreOn = !hardcoreOn;
      scene.dirty = true;
      return;
    }
```

- [ ] **Step 4: Pass `hardcoreOn` to the new-game `onSelect(...)` call site**

Find the difficulty `btnRects` loop (line ~375). The terminal `onSelect(d, null, null);` (which Task 3 already widened) becomes:

```js
        onSelect(d, null, { hardcore: hardcoreOn });
```

Leave the other 3 `onSelect(..., null)` call sites alone — resume / saved-slot paths read mode from `savedState.mode`.

- [ ] **Step 5: Syntax check**

Run:
```bash
node --check minigame/js/selectScene.js
npm test
```
Expected: clean; no test regression (toggle UI has no unit tests — manual verification in Step 6).

- [ ] **Step 6: Manual smoke (record in commit message body if discrepancies)**

Open the project in WeChat 开发者工具 → 选择难度界面：
- Tap "🔥 硬核模式" → track flips orange, knob slides right. Caption text below visible.
- Tap a difficulty button → enters game (visual gating proven in Task 5, not yet here — at this stage the game scene still renders normally).
- Re-open select scene from back button → toggle is OFF (per-session reset is the spec'd behavior).

- [ ] **Step 7: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/selectScene.js
git commit -m "feat(minigame/selectScene): hardcore mode toggle row (per-session)"
```

---

## Task 5: gameScene — control row gating (hint / swap hidden, restart → clear)

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

The control-row layout currently switches between 4 buttons (default) and 2 buttons (insomnia). Hardcore mode collapses it to 1 button (清空). All three behaviors are unified into a capability-driven layout in this single task because the button positions are mutually dependent.

- [ ] **Step 1: Rewrite the control-row layout block to be capability-driven**

In `calendar-puzzle-miniprogram/minigame/js/gameScene.js`, find the control-row block at lines 648-666 (it starts with the comment `// Control row: 提示 / 重开 / 🎲 / 🎯` and ends with `y += btnH + 10;`). Replace the entire block with:

```js
    // Control row: 提示 / 重开 / 🎲 / 🎯  — single line.
    // Layout collapses based on capabilities:
    //   default:  [💡 提示] [↺ 重开] [🎲 随机] [🎯 选题]      (4 buttons)
    //   insomnia: [💡 提示] [↺ 重开]                          (2 buttons; no swap)
    //   hardcore: [🧹 清空]                                    (1 button; replaces 重开)
    // Hidden during tutorial mode to keep the focus on the banner step.
    L.hintBtn = null;
    L.resetBtn = null;
    L.switchRandomBtn = null;
    L.switchManualBtn = null;
    if (!tutorialMode) {
      var showHint = M.canUseHint(mode);
      var showSwap = M.canSwapPuzzle(mode) && !isInsomnia;
      var hardcore = M.isHardcore(mode);
      var nCtrl = (showHint ? 1 : 0) + 1 /* reset/clear */ + (showSwap ? 2 : 0);
      var btnH = 36, btnGap = 8;
      var ctrlBtnW = Math.floor((W - 2 * pad - (nCtrl - 1) * btnGap) / nCtrl);
      L.ctrlY = y;
      var idx = 0;
      if (showHint) {
        L.hintBtn  = { x: pad + (ctrlBtnW + btnGap) * idx, y: y, w: ctrlBtnW, h: btnH };
        idx++;
      }
      L.resetBtn   = { x: pad + (ctrlBtnW + btnGap) * idx, y: y, w: ctrlBtnW, h: btnH, kind: hardcore ? 'clear' : 'reset' };
      idx++;
      if (showSwap) {
        L.switchRandomBtn = { x: pad + (ctrlBtnW + btnGap) * idx, y: y, w: ctrlBtnW, h: btnH };
        idx++;
        L.switchManualBtn = { x: pad + (ctrlBtnW + btnGap) * idx, y: y, w: ctrlBtnW, h: btnH };
        idx++;
      }
      y += btnH + 10;
    }
```

(Note the `kind: hardcore ? 'clear' : 'reset'` annotation on `L.resetBtn` — used in Step 2 to choose label, and in Step 3 to choose behavior.)

- [ ] **Step 2: Update the reset-button render call**

Find the reset-button render at line ~958:
```js
        R.button(ctx, L.resetBtn.x, L.resetBtn.y, L.resetBtn.w, L.resetBtn.h, '↺ 重开', dropped.length ? NEUTRAL : '#cfcfcf', '#fff', 8);
```

Change to:
```js
        var resetLabel = L.resetBtn.kind === 'clear' ? '🧹 清空' : '↺ 重开';
        R.button(ctx, L.resetBtn.x, L.resetBtn.y, L.resetBtn.w, L.resetBtn.h, resetLabel, dropped.length ? NEUTRAL : '#cfcfcf', '#fff', 8);
```

- [ ] **Step 3: Branch the reset-button hit handler — clear-board-keep-timer vs. existing restart**

Find the reset-button hit at line ~2636 (the line that contains `showToast('已重开当前题');`). Read the surrounding handler (likely 5-15 lines above to capture timer reset, dropped→palette move, puzzle.placed clear). Then split the handler:

Replace the existing branch with:

```js
        if (L.resetBtn.kind === 'clear') {
          // Hardcore: clear all dropped blocks back to palette; DO NOT reset timer.
          while (dropped.length) {
            var blk = dropped.pop();
            // Reuse the existing dropped→palette move semantics. If the surrounding
            // handler used helpers (e.g. B.removeFromBoard / B.returnToPalette),
            // call those instead of mutating dropped/palette directly.
            palette.push(blk);
          }
          // Clear the board's logical placed map. Verify the exact identifier
          // (often `puzzle.placed` or scene-local `placed`) by grep before edit.
          if (puzzle && puzzle.placed) {
            for (var pk in puzzle.placed) { delete puzzle.placed[pk]; }
          }
          _tempSlot.markDirty(captureState());
          showToast('已清空棋盘');
        } else {
          // existing restart body (timer reset + dropped→palette + placed clear + toast)
          // KEEP THE ORIGINAL CODE HERE UNCHANGED — only the branch wrapper is new.
        }
```

> Implementation note for the engineer: the actual lines around `gameScene.js:2636` use the project's own conventions for resetting placed/dropped. Read 20 lines of surrounding context first, mirror those exact helpers in the new `'clear'` branch, and keep the `'reset'` branch byte-identical to today's body. The only behavioral difference between branches is: **clear DOES NOT touch `timer` or `timerInterval`**.

- [ ] **Step 4: Syntax check + full test suite**

Run:
```bash
node --check minigame/js/gameScene.js
npm test
```
Expected: clean; no regression.

- [ ] **Step 5: Manual smoke (record any deviation in commit body)**

In WeChat 开发者工具:
- New game with hardcore OFF (any difficulty): control row shows 4 buttons (or 2 for insomnia) as today.
- New game with hardcore ON (expert): control row shows ONLY "🧹 清空".
- Place 2-3 blocks → tap 🧹 → blocks return to palette, board empties, **timer keeps running** (don't return to 00:00).
- New game with hardcore OFF + insomnia: still 2 buttons "💡 提示" + "↺ 重开" (regression check).

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/gameScene): hardcore control row — hide hint/swap, replace 重开 with 清空 (keep timer)"
```

---

## Task 6: gameScene — ☰ pause menu structure (entry button + sheet rendering + dismiss)

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

This task wires the chrome only: a top-right `☰` button that toggles a half-screen sheet. The sheet renders an empty container; entries land in Task 7.

- [ ] **Step 1: Add pause-menu state + button rect**

Near the other scene-local flag vars (search for `var tutorialMode` to land near the right cluster), add:

```js
  var pauseMenuOpen = false;
```

- [ ] **Step 2: Render the ☰ button in the top bar**

Find the top-bar render block (search for `if (L.backBtn) {` around line 915 — the back-button render). After that block (immediately after its closing `}`), add:

```js
    // ☰ Pause-menu entry (top-right). Positioned mirror of backBtn relative to safe area.
    var pmSize = 36;
    L.pauseBtn = { x: W - pad - pmSize, y: L.backBtn.y, w: pmSize, h: pmSize };
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.arc(L.pauseBtn.x + pmSize / 2, L.pauseBtn.y + pmSize / 2, pmSize / 2, 0, Math.PI * 2);
    ctx.fill();
    R.textBold(ctx, '☰', L.pauseBtn.x + pmSize / 2, L.pauseBtn.y + pmSize / 2 - 1, 22, '#555', 'center', 'middle');
```

- [ ] **Step 3: Render the empty sheet when `pauseMenuOpen`**

Find a late render point that draws overlays (search for `R.overlay(ctx, W, H)` to find an existing overlay call to model on). Append a new conditional render block near the END of the render function (after all other game UI but before any toasts):

```js
    if (pauseMenuOpen) {
      R.overlay(ctx, W, H);
      var sheetH = Math.floor(H * 0.5);
      var sheetY = H - sheetH;
      R.roundRect(ctx, 0, sheetY, W, sheetH, 18, '#fff');
      R.textBold(ctx, '菜单', W / 2, sheetY + 28, 18, '#333', 'center', 'middle');
      L.pauseSheet = { x: 0, y: sheetY, w: W, h: sheetH };
      // Entries rendered in Task 7. This block leaves a blank pane for now.
    } else {
      L.pauseSheet = null;
    }
```

- [ ] **Step 4: Add hit handlers — ☰ open + tap-outside close**

Find `scene.onTouchEnd = function (x, y) { ... }` (or the equivalent — search for `function (x, y)` and `R.hitTest`). At the TOP of the handler (before any other hit logic), add:

```js
    // Pause-menu interactions take precedence when open (modal sheet).
    if (pauseMenuOpen) {
      // Tap inside the sheet rect: keep open (entries handled in Task 7).
      if (L.pauseSheet && R.hitTest(x, y, L.pauseSheet)) {
        return;
      }
      // Tap outside (the dimmed overlay) closes the sheet.
      pauseMenuOpen = false;
      scene.dirty = true;
      return;
    }
    if (L.pauseBtn && R.hitTest(x, y, L.pauseBtn)) {
      pauseMenuOpen = true;
      scene.dirty = true;
      return;
    }
```

- [ ] **Step 5: Syntax check + tests**

Run:
```bash
node --check minigame/js/gameScene.js
npm test
```
Expected: clean; no regression.

- [ ] **Step 6: Manual smoke**

In WeChat 开发者工具:
- New game (any mode): top-right shows ☰ button next to (mirror of) the existing back arrow.
- Tap ☰ → bottom half overlay slides up showing a white sheet with "菜单" header.
- Tap inside the sheet (on the blank area) → nothing happens.
- Tap outside the sheet (the dimmed top area) → sheet closes.
- Tap ☰ again → reopens. Back arrow ↩ still works normally (goes to selectScene).

- [ ] **Step 7: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/gameScene): ☰ pause-menu entry + half-screen sheet shell"
```

---

## Task 7: gameScene — pause menu 3 entries + 放弃硬核 downgrade flow

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Entries (top-to-bottom inside the sheet):
1. **🔥 放弃硬核** — only when `M.isHardcore(scene.mode)`; opens a two-step confirm before downgrading.
2. **🏠 返回首页** — calls `callbacks.onBack()` (the same callback used by `L.backBtn`).
3. **Title block** — read-only: `<dateStr> · <difficulty label> · 🔥 硬核` (drop the suffix when not hardcore).

- [ ] **Step 1: Add confirm-dialog state**

Near `pauseMenuOpen`, add:

```js
  var abandonConfirmOpen = false;
```

- [ ] **Step 2: Render the 3 entries inside the sheet block (from Task 6)**

Inside the `if (pauseMenuOpen) { ... }` block added in Task 6 (right after the `'菜单'` header text), replace the `// Entries rendered in Task 7.` comment with:

```js
      var rowH = 56, rowGap = 8;
      var rowX = 16, rowY = sheetY + 60, rowW = W - 32;

      L.pauseRowAbandon = null;
      if (M.isHardcore(mode)) {
        R.roundRect(ctx, rowX, rowY, rowW, rowH, 12, '#FFF3E0');
        R.textBold(ctx, '🔥 放弃硬核', rowX + 16, rowY + rowH / 2, 16, '#E64A19', 'left', 'middle');
        L.pauseRowAbandon = { x: rowX, y: rowY, w: rowW, h: rowH };
        rowY += rowH + rowGap;
      }

      R.roundRect(ctx, rowX, rowY, rowW, rowH, 12, '#F5F5F5');
      R.textBold(ctx, '🏠 返回首页', rowX + 16, rowY + rowH / 2, 16, '#333', 'left', 'middle');
      L.pauseRowBack = { x: rowX, y: rowY, w: rowW, h: rowH };
      rowY += rowH + rowGap;

      // Read-only title block
      var difficultyLabel = (PG && PG.DIFFICULTY_CONFIG && PG.DIFFICULTY_CONFIG[difficulty] && PG.DIFFICULTY_CONFIG[difficulty].label) || difficulty;
      var titleStr = puzzle.dateStr + ' · ' + difficultyLabel + (M.isHardcore(mode) ? ' · 🔥 硬核' : '');
      R.text(ctx, titleStr, rowX, rowY + 8, 13, '#666', 'left');
```

> Note: `PG` is the puzzleGenerator module (search `require('./puzzleGenerator')` near the top of gameScene.js; if the local var has a different name, adjust). If `PG.DIFFICULTY_CONFIG` is not in scope at this file, fall back to the raw `difficulty` string.

- [ ] **Step 3: Render the abandon-confirm dialog (on top of the sheet) when `abandonConfirmOpen`**

After the `if (pauseMenuOpen) { ... }` block, add a separate overlay:

```js
    if (abandonConfirmOpen) {
      R.overlay(ctx, W, H);
      var dW = W * 0.84, dH = 200;
      var dx = (W - dW) / 2, dy = (H - dH) / 2;
      R.roundRect(ctx, dx, dy, dW, dH, 14, '#fff');
      R.textBold(ctx, '放弃硬核?', dx + dW / 2, dy + 32, 18, '#333', 'center', 'middle');
      R.text(ctx, '放弃后本局不再计入今日硬核通关，确定?', dx + dW / 2, dy + 70, 13, '#666', 'center');
      var cBtnW = (dW - 48) / 2, cBtnH = 44;
      L.abandonCancelBtn  = { x: dx + 16,                  y: dy + dH - 16 - cBtnH, w: cBtnW, h: cBtnH };
      L.abandonConfirmBtn = { x: dx + 16 + cBtnW + 16,     y: dy + dH - 16 - cBtnH, w: cBtnW, h: cBtnH };
      R.button(ctx, L.abandonCancelBtn.x,  L.abandonCancelBtn.y,  cBtnW, cBtnH, '取消',     '#eee',    '#333', 8);
      R.button(ctx, L.abandonConfirmBtn.x, L.abandonConfirmBtn.y, cBtnW, cBtnH, '确定放弃', '#E64A19', '#fff', 8);
    } else {
      L.abandonCancelBtn = null;
      L.abandonConfirmBtn = null;
    }
```

- [ ] **Step 4: Wire hit handlers — entries + confirm dialog**

In `scene.onTouchEnd`, find the block added in Task 6 (the `if (pauseMenuOpen) { ... }` block). Replace its body with the full handler:

```js
    if (abandonConfirmOpen) {
      if (L.abandonCancelBtn && R.hitTest(x, y, L.abandonCancelBtn)) {
        abandonConfirmOpen = false;
        scene.dirty = true;
        return;
      }
      if (L.abandonConfirmBtn && R.hitTest(x, y, L.abandonConfirmBtn)) {
        // Downgrade: rebuild mode without hardcore, repaint, persist.
        mode = M.createMode({ hardcore: false });
        scene.mode = mode;
        abandonConfirmOpen = false;
        pauseMenuOpen = false;
        _tempSlot.markDirty(captureState());
        showToast('已切回普通模式');
        scene.dirty = true;
        return;
      }
      return; // swallow taps elsewhere while confirm is open
    }
    if (pauseMenuOpen) {
      if (L.pauseRowAbandon && R.hitTest(x, y, L.pauseRowAbandon)) {
        abandonConfirmOpen = true;
        scene.dirty = true;
        return;
      }
      if (L.pauseRowBack && R.hitTest(x, y, L.pauseRowBack)) {
        pauseMenuOpen = false;
        // Same callback path as the top-left back arrow uses.
        if (callbacks && callbacks.onBack) callbacks.onBack();
        return;
      }
      if (L.pauseSheet && R.hitTest(x, y, L.pauseSheet)) {
        return; // tap on blank sheet area = no-op
      }
      pauseMenuOpen = false;
      scene.dirty = true;
      return;
    }
    if (L.pauseBtn && R.hitTest(x, y, L.pauseBtn)) {
      pauseMenuOpen = true;
      scene.dirty = true;
      return;
    }
```

(This entire block replaces the slimmer version from Task 6.)

- [ ] **Step 5: Syntax check + tests**

Run:
```bash
node --check minigame/js/gameScene.js
npm test
```
Expected: clean; no regression.

- [ ] **Step 6: Manual smoke**

In WeChat 开发者工具:
- Start a **hardcore** expert game → ☰ → sheet shows: `🔥 放弃硬核` row (orange), `🏠 返回首页` row (grey), title `YYYY-MM-DD · 加班赶报告 · 🔥 硬核`.
- Tap 🔥 放弃硬核 → confirm dialog appears with `取消` / `确定放弃` buttons.
- Tap 取消 → dialog closes, sheet still open, row still there.
- Tap 🔥 放弃硬核 again → confirm dialog → 确定放弃 → toast `已切回普通模式`, sheet closes, control row now shows 4 buttons (`💡 提示 / ↺ 重开 / 🎲 随机 / 🎯 选题`), open ☰ again → no `放弃硬核` row, title shows `... · 加班赶报告` (no 🔥 suffix).
- Start a **non-hardcore** game → ☰ → sheet shows only `🏠 返回首页` + title (no `放弃硬核` row).
- Tap 🏠 返回首页 → returns to selectScene (same as ↩).

- [ ] **Step 7: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/gameScene): pause-menu entries + 放弃硬核 downgrade flow"
```

---

## Task 8: gameScene — `markHardcoreCleared` on win + "🔥 硬核通关" label in win modal

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

- [ ] **Step 1: Call `markHardcoreCleared` on hardcore wins; carry the boolean into `winStats`**

In `calendar-puzzle-miniprogram/minigame/js/gameScene.js`, find the puzzle.success block at line ~415-430 (the block that sets `var insomniaUnique = null; if (isInsomnia) { ... }` and then builds `winStats = { ... }`). Modify it as follows:

After the existing `if (isInsomnia) { ... }` block, before `winStats = {`, add:

```js
        var hardcoreClear = false;
        if (M.isHardcore(mode)) {
          progress.markHardcoreCleared(puzzle.dateStr, difficulty);
          hardcoreClear = true;
        }
```

In the `winStats = { ... }` literal, add one new key:

```js
          hardcore: hardcoreClear,
```

Resulting block:

```js
        var insomniaUnique = null;
        if (isInsomnia) {
          insomniaUnique = progress.markUniqueInsomnia(puzzle.dateStr, buildBoardKey());
        }
        var hardcoreClear = false;
        if (M.isHardcore(mode)) {
          progress.markHardcoreCleared(puzzle.dateStr, difficulty);
          hardcoreClear = true;
        }
        winStats = {
          time: timer,
          isNewPB: pb.isNew,
          prevPB: pb.prev,
          todayDone: progress.countCompletedForDate(puzzle.dateStr),
          insomniaUnique: insomniaUnique,
          hardcore: hardcoreClear,
        };
```

Note: `hardcoreClear` reflects "this clear was a hardcore clear", not `markHardcoreCleared`'s return value — so the label appears even on a same-day repeat clear.

- [ ] **Step 2: Render "🔥 硬核通关" label in the win modal**

Find the win-modal text rendering block. Use the existing `'🎉 恭喜通关'` string as an anchor — search:
```bash
grep -n "恭喜通关\|isNewPB\|winStats\." minigame/js/gameScene.js | head -30
```

In the modal's text-render section (where `winStats.time`, `winStats.isNewPB`, `winStats.todayDone` are drawn), add a conditional line **before** the time/PB line so the badge sits at the top:

```js
        if (winStats.hardcore) {
          R.textBold(ctx, '🔥 硬核通关', winModalCenterX, winModalCursorY, 16, '#E64A19', 'center', 'middle');
          winModalCursorY += 24;
        }
```

> Variable names `winModalCenterX` / `winModalCursorY` are placeholders for whatever local coordinates the existing render block uses. Read 20 lines around `winStats.time` to find the actual identifiers (often `mx`, `my`, `cx`, `cy`, etc.), and substitute. The conditional + bumping logic is the contract.

- [ ] **Step 3: Syntax check + tests**

Run:
```bash
node --check minigame/js/gameScene.js
npm test
```
Expected: clean; no regression.

- [ ] **Step 4: Manual smoke**

In WeChat 开发者工具:
- Start a hardcore easy game (`digCount: 3`, fastest to win). Place blocks to win.
- Win modal shows **"🔥 硬核通关"** at the top of the stats block.
- Open the WeChat 开发者工具 console → run `wx.getStorageSync('calendarPuzzleHardcoreDays')` → JSON includes `{ "<today>": { "easy": true } }`.
- Start a NON-hardcore easy game → win → modal shows NO `🔥 硬核通关` line; storage unchanged for this difficulty.
- Start a hardcore expert game → mid-game ☰ → 放弃硬核 → 确定放弃 → finish the game → win modal has NO `🔥 硬核通关` line; storage NOT updated for `expert`.

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/gameScene): mark hardcore clear on win + 🔥 硬核通关 modal label"
```

---

## Task 9: CHANGELOG 0.7.0

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/CHANGELOG.md`

- [ ] **Step 1: Prepend the 0.7.0 entry at the top of the changelog (above the most recent 0.6.0 block)**

Insert at the top of `calendar-puzzle-miniprogram/minigame/CHANGELOG.md`:

```markdown
## [0.7.0] — 2026-05-27

### Added
- 硬核模式开关（`selectScene` 难度按钮下方一行，🔥 toggle，per-session 不持久）。开启后任何底层难度均进入硬核局。
- 暂停菜单 ☰（顶栏右上）半屏 sheet — MVP 三条：`🔥 放弃硬核`（仅硬核局可见，单向降级）、`🏠 返回首页`、当前题面只读信息。
- 通关结算页"🔥 硬核通关"标签（仅硬核局展示）。
- `progress.hardcoreDays` 持久化每日每难度的硬核通关记录（storage key `calendarPuzzleHardcoreDays`）。
- `mode.js` 模块：mode 对象 + capability helpers（`canUseHint` / `canSwapPuzzle` / `canRestart` / `canClearBoard`），未来扩展模式的容器。

### Changed
- 硬核局控制行折叠为 1 个按钮 "🧹 清空"（替代 "↺ 重开"），**清空时计时器不重置**；提示、🎲 随机、🎯 选题在硬核局不渲染。
- 存档 slot payload 新增 `mode: { hardcore: bool }` 字段；老存档无此字段自动视作非硬核（向后兼容，无需迁移）。
- `createGameScene(...)` 入参增加第 7 位 `modeOpts`；`selectScene` `onSelect(difficulty, savedState, modeOpts)`；`main.js` 三层透传。

### Tests
- 新 `tests/mode.test.js`：mode 模块全分支（7 用例）。
- 新 `tests/progress.hardcore.test.js`：hardcoreDays 持久化 + 幂等 + 跨难度并存 + storage round-trip（5 用例）。
- `tests/slotStore.test.js` +2：`mode` 字段 round-trip + 老 payload 无字段回读。

### Manual verification required (真机 / 微信开发者工具)
- 见 `docs/superpowers/specs/2026-05-27-hardcore-mode-design.md` §6.2 (1-8)。
```

- [ ] **Step 2: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/CHANGELOG.md
git commit -m "docs(minigame): CHANGELOG 0.7.0 — hardcore mode"
```

---

## Final verification

After Task 9 is committed, run:

```bash
cd calendar-puzzle-miniprogram
npm test
```

Expected: all prior tests pass + 14 new tests (mode: 7, progress.hardcore: 5, slotStore: 2). Record the total in the eventual PR description.

Then run the manual smoke matrix in `docs/superpowers/specs/2026-05-27-hardcore-mode-design.md` §6.2 (paths 1-8) on real device or WeChat 开发者工具. Record evidence (screenshot paths + console outputs) before flipping the `feature_list.json` entry to `passing`.

---

## Self-Review Notes

**Spec coverage:**

| Spec section | Covered by |
|---|---|
| §2.1 Mode 抽象 | Task 1 |
| §2.2 selectScene 入口 UI | Task 4 |
| §2.3 gameScene 内 gating (4 处) | Task 5 (#1, #2, #3, #4 unified — `nCtrl` capability-driven) |
| §2.4 暂停菜单 (MVP 3 条) | Task 6 (chrome) + Task 7 (entries + 放弃硬核 flow) |
| §2.5 通关判定 & 进度记录 | Task 2 (progress functions) + Task 8 (call site + modal label) |
| §3 数据流 | Tasks 3, 5, 7, 8 in aggregate |
| §4.1 存档 schema | Task 3 (captureState + slotStore tests) |
| §4.2 progress 持久层 | Task 2 |
| §5 错误处理 & 兼容性 | Old-save default (Task 3 mode resolution); slotStore legacy test (Task 3 step 1) |
| §6.1 单元测试 | Tasks 1, 2, 3 |
| §6.2 手测路径 (1-8) | Final verification section + per-task smoke notes |
| §7 已知风险 | Acknowledged in tasks (☰ placement uses `pad` not safe-area collision; assumes backBtn coexists) |
| §9 文件清单 | All listed files appear in this plan |

**Placeholder scan:** No `TBD`/`TODO`/`fill-in`. Two locations use the explicit phrasing `> Implementation note for the engineer:` to flag a context-dependent identifier (variable name in the win modal in Task 8 Step 2; `puzzle.placed` vs scene-local `placed` in Task 5 Step 3). These are *findable in 30 seconds* with a grep and the surrounding intent is fully specified.

**Type / API consistency:**
- `M.createMode(opts)` defined Task 1, used Tasks 3, 7, 8.
- `M.isHardcore(mode)` / `M.canUseHint(mode)` / `M.canSwapPuzzle(mode)` / `M.canRestart(mode)` defined Task 1, used Tasks 5, 7, 8.
- `progress.markHardcoreCleared(dateStr, difficulty)` / `progress.hasHardcoreCleared(dateStr, difficulty)` defined Task 2, used Task 8.
- Save payload `mode: {hardcore: bool}` shape consistent across Task 3 (captureState), Task 3 (slotStore tests), Task 4 (selectScene → onSelect), Task 5 (`mode` local in gameScene), Task 7 (downgrade rewrites it).
- Scene mode access uses `mode` (the local var) at the call site, mirrored on `scene.mode` for external readers (used by `main.js` `onSwitchPuzzle` callback in Task 3 Step 5d).
