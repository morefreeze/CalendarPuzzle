# M1 — 求解器移植 + Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把微信小游戏的 DLX + 题库生成器从 JS 移植到 GDScript（`board.gd` / `dlx.gd` / `puzzle_generator.gd`），把 3MB 的 `pack_free.js` 题库转成 Godot 原生 `.tres` 资源，并产出 10 天 × 5 难度的 benchmark 报告以验证 GDScript 性能是否在 spec R4 阈值内（失眠 < 3s）。

**Architecture:** 纯算法移植，不涉及任何 UI / Scene。模块边界保持 spec § Architecture 的硬约束：所有 solver 代码留在 `games/calendar_puzzle/solver/`，**不引用** `boot/` 或 `shared/` 之外的任何 Godot scene 节点。`tools/` 下放一次性脚本（pack 转换 + benchmark），可从命令行 `godot --headless --script` 直接跑。

**Tech Stack:** Godot 4.3+（GDScript）、GUT v9（M0 已装）、Godot `RandomNumberGenerator`（替代 JS `Math.random`，可 seed）、Godot `Resource` + `FileAccess`（pack 转换 IO）。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Game systems → 求解器移植 / § Milestones M1 / § Testing strategy / § Risk register R4 R5

**Acceptance gates（从 spec 抄）：**
- `dlx.gd` / `board.gd` / `puzzle_generator.gd` 翻译完成；接口与 JS 原版语义等价
- `tools/convert_pack.gd` 一次跑通，产出 `games/calendar_puzzle/solver/pack_free.tres` 且文件可被 `load()` 还原成与 JS 原始数据等价的 Dictionary
- `tests/test_dlx.gd` / `test_board.gd` / `test_puzzle_generator.gd` / `test_pack_conversion.gd` 用 GUT 跑，line coverage ≥ 95%；round-trip 单测（同 base + 同 combo 在 JS 解算 vs GDScript 解算产生等价合法放置）PASS
- `tools/solver_benchmark.gd` 跑 10 个真实日期 × 5 难度 = 50 次生成，打印 per-puzzle 耗时 + p50/p95/total；报告归档到 `docs/m1-benchmark-report.md`
- 失眠模式 p95 < 3s。若超出，按 R4 的回滚方案在 plan 末尾的 Risk 段落决策

---

## File Structure

本 milestone 新增 / 修改的所有文件（全部位于 `~/mygit/calendar-puzzle-godot/`，不在原 CalendarPuzzle/ 仓库）：

```
calendar-puzzle-godot/
├── games/calendar_puzzle/solver/
│   ├── dlx.gd                            # 翻译 minigame/js/dlx.js
│   ├── board.gd                          # 翻译 minigame/js/board.js
│   ├── puzzle_generator.gd               # 翻译 minigame/js/puzzleGenerator.js
│   ├── difficulty_config.gd              # 5 难度配置（从 puzzleGenerator.js 抽离）
│   └── pack_free.tres                    # 由 convert_pack.gd 产出（不手写）
├── tools/
│   ├── convert_pack.gd                   # 一次性脚本：pack_free.js → pack_free.tres
│   ├── solver_benchmark.gd               # 性能基准；产出 benchmark 报告
│   └── reference_puzzles.json            # 从 JS 端导出的 round-trip 参考数据
├── tests/
│   ├── test_dlx.gd                       # DLX 算法单测
│   ├── test_board.gd                     # board 工具函数单测
│   ├── test_puzzle_generator.gd          # puzzle generator 单测
│   ├── test_pack_conversion.gd           # pack round-trip + load 单测
│   └── fixtures/
│       └── reference_puzzles.json        # 跟 tools/ 那份一致，测试期读
└── docs/
    └── m1-benchmark-report.md            # M1 最终产出的 benchmark 报告
```

> Notes:
> - 移植**不引用**任何 Steam SDK / scene / 节点 API。
> - `pack_free.tres` 由脚本生成，体积约 3MB（与原 JS 同量级）。提交时不走 Git LFS（Godot 二进制 tres 比 JSON 紧凑，3MB 在 Git 可接受范围内；M3 的 `daily_puzzles.tres` 也是同等级）。
> - `tools/reference_puzzles.json` 是从 JS 端 Node 跑一次 `puzzleGenerator.generatePuzzle()` 导出的 10 条 ground truth，用作 round-trip 单测的对照。

---

## Task 1 — 翻译 dlx.js → dlx.gd（TDD）

**Files:**
- Create: `games/calendar_puzzle/solver/dlx.gd`
- Test: `tests/test_dlx.gd`

JS 原版 `minigame/js/dlx.js` 用嵌套 `Node` 对象 + 字段 `up/down/left/right/head/size` 实现 4 向双向链表。GDScript 没有原生指针式 class 互引用糖，用 inner class `DLXNode extends RefCounted` 表达；引用关系靠 GDScript GC 维护（GUT 测试期 sanity check refcount）。

- [ ] **Step 1: 先写 failing tests**

`tests/test_dlx.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const DLX = preload("res://games/calendar_puzzle/solver/dlx.gd")

# 标准 6 列 6 行精确覆盖问题（Knuth 论文示例）
# 列 = A B C D E F G
# 行：
#   r1 = C E F
#   r2 = A D G
#   r3 = B C F
#   r4 = A D
#   r5 = B G
#   r6 = D E G
# 唯一解：{r1, r4, r5}
const MATRIX = [
    [0,0,1,0,1,1,0],
    [1,0,0,1,0,0,1],
    [0,1,1,0,0,1,0],
    [1,0,0,1,0,0,0],
    [0,1,0,0,0,0,1],
    [0,0,0,1,1,0,1],
]
const ROW_NAMES = ["head","r1","r2","r3","r4","r5","r6"]

func test_search_returns_first_solution():
    var dlx = DLX.new(MATRIX, ROW_NAMES)
    var sols = dlx.search()
    assert_eq(sols.size(), 1, "search() should return exactly 1 solution array")
    var sol = sols[0]
    var picked := []
    for node in sol:
        picked.append(ROW_NAMES[node.coordinate[0]])
    picked.sort()
    assert_eq(picked, ["r1", "r4", "r5"])

func test_count_all_finds_all_solutions():
    var dlx = DLX.new(MATRIX, ROW_NAMES)
    var n = dlx.count_all()
    assert_eq(n, 1, "Knuth example has exactly one exact cover")

func test_empty_matrix_returns_no_solution():
    var dlx = DLX.new([[0,0,0]], ["head","r1"])
    var sols = dlx.search()
    assert_eq(sols.size(), 0)

func test_already_covered_returns_empty_solution():
    # 0×0 matrix → head.right === head immediately → "trivial" cover
    var dlx = DLX.new([], ["head"])
    var sols = dlx.search()
    assert_eq(sols.size(), 1, "trivial cover counts as one solution")
    assert_eq(sols[0].size(), 0, "empty solution row")

func test_choose_column_picks_min_size():
    # 列 A 有 2 个 1，列 B 有 1 个 1 → 算法应先 cover B（最小列优先）
    var mx = [[1,1,0], [1,0,1]]
    var dlx = DLX.new(mx, ["head","r1","r2"])
    var col = dlx._choose_column()
    assert_eq(col.size, 1, "should pick column with smallest size")
```

- [ ] **Step 2: 跑测试看红**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 全 FAIL，因为 `dlx.gd` 还不存在。

- [ ] **Step 3: 写 dlx.gd 完整实现**

`games/calendar_puzzle/solver/dlx.gd`:

```gdscript
# games/calendar_puzzle/solver/dlx.gd
# Knuth Dancing Links (DLX) — exact cover solver.
# 1:1 port of minigame/js/dlx.js. RefCounted-based nodes; GC handles links.
class_name DLX extends RefCounted

const CAP := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

# Inner class. Self-linked on construction; appendCol/appendRow rewire.
class DLXNode extends RefCounted:
    var coordinate: Array    # [row, col] in 1-based (head = [0,0])
    var node_name: String
    var up: DLXNode
    var down: DLXNode
    var left: DLXNode
    var right: DLXNode
    var head: DLXNode
    var size: int = 0

    func _init(coord: Array, n: String) -> void:
        coordinate = coord
        node_name = n
        up = self
        down = self
        left = self
        right = self
        head = self

var head: DLXNode
var nodes: Dictionary = {}          # col index → column head DLXNode
var solution: Array = []            # stack of DLXNode (currently picked rows)
var row_names: Array = []           # 1:1 with mx row index (offset by 1; head at 0)

func _init(mx: Array, rn: Array) -> void:
    row_names = rn
    head = DLXNode.new([0, 0], "head")
    if mx.is_empty():
        return
    var n: int = mx.size()
    var m: int = mx[0].size()

    # Create m column heads, hook into header row right-of-head.
    for j in range(m):
        var node = DLXNode.new([0, j + 1], "h" + CAP[j])
        nodes[j] = node
        node.left = head.left
        node.right = head
        head.left.right = node
        head.left = node

    # For each row, walk columns, create a node per 1-cell; link col + row rings.
    for i in range(n):
        var first: DLXNode = null
        for jj in range(m):
            if mx[i][jj]:
                var col_node: DLXNode = nodes[jj]
                var new_node := DLXNode.new([i + 1, jj + 1], CAP[jj] + str(i + 1))
                if first == null:
                    first = new_node
                _append_col(col_node, new_node)
                _append_row(first, new_node)

# Helpers — identical to JS appendCol / appendRow.
func _append_col(col_head: DLXNode, new_node: DLXNode) -> void:
    new_node.head = col_head
    new_node.up = col_head.up
    new_node.down = col_head
    col_head.up.down = new_node
    col_head.up = new_node
    col_head.size += 1

func _append_row(first: DLXNode, new_node: DLXNode) -> void:
    new_node.right = first
    new_node.left = first.left
    first.left.right = new_node
    first.left = new_node

# Public: search for one solution. Returns list of solutions (each a list of DLXNode).
func search() -> Array:
    var results: Array = []
    _search(0, results)
    return results

func _search(_k: int, results: Array) -> void:
    if head.right == head:
        results.append(solution.duplicate())
        return
    var col := _choose_column()
    _cover(col)
    var row := col.down
    while row != col:
        solution.append(row)
        var j := row.right
        while j != row:
            _cover(j.head)
            j = j.right
        _search(_k + 1, results)
        if results.size() > 0:
            return
        row = solution.pop_back()
        j = row.left
        while j != row:
            _uncover(j.head)
            j = j.left
        row = row.down
    _uncover(col)

# Public: count every exact cover (no early-exit). Used by countSolutionsForCombo.
func count_all() -> int:
    var box := {"n": 0}
    _count_all(0, box)
    return box.n

func _count_all(_k: int, box: Dictionary) -> void:
    if head.right == head:
        box.n += 1
        return
    var col := _choose_column()
    if col.size == 0:
        return
    _cover(col)
    var row := col.down
    while row != col:
        solution.append(row)
        var j := row.right
        while j != row:
            _cover(j.head)
            j = j.right
        _count_all(_k + 1, box)
        row = solution.pop_back()
        j = row.left
        while j != row:
            _uncover(j.head)
            j = j.left
        row = row.down
    _uncover(col)

# Minimum-size column (S heuristic).
func _choose_column() -> DLXNode:
    var col := head.right
    var min_size := 0x7FFFFFFF
    var node := head.right
    while node != head:
        if node.size < min_size:
            min_size = node.size
            col = node
        node = node.right
    return col

func _cover(c: DLXNode) -> void:
    c.left.right = c.right
    c.right.left = c.left
    var row := c.down
    while row != c:
        var j := row.right
        while j != row:
            j.down.up = j.up
            j.up.down = j.down
            j.head.size -= 1
            j = j.right
        row = row.down

func _uncover(c: DLXNode) -> void:
    var row := c.up
    while row != c:
        var j := row.left
        while j != row:
            j.head.size += 1
            j.down.up = j
            j.up.down = j
            j = j.left
        row = row.up
    c.left.right = c
    c.right.left = c
```

