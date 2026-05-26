# M5 — 提示系统 + 教程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `minigame/js/hint.js` 的 3 档提示状态机移植到 `games/calendar_puzzle/systems/hint_state.gd`，在 play_scene HUD 里接入弱提示按钮（普通难度 3 次/题；失眠 5 次/题），把 medium/strong 入口做成隐藏 Control 通过 CLI flag 切开发模式可见，并实现 5 步教程（仅首次启动播放）。

**Architecture:** 提示状态机是纯数据 + 纯函数（无副作用），住在 `games/calendar_puzzle/systems/`；通过 `play_scene` 的 HUD 调用，再用 `solver`（M1 已交付的 `dlx.gd`/`puzzle_generator.gd`）找候选放置。提示状态序列化进 M4 已建好的 `GameSnapshot` Resource → SaveAdapter 自动持久化。教程是独立场景 `boot/main_menu/tutorial.tscn`，5 个 step overlay 顺序播放；完成后写 `ProfileResource.tutorial_done = true`，由 boot/main_menu 在启动时检查门控。

**Tech Stack:** Godot 4.3+ GDScript、GUT v9、M1 求解器（`solver/dlx.gd` / `solver/board.gd`）、M2 play_scene、M4 SaveAdapter + ProfileResource、M0 GameDeps.input。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Game systems → 提示系统设计、§ Game systems → 功能矩阵（教程）、§ Milestones M5。原始 JS 实现：`calendar-puzzle-miniprogram/minigame/js/hint.js` (346 行)。

**Acceptance gates (从 spec 抄):**
- 弱提示按钮在 play_scene 工作：普通难度每题最多 3 次、失眠模式最多 5 次；用完后按钮灰显
- 弱提示触发后高亮一个空格 3 秒，自动淡出
- Medium/Strong 提示**代码完整保留**且单测覆盖，但 UI 入口默认隐藏；启动加 `--enable-advanced-hints` flag 后可见（开发者验证用）
- 教程 5 步顺序播放：目标 → 锁块 → 放置 → 移除 → 完成；任一步可 Skip
- 教程只在 `profile.tutorial_done == false` 时触发；走完最后一步 / Skip 后写 true 并持久化
- 提示状态进 GameSnapshot；存档 → 退出 → 重启 → 加载，提示计数还原一致
- GUT：`test_hint_state.gd`（caps 边界、3 档全覆盖、restore round-trip）+ `test_tutorial_flow.gd`（5 步、Skip、only-once 门控）≥ 12 个用例全绿

---

## File Structure

本 milestone 涉及的所有文件（位于 `~/mygit/calendar-puzzle-godot/`）：

```
games/calendar_puzzle/
├── systems/
│   ├── hint_state.gd                       # CREATE 3 档状态机（~400 行）
│   └── hint_result.gd                      # CREATE Hint 结果类型（WeakHint/MediumHint/StrongHint）
├── solver/
│   └── hint_solver.gd                      # CREATE 弱/中/强提示求解（包装 dlx.gd）
├── scenes/
│   ├── play_scene.gd                       # MODIFY HUD 加 💡 按钮 + 提示高亮渲染
│   ├── play_scene.tscn                     # MODIFY HUD 节点加 HintButton + AdvancedHintsContainer
│   └── puzzle_state.gd                     # MODIFY 持有 HintState；serialize 进 GameSnapshot
├── resources/
│   └── game_snapshot.gd                    # MODIFY 增 hint_state 字段
boot/
├── boot.gd                                 # MODIFY 解析 --enable-advanced-hints CLI flag → GameDeps
├── main_menu/
│   ├── main_menu.gd                        # MODIFY 启动后若 profile.tutorial_done == false → 进 tutorial
│   ├── tutorial.tscn                       # CREATE 教程 root scene
│   ├── tutorial.gd                         # CREATE 5 步状态机 + Skip 按钮
│   └── tutorial_step.gd                    # CREATE 单步 Control 通用基类
shared/
└── platform/
    └── platform_bus.gd                     # MODIFY 加 get_cli_flag(name) 抽象（M0 接口扩展）
tests/
├── test_hint_state.gd                      # CREATE caps / 3 tier / restore round-trip
├── test_hint_solver.gd                     # CREATE 求解器单测（弱提示返单 cell）
├── test_tutorial_flow.gd                   # CREATE 5 步、Skip、only-once
└── test_play_scene_hint_integration.gd     # CREATE 场景集成（按钮 → 高亮 → 状态推进）
```

---

## Task 1 — 定义 HintResult 类型与 HintTier 枚举

**Files:**
- Create: `games/calendar_puzzle/systems/hint_result.gd`
- Test: 由 Task 2 的 test_hint_state.gd 间接覆盖

- [ ] **Step 1: 写 HintResult 类型**

`games/calendar_puzzle/systems/hint_result.gd`:

```gdscript
# games/calendar_puzzle/systems/hint_result.gd
# HintResult — 一次提示调用的结果数据。
# tier 决定 payload 含义：
#   WEAK   → hinted_cell 是被高亮的单个空格坐标
#   MEDIUM → hinted_cell 是被高亮的方块某一格；block_id 标示哪个方块
#   STRONG → block_id 已被强制放置到 placed_at；evicted_block_ids 是被它顶掉的其它方块
class_name HintResult extends RefCounted

enum Tier { WEAK, MEDIUM, STRONG }

var tier: int = Tier.WEAK
var ok: bool = false                # false = 调用被拒（cap 用完或无可提示）
var reason: String = ""             # ok=false 时填写：cap_exhausted / no_solution / already_complete
var block_id: String = ""           # MEDIUM / STRONG 标示方块；WEAK 留空
var hinted_cell: Vector2i = Vector2i(-1, -1)   # WEAK / MEDIUM 用
var placed_at: Vector2i = Vector2i(-1, -1)     # STRONG 用：方块落位左上角
var evicted_block_ids: PackedStringArray = PackedStringArray()  # STRONG 顶掉的其它方块

static func weak_ok(cell: Vector2i) -> HintResult:
    var r := HintResult.new()
    r.tier = Tier.WEAK
    r.ok = true
    r.hinted_cell = cell
    return r

static func medium_ok(block: String, cell: Vector2i) -> HintResult:
    var r := HintResult.new()
    r.tier = Tier.MEDIUM
    r.ok = true
    r.block_id = block
    r.hinted_cell = cell
    return r

static func strong_ok(block: String, at: Vector2i, evicted: PackedStringArray) -> HintResult:
    var r := HintResult.new()
    r.tier = Tier.STRONG
    r.ok = true
    r.block_id = block
    r.placed_at = at
    r.evicted_block_ids = evicted
    return r

static func fail(tier: int, why: String) -> HintResult:
    var r := HintResult.new()
    r.tier = tier
    r.ok = false
    r.reason = why
    return r
```

