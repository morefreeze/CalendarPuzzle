# Hint-Locked Rotate / Flip Buttons — Disabled Visual State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the preview-row rotate (`↻ 旋转`) and flip (`⇋ 翻转`) buttons in a disabled gray style when the currently selected block has its orientation locked by a hint, and replace the shared "locked" toast with per-action wording so the user knows which action was blocked.

**Architecture:** Pure visual + string change inside `calendar-puzzle-miniprogram/minigame/js/gameScene.js`. Reuses the existing `Hint.isOrientationLocked(hintState, blockId)` predicate (already imported at line 10). Disabled fill `#cfcfcf` matches the precedent set by the 重开 button at line 938. No new modules, no state changes, no test changes — `gameScene.js` is a Canvas scene and the repo has no unit-test harness for it; verification is a manual mini-program walkthrough.

**Tech Stack:** Plain JS (no TypeScript), WeChat mini-game Canvas API via `R` (`./render`) helpers, hint state via `Hint` (`./hint`).

**Spec:** `docs/superpowers/specs/2026-05-26-hint-locked-rotate-flip-disabled-design.md`

---

### Task 1: Gray the rotate/flip buttons when the selected block is orientation-locked

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:1062-1073`

- [ ] **Step 1: Confirm current state of the preview-row render block**

Run: `sed -n '1062,1073p' calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected output (must match before editing):

```js
    if (selected && !dragging && L.previewShape) {
      var prevCS = Math.floor(cs * 0.55);
      var rB = L.previewRotateBtn, fB = L.previewFlipBtn, sB = L.previewShape;
      R.button(ctx, rB.x, rB.y, rB.w, rB.h, '↻ 旋转', '#66BB6A', '#fff', 8);
      R.button(ctx, fB.x, fB.y, fB.w, fB.h, '⇋ 翻转', '#26A69A', '#fff', 8);
      R.roundRect(ctx, sB.x, sB.y, sB.w, sB.h, 8, BRAND_LIGHT, BRAND);
      var sbw = selected.shape[0].length * prevCS;
      var sbh = selected.shape.length * prevCS;
      var sbx = sB.x + (sB.w - sbw) / 2;
      var sby = sB.y + (sB.h - sbh) / 2;
      R.blockShape(ctx, selected.shape, selected.color, sbx, sby, prevCS);
    }
```

If output differs, STOP and reconcile line numbers before continuing.

- [ ] **Step 2: Edit the preview-row render to branch on orientation lock**

Use Edit on `calendar-puzzle-miniprogram/minigame/js/gameScene.js`.

`old_string`:

```js
    if (selected && !dragging && L.previewShape) {
      var prevCS = Math.floor(cs * 0.55);
      var rB = L.previewRotateBtn, fB = L.previewFlipBtn, sB = L.previewShape;
      R.button(ctx, rB.x, rB.y, rB.w, rB.h, '↻ 旋转', '#66BB6A', '#fff', 8);
      R.button(ctx, fB.x, fB.y, fB.w, fB.h, '⇋ 翻转', '#26A69A', '#fff', 8);
```

`new_string`:

```js
    if (selected && !dragging && L.previewShape) {
      var prevCS = Math.floor(cs * 0.55);
      var rB = L.previewRotateBtn, fB = L.previewFlipBtn, sB = L.previewShape;
      var orientationLocked = Hint.isOrientationLocked(hintState, selected.id);
      var rotateFill = orientationLocked ? '#cfcfcf' : '#66BB6A';
      var flipFill = orientationLocked ? '#cfcfcf' : '#26A69A';
      R.button(ctx, rB.x, rB.y, rB.w, rB.h, '↻ 旋转', rotateFill, '#fff', 8);
      R.button(ctx, fB.x, fB.y, fB.w, fB.h, '⇋ 翻转', flipFill, '#fff', 8);
```

- [ ] **Step 3: Verify the edit landed cleanly**