- [ ] **Step 4: 跑测试看绿**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 之前的 6 个 M0 测试 + 5 个 DLX 测试 = 11 passed。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/solver/dlx.gd tests/test_dlx.gd
git commit -m "feat(solver): port DLX exact-cover algorithm from minigame/js/dlx.js"
```

---

## Task 2 — 翻译 board.js → board.gd（TDD）

**Files:**
- Create: `games/calendar_puzzle/solver/board.gd`
- Test: `tests/test_board.gd`

`board.js` 同时承担三个职责：(a) 棋盘布局常量 `boardLayoutData`（8×7 的 cell type/value），(b) 10 个 block 类型定义，(c) 工具函数 `rotateShape / flipShape / isValidPlacement / checkGameWin / getBlockAtCell / getUncoverableCells`。皮肤 / 主题部分**不移植**——皮肤系统在 M9 单独做（spec § 视觉/Audio）。

- [ ] **Step 1: 写 failing tests**

`tests/test_board.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const Board = preload("res://games/calendar_puzzle/solver/board.gd")

func test_board_layout_dimensions():
    assert_eq(Board.LAYOUT.size(), 8, "board has 8 rows")
    for row in Board.LAYOUT:
        assert_eq(row.size(), 7, "each row has 7 cols")

func test_initial_block_types_count_and_uniqueness():
    assert_eq(Board.INITIAL_BLOCK_TYPES.size(), 10)
    var labels := {}
    for b in Board.INITIAL_BLOCK_TYPES:
        labels[b.label] = true
    assert_eq(labels.size(), 10, "all labels unique")

func test_rotate_shape_4_times_returns_original():
    var s = [[1,1,0],[0,1,1]]
    var r = s
    for i in range(4):
        r = Board.rotate_shape(r)
    assert_eq(r, s, "rotating 4x returns to original")

func test_flip_shape_twice_returns_original():
    var s = [[1,0,0],[1,1,1]]
    assert_eq(Board.flip_shape(Board.flip_shape(s)), s)

func test_get_uncoverable_cells_2026_05_26_tuesday():
    # 2026-05-26 = May 26 (Tue). Expect 3 cells: 五月 + 26 + 二
    var d = {"year":2026, "month":5, "day":26, "weekday":2}  # weekday 0=Sun .. 6=Sat
    var cells = Board.get_uncoverable_cells(d)
    assert_eq(cells.size(), 3)
    # 五月 is layout[0][4]
    assert_true({"x":4,"y":0} in cells)
    # 26 = day cell: 2 + (26-1)/7 = 5, (26-1)%7 = 4 → layout[5][4]
    assert_true({"x":4,"y":5} in cells)
    # weekday Tuesday (jsDay=2, code 2) → layout[6][6] (b[6][4+2])
    assert_true({"x":6,"y":6} in cells)

func test_is_valid_placement_in_bounds_and_empty():
    var block = {"id":"I-block","label":"I","shape":[[1,1,1,1]]}
    var uncov = []
    assert_true(Board.is_valid_placement(block, {"x":0,"y":2}, [], uncov))
    # OOB
    assert_false(Board.is_valid_placement(block, {"x":5,"y":2}, [], uncov))

func test_is_valid_placement_rejects_overlap():
    var existing = {"id":"X","shape":[[1,1]],"x":0,"y":0}
    var probe = {"id":"Y","shape":[[1,1]]}
    assert_false(Board.is_valid_placement(probe, {"x":0,"y":0}, [existing], []))

func test_is_valid_placement_rejects_uncoverable():
    var block = {"id":"I-block","label":"I","shape":[[1,1,1,1]]}
    var uncov = [{"x":1,"y":0}]
    assert_false(Board.is_valid_placement(block, {"x":0,"y":0}, [], uncov))

func test_check_game_win_full_cover():
    # Mock: 10 blocks shaped to cover every non-empty, non-uncoverable cell
    # Easiest: build covered map programmatically and check return
    # Skipping the actual 10-block layout — just verify the contract with stubs.
    var uncov = [{"x":0,"y":0}]
    var win = Board.check_game_win([], uncov)
    # 0 blocks placed → cannot have won
    assert_false(win)

func test_get_block_at_cell_returns_owner():
    var b = {"id":"A","shape":[[1,1],[1,0]],"x":2,"y":3}
    var got = Board.get_block_at_cell([b], 3, 3)
    assert_eq(got.id, "A")
    var none = Board.get_block_at_cell([b], 5, 5)
    assert_null(none)
```

- [ ] **Step 2: 跑测试看红**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 9 个 board 测试 FAIL。

- [ ] **Step 3: 实现 board.gd**

`games/calendar_puzzle/solver/board.gd`:

```gdscript
# games/calendar_puzzle/solver/board.gd
# Calendar puzzle board layout + utilities.
# Port of minigame/js/board.js (theme/skin parts deferred to skin_manager.gd in M9).
class_name Board extends RefCounted

const ROWS := 8
const COLS := 7

# Cell-type sentinels (match miniprogram).
const T_MONTH := "month"
const T_DAY := "day"
const T_WEEKDAY := "weekday"
const T_EMPTY := "empty"

# 8×7 layout — each cell is { "t": <type>, "v": <value or null> }.
# Months in Chinese; weekday labels Sun-first per device locale (matches miniprogram).
const LAYOUT := [
    [{"t":"month","v":"一月"}, {"t":"month","v":"二月"}, {"t":"month","v":"三月"}, {"t":"month","v":"四月"}, {"t":"month","v":"五月"}, {"t":"month","v":"六月"}, {"t":"empty","v":null}],
    [{"t":"month","v":"七月"}, {"t":"month","v":"八月"}, {"t":"month","v":"九月"}, {"t":"month","v":"十月"}, {"t":"month","v":"十一月"}, {"t":"month","v":"十二月"}, {"t":"empty","v":null}],
    [{"t":"day","v":1}, {"t":"day","v":2}, {"t":"day","v":3}, {"t":"day","v":4}, {"t":"day","v":5}, {"t":"day","v":6}, {"t":"day","v":7}],
    [{"t":"day","v":8}, {"t":"day","v":9}, {"t":"day","v":10}, {"t":"day","v":11}, {"t":"day","v":12}, {"t":"day","v":13}, {"t":"day","v":14}],
    [{"t":"day","v":15}, {"t":"day","v":16}, {"t":"day","v":17}, {"t":"day","v":18}, {"t":"day","v":19}, {"t":"day","v":20}, {"t":"day","v":21}],
    [{"t":"day","v":22}, {"t":"day","v":23}, {"t":"day","v":24}, {"t":"day","v":25}, {"t":"day","v":26}, {"t":"day","v":27}, {"t":"day","v":28}],
    [{"t":"day","v":29}, {"t":"day","v":30}, {"t":"day","v":31}, {"t":"weekday","v":"日"}, {"t":"weekday","v":"一"}, {"t":"weekday","v":"二"}, {"t":"weekday","v":"三"}],
    [{"t":"empty","v":null}, {"t":"empty","v":null}, {"t":"empty","v":null}, {"t":"empty","v":null}, {"t":"weekday","v":"四"}, {"t":"weekday","v":"五"}, {"t":"weekday","v":"六"}],
]

# 10 pentomino-like blocks. shape = 2D 0/1 array. Color is M9's concern, kept as
# the miniprogram default so generator round-trip survives.
const INITIAL_BLOCK_TYPES := [
    {"id":"I-block","label":"I","color":"#00CCCC","shape":[[1,1,1,1]],"key":"i"},
    {"id":"T-block","label":"T","color":"#9933CC","shape":[[0,1,0],[0,1,0],[1,1,1]],"key":"t"},
    {"id":"L-block","label":"L","color":"#FF8800","shape":[[1,0],[1,0],[1,0],[1,1]],"key":"l"},
    {"id":"S-block","label":"S","color":"#33CC33","shape":[[0,1,1],[1,1,0]],"key":"s"},
    {"id":"Z-block","label":"Z","color":"#3366FF","shape":[[1,1,0],[0,1,0],[0,1,1]],"key":"z"},
    {"id":"N-block","label":"N","color":"#996633","shape":[[1,1,1,0],[0,0,1,1]],"key":"n"},
    {"id":"Q-block","label":"Q","color":"#FF99AA","shape":[[1,1,0],[1,1,1]],"key":"q"},
    {"id":"V-block","label":"V","color":"#9966CC","shape":[[1,0,0],[1,0,0],[1,1,1]],"key":"v"},
    {"id":"U-block","label":"U","color":"#FF5533","shape":[[1,0,1],[1,1,1]],"key":"u"},
    {"id":"J-block","label":"J","color":"#339933","shape":[[1,0],[1,0],[1,1]],"key":"j"},
]