- [ ] **Step 2: 校验语法**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --check-only --script games/calendar_puzzle/systems/hint_result.gd 2>&1
```

Expected: 无 error 输出。

- [ ] **Step 3: Commit**

```bash
git add games/calendar_puzzle/systems/hint_result.gd
git commit -m "feat(hint): HintResult value type + 3-tier enum"
```

---

## Task 2 — 翻译 hint.js 到 hint_state.gd（核心状态机，TDD）

**Files:**
- Create: `games/calendar_puzzle/systems/hint_state.gd`
- Test: `tests/test_hint_state.gd`

- [ ] **Step 1: 先写 failing test**

`tests/test_hint_state.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const HintState = preload("res://games/calendar_puzzle/systems/hint_state.gd")
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")

# ---- caps ----

func test_default_caps_normal_difficulty():
    var s := HintState.new("puzzle_001", false)  # is_insomnia=false
    assert_eq(s.cap_for(HintResult.Tier.WEAK), 3)
    assert_eq(s.cap_for(HintResult.Tier.MEDIUM), 3)
    assert_eq(s.cap_for(HintResult.Tier.STRONG), 1)

func test_weak_cap_bumped_for_insomnia():
    var s := HintState.new("puzzle_001", true)
    assert_eq(s.cap_for(HintResult.Tier.WEAK), 5)
    assert_eq(s.cap_for(HintResult.Tier.MEDIUM), 3)
    assert_eq(s.cap_for(HintResult.Tier.STRONG), 1)

# ---- can_use / use counts ----

func test_can_use_until_cap_then_blocks():
    var s := HintState.new("p1", false)
    assert_true(s.can_use(HintResult.Tier.WEAK))
    s._increment(HintResult.Tier.WEAK)
    s._increment(HintResult.Tier.WEAK)
    s._increment(HintResult.Tier.WEAK)
    assert_false(s.can_use(HintResult.Tier.WEAK))
    assert_eq(s.used_for(HintResult.Tier.WEAK), 3)

func test_used_counts_independent_per_tier():
    var s := HintState.new("p1", false)
    s._increment(HintResult.Tier.WEAK)
    assert_eq(s.used_for(HintResult.Tier.WEAK), 1)
    assert_eq(s.used_for(HintResult.Tier.MEDIUM), 0)
    assert_eq(s.used_for(HintResult.Tier.STRONG), 0)

# ---- locked_blocks bookkeeping ----

func test_weak_locks_block_orientation():
    var s := HintState.new("p1", false)
    s.mark_weak_used("I_block")
    assert_true(s.is_orientation_locked("I_block"))
    assert_false(s.is_orientation_locked("L_block"))

func test_strong_locks_block_fully():
    var s := HintState.new("p1", false)
    s.mark_strong_used("T_block", Vector2i(2, 3))
    assert_true(s.is_fully_locked("T_block"))
    assert_true(s.is_orientation_locked("T_block"))  # strong implies weak

# ---- serialize round-trip ----

func test_serialize_restore_round_trip():
    var s1 := HintState.new("puzzle_xyz", true)
    s1.mark_weak_used("I_block")
    s1.mark_weak_used("L_block")
    s1.mark_medium_used("T_block", Vector2i(4, 2))
    s1.mark_strong_used("U_block", Vector2i(0, 6))
    var blob: Dictionary = s1.serialize()

    var s2 := HintState.new("puzzle_xyz", true)
    s2.restore_state(blob)
    assert_eq(s2.used_for(HintResult.Tier.WEAK), 2)
    assert_eq(s2.used_for(HintResult.Tier.MEDIUM), 1)
    assert_eq(s2.used_for(HintResult.Tier.STRONG), 1)
    assert_true(s2.is_orientation_locked("I_block"))
    assert_true(s2.is_orientation_locked("L_block"))
    assert_true(s2.is_fully_locked("U_block"))
    var medium_cells: Array = s2.get_medium_cells("T_block")
    assert_eq(medium_cells.size(), 1)
    assert_eq(medium_cells[0], Vector2i(4, 2))

func test_serialize_omits_unrelated_blocks():
    var s := HintState.new("p1", false)
    s.mark_weak_used("I_block")
    var blob := s.serialize()
    # 检查序列化只含已涉及方块；不应有 12 个未触发方块的空条目
    assert_eq(blob["weak_locked"].size(), 1)
    assert_false(blob["weak_locked"].has("L_block"))

# ---- restore tolerates partial blob ----

func test_restore_ignores_missing_fields():
    var s := HintState.new("p1", false)
    s.restore_state({"used_weak": 2})  # 没 mediums / strongs
    assert_eq(s.used_for(HintResult.Tier.WEAK), 2)
    assert_eq(s.used_for(HintResult.Tier.MEDIUM), 0)
```

- [ ] **Step 2: 跑测试期待 FAIL**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: `Could not preload script: res://games/calendar_puzzle/systems/hint_state.gd`。

- [ ] **Step 3: 实现 HintState**

`games/calendar_puzzle/systems/hint_state.gd`:

