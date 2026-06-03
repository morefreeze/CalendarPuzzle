# Share-snapshot grayscale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render placed puzzle pieces in randomized grayscale for one frame during the win-modal share snapshot, so the resulting share-card cover does not leak the solution.

**Architecture:** Add a one-shot render flag (`shareSnapshotMode`) to `gameScene.js`. On win-modal share-button click, generate a fresh shuffled gray palette keyed by piece id, force one synchronous redraw, call `wx.shareAppMessage`, then clear the flag on the next tick. A new tiny module `shareGrayPalette.js` owns palette generation and is unit-tested in isolation.

**Tech Stack:** Plain CommonJS modules under `calendar-puzzle-miniprogram/minigame/js/`. Tests use Node's built-in `node:test` / `node:assert` runner (`npm test` in `calendar-puzzle-miniprogram/`).

**Spec:** `docs/superpowers/specs/2026-06-02-share-snapshot-grayscale-design.md`

---

## File map

- **Create** `calendar-puzzle-miniprogram/minigame/js/shareGrayPalette.js`
  - Single export: `makeShareGrayPalette(pieceIds) -> { [id]: '#RRGGBB' }`.
  - Owns the gray ramp constant and the Fisher-Yates shuffle.
- **Create** `calendar-puzzle-miniprogram/tests/shareGrayPalette.test.js`
  - Unit tests for the palette module.
- **Modify** `calendar-puzzle-miniprogram/minigame/js/gameScene.js`
  - Add module-level state: `shareSnapshotMode`, `_lastCtx`, `_lastW`, `_lastH`.
  - Capture ctx/W/H at the top of `scene.render`.
  - Replace the piece-fill `ctx.fillStyle = blockAt.color;` at `:979` with a palette-aware lookup.
  - Wrap the win-modal share-button branch at `:2094` with the snapshot-mode setup / teardown.

No other files touched.

---

### Task 1: Palette module with TDD

**Files:**
- Create: `calendar-puzzle-miniprogram/minigame/js/shareGrayPalette.js`
- Test: `calendar-puzzle-miniprogram/tests/shareGrayPalette.test.js`

- [ ] **Step 1: Write the failing tests**

Create `calendar-puzzle-miniprogram/tests/shareGrayPalette.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');
var P = require('../minigame/js/shareGrayPalette');

test('makeShareGrayPalette: covers every input id', function () {
  var ids = ['A', 'B', 'C', 'D'];
  var pal = P.makeShareGrayPalette(ids);
  ids.forEach(function (id) {
    assert.ok(pal[id], 'expected palette entry for id ' + id);
    assert.match(pal[id], /^#[0-9A-Fa-f]{6}$/, 'expected hex color, got ' + pal[id]);
  });
});

test('makeShareGrayPalette: distinct ids get distinct grays when within ramp size', function () {
  var ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']; // 9 ids, ramp has 9 slots
  var pal = P.makeShareGrayPalette(ids);
  var values = ids.map(function (id) { return pal[id]; });
  var unique = new Set(values);
  assert.strictEqual(unique.size, ids.length, 'expected 9 distinct grays');
});

test('makeShareGrayPalette: repeated calls produce different orderings', function () {
  var ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  var seen = new Set();
  for (var i = 0; i < 50; i++) {
    var pal = P.makeShareGrayPalette(ids);
    seen.add(ids.map(function (id) { return pal[id]; }).join(','));
  }
  // With 9! permutations and 50 trials, collapsing to one ordering is ~impossible.
  assert.ok(seen.size > 1, 'expected at least 2 distinct orderings across 50 runs, got ' + seen.size);
});

test('makeShareGrayPalette: wraps when more ids than ramp slots', function () {
  var ids = [];
  for (var i = 0; i < 15; i++) ids.push('id' + i);
  var pal = P.makeShareGrayPalette(ids);
  ids.forEach(function (id) {
    assert.match(pal[id], /^#[0-9A-Fa-f]{6}$/);
  });
});

test('makeShareGrayPalette: empty input returns empty palette', function () {
  var pal = P.makeShareGrayPalette([]);
  assert.deepStrictEqual(pal, {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd calendar-puzzle-miniprogram && npm test -- --test-name-pattern='makeShareGrayPalette'`
Expected: FAIL — `Cannot find module '../minigame/js/shareGrayPalette'`.

- [ ] **Step 3: Implement the palette module**

Create `calendar-puzzle-miniprogram/minigame/js/shareGrayPalette.js`:

```js
// Per-share random gray palette keyed by piece id. Used by gameScene to
// repaint placed pieces in shades of gray for the one-frame win-modal
// share snapshot, so the share-card cover does not leak which piece is
// which. Reshuffled on every call — the recipient cannot reverse-map a
// shade back to a specific piece across shares.

var GRAY_RAMP = [
  '#A8A8A8', '#B0B0B0', '#B8B8B8',
  '#C0C0C0', '#C8C8C8', '#D0D0D0',
  '#D8D8D8', '#E0E0E0', '#E8E8E8',
];

function shuffled(arr) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy;
}

function makeShareGrayPalette(pieceIds) {
  var ramp = shuffled(GRAY_RAMP);
  var pal = {};
  for (var i = 0; i < pieceIds.length; i++) {
    pal[pieceIds[i]] = ramp[i % ramp.length];
  }
  return pal;
}

module.exports = {
  makeShareGrayPalette: makeShareGrayPalette,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd calendar-puzzle-miniprogram && npm test -- --test-name-pattern='makeShareGrayPalette'`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: All existing tests still pass; the 5 new tests also pass.

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/shareGrayPalette.js \
        calendar-puzzle-miniprogram/tests/shareGrayPalette.test.js
git commit -m "feat(minigame/share): add shareGrayPalette helper

Generates a per-share randomized 9-step gray palette keyed by piece id.
Used by the next commit to repaint placed pieces during the win-modal
share snapshot so the share-card cover does not leak the solution."
```

---

### Task 2: Wire grayscale into gameScene render + share handler

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js` (multiple specific locations)

This task has no automated test because gameScene rendering is canvas-only and the surrounding harness has no canvas mock. We verify manually in Task 3.

- [ ] **Step 1: Add the require at the top of gameScene.js**

At the top of `calendar-puzzle-miniprogram/minigame/js/gameScene.js`, alongside the other requires (look for `var shareState = require('./shareState');` near line 8), add **immediately after** that line:

```js
var shareGrayPalette = require('./shareGrayPalette');
```

- [ ] **Step 2: Add closure-scoped state**

Existing pattern (verified): `module.exports = function createGameScene(...)` at line 46 wraps everything; per-scene state like `dropped`, `palette`, `timer` is declared inside the closure starting around line 57. Place the new state in the same closure.

Find the existing line `var paletteOrder = palette.map(function (b) { return b.id; });` (around line 89). **Immediately after** that line, add:

```js
  // One-shot share-snapshot state. When non-null, the board piece-fill path
  // substitutes piece.color with palette[piece.id] so the canvas snapshot
  // taken by wx.shareAppMessage shows grayscale pieces, not the solution.
  // _lastCtx/_lastW/_lastH let the share handler force a synchronous redraw
  // before calling wx.shareAppMessage.
  var shareSnapshotMode = null;
  var _lastCtx = null, _lastW = 0, _lastH = 0;
```

Indentation is two spaces to match surrounding closure-scoped vars.

- [ ] **Step 3: Capture ctx at the top of scene.render**

Find `scene.render = function (ctx, W, H) {` (around line 887). Add as the **first** line inside the function body:

```js
    _lastCtx = ctx; _lastW = W; _lastH = H;
```

- [ ] **Step 4: Replace the piece-fill color at line 979**

Locate the existing block:

```js
        // Background
        if (blockAt) {
          ctx.globalAlpha = locked ? 0.92 : 0.95;
          ctx.fillStyle = blockAt.color;
          ctx.fillRect(px, py, cs, cs);
          ctx.globalAlpha = 1;
        } else if (isUncov) {
```

Change the `ctx.fillStyle = blockAt.color;` line to:

```js
          ctx.fillStyle = (shareSnapshotMode && shareSnapshotMode.palette[blockAt.id]) || blockAt.color;
```

Leave everything else in the block untouched.

- [ ] **Step 5: Wire the win-modal share button**

Locate the existing branch around line 2093:

```js
      if (L.shareBtn && R.hitTest(x, y, L.shareBtn)) {
        try { wx.shareAppMessage(shareState.buildShareData()); } catch (e) {}
        return;
      }
```

Replace it with:

```js
      if (L.shareBtn && R.hitTest(x, y, L.shareBtn)) {
        try {
          var ids = allBlocks().map(function (b) { return b.id; });
          shareSnapshotMode = { palette: shareGrayPalette.makeShareGrayPalette(ids) };
          if (_lastCtx) scene.render(_lastCtx, _lastW, _lastH);
          wx.shareAppMessage(shareState.buildShareData());
        } catch (e) {}
        setTimeout(function () {
          shareSnapshotMode = null;
          scene.dirty = true;
        }, 0);
        return;
      }
```