# date_struct = {"year": int, "month": 1-12, "day": 1-31, "weekday": 0-6 (Sun=0..Sat=6)}
# Returns Array of {"x": col, "y": row}.
static func get_uncoverable_cells(date_struct: Dictionary) -> Array:
    var months := ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]
    var weekdays := ["日","一","二","三","四","五","六"]
    var cm: String = months[date_struct.month - 1]
    var cd: int = date_struct.day
    var cw: String = weekdays[date_struct.weekday]
    var coords: Array = []
    for y in range(LAYOUT.size()):
        for x in range(LAYOUT[y].size()):
            var c = LAYOUT[y][x]
            var match_month: bool = c.t == T_MONTH and c.v == cm
            var match_day: bool = c.t == T_DAY and c.v == cd
            var match_wd: bool = c.t == T_WEEKDAY and c.v == cw
            if match_month or match_day or match_wd:
                coords.append({"x": x, "y": y})
    return coords

static func rotate_shape(shape: Array) -> Array:
    var rows: int = shape.size()
    var cols: int = shape[0].size()
    var out: Array = []
    for c in range(cols):
        var row: Array = []
        for r in range(rows - 1, -1, -1):
            row.append(shape[r][c])
        out.append(row)
    return out

static func flip_shape(shape: Array) -> Array:
    var out: Array = []
    for r in shape:
        var rv: Array = r.duplicate()
        rv.reverse()
        out.append(rv)
    return out

# block = { shape: 2D, ... }; pos = {"x":int,"y":int}
# all_blocks = Array of placed blocks ({id, shape, x, y, ...}).
# uncoverable = Array of {"x":int,"y":int}.
# exclude_id = optional block id to skip (used during drag-move).
static func is_valid_placement(block: Dictionary, pos: Dictionary, all_blocks: Array, uncoverable: Array, exclude_id = null) -> bool:
    if not block.has("shape"):
        return false
    var cells: Array = []
    var shape: Array = block.shape
    for ry in range(shape.size()):
        for cx in range(shape[ry].size()):
            if shape[ry][cx] == 1:
                cells.append({"x": pos.x + cx, "y": pos.y + ry})
    # Bounds + non-empty
    for cell in cells:
        if cell.y < 0 or cell.y >= ROWS or cell.x < 0 or cell.x >= COLS:
            return false
        if LAYOUT[cell.y][cell.x].t == T_EMPTY:
            return false
    # Overlap with other placed blocks
    for bl in all_blocks:
        if exclude_id != null and bl.id == exclude_id:
            continue
        for sy in range(bl.shape.size()):
            for sx in range(bl.shape[sy].size()):
                if bl.shape[sy][sx] != 1:
                    continue
                var bx: int = bl.x + sx
                var by: int = bl.y + sy
                for cell in cells:
                    if cell.x == bx and cell.y == by:
                        return false
    # Uncoverable cells must stay free
    for u in uncoverable:
        for cell in cells:
            if cell.x == u.x and cell.y == u.y:
                return false
    return true

static func check_game_win(all_blocks: Array, uncoverable: Array) -> bool:
    if all_blocks.size() != INITIAL_BLOCK_TYPES.size():
        return false
    var covered: Dictionary = {}
    for bl in all_blocks:
        for ry in range(bl.shape.size()):
            for cx in range(bl.shape[ry].size()):
                if bl.shape[ry][cx] == 1:
                    covered[str(bl.y + ry) + "," + str(bl.x + cx)] = true
    for y in range(LAYOUT.size()):
        for x in range(LAYOUT[y].size()):
            if LAYOUT[y][x].t == T_EMPTY:
                continue
            var is_uncov := false
            for u in uncoverable:
                if u.x == x and u.y == y:
                    is_uncov = true
                    break
            if is_uncov:
                continue
            if not covered.has(str(y) + "," + str(x)):
                return false
    return true

static func get_block_at_cell(all_blocks: Array, x: int, y: int) -> Variant:
    for bl in all_blocks:
        for dy in range(bl.shape.size()):
            for dx in range(bl.shape[dy].size()):
                if bl.shape[dy][dx] == 1 and bl.x + dx == x and bl.y + dy == y:
                    return bl
    return null

static func clone_block(b: Dictionary) -> Dictionary:
    var out: Dictionary = {}
    for k in b.keys():
        if k == "shape":
            var ns: Array = []
            for r in b.shape:
                ns.append(r.duplicate())
            out.shape = ns
        else:
            out[k] = b[k]
    return out
```

- [ ] **Step 4: 跑测试看绿**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 之前 11 + 9 = 20 passed。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/solver/board.gd tests/test_board.gd
git commit -m "feat(solver): port board layout + placement utilities from minigame/js/board.js"
```

---

## Task 3 — 抽离 5 难度配置（difficulty_config.gd）

**Files:**
- Create: `games/calendar_puzzle/solver/difficulty_config.gd`

JS 把 `DIFFICULTY_CONFIG` 和 generator 耦合在一个文件里；GDScript 拆开方便 M2-M5 单独引用。

- [ ] **Step 1: 写 difficulty_config.gd**

```gdscript
# games/calendar_puzzle/solver/difficulty_config.gd
# 5 difficulty tiers from miniprogram. dig_count drives generator;
# stamina_cost is leftover from F2P design — Steam 版砍掉，但保留字段方便
# 同源测试对照。
class_name DifficultyConfig extends RefCounted

const EASY     := { "id": "easy",     "label": "接水",       "sub": "约 30 秒",  "dig_count": 3,  "stamina_cost": 3 }
const MEDIUM   := { "id": "medium",   "label": "泡咖啡",     "sub": "约 3 分钟", "dig_count": 5,  "stamina_cost": 5 }
const HARD     := { "id": "hard",     "label": "开个会",     "sub": "约 10 分钟","dig_count": 7,  "stamina_cost": 7 }
const EXPERT   := { "id": "expert",   "label": "加班赶报告", "sub": "约 20 分钟","dig_count": 9,  "stamina_cost": 9 }
const INSOMNIA := { "id": "insomnia", "label": "失眠",       "sub": "数方块助眠","dig_count": 10, "stamina_cost": 0 }

const ALL := [EASY, MEDIUM, HARD, EXPERT, INSOMNIA]

static func by_id(id: String) -> Dictionary:
    for cfg in ALL:
        if cfg.id == id:
            return cfg
    push_error("DifficultyConfig.by_id unknown: %s" % id)
    return {}

static func all_ids() -> PackedStringArray:
    var out := PackedStringArray()
    for cfg in ALL:
        out.append(cfg.id)
    return out
```

- [ ] **Step 2: 语法校验**

```bash
godot --headless --check-only --script games/calendar_puzzle/solver/difficulty_config.gd 2>&1
```

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add games/calendar_puzzle/solver/difficulty_config.gd
git commit -m "feat(solver): difficulty config constants extracted from JS generator"
```

---

## Task 4 — 翻译 puzzleGenerator.js → puzzle_generator.gd（核心 solveBoard + combo 枚举）

**Files:**
- Create: `games/calendar_puzzle/solver/puzzle_generator.gd`
- Test: `tests/test_puzzle_generator.gd`

JS 原版 616 行；本 Task 实现核心三段：(1) shape 多 orientation 枚举、(2) `solveBoard()` 用 DLX 直接解今日棋盘、(3) 用 `count_all` 验证 combo 有解。`generate_puzzle()` 的 pack lookup + dig 枚举留到 Task 5。

> **RNG 注意**：JS 用 `Math.random()` 不可 seed；GDScript 全程用 `RandomNumberGenerator` 实例，generator 接受 `rng: RandomNumberGenerator = null` 形参，None 时 fallback 到 `randf_range`。Spec § 求解器移植要求"按 seed 可复现"。

- [ ] **Step 1: 写 failing tests**

`tests/test_puzzle_generator.gd`（先只测核心 solver，dig 部分 Task 5 再补）:

```gdscript
extends "res://addons/gut/test.gd"

const PG = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")

func _date(y, m, d, wd):
    return {"year": y, "month": m, "day": d, "weekday": wd}

func test_create_board_is_8_by_7_filled_with_empty():
    var b = PG.create_board()
    assert_eq(b.size(), 8)
    for row in b:
        assert_eq(row.size(), 7)
        for cell in row:
            assert_eq(cell, " ")

func test_mark_date_stamps_corners_and_date_cells():
    var b = PG.create_board()
    PG.mark_date(b, _date(2026, 5, 26, 2))   # 2026-05-26 (Tue)
    # Corners always blocked
    assert_eq(b[0][6], "#")
    assert_eq(b[1][6], "#")
    assert_eq(b[7][0], "#")
    assert_eq(b[7][3], "#")
    # 五月 = layout[0][4]
    assert_eq(b[0][4], "*")
    # day 26: row = 2 + (26-1)/7 = 5, col = (26-1)%7 = 4
    assert_eq(b[5][4], "*")
    # weekday Tue (jsDay=2 → wd=1 in py convention used by markDate) → b[6][4+1] = b[6][5]
    # 等等：JS 原版 markDate 用的是 pyWd = jsDay==0 ? 6 : jsDay-1
    # Tuesday jsDay=2 → pyWd=1, 命中 b[6][4+1] = b[6][5]
    assert_eq(b[6][5], "*")

func test_solve_board_returns_56_chars_total_filled():
    # 2026-05-26 应能解（pack 有此日期；solveBoard 不依赖 pack，直接 DLX）
    var sb = PG.solve_board(_date(2026, 5, 26, 2))
    assert_not_null(sb)
    assert_eq(sb.size(), 8)
    var empty_count := 0
    for row in sb:
        for cell in row:
            if cell == " ":
                empty_count += 1
    assert_eq(empty_count, 0, "every cell must be either #/* or a block letter")

func test_orientations_unique_for_I_block_returns_2():
    var I_shape = [[1,1,1,1]]
    var oris = PG.all_orientations(I_shape)
    assert_eq(oris.size(), 2, "I has 2 unique orientations (1×4 and 4×1)")

func test_orientations_unique_for_Q_block_returns_4():
    # Q = [[1,1,0],[1,1,1]] → 4 orientations (no mirror symmetry adds more)
    var Q_shape = [[1,1,0],[1,1,1]]
    var oris = PG.all_orientations(Q_shape)
    assert_eq(oris.size(), 4)

func test_pack_key_format():
    # 2025-01-01 (Wednesday). jsDay=3 → pyWd=2. key = "1-1-2"
    var k = PG.pack_key(_date(2025, 1, 1, 3))
    assert_eq(k, "1-1-2")

func test_parse_board_str_roundtrip():
    var s = "*SSUUN#SSJJUN#*QJUUNNQQJTTTNQQZVTLIZZZVTLIZVVV*LI####LLI"
    var b = PG.parse_board_str(s)
    assert_eq(b.size(), 8)
    assert_eq(b[0].size(), 7)
    assert_eq(b[0][0], "*")
    assert_eq(b[0][6], "#")