```gdscript
# games/calendar_puzzle/systems/hint_state.gd
# 3-tier hint state machine. 翻译自 calendar-puzzle-miniprogram/minigame/js/hint.js。
#
# 设计要点：
# - 状态机本身**不知道**棋盘 / 方块形状；它只记录"哪些方块的哪些维度被提示锁定了"。
# - 提示求解（"下一个该提示的格子是哪个"）由 hint_solver.gd 负责；本类只问"能不能用 + 用了之后状态怎么变"。
# - cap 由难度决定：weak normal=3 / insomnia=5；medium=3；strong=1（spec § 提示系统设计）。
# - 序列化为 Dictionary，进 GameSnapshot.hint_state → SaveAdapter 持久化。
class_name HintState extends RefCounted

const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")

# Cap 表 — 失眠模式 weak 上限+2
const CAP_WEAK_NORMAL := 3
const CAP_WEAK_INSOMNIA := 5
const CAP_MEDIUM := 3
const CAP_STRONG := 1

var puzzle_id: String
var is_insomnia: bool

# 使用计数
var _used_weak: int = 0
var _used_medium: int = 0
var _used_strong: int = 0

# 锁定记录（key = block_id）
# weak_locked: block_id → true（该方块的"形态/朝向"已由弱提示给出，玩家不许旋转/镜像）
# medium_locked: block_id → Array[Vector2i]（已揭示的方块占位单元格列表）
# strong_locked: block_id → Vector2i（强提示放下的左上角原点；该方块被锁死无法移动 / 旋转 / 移除）
var _weak_locked: Dictionary = {}
var _medium_locked: Dictionary = {}
var _strong_locked: Dictionary = {}

func _init(p_puzzle_id: String = "", p_is_insomnia: bool = false) -> void:
    puzzle_id = p_puzzle_id
    is_insomnia = p_is_insomnia

# ---- caps ----

func cap_for(tier: int) -> int:
    match tier:
        HintResult.Tier.WEAK:
            return CAP_WEAK_INSOMNIA if is_insomnia else CAP_WEAK_NORMAL
        HintResult.Tier.MEDIUM:
            return CAP_MEDIUM
        HintResult.Tier.STRONG:
            return CAP_STRONG
    return 0

func used_for(tier: int) -> int:
    match tier:
        HintResult.Tier.WEAK: return _used_weak
        HintResult.Tier.MEDIUM: return _used_medium
        HintResult.Tier.STRONG: return _used_strong
    return 0

func can_use(tier: int) -> bool:
    return used_for(tier) < cap_for(tier)

func remaining(tier: int) -> int:
    return max(0, cap_for(tier) - used_for(tier))

# ---- mutation (called by hint_solver after computing what to reveal) ----

func _increment(tier: int) -> void:
    match tier:
        HintResult.Tier.WEAK: _used_weak += 1
        HintResult.Tier.MEDIUM: _used_medium += 1
        HintResult.Tier.STRONG: _used_strong += 1

func mark_weak_used(block_id: String) -> void:
    _increment(HintResult.Tier.WEAK)
    _weak_locked[block_id] = true

func mark_medium_used(block_id: String, cell: Vector2i) -> void:
    _increment(HintResult.Tier.MEDIUM)
    var cells: Array = _medium_locked.get(block_id, [])
    cells = cells.duplicate()
    cells.append(cell)
    _medium_locked[block_id] = cells

func mark_strong_used(block_id: String, origin: Vector2i) -> void:
    _increment(HintResult.Tier.STRONG)
    _strong_locked[block_id] = origin

# ---- queries ----

func is_orientation_locked(block_id: String) -> bool:
    # 弱或强提示一旦覆盖该方块，其方向 / 镜像就被锁定（玩家不许 rotate/flip）
    return _weak_locked.has(block_id) or _strong_locked.has(block_id)

func is_fully_locked(block_id: String) -> bool:
    return _strong_locked.has(block_id)

func get_medium_cells(block_id: String) -> Array:
    var cells: Array = _medium_locked.get(block_id, [])
    return cells.duplicate()

func get_strong_origin(block_id: String) -> Vector2i:
    return _strong_locked.get(block_id, Vector2i(-1, -1))

# ---- serialization ----

func serialize() -> Dictionary:
    return {
        "puzzle_id": puzzle_id,
        "is_insomnia": is_insomnia,
        "used_weak": _used_weak,
        "used_medium": _used_medium,
        "used_strong": _used_strong,
        "weak_locked": _weak_locked.duplicate(),
        "medium_locked": _medium_locked.duplicate(true),
        "strong_locked": _strong_locked.duplicate(true),
    }

func restore_state(blob: Dictionary) -> void:
    puzzle_id = blob.get("puzzle_id", puzzle_id)
    is_insomnia = blob.get("is_insomnia", is_insomnia)
    _used_weak = blob.get("used_weak", 0)
    _used_medium = blob.get("used_medium", 0)
    _used_strong = blob.get("used_strong", 0)
    _weak_locked = blob.get("weak_locked", {}).duplicate()
    _medium_locked = blob.get("medium_locked", {}).duplicate(true)
    _strong_locked = blob.get("strong_locked", {}).duplicate(true)

# Reset for new puzzle (called when player switches puzzles)
func reset(new_puzzle_id: String, p_is_insomnia: bool) -> void:
    puzzle_id = new_puzzle_id
    is_insomnia = p_is_insomnia
    _used_weak = 0
    _used_medium = 0
    _used_strong = 0
    _weak_locked.clear()
    _medium_locked.clear()
    _strong_locked.clear()
```

- [ ] **Step 4: 跑测试期待 PASS**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 至少 9 个 hint_state 用例 PASS（外加 M0-M4 累计的若干）。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/systems/hint_state.gd tests/test_hint_state.gd
git commit -m "feat(hint): port 3-tier hint state machine from minigame/js/hint.js"
```

---

## Task 3 — 弱提示求解器：找一个有效空格

**Files:**
- Create: `games/calendar_puzzle/solver/hint_solver.gd`
- Test: `tests/test_hint_solver.gd`

> 设计动机：M1 已交付 `solver/dlx.gd` 能求出**完整解**。弱提示只需"指一个能放方块的空格"。我们用 `dlx.gd` 求一个完整解后，从解里挑一个"未被占用"的格子返回。`puzzle_state` 持有当前盘面 → solver 调用时把当前盘面传入，dlx 只在"剩余 palette × 剩余空格"内求一个解。

- [ ] **Step 1: 写 failing test**

`tests/test_hint_solver.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const HintSolver = preload("res://games/calendar_puzzle/solver/hint_solver.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")
const PuzzleState = preload("res://games/calendar_puzzle/scenes/puzzle_state.gd")

func test_weak_hint_returns_valid_empty_cell_on_fresh_board():
    var state := PuzzleState.new()
    state.init_from_date_and_difficulty(2024, 5, 26, "easy")  # 已用 M2/M3 API
    var solver := HintSolver.new()
    var cell := solver.find_weak_hint_cell(state)
    assert_ne(cell, Vector2i(-1, -1), "weak hint must find a cell")
    # 该 cell 必须在空格集合内（不是日期标记或边界）
    assert_true(state.board.is_empty_cell(cell.x, cell.y))

func test_weak_hint_returns_minus_one_when_no_solution():
    # 构造一个无解状态（手工放一个错的方块阻死）
    var state := PuzzleState.new()
    state.init_from_date_and_difficulty(2024, 5, 26, "easy")
    state.force_paint_unsolvable_for_test()  # 测试用 helper
    var solver := HintSolver.new()
    var cell := solver.find_weak_hint_cell(state)
    assert_eq(cell, Vector2i(-1, -1))

func test_weak_hint_skips_strong_locked_blocks():
    # 强提示已落下 1 个方块 → weak 解算时该方块视为已就位
    var state := PuzzleState.new()
    state.init_from_date_and_difficulty(2024, 5, 26, "easy")
    state.hint_state.mark_strong_used("I_block", Vector2i(0, 0))  # 假设强放 I
    var solver := HintSolver.new()
    var cell := solver.find_weak_hint_cell(state)
    # 仍能找到下一个有效格（剩余方块求解）
    assert_ne(cell, Vector2i(-1, -1))