Run: `sed -n '1062,1075p' calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected output:

```js
    if (selected && !dragging && L.previewShape) {
      var prevCS = Math.floor(cs * 0.55);
      var rB = L.previewRotateBtn, fB = L.previewFlipBtn, sB = L.previewShape;
      var orientationLocked = Hint.isOrientationLocked(hintState, selected.id);
      var rotateFill = orientationLocked ? '#cfcfcf' : '#66BB6A';
      var flipFill = orientationLocked ? '#cfcfcf' : '#26A69A';
      R.button(ctx, rB.x, rB.y, rB.w, rB.h, '↻ 旋转', rotateFill, '#fff', 8);
      R.button(ctx, fB.x, fB.y, fB.w, fB.h, '⇋ 翻转', flipFill, '#fff', 8);
      R.roundRect(ctx, sB.x, sB.y, sB.w, sB.h, 8, BRAND_LIGHT, BRAND);
      var sbw = selected.shape[0].length * prevCS;
      var sbh = selected.shape.length * prevCS;
      var sbx = sB.x + (sB.w - sbw) / 2;
      var sby = sB.y + (sB.h - sbh) / 2;
      R.blockShape(ctx, selected.shape, selected.color, sbx, sby, prevCS);
    }
```

- [ ] **Step 4: Smoke-test that the file still parses**

Run: `node --check calendar-puzzle-miniprogram/minigame/js/gameScene.js`
Expected: no output, exit code 0.

(`node --check` only validates JS syntax. It will NOT catch missing references like `hintState`, but `hintState` already exists in the same closure — both the tap handlers in Task 2 and the existing palette-card render at line 1081 read it. If `--check` passes, the syntactic edit is clean.)

- [ ] **Step 5: Run the existing hint test suite to confirm no regression**

Run: `cd calendar-puzzle-miniprogram && node --test tests/hint.test.js`
Expected: all tests pass. This file isn't touched, but running it confirms the `Hint.isOrientationLocked` contract we depend on still holds.

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/hint): gray rotate/flip buttons when block orientation is hint-locked"
```

---

### Task 2: Replace the shared "locked" toast with per-action wording

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js:2455-2476`

- [ ] **Step 1: Confirm current state of the two tap handlers**

Run: `sed -n '2454,2476p' calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected output (must match before editing):

```js
    // Preview rotate / flip
    if (L.previewRotateBtn && R.hitTest(x, y, L.previewRotateBtn)) {
      if (selected) {
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('该方块方向已锁定'); return; }
        selected.shape = B.rotateShape(selected.shape);
        for (var rp = 0; rp < palette.length; rp++) {
          if (palette[rp].id === selected.id) palette[rp].shape = selected.shape;
        }
        scene.dirty = true;
      }
      return;
    }
    if (L.previewFlipBtn && R.hitTest(x, y, L.previewFlipBtn)) {
      if (selected) {
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('该方块方向已锁定'); return; }
        selected.shape = B.flipShape(selected.shape);
        for (var fp = 0; fp < palette.length; fp++) {
          if (palette[fp].id === selected.id) palette[fp].shape = selected.shape;
        }
        scene.dirty = true;
      }
      return;
    }
```

- [ ] **Step 2: Update the rotate-button toast**

Use Edit on `calendar-puzzle-miniprogram/minigame/js/gameScene.js`.

`old_string`:

```js
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('该方块方向已锁定'); return; }
        selected.shape = B.rotateShape(selected.shape);
```

`new_string`:

```js
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('方向已被提示锁定，无法旋转'); return; }
        selected.shape = B.rotateShape(selected.shape);
```

(`replace_all` is NOT used — the other locked-check toast belongs to the flip button and gets different wording in the next step.)

- [ ] **Step 3: Update the flip-button toast**

Use Edit on `calendar-puzzle-miniprogram/minigame/js/gameScene.js`.

`old_string`:

```js
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('该方块方向已锁定'); return; }
        selected.shape = B.flipShape(selected.shape);
```