```

- [ ] **Step 2: 写 puzzle_generator.gd（核心一半，dig + tutorial 留到 Task 5）**

```gdscript
# games/calendar_puzzle/solver/puzzle_generator.gd
# Port of minigame/js/puzzleGenerator.js — only core solver + combo logic here.
# Dig combinations + tutorial generator extended in Task 5.
class_name PuzzleGenerator extends RefCounted

const ROWS := 8
const COLS := 7
const BOARD_BLK := "#"
const DATE_BLK := "*"
const EMPTY := " "

const DLX = preload("res://games/calendar_puzzle/solver/dlx.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")

# JS uses Date.getDay() (0=Sun..6=Sat) + converts to py weekday (0=Mon..6=Sun).
# Our date_struct.weekday is 0=Sun..6=Sat already, same as JS. We mimic the
# conversion below to keep pack keys identical.
static func pack_key(date_struct: Dictionary) -> String:
    var js_day: int = date_struct.weekday
    var py_wd: int = 6 if js_day == 0 else js_day - 1
    return str(date_struct.month) + "-" + str(date_struct.day) + "-" + str(py_wd)

# Parse a flat 56-char board string into an 8×7 2D Array of single-char strings.
static func parse_board_str(s: String) -> Array:
    var b: Array = []
    for y in range(ROWS):
        var row: Array = []
        for x in range(COLS):
            row.append(s.substr(y * COLS + x, 1))
        b.append(row)
    return b

# Shape constants used by solveBoard. Each entry { "n": letter, "g": parsed 2D grid }.
# Format: 2D Array of single-char strings, letter = the block char, ' ' = empty.
const SHAPE_INPUTS := [
    {"n":"U","rows":["UU","U","UU"]},
    {"n":"V","rows":["VVV","V","V"]},
    {"n":"I","rows":["IIII"]},
    {"n":"L","rows":["LLLL","L"]},
    {"n":"J","rows":["JJJ","J"]},
    {"n":"Q","rows":["Q","QQ","QQ"]},
    {"n":"S","rows":[" SS","SS"]},
    {"n":"N","rows":["  NN","NNN"]},
    {"n":"T","rows":["TTT"," T"," T"]},
    {"n":"Z","rows":[" ZZ"," Z","ZZ"]},
]

# Build SHAPES lazily once.
static var _shapes_cache: Array = []
static func shapes() -> Array:
    if _shapes_cache.is_empty():
        for entry in SHAPE_INPUTS:
            _shapes_cache.append({"n": entry.n, "g": _parse_grid(entry.rows, entry.n)})
    return _shapes_cache

static func _parse_grid(rows: Array, n: String) -> Array:
    var ml := 0
    for r in rows:
        if r.length() > ml:
            ml = r.length()
    var out: Array = []
    for r in rows:
        var padded := r
        while padded.length() < ml:
            padded += " "
        var row: Array = []
        for i in range(padded.length()):
            var ch := padded.substr(i, 1)
            row.append(ch if ch == n else " ")
        out.append(row)
    return out

# rotate / mirror for solver shape grids (string-cell form, not 0/1 form).
static func rot_g(g: Array) -> Array:
    var nr: int = g.size()
    var nc: int = g[0].size()
    var r: Array = []
    for j in range(nc):
        var row: Array = []
        for i in range(nr - 1, -1, -1):
            row.append(g[i][j])
        r.append(row)
    return r

static func mir_g(g: Array) -> Array:
    var r: Array = []
    for row in g:
        var rv: Array = row.duplicate()
        rv.reverse()
        r.append(rv)
    return r

static func g_str(g: Array) -> String:
    var lines: Array = []
    for row in g:
        lines.append("".join(row))
    return "\n".join(lines)

# All unique orientations (≤ 8 = 4 rotations × 2 mirrors).
static func all_orientations(shape_grid: Array) -> Array:
    var vis: Dictionary = {}
    var res: Array = []
    var add = func(gg):
        var k := g_str(gg) if typeof(gg[0][0]) == TYPE_STRING else _bool_grid_key(gg)
        if not vis.has(k):
            vis[k] = true
            res.append(gg)
    var c = shape_grid
    for i in range(4):
        add.call(c)
        c = rot_g(c) if typeof(shape_grid[0][0]) == TYPE_STRING else Board.rotate_shape(c)
    c = mir_g(shape_grid) if typeof(shape_grid[0][0]) == TYPE_STRING else Board.flip_shape(shape_grid)
    for j in range(4):
        add.call(c)
        c = rot_g(c) if typeof(shape_grid[0][0]) == TYPE_STRING else Board.rotate_shape(c)
    return res

static func _bool_grid_key(g: Array) -> String:
    var lines: Array = []
    for row in g:
        var line := ""
        for cell in row:
            line += "1" if cell == 1 else "0"
        lines.append(line)
    return "|".join(lines)

static func create_board() -> Array:
    var b: Array = []
    for i in range(ROWS):
        var r: Array = []
        for j in range(COLS):
            r.append(EMPTY)
        b.append(r)
    return b

# Stamp corners + month/day/weekday markers per the printed calendar layout.
static func mark_date(b: Array, date_struct: Dictionary) -> void:
    # corners that are always #
    b[0][6] = BOARD_BLK
    b[1][6] = BOARD_BLK
    b[7][0] = BOARD_BLK
    b[7][1] = BOARD_BLK
    b[7][2] = BOARD_BLK
    b[7][3] = BOARD_BLK
    var mo: int = date_struct.month
    var day: int = date_struct.day
    var js_day: int = date_struct.weekday
    var wd: int = 6 if js_day == 0 else js_day - 1   # 0=Mon..6=Sun
    b[int((mo - 1) / 6.0)][(mo - 1) % 6] = DATE_BLK
    b[2 + int((day - 1) / 7.0)][(day - 1) % 7] = DATE_BLK
    if wd == 6:
        b[6][3] = DATE_BLK
    elif wd <= 2:
        b[6][4 + wd] = DATE_BLK
    else:
        b[7][1 + wd] = DATE_BLK

# Try to place shape grid `sg` (single-char form) at (x, y). Returns new board
# clone if it fits, else null.
static func fit_put(b: Array, x: int, y: int, sg: Array, sn: String) -> Variant:
    var nr: int = sg.size()
    var nc: int = sg[0].size()
    var nb: Array = []
    for row in b:
        nb.append(row.duplicate())
    for ii in range(nr):
        for jj in range(nc):
            if sg[ii][jj] == " ":
                continue
            var bx: int = x + ii
            var by: int = y + jj
            if bx < 0 or bx >= ROWS or by < 0 or by >= COLS:
                return null
            if nb[bx][by] != EMPTY:
                return null
            nb[bx][by] = sn
    return nb

# Solve today's puzzle from scratch (no pack lookup). Returns 8×7 string grid
# fully filled with letters / # / *, or null if no solution.
static func solve_board(date_struct: Dictionary) -> Variant:
    var b := create_board()
    mark_date(b, date_struct)
    var sc: int = shapes().size()
    var ep: Array = []
    for i in range(ROWS):
        for j in range(COLS):
            if b[i][j] == EMPTY:
                ep.append([i, j])

    var mx: Array = []
    var rn: Array = ["head"]
    var vis: Dictionary = {}
    for ii in range(ROWS):
        for jj in range(COLS):
            for k in range(sc):
                var oris := all_orientations(shapes()[k].g)
                for o in range(oris.size()):
                    var nb = fit_put(b, ii, jj, oris[o], shapes()[k].n)
                    if nb == null:
                        continue
                    var tc: int = sc + ep.size()
                    var row: Array = []
                    for _fi in range(tc):
                        row.append(0)
                    row[k] = 1
                    for p in range(ep.size()):
                        if nb[ep[p][0]][ep[p][1]] == shapes()[k].n:
                            row[sc + p] = 1
                    var key := "".join(row.map(func(x): return str(x)))
                    if not vis.has(key):
                        vis[key] = true
                        mx.append(row)
                        var nb_str: Array = []
                        for r2 in nb:
                            nb_str.append("".join(r2))
                        rn.append("\n".join(nb_str))
    if mx.is_empty():
        return null
    var dlx := DLX.new(mx, rn)
    var sols := dlx.search()
    if sols.is_empty():
        return null
    var sol = sols[0]
    var res: Array = []
    for row in b:
        res.append(row.duplicate())
    for node in sol:
        var lines: PackedStringArray = rn[node.coordinate[0]].split("\n")
        for li in range(lines.size()):
            for lj in range(lines[li].length()):
                var ch := lines[li].substr(lj, 1)
                if res[li][lj] == EMPTY and ch != EMPTY:
                    res[li][lj] = ch
    return res
```

- [ ] **Step 3: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 之前 20 + 7 = 27 passed。如果 `solve_board` 性能 < 1s 通过即可（此时尚未 benchmark）。

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/solver/puzzle_generator.gd tests/test_puzzle_generator.gd
git commit -m "feat(solver): port puzzle generator core (shapes/solve_board) from JS"
```

---

## Task 5 — Generator dig 枚举 + tutorial + generate_puzzle 主入口

**Files:**
- Modify: `games/calendar_puzzle/solver/puzzle_generator.gd`
- Modify: `tests/test_puzzle_generator.gd`

补完剩余 ~400 行：邻接矩阵 / 连通性检查 / 枚举所有 dig combinations / `solved_placements` / `generate_puzzle` 主入口（接收 pack data 通过参数注入，避免本 task 依赖 `pack_free.tres`）。Tutorial 生成器留到 M5 实现（spec § Milestones M5 才需要）。

- [ ] **Step 1: 在 test_puzzle_generator.gd 追加 failing tests**

追加到文件末尾：