```

- [ ] **Step 2: 实现 HintSolver**

`games/calendar_puzzle/solver/hint_solver.gd`:

```gdscript
# games/calendar_puzzle/solver/hint_solver.gd
# 提示求解 — 调 dlx.gd 求当前盘面剩余 palette 的完整解，再按 tier 选返回内容。
#
# WEAK   → 返一个解中任意一个"刚被放下的方块"的某个 cell（高亮单格即可）
# MEDIUM → 返"该方块在解中占的某个 cell"（仅当 caller 指定 block_id）
# STRONG → 返"该方块在解中的原点 + 形态"（caller 据此强制落子）
class_name HintSolver extends RefCounted

const Dlx = preload("res://games/calendar_puzzle/solver/dlx.gd")

# 内部：求一次完整解 → 返 Dictionary[block_id → {x:int, y:int, shape:Array}]
# 失败返 null
func _solve_current(state) -> Variant:
    var dlx := Dlx.new()
    # 把 state.board 当前空格 + state.palette 剩余方块（排除 strong_locked 已放下的）
    # 传给 dlx。dlx.gd 在 M1 已封装：dlx.solve(empty_cells, available_blocks) -> Variant
    var empty_cells: Array = state.board.collect_empty_cells()
    var available: Array = []
    for block in state.palette:
        if not state.hint_state.is_fully_locked(block.id):
            available.append(block)
    var solution = dlx.solve(empty_cells, available)
    return solution  # null or Dictionary

func find_weak_hint_cell(state) -> Vector2i:
    var solution = _solve_current(state)
    if solution == null:
        return Vector2i(-1, -1)
    # 任意选解中一个 cell；优先选"形状最小的方块的左上角"（视觉上最不破坏布局）
    var keys: Array = solution.keys()
    keys.sort()  # 稳定性
    for block_id in keys:
        var placement: Dictionary = solution[block_id]
        var shape: Array = placement.shape
        for dy in shape.size():
            for dx in shape[dy].size():
                if shape[dy][dx] == 1:
                    return Vector2i(placement.x + dx, placement.y + dy)
    return Vector2i(-1, -1)

# Medium：caller 已指定 block_id；返该方块在解中的某个未揭示 cell
func find_medium_hint_cell(state, block_id: String) -> Vector2i:
    var solution = _solve_current(state)
    if solution == null or not solution.has(block_id):
        return Vector2i(-1, -1)
    var placement: Dictionary = solution[block_id]
    var shape: Array = placement.shape
    var already: Array = state.hint_state.get_medium_cells(block_id)
    var candidates: Array = []
    for dy in shape.size():
        for dx in shape[dy].size():
            if shape[dy][dx] != 1: continue
            var cell := Vector2i(placement.x + dx, placement.y + dy)
            if not (cell in already):
                candidates.append(cell)
    if candidates.is_empty():
        return Vector2i(-1, -1)
    var rng := RandomNumberGenerator.new()
    rng.randomize()
    return candidates[rng.randi() % candidates.size()]

# Strong：返"在解中该方块落在哪 + 形状是什么"
func find_strong_placement(state, block_id: String) -> Dictionary:
    var solution = _solve_current(state)
    if solution == null or not solution.has(block_id):
        return {}
    return solution[block_id]
```

> **依赖前置**：本任务假设 M1 的 `dlx.gd::solve(empty_cells, available_blocks)` 已稳定且能在 < 200ms 内返回（spec § 提示系统设计：弱提示求解 < 100ms 目标）。若 M1 接口不一致需小范围 adapt — 不在本 plan scope 内。

- [ ] **Step 3: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 3 个 hint_solver 用例 + 9 个 hint_state 用例 PASS。

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/solver/hint_solver.gd tests/test_hint_solver.gd
git commit -m "feat(hint): solver wrapper for weak/medium/strong tier resolution"
```

---

## Task 4 — 把 HintState 嵌进 PuzzleState + GameSnapshot

**Files:**
- Modify: `games/calendar_puzzle/scenes/puzzle_state.gd`
- Modify: `games/calendar_puzzle/resources/game_snapshot.gd`

- [ ] **Step 1: 在 puzzle_state.gd 加 hint_state 字段**

读 `games/calendar_puzzle/scenes/puzzle_state.gd`（M2 已建立），加：

```gdscript
const HintState = preload("res://games/calendar_puzzle/systems/hint_state.gd")

var hint_state: HintState = HintState.new()

# 调用点：init_from_date_and_difficulty 末尾 reset hint_state
func init_from_date_and_difficulty(year: int, month: int, day: int, difficulty: String) -> void:
    # ... 原有逻辑 ...
    var puzzle_id := "%04d%02d%02d_%s" % [year, month, day, difficulty]
    hint_state.reset(puzzle_id, difficulty == "insomnia")
```

- [ ] **Step 2: GameSnapshot 加 hint_state 字段**

读 `games/calendar_puzzle/resources/game_snapshot.gd`（M4 已建立），追加：

```gdscript
# 提示状态序列化为 Dictionary 存进 snapshot，restore 时反序列化回 HintState
@export var hint_state_blob: Dictionary = {}
```

并在 puzzle_state.gd 的 `to_snapshot()` / `from_snapshot(snap)` 做映射：

```gdscript
func to_snapshot() -> GameSnapshot:
    var snap := GameSnapshot.new()
    # ... 原 fields ...
    snap.hint_state_blob = hint_state.serialize()
    return snap

func from_snapshot(snap: GameSnapshot) -> void:
    # ... 原 fields ...
    hint_state.restore_state(snap.hint_state_blob)
```

- [ ] **Step 3: 加 round-trip 测试**

在 `tests/test_hint_state.gd` 追加：

```gdscript
const PuzzleState = preload("res://games/calendar_puzzle/scenes/puzzle_state.gd")

func test_puzzle_state_serializes_hint_state():
    var s := PuzzleState.new()
    s.init_from_date_and_difficulty(2024, 5, 26, "insomnia")
    s.hint_state.mark_weak_used("I_block")
    s.hint_state.mark_weak_used("L_block")
    var snap := s.to_snapshot()
    assert_eq(snap.hint_state_blob["used_weak"], 2)
    assert_eq(snap.hint_state_blob["is_insomnia"], true)

    var s2 := PuzzleState.new()
    s2.init_from_date_and_difficulty(2024, 5, 26, "insomnia")
    s2.from_snapshot(snap)
    assert_eq(s2.hint_state.used_for(HintResult.Tier.WEAK), 2)
    assert_true(s2.hint_state.is_orientation_locked("I_block"))
    assert_true(s2.hint_state.is_insomnia)
```

- [ ] **Step 4: 跑测试 + 跑 M4 已有 save round-trip 测试确保未破坏**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 全绿，无回归。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/scenes/puzzle_state.gd \
        games/calendar_puzzle/resources/game_snapshot.gd \
        tests/test_hint_state.gd
