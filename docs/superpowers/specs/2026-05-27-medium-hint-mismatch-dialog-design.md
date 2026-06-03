# Medium-Hint Mismatch Dialog — Design

**Date:** 2026-05-27
**Status:** Draft (pending review)
**Surface:** WeChat mini-game (`calendar-puzzle-miniprogram/minigame/`)

## Problem

When the player uses a medium hint, `hintState.mediumLocked[blockId]` records the
revealed cells and the board renders them as orange-bordered cells. Today,
nothing stops the player from contradicting the hint:

- **Scenario A — wrong block on hint cell.** They drop a different block (Y)
  onto cells that were revealed for block X. The orange hint cells get partially
  hidden under Y; X can no longer land there.
- **Scenario B — right block, wrong location.** They drop block X itself but
  not at the revealed cells. The hint cells stay visible and orphaned; X is
  stuck somewhere it cannot complete the puzzle.

The player has paid for the hint (stamina or a voucher) and now has a dead
hint sitting on the board with no in-game indication that something is wrong.
A toast was discussed and rejected — it is too transient for a player who has
spent real currency on the hint.

## Goal

When a placement contradicts an active medium hint, surface a modal dialog
that names the conflict, lets the player undo the placement in one tap, and
lets them opt out of further dialogs for the rest of the puzzle attempt.

## Non-Goals

- Weak / strong hint mismatches. (Weak prevents rotate/flip via separate
  affordance; strong-locked blocks already cannot be removed by double-tap.)
- Preventing the placement itself. The drop completes; the dialog reacts.
- Coaching the player toward the correct placement (no "drop here" arrow).
  The orange hint cells already convey location.

## Scope

### Trigger

Called at the end of `placeBlock(...)` in `gameScene.js`, before `checkWin()`,
guarded by `!hintState.mediumMismatchIgnored`.

### Detection — `Hint.findMediumMismatch(state, blockId, blockCells)`

Pure function in `hint.js`. Returns the first violation in this priority:

1. **Scenario B (right block wrong location)** — `mediumLocked[blockId]` exists
   and non-empty, and `mediumLocked[blockId]` is NOT a subset of `blockCells`.
   Returns `{ kind: 'right-block-wrong-loc', blockId }`.

2. **Scenario A (wrong block on hint cell)** — for any `X ≠ blockId` with
   non-empty `mediumLocked[X]`, the intersection `mediumLocked[X] ∩ blockCells`
   is non-empty. Returns `{ kind: 'wrong-block-on-hint', placedBlockId: blockId, hintedBlockId: X }`.

3. Returns `null` otherwise.

Rationale for B-before-A: when a block has its own active hint, "you didn't
cover your own hint" is the most direct framing. If B violates and also happens
to cover another block's hint, B wins.

Only one violation is reported per drop. Subsequent violations come into focus
naturally as the player resolves the current one (or after they ignore the
round).

### Suppression — `hintState.mediumMismatchIgnored`

New boolean field on `hintState`. Defaults to `false` from `createHintState`.
Round-tripped by `restoreHintState` so the flag persists across save / reload.
Resets naturally when `hintState` is recreated for a new puzzle (`createHintState`
fires per `puzzleId`).

New pure setter `Hint.setMediumMismatchIgnored(state) → newState` (immutable
update via `Object.assign({}, state, { mediumMismatchIgnored: true })`).

No getter — read the field directly.

### Dialog

Modal, rendered after `staminaConfirm` in the gameScene draw pipeline.
Blocks every other tap target.

**Visual:**
- Black overlay `rgba(0,0,0,0.35)` over the entire canvas.
- White rounded card centered, width matches the `staminaConfirm` card.
- Round close button (×) at top-right, 22×22 light-gray.
- Title: `"和中提示不一致"`.
- Body, by `kind`:
  - `right-block-wrong-loc`: `"你刚把 [B-icon] 放到了别的位置，但它的中提示还在等它。"`
  - `wrong-block-on-hint`: `"你刚把 [B-icon] 放到了 [X-icon] 的中提示位置上。"`
  - `[icon]` is an inline mini-rendering of the block's `shape` matrix at
    ~7px per cell, in the block's color.
- Primary button (`#43A047` green): `"取回并重新选中"`.
- Text button (gray, smaller): `"本局不再提示"`.

### Actions

- **取回 (take back)**: `removeDropped(placedId)` already pops from `dropped`,
  pushes a fresh clone onto `palette`, sets `selected = null`, and dirties
  `_tempSlot`. The dialog handler then locates that newly-pushed clone in
  `palette` (last entry with matching `id`) and assigns it to `selected` so
  the player sees the take-back land in "selected" state. Close dialog.