```gdscript
func test_enum_dig_combinations_easy_returns_connected_3letter_sets():
    # 用 solve_board 的实输出作为 sb
    var sb = PG.solve_board(_date(2026, 5, 26, 2))
    var combos = PG.enum_all_dig_combinations(sb, 3)
    assert_gt(combos.size(), 0, "should find at least one connected 3-block combo")
    for combo in combos:
        assert_eq(combo.size(), 3)

func test_enum_dig_combinations_disconnected_filtered():
    # I 和 U 在大多数解里不直接相邻;用一个手编 sb 验证
    # 跳过具体棋盘构造,用断言"返回的每个 combo 内部 letters 在 sb 的邻接图里连通"
    var sb = PG.solve_board(_date(2026, 5, 26, 2))
    var adj = PG.build_block_adjacency(sb)
    var combos = PG.enum_all_dig_combinations(sb, 5)
    for combo in combos:
        assert_true(PG.is_connected(combo, adj), "combo not connected: %s" % str(combo))

func test_puzzle_from_combo_splits_pre_placed_and_remaining():
    var sb = PG.solve_board(_date(2026, 5, 26, 2))
    var combo = ["I", "U", "V"]
    var parts = PG.puzzle_from_combo(sb, combo)
    assert_eq(parts.remaining_blocks.size(), 3)
    assert_eq(parts.pre_placed_blocks.size(), 7)
    for b in parts.remaining_blocks:
        assert_true(b.label in combo)

func test_count_solutions_for_combo_returns_positive_int():
    var sb = PG.solve_board(_date(2026, 5, 26, 2))
    var combo = ["I", "U", "V"]
    var n = PG.count_solutions_for_combo(sb, combo)
    assert_gt(n, 0, "any valid combo of size 3 should have ≥ 1 solution")

func test_generate_puzzle_with_pack_uses_first_combo_for_fixed_seed():
    # Pass pack_data inline; deterministic via seeded RNG.
    var sb_str = "*SSUUN#SSJJUN#*QJUUNNQQJTTTNQQZVTLIZZZVTLIZVVV*LI####LLI"
    var pack = {"5-26-1": [sb_str]}   # key for 2026-05-26 (Tue, pyWd=1)
    var rng = RandomNumberGenerator.new()
    rng.seed = 42
    var puzzle = PG.generate_puzzle("easy", {"date": _date(2026, 5, 26, 2), "pack_data": pack, "rng": rng})
    assert_not_null(puzzle)
    assert_eq(puzzle.difficulty, "easy")
    assert_eq(puzzle.remaining_blocks.size(), 3)   # easy dig_count = 3
    assert_eq(puzzle.pre_placed_blocks.size(), 7)
    assert_eq(puzzle.date_str, "2026-05-26")
    assert_true(puzzle.has("current_combo_index"))

func test_generate_puzzle_with_combo_index_is_deterministic():
    var sb_str = "*SSUUN#SSJJUN#*QJUUNNQQJTTTNQQZVTLIZZZVTLIZVVV*LI####LLI"
    var pack = {"5-26-1": [sb_str]}
    var p1 = PG.generate_puzzle("easy", {"date": _date(2026, 5, 26, 2), "pack_data": pack, "combo_index": 0})
    var p2 = PG.generate_puzzle("easy", {"date": _date(2026, 5, 26, 2), "pack_data": pack, "combo_index": 0})
    var labels1 := p1.remaining_blocks.map(func(b): return b.label)
    var labels2 := p2.remaining_blocks.map(func(b): return b.label)
    assert_eq(labels1, labels2, "same combo_index must produce identical remaining set")

func test_get_hint_shape_returns_block_shape():
    var sb = PG.solve_board(_date(2026, 5, 26, 2))
    var shape = PG.get_hint_shape(sb, "I")
    assert_not_null(shape)
    # I-block has 4 cells
    var cell_count := 0
    for row in shape:
        for c in row:
            if c == 1:
                cell_count += 1
    assert_eq(cell_count, 4)
```

- [ ] **Step 2: 在 puzzle_generator.gd 追加实现**

追加到文件末尾：

```gdscript
# --------- Block adjacency (for connected-dig filter) ---------

static func build_block_adjacency(sb: Array) -> Dictionary:
    var letters: Array = []
    for s in shapes():
        letters.append(s.n)
    var adj: Dictionary = {}
    for l in letters:
        adj[l] = {}
    var dirs := [[-1,0],[0,-1],[0,1],[1,0]]
    for y in range(sb.size()):
        for x in range(sb[y].size()):
            var ch = sb[y][x]
            if not (ch in letters):
                continue
            for d in dirs:
                var ny: int = y + d[0]
                var nx: int = x + d[1]
                if ny >= 0 and ny < sb.size() and nx >= 0 and nx < sb[ny].size():
                    var nc = sb[ny][nx]
                    if nc != ch and (nc in letters):
                        adj[ch][nc] = true
    return adj

static func is_connected(subset: Array, adj: Dictionary) -> bool:
    if subset.size() <= 1:
        return true
    var visited: Dictionary = {}
    var queue: Array = [subset[0]]
    visited[subset[0]] = true
    while queue.size() > 0:
        var cur = queue.pop_front()
        var neighbors: Dictionary = adj.get(cur, {})
        for k in neighbors.keys():
            if not visited.has(k) and (k in subset):
                visited[k] = true
                queue.append(k)
    for s in subset:
        if not visited.has(s):
            return false
    return true

# Enumerate every K-letter subset of the 10 letters that is connected in sb.
static func enum_all_dig_combinations(sb: Array, dig_count: int) -> Array:
    var letters: Array = []
    for s in shapes():
        letters.append(s.n)
    var adj := build_block_adjacency(sb)
    var results: Array = []

    var combine = func(start: int, current: Array, recur: Callable) -> void:
        if current.size() == dig_count:
            if is_connected(current, adj):
                results.append(current.duplicate())
            return
        if start >= letters.size():
            return
        var remaining: int = letters.size() - start
        if current.size() + remaining < dig_count:
            return
        for i in range(start, letters.size()):
            current.append(letters[i])
            recur.call(i + 1, current, recur)
            current.pop_back()

    combine.call(0, [], combine)
    return results

# Convert sb (8×7 string grid) into the 10 block records placed at their solved
# positions.  Returns Array of { id, label, color, shape (0/1 grid), key, x, y }.
static func board_to_placed(sb: Array) -> Array:
    var letters: Array = []
    for s in shapes():
        letters.append(s.n)
    var L2ID: Dictionary = {}
    var L2DEF: Dictionary = {}
    for b in Board.INITIAL_BLOCK_TYPES:
        L2ID[b.label] = b.id
        L2DEF[b.label] = b
    var res: Array = []
    for ch in letters:
        var min_r: int = 99
        var min_c: int = 99
        var max_r: int = -1
        var max_c: int = -1
        for r in range(sb.size()):
            for c in range(sb[r].size()):
                if sb[r][c] == ch:
                    min_r = min(min_r, r)
                    min_c = min(min_c, c)
                    max_r = max(max_r, r)
                    max_c = max(max_c, c)
        if max_r < 0:
            continue
        var shape: Array = []
        for sr in range(min_r, max_r + 1):
            var row: Array = []
            for sc in range(min_c, max_c + 1):
                row.append(1 if sb[sr][sc] == ch else 0)
            shape.append(row)
        var defn: Dictionary = L2DEF[ch]
        res.append({"id": defn.id, "label": defn.label, "color": defn.color, "shape": shape, "key": defn.key, "x": min_c, "y": min_r})
    return res

# Given a solved board and the chosen K-letter combo, return
# { pre_placed_blocks, remaining_blocks }.
static func puzzle_from_combo(sb: Array, combo: Array) -> Dictionary:
    var all_placed := board_to_placed(sb)
    var pre: Array = []
    var rem: Array = []
    var L2DEF: Dictionary = {}
    for b in Board.INITIAL_BLOCK_TYPES:
        L2DEF[b.label] = b
    for b in all_placed:
        if combo.has(b.label):
            var orig: Dictionary = L2DEF[b.label]
            var shape: Array = []
            for r in orig.shape:
                shape.append(r.duplicate())
            rem.append({"id": orig.id, "label": orig.label, "color": orig.color, "shape": shape, "key": orig.key})
        else:
            pre.append(b)
    return {"pre_placed_blocks": pre, "remaining_blocks": rem}

# Count every exact cover of (sb with `combo` letters dug out) under the
# combo's shape constraints. Used by tutorial / hint quality checks.
static func count_solutions_for_combo(sb: Array, combo: Array) -> int:
    var b: Array = []
    for y in range(sb.size()):
        var row: Array = []
        for x in range(sb[y].size()):
            row.append(EMPTY if combo.has(sb[y][x]) else sb[y][x])
        b.append(row)
    var combo_shapes: Array = []
    for s in shapes():
        if combo.has(s.n):
            combo_shapes.append(s)
    var sc: int = combo_shapes.size()
    var ep: Array = []
    for i in range(ROWS):
        for j in range(COLS):
            if b[i][j] == EMPTY:
                ep.append([i, j])
    if ep.is_empty():
        return 0
    var mx: Array = []
    var rn: Array = ["head"]
    var vis: Dictionary = {}
    for ii in range(ROWS):
        for jj in range(COLS):
            for k in range(sc):
                var oris := all_orientations(combo_shapes[k].g)
                for o in range(oris.size()):
                    var nb = fit_put(b, ii, jj, oris[o], combo_shapes[k].n)
                    if nb == null:
                        continue
                    var tc: int = sc + ep.size()
                    var row2: Array = []
                    for _fi in range(tc):
                        row2.append(0)
                    row2[k] = 1
                    for p in range(ep.size()):
                        if nb[ep[p][0]][ep[p][1]] == combo_shapes[k].n:
                            row2[sc + p] = 1
                    var key := "".join(row2.map(func(x): return str(x)))
                    if not vis.has(key):
                        vis[key] = true
                        mx.append(row2)
                        var nb_str: Array = []
                        for r2 in nb:
                            nb_str.append("".join(r2))
                        rn.append("\n".join(nb_str))
    if mx.is_empty():
        return 0
    var dlx := DLX.new(mx, rn)
    return dlx.count_all()

# Pretty mapping: solved board → { block_id: {x, y, shape} } for hint code.
static func solved_placements(sb: Array) -> Dictionary:
    var out: Dictionary = {}
    var all_placed := board_to_placed(sb)
    for b in all_placed:
        out[b.id] = {"x": b.x, "y": b.y, "shape": b.shape}
    return out

# Find the bounding-box 0/1 shape of `label` in solved board sb (for weak hints).
static func get_hint_shape(sb: Array, label: String) -> Variant:
    var min_r := 99
    var min_c := 99
    var max_r := -1
    var max_c := -1
    for r in range(sb.size()):
        for c in range(sb[r].size()):
            if sb[r][c] == label:
                min_r = min(min_r, r)
                min_c = min(min_c, c)
                max_r = max(max_r, r)
                max_c = max(max_c, c)
    if max_r < 0:
        return null
    var shape: Array = []
    for sr in range(min_r, max_r + 1):
        var row: Array = []
        for sc in range(min_c, max_c + 1):
            row.append(1 if sb[sr][sc] == label else 0)
        shape.append(row)
    return shape

# ===========================================================================
# generate_puzzle — main entry. opts:
#   - date: date_struct
#   - pack_data: Dictionary (key → Array of 56-char board strings)
#   - combo_index: int (optional, for determinism)
#   - rng: RandomNumberGenerator (optional)
# Returns Dictionary { pre_placed_blocks, remaining_blocks, difficulty,
#                      solved_board, bases, all_combinations,
#                      current_combo_index, date_str } or null.
# ===========================================================================
const DifficultyConfig = preload("res://games/calendar_puzzle/solver/difficulty_config.gd")

static func generate_puzzle(difficulty: String, opts: Dictionary) -> Variant:
    var date_struct: Dictionary = opts.get("date", {})
    if date_struct.is_empty():
        push_error("generate_puzzle: date required")
        return null

    # Resolve bases (pre-computed pack first; fall back to live solve).
    var bases: Array = []
    var pack: Dictionary = opts.get("pack_data", {})
    var key := pack_key(date_struct)
    if pack.has(key):
        for s in pack[key]:
            bases.append(parse_board_str(s))
    else:
        var sb = solve_board(date_struct)
        if sb == null:
            return null
        bases = [sb]

    var dig_count: int = DifficultyConfig.by_id(difficulty).dig_count
    var all_combos: Array = []
    for bi in range(bases.size()):
        var letter_sets := enum_all_dig_combinations(bases[bi], dig_count)
        for ls in letter_sets:
            all_combos.append({"base_idx": bi, "letters": ls})
    if all_combos.is_empty():
        return null

    var idx := -1
    if opts.has("combo_index") and typeof(opts.combo_index) == TYPE_INT:
        idx = opts.combo_index
        if idx < 0 or idx >= all_combos.size():
            idx = 0
    else:
        var rng: RandomNumberGenerator = opts.get("rng")
        if rng == null:
            rng = RandomNumberGenerator.new()
            rng.randomize()
        idx = rng.randi_range(0, all_combos.size() - 1)

    var combo: Dictionary = all_combos[idx]
    var solved_board: Array = bases[combo.base_idx]
    var parts := puzzle_from_combo(solved_board, combo.letters)
    return {
        "pre_placed_blocks": parts.pre_placed_blocks,
        "remaining_blocks": parts.remaining_blocks,
        "difficulty": difficulty,
        "solved_board": solved_board,
        "bases": bases,
        "all_combinations": all_combos,
        "current_combo_index": idx,
        "date_str": _format_date_str(date_struct),
    }

static func _format_date_str(d: Dictionary) -> String:
    var mo := str(d.month)
    if d.month < 10:
        mo = "0" + mo
    var da := str(d.day)
    if d.day < 10:
        da = "0" + da
    return str(d.year) + "-" + mo + "-" + da
```

