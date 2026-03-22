# SimpleBoard Refactor for WeChat Mini-Program Compatibility

## Problem

SimpleBoard.tsx renders in WeChat Developer Tools but core gameplay is broken:
- Block selection and board placement don't respond correctly
- Placed blocks display at wrong positions
- Rotate/flip operations don't take effect visually

Root cause: the component is built with web CSS assumptions (CSS Grid, inline styles, gap property, cursor, boxSizing) that don't translate reliably to WeChat mini-program's WXSS engine.

## Solution

Refactor SimpleBoard to use WeChat-compatible patterns while preserving all existing game logic.

## Design

### 1. Board Layout: CSS Grid → Flexbox

**Before:** Single CSS Grid container with `gridTemplateColumns: repeat(7, 70px)`

**After:** Nested Flexbox rows
```
.board-container
  .board-row  (display: flex)  x 8 rows
    .board-cell  (90rpx x 90rpx)  x 7 columns
```

- All sizes in **rpx** for multi-device adaptation
- All styles in **SimpleBoard.scss** (new file), referenced via className
- Cell background colors via dynamic classNames (`.cell-month`, `.cell-day`, `.cell-weekday`, `.cell-uncoverable`) plus inline `backgroundColor` only for placed block colors (dynamic per block)
- Replace all `gap` properties with `margin`-based spacing (gap on Flexbox has inconsistent support in older WeChat base libraries)
- Add scoped `box-sizing: border-box` rule in SCSS (works as class rule, unlike inline style)

### 2. Interaction Fixes

**Cell click condition relaxed:**
- Before: `canDrop && !hasBlock && !isUncovered` gate on each cell's onClick
- After: only check `cell.type !== 'empty'`, let `isValidPlacement` handle all validation
- Clicking a cell that already has a block on it → show "That cell is already occupied" message (check before calling isValidPlacement)
- This fixes the case where a user clicks a valid target cell but it's rejected by the UI gate

**Block removal — preserve `key` field (refactor, not bug fix):**
- Add `key: string` to `PlacedBlock` interface in `types/game.tsx`
- When placing a block, copy `key` from BlockType into PlacedBlock
- When removing, use the preserved `key` directly instead of deriving from id
- Note: current derivation `block.id.charAt(0).toLowerCase()` happens to produce correct values for all 10 blocks, but preserving the original field is cleaner

**Buttons:**
- Replace `<Button>` with `<View onClick={...}>` styled via SCSS
- Avoids WeChat native `<button>` default styles (grey background, borders, padding)
- Disabled state via conditional className + guard in handler

**Timer pause on win:**
- Current timer useEffect runs indefinitely regardless of win state
- Add `isGameWon` to the interval guard: clear interval when game is won

### 3. Block Preview & Palette

- Selected block preview and available blocks list: CSS Grid → Flexbox rows
- Palette cell size remains 25px equivalent in rpx
- Selected state via `.block-selected` className instead of inline border/background
- All `gap` usages replaced with margins

### 4. Bug Fixes

| Issue | Type | Fix |
|-------|------|-----|
| `storage.tsx` missing `logDebug`/`logError` import | Bug | Add `import { logDebug, logError } from './logger'` |
| `initialBlockTypes` and `boardLayoutData` duplicated in `useGameInitialization.tsx` and `InitBoard.tsx` | Bug | Delete duplicates from `useGameInitialization.tsx`, import from `InitBoard` |
| Unused `GridCell` import in `SimpleBoard.tsx` | Cleanup | Remove import |
| Win condition only checks block count, not coverage | Bug | Import and use `checkGameWin()` from InitBoard, replacing the count-only check |
| Timer doesn't stop on win | Bug | Add `isGameWon` guard to timer useEffect |

### 5. Out of Scope

- PlayBoard, InteractiveBoard, BoardPreview components (unused, not touched)
- GridCell.tsx component (unused by SimpleBoard after cleanup, but may be used by other boards later — keep)
- Custom hooks (useGameTimer, useGamePersistence, useSolver) — SimpleBoard doesn't use them
- API layer — demo mode, no backend dependency
- config/api.ts production URL — separate concern
- `src/pages/index/index.scss` — current styles are minimal and compatible, no changes needed

## Files Changed

| File | Change |
|------|--------|
| `src/components/SimpleBoard.tsx` | Refactor layout to Flexbox, styles to className, fix interactions, import checkGameWin, fix timer |
| `src/components/SimpleBoard.scss` | **New** — all board styles with rpx units, box-sizing, margin-based spacing |
| `src/types/game.tsx` | Add `key` field to `PlacedBlock` interface |
| `src/hooks/useGameInitialization.tsx` | Remove duplicate data, import from InitBoard |
| `src/utils/storage.tsx` | Add missing logger import |

## Verification

After implementation, verify in WeChat Developer Tools simulator:
1. Board renders as 8x7 grid with correct colors per cell type
2. Today's date/month/weekday cells highlighted yellow
3. Clicking a block in palette selects it (visual feedback)
4. Clicking a board cell places the selected block at correct position
5. Rotate button changes selected block orientation visually and logically
6. Flip button mirrors selected block
7. Clicking a placed block name removes it and returns it to palette
8. Placing all 10 blocks covering all coverable cells triggers win message
9. Reset clears all state
10. Timer counts up from 0 and stops on win
