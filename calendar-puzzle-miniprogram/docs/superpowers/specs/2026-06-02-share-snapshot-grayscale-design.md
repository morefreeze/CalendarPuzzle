# Share-snapshot grayscale (anti-spoiler)

Date: 2026-06-02
Status: Draft — design approved, plan pending
Branch: `feature/share-grayscale-blocks` (off `origin/main`)

## Problem

When the player wins, the canvas shows the **full solution** — every puzzle piece placed on the board with its distinct color. The win modal includes a "分享" button that calls `wx.shareAppMessage(...)` with no `imageUrl`, so the share-card cover is a snapshot of the live canvas. Result: the share recipient sees the entire solution to today's puzzle, defeating the point of the daily challenge.

The win modal naturally occludes most of the canvas — only the top strip of the board (roughly one row) peeks above it. That's already an acceptable amount of crop. The remaining leak is **the colors of the pieces visible in that top strip**, which trivially identify the placed pieces.

## Goal

Render the visible piece cells in **randomized grayscale** for the share-snapshot frame only, so:

- Adjacent pieces remain visually distinguishable (different gray levels at their boundary).
- The shade does **not** correlate to piece identity (palette is reshuffled per share).
- The player's own view is not visibly affected (the gray state lasts ≤1 frame).

Out of scope:

- Other share entry points (group-share for ticket, invite-for-help, capsule-menu share). They fire mid-game; the board doesn't yet contain a full solution, so spoiler risk is low. The capsule-menu callbacks also can't reliably re-render before the system snapshot.
- Date cells, modal chrome, slot/preview UI — already either non-spoilery or occluded by the modal.

## Approach (chosen — see "Alternatives" for rejected options)

**One-shot grayscale render before `wx.shareAppMessage`.**

1. Define a module-level flag `shareSnapshotMode = null | { palette }` in `gameScene.js`.
2. On win-modal share-button click: generate a fresh randomized gray palette keyed by piece id, set the flag, synchronously force one `scene.render(ctx, W, H)` pass, then call `wx.shareAppMessage(...)`. The system grabs the just-painted frame.
3. Clear the flag on the next tick (`setTimeout(..., 0)`) and re-mark `scene.dirty` so the next regular RAF tick restores the colored render. Player sees at most one frame of gray.

This piggybacks on the existing dirty-render loop and touches exactly one drawing call in the piece-rendering path.

## Design details

### File touchpoints

- `calendar-puzzle-miniprogram/minigame/js/gameScene.js`
  - Add module-level state: `shareSnapshotMode`, `_lastCtx`, `_lastW`, `_lastH`.
  - `scene.render = function (ctx, W, H) { _lastCtx = ctx; _lastW = W; _lastH = H; /* existing */ }` — capture ctx ref.
  - Patch the board-cell piece-fill at `:979`:
    ```js
    ctx.fillStyle = (shareSnapshotMode && shareSnapshotMode.palette[blockAt.id])
                  || blockAt.color;
    ```
  - In `onTouchEnd` at the existing win-modal share-button branch (`:2094`), wrap the `wx.shareAppMessage` call with the snapshot-mode setup/teardown.

- `calendar-puzzle-miniprogram/minigame/js/shareGrayPalette.js` (new, small)
  - Exports `makeShareGrayPalette(pieceIds) -> { [id]: '#RRGGBB' }`.
  - Internally uses a 9-step gray ramp (`#A8A8A8 … #E8E8E8`) and Fisher-Yates shuffles per call.
  - If `pieceIds.length > 9`, wraps modulo (acceptable — collisions only happen with 10+ piece variants on board, which is rare; collision means two pieces share a gray, but they're not necessarily adjacent and the palette still reshuffles per share).

### Piece-id source

Use the existing closure helper `allBlocks()` (gameScene.js:343), which returns `prePlaced.concat(dropped)`. Build the palette via `allBlocks().map(function (b) { return b.id; })`. At win-time `dropped` already contains every player-placed piece, so the palette covers every visible piece on the board.

### Non-touchpoints

- `shareState.js` — unchanged. `buildShareData()` still returns `imageUrl: ''` so the system snapshots the canvas. We change *what's on* the canvas, not the share path.
- Drag preview (`:1118`), hit highlight (`:1182`), slot palette (`:1736`) — all occluded by the win modal at the moment of snapshot. Leaving them colored is fine and avoids needless flicker.
- All non-win share entry points (`triggerShareGroup`, `triggerInviteShare`, `onShareAppMessage`/`onShareTimeline` capsule callbacks) — unchanged.

### Failure modes

- **`_lastCtx` is null when share is clicked.** Cannot happen — share-button is only hit-testable when the win modal is open, which requires at least one prior render. Defensive `if (_lastCtx)` guard included anyway; in the impossible case it falls through to a colored snapshot (degraded but not broken).
- **`wx.shareAppMessage` throws.** Already wrapped in `try/catch` (existing behavior). `setTimeout` teardown is outside the try, so the flag still clears.
- **Re-entry during the same frame.** `setTimeout(..., 0)` defers cleanup; if the player somehow taps share twice before the timeout fires, the second tap re-generates the palette and re-renders — both harmless and intended.

## Alternatives considered

1. **Offscreen 5:4 cover image via `wx.canvasToTempFilePath` + `imageUrl`.** Generates a custom share card decoupled from live canvas. Rejected: substantially more code (offscreen canvas layout, file I/O, error paths), and the existing modal occlusion already crops the board to ~one row "for free". Premature flexibility.
2. **Keep the snapshot grayscale on screen for the entire win-modal lifetime.** Considered for clarity ("the player sees what gets shared"), rejected because the player's experience post-win should celebrate their own solution in full color. Spoiler concern is about *recipients*, not the *player*.
3. **Use luminance-preserving grayscale of original colors.** Rejected: the gray-to-id mapping would be stable across shares, so a determined recipient could decode pieces by comparing shades to a known palette.

## Testing strategy

- **Unit test** `tests/shareGrayPalette.test.js` (new): palette covers all input ids, repeated calls yield different orderings (statistical — N runs, expect ≥M distinct permutations), no key maps to empty string.
- **Manual regression**: trigger win on a normal puzzle, tap share, open the resulting share card on a second device, confirm: (a) visible top row of the board is gray with cell-to-cell shade variation; (b) repeating the share produces a different shade arrangement; (c) the player's own screen shows no visible gray flash.
- **Regression of unchanged paths**: group-share button still works, invite share unchanged, capsule menu share unchanged.

## Acceptance criteria

- Share card cover from win-modal share button shows piece cells in grayscale; original block colors are not recoverable from the image.
- Player-side view shows no perceptible color change.
- Other share entry points behave identically to current `main`.
- No new dependencies; change confined to `gameScene.js` + one new small helper file + one new test file.
