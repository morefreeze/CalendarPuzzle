# M5 Hints + Tutorial — Resume Design (post-halt)

**Date**: 2026-06-02
**Status**: Draft, awaiting user review
**Replaces (for Tasks 3-9)**: `docs/superpowers/plans/2026-05-26-godot-steam-m5-hints-tutorial.md` (halted 2026-06-01)
**Preserves**: Tasks 1-2 (HintResult, HintState) already shipped on `feat/m5-hints-tutorial` (commits `444b102`, `37dedff`); this spec builds on them unchanged.

---

## 1. Problem

The original M5 plan assumed abstractions that do not exist in the M4 codebase:
- `PuzzleState` class — does not exist; play_scene holds state in instance vars
- `Board.collect_empty_cells()` / `is_empty_cell()` — do not exist
- `Dlx.solve(empty_cells, available_blocks)` — class is `DLX` and takes a fully-prepared matrix
- `game_snapshot.gd` at `resources/` — actually lives at `shared/save/`
- `play_scene.init_from_date_and_difficulty(...)` — invented; real API is `load_puzzle(payload)`

Execution halted after Tasks 1-2. This spec redesigns Tasks 3-9 against M4 reality.

## 2. Goal

Ship M5's acceptance gates against the real M4 codebase:
- Weak hint button on play_scene HUD, capped 3/题 (normal) or 5/题 (insomnia)
- Weak hint highlights one cell for 3 seconds with auto-fade
- Medium/Strong tier code + tests preserved, UI hidden behind `--enable-advanced-hints` CLI flag
- 5-step interactive tutorial (目标 → 锁块 → 放置 → 移除 → 完成) with Skip from any step
- Tutorial only-once gate via `profile.tutorial_done`
- Hint state persists through GameSnapshot save/load round-trip

## 3. Architecture decision: Option A

Three options considered; **Option A** chosen:

- **A. HintSolver direct against play_scene vars** ✓ selected
  Reuses existing `PuzzleGenerator.solved_board`, `get_hint_shape()`, `solved_placements()`. Pure-static `HintSolver`. Additive; no risk to M2/M3/M4 tests. ~9-12 commits.

- **B. Introduce PuzzleState refactor first** — rejected
  ~12-15 commits, touches ~50 existing scene-level tests, real regression risk against just-stabilized autosave / Continue flow. Pays off only if M6+ adds substantial new puzzle state (not indicated).

- **C. Dev-flag only, no user-visible UI** — rejected
  Fails M5 acceptance gate ("弱提示按钮在 play_scene 工作").

**Key insight**: `PuzzleGenerator.generate_puzzle()` already returns `solved_board` (the fully-solved char grid) in its result dict, and `play_scene.load_puzzle` currently discards it. Capturing it as a play_scene instance var costs one line and removes the need for the plan's invented `Dlx.solve(empty, blocks)` API.

## 4. File map