- **本局不再提示**: `hintState = Hint.setMediumMismatchIgnored(hintState)`.
  Close dialog. `_tempSlot.markDirty(captureState())` so the new ignored
  state lands in the save slot.
- **× / close**: close dialog only. Do not write hintState. Next contradicting
  drop will fire the dialog again.

### State in gameScene

```js
var mediumMismatchModal = null;   // null | { kind, blockId? , placedBlockId?, hintedBlockId? }
var mediumMismatchLayoutCache = null;
```

Layout cache follows the same pattern as `slotPickerLayoutCache` — computed
on first render after the modal opens, cleared when modal closes.

### Save-slot

No changes to `captureState()` shape. `hintState.mediumMismatchIgnored`
piggybacks on the existing `hintState` round-trip wired through
`restoreHintState` (Bug #1 fix, 0.5.4).

The transient `mediumMismatchModal` UI state is **not** persisted — if a
player saves with the dialog open, they reload with the dialog closed and
the placement still in `dropped`. That is the right behavior (a save mid-
mistake should not lock the player into a modal across sessions).

## Edge Cases

- **No active medium hints.** `mediumLocked` empty → `findMediumMismatch`
  returns `null` immediately. No dialog.
- **Drop replays into a slot from before this feature shipped.** Saved
  hintState has no `mediumMismatchIgnored` field. `restoreHintState`
  defaults it to `false`. No migration needed.
- **Block dropped via tutorial / initialDropped restore.** Those paths do
  NOT call `placeBlock` — they push into `dropped[]` directly. Detection
  is skipped, which matches intent (tutorial / restore is not a user mistake).
- **Block placed, dialog opens, then player force-removes the block via
  double-tap.** Existing `removeDropped` path. The dialog stays open
  pointing at a now-absent block. Mitigation: the **取回** button calls
  `removeDropped` defensively (no-op if already gone) and the **× / 本局
  不再提示** paths simply close. Acceptable degraded state.
- **Player wins despite the mismatch.** Impossible by board geometry — a
  mismatched placement cannot lead to a valid solve covering the hinted
  cells with the hinted block. `checkWin()` not being called on the mismatch
  drop is therefore safe.
- **Multi-violation drop.** Only the first violation per the priority
  ordering is reported. Resolution unblocks the next.

## Testing

`tests/hint.test.js` additions, all against pure `findMediumMismatch` /
`setMediumMismatchIgnored`:

1. `mediumLocked` empty → returns `null`.
2. Block has own hint, drop covers all hint cells → returns `null`.
3. Block has own hint, drop misses one hint cell → returns
   `right-block-wrong-loc` for that block.
4. Block has no hint, drop covers another block's hint cell → returns
   `wrong-block-on-hint` with `hintedBlockId` set.
5. Block has own hint AND covers another's hint → returns
   `right-block-wrong-loc` (priority order).
6. `mediumMismatchIgnored` true is ignored by `findMediumMismatch` — caller's
   responsibility to short-circuit. (Test that the field's mere presence does
   not affect detection.)
7. `setMediumMismatchIgnored` returns a new state with the flag set; original
   state untouched (immutability).
8. `restoreHintState` round-trips `mediumMismatchIgnored: true` from a saved
   slot. `restoreHintState` defaults `mediumMismatchIgnored: false` when the
   field is absent from saved data.

`gameScene.js` UI integration is canvas-rendered and has no test harness —
verification is manual through WeChat DevTools, recorded in
`feature_list.json` evidence per the existing convention.

## Files Touched

- `calendar-puzzle-miniprogram/minigame/js/hint.js` — three new pieces:
  `createHintState` adds `mediumMismatchIgnored: false`, `restoreHintState`
  round-trips it, `findMediumMismatch` + `setMediumMismatchIgnored` added
  and exported.
- `calendar-puzzle-miniprogram/minigame/js/gameScene.js` — new modal state
  variables, trigger call inside `placeBlock`, render block + tap handler.
- `calendar-puzzle-miniprogram/tests/hint.test.js` — 8 new cases.
- `calendar-puzzle-miniprogram/minigame/CHANGELOG.md` — new entry.

## Files Explicitly NOT Touched

- `block.js` — if `B.cellsOf` does not already exist, the helper goes into
  `gameScene.js` (it's a 5-line iteration). Adding it to `block.js` would
  pull in a separate refactor pass we don't want here.
- `puzzleGenerator.js`, `solver.js`, `tempSlot.js`, `cloudClient.js` — no
  cross-cutting changes.
- Weak / strong hint paths — out of scope.