`new_string`:

```js
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('方向已被提示锁定，无法翻转'); return; }
        selected.shape = B.flipShape(selected.shape);
```

- [ ] **Step 4: Verify both edits landed and no other `'该方块方向已锁定'` references remain**

Run: `grep -n "方向已被提示锁定\|该方块方向已锁定" calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Expected:

```
2457:        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('方向已被提示锁定，无法旋转'); return; }
2468:        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('方向已被提示锁定，无法翻转'); return; }
```

No line should contain the old `'该方块方向已锁定'` string.

- [ ] **Step 5: Smoke-test that the file still parses**

Run: `node --check calendar-puzzle-miniprogram/minigame/js/gameScene.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame/hint): per-action toast when rotate/flip is hint-locked"
```

---

### Task 3: Manual verification in the WeChat DevTools mini-program

`gameScene.js` is Canvas-render code with no unit-test harness in this repo (`grep -rn "gameScene" calendar-puzzle-miniprogram/tests/` returns nothing). The behavioral change is purely visual + a toast string, so the only meaningful verification is a manual walkthrough in the WeChat DevTools simulator.

**Files:**
- No code changes. This task only produces evidence.

- [ ] **Step 1: Open the mini-program in WeChat DevTools**

Open the `calendar-puzzle-miniprogram/` project in WeChat DevTools (mini-game project type). Hit the run button. The puzzle scene should load.

- [ ] **Step 2: Baseline — confirm rotate/flip work on a non-hinted block**

Select any block in the palette by tapping it. In the preview row near the bottom:
- Rotate button (`↻ 旋转`) should be green (`#66BB6A`).
- Flip button (`⇋ 翻转`) should be teal (`#26A69A`).

Tap rotate. Expected: the previewed shape rotates 90°. Tap flip. Expected: the shape mirrors.

- [ ] **Step 3: Apply a weak hint to a different block**

Tap the `💡 提示` button. In the tier picker, choose 弱提示 (the weak tier). Choose any block that is not currently selected (and not yet placed). Confirm. The hint state machine locks that block's orientation; its palette card should now render with the brand-light fill + brand border.

- [ ] **Step 4: Select the weak-hinted block and observe the disabled style**

Tap the weak-hinted block's palette card. Watch the preview row:
- Rotate button (`↻ 旋转`) renders in gray (`#cfcfcf`), white text.
- Flip button (`⇋ 翻转`) renders in gray (`#cfcfcf`), white text.
- Button labels and positions are unchanged.

**Capture a screenshot** showing the selected hint-locked block with both buttons grayed. Save it under a path you can reference in `feature_list.json` evidence.

- [ ] **Step 5: Confirm the per-action toasts on tap**

Tap the grayed rotate button. Expected toast: `方向已被提示锁定，无法旋转`. The shape must NOT change.
Tap the grayed flip button. Expected toast: `方向已被提示锁定，无法翻转`. The shape must NOT change.

Capture both toast strings (a single screenshot of each is fine).

- [ ] **Step 6: Regression check — non-hinted block still works**

Tap a different, non-hinted block to select it. Confirm:
- Rotate button is green again.
- Flip button is teal again.
- Both perform their normal shape transformation when tapped.

- [ ] **Step 7: Record evidence**

Update `feature_list.json`:
- If an entry for this feature already exists, set `status: passing` and add the screenshot path(s) plus the two toast strings into `evidence`.
- If no entry exists, add one with `status: passing`, the verification steps from this task, and the captured evidence.

Append a session record to `claude-progress.md` per the repo's session-handoff convention (newest section on top under `## 会话记录`), and overwrite `session-handoff.md` with the current state.

- [ ] **Step 8: Commit the evidence**

```bash
git add feature_list.json claude-progress.md session-handoff.md
git commit -m "chore(minigame/hint): record evidence for hint-locked rotate/flip disabled state"
```

(Skip files in this list that you did not modify.)