```
games/calendar_puzzle/
├── systems/
│   ├── hint_result.gd          (EXISTS — Task 1, no change)
│   ├── hint_state.gd           (EXISTS — Task 2, no change)
│   └── hint_solver.gd          NEW  pure-static; wraps puzzle_generator helpers
├── solver/
│   └── puzzle_generator.gd     (no change — reuses get_hint_shape /
│                                 solved_placements / solved_board)
├── scenes/
│   ├── play_scene.gd           MOD  +solved_board var, +_hint_state var,
│   │                                +HUD wire, +highlight call, +orientation lock gate,
│   │                                +placed_count_changed signal
│   ├── play_scene.tscn         MOD  HUD adds HintButton + AdvancedHintsContainer
│   │                                (Medium/Strong buttons, invisible by default)
│   └── board_view.gd           MOD  +set_hint_highlight(cell, duration_sec)
└── tutorial/                   NEW directory
    ├── tutorial_fixture.gd     NEW  static factory; checked-in fixed puzzle
    ├── tutorial_overlay.tscn   NEW  CanvasLayer root with 5 step children
    ├── tutorial_overlay.gd     NEW  5-step state machine + Skip button
    └── tutorial_step.gd        NEW  base Control: text bubble + arrow + advance criterion

shared/save/
└── game_snapshot.gd            MOD  +weak_locked, +medium_locked, +strong_locked
                                     Dictionary exports (3 *_hint_used ints already present)

boot/
└── boot.gd                     MOD  parse --enable-advanced-hints CLI flag → GameDeps

games/calendar_puzzle/
└── game.gd                     MOD  in _on_puzzle_selected, if !profile.tutorial_done:
                                     stash payload; load TutorialFixture payload via
                                     play_scene.load_puzzle; mount tutorial_overlay;
                                     on completion/skip: profile.tutorial_done = true;
                                     swap to user's real puzzle via play_scene.load_puzzle

tests/
├── test_hint_solver.gd                 NEW  weak/medium/strong picks, cap exhaustion
├── test_play_scene_hint_integration.gd NEW  button click → highlight → state advance
├── test_hint_snapshot_roundtrip.gd     NEW  save → restore preserves all lock dicts
├── test_orientation_lock.gd            NEW  rotate/mirror blocked when weak_locked
├── test_tutorial_fixture.gd            NEW  fixture loads, has unambiguous solution
└── test_tutorial_flow.gd               NEW  5-step advance + Skip + only-once gate
```

## 5. Boundaries and isolation

- **`hint_solver`** is pure. In: `HintState`, `placed_blocks`, `palette_blocks`, `uncoverable`, `solved_board`. Out: `HintResult`. No scene access, no global state, fully unit-testable.
- **`play_scene`** owns the *application* of a HintResult: mark state, call `board_view.set_hint_highlight`, refresh HUD badge, trigger existing `_mark_state_dirty()` autosave path.
- **`tutorial_overlay`** is external to play_scene. It subscribes to `deps.input` signals and to a single new `play_scene.placed_count_changed(int)` signal. It never reaches into play_scene's instance vars.

## 6. Data flow

### 6.1 Weak hint click

```
User clicks 💡 button on play_scene HUD
  └─ play_scene._on_weak_hint_pressed():
       if not _hint_state.can_use(WEAK): return        # button should already be disabled
       result := HintSolver.weak_hint(_hint_state, placed_blocks,
                                      palette_blocks, uncoverable, solved_board)
       if not result.ok:
           # surface result.reason on HUD label briefly; do not mutate state
           return
       _hint_state.mark_weak_used(result.block_id)
       board_view.set_hint_highlight(result.hinted_cell, 3.0)
       hud.refresh_counts(_hint_state)                  # "💡 2/3"
       _mark_state_dirty()                              # existing autosave path
```

### 6.2 HintSolver algorithms

**weak_hint** — Pick a block_id from `palette_blocks` whose id is not in `_weak_locked`. Call `PuzzleGenerator.get_hint_shape(solved_board, label)` for the block's solved bbox; find its top-left position in `solved_board` (single scan); return the first solved cell of that block as `hinted_cell`. If no candidate → `HintResult` with `ok=false, reason="no_solution"`.

**medium_hint** — If `_medium_locked[block_id]` already has cells for some block, pick the next solved cell for that same block (escalates a weak hint to higher resolution). Otherwise pick a block from palette not in `_weak_locked` and reveal one cell. Highlight is a *board cell* (the target square in the solved layout), not the palette piece.

**strong_hint** (dev-flag only) — Pick any palette block not yet in `_strong_locked`. Compute its solved origin via `PuzzleGenerator.solved_placements(solved_board)[block_id]`. Compute `evicted_ids` = ids of any block in `placed_blocks` whose cell footprint overlaps the strong placement footprint. Return `HintResult.strong_ok(block_id, origin, evicted_ids)`. play_scene applies it: remove each evicted block back to palette (reuse `_remove_to_palette`), force-place the strong block at the origin via direct `placed_blocks.append`, mark `_hint_state.mark_strong_used`.

