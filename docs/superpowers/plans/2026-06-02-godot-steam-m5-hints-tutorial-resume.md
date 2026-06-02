# M5 Hints + Tutorial Resume — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship M5 Tasks 3-9 — `HintSolver` + HUD button + 3-second cell highlight, weak-tier orientation lock, GameSnapshot round-trip for hint state, `--enable-advanced-hints` CLI flag for Medium/Strong dev surfaces, and a 5-step interactive tutorial gated on `profile.tutorial_done`.

**Architecture:** Option A from spec (HintSolver direct against play_scene instance vars; no `PuzzleState` refactor). Pure-static `HintSolver` wraps existing `PuzzleGenerator.solved_board` / `get_hint_shape` / `solved_placements`. play_scene owns HUD + highlight + autosave plumbing. Tutorial sits as a `CanvasLayer` child of play_scene running on a checked-in fixture puzzle; on completion/skip, `profile.tutorial_done = true` is persisted and the real selected puzzle loads.

**Tech Stack:** Godot 4.3+ GDScript, GUT v9 (single-file tests under `res://tests/`), existing M0-M4 surfaces (`GameDeps`, `InputContext`, `SaveAdapter`, `PuzzleGenerator`, `Board`, `GameSnapshot`, `ProfileResource`).

**Spec reference:** `docs/superpowers/specs/2026-06-02-godot-steam-m5-hints-tutorial-resume-design.md` in this repo (CalendarPuzzle/).

**Code repo:** All implementation happens in the sibling repo `~/mygit/calendar-puzzle-godot` on branch `feat/m5-hints-tutorial` (HEAD: `37dedff`). Plan file itself is committed to CalendarPuzzle/ on `feat/godot-steam`.

**Test invocation (every task uses this):**
```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -30
```

Baseline before Task 1: **208/208 tests pass**. After all tasks complete: **~238/238**.

**Pre-shipped artifacts (do NOT touch):**
- `games/calendar_puzzle/systems/hint_result.gd` (commit `444b102`)
- `games/calendar_puzzle/systems/hint_state.gd` (commit `37dedff`)
- `tests/test_hint_state.gd` (9 cases, all green)

---

## Task 1 — HintSolver static module (weak/medium/strong + caps)

**Files:**
- Create: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/systems/hint_solver.gd`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_hint_solver.gd`

### Step 1.1 — Write failing test file

- [ ] Create `tests/test_hint_solver.gd` with these cases:

```gdscript
extends "res://addons/gut/test.gd"

const HintState = preload("res://games/calendar_puzzle/systems/hint_state.gd")
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")
const HintSolver = preload("res://games/calendar_puzzle/systems/hint_solver.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")
const PuzzleGenerator = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")

# Build a deterministic small scenario:
# - solve today's board so we have a real solved_board
# - palette has 2 blocks not yet placed; placed_blocks is empty
# - uncoverable = today's markers
func _scenario() -> Dictionary:
    var date_struct := {"year": 2026, "month": 6, "day": 2, "weekday": 2}  # Tue
    var solved_board = PuzzleGenerator.solve_board(date_struct)
    assert_not_null(solved_board, "fixture: solve_board must succeed")
    var uncoverable := Board.get_uncoverable_cells(date_struct)
    var palette: Array = []
    for b in Board.INITIAL_BLOCK_TYPES:
        palette.append(Board.clone_block(b))
    return {
        "solved_board": solved_board,
        "uncoverable": uncoverable,
        "placed": [],
        "palette": palette,
    }

func test_weak_returns_ok_for_fresh_state():
    var sc := _scenario()
    var st := HintState.new("p", false)
    var r: HintResult = HintSolver.weak_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    assert_true(r.ok, "expected weak ok; got reason=%s" % r.reason)
    assert_eq(r.tier, HintResult.Tier.WEAK)
    assert_ne(r.block_id, "")
    assert_true(r.hinted_cell.x >= 0 and r.hinted_cell.y >= 0)

func test_weak_skips_already_locked_block():
    var sc := _scenario()
    var st := HintState.new("p", false)
    var first: HintResult = HintSolver.weak_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    st.mark_weak_used(first.block_id)
    var second: HintResult = HintSolver.weak_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    assert_true(second.ok)
    assert_ne(second.block_id, first.block_id, "weak hint must skip already-locked blocks")

func test_weak_fails_with_no_solution_when_palette_empty():
    var sc := _scenario()
    var st := HintState.new("p", false)
    var r: HintResult = HintSolver.weak_hint(st, sc.placed, [], sc.uncoverable, sc.solved_board)
    assert_false(r.ok)
    assert_eq(r.reason, "no_solution")

func test_weak_fails_with_already_complete_when_all_locked():
    var sc := _scenario()
    var st := HintState.new("p", false)
    for b in sc.palette:
        st.mark_weak_used(b.id)
    var r: HintResult = HintSolver.weak_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    assert_false(r.ok)
    assert_eq(r.reason, "already_complete")

func test_medium_reveals_cell_for_chosen_block():
    var sc := _scenario()
    var st := HintState.new("p", false)
    var r: HintResult = HintSolver.medium_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    assert_true(r.ok)
    assert_eq(r.tier, HintResult.Tier.MEDIUM)
    assert_ne(r.block_id, "")
    assert_true(r.hinted_cell.x >= 0)

func test_medium_escalates_same_block_when_already_revealed():
    var sc := _scenario()
    var st := HintState.new("p", false)
    var r1: HintResult = HintSolver.medium_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    st.mark_medium_used(r1.block_id, r1.hinted_cell)
    var r2: HintResult = HintSolver.medium_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    assert_true(r2.ok)
    assert_eq(r2.block_id, r1.block_id, "second medium on same state should escalate same block")
    assert_ne(r2.hinted_cell, r1.hinted_cell, "must reveal a DIFFERENT cell of same block")

func test_strong_returns_origin_and_evicted_ids():
    var sc := _scenario()
    var st := HintState.new("p", false)
    var r: HintResult = HintSolver.strong_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    assert_true(r.ok)
    assert_eq(r.tier, HintResult.Tier.STRONG)
    assert_ne(r.block_id, "")
    assert_true(r.placed_at.x >= 0 and r.placed_at.y >= 0)
    assert_eq(r.evicted_block_ids.size(), 0, "no placed blocks → no eviction")

func test_strong_evicts_overlapping_placed_blocks():
    var sc := _scenario()
    var st := HintState.new("p", false)
    # First strong-hint suggests where a block would land; place a *different*
    # block manually overlapping that footprint to force eviction next time.
    var r1: HintResult = HintSolver.strong_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    var victim: Dictionary = Board.clone_block(sc.palette[0])
    if victim.id == r1.block_id:
        victim = Board.clone_block(sc.palette[1])
    victim["x"] = r1.placed_at.x
    victim["y"] = r1.placed_at.y
    sc.placed.append(victim)
    var r2: HintResult = HintSolver.strong_hint(st, sc.placed, sc.palette, sc.uncoverable, sc.solved_board)
    assert_true(r2.ok)
    assert_true(r2.evicted_block_ids.has(victim.id), "expected %s in evicted, got %s" % [victim.id, r2.evicted_block_ids])
```

### Step 1.2 — Run tests to verify they fail

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -20
```
Expected: ParseError / fail because `hint_solver.gd` does not exist. Test run must produce non-zero exit and reference `hint_solver.gd`.

### Step 1.3 — Implement HintSolver

- [ ] Create `games/calendar_puzzle/systems/hint_solver.gd`:

```gdscript
# games/calendar_puzzle/systems/hint_solver.gd
# Pure-static hint solver. Wraps PuzzleGenerator.solved_board /
# get_hint_shape / solved_placements to compute one HintResult.
# No scene access; fully unit-testable.
class_name HintSolver extends RefCounted

const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")
const HintState = preload("res://games/calendar_puzzle/systems/hint_state.gd")
const PuzzleGenerator = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")

# Map letter ↔ id. Board.INITIAL_BLOCK_TYPES has both `label` (single letter)
# and `id` (e.g. "I-block"); solved_board uses labels.
static func _id_to_label(block_id: String) -> String:
    for b in Board.INITIAL_BLOCK_TYPES:
        if b.id == block_id:
            return b.label
    return ""

static func _label_to_id(label: String) -> String:
    for b in Board.INITIAL_BLOCK_TYPES:
        if b.label == label:
            return b.id
    return ""