- [ ] **Step 3: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 之前 27 + 7 = 34 passed。如有 fail，最常见的是 `g_str` 处理字符串 vs 0/1 grid 的混用——`all_orientations` 同时被 `solve_board`（string grid）和 generator 内部（0/1 grid）调用，看 step 2 里的 `_bool_grid_key` 分支逻辑。

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/solver/puzzle_generator.gd tests/test_puzzle_generator.gd
git commit -m "feat(solver): dig combinations + puzzle_from_combo + generate_puzzle entry"
```

---

## Task 6 — 编写 convert_pack.gd（pack_free.js → pack_free.tres）

**Files:**
- Create: `tools/convert_pack.gd`
- Create: `games/calendar_puzzle/solver/pack_free.tres` (产物)

JS 的 `pack_free.js` 是 `module.exports = { "1-1-0": [...], ... }` 形式。`convert_pack.gd` 用 Godot `FileAccess` 读原文件，正则提取 JSON 部分（去掉 `module.exports = ` 前缀和末尾的 `;`），用 `JSON.parse_string` 解析，再保存为带 `Dictionary` 的 `Resource`。

> **路径**：原 `pack_free.js` 在 `~/mygit/CalendarPuzzle/calendar-puzzle-miniprogram/minigame/js/pack_free.js`。脚本以绝对路径接收输入文件（命令行参数），不依赖 `res://`。

- [ ] **Step 1: 写 PackResource 类（容器）**

`games/calendar_puzzle/solver/pack_resource.gd`:

```gdscript
# games/calendar_puzzle/solver/pack_resource.gd
# Wrapper Resource for the pack_free pre-solved board catalog.
# Key format: "M-D-pyWd" (e.g. "5-26-1") → Array[String] of 56-char board strings.
class_name PackResource extends Resource

@export var data: Dictionary = {}
@export var source_file: String = ""        # provenance: original pack_free.js path
@export var generated_at_unix: int = 0
@export var entry_count: int = 0            # = data.size(), denormalized for sanity
```

- [ ] **Step 2: 写 convert_pack.gd 脚本**

`tools/convert_pack.gd`:

```gdscript
# tools/convert_pack.gd
# One-shot: read ../CalendarPuzzle/calendar-puzzle-miniprogram/minigame/js/pack_free.js,
# extract the JS object literal, parse as JSON, save as
# games/calendar_puzzle/solver/pack_free.tres.
#
# Usage:
#   godot --headless --script tools/convert_pack.gd \
#       -- --input=/abs/path/pack_free.js \
#       --output=res://games/calendar_puzzle/solver/pack_free.tres
extends SceneTree

const PackResource = preload("res://games/calendar_puzzle/solver/pack_resource.gd")

func _init() -> void:
    var args := OS.get_cmdline_user_args()
    var input_path := _get_arg(args, "input", "../CalendarPuzzle/calendar-puzzle-miniprogram/minigame/js/pack_free.js")
    var output_path := _get_arg(args, "output", "res://games/calendar_puzzle/solver/pack_free.tres")

    print("[convert_pack] reading: %s" % input_path)
    var f := FileAccess.open(input_path, FileAccess.READ)
    if f == null:
        push_error("convert_pack: cannot open input file: %s" % input_path)
        quit(1)
        return
    var raw := f.get_as_text()
    f.close()

    # Strip the JS wrapper. Format:
    #   // comment lines
    #   module.exports = { "1-1-0": [...], ... };
    var brace_start := raw.find("{")
    var brace_end := raw.rfind("}")
    if brace_start < 0 or brace_end < 0:
        push_error("convert_pack: cannot find JSON object braces in %s" % input_path)
        quit(1)
        return
    var json_str := raw.substr(brace_start, brace_end - brace_start + 1)

    print("[convert_pack] parsing %d bytes of JSON…" % json_str.length())
    var parsed = JSON.parse_string(json_str)
    if parsed == null or typeof(parsed) != TYPE_DICTIONARY:
        push_error("convert_pack: JSON.parse_string failed")
        quit(1)
        return

    # Validate each entry shape.
    var bad: int = 0
    for k in parsed.keys():
        if typeof(k) != TYPE_STRING:
            bad += 1
        var v = parsed[k]
        if typeof(v) != TYPE_ARRAY:
            bad += 1
        for s in v:
            if typeof(s) != TYPE_STRING or s.length() != 56:
                bad += 1
    if bad > 0:
        push_error("convert_pack: %d malformed entries detected — abort" % bad)
        quit(1)
        return

    var res := PackResource.new()
    res.data = parsed
    res.source_file = input_path
    res.generated_at_unix = int(Time.get_unix_time_from_system())
    res.entry_count = parsed.size()

    print("[convert_pack] writing %d entries to %s" % [res.entry_count, output_path])
    var err := ResourceSaver.save(res, output_path, ResourceSaver.FLAG_COMPRESS)
    if err != OK:
        push_error("convert_pack: ResourceSaver.save failed: %s" % err)
        quit(1)
        return

    print("[convert_pack] OK (%d entries, source: %s)" % [res.entry_count, input_path])
    quit(0)

func _get_arg(args: PackedStringArray, name: String, default_val: String) -> String:
    for a in args:
        if a.begins_with("--" + name + "="):
            return a.substr(("--" + name + "=").length())
    return default_val
```

- [ ] **Step 3: 跑转换脚本**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tools/convert_pack.gd -- \
    --input=/Users/$USER/mygit/CalendarPuzzle/calendar-puzzle-miniprogram/minigame/js/pack_free.js \
    --output=res://games/calendar_puzzle/solver/pack_free.tres
```

Expected 输出（约 5-15s）：

```
[convert_pack] reading: /Users/.../pack_free.js
[convert_pack] parsing 3142857 bytes of JSON...
[convert_pack] writing 2557 entries to res://games/calendar_puzzle/solver/pack_free.tres
[convert_pack] OK (2557 entries, source: /Users/.../pack_free.js)
```

> `entry_count` 实际值取决于 pack（约 2500-2600）。如果 parse 失败，最可能原因是 `pack_free.js` 包含 JS 特有语法（trailing commas、单引号字符串等）。Step 4 的单测会捕获这种问题。

- [ ] **Step 4: 验证 tres 可被 load**

```bash
godot --headless -s addons/gut/gut_cmdln.gd -gtest=res://tests/test_pack_conversion.gd -gexit 2>&1 | tail -20
```

（这一步要 Task 7 先写好 tests/test_pack_conversion.gd。如果还没写，先跳过；Task 7 完工后回头跑。）

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/solver/pack_resource.gd \
        games/calendar_puzzle/solver/pack_free.tres \
        tools/convert_pack.gd
git commit -m "feat(tools): convert pack_free.js → pack_free.tres (one-shot JSON→Resource)"
```

---

## Task 7 — 写 pack round-trip 单测（解决 R5 风险）

**Files:**
- Create: `tests/test_pack_conversion.gd`
- Create: `tools/reference_puzzles.json`
- Create: `tests/fixtures/reference_puzzles.json`（copy）

R5 风险：pack 转换错位 → 玩家解不出。缓解：从 JS 端跑 10 个 `puzzleGenerator.generatePuzzle()` 输出当 ground truth，对比 GDScript 端用相同 `combo_index` + 相同 base 跑出的 `pre_placed_blocks` / `remaining_blocks` 字段。

- [ ] **Step 1: 在 CalendarPuzzle 仓库写一次性 Node script 导出 reference**

不是新文件，是用户在 CalendarPuzzle 仓库跑：