### 6.3 Cap and denial UX

- HUD HintButton's `.disabled = not _hint_state.can_use(WEAK)`; re-evaluated after every mutation.
- Badge text: `"💡 {remaining}/{cap}"`. Greyed when remaining=0.
- HintResult with `ok=false` (cap or no_solution) does not mutate `_hint_state`. play_scene may surface `result.reason` via a transient HUD label (best-effort UX; not gated by tests).

### 6.4 Orientation lock (weak)

- `_on_action_triggered("rotate"|"mirror")`: if `_hint_state.is_orientation_locked(drag_block.id)` → ignore (no shape mutation, no ghost update).
- `_begin_drag_from_palette(block_id)`: if `_hint_state.is_orientation_locked(block_id)` → after cloning the block, snap `drag_block.shape` to the canonical solved orientation via `PuzzleGenerator.get_hint_shape(solved_board, label)` (the weak hint already committed to that orientation).
- No-op for blocks not in `_weak_locked` (existing rotate/mirror behavior preserved).

## 7. Persistence

### 7.1 GameSnapshot extensions

```gdscript
# shared/save/game_snapshot.gd  (additions; 3 *_hint_used ints already present)
@export var weak_locked: Dictionary = {}      # block_id → true
@export var medium_locked: Dictionary = {}    # block_id → Array[Vector2i]
@export var strong_locked: Dictionary = {}    # block_id → Vector2i
```

### 7.2 play_scene save path

```gdscript
# play_scene._current_snapshot() additions
s.weak_hint_used   = _hint_state.used_for(HintResult.Tier.WEAK)
s.medium_hint_used = _hint_state.used_for(HintResult.Tier.MEDIUM)
s.strong_hint_used = _hint_state.used_for(HintResult.Tier.STRONG)
s.weak_locked      = _hint_state._weak_locked.duplicate(true)
s.medium_locked    = _hint_state._medium_locked.duplicate(true)
s.strong_locked    = _hint_state._strong_locked.duplicate(true)
```

### 7.3 play_scene restore path

```gdscript
# In restore_from_snapshot, after load_puzzle(payload) repopulates solved_board:
_hint_state = HintState.new(snap.date, snap.difficulty == "insomnia")
_hint_state.restore_state({
    "puzzle_id":     snap.date,
    "is_insomnia":   snap.difficulty == "insomnia",
    "used_weak":     snap.weak_hint_used,
    "used_medium":   snap.medium_hint_used,
    "used_strong":   snap.strong_hint_used,
    "weak_locked":   snap.weak_locked,
    "medium_locked": snap.medium_locked,
    "strong_locked": snap.strong_locked,
})
hud.refresh_counts(_hint_state)
```

`solved_board` is re-derived for free because `load_puzzle(payload)` already re-runs `PuzzleGenerator.generate_puzzle`.

## 8. CLI flag `--enable-advanced-hints`

- Parsed once in `boot.gd._ready()`: `OS.get_cmdline_args().has("--enable-advanced-hints")`.
- Stored on `GameDeps` as `advanced_hints_enabled: bool` (single bool; no flags dict — YAGNI).
- `play_scene._ready()`: `$HUD/AdvancedHintsContainer.visible = deps.advanced_hints_enabled`.
- The AdvancedHintsContainer holds Medium and Strong buttons; default `visible = false` in the .tscn.

## 9. Tutorial

### 9.1 Trigger flow