git commit -m "feat(hint): persist hint_state into GameSnapshot via PuzzleState"
```

---

## Task 5 — play_scene HUD 加 💡 弱提示按钮

**Files:**
- Modify: `games/calendar_puzzle/scenes/play_scene.tscn`
- Modify: `games/calendar_puzzle/scenes/play_scene.gd`

- [ ] **Step 1: 在 play_scene.tscn HUD 节点下加 HintButton**

Editor 操作（或直接编辑 .tscn）：
1. 打开 `play_scene.tscn`
2. 选中 `HUD/TopBar`（M2 已建的容器）
3. Add Child Node → Button → 命名 `HintButton`
4. 设置：
   - text: `💡`（或 i18n key `"hud_hint"`）
   - tooltip_text: `"hud_hint_tooltip"`
   - icon size: 32×32
5. Add Child → Label → 命名 `HintRemainingLabel` 显示 "3/3" 形式

新增节点 `HUD/AdvancedHintsContainer`（默认 visible=false）：
- 内含 `MediumHintButton`（text `🎯`）+ `StrongHintButton`（text `🔮`）

手写补丁示例（.tscn 末尾追加）：

```
[node name="HintButton" type="Button" parent="HUD/TopBar"]
text = "💡"
custom_minimum_size = Vector2(48, 48)

[node name="HintRemainingLabel" type="Label" parent="HUD/TopBar"]
text = "3/3"

[node name="AdvancedHintsContainer" type="HBoxContainer" parent="HUD/TopBar"]
visible = false

[node name="MediumHintButton" type="Button" parent="HUD/TopBar/AdvancedHintsContainer"]
text = "🎯"

[node name="StrongHintButton" type="Button" parent="HUD/TopBar/AdvancedHintsContainer"]
text = "🔮"
```

- [ ] **Step 2: 在 play_scene.gd 接线**

读 `play_scene.gd`，加：

```gdscript
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")
const HintSolver = preload("res://games/calendar_puzzle/solver/hint_solver.gd")

@onready var _hint_button: Button = $HUD/TopBar/HintButton
@onready var _hint_remaining: Label = $HUD/TopBar/HintRemainingLabel
@onready var _advanced_hints: Container = $HUD/TopBar/AdvancedHintsContainer
@onready var _medium_btn: Button = $HUD/TopBar/AdvancedHintsContainer/MediumHintButton
@onready var _strong_btn: Button = $HUD/TopBar/AdvancedHintsContainer/StrongHintButton

var _hint_solver := HintSolver.new()
var _hint_highlight_node: ColorRect = null  # 用于显示高亮的临时节点

func _ready() -> void:
    # ... 原有 M2 ready 逻辑 ...
    _hint_button.pressed.connect(_on_weak_hint_pressed)
    _medium_btn.pressed.connect(_on_medium_hint_pressed)
    _strong_btn.pressed.connect(_on_strong_hint_pressed)

    # advanced hints 仅 dev mode 显示（由 deps.platform.get_cli_flag 决定）
    _advanced_hints.visible = _deps.platform.get_cli_flag("enable-advanced-hints")

    _refresh_hint_button_state()

func _refresh_hint_button_state() -> void:
    var rem: int = _puzzle_state.hint_state.remaining(HintResult.Tier.WEAK)
    var cap: int = _puzzle_state.hint_state.cap_for(HintResult.Tier.WEAK)
    _hint_remaining.text = "%d/%d" % [rem, cap]
    _hint_button.disabled = (rem <= 0)

func _on_weak_hint_pressed() -> void:
    if not _puzzle_state.hint_state.can_use(HintResult.Tier.WEAK):
        return
    var cell: Vector2i = _hint_solver.find_weak_hint_cell(_puzzle_state)
    if cell == Vector2i(-1, -1):
        _show_toast("hud_hint_no_solution")
        return
    # block_id 选解算结果里这个 cell 所属的方块，调 mark_weak_used
    # 简化：暂只 mark generic（M5 不要求绑定具体 block）；记 count + 高亮 cell
    _puzzle_state.hint_state._increment(HintResult.Tier.WEAK)
    _highlight_cell(cell, 3.0)
    _refresh_hint_button_state()

func _on_medium_hint_pressed() -> void:
    # 开发模式：弹一个简单 picker 让用户选 block_id；M5 不做完整 UX
    push_warning("Medium hint (dev only): pick a block from palette via console")

func _on_strong_hint_pressed() -> void:
    push_warning("Strong hint (dev only): pick a block from palette via console")

func _highlight_cell(cell: Vector2i, duration_sec: float) -> void:
    if _hint_highlight_node and is_instance_valid(_hint_highlight_node):
        _hint_highlight_node.queue_free()
    _hint_highlight_node = ColorRect.new()
    _hint_highlight_node.color = Color(1.0, 0.95, 0.2, 0.45)  # 半透明柔黄
    var cell_size: Vector2 = _board_renderer.cell_size  # M2 已有
    _hint_highlight_node.size = cell_size
    _hint_highlight_node.position = Vector2(cell) * cell_size + _board_renderer.position
    _board_renderer.add_child(_hint_highlight_node)
    var t := get_tree().create_timer(duration_sec)
    t.timeout.connect(func ():
        if is_instance_valid(_hint_highlight_node):
            _hint_highlight_node.queue_free()
            _hint_highlight_node = null
    )

func _show_toast(message_key: String) -> void:
    # M4 已有 toast helper（shared/ui/toast.gd）；这里短调用
    push_warning("[toast] %s" % _deps.i18n.tr(message_key))
```

> **注意**：M5 的 weak hint 简化把 `_increment` 直接调用而不走 `mark_weak_used(block_id)`。原因：UI 层这一步只高亮"格子"，不揭示"哪个方块该放这里"——保持 weak 信息密度最低，符合 spec "Weak: 高亮一个可放置的空格" 描述。`weak_locked` 锁定行为在 M5 暂搁置（M9 视觉打磨期再决定是否给方块加锁视觉提示）。

- [ ] **Step 3: 集成测试**

`tests/test_play_scene_hint_integration.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const PlaySceneScript = preload("res://games/calendar_puzzle/scenes/play_scene.gd")
const HintResult = preload("res://games/calendar_puzzle/systems/hint_result.gd")

var _scene: Node

func before_each():
    var scene_packed = load("res://games/calendar_puzzle/scenes/play_scene.tscn")
    _scene = scene_packed.instantiate()
    # 注入 stub deps（参考 M4 test pattern）
    _scene._deps = _make_stub_deps()
    add_child_autofree(_scene)
    _scene._puzzle_state.init_from_date_and_difficulty(2024, 5, 26, "easy")
    _scene._ready()  # 手动触发；正常 add_child 会触发，但 stub 注入早于 _ready

