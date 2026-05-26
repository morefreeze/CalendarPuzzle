# Hint-Locked Rotate / Flip Buttons — Disabled Visual State

**Date:** 2026-05-26
**Scope:** WeChat mini-program (`calendar-puzzle-miniprogram/minigame/js/gameScene.js`)
**Status:** Approved, ready for implementation plan

## Problem

When the player applies a weak hint to a block, the hint state machine
(`hint.js`) locks that block's orientation: subsequent attempts to rotate or
flip it are silently rejected (a toast appears, the shape doesn't change).

The rotate (`↻ 旋转`) and flip (`⇋ 翻转`) buttons in the selection-preview
row, however, render in their normal active colors (green `#66BB6A` and teal
`#26A69A`) regardless of lock state. The player only finds out the buttons
are dead by tapping them and reading the toast — the affordance and the
behavior disagree.

The palette card for a hint-locked block already shows a "hinted" visual
(brand-light fill + brand border, `gameScene.js:1082-1083`), but the
selection-preview controls do not propagate that signal.

## Goal

When the currently-selected block has its orientation locked, render the
rotate and flip buttons in a disabled style so the player can see, before
tapping, that those actions are unavailable. Tapping a disabled button still
explains why via a toast.

## Non-goals

- No changes to the hint state machine (`hint.js`) or its predicates.
- No changes to the palette card rendering — its hinted treatment already exists.
- No changes to drag/drop behavior, hint dialogs, or other buttons.
- No new tests. This is a pure visual + string change; the existing
  `tests/hint.test.js` coverage of `isOrientationLocked` is unaffected.

## Design

### Trigger predicate

Reuse the existing `Hint.isOrientationLocked(hintState, selected.id)`. It is
already true for both weak-locked and strong-locked blocks. In practice
strong-locked blocks are placed on the board and not in the palette, so the
disabled state will, in practice, only appear for weak-hinted blocks — but
keying off the unified predicate avoids divergence if strong-lock semantics
ever change.

### Render change — `gameScene.js` preview row (~line 1062–1073)

Current:

```js
R.button(ctx, rB.x, rB.y, rB.w, rB.h, '↻ 旋转', '#66BB6A', '#fff', 8);
R.button(ctx, fB.x, fB.y, fB.w, fB.h, '⇋ 翻转', '#26A69A', '#fff', 8);
```

New: branch the fill color on the lock predicate. Disabled fill is
`#cfcfcf`, matching the precedent set by the 重开 button at
`gameScene.js:938` (`dropped.length ? NEUTRAL : '#cfcfcf'`). Text color
stays `#fff` for consistency with that precedent.

Sketch:

```js
var locked = Hint.isOrientationLocked(hintState, selected.id);
var rotateFill = locked ? '#cfcfcf' : '#66BB6A';
var flipFill   = locked ? '#cfcfcf' : '#26A69A';
R.button(ctx, rB.x, rB.y, rB.w, rB.h, '↻ 旋转', rotateFill, '#fff', 8);
R.button(ctx, fB.x, fB.y, fB.w, fB.h, '⇋ 翻转', flipFill,   '#fff', 8);
```

The button labels and geometry do not change.

### Tap change — `gameScene.js` (~line 2455–2476)

The existing tap handlers already early-return with a toast when the lock
predicate is true. Replace the shared toast string with per-action wording:

- Rotate button (line ~2457): `'方向已被提示锁定，无法旋转'`
- Flip button (line ~2468): `'方向已被提示锁定，无法翻转'`

The wording uses "提示" (not "弱提示") because the predicate is shared with
strong hint; the message remains accurate either way.

No other logic in those handlers changes.

## Files touched

- `calendar-puzzle-miniprogram/minigame/js/gameScene.js` — preview-row
  render (~line 1065-1066) and the two preview-button tap handlers
  (~line 2457, ~line 2468).

## Files explicitly NOT touched

- `calendar-puzzle-miniprogram/minigame/js/hint.js` — state machine and
  `isOrientationLocked` predicate unchanged.
- `calendar-puzzle-miniprogram/tests/hint.test.js` — predicate behavior is
  unchanged.
- Palette card rendering in `gameScene.js` — already shows a hinted state.

## Verification

Manual walkthrough in the mini-program:

1. Start a fresh puzzle, select a block, confirm rotate/flip are
   green/teal and functional.
2. Open the hint panel, apply a **weak hint** to a different block.
3. Select the now-weak-hinted block from the palette.
4. **Expected:** rotate and flip buttons render in gray (`#cfcfcf`,
   white text); the button label and position are unchanged.
5. Tap the rotate button — expect toast `'方向已被提示锁定，无法旋转'`,
   no shape change.
6. Tap the flip button — expect toast `'方向已被提示锁定，无法翻转'`,
   no shape change.
7. Select a non-hinted block — confirm its rotate/flip render in the
   normal active colors and still work.

Evidence to capture for `feature_list.json`: screenshot of selected
hint-locked block with grayed buttons, plus the two toast messages.

## Risks

- **Color contrast on disabled state.** White text on `#cfcfcf` is the
  same combination already used by the 重开 button, so any
  legibility issue is pre-existing and not introduced by this change.
- **Strong-hinted blocks edge case.** If strong-hint semantics ever
  change to leave the block in the palette, the disabled state will
  appear correctly for them too (predicate already covers it). No
  action needed.