# Find (row, col) of every cell labelled `label` in solved_board.
# Returns Array of Vector2i where x = col, y = row (matching board_view coords).
static func _find_cells_of_label(solved_board: Array, label: String) -> Array:
    var out: Array = []
    for r in range(solved_board.size()):
        for c in range(solved_board[r].size()):
            if solved_board[r][c] == label:
                out.append(Vector2i(c, r))
    return out

# WEAK — pick an un-locked palette block; return its FIRST solved cell.
static func weak_hint(state: HintState, _placed: Array, palette: Array,
                     _uncoverable: Array, solved_board: Array) -> HintResult:
    if palette.is_empty():
        var r := HintResult.new()
        r.ok = false; r.tier = HintResult.Tier.WEAK; r.reason = "no_solution"
        return r
    var candidates: Array = []
    for b in palette:
        if not state.is_orientation_locked(b.id):
            candidates.append(b)
    if candidates.is_empty():
        var r2 := HintResult.new()
        r2.ok = false; r2.tier = HintResult.Tier.WEAK; r2.reason = "already_complete"
        return r2
    var chosen: Dictionary = candidates[0]
    var label := _id_to_label(chosen.id)
    var cells := _find_cells_of_label(solved_board, label)
    if cells.is_empty():
        var r3 := HintResult.new()
        r3.ok = false; r3.tier = HintResult.Tier.WEAK; r3.reason = "no_solution"
        return r3
    return HintResult.weak_ok_with_block(chosen.id, cells[0])

# MEDIUM — if any block already has medium-revealed cells, escalate (next cell
# of SAME block). Otherwise pick a palette block and reveal its first cell.
static func medium_hint(state: HintState, _placed: Array, palette: Array,
                       _uncoverable: Array, solved_board: Array) -> HintResult:
    # Escalation path
    for block_id in state._medium_locked.keys():
        var label := _id_to_label(block_id)
        var cells := _find_cells_of_label(solved_board, label)
        var revealed: Array = state.get_medium_cells(block_id)
        for c in cells:
            if not revealed.has(c):
                return HintResult.medium_ok(block_id, c)
    # Fresh pick
    if palette.is_empty():
        var r := HintResult.new()
        r.ok = false; r.tier = HintResult.Tier.MEDIUM; r.reason = "no_solution"
        return r
    for b in palette:
        if state.is_orientation_locked(b.id):
            continue
        var label := _id_to_label(b.id)
        var cells := _find_cells_of_label(solved_board, label)
        if not cells.is_empty():
            return HintResult.medium_ok(b.id, cells[0])
    var r2 := HintResult.new()
    r2.ok = false; r2.tier = HintResult.Tier.MEDIUM; r2.reason = "already_complete"
    return r2

# STRONG — force-place a palette block at its solved origin. Returns origin +
# ids of placed_blocks whose footprint overlaps the strong placement.
static func strong_hint(state: HintState, placed: Array, palette: Array,
                       _uncoverable: Array, solved_board: Array) -> HintResult:
    if palette.is_empty():
        var r := HintResult.new()
        r.ok = false; r.tier = HintResult.Tier.STRONG; r.reason = "no_solution"
        return r
    for b in palette:
        if state._strong_locked.has(b.id):
            continue
        var label := _id_to_label(b.id)
        var cells := _find_cells_of_label(solved_board, label)
        if cells.is_empty():
            continue
        # Origin = top-left of cells bounding box
        var min_x: int = cells[0].x
        var min_y: int = cells[0].y
        for c in cells:
            if c.x < min_x: min_x = c.x
            if c.y < min_y: min_y = c.y
        var origin := Vector2i(min_x, min_y)
        # Determine cell footprint of strong placement
        var footprint: Dictionary = {}
        for c in cells:
            footprint[c] = true
        # Find placed blocks whose footprint overlaps
        var evicted := PackedStringArray()
        for pb in placed:
            for sy in range(pb.shape.size()):
                for sx in range(pb.shape[sy].size()):
                    if pb.shape[sy][sx] != 1:
                        continue
                    var cell := Vector2i(pb.x + sx, pb.y + sy)
                    if footprint.has(cell) and not evicted.has(pb.id):
                        evicted.append(pb.id)
        return HintResult.strong_ok(b.id, origin, evicted)
    var r2 := HintResult.new()
    r2.ok = false; r2.tier = HintResult.Tier.STRONG; r2.reason = "already_complete"
    return r2
```

### Step 1.4 — Add the missing HintResult factory

`HintResult` has `weak_ok(cell)` but the solver needs `weak_ok_with_block(block_id, cell)`. Add it:

- [ ] Edit `games/calendar_puzzle/systems/hint_result.gd` — add this static method after the existing `weak_ok`:

```gdscript
static func weak_ok_with_block(block: String, cell: Vector2i) -> HintResult:
    var r := HintResult.new()
    r.tier = Tier.WEAK
    r.ok = true
    r.block_id = block
    r.hinted_cell = cell
    return r
```

### Step 1.5 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: `Tests: <N> passed, 0 failed`, count = 208 (baseline) + 8 (new) = **216/216**.

### Step 1.6 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add games/calendar_puzzle/systems/hint_solver.gd games/calendar_puzzle/systems/hint_result.gd tests/test_hint_solver.gd && \
  git commit -m "feat(hint): M5 Task 3 — HintSolver static module + 8 tests

Pure-static module wrapping PuzzleGenerator.solved_board + get_hint_shape +
solved_placements. weak/medium/strong covering cap exhaustion, escalation,
and eviction. Adds HintResult.weak_ok_with_block factory.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — board_view highlight + play_scene HUD wire + count badge

**Files:**
- Modify: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/scenes/board_view.gd`
- Modify: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/scenes/play_scene.gd`
- Modify: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/scenes/play_scene.tscn`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_play_scene_hint_integration.gd`

### Step 2.1 — Extend board_view with hint highlight

- [ ] Edit `games/calendar_puzzle/scenes/board_view.gd`:

After the `clear_ghost()` function, add:

```gdscript
# Hint highlight — single cell pulsing colored overlay, auto-clears after
# `duration_sec`. play_scene calls this from _on_weak_hint_pressed.
var _hint_cell: Vector2i = Vector2i(-1, -1)
var _hint_timer: SceneTreeTimer = null
const COLOR_HINT := Color(1.0, 0.85, 0.2, 0.7)

func set_hint_highlight(cell: Vector2i, duration_sec: float) -> void:
    _hint_cell = cell
    queue_redraw()
    if _hint_timer != null and _hint_timer.timeout.is_connected(_clear_hint_highlight):
        _hint_timer.timeout.disconnect(_clear_hint_highlight)
    _hint_timer = get_tree().create_timer(duration_sec)
    _hint_timer.timeout.connect(_clear_hint_highlight)

func _clear_hint_highlight() -> void:
    _hint_cell = Vector2i(-1, -1)
    _hint_timer = null
    queue_redraw()

func is_hint_visible() -> bool:
    return _hint_cell.x >= 0
```

Then inside `_draw()`, AFTER the existing `# 2. uncoverable highlights` block but BEFORE placed-blocks rendering, add:

```gdscript
    # 3. hint highlight (single cell, 3-sec pulse)
    if _hint_cell.x >= 0:
        var hrect := Rect2(_hint_cell.x * CELL_SIZE + 4, _hint_cell.y * CELL_SIZE + 4,
                           CELL_SIZE - 8, CELL_SIZE - 8)
        draw_rect(hrect, COLOR_HINT)
```

### Step 2.2 — Extend play_scene.tscn with HUD HintButton + count Label + AdvancedHintsContainer

- [ ] Edit `games/calendar_puzzle/scenes/play_scene.tscn`. Append before the final blank line:

```
[node name="HintButton" type="Button" parent="HUD"]
text = "💡 3"
custom_minimum_size = Vector2(80, 40)

[node name="AdvancedHintsContainer" type="HBoxContainer" parent="HUD"]
visible = false

[node name="MediumHintButton" type="Button" parent="HUD/AdvancedHintsContainer"]
text = "💡💡 3"
custom_minimum_size = Vector2(80, 40)

[node name="StrongHintButton" type="Button" parent="HUD/AdvancedHintsContainer"]
text = "💡💡💡 1"
custom_minimum_size = Vector2(80, 40)
```

### Step 2.3 — Wire HintButton into play_scene.gd

- [ ] Edit `games/calendar_puzzle/scenes/play_scene.gd`:

**Add at top, after the existing const block (~line 18):**

```gdscript
const HintState = preload("res://games/calendar_puzzle/systems/hint_state.gd")
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")
const HintSolver = preload("res://games/calendar_puzzle/systems/hint_solver.gd")
```

**Add instance vars after the existing `var uncoverable: Array = []` (~line 36):**