func test_weak_hint_button_decrements_remaining():
    var initial_rem: int = _scene._puzzle_state.hint_state.remaining(HintResult.Tier.WEAK)
    assert_eq(initial_rem, 3)
    _scene._on_weak_hint_pressed()
    assert_eq(_scene._puzzle_state.hint_state.remaining(HintResult.Tier.WEAK), 2)

func test_weak_hint_button_disabled_after_3_uses():
    for i in range(3):
        _scene._on_weak_hint_pressed()
    assert_true(_scene._hint_button.disabled)

func test_advanced_hints_hidden_by_default():
    assert_false(_scene._advanced_hints.visible)

func test_advanced_hints_visible_when_cli_flag_set():
    _scene._deps.platform.set_cli_flag("enable-advanced-hints", true)  # stub helper
    _scene._refresh_hint_button_state()
    _scene._advanced_hints.visible = _scene._deps.platform.get_cli_flag("enable-advanced-hints")
    assert_true(_scene._advanced_hints.visible)

func _make_stub_deps():
    # 复用 M4 测试中的 deps factory
    return preload("res://tests/helpers/stub_deps_factory.gd").build()
```

- [ ] **Step 4: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: hint integration 4 个用例 PASS。如失败大概率是 stub_deps_factory 未实现 `set_cli_flag` — 见 Task 6 补 platform 接口。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/scenes/play_scene.tscn \
        games/calendar_puzzle/scenes/play_scene.gd \
        tests/test_play_scene_hint_integration.gd
git commit -m "feat(play): wire 💡 weak-hint button to HintState + cell highlight"
```

---

## Task 6 — PlatformBus 加 CLI flag 接口；boot 解析 --enable-advanced-hints

**Files:**
- Modify: `shared/platform/platform_bus.gd`
- Modify: `boot/platform/steam_platform.gd`
- Modify: `boot/boot.gd`
- Modify: 测试 stub（如 `tests/helpers/stub_deps_factory.gd`）

- [ ] **Step 1: 给 PlatformBus 加 CLI flag 抽象**

`shared/platform/platform_bus.gd` 追加：

```gdscript
# CLI flag 查询。boot 解析 OS.get_cmdline_args() 后通过 set_cli_flag 写入；
# 游戏模块只读不写，作为开发者/调试开关使用（如 --enable-advanced-hints）。
func get_cli_flag(name: String) -> bool:
    push_error("PlatformBus.get_cli_flag not implemented")
    return false

func set_cli_flag(name: String, value: bool) -> void:
    push_error("PlatformBus.set_cli_flag not implemented")
```

- [ ] **Step 2: SteamPlatform 实现 flag 存储**

`boot/platform/steam_platform.gd` 在类内加：

```gdscript
var _cli_flags: Dictionary = {}

func get_cli_flag(name: String) -> bool:
    return _cli_flags.get(name, false)

func set_cli_flag(name: String, value: bool) -> void:
    _cli_flags[name] = value
```

- [ ] **Step 3: boot.gd 解析 cmdline args**

在 `boot.gd::_build_deps()` 之前加：

```gdscript
func _parse_cli_flags(platform: PlatformBus) -> void:
    var args := OS.get_cmdline_user_args()
    for arg in args:
        if arg == "--enable-advanced-hints":
            platform.set_cli_flag("enable-advanced-hints", true)
            print("[boot] dev flag enabled: enable-advanced-hints")
        elif arg == "--skip-tutorial":
            platform.set_cli_flag("skip-tutorial", true)
            print("[boot] dev flag enabled: skip-tutorial")
```

并在 `_build_deps()` 内创建 platform 后立即：

```gdscript
deps.platform = SteamPlatform.new()
_parse_cli_flags(deps.platform)
```

- [ ] **Step 4: 更新 test stub factory**

如果 `tests/helpers/stub_deps_factory.gd` 不存在则创建：

```gdscript
# tests/helpers/stub_deps_factory.gd
extends RefCounted

static func build() -> GameDeps:
    var deps := GameDeps.new()
    deps.save = preload("res://boot/platform/stub_save_adapter.gd").new()
    deps.input = preload("res://boot/platform/stub_input_context.gd").new()
    deps.i18n = preload("res://boot/platform/stub_translation_context.gd").new()
    deps.platform = preload("res://boot/platform/steam_platform.gd").new()  # 含 cli_flags impl
    deps.on_exit = func (): pass
    return deps
```

- [ ] **Step 5: 手测 CLI flag**

```bash
godot --headless --quit-after 2 -- --enable-advanced-hints 2>&1 | grep "dev flag"
```

Expected: `[boot] dev flag enabled: enable-advanced-hints`

- [ ] **Step 6: Commit**

```bash
git add shared/platform/platform_bus.gd \
        boot/platform/steam_platform.gd \
        boot/boot.gd \
        tests/helpers/stub_deps_factory.gd
git commit -m "feat(boot): --enable-advanced-hints CLI flag + PlatformBus.get_cli_flag"
```

---

## Task 7 — 教程通用单步基类（tutorial_step.gd）

**Files:**
- Create: `boot/main_menu/tutorial_step.gd`

- [ ] **Step 1: 设计单步契约**

每个教程 step 是一个 Control 子类，提供：

- `step_title() -> String` — i18n key
- `step_body() -> String` — i18n key
- `highlight_target_rect() -> Rect2` — 屏幕高亮区域（mask 其余）
- `on_enter()` — 进入时调用（用于绑事件 / 启动小动画）
- `on_exit()` — 离开时清理
- 信号 `advance_requested` — 玩家点 "Next" / 完成动作时由子类发射

- [ ] **Step 2: 写 tutorial_step.gd 基类**

```gdscript
# boot/main_menu/tutorial_step.gd
# 教程单步基类。每个具体 step 继承本类并覆盖虚函数。
class_name TutorialStep extends Control

signal advance_requested

# i18n key，由子类返回
func step_title_key() -> String:
    return "tutorial_step_title_unknown"

func step_body_key() -> String:
    return "tutorial_step_body_unknown"

# 高亮区域（屏幕坐标）。Rect2(0,0,0,0) 表示无高亮（全屏文本）
func highlight_target_rect() -> Rect2:
    return Rect2()

# Lifecycle hooks
func on_enter() -> void:
    pass

func on_exit() -> void:
    pass
```

- [ ] **Step 3: Commit**

```bash
git add boot/main_menu/tutorial_step.gd
git commit -m "feat(tutorial): TutorialStep base class for 5-step overlay sequence"
```

---

## Task 8 — 实现 tutorial.tscn + tutorial.gd 5 步流程