```
main_menu New Game → select_scene → user picks date+difficulty
  → game.gd._on_puzzle_selected(payload):
  if not profile.tutorial_done:
      _stashed_payload = payload
      _show_play(TutorialFixture.payload())            # NOT user payload
      mount tutorial_overlay as CanvasLayer child of play_scene
      tutorial_overlay.tutorial_finished.connect(_on_tutorial_done)
  else:
      _show_play(payload)                               # normal path

  func _on_tutorial_done():
      remove tutorial_overlay
      profile.tutorial_done = true
      _deps.save.save_profile(profile)
      _current.load_puzzle(_stashed_payload)            # swap to real puzzle
      _stashed_payload = {}
```

### 9.2 Fixture

`tutorial/tutorial_fixture.gd` — static factory returning a puzzle dict with:
- `date` = `2026-06-02` (hardcoded for determinism; the user's real puzzle is unaffected because it loads only after tutorial completes)
- `difficulty` = `"easy"`
- `pre_placed_blocks` hand-authored so that exactly **2 blocks** remain in `remaining_blocks`
- Layout designed so only one valid placement exists for each remaining block (unambiguous teaching)
- Checked-in `.gd` factory (not a `.tres` — no editor dependency for tests)

### 9.3 5-step state machine

| Step | Goal label | Advance criterion | Mechanism |
|---|---|---|---|
| 1 | 目标 | User clicks "Next" button | Pure text bubble + arrow pointing at date markers on board |
| 2 | 锁块 | User drags any palette block | Listen to `deps.input.pointer_pressed` AND palette `hit_test` succeeds |
| 3 | 放置 | `play_scene.placed_blocks.size()` increases by 1 | Subscribe to new signal `play_scene.placed_count_changed(int)` |
| 4 | 移除 | `play_scene.placed_blocks.size()` decreases by 1 | Same signal, opposite direction |
| 5 | 完成 | User clicks "Done" button | Pure text bubble |

- **Skip button** (top-right of every step): fires `tutorial_finished` signal regardless of current step.
- Both completion and Skip set `profile.tutorial_done = true` and persist via `save_adapter.save_profile`.

### 9.4 New signal on play_scene

```gdscript
# play_scene.gd (added)
signal placed_count_changed(new_count: int)

# Emitted at end of _on_pointer_released (after settle) and _remove_to_palette.
# Replaces tutorial polling; single signal consumed only by tutorial_overlay.
```

### 9.5 Step UI

Each step is a `tutorial_step.gd` Control with:
- `step_index: int`
- `text: String` (Chinese)
- `arrow_target_path: NodePath` — resolved at runtime against play_scene's tree (HUD/palette/board nodes)
- `advance_criterion: Callable` (or `enum AdvanceMode { CLICK_NEXT, PALETTE_DRAG, PLACE, REMOVE, CLICK_DONE }`)

`tutorial_overlay.gd` cycles steps; current step's Control visible, others hidden.

## 10. Acceptance gates

Carried forward from original spec (`docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Milestones M5), unchanged:

- Weak hint button works in play_scene: normal 3/题 cap, insomnia 5/题; greyed when exhausted
- Weak hint highlights one cell for 3 seconds with auto-fade
- Medium/Strong code complete + unit-tested, UI hidden by default, visible with `--enable-advanced-hints`
- Tutorial 5 steps play in order: 目标 → 锁块 → 放置 → 移除 → 完成; Skip dismisses
- Tutorial only triggers when `profile.tutorial_done == false`; sets to true after completion or Skip
- Hint state persists in GameSnapshot; save → exit → restart → load preserves all counts and lock dicts
- GUT: `test_hint_state.gd` (already passing) + `test_hint_solver.gd` + `test_tutorial_flow.gd` + 4 new files ≥ 12 added cases, all green

## 11. Testing strategy

| File | Coverage | Approx cases |
|---|---|---|
| `test_hint_solver.gd` | weak valid bbox cell, medium escalates same block, strong returns origin + evicted ids, cap_exhausted, no_solution, already_complete | 8-10 |
| `test_play_scene_hint_integration.gd` | button click → highlight visible 3s then cleared, count badge decrements, denied when cap=0, advanced container hidden by default and visible when `deps.advanced_hints_enabled=true` | 5-6 |
| `test_hint_snapshot_roundtrip.gd` | place blocks → use 2 weak + 1 medium → save → load → counts + lock dicts identical | 3-4 |
| `test_orientation_lock.gd` | weak-locked block: rotate ignored, mirror ignored, palette pickup snaps canonical; non-locked block: rotate/mirror work as before | 4-5 |
| `test_tutorial_fixture.gd` | fixture loads, exactly 2 remaining blocks, unambiguous solution (DLX `count_all` = 1) | 2-3 |
| `test_tutorial_flow.gd` | 5-step state machine advances on each criterion; Skip from step 2 fires `tutorial_finished`; only-once gate works | 5-6 |

**Target**: 208 (current) + ~30 added = **~238 tests**, all green before merge.

**Headless smoke**:
- `godot --headless --path . --quit-after 3 res://boot/boot.tscn` clean (no ERROR/WARNING)
- `godot --headless --path . --quit-after 3 --enable-advanced-hints res://boot/boot.tscn` clean and advanced container visibility provably true (asserted via test, not via stdout)

**Mac GUI manual checklist** (post-merge):
1. Delete user `profile.tres` to reset `tutorial_done`
2. Launch Mac app → main_menu → New Game → select today + Start → tutorial overlay step 1 visible
3. Walk all 5 steps; verify Skip works from step 2
4. After completion → real selected puzzle loads → 💡 badge shows "💡 3/3" → click → cell highlights 3s → "💡 2/3"
5. Use all 3 weak hints → 4th click denied / button greys
6. Save manual slot → restart app → Load → counts + locks identical
7. Try rotate on a weak-locked block → no-op
8. Relaunch with `open --args --enable-advanced-hints CalendarPuzzle.app` → Medium / Strong dev buttons appear

## 12. Cost estimate

~9-12 commits across 6 task batches:

1. `HintSolver` static module + tests
2. `play_scene` HUD wire + `board_view.set_hint_highlight` + count badge + tests
3. Orientation lock enforcement on rotate/mirror + palette pickup snap + tests
4. `GameSnapshot` lock-dict extension + `restore_from_snapshot` plumbing + roundtrip test
5. `--enable-advanced-hints` CLI flag + `GameDeps.advanced_hints_enabled` + advanced container visibility + test
6. Tutorial fixture + overlay + 5-step state machine + `placed_count_changed` signal + fixture/flow tests

## 13. Out of scope (deferred)

- Pull request to merge `feat/m4` + `feat/m5` + chained `feat/m3` commits to main — user-gated handoff, not part of this milestone
- Skin support for hint highlight color — M5 uses hardcoded color; M9 SkinResource wiring deferred
- Sound effects (`SFX_denied` etc.) — no audio system shipped yet; M5 fails silently
- Localized tutorial text — Chinese only; locale fallback follows existing settings infra without extra work
- `PuzzleState` extraction (Option B) — explicitly rejected; revisit only if M6+ adds substantial new puzzle state
- Tutorial replay from settings — once `tutorial_done` is true there is no UI to retrigger; manual recovery via deleting `profile.tres`. Adding a "Replay tutorial" button is a 1-commit follow-up if desired later

## 14. References

- Halted plan: `docs/superpowers/plans/2026-05-26-godot-steam-m5-hints-tutorial.md` (EXECUTION HALT section at top documents the abstraction mismatch)
- Original spec: `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Game systems → 提示系统设计 + § Milestones M5
- JS reference implementation: `calendar-puzzle-miniprogram/minigame/js/hint.js` (346 lines, 3-tier state machine; Tasks 1-2 already ported the state machine portion)
- Shipped foundation:
  - `games/calendar_puzzle/systems/hint_result.gd` (commit `444b102`)
  - `games/calendar_puzzle/systems/hint_state.gd` (commit `37dedff` + 9 tests)