```gdscript
# M5: hint runtime state. Reset on each load_puzzle.
var solved_board: Array = []
var _hint_state: HintState = null
```

**Modify `_apply_puzzle` (~line 90)** — append at the bottom of the function:

```gdscript
    # M5: initialize hint state for this puzzle. Caller (load_puzzle /
    # _load_puzzle for fixtures) sets puzzle_id + difficulty afterwards.
    if _hint_state == null:
        _hint_state = HintState.new("", false)
```

**Modify `load_puzzle` (~line 106)** — after the existing `_apply_puzzle(fake_puzzle)` line, before `_start_time_ms = Time.get_ticks_msec()`:

```gdscript
    solved_board = generated.solved_board
    _hint_state = HintState.new(String(payload.date), String(payload.difficulty) == "insomnia")
    _refresh_hint_hud()
```

**Modify `_ready` (~line 60)** — append after the existing `hud_load = ...` block:

```gdscript
    var hud_hint = get_node_or_null("HUD/HintButton")
    if hud_hint:
        hud_hint.pressed.connect(_on_weak_hint_pressed)
    var hud_medium = get_node_or_null("HUD/AdvancedHintsContainer/MediumHintButton")
    if hud_medium:
        hud_medium.pressed.connect(_on_medium_hint_pressed)
    var hud_strong = get_node_or_null("HUD/AdvancedHintsContainer/StrongHintButton")
    if hud_strong:
        hud_strong.pressed.connect(_on_strong_hint_pressed)
    var adv = get_node_or_null("HUD/AdvancedHintsContainer")
    if adv:
        adv.visible = deps.advanced_hints_enabled if "advanced_hints_enabled" in deps else false
```

**Add new functions at the bottom of the file:**

```gdscript
# --- M5: hint handlers ---

func _on_weak_hint_pressed() -> void:
    if _hint_state == null or not _hint_state.can_use(HintResult.Tier.WEAK):
        return
    var result: HintResult = HintSolver.weak_hint(_hint_state, placed_blocks,
        palette_blocks, uncoverable, solved_board)
    if not result.ok:
        return
    _hint_state.mark_weak_used(result.block_id)
    board_view.set_hint_highlight(result.hinted_cell, 3.0)
    _refresh_hint_hud()
    _mark_state_dirty()

func _on_medium_hint_pressed() -> void:
    if _hint_state == null or not _hint_state.can_use(HintResult.Tier.MEDIUM):
        return
    var result: HintResult = HintSolver.medium_hint(_hint_state, placed_blocks,
        palette_blocks, uncoverable, solved_board)
    if not result.ok:
        return
    _hint_state.mark_medium_used(result.block_id, result.hinted_cell)
    board_view.set_hint_highlight(result.hinted_cell, 3.0)
    _refresh_hint_hud()
    _mark_state_dirty()

func _on_strong_hint_pressed() -> void:
    if _hint_state == null or not _hint_state.can_use(HintResult.Tier.STRONG):
        return
    var result: HintResult = HintSolver.strong_hint(_hint_state, placed_blocks,
        palette_blocks, uncoverable, solved_board)
    if not result.ok:
        return
    # Evict overlapping placed blocks back to palette
    for evicted_id in result.evicted_block_ids:
        for b in placed_blocks:
            if b.id == evicted_id:
                _remove_to_palette(b)
                break
    # Pull strong block out of palette and place it
    var strong_block: Dictionary = {}
    for b in palette_blocks:
        if b.id == result.block_id:
            strong_block = Board.clone_block(b)
            break
    if strong_block.is_empty():
        return
    palette_blocks = palette_blocks.filter(func(x): return x.id != result.block_id)
    palette_view.set_blocks(palette_blocks)
    strong_block["x"] = result.placed_at.x
    strong_block["y"] = result.placed_at.y
    placed_blocks.append(strong_block)
    board_view.set_placed(placed_blocks)
    _hint_state.mark_strong_used(result.block_id, result.placed_at)
    _refresh_hint_hud()
    _check_win()
    _mark_state_dirty()

func _refresh_hint_hud() -> void:
    var hint_btn := get_node_or_null("HUD/HintButton") as Button
    if hint_btn and _hint_state:
        var rem := _hint_state.remaining(HintResult.Tier.WEAK)
        hint_btn.text = "💡 %d" % rem
        hint_btn.disabled = (rem == 0)
    var med_btn := get_node_or_null("HUD/AdvancedHintsContainer/MediumHintButton") as Button
    if med_btn and _hint_state:
        var rem := _hint_state.remaining(HintResult.Tier.MEDIUM)
        med_btn.text = "💡💡 %d" % rem
        med_btn.disabled = (rem == 0)
    var strong_btn := get_node_or_null("HUD/AdvancedHintsContainer/StrongHintButton") as Button
    if strong_btn and _hint_state:
        var rem := _hint_state.remaining(HintResult.Tier.STRONG)
        strong_btn.text = "💡💡💡 %d" % rem
        strong_btn.disabled = (rem == 0)
```

### Step 2.4 — Add `advanced_hints_enabled` field to GameDeps (stub for now)

- [ ] Edit `shared/game_deps.gd`. Add after `var on_exit: Callable`:

```gdscript
# M5: --enable-advanced-hints CLI flag. Default false; boot.gd sets.
var advanced_hints_enabled: bool = false
```