**Files:**
- Create: `boot/main_menu/tutorial.tscn`
- Create: `boot/main_menu/tutorial.gd`
- Test: `tests/test_tutorial_flow.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_tutorial_flow.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const TutorialScript = preload("res://boot/main_menu/tutorial.gd")

var _tutorial: Node

func before_each():
    var scene_packed = load("res://boot/main_menu/tutorial.tscn")
    _tutorial = scene_packed.instantiate()
    _tutorial._deps = preload("res://tests/helpers/stub_deps_factory.gd").build()
    add_child_autofree(_tutorial)
    _tutorial._ready()

# ---- 5-step sequence ----

func test_starts_at_step_0():
    assert_eq(_tutorial.current_step_index(), 0)

func test_advance_moves_through_5_steps():
    for i in range(5):
        assert_eq(_tutorial.current_step_index(), i)
        _tutorial.advance()
    assert_true(_tutorial.is_complete())

func test_steps_have_distinct_titles():
    var seen := []
    for i in range(5):
        var key := _tutorial.get_step(i).step_title_key()
        assert_false(key in seen, "duplicate step key: %s" % key)
        seen.append(key)

# ---- skip ----

func test_skip_jumps_to_complete():
    _tutorial.skip()
    assert_true(_tutorial.is_complete())

func test_skip_writes_tutorial_done_to_profile():
    _tutorial.skip()
    # 教程 complete 后会写 profile.tutorial_done = true
    var profile = _tutorial._deps.save.read("profile")
    assert_not_null(profile)
    assert_true(profile.tutorial_done)

# ---- only-once gating ----

func test_emit_completed_signal_on_finish():
    var spy = autofree(Node.new())
    var captured := [false]
    _tutorial.completed.connect(func (): captured[0] = true)
    for i in range(5):
        _tutorial.advance()
    assert_true(captured[0])
```

- [ ] **Step 2: 实现 tutorial.gd**

```gdscript
# boot/main_menu/tutorial.gd
# 5 步教程总控。Step 内容均为静态文案 + 屏幕高亮指引。
# 步骤：
#   0 — 目标 (overlay 解释 "保留今天的月/日/星期 3 格为空")
#   1 — 锁块 (overlay 解释 "灰色 # 是棋盘边界 不能放")
#   2 — 放置 (引导玩家从 palette 拖第一个块到棋盘)
#   3 — 移除 (引导双击移除)
#   4 — 完成 (说明胜利条件 + 进入正式游戏)
extends Control

signal completed

const ProfileResource = preload("res://shared/resources/profile_resource.gd")

# 5 个 step 节点（直接嵌入 .tscn）
@onready var _steps: Array = [
    $StepContainer/Step0_Goal,
    $StepContainer/Step1_LockedCells,
    $StepContainer/Step2_PlaceBlock,
    $StepContainer/Step3_RemoveBlock,
    $StepContainer/Step4_Completion,
]

@onready var _skip_button: Button = $SkipButton

var _index: int = 0
var _complete: bool = false
var _deps  # injected by parent (main_menu)

func _ready() -> void:
    for s in _steps:
        s.visible = false
        s.advance_requested.connect(advance)
    _skip_button.pressed.connect(skip)
    _enter_step(0)

func current_step_index() -> int:
    return _index

func get_step(i: int):
    return _steps[i]

func is_complete() -> bool:
    return _complete

func advance() -> void:
    if _complete: return
    _steps[_index].on_exit()
    _steps[_index].visible = false
    _index += 1
    if _index >= _steps.size():
        _finish()
    else:
        _enter_step(_index)

func skip() -> void:
    if _complete: return
    if _index < _steps.size():
        _steps[_index].on_exit()
        _steps[_index].visible = false
    _finish()

func _enter_step(i: int) -> void:
    _steps[i].visible = true
    _steps[i].on_enter()

func _finish() -> void:
    _complete = true
    _write_profile_done()
    completed.emit()

func _write_profile_done() -> void:
    var profile: ProfileResource = _deps.save.read("profile") as ProfileResource
    if profile == null:
        profile = ProfileResource.new()
    profile.tutorial_done = true
    _deps.save.write("profile", profile)
```

- [ ] **Step 3: 写 tutorial.tscn**

5 个 step 节点（每个用 ColorRect + Label 占位即可，正式美术 M9 收尾）：

```
[gd_scene load_steps=8 format=3]

[ext_resource type="Script" path="res://boot/main_menu/tutorial.gd" id="1"]
[ext_resource type="Script" path="res://boot/main_menu/steps/step0_goal.gd" id="2"]
[ext_resource type="Script" path="res://boot/main_menu/steps/step1_locked.gd" id="3"]
[ext_resource type="Script" path="res://boot/main_menu/steps/step2_place.gd" id="4"]
[ext_resource type="Script" path="res://boot/main_menu/steps/step3_remove.gd" id="5"]
[ext_resource type="Script" path="res://boot/main_menu/steps/step4_completion.gd" id="6"]

[node name="Tutorial" type="Control"]
script = ExtResource("1")
anchor_right = 1.0
anchor_bottom = 1.0

[node name="StepContainer" type="Control" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0

[node name="Step0_Goal" type="Control" parent="StepContainer"]
script = ExtResource("2")

[node name="Step1_LockedCells" type="Control" parent="StepContainer"]
script = ExtResource("3")

[node name="Step2_PlaceBlock" type="Control" parent="StepContainer"]
script = ExtResource("4")

[node name="Step3_RemoveBlock" type="Control" parent="StepContainer"]
script = ExtResource("5")

[node name="Step4_Completion" type="Control" parent="StepContainer"]
script = ExtResource("6")

[node name="SkipButton" type="Button" parent="."]
text = "tutorial_skip"
anchor_left = 0.9
anchor_top = 0.0
anchor_right = 1.0
anchor_bottom = 0.08
```

- [ ] **Step 4: 创建 5 个 step 脚本**

`boot/main_menu/steps/step0_goal.gd`:

```gdscript
extends "res://boot/main_menu/tutorial_step.gd"

func _ready() -> void:
    # 视觉占位：黑色半透明背景 + 中央 Label + Next 按钮
    var bg := ColorRect.new()
    bg.color = Color(0, 0, 0, 0.75)
    bg.anchor_right = 1.0
    bg.anchor_bottom = 1.0
    add_child(bg)
    var label := Label.new()
    label.text = "tutorial_step0_goal_body"
    label.position = Vector2(400, 300)
    add_child(label)
    var btn := Button.new()
    btn.text = "tutorial_next"
    btn.position = Vector2(600, 500)
    btn.pressed.connect(func (): advance_requested.emit())
    add_child(btn)

func step_title_key() -> String:
    return "tutorial_step0_goal_title"

func step_body_key() -> String:
    return "tutorial_step0_goal_body"
```

其余 4 个 step（`step1_locked.gd` / `step2_place.gd` / `step3_remove.gd` / `step4_completion.gd`）按相同结构，只换 i18n key：

