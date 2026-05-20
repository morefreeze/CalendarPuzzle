# Tutorial — Locked-block step (新增步骤 2 / 5)

Date: 2026-05-20
Status: approved
Scope: WeChat mini-game tutorial only (`calendar-puzzle-miniprogram/minigame/js/gameScene.js`)

## Background

The first-launch tutorial in the mini-game currently has 4 steps:

1. 步骤 1 / 4 · 游戏目标 — bubble at today's weekday marker, advance via "下一步 →"
2. 步骤 2 / 4 · 选中并放置 — drag the placeable palette block to the board
3. 步骤 3 / 4 · 双击移除 — double-tap the pre-placed-but-misplaced block to send it back to the palette
4. 步骤 4 / 4 · 完成挑战 — bottom rectangular dialog, persists until win/skip

Pre-placed locked blocks (`prePlacedBlocks` in the puzzle payload) are already
rendered with a lock badge via `R.lockBadge` (gameScene.js:944). They are
visible during the tutorial but never explained — a new user has no way to
know they are immovable and may waste taps trying to drag them.

## Goal

Insert a new step **2 / 5** between the existing step 1 and step 2 that
explicitly points at one of the locked blocks and tells the user it is fixed.
All later steps shift by +1.

## Tutorial state machine after change

| New step | Label | Body | Advance |
|---|---|---|---|
| 1 / 5 | 步骤 1 / 5 · 游戏目标 | (unchanged copy) | "下一步 →" |
| **2 / 5** | **步骤 2 / 5 · 已放置的方块** | **这些带🔒的方块已经放好啦，不能再移动** | **"下一步 →"** |
| 3 / 5 | 步骤 3 / 5 · 选中并放置 | (unchanged copy from old step 2) | place block |
| 4 / 5 | 步骤 4 / 5 · 双击移除 | (unchanged copy from old step 3) | double-tap |
| 5 / 5 | 步骤 5 / 5 · 完成挑战 | (unchanged copy from old step 4) | win/skip |

## Behavioral rules

- New step 2 highlights `prePlaced[0]` (first locked block in the puzzle's
  `prePlacedBlocks` array). Highlight uses `R.shapeOutline` with the block's
  actual shape — same silhouette technique used by old step 3 for the
  misplaced block.
- Bubble positioning reuses the existing auto-flip logic
  (`target.y > H / 2 ? 'down' : 'up'`). No `forcedDir` override.
- "下一步 →" button renders for both step 1 and step 2 (currently only step 1).
- "跳过" still ends the tutorial in one click from any step (no change).
- Touch handling on locked blocks is **not** changed — they remain inert. The
  new step is purely informational.

## State machine renumbering

All references to the old step numbers shift by +1:

| Old | New |
|---|---|
| `tutorialStep = 1` (init) | `tutorialStep = 1` |
| Step-1 "下一步" advances to `2` | Step-1 "下一步" advances to `2`; new step-2 "下一步" advances to `3` |
| `tutorialStep === 2` (drag palette) → `3` (drag palette) |
| `tutorialStep === 3` (double-tap) → `4` (double-tap) |
| `tutorialStep === 4` (win dialog) → `5` (win dialog) |
| Transition `tutorialStep = 4` on win → `tutorialStep = 5` |
| Transition `tutorialStep = 3` after place → `tutorialStep = 4` |
| Transition `tutorialStep = 4` after correct remove → `tutorialStep = 5` |

## Files touched

- `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Only one file changes. The tutorial puzzle generator (`puzzleGenerator.js`)
already supplies a non-empty `prePlacedBlocks` array (7 entries in easy mode
combo of 3); no payload changes needed. The fallback puzzle
(`tutorialFallback.js`) also produces locked blocks through the same
`puzzleFromCombo` path; no fallback changes needed.

## Out of scope

- No change to the React web client (`my-cal/`) — it does not host this
  tutorial.
- No change to lock badge rendering.
- No change to touch handling on locked blocks.
- No change to the "重新体验新手教程" replay entry in `selectScene.js`.
- No change to step-skip behavior or first-launch gating in `main.js`.

## Verification

Manual: open the mini-game in WeChat devtools, clear local storage to trigger
first-launch tutorial, then walk through all 5 steps. Confirm:

1. Step 2 bubble appears after tapping "下一步" on step 1, points at a locked
   block with a lock badge visible.
2. Tapping "下一步" on step 2 advances to step 3 (palette drag prompt).
3. Subsequent steps (drag, double-tap, complete) still work as before.
4. "跳过" on any step exits the tutorial.

No automated test coverage exists for tutorial flow in this repo — manual
verification is the bar.

## Addendum — drag-fully-off shortcut

Bundled in the same PR.

**Rule:** if a board-origin drag releases with **every filled cell of the
block outside the 7×8 grid**, treat it as the same operation as double-tap
removal — clone the block, strip `x`/`y`, push to `palette`, clear `selected`.
The "超出棋盘范围" toast is suppressed in that case.

If any filled cell still overlaps the board (even one cell), the existing
"restore to origin" branch applies, unchanged.

Only `dragFromBoard` drags trigger this; palette-origin drags off-board keep
their current "超出棋盘范围" toast.

Tutorial parity: if the misplaced block (`tutorialMisplacedId`) is the one
dragged fully off during step 4, the state machine advances to step 5 — same
behavior as the double-tap path.

Touch point: `gameScene.js` drag-end (`scene.onTouchEnd`, the `dragHasMoved`
branch). Single-file change.