(Keep `is_complete()` unchanged — bool field with default doesn't need null-check.)

### Step 2.5 — Write integration test

- [ ] Create `tests/test_play_scene_hint_integration.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const PlayScene = preload("res://games/calendar_puzzle/scenes/play_scene.tscn")
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")
const GameDeps = preload("res://shared/game_deps.gd")
const InputContext = preload("res://shared/input/input_context.gd")
const SaveAdapter = preload("res://shared/save/save_adapter.gd")

class _StubSave extends SaveAdapter:
    var _store := {}
    func write(key: String, r: Resource) -> Error:
        _store[key] = r
        return OK
    func read(key: String) -> Resource:
        return _store.get(key, null)
    func delete(key: String) -> Error:
        _store.erase(key); return OK
    func list_keys() -> PackedStringArray:
        return PackedStringArray(_store.keys())

func _build_deps(advanced: bool = false) -> GameDeps:
    var d := GameDeps.new()
    d.save = _StubSave.new()
    d.input = InputContext.new()
    d.i18n = load("res://shared/i18n/stub_translation_context.gd").new()
    d.platform = load("res://shared/platform/platform_bus.gd").new()
    d.on_exit = func(): pass
    d.advanced_hints_enabled = advanced
    return d

func _make_scene(advanced: bool = false) -> Control:
    var s = PlayScene.instantiate()
    s.setup(_build_deps(advanced))
    add_child_autofree(s)
    s.load_puzzle({
        "date": "2026-06-02", "difficulty": "easy", "seed": 1, "combo_index": 0,
    })
    return s

func test_hint_button_visible_advanced_hidden_by_default():
    var s := _make_scene(false)
    var hint_btn := s.get_node("HUD/HintButton") as Button
    var adv := s.get_node("HUD/AdvancedHintsContainer") as Control
    assert_true(hint_btn.visible)
    assert_false(adv.visible)

func test_advanced_container_visible_when_flag_set():
    var s := _make_scene(true)
    var adv := s.get_node("HUD/AdvancedHintsContainer") as Control
    assert_true(adv.visible)

func test_weak_hint_press_decrements_count_and_shows_highlight():
    var s := _make_scene(false)
    var hint_btn := s.get_node("HUD/HintButton") as Button
    assert_eq(hint_btn.text, "💡 3")
    hint_btn.pressed.emit()
    assert_eq(hint_btn.text, "💡 2")
    var bv := s.get_node("VBox/BoardView")
    assert_true(bv.is_hint_visible())

func test_weak_hint_button_disabled_when_cap_exhausted():
    var s := _make_scene(false)
    var hint_btn := s.get_node("HUD/HintButton") as Button
    hint_btn.pressed.emit()
    hint_btn.pressed.emit()
    hint_btn.pressed.emit()
    assert_eq(hint_btn.text, "💡 0")
    assert_true(hint_btn.disabled)

func test_hint_state_initialized_per_load_puzzle():
    var s := _make_scene(false)
    var st = s._hint_state
    assert_not_null(st)
    assert_eq(st.cap_for(HintResult.Tier.WEAK), 3)
```

### Step 2.6 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 216 + 5 = **221/221 pass**.

### Step 2.7 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add games/calendar_puzzle/scenes/board_view.gd \
  games/calendar_puzzle/scenes/play_scene.gd games/calendar_puzzle/scenes/play_scene.tscn \
  shared/game_deps.gd tests/test_play_scene_hint_integration.gd && \
  git commit -m "feat(hint): M5 Task 4 — HUD HintButton + board_view highlight + 5 tests

Adds board_view.set_hint_highlight (3s SceneTreeTimer auto-clear),
play_scene HUD wires 💡 button + Medium/Strong AdvancedHintsContainer
(hidden by default; visible when deps.advanced_hints_enabled=true),
_refresh_hint_hud updates count/disabled state. Stubs
GameDeps.advanced_hints_enabled=false; Task 5 fills the boot.gd parse.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Orientation lock enforcement (rotate/mirror gate + palette pickup snap)

**Files:**
- Modify: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/scenes/play_scene.gd`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_orientation_lock.gd`

### Step 3.1 — Write failing test

- [ ] Create `tests/test_orientation_lock.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const PlayScene = preload("res://games/calendar_puzzle/scenes/play_scene.tscn")
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")
const GameDeps = preload("res://shared/game_deps.gd")
const InputContext = preload("res://shared/input/input_context.gd")
const SaveAdapter = preload("res://shared/save/save_adapter.gd")

class _StubSave extends SaveAdapter:
    var _store := {}
    func write(k: String, r: Resource) -> Error: _store[k]=r; return OK
    func read(k: String) -> Resource: return _store.get(k, null)
    func delete(k: String) -> Error: _store.erase(k); return OK
    func list_keys() -> PackedStringArray: return PackedStringArray(_store.keys())

func _deps() -> GameDeps:
    var d := GameDeps.new()
    d.save = _StubSave.new()
    d.input = InputContext.new()
    d.i18n = load("res://shared/i18n/stub_translation_context.gd").new()
    d.platform = load("res://shared/platform/platform_bus.gd").new()
    d.on_exit = func(): pass
    return d

func _scene() -> Control:
    var s = PlayScene.instantiate()
    s.setup(_deps())
    add_child_autofree(s)
    s.load_puzzle({"date":"2026-06-02","difficulty":"easy","seed":1,"combo_index":0})
    return s

func test_rotate_ignored_when_drag_block_is_weak_locked():
    var s := _scene()
    # pick first palette block, fake-drag it
    var b: Dictionary = Board.clone_block(s.palette_blocks[0])
    b["x"] = 0; b["y"] = 0
    s.drag_block = b
    s.state = s.State.DRAGGING
    var original_shape: Array = b.shape.duplicate(true)
    # lock its orientation
    s._hint_state.mark_weak_used(b.id)
    # fire action
    s.deps.input.action_triggered.emit("rotate")
    assert_eq(s.drag_block.shape, original_shape, "rotate must be a no-op on weak-locked block")

func test_mirror_ignored_when_drag_block_is_weak_locked():
    var s := _scene()
    var b: Dictionary = Board.clone_block(s.palette_blocks[0])
    b["x"] = 0; b["y"] = 0
    s.drag_block = b
    s.state = s.State.DRAGGING
    var original_shape: Array = b.shape.duplicate(true)
    s._hint_state.mark_weak_used(b.id)
    s.deps.input.action_triggered.emit("mirror")
    assert_eq(s.drag_block.shape, original_shape)

func test_rotate_works_on_non_locked_block():
    var s := _scene()
    var b: Dictionary = Board.clone_block(s.palette_blocks[0])
    b["x"] = 0; b["y"] = 0
    s.drag_block = b
    s.state = s.State.DRAGGING
    var original_shape: Array = b.shape.duplicate(true)
    s.deps.input.action_triggered.emit("rotate")
    assert_ne(s.drag_block.shape, original_shape, "rotate must mutate shape on un-locked block")

func test_palette_pickup_snaps_locked_block_to_solved_orientation():
    var s := _scene()
    # use weak hint to lock first
    var hint_btn := s.get_node("HUD/HintButton") as Button
    hint_btn.pressed.emit()
    var locked_id: String = ""
    for k in s._hint_state._weak_locked.keys():
        locked_id = k
        break
    assert_ne(locked_id, "", "weak hint should have locked at least one block")
    # find it in palette and check shape after pickup
    var palette_block: Dictionary = {}
    for b in s.palette_blocks:
        if b.id == locked_id:
            palette_block = b
            break
    assert_false(palette_block.is_empty())
    # programmatically begin drag (skip pointer math)
    s._begin_drag_from_palette(locked_id, Vector2(0, 0))
    # solved_board's shape for this block is the canonical orientation
    var label: String = ""
    for tt in Board.INITIAL_BLOCK_TYPES:
        if tt.id == locked_id: label = tt.label; break
    var expected_shape = load("res://games/calendar_puzzle/solver/puzzle_generator.gd") \
        .get_hint_shape(s.solved_board, label)
    assert_eq(s.drag_block.shape, expected_shape, "pickup must snap to solved orientation")
```

### Step 3.2 — Run tests to verify they fail

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -20
```
Expected: 3 of the 4 new tests fail (the unlocked-rotate one may pass by accident). At least the two `*_ignored_when_*_weak_locked` and the snap test must fail.

### Step 3.3 — Implement the gate

- [ ] Edit `games/calendar_puzzle/scenes/play_scene.gd`:

**Modify `_on_action_triggered`** (~line 210). Replace the existing function body with:

```gdscript
func _on_action_triggered(action: String) -> void:
    if state != State.DRAGGING:
        return
    # M5: orientation lock — weak/strong hint pinned this block to one orientation
    if _hint_state != null and _hint_state.is_orientation_locked(drag_block.id):
        return
    match action:
        "rotate":
            drag_block.shape = Board.rotate_shape(drag_block.shape)
            _update_ghost(deps.input.get_pointer_position())
        "mirror":
            drag_block.shape = Board.flip_shape(drag_block.shape)
            _update_ghost(deps.input.get_pointer_position())
```

**Modify `_begin_drag_from_palette`** (~line 225). After the existing `drag_block = Board.clone_block(b)` line and before `drag_block["x"] = 0`:

```gdscript
    # M5: snap to canonical solved orientation if weak/strong locked
    if _hint_state != null and _hint_state.is_orientation_locked(block_id) and not solved_board.is_empty():
        var label := ""
        for tt in Board.INITIAL_BLOCK_TYPES:
            if tt.id == block_id:
                label = tt.label
                break
        var canonical = PuzzleGenerator.get_hint_shape(solved_board, label)
        if canonical != null:
            drag_block.shape = canonical
```

### Step 3.4 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 221 + 4 = **225/225 pass**.

### Step 3.5 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add games/calendar_puzzle/scenes/play_scene.gd \
  tests/test_orientation_lock.gd && \
  git commit -m "feat(hint): M5 Task 5 — orientation lock on rotate/mirror + palette pickup snap

_on_action_triggered ignores rotate/mirror when _hint_state.is_orientation_locked.
_begin_drag_from_palette snaps drag_block.shape to PuzzleGenerator.get_hint_shape
when locked. 4 tests cover lock + un-locked passthrough.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — GameSnapshot hint persistence + round-trip

**Files:**
- Modify: `~/mygit/calendar-puzzle-godot/shared/save/game_snapshot.gd`
- Modify: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/scenes/play_scene.gd`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_hint_snapshot_roundtrip.gd`

### Step 4.1 — Write failing test

- [ ] Create `tests/test_hint_snapshot_roundtrip.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const PlayScene = preload("res://games/calendar_puzzle/scenes/play_scene.tscn")
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")
const GameSnapshot = preload("res://shared/save/game_snapshot.gd")
const GameDeps = preload("res://shared/game_deps.gd")
const InputContext = preload("res://shared/input/input_context.gd")
const SaveAdapter = preload("res://shared/save/save_adapter.gd")

class _StubSave extends SaveAdapter:
    var _store := {}
    func write(k: String, r: Resource) -> Error: _store[k]=r; return OK
    func read(k: String) -> Resource: return _store.get(k, null)
    func delete(k: String) -> Error: _store.erase(k); return OK
    func list_keys() -> PackedStringArray: return PackedStringArray(_store.keys())

func _deps() -> GameDeps:
    var d := GameDeps.new()
    d.save = _StubSave.new()
    d.input = InputContext.new()
    d.i18n = load("res://shared/i18n/stub_translation_context.gd").new()
    d.platform = load("res://shared/platform/platform_bus.gd").new()
    d.on_exit = func(): pass
    return d

func _scene() -> Control:
    var s = PlayScene.instantiate()
    s.setup(_deps())
    add_child_autofree(s)
    s.load_puzzle({"date":"2026-06-02","difficulty":"easy","seed":1,"combo_index":0})
    return s

func test_snapshot_captures_hint_counts_and_locks():
    var s := _scene()
    s.get_node("HUD/HintButton").pressed.emit()
    s.get_node("HUD/HintButton").pressed.emit()
    var snap: GameSnapshot = s._current_snapshot()
    assert_eq(snap.weak_hint_used, 2)
    assert_eq(snap.weak_locked.size(), 2)

func test_snapshot_roundtrip_restores_state():
    var s := _scene()
    s.get_node("HUD/HintButton").pressed.emit()
    s.get_node("HUD/HintButton").pressed.emit()
    var locked_before: Dictionary = s._hint_state._weak_locked.duplicate(true)
    var snap: GameSnapshot = s._current_snapshot()
    # New scene + restore
    var s2 := _scene()
    s2.restore_from_snapshot(snap)
    assert_eq(s2._hint_state.used_for(HintResult.Tier.WEAK), 2)
    assert_eq(s2._hint_state._weak_locked, locked_before)

func test_snapshot_carries_medium_cells():
    var s := _scene()
    s._hint_state.mark_medium_used("I-block", Vector2i(3, 4))
    var snap: GameSnapshot = s._current_snapshot()
    assert_eq(snap.medium_hint_used, 1)
    assert_true(snap.medium_locked.has("I-block"))
    var cells: Array = snap.medium_locked["I-block"]
    assert_eq(cells[0], Vector2i(3, 4))

func test_hud_refreshed_after_restore():
    var s := _scene()
    s.get_node("HUD/HintButton").pressed.emit()
    var snap: GameSnapshot = s._current_snapshot()
    var s2 := _scene()
    s2.restore_from_snapshot(snap)
    var btn := s2.get_node("HUD/HintButton") as Button
    assert_eq(btn.text, "💡 2")
```

### Step 4.2 — Run tests to verify they fail

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 4 of the new tests fail (snap.weak_locked field doesn't exist, restore doesn't repopulate hint state).

### Step 4.3 — Extend GameSnapshot

- [ ] Edit `shared/save/game_snapshot.gd`. Append before the `func is_empty()` function:

```gdscript
# M5: hint lock dictionaries (counts already present above).
@export var weak_locked: Dictionary = {}      # block_id → true
@export var medium_locked: Dictionary = {}    # block_id → Array[Vector2i]
@export var strong_locked: Dictionary = {}    # block_id → Vector2i
```

### Step 4.4 — Plumb capture in play_scene._current_snapshot

- [ ] Edit `games/calendar_puzzle/scenes/play_scene.gd`. In `_current_snapshot` (~line 300), before the final `return s`:

```gdscript
    if _hint_state != null:
        s.weak_hint_used   = _hint_state.used_for(HintResult.Tier.WEAK)
        s.medium_hint_used = _hint_state.used_for(HintResult.Tier.MEDIUM)
        s.strong_hint_used = _hint_state.used_for(HintResult.Tier.STRONG)
        s.weak_locked      = _hint_state._weak_locked.duplicate(true)
        s.medium_locked    = _hint_state._medium_locked.duplicate(true)
        s.strong_locked    = _hint_state._strong_locked.duplicate(true)
```

### Step 4.5 — Plumb restore in play_scene.restore_from_snapshot

- [ ] Edit `games/calendar_puzzle/scenes/play_scene.gd`. In `restore_from_snapshot` (~line 318), at the end of the function (after `_elapsed_ms_at_win = -1`):

```gdscript
    # M5: rehydrate hint state. load_puzzle above has already re-populated
    # solved_board via PuzzleGenerator.generate_puzzle, and constructed a
    # fresh _hint_state. We restore over it.
    if _hint_state != null:
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
        _refresh_hint_hud()
```

### Step 4.6 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 225 + 4 = **229/229 pass**.

### Step 4.7 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add shared/save/game_snapshot.gd \
  games/calendar_puzzle/scenes/play_scene.gd tests/test_hint_snapshot_roundtrip.gd && \
  git commit -m "feat(save): M5 Task 6 — GameSnapshot hint persistence + restore + 4 tests

GameSnapshot gains weak_locked/medium_locked/strong_locked Dictionary
exports. play_scene._current_snapshot serializes _hint_state into them;
restore_from_snapshot rehydrates after load_puzzle rebuilds solved_board.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — `--enable-advanced-hints` CLI flag in boot.gd

**Files:**
- Modify: `~/mygit/calendar-puzzle-godot/boot/boot.gd`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_advanced_hints_flag.gd`

### Step 5.1 — Write failing test

- [ ] Create `tests/test_advanced_hints_flag.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const GameDeps = preload("res://shared/game_deps.gd")

# The flag check is one line: OS.get_cmdline_args().has("--enable-advanced-hints").
# We can't easily mutate OS.get_cmdline_args in headless tests, so we test the
# wrapper function in boot.gd directly. boot.gd exposes:
#   static func parse_advanced_hints_flag(args: PackedStringArray) -> bool

func test_flag_present():
    var Boot = load("res://boot/boot.gd")
    var args := PackedStringArray(["--headless", "--enable-advanced-hints"])
    assert_true(Boot.parse_advanced_hints_flag(args))

func test_flag_absent():
    var Boot = load("res://boot/boot.gd")
    var args := PackedStringArray(["--headless"])
    assert_false(Boot.parse_advanced_hints_flag(args))

func test_gamedeps_default_is_false():
    var d := GameDeps.new()
    assert_false(d.advanced_hints_enabled)
```

### Step 5.2 — Run tests to verify failure

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: `parse_advanced_hints_flag` not defined — first 2 tests fail.

### Step 5.3 — Implement parse helper + wire into deps build

- [ ] Edit `boot/boot.gd`:

**Add a static parser function** (top-level, can be inserted right above the `func _on_game_exit` definition or anywhere top-level):

```gdscript
# M5: parse --enable-advanced-hints. Static + pure for testability.
static func parse_advanced_hints_flag(args: PackedStringArray) -> bool:
    return args.has("--enable-advanced-hints")
```

**Modify the deps-builder** (the section building `GameDeps` ~line 44-50 inside `_build_deps`). Right before `return deps`:

```gdscript
    deps.advanced_hints_enabled = parse_advanced_hints_flag(OS.get_cmdline_args())
```

### Step 5.4 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 229 + 3 = **232/232 pass**.

### Step 5.5 — Headless smoke check

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --quit-after 3 res://boot/boot.tscn 2>&1 | grep -iE "error|warning" | head
```
Expected: no ERROR or WARNING lines (existing warnings about audio are fine; new code adds none).

### Step 5.6 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add boot/boot.gd tests/test_advanced_hints_flag.gd && \
  git commit -m "feat(boot): M5 Task 7 — --enable-advanced-hints CLI flag wired to GameDeps

Static parse helper + 3 tests. _build_deps fills
GameDeps.advanced_hints_enabled, which play_scene._ready already consumes
to toggle HUD/AdvancedHintsContainer.visible.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Tutorial fixture + `placed_count_changed` signal

**Files:**
- Create: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/tutorial/tutorial_fixture.gd`
- Modify: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/scenes/play_scene.gd`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_tutorial_fixture.gd`

### Step 6.1 — Write failing test

- [ ] Create `tests/test_tutorial_fixture.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const TutorialFixture = preload("res://games/calendar_puzzle/tutorial/tutorial_fixture.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")

func test_payload_has_required_keys():
    var p: Dictionary = TutorialFixture.payload()
    assert_true(p.has("date"))
    assert_true(p.has("difficulty"))
    assert_true(p.has("seed"))
    assert_true(p.has("combo_index"))

func test_puzzle_dict_has_two_remaining_blocks():
    var puzzle: Dictionary = TutorialFixture.puzzle_dict()
    assert_eq(puzzle.remaining_blocks.size(), 2,
        "tutorial fixture should hand the player exactly 2 blocks to teach with")

func test_uncoverable_cells_are_inside_grid():
    var puzzle: Dictionary = TutorialFixture.puzzle_dict()
    var uncov := Board.get_uncoverable_cells(puzzle.date)
    for c in uncov:
        assert_true(c.x >= 0 and c.x < 7)
        assert_true(c.y >= 0 and c.y < 8)
```

### Step 6.2 — Run, expect failure

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: tutorial_fixture.gd does not exist.

### Step 6.3 — Implement tutorial fixture

- [ ] Create `games/calendar_puzzle/tutorial/tutorial_fixture.gd`:

```gdscript
# games/calendar_puzzle/tutorial/tutorial_fixture.gd
# Static factory returning a deterministic puzzle for the 5-step tutorial.
# Uses PuzzleGenerator with a fixed date + combo_index. The resulting puzzle
# has the standard difficulty's remaining_blocks count, then we manually
# trim to 2 by pre-placing the rest (so the tutorial only asks the player
# to drag/place/remove 2 blocks).
class_name TutorialFixture extends RefCounted

const PuzzleGenerator = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")
const PackResource = preload("res://games/calendar_puzzle/solver/pack_resource.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")

const PACK_PATH := "res://games/calendar_puzzle/solver/pack_free.tres"
const FIXTURE_DATE := {"year": 2026, "month": 6, "day": 2, "weekday": 2}  # Tue

# load_puzzle payload form — game.gd / play_scene.gd consume this.
static func payload() -> Dictionary:
    return {
        "date": "2026-06-02",
        "difficulty": "easy",
        "seed": 0,
        "combo_index": 0,
    }

# Direct puzzle dict (for tests + custom callers); same shape as _apply_puzzle expects.
static func puzzle_dict() -> Dictionary:
    var pack_res := load(PACK_PATH) as PackResource
    var pack_data: Dictionary = pack_res.data if pack_res != null else {}
    var generated = PuzzleGenerator.generate_puzzle("easy", {
        "date": FIXTURE_DATE,
        "pack_data": pack_data,
        "combo_index": 0,
    })
    if generated == null:
        push_error("[TutorialFixture] generate_puzzle returned null")
        return {}
    # Reduce remaining to exactly 2 by pushing the extras into pre_placed.
    var pre: Array = generated.pre_placed_blocks.duplicate(true)
    var rem: Array = generated.remaining_blocks.duplicate(true)
    while rem.size() > 2:
        var pulled: Dictionary = rem.pop_front()
        # Find solved origin for `pulled.id` to place it.
        var solved_origin := _solved_origin_for(generated.solved_board, _label_for(pulled.id))
        if solved_origin.x < 0:
            continue
        var placed = Board.clone_block(pulled)
        placed["x"] = solved_origin.x
        placed["y"] = solved_origin.y
        # snap shape to solved orientation
        placed.shape = PuzzleGenerator.get_hint_shape(generated.solved_board, _label_for(pulled.id))
        pre.append(placed)
    return {
        "date": FIXTURE_DATE,
        "pre_placed_blocks": pre,
        "remaining_blocks": rem,
    }

static func _label_for(block_id: String) -> String:
    for b in Board.INITIAL_BLOCK_TYPES:
        if b.id == block_id:
            return b.label
    return ""

static func _solved_origin_for(solved_board: Array, label: String) -> Vector2i:
    var min_x := 99
    var min_y := 99
    var found := false
    for r in range(solved_board.size()):
        for c in range(solved_board[r].size()):
            if solved_board[r][c] == label:
                found = true
                if c < min_x: min_x = c
                if r < min_y: min_y = r
    return Vector2i(min_x, min_y) if found else Vector2i(-1, -1)
```

### Step 6.4 — Add `placed_count_changed` signal to play_scene

- [ ] Edit `games/calendar_puzzle/scenes/play_scene.gd`:

**Add signal at top, after `signal won`** (~line 23):

```gdscript
# M5: tutorial overlay subscribes to this to advance steps 3 (place) and 4 (remove).
signal placed_count_changed(new_count: int)
```

**Modify `_on_pointer_released`** (~line 177). Right after `_mark_state_dirty()` at end of function, add:

```gdscript
    placed_count_changed.emit(placed_blocks.size())
```

**Modify `_remove_to_palette`** (~line 256). Right after `_mark_state_dirty()` at end:

```gdscript
    placed_count_changed.emit(placed_blocks.size())
```

### Step 6.5 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 232 + 3 = **235/235 pass**.

### Step 6.6 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add games/calendar_puzzle/tutorial/tutorial_fixture.gd \
  games/calendar_puzzle/scenes/play_scene.gd tests/test_tutorial_fixture.gd && \
  git commit -m "feat(tutorial): M5 Task 8a — fixture factory + placed_count_changed signal

TutorialFixture.payload() returns load_puzzle-compatible dict; puzzle_dict()
returns a 2-remaining_blocks variant for the 5-step tutorial. play_scene
emits placed_count_changed on place + remove (signal for tutorial overlay
to consume; no other consumers).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — Tutorial overlay scene + 5-step state machine

**Files:**
- Create: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/tutorial/tutorial_step.gd`
- Create: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/tutorial/tutorial_overlay.gd`
- Create: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/tutorial/tutorial_overlay.tscn`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_tutorial_flow.gd`

### Step 7.1 — Write failing test

- [ ] Create `tests/test_tutorial_flow.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const TutorialOverlay = preload("res://games/calendar_puzzle/tutorial/tutorial_overlay.gd")
const TutorialOverlayScene = preload("res://games/calendar_puzzle/tutorial/tutorial_overlay.tscn")

func _make_overlay() -> Node:
    var o = TutorialOverlayScene.instantiate()
    add_child_autofree(o)
    return o

func test_overlay_starts_on_step_1():
    var o := _make_overlay()
    assert_eq(o.current_step, 1)

func test_click_next_advances_from_step_1():
    var o := _make_overlay()
    o.advance_from_click_next()
    assert_eq(o.current_step, 2)

func test_palette_drag_advances_step_2():
    var o := _make_overlay()
    o.advance_from_click_next()  # step 1 → 2
    o.notify_palette_drag()
    assert_eq(o.current_step, 3)

func test_place_advances_step_3():
    var o := _make_overlay()
    o.current_step = 3
    o.notify_placed_count_changed(1)
    assert_eq(o.current_step, 4)

func test_remove_advances_step_4():
    var o := _make_overlay()
    o.current_step = 4
    o._last_placed_count = 1
    o.notify_placed_count_changed(0)
    assert_eq(o.current_step, 5)

func test_done_emits_tutorial_finished():
    var o := _make_overlay()
    o.current_step = 5
    var captured := [false]
    o.tutorial_finished.connect(func(): captured[0] = true)
    o.advance_from_click_done()
    assert_true(captured[0])

func test_skip_emits_tutorial_finished_from_any_step():
    var o := _make_overlay()
    o.current_step = 2
    var captured := [false]
    o.tutorial_finished.connect(func(): captured[0] = true)
    o.skip()
    assert_true(captured[0])

func test_wrong_event_does_not_advance():
    var o := _make_overlay()
    # step 1 only advances on "Next" click; palette-drag should be ignored
    o.notify_palette_drag()
    assert_eq(o.current_step, 1)
```

### Step 7.2 — Run, expect failure

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: tutorial_overlay.gd / .tscn do not exist.

### Step 7.3 — Implement tutorial_step.gd

- [ ] Create `games/calendar_puzzle/tutorial/tutorial_step.gd`:

```gdscript
# games/calendar_puzzle/tutorial/tutorial_step.gd
# A single step Control. Holds text + advance hint. tutorial_overlay.gd
# switches visibility between step Controls.
class_name TutorialStep extends Control

@export var step_index: int = 1
@export var text: String = ""
```

### Step 7.4 — Implement tutorial_overlay.gd

- [ ] Create `games/calendar_puzzle/tutorial/tutorial_overlay.gd`:

```gdscript
# games/calendar_puzzle/tutorial/tutorial_overlay.gd
# 5-step state machine. game.gd mounts this as CanvasLayer child of play_scene
# on first New Game, subscribes to deps.input + play_scene.placed_count_changed
# to drive advance_*. Emits tutorial_finished on Done (step 5) or Skip.
class_name TutorialOverlay extends CanvasLayer

signal tutorial_finished()

# 1=目标 2=锁块 3=放置 4=移除 5=完成
var current_step: int = 1
var _last_placed_count: int = 0

# Step bubble nodes are children of the .tscn — looked up lazily.
@onready var _step1: Control = get_node_or_null("Step1")
@onready var _step2: Control = get_node_or_null("Step2")
@onready var _step3: Control = get_node_or_null("Step3")
@onready var _step4: Control = get_node_or_null("Step4")
@onready var _step5: Control = get_node_or_null("Step5")
@onready var _btn_next: Button = get_node_or_null("Step1/NextButton")
@onready var _btn_done: Button = get_node_or_null("Step5/DoneButton")
@onready var _btn_skip: Button = get_node_or_null("SkipButton")

func _ready() -> void:
    if _btn_next: _btn_next.pressed.connect(advance_from_click_next)
    if _btn_done: _btn_done.pressed.connect(advance_from_click_done)
    if _btn_skip: _btn_skip.pressed.connect(skip)
    _refresh()

# --- advancers (each test drives one) ---

func advance_from_click_next() -> void:
    if current_step == 1:
        current_step = 2
        _refresh()

func notify_palette_drag() -> void:
    if current_step == 2:
        current_step = 3
        _refresh()

func notify_placed_count_changed(new_count: int) -> void:
    if current_step == 3 and new_count > _last_placed_count:
        current_step = 4
    elif current_step == 4 and new_count < _last_placed_count:
        current_step = 5
    _last_placed_count = new_count
    _refresh()

func advance_from_click_done() -> void:
    if current_step == 5:
        tutorial_finished.emit()

func skip() -> void:
    tutorial_finished.emit()

# --- visibility ---

func _refresh() -> void:
    var steps := [null, _step1, _step2, _step3, _step4, _step5]
    for i in range(1, 6):
        if steps[i]:
            steps[i].visible = (i == current_step)
```

### Step 7.5 — Implement tutorial_overlay.tscn

- [ ] Create `games/calendar_puzzle/tutorial/tutorial_overlay.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/tutorial/tutorial_overlay.gd" id="1"]

[node name="TutorialOverlay" type="CanvasLayer"]
layer = 10
script = ExtResource("1")

[node name="SkipButton" type="Button" parent="."]
text = "Skip"
offset_left = 20.0
offset_top = 20.0
offset_right = 80.0
offset_bottom = 50.0

[node name="Step1" type="PanelContainer" parent="."]
offset_left = 100.0
offset_top = 100.0
offset_right = 500.0
offset_bottom = 250.0

[node name="VBox1" type="VBoxContainer" parent="Step1"]

[node name="Label" type="Label" parent="Step1/VBox1"]
text = "目标：把所有方块放在棋盘上，留下今天日期对应的格子。"

[node name="NextButton" type="Button" parent="Step1/VBox1"]
text = "Next"

[node name="Step2" type="PanelContainer" parent="."]
visible = false
offset_left = 100.0
offset_top = 100.0
offset_right = 500.0
offset_bottom = 200.0

[node name="Label2" type="Label" parent="Step2"]
text = "拖动右下角的一个方块。"

[node name="Step3" type="PanelContainer" parent="."]
visible = false
offset_left = 100.0
offset_top = 100.0
offset_right = 500.0
offset_bottom = 200.0

[node name="Label3" type="Label" parent="Step3"]
text = "把它放到棋盘的空位。"

[node name="Step4" type="PanelContainer" parent="."]
visible = false
offset_left = 100.0
offset_top = 100.0
offset_right = 500.0
offset_bottom = 200.0

[node name="Label4" type="Label" parent="Step4"]
text = "双击已放好的方块可以取回。"

[node name="Step5" type="PanelContainer" parent="."]
visible = false
offset_left = 100.0
offset_top = 100.0
offset_right = 500.0
offset_bottom = 250.0

[node name="VBox5" type="VBoxContainer" parent="Step5"]

[node name="Label5" type="Label" parent="Step5/VBox5"]
text = "完成！点 Done 开始正式游戏。"

[node name="DoneButton" type="Button" parent="Step5/VBox5"]
text = "Done"
```

### Step 7.6 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 235 + 8 = **243/243 pass**.

### Step 7.7 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add games/calendar_puzzle/tutorial/tutorial_step.gd \
  games/calendar_puzzle/tutorial/tutorial_overlay.gd \
  games/calendar_puzzle/tutorial/tutorial_overlay.tscn \
  tests/test_tutorial_flow.gd && \
  git commit -m "feat(tutorial): M5 Task 8b — tutorial_overlay 5-step state machine + 8 tests

CanvasLayer + 5 step PanelContainers + Skip/Next/Done buttons. State
machine advances on advance_from_click_next, notify_palette_drag,
notify_placed_count_changed (step 3 = place, step 4 = remove), and emits
tutorial_finished on Done or Skip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 — game.gd wires tutorial into New Game flow

**Files:**
- Modify: `~/mygit/calendar-puzzle-godot/games/calendar_puzzle/game.gd`
- Create: `~/mygit/calendar-puzzle-godot/tests/test_tutorial_only_once.gd`

### Step 8.1 — Write failing test

- [ ] Create `tests/test_tutorial_only_once.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const CalendarPuzzleGame = preload("res://games/calendar_puzzle/game.gd")
const ProfileResource = preload("res://shared/save/profile_resource.gd")
const GameDeps = preload("res://shared/game_deps.gd")
const InputContext = preload("res://shared/input/input_context.gd")
const SaveAdapter = preload("res://shared/save/save_adapter.gd")
const TutorialOverlay = preload("res://games/calendar_puzzle/tutorial/tutorial_overlay.gd")

class _StubSave extends SaveAdapter:
    var _store := {}
    func write(k: String, r: Resource) -> Error: _store[k]=r; return OK
    func read(k: String) -> Resource: return _store.get(k, null)
    func delete(k: String) -> Error: _store.erase(k); return OK
    func list_keys() -> PackedStringArray: return PackedStringArray(_store.keys())

func _deps_with_profile(tutorial_done: bool) -> Dictionary:
    var d := GameDeps.new()
    var save := _StubSave.new()
    var profile := ProfileResource.new()
    profile.tutorial_done = tutorial_done
    save.write("profile", profile)
    d.save = save
    d.input = InputContext.new()
    d.i18n = load("res://shared/i18n/stub_translation_context.gd").new()
    d.platform = load("res://shared/platform/platform_bus.gd").new()
    d.on_exit = func(): pass
    return {"deps": d, "profile": profile, "save": save}

func test_tutorial_mounts_when_profile_says_not_done():
    var ctx := _deps_with_profile(false)
    var game = CalendarPuzzleGame.new()
    var root: Node = game.start(ctx.deps)
    add_child_autofree(root)
    game._on_puzzle_selected({"date":"2026-06-02","difficulty":"easy","seed":0,"combo_index":0})
    var found_overlay = root.find_children("*", "CanvasLayer", true, false)
    var has_tutorial := false
    for n in found_overlay:
        if n is TutorialOverlay:
            has_tutorial = true; break
    assert_true(has_tutorial, "expected TutorialOverlay child after first New Game")

func test_tutorial_skipped_when_profile_says_done():
    var ctx := _deps_with_profile(true)
    var game = CalendarPuzzleGame.new()
    var root: Node = game.start(ctx.deps)
    add_child_autofree(root)
    game._on_puzzle_selected({"date":"2026-06-02","difficulty":"easy","seed":0,"combo_index":0})
    var found_overlay = root.find_children("*", "CanvasLayer", true, false)
    var has_tutorial := false
    for n in found_overlay:
        if n is TutorialOverlay:
            has_tutorial = true; break
    assert_false(has_tutorial, "tutorial should be skipped when tutorial_done=true")

func test_tutorial_finished_sets_profile_flag_and_persists():
    var ctx := _deps_with_profile(false)
    var game = CalendarPuzzleGame.new()
    var root: Node = game.start(ctx.deps)
    add_child_autofree(root)
    game._on_puzzle_selected({"date":"2026-06-02","difficulty":"easy","seed":0,"combo_index":0})
    # Find overlay and emit finished
    var overlay: TutorialOverlay = null
    for n in root.find_children("*", "CanvasLayer", true, false):
        if n is TutorialOverlay:
            overlay = n; break
    assert_not_null(overlay)
    overlay.tutorial_finished.emit()
    var saved: ProfileResource = ctx.save.read("profile")
    assert_true(saved.tutorial_done, "profile.tutorial_done must be true after finish")
```

### Step 8.2 — Run, expect failure

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 3 fails — game.gd doesn't read profile or mount overlay.

### Step 8.3 — Implement the gating in game.gd

- [ ] Edit `games/calendar_puzzle/game.gd`. Replace the entire file with:

```gdscript
# games/calendar_puzzle/game.gd
# Calendar Puzzle 游戏模块入口。M3 起 boot → select_scene → play_scene 流程。
# M5: tutorial gating on first New Game (profile.tutorial_done == false).
extends GameModule

const MANIFEST_PATH = "res://games/calendar_puzzle/manifest.tres"
const SELECT_SCENE = preload("res://games/calendar_puzzle/scenes/select_scene.tscn")
const PLAY_SCENE = preload("res://games/calendar_puzzle/scenes/play_scene.tscn")
const TutorialOverlayScene = preload("res://games/calendar_puzzle/tutorial/tutorial_overlay.tscn")
const TutorialFixture = preload("res://games/calendar_puzzle/tutorial/tutorial_fixture.gd")
const ProfileResource = preload("res://shared/save/profile_resource.gd")

var _deps: GameDeps = null
var _root: Node = null
var _current: Node = null
var _stashed_payload: Dictionary = {}
var _active_tutorial: Node = null

func get_manifest() -> GameManifest:
    return load(MANIFEST_PATH) as GameManifest

func start(deps: GameDeps) -> Node:
    assert(deps.is_complete(), "GameDeps incomplete - boot misconfigured")
    _deps = deps
    _root = Node.new()
    _root.name = "CalendarPuzzleRoot"
    _show_select()
    return _root

func _show_select() -> void:
    var s = SELECT_SCENE.instantiate()
    _swap_to(s)
    s.puzzle_selected.connect(_on_puzzle_selected)
    s.back_pressed.connect(_on_back_to_menu)

func _show_play(payload: Dictionary) -> void:
    var p = PLAY_SCENE.instantiate()
    p.setup(_deps)
    _swap_to(p)
    p.setup_slot_manager(_deps.save)
    p.load_puzzle(payload)
    if p.has_signal("exit_to_select"):
        p.exit_to_select.connect(_show_select)

func _swap_to(new_node: Node) -> void:
    if _current:
        _current.queue_free()
    _current = new_node
    _root.add_child(_current)

func _on_puzzle_selected(payload: Dictionary) -> void:
    var profile := _deps.save.read("profile") as ProfileResource
    if profile != null and not profile.tutorial_done:
        _stashed_payload = payload
        _show_play(TutorialFixture.payload())
        _mount_tutorial()
    else:
        _show_play(payload)

func _mount_tutorial() -> void:
    _active_tutorial = TutorialOverlayScene.instantiate()
    _current.add_child(_active_tutorial)
    _active_tutorial.tutorial_finished.connect(_on_tutorial_done)
    # Bridge play_scene's placed_count_changed and palette pointer events to overlay
    if _current.has_signal("placed_count_changed"):
        _current.placed_count_changed.connect(_active_tutorial.notify_placed_count_changed)
    _deps.input.pointer_pressed.connect(_on_input_pointer_for_tutorial)

func _on_input_pointer_for_tutorial(pos: Vector2) -> void:
    # Step 2 advance: any palette hit on the current play_scene
    if _active_tutorial == null or _current == null:
        return
    var palette = _current.get_node_or_null("VBox/PaletteView")
    if palette and palette.hit_test(pos) != "":
        _active_tutorial.notify_palette_drag()

func _on_tutorial_done() -> void:
    var profile := _deps.save.read("profile") as ProfileResource
    if profile == null:
        profile = ProfileResource.new()
    profile.tutorial_done = true
    _deps.save.write("profile", profile)
    if _active_tutorial:
        _active_tutorial.queue_free()
        _active_tutorial = null
    if _deps.input.pointer_pressed.is_connected(_on_input_pointer_for_tutorial):
        _deps.input.pointer_pressed.disconnect(_on_input_pointer_for_tutorial)
    if not _stashed_payload.is_empty() and _current and _current.has_method("load_puzzle"):
        _current.load_puzzle(_stashed_payload)
        _stashed_payload = {}

func _on_back_to_menu() -> void:
    if _deps and _deps.on_exit.is_valid():
        _deps.on_exit.call()
```

### Step 8.4 — Run tests, expect pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -10
```
Expected: 243 + 3 = **246/246 pass**.

### Step 8.5 — Headless boot smoke

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --quit-after 3 res://boot/boot.tscn 2>&1 | grep -iE "error|warning"
```
Expected: no ERROR/WARNING.

### Step 8.6 — Commit

```bash
cd ~/mygit/calendar-puzzle-godot && git add games/calendar_puzzle/game.gd \
  tests/test_tutorial_only_once.gd && \
  git commit -m "feat(tutorial): M5 Task 9 — game.gd gates tutorial on profile.tutorial_done

_on_puzzle_selected reads profile; if !tutorial_done, stashes user payload
and loads TutorialFixture instead, mounts TutorialOverlay as child of
play_scene, bridges palette pointer + placed_count_changed signals to the
overlay state machine. tutorial_finished → profile.tutorial_done=true,
save.write, restore user puzzle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

### Step 9.1 — Full test pass

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd 2>&1 | tail -20
```
Expected: **246/246 pass**. Capture full output to `docs/m5-evidence/all-tests-final.log` if a docs/m5-evidence directory is wanted (optional).

### Step 9.2 — Headless boot smoke (both flag states)

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --quit-after 3 res://boot/boot.tscn 2>&1 | grep -iE "error|warning"
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --quit-after 3 --enable-advanced-hints res://boot/boot.tscn 2>&1 | grep -iE "error|warning"
```
Expected: no new ERROR/WARNING in either run.

### Step 9.3 — Hand off to user for Mac GUI manual test

- [ ] Rebuild the Mac app:

```bash
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --export-release "macOS" build/mac/CalendarPuzzle.app
```

- [ ] Hand the user the manual checklist from spec §11 "Mac GUI manual checklist":
  1. `rm "$HOME/Library/Application Support/Godot/app_userdata/Calendar Puzzle/saves/profile.tres"` to reset tutorial gate
  2. `open ~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app` → menu → New Game → today + easy + Start
  3. Tutorial overlay step 1 visible; walk all 5 steps
  4. Test Skip from step 2 in a fresh run
  5. After completion → real puzzle → 💡 3/3 → click → cell highlights → 💡 2/3
  6. Use all 3 weak hints → button disabled
  7. Save manual slot → restart → Load → counts and locks preserved
  8. Rotate on weak-locked block → no-op
  9. Relaunch with `open --args --enable-advanced-hints CalendarPuzzle.app` → Medium / Strong dev buttons visible

---

## Self-review

**Spec coverage check:**
- §2 Goal items: ✓ weak HUD button (Task 2), ✓ 3-sec highlight (Task 2), ✓ Medium/Strong UI hidden behind CLI flag (Tasks 2 + 5), ✓ 5-step tutorial w/ Skip (Tasks 6-8), ✓ only-once gate (Task 8), ✓ GameSnapshot round-trip (Task 4)
- §6.2 HintSolver algorithms (weak/medium/strong + escalation + eviction): ✓ Task 1
- §6.3 cap/denial UX: ✓ Task 2 (button disabled when remaining=0)
- §6.4 orientation lock (rotate/mirror gate + pickup snap): ✓ Task 3
- §7 persistence: ✓ Task 4
- §8 CLI flag: ✓ Task 5
- §9 tutorial flow + fixture + 5-step machine + new signal: ✓ Tasks 6-8
- §10 acceptance gates: each gate maps to ≥1 test added in Tasks 1-8
- §11 testing strategy table: all 6 test files created in Tasks 1-8 (test_hint_solver, test_play_scene_hint_integration, test_orientation_lock, test_hint_snapshot_roundtrip, test_tutorial_fixture, test_tutorial_flow, plus test_advanced_hints_flag and test_tutorial_only_once which extend coverage)

**Placeholder scan:** no "TBD" / "implement later" / hand-wave error handling. Every code block is complete.

**Type consistency check:**
- `HintResult.weak_ok_with_block(block, cell)` defined in Step 1.4, consumed in Step 1.3 — matches.
- `HintState._weak_locked`, `_medium_locked`, `_strong_locked` (underscore-prefixed) accessed directly in Tasks 1, 4, 7 — matches existing hint_state.gd field names.
- `placed_count_changed(new_count: int)` signal declared in Task 6 Step 6.4, consumed in Task 8 Step 8.3 — matches.
- `TutorialOverlay.notify_palette_drag()` / `notify_placed_count_changed(int)` / `advance_from_click_next()` / `advance_from_click_done()` / `skip()` defined in Task 7 Step 7.4, called by tests in 7.1 and game.gd in 8.3 — all match.
- `GameDeps.advanced_hints_enabled` field added in Task 2 Step 2.4, set in Task 5 Step 5.3, read in Task 2 Step 2.3 — matches.
- `SaveAdapter.write(key, resource)` / `read(key)` API used in game.gd (Task 8) and tests — matches existing save_adapter.gd.

**Spec gap:** §11 acceptance gate "GUT: test_hint_state.gd (already passing) + test_hint_solver.gd + test_tutorial_flow.gd + 4 new files ≥ 12 added cases". Plan adds 8 test files totaling ~37 cases — comfortably exceeds the lower bound.

**No gaps found.**