- [ ] **Step 6: Run the test suite to confirm no regression**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: All tests pass — gameScene has no direct unit tests; this is a guard against accidentally breaking a shared module imported by a test (e.g. shareState).

- [ ] **Step 7: Lint-style sanity check — verify line counts match expectations**

Run: `grep -c "shareSnapshotMode" calendar-puzzle-miniprogram/minigame/js/gameScene.js`
Expected: `4` (1 var decl + 1 in piece-fill + 1 in share-handler set + 1 in setTimeout cleanup).

Run: `grep -n "shareGrayPalette" calendar-puzzle-miniprogram/minigame/js/gameScene.js`
Expected: 2 lines — the `require` and the `makeShareGrayPalette` call.

- [ ] **Step 8: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/share): grayscale piece colors for win-modal share snapshot

On win-modal share-button tap: build a randomized gray palette via
shareGrayPalette.makeShareGrayPalette(allBlocks().map(b=>b.id)), set
shareSnapshotMode, force one synchronous scene.render so the canvas
shows gray pieces, call wx.shareAppMessage (system grabs this frame),
then clear on the next tick.

Other share entry points (group share, invite, capsule menu) unchanged
— they fire mid-game where the board has no full solution to leak."
```

---

### Task 3: Manual smoke verification + PR

**Files:** none modified.

- [ ] **Step 1: Run the full test suite one more time**

Run: `cd calendar-puzzle-miniprogram && npm test`
Expected: All tests pass.

- [ ] **Step 2: Verify the branch diff is what we expect**

Run: `git log origin/main..HEAD --oneline`
Expected: 3 commits — the design doc (Task 0), the palette module + tests (Task 1), the gameScene patch (Task 2).

Run: `git diff origin/main --stat`
Expected: 4 files changed: the design doc, the plan doc (this file), `shareGrayPalette.js`, the test, `gameScene.js`. (If the plan doc has not been committed yet, commit it as part of this task.)

- [ ] **Step 3: Commit the plan document if not already committed**

```bash
git add calendar-puzzle-miniprogram/docs/superpowers/plans/2026-06-02-share-snapshot-grayscale.md
git diff --cached --quiet || git commit -m "docs(minigame): implementation plan for share-snapshot grayscale"
```

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feature/share-grayscale-blocks
```

- [ ] **Step 5: Open the PR against main**

```bash
gh pr create --base main --title "feat(minigame): grayscale pieces in win-modal share snapshot" --body "$(cat <<'EOF'
## Summary
- Repaints placed puzzle pieces in randomized grayscale for the one frame the system snapshots when the player taps **分享** in the win modal, so the resulting share card no longer leaks the solution.
- The win modal already occludes everything except the top row of the board, so the grayscale only needs to apply to the piece-fill draw path — date cells, modal chrome, and slot UI are unaffected.
- New module `shareGrayPalette.js` owns the 9-step gray ramp + per-share Fisher-Yates shuffle, unit-tested in isolation. `gameScene.js` adds a `shareSnapshotMode` flag, captures `ctx/W/H` on each render, and on share-button tap: sets the flag, forces one synchronous redraw, calls `wx.shareAppMessage`, then clears on `setTimeout(0)`.
- Out of scope: group share, invite share, capsule-menu share — these fire mid-game and don't show a full solution.

Spec: `calendar-puzzle-miniprogram/docs/superpowers/specs/2026-06-02-share-snapshot-grayscale-design.md`
Plan: `calendar-puzzle-miniprogram/docs/superpowers/plans/2026-06-02-share-snapshot-grayscale.md`

## Test plan
- [x] `npm test` in `calendar-puzzle-miniprogram/` — all suites pass including 5 new `shareGrayPalette` tests
- [ ] Manual: open the mini-game, win a puzzle, tap **分享** from the win modal, open the resulting share card on a second device — confirm visible top row shows gray cells (not the original piece colors)
- [ ] Manual: tap **分享** twice in a row — confirm the gray arrangement differs between shares (palette reshuffles)
- [ ] Manual: confirm no visible gray flash on the player's own screen
- [ ] Manual: confirm group-share-for-ticket, invite-for-help, and capsule-menu share behave exactly as on `main`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Report the PR URL**

The `gh pr create` command prints the URL on success — surface it to the user.