```bash
cd ~/mygit/CalendarPuzzle/calendar-puzzle-miniprogram/minigame
cat > /tmp/export_reference.js <<'EOF'
var pg = require('./js/puzzleGenerator');
var dates = [
    ['2026-01-01', 4], ['2026-03-15', 0], ['2026-05-26', 2],
    ['2026-07-04', 6], ['2026-09-09', 3], ['2026-12-25', 5],
    ['2027-02-14', 0], ['2027-06-30', 3], ['2027-08-08', 0], ['2027-11-11', 4]
];
var out = [];
for (var i = 0; i < dates.length; i++) {
    var d = new Date(dates[i][0]);
    ['easy','medium','hard','expert','insomnia'].forEach(function(diff) {
        var p = pg.generatePuzzle(diff, { date: d, comboIndex: 0 });
        if (!p) return;
        out.push({
            date: dates[i][0],
            difficulty: diff,
            combo_index: 0,
            remaining_labels: p.remainingBlocks.map(function(b) { return b.label; }).sort(),
            pre_placed_labels: p.prePlacedBlocks.map(function(b) { return b.label; }).sort(),
            solved_board_str: p.solvedBoard.map(function(r) { return r.join(''); }).join('')
        });
    });
}
console.log(JSON.stringify(out, null, 2));
EOF
node /tmp/export_reference.js > /tmp/reference_puzzles.json
```

把产出的 `/tmp/reference_puzzles.json` 拷到两处：

```bash
cp /tmp/reference_puzzles.json ~/mygit/calendar-puzzle-godot/tools/reference_puzzles.json
mkdir -p ~/mygit/calendar-puzzle-godot/tests/fixtures
cp /tmp/reference_puzzles.json ~/mygit/calendar-puzzle-godot/tests/fixtures/reference_puzzles.json
```

> 两份等同的 JSON，只是位置不同：`tools/` 那份给开发者参考，`tests/fixtures/` 那份给单测代码 `res://` 加载。

- [ ] **Step 2: 写 test_pack_conversion.gd**

`tests/test_pack_conversion.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const PackResource = preload("res://games/calendar_puzzle/solver/pack_resource.gd")
const PG = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")

const PACK_PATH := "res://games/calendar_puzzle/solver/pack_free.tres"
const REF_PATH := "res://tests/fixtures/reference_puzzles.json"

func test_pack_resource_loads_and_has_entries():
    var res = load(PACK_PATH) as PackResource
    assert_not_null(res, "pack_free.tres failed to load")
    assert_gt(res.entry_count, 2000, "pack should have > 2000 dates")
    assert_eq(res.data.size(), res.entry_count, "data.size() must match entry_count")

func test_pack_keys_have_correct_format():
    var res = load(PACK_PATH) as PackResource
    var regex := RegEx.new()
    regex.compile("^([1-9]|1[0-2])-([1-9]|[12][0-9]|3[01])-[0-6]$")
    var bad := []
    for k in res.data.keys():
        if regex.search(k) == null:
            bad.append(k)
    assert_eq(bad.size(), 0, "malformed pack keys: %s" % str(bad))

func test_pack_values_are_56_char_strings():
    var res = load(PACK_PATH) as PackResource
    var bad := 0
    var sampled := 0
    for k in res.data.keys():
        for s in res.data[k]:
            sampled += 1
            if s.length() != 56:
                bad += 1
            if sampled > 5000:
                break
        if sampled > 5000:
            break
    assert_eq(bad, 0)

func test_round_trip_against_js_reference():
    var res = load(PACK_PATH) as PackResource
    var f := FileAccess.open(REF_PATH, FileAccess.READ)
    assert_not_null(f, "reference_puzzles.json missing")
    var refs = JSON.parse_string(f.get_as_text())
    f.close()
    assert_typeof(refs, TYPE_ARRAY)
    assert_gt(refs.size(), 30, "expect ~50 reference entries")

    for ref in refs:
        var dt := _parse_date(ref.date)
        var puzzle = PG.generate_puzzle(ref.difficulty, {
            "date": dt,
            "pack_data": res.data,
            "combo_index": ref.combo_index,
        })
        assert_not_null(puzzle, "generate_puzzle returned null for %s/%s" % [ref.date, ref.difficulty])
        var got_rem := puzzle.remaining_blocks.map(func(b): return b.label)
        got_rem.sort()
        var got_pre := puzzle.pre_placed_blocks.map(func(b): return b.label)
        got_pre.sort()
        assert_eq(got_rem, ref.remaining_labels,
            "remaining_labels mismatch for %s/%s" % [ref.date, ref.difficulty])
        assert_eq(got_pre, ref.pre_placed_labels,
            "pre_placed_labels mismatch for %s/%s" % [ref.date, ref.difficulty])
        # Solved board string equivalence (strip newlines from GDScript's join form).
        var sb_str := ""
        for row in puzzle.solved_board:
            sb_str += "".join(row)
        assert_eq(sb_str, ref.solved_board_str,
            "solved_board_str mismatch for %s/%s" % [ref.date, ref.difficulty])

func _parse_date(s: String) -> Dictionary:
    var parts := s.split("-")
    var y := int(parts[0])
    var m := int(parts[1])
    var d := int(parts[2])
    # Compute weekday via Zeller's congruence (0=Sun..6=Sat).
    var yy := y
    var mm := m
    if mm < 3:
        mm += 12
        yy -= 1
    var k := yy % 100
    var j := int(yy / 100.0)
    var h := (d + int(13 * (mm + 1) / 5.0) + k + int(k / 4.0) + int(j / 4.0) + 5 * j) % 7
    # h = 0 → Saturday in Zeller; convert to 0=Sun
    var weekday := (h + 6) % 7
    return {"year": y, "month": m, "day": d, "weekday": weekday}
```

- [ ] **Step 3: 跑全套测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -40
```

Expected: 之前 34 + 4 = 38 passed。如果 `test_round_trip_against_js_reference` FAIL，最可能原因：
- pack key 编码 weekday 时 JS 和 GDScript 用了不同基准（JS `Date.getDay()` 0=Sun；上面 `_parse_date` 用 Zeller 也是 0=Sun，应一致）
- combo 枚举顺序在 JS 和 GDScript 间不同（理论上不会，因为按 letters 数组顺序穷举；但如果 `INITIAL_BLOCK_TYPES` 顺序不同就会偏）

修不动的话回到 Task 2 检查 `INITIAL_BLOCK_TYPES` 顺序与 `board.js` 严格一致。

- [ ] **Step 4: Commit**

```bash
git add tools/reference_puzzles.json tests/fixtures/reference_puzzles.json tests/test_pack_conversion.gd
git commit -m "test(solver): pack round-trip vs JS reference (10 dates × 5 diffs)"
```

---

## Task 8 — 编写 solver_benchmark.gd + 产出报告

**Files:**
- Create: `tools/solver_benchmark.gd`
- Create: `docs/m1-benchmark-report.md`

按 spec § Milestones M1 验收"10 天 × 5 难度 benchmark 报告"。脚本跑 50 次 `generate_puzzle`，记每次耗时 + 失眠模式 `count_solutions_for_combo` 的额外耗时（验证 R4），最后打印 p50/p95/总耗时，并把 markdown 表格写入 `docs/m1-benchmark-report.md`。

- [ ] **Step 1: 写 solver_benchmark.gd**

`tools/solver_benchmark.gd`:

```gdscript
# tools/solver_benchmark.gd
# Run 10 dates × 5 difficulties = 50 puzzles. Record per-puzzle wall time,
# emit markdown report to docs/m1-benchmark-report.md.
#
# Usage:
#   godot --headless --script tools/solver_benchmark.gd
extends SceneTree

const PackResource = preload("res://games/calendar_puzzle/solver/pack_resource.gd")
const PG = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")
const DifficultyConfig = preload("res://games/calendar_puzzle/solver/difficulty_config.gd")

const PACK_PATH := "res://games/calendar_puzzle/solver/pack_free.tres"
const OUTPUT_PATH := "res://docs/m1-benchmark-report.md"

const DATES := [
    "2026-01-01", "2026-03-15", "2026-05-26", "2026-07-04", "2026-09-09",
    "2026-12-25", "2027-02-14", "2027-06-30", "2027-08-08", "2027-11-11",
]

func _init() -> void:
    print("[benchmark] loading pack…")
    var pack := load(PACK_PATH) as PackResource
    if pack == null:
        push_error("benchmark: pack_free.tres missing — run convert_pack.gd first")
        quit(1)
        return

    var rng := RandomNumberGenerator.new()
    rng.seed = 20260526   # deterministic

    # rows[i] = { date, difficulty, gen_ms, count_ms, combos_total, ok }
    var rows: Array = []
    var insomnia_count_ms: Array = []   # for R4 verification

    for date_str in DATES:
        var date_struct := _parse_date(date_str)
        for diff_id in DifficultyConfig.all_ids():
            var t0 := Time.get_ticks_usec()
            var puzzle = PG.generate_puzzle(diff_id, {
                "date": date_struct, "pack_data": pack.data, "rng": rng,
            })
            var t1 := Time.get_ticks_usec()
            var gen_ms := (t1 - t0) / 1000.0
            var ok := puzzle != null

            var count_ms := 0.0
            if ok and diff_id == "insomnia":
                # extra: how long does count_solutions_for_combo take?
                var t2 := Time.get_ticks_usec()
                var letters: Array = []
                for b in puzzle.remaining_blocks:
                    letters.append(b.label)
                var _n := PG.count_solutions_for_combo(puzzle.solved_board, letters)
                var t3 := Time.get_ticks_usec()
                count_ms = (t3 - t2) / 1000.0
                insomnia_count_ms.append(count_ms)

            rows.append({
                "date": date_str, "difficulty": diff_id,
                "gen_ms": gen_ms, "count_ms": count_ms,
                "combos_total": puzzle.all_combinations.size() if ok else 0,
                "ok": ok,
            })
            print("[%s][%s] gen=%.1fms count=%.1fms combos=%d ok=%s" %
                [date_str, diff_id, gen_ms, count_ms,
                 puzzle.all_combinations.size() if ok else 0, str(ok)])

    # Aggregate
    var all_gen_ms: Array = []
    for r in rows:
        all_gen_ms.append(r.gen_ms)
    all_gen_ms.sort()
    var insomnia_gen_ms: Array = []
    for r in rows:
        if r.difficulty == "insomnia":
            insomnia_gen_ms.append(r.gen_ms)
    insomnia_gen_ms.sort()

    var report := _build_report(rows, all_gen_ms, insomnia_gen_ms, insomnia_count_ms)
    var f := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
    f.store_string(report)
    f.close()
    print("[benchmark] report written to %s" % OUTPUT_PATH)
    quit(0)

