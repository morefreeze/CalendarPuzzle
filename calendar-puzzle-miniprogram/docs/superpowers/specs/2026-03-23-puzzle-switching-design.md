# Puzzle Switching Redesign

## Overview

Redesign the "换题" (switch puzzle) feature to enumerate all valid puzzle configurations upfront, support random and manual switching, and display solution count asynchronously during gameplay.

## Current Behavior

- "换题" button calls `generatePuzzle()` which solves the board once via DLX, then randomly digs connected blocks via `digFloor()`
- DLX `_search` returns after finding the first solution (`if (results.length > 0) return;`)
- No awareness of total available puzzles or solution counts

## Design

### 1. Enumerate All Connected Dig Combinations

New function `enumAllDigCombinations(solvedBoard, digCount)` in `puzzleGenerator.js`:

- Input: solved board (8x7 char grid), number of blocks to dig
- From the 10 placed blocks, enumerate all subsets of size `digCount`
- Filter: the dug blocks must form a connected region on the board (adjacency = sharing a cell edge, same logic as current `digFloor`)
- Output: array of label arrays, e.g. `[['U','V','I'], ['U','V','L'], ...]`
- Called once per `generatePuzzle`, result stored on the puzzle object

### 2. Data Flow Changes

```
generatePuzzle(diff)
  -> solveBoard() -> complete solution
  -> enumAllDigCombinations(sb, digCount) -> all valid combinations
  -> pick one randomly as current puzzle
  -> return { prePlacedBlocks, remainingBlocks, difficulty, solvedBoard, allCombinations, currentComboIndex }
```

New helper `puzzleFromCombo(solvedBoard, combo)` converts a combination into `{ prePlacedBlocks, remainingBlocks }` without re-solving.

### 3. Switch Puzzle Interaction

#### Button Area Layout (in control bar)

Replace the single "换题" button with two elements:
- **Mode toggle**: small label showing "随机" or "手动", tap to toggle between modes
- **Switch button**: "换题 (N)" where N = total combinations count

#### Random Mode (default)

Tap "换题" -> randomly pick an unplayed combination -> enter game directly.

#### Manual Mode

Tap "换题" -> open thumbnail selection panel (popup overlay):
- Title: "选择题目 (共 N 题)"
- Grid of board thumbnails, each ~80x90px
- Thumbnail rendering: miniature board with pre-placed blocks colored, dug areas left white
- Support vertical scrolling if thumbnails exceed one screen
- Current puzzle highlighted with green border
- "取消" button at bottom
- Tap a thumbnail -> enter that puzzle

### 4. Solution Count Display

#### DLX Changes

Add `countSolutions()` method to DLX (or a search mode flag):
- Same algorithm as `_search` but does not early-return
- Counts all solutions instead of collecting them (no need to store full solution data)
- Returns integer count

New function `countSolutionsForCombo(solvedBoard, combo)` in `puzzleGenerator.js`:
- Builds a partial board with the combo blocks removed
- Runs DLX in count mode
- Returns solution count

#### Game Scene Integration

After entering a puzzle (both random and manual switch):
- Header shows "解法: 计算中..." next to the placed-count line
- `setTimeout(fn, 50)` kicks off `countSolutionsForCombo()`
- On completion, updates display to "解法: 12"
- Non-blocking: game is fully playable during calculation

### 5. Files Changed

| File | Changes |
|------|---------|
| `puzzleGenerator.js` | Add `enumAllDigCombinations()`, `puzzleFromCombo()`, `countSolutionsForCombo()`. Modify `generatePuzzle()` return value to include `allCombinations`. |
| `dlx.js` | Add `countSolutions()` search mode that finds all solutions and returns count. |
| `gameScene.js` | Replace "换题" button with mode toggle + switch button. Add thumbnail panel rendering/interaction. Add solution count display in header. Add scroll support for panel. |

### 6. Constraints

- All computation is local (no network calls)
- Enumeration and DLX are synchronous but fast for these board sizes
- Solution counting may take longer for expert difficulty (9 blocks dug = more freedom); use setTimeout to avoid blocking the render loop