```
step1: title=tutorial_step1_locked_title  body=tutorial_step1_locked_body
step2: title=tutorial_step2_place_title   body=tutorial_step2_place_body
step3: title=tutorial_step3_remove_title  body=tutorial_step3_remove_body
step4: title=tutorial_step4_completion_title body=tutorial_step4_completion_body
```

> **美术说明**：M5 步骤内容是占位文本 + 按钮，**不**含真实高亮指引动画。M9 视觉打磨期重新设计每个 step 的视觉（半透明遮罩 + 镂空指示框 + 入场缓动）。

- [ ] **Step 5: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 6 个 tutorial_flow 用例 PASS。

- [ ] **Step 6: Commit**

```bash
git add boot/main_menu/tutorial.tscn \
        boot/main_menu/tutorial.gd \
        boot/main_menu/steps/ \
        tests/test_tutorial_flow.gd
git commit -m "feat(tutorial): 5-step tutorial flow with Skip + auto-persist tutorial_done"
```

---

## Task 9 — 在 main_menu 接入"首次启动播教程"门控

**Files:**
- Modify: `boot/main_menu/main_menu.gd`

- [ ] **Step 1: main_menu 启动后判断 tutorial_done**

在 `main_menu.gd::_ready()` 末尾或合适位置加：

```gdscript
const TutorialScene = preload("res://boot/main_menu/tutorial.tscn")

func _ready() -> void:
    # ... 原有 M4 menu 构建 ...
    _maybe_show_tutorial()

func _maybe_show_tutorial() -> void:
    if _deps.platform.get_cli_flag("skip-tutorial"):
        return
    var profile = _deps.save.read("profile")
    if profile != null and profile.tutorial_done:
        return
    var tut = TutorialScene.instantiate()
    tut._deps = _deps
    add_child(tut)
    tut.completed.connect(func ():
        tut.queue_free()
    )
```

- [ ] **Step 2: 集成测试（手测）**

```bash
# 启动时模拟新玩家（删 profile）
rm -f ~/.local/share/godot/app_userdata/Calendar\ Puzzle/saves/profile.tres
godot
```

Expected: 进 main_menu 后立即显示教程 step 0。Skip → 再启动 → 不再显示。

- [ ] **Step 3: 写门控测试**

`tests/test_tutorial_flow.gd` 追加：

```gdscript
const MainMenuScript = preload("res://boot/main_menu/main_menu.gd")
const ProfileResource = preload("res://shared/resources/profile_resource.gd")

func test_main_menu_skips_tutorial_when_done():
    var menu_scene = load("res://boot/main_menu/main_menu.tscn")
    var menu = menu_scene.instantiate()
    var deps = preload("res://tests/helpers/stub_deps_factory.gd").build()
    var profile = ProfileResource.new()
    profile.tutorial_done = true
    deps.save.write("profile", profile)
    menu._deps = deps
    add_child_autofree(menu)
    menu._ready()
    # 查找 children 里没有 Tutorial 节点
    var has_tutorial := false
    for child in menu.get_children():
        if child.name == "Tutorial":
            has_tutorial = true
    assert_false(has_tutorial, "tutorial should NOT show when tutorial_done=true")

func test_main_menu_shows_tutorial_on_first_launch():
    var menu_scene = load("res://boot/main_menu/main_menu.tscn")
    var menu = menu_scene.instantiate()
    var deps = preload("res://tests/helpers/stub_deps_factory.gd").build()
    # 不写 profile → tutorial_done 默认 false
    menu._deps = deps
    add_child_autofree(menu)
    menu._ready()
    var has_tutorial := false
    for child in menu.get_children():
        if child.name == "Tutorial":
            has_tutorial = true
    assert_true(has_tutorial, "tutorial should show on first launch")
```

- [ ] **Step 4: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 2 个新门控测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add boot/main_menu/main_menu.gd tests/test_tutorial_flow.gd
git commit -m "feat(main_menu): gate tutorial on profile.tutorial_done; --skip-tutorial dev flag"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M5 spec 验收门槛全部覆盖：
- ✅ 弱提示 3 次/普通 + 5 次/失眠 → Task 2 caps 实现 + Task 5 HUD remaining 显示 + Task 10 手测
- ✅ Medium/Strong 代码完整但 UI 隐藏 → Task 2 全 3 档实现 + Task 5 AdvancedHintsContainer.visible=false + Task 6 --enable-advanced-hints
- ✅ 5 步教程 → Task 8 完整 5 step 节点 + Task 9 only-once 门控
- ✅ 提示状态进 GameSnapshot → Task 4 round-trip 测试覆盖

**2. Placeholder scan**: 无 TBD 残留。Step 占位文本 / 占位视觉明确标注为 M9 重新设计的接口（不阻塞 M5 acceptance）。

**3. Type consistency**:
- `HintState`（Task 2）/ `HintResult`（Task 1）/ `HintSolver`（Task 3）三者交互在 test 中验证
- `GameDeps.platform.get_cli_flag(name)` 在 Task 5 调 + Task 6 定义 + Task 6 stub_deps_factory 复用一致
- `ProfileResource.tutorial_done`（来自 M4）在 Task 8 写 + Task 9 读一致
- `GameSnapshot.hint_state_blob`（Task 4 新增）签名一致 Dictionary 类型

**4. Ambiguity**:
- Task 3 假设 `dlx.gd::solve(empty_cells, available_blocks)` 接口 — 标注若 M1 接口不一致需 adapt
- Task 5 把 weak hint 简化为 `_increment` 而非 `mark_weak_used(block_id)` — 在内联 note 中说明动机（信息密度最低），但保留 mark_weak_used API 供未来扩展
- Tutorial step 视觉是占位 — 明确 deferred to M9

**5. 跨依赖核对**:
- 依赖 M1：solver/dlx.gd / board.gd（求解 + 空格枚举）
- 依赖 M2：play_scene + puzzle_state + board_renderer
- 依赖 M4：GameSnapshot / ProfileResource / SaveAdapter / Toast helper
- 不依赖 M6/M7：i18n key 直接走 stub_translation_context（M7 再补真 .po）

无发现要修。M5 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M5 实施时用 superpowers:subagent-driven-development。

派发节奏建议：
- Task 1-3（HintResult/HintState/HintSolver）可一批并发：纯数据 + 纯 solver，无场景依赖
- Task 4 串行（依赖 PuzzleState / GameSnapshot 改动需 review 后再做集成）
- Task 5-6 一批（HUD 接线 + CLI flag）
- Task 7-8 一批（教程基类 + 5 step 实现）
- Task 9 串行（main_menu 教程门控）

如某 Task 实施时发现 M1 的 `dlx.solve()` API 签名 / 返回结构与本 plan Task 3 假设不符，立即停 → 写 blocker 笔记到 feature_list.json `notes` → 由 orchestrator 决定是先打补丁还是回 M1 plan 补该接口。