func _percentile(sorted_arr: Array, p: float) -> float:
    if sorted_arr.is_empty():
        return 0.0
    var idx: int = clamp(int(round(p * (sorted_arr.size() - 1))), 0, sorted_arr.size() - 1)
    return sorted_arr[idx]

func _build_report(rows: Array, all_gen_ms: Array, ins_gen_ms: Array, ins_count_ms: Array) -> String:
    var out := "# M1 Solver Benchmark Report\n\n"
    out += "Generated: %s (Godot %s)\n\n" % [Time.get_datetime_string_from_system(), Engine.get_version_info().string]
    out += "Hardware: <fill in by hand: CPU model / RAM>\n\n"

    out += "## Aggregate (all 50 runs)\n\n"
    out += "| Metric | Value |\n|---|---|\n"
    out += "| Total wall time | %.0f ms |\n" % _sum(all_gen_ms)
    out += "| p50 gen_ms | %.1f ms |\n" % _percentile(all_gen_ms, 0.5)
    out += "| p95 gen_ms | %.1f ms |\n" % _percentile(all_gen_ms, 0.95)
    out += "| max gen_ms | %.1f ms |\n" % all_gen_ms[-1]
    out += "\n## Insomnia (10 runs) — R4 check\n\n"
    out += "| Metric | Value | Threshold |\n|---|---|---|\n"
    out += "| insomnia p50 gen_ms | %.1f ms | — |\n" % _percentile(ins_gen_ms, 0.5)
    out += "| insomnia p95 gen_ms | %.1f ms | < 3000 ms (R4 hard) |\n" % _percentile(ins_gen_ms, 0.95)
    out += "| insomnia max count_ms | %.1f ms | — |\n" % (ins_count_ms.max() if not ins_count_ms.is_empty() else 0.0)
    out += "\n**R4 verdict**: %s\n" % ("PASS" if _percentile(ins_gen_ms, 0.95) < 3000.0 else "FAIL — see Risk paragraph below")

    out += "\n## Per-puzzle breakdown\n\n"
    out += "| Date | Difficulty | gen_ms | count_ms | combos | ok |\n|---|---|---|---|---|---|\n"
    for r in rows:
        out += "| %s | %s | %.1f | %.1f | %d | %s |\n" % [
            r.date, r.difficulty, r.gen_ms, r.count_ms, r.combos_total, str(r.ok)
        ]

    if _percentile(ins_gen_ms, 0.95) >= 3000.0:
        out += "\n## R4 Mitigation Required\n\n"
        out += "Insomnia p95 ≥ 3s. Pick one:\n"
        out += "1. Reduce dig_count for insomnia 10 → 9 (less combinations to enumerate).\n"
        out += "2. Move generate_puzzle to a thread (Godot Threads + signal callback).\n"
        out += "3. Pre-compute insomnia puzzles in daily_puzzles.tres at build time (M3 already does this for all difficulties; insomnia just becomes a lookup).\n"
        out += "4. Last resort: port solver to C# via .NET integration (spec § R4 mentioned).\n"

    return out

func _sum(arr: Array) -> float:
    var s := 0.0
    for x in arr:
        s += x
    return s

func _parse_date(s: String) -> Dictionary:
    var parts := s.split("-")
    var y := int(parts[0]); var m := int(parts[1]); var d := int(parts[2])
    var yy := y; var mm := m
    if mm < 3: mm += 12; yy -= 1
    var k := yy % 100; var j := int(yy / 100.0)
    var h := (d + int(13 * (mm + 1) / 5.0) + k + int(k / 4.0) + int(j / 4.0) + 5 * j) % 7
    var weekday := (h + 6) % 7
    return {"year": y, "month": m, "day": d, "weekday": weekday}
```

- [ ] **Step 2: 跑 benchmark**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tools/solver_benchmark.gd 2>&1 | tee /tmp/benchmark.log
```

Expected：50 行 per-puzzle 输出 + 最后一行 `[benchmark] report written to res://docs/m1-benchmark-report.md`。

> 如果 insomnia p95 ≥ 3000ms，本步骤产出的报告会自带 R4 缓解段落。该情况下与用户对齐选哪条缓解再决定是否进入 M2。

- [ ] **Step 3: 手工补 hardware 字段**

打开 `docs/m1-benchmark-report.md`，把 `Hardware: <fill in by hand>` 改成具体 CPU/RAM，例如：

```
Hardware: Apple M1 Pro (10C/16GB), macOS 15.4
```

- [ ] **Step 4: Commit**

```bash
git add tools/solver_benchmark.gd docs/m1-benchmark-report.md
git commit -m "perf(solver): benchmark report 10 dates x 5 difficulties (R4 check)"
```

---

## Task 9 — 测试覆盖率 ≥ 95% 校验

**Files:**
- 无新文件（只是覆盖率分析 + 缺口补单测）

GUT 自带 `-gcoverage` 选项（v9.3+）。M1 spec 要求 95%。

- [ ] **Step 1: 跑 coverage 模式**

```bash
godot --headless -s addons/gut/gut_cmdln.gd \
    -gdir=res://tests \
    -gcoverage=res://games/calendar_puzzle/solver \
    -gcoverage_threshold=95 \
    -gexit 2>&1 | tee /tmp/coverage.log
tail -30 /tmp/coverage.log
```

Expected 末尾：

```
Coverage for res://games/calendar_puzzle/solver:
  dlx.gd: 98.5%
  board.gd: 96.2%
  puzzle_generator.gd: 95.1%
  difficulty_config.gd: 100%
Overall: 96.0% (PASS, threshold 95%)
```

- [ ] **Step 2: 如果覆盖率 < 95%，补单测**

GUT 会高亮每个文件未覆盖的行号；针对性补测试，最常见的缺口：
- `clone_block`（board.gd）
- `mir_g` / `g_str` 字符串 grid 分支（puzzle_generator.gd）
- DLX `count_all` 在零解情况的早 return

- [ ] **Step 3: 重跑 coverage 直到通过**

```bash
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests -gcoverage=res://games/calendar_puzzle/solver -gcoverage_threshold=95 -gexit
```

Expected: 退出码 0。

- [ ] **Step 4: Commit（如果补了单测）**

```bash
git add tests/
git commit -m "test(solver): close coverage gaps to ≥95% (clone_block / mir_g / count_all early-return)"
```

---

## Task 10 — 集成校验：跑 M0 冒烟测试无回归

**Files:**
- 无文件改动

确认 M1 改动不破坏 M0 的 boot scene。

- [ ] **Step 1: 跑全部单测（M0 + M1）**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected 末尾：`<N> passed, 0 failed`（N ≥ 40，包含 M0 的 6 个 + M1 的 ~38 个）。

- [ ] **Step 2: 跑 boot 冒烟（M0 验收路径）**

```bash
godot --headless --quit-after 3 res://boot/boot.tscn 2>&1 | tail -10
```

Expected：依然显示 `[boot] module 'calendar_puzzle' started`，无新增 ERROR。

- [ ] **Step 3: 开 Editor GUI 检查一遍**

```bash
godot
```

按 F5 启动游戏，确认 stub 标签仍然显示。关闭。

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M1 spec 验收门槛 3 条全覆盖：
- ✅ DLX + generator 翻译 → Task 1-5（dlx.gd / board.gd / difficulty_config.gd / puzzle_generator.gd 全部完整代码）
- ✅ GUT 95% pass → Task 9 显式跑 `-gcoverage_threshold=95` 强校验
- ✅ 10 天 × 5 难度 benchmark → Task 8 产出 `docs/m1-benchmark-report.md`，含 p50/p95/per-puzzle

额外覆盖 R5（pack round-trip）→ Task 7 用 JS 端 reference JSON 反向验证。

**2. Placeholder scan**:
- `docs/m1-benchmark-report.md` 的 `Hardware: <fill in by hand>` 是用户填写位（Task 8 Step 3 明确要求）
- 无其他 TBD / TODO

**3. Type consistency**:
- `date_struct: Dictionary {year, month, day, weekday(0=Sun..6=Sat)}` — Board.gd / PG.gd / benchmark / round-trip test 全程一致
- `generate_puzzle` 返回 Dictionary 的 key 命名（`pre_placed_blocks` / `remaining_blocks` / `solved_board` / `current_combo_index` / `date_str`）与 JS 原版字段一致（驼峰→蛇形）并在 round-trip 单测中显式断言
- `pack_data: Dictionary` 形参可在 `generate_puzzle` 调用点用 PackResource.data 直接注入，避免 generator 直接依赖 PackResource 类（保持 solver 纯算法层）
- `RandomNumberGenerator` 全程 nullable，None 时 fallback 到 `randomize()` — 与 spec § 求解器移植"按 seed 可复现"一致

**4. Ambiguity**:
- pack 转换的 `pack_free.js` 路径用相对路径，可能在不同机器/不同 CalendarPuzzle clone 位置变化 → Task 6 Step 3 明确给绝对路径示例，并把路径作为 `--input` 命令行参数可覆盖
- `_parse_date` 用 Zeller 算 weekday，避免依赖 `Time.get_date_dict_from_unix_time`（行为依赖时区）—— round-trip 测试中显式校准 0=Sun
- "JS 端 reference 导出" 步骤（Task 7 Step 1）需要用户在 CalendarPuzzle 仓库 `node` 跑一次脚本；不能在 Godot 内自动化。明确标注为手工步骤

**5. R4 处理**: Task 8 的 benchmark 报告自带 `if insomnia p95 ≥ 3000ms` 分支生成 Mitigation 段落，把 spec § R4 的 4 个回滚方案直接写进 report；不需要 plan 外的额外动作。

无发现要修。M1 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M1 实施时用 superpowers:subagent-driven-development。每个 Task 派一个 fresh subagent → review → 下一个。

**串行依赖**:
- Task 1 (DLX) 必须先于 Task 4-5（generator 用 DLX）
- Task 2 (board) 必须先于 Task 5（generator 用 Board.INITIAL_BLOCK_TYPES）
- Task 4 必须先于 Task 5（同文件追加）
- Task 6 (convert_pack) 必须先于 Task 7（round-trip 测试加载 pack_free.tres）
- Task 7 必须先于 Task 8（benchmark 也用 pack；理论上 Task 6 也 OK，但 round-trip 通过更稳）
- Task 9 / 10 收尾

**可并行**:
- Task 3 (difficulty_config) 与 Task 1-2 独立
- Task 7 Step 1（JS 端导出 reference）可在用户跑 Task 1-5 期间异步执行

冗长 generator port 建议拆给同一个 subagent 跑 Task 4 + 5（共享上下文），避免重复加载文件。
