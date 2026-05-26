# M3 — 难度系统 + 日历 + 全量预生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 5 个难度（easy / medium / hard / expert / insomnia）变成玩家可选；做"今日题"快捷入口 + 日历选题 UI（范围 2020-01-01 至 2035-12-31）；用 `tools/precompute_daily.gd` 离线跑出 `daily_puzzles.tres`（5800 天 × 5 难度 = 29,000 条记录），玩家完全本地查表，零后端零网络。

**Architecture:** 难度 = enum + dig_count 映射常量；select_scene 提供"今天"按钮 + 月历控件 + 难度选择；`DailyPuzzleTable` 是一个 Resource，包内 dictionary 按日期字符串查询；`PuzzleGenerator.from_seed(seed, combo_index)` 是 M1 已实现的 API，本 milestone 只在 select → play 跳转那一步消费它。日历控件放在 `shared/ui/`，因为合集 Hub Phase 3 其他游戏可能复用。

**Tech Stack:** Godot 4.3+ (GDScript)、GUT v9、M1 已交付的 `dlx.gd` / `puzzle_generator.gd` / `board.gd`。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Game systems → 5 难度 / 当日题 / 日历模式；§ Milestones M3；§ Game systems → 每日题与日历模式（零后端方案）

**Acceptance gates (从 spec 抄):**
- 5 难度可选（easy=3、medium=5、hard=7、expert=9、insomnia=10 digCount）；每个难度都能进 play_scene 跑通
- "今日题"按钮一键开本机系统日期的题
- 日历控件可翻月、选 2020-01-01 至 2035-12-31 任意日期；超出范围禁用 / 灰显
- `games/calendar_puzzle/solver/daily_puzzles.tres` 已生成，含 29,000 条记录，文件 < 2MB
- `DailyPuzzleTable.lookup(date_str, difficulty)` 对所有 5800 × 5 组合都返回非空
- GUT 全套绿（含 M0-M2 既有用例 + 本 milestone 新增）

---

## File Structure

本 milestone 创建/修改的所有文件（均在新仓库 `~/mygit/calendar-puzzle-godot/`，不动 CalendarPuzzle/）：

```
calendar-puzzle-godot/
├── games/
│   └── calendar_puzzle/
│       ├── solver/
│       │   ├── difficulty.gd                 # NEW — 难度常量 + 配置
│       │   ├── daily_puzzle_table.gd         # NEW — Resource 类定义
│       │   └── daily_puzzles.tres            # NEW — 预生成数据（脚本产出）
│       └── scenes/
│           ├── select_scene.tscn             # NEW — 难度 + 日历选题界面
│           └── select_scene.gd               # NEW — 选题逻辑
├── shared/
│   └── ui/
│       ├── calendar.gd                       # NEW — 月历控件（基础月格）
│       └── calendar.tscn                     # NEW — 控件场景
├── tools/
│   └── precompute_daily.gd                   # NEW — 全量预生成脚本
├── tests/
│   ├── test_difficulty.gd                    # NEW
│   ├── test_daily_puzzle_table.gd            # NEW — round-trip
│   ├── test_calendar_widget.gd               # NEW — 月翻页 / 范围约束
│   └── test_select_scene.gd                  # NEW — 集成
└── boot/
    └── boot.gd                               # MODIFY — 改为先去 select_scene 而不是直接 play_scene
```

> **预生成的 `daily_puzzles.tres` 体积估算**：每条记录 `{seed: int (8B), combo_index: int (4B)}` = ~12B；29k 条 = ~350KB 纯数据，加 Godot Resource 容器开销估总 < 1MB。如果落地后 > 2MB 需要 review 序列化方式。

---

## Task 1 — 定义 Difficulty 常量与配置（TDD）

**Files:**
- Create: `games/calendar_puzzle/solver/difficulty.gd`
- Test: `tests/test_difficulty.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_difficulty.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const Difficulty = preload("res://games/calendar_puzzle/solver/difficulty.gd")

func test_five_difficulties_defined():
    var all := Difficulty.all_ids()
    assert_eq(all.size(), 5)
    assert_true(all.has("easy"))
    assert_true(all.has("medium"))
    assert_true(all.has("hard"))
    assert_true(all.has("expert"))
    assert_true(all.has("insomnia"))

func test_dig_counts_match_spec():
    assert_eq(Difficulty.dig_count_for("easy"), 3)
    assert_eq(Difficulty.dig_count_for("medium"), 5)
    assert_eq(Difficulty.dig_count_for("hard"), 7)
    assert_eq(Difficulty.dig_count_for("expert"), 9)
    assert_eq(Difficulty.dig_count_for("insomnia"), 10)

func test_unknown_difficulty_returns_negative_one():
    assert_eq(Difficulty.dig_count_for("bogus"), -1)

func test_hint_cap_normal_vs_insomnia():
    assert_eq(Difficulty.weak_hint_cap("easy"), 3)
    assert_eq(Difficulty.weak_hint_cap("medium"), 3)
    assert_eq(Difficulty.weak_hint_cap("hard"), 3)
    assert_eq(Difficulty.weak_hint_cap("expert"), 3)
    assert_eq(Difficulty.weak_hint_cap("insomnia"), 5)

func test_display_name_keys_are_translation_keys():
    # 翻译 key 必须是稳定 ASCII 字符串（M7 由 zh_CN.po / en.po 提供值）
    assert_eq(Difficulty.display_name_key("easy"), "difficulty.easy")
    assert_eq(Difficulty.display_name_key("insomnia"), "difficulty.insomnia")
```

- [ ] **Step 2: 跑测试，期待 FAIL**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 5 个测试报 "Could not preload script" 或全部 FAIL（因为实现还没写）。

- [ ] **Step 3: 写实现**

`games/calendar_puzzle/solver/difficulty.gd`:

```gdscript
# games/calendar_puzzle/solver/difficulty.gd
# 5 个难度的常量 + 配置查询。
# id 是英文 ASCII（用于存档键 / 成就前缀 / 翻译 key）。
# UI 显示用 i18n key（M7 解析），见 display_name_key()。
class_name Difficulty extends RefCounted

const EASY := "easy"
const MEDIUM := "medium"
const HARD := "hard"
const EXPERT := "expert"
const INSOMNIA := "insomnia"

# dig_count = generator 在求解出的盘面上随机移除的方块数。数字越大题越难。
const _DIG_COUNTS := {
    EASY: 3,
    MEDIUM: 5,
    HARD: 7,
    EXPERT: 9,
    INSOMNIA: 10,
}

# 每题弱提示上限。spec 规定：普通 3 次、失眠 5 次。
const _WEAK_HINT_CAPS := {
    EASY: 3,
    MEDIUM: 3,
    HARD: 3,
    EXPERT: 3,
    INSOMNIA: 5,
}

static func all_ids() -> Array[String]:
    return [EASY, MEDIUM, HARD, EXPERT, INSOMNIA]

static func dig_count_for(difficulty_id: String) -> int:
    return _DIG_COUNTS.get(difficulty_id, -1)

static func weak_hint_cap(difficulty_id: String) -> int:
    return _WEAK_HINT_CAPS.get(difficulty_id, 0)

static func display_name_key(difficulty_id: String) -> String:
    # M7 翻译表里加 "difficulty.easy" -> "简单" / "Easy" 等
    return "difficulty." + difficulty_id

static func is_valid(difficulty_id: String) -> bool:
    return _DIG_COUNTS.has(difficulty_id)
```

- [ ] **Step 4: 跑测试，期待 PASS**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 5 个新测试全绿；M0-M2 既有用例仍绿。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/solver/difficulty.gd tests/test_difficulty.gd
git commit -m "feat(solver): Difficulty constants (5 levels + dig counts + hint caps)"
```

---

## Task 2 — 定义 DailyPuzzleTable Resource（TDD）

**Files:**
- Create: `games/calendar_puzzle/solver/daily_puzzle_table.gd`
- Test: `tests/test_daily_puzzle_table.gd`

> 本 task 只定义类 + lookup API + 单测；**真实数据 `daily_puzzles.tres` 在 Task 5 由 precompute 脚本生成**。本 task 的测试用手工构造的 mini table。

- [ ] **Step 1: 写 failing test**

`tests/test_daily_puzzle_table.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const DailyPuzzleTable = preload("res://games/calendar_puzzle/solver/daily_puzzle_table.gd")
const Difficulty = preload("res://games/calendar_puzzle/solver/difficulty.gd")

func _make_fixture() -> DailyPuzzleTable:
    var t := DailyPuzzleTable.new()
    t.entries = {
        "2020-01-01": {
            "easy":     {"seed": 100, "combo_index": 0},
            "medium":   {"seed": 200, "combo_index": 1},
            "hard":     {"seed": 300, "combo_index": 2},
            "expert":   {"seed": 400, "combo_index": 3},
            "insomnia": {"seed": 500, "combo_index": 4},
        },
        "2035-12-31": {
            "easy":     {"seed": 9001, "combo_index": 7},
            "medium":   {"seed": 9002, "combo_index": 8},
            "hard":     {"seed": 9003, "combo_index": 9},
            "expert":   {"seed": 9004, "combo_index": 10},
            "insomnia": {"seed": 9005, "combo_index": 11},
        },
    }
    return t

func test_lookup_returns_entry_for_known_date_and_difficulty():
    var t := _make_fixture()
    var entry := t.lookup("2020-01-01", "hard")
    assert_eq(entry.seed, 300)
    assert_eq(entry.combo_index, 2)

func test_lookup_returns_empty_for_unknown_date():
    var t := _make_fixture()
    var entry := t.lookup("2021-06-15", "easy")
    assert_true(entry.is_empty(), "unknown date should return empty dict")

func test_lookup_returns_empty_for_unknown_difficulty():
    var t := _make_fixture()
    var entry := t.lookup("2020-01-01", "bogus")
    assert_true(entry.is_empty())

func test_has_date_true_only_for_known():
    var t := _make_fixture()
    assert_true(t.has_date("2020-01-01"))
    assert_false(t.has_date("2019-12-31"))

func test_all_dates_returns_sorted_list():
    var t := _make_fixture()
    var dates := t.all_dates()
    assert_eq(dates.size(), 2)
    assert_eq(dates[0], "2020-01-01")
    assert_eq(dates[1], "2035-12-31")

func test_range_constants_match_spec():
    assert_eq(DailyPuzzleTable.RANGE_START, "2020-01-01")
    assert_eq(DailyPuzzleTable.RANGE_END, "2035-12-31")

func test_save_and_load_round_trip(tmp_path = "user://test_table_round_trip.tres"):
    var t := _make_fixture()
    var err := ResourceSaver.save(t, tmp_path)
    assert_eq(err, OK)
    var loaded := load(tmp_path) as DailyPuzzleTable
    assert_not_null(loaded)
    assert_eq(loaded.lookup("2020-01-01", "easy").seed, 100)
    assert_eq(loaded.lookup("2035-12-31", "insomnia").combo_index, 11)
    DirAccess.remove_absolute(ProjectSettings.globalize_path(tmp_path))
```

- [ ] **Step 2: 写实现**

`games/calendar_puzzle/solver/daily_puzzle_table.gd`:

```gdscript
# games/calendar_puzzle/solver/daily_puzzle_table.gd
# 预生成的"日期 → 难度 → {seed, combo_index}"查表。
# 由 tools/precompute_daily.gd 一次性生成 daily_puzzles.tres 并打包进 .pck。
# 运行时只做 O(1) 字典查询，零网络。
class_name DailyPuzzleTable extends Resource

# 范围 = spec § 每日题与日历模式
const RANGE_START := "2020-01-01"
const RANGE_END   := "2035-12-31"

# entries[date_str: "YYYY-MM-DD"][difficulty_id] = { "seed": int, "combo_index": int }
@export var entries: Dictionary = {}

# 查指定日期 + 难度，返回 { seed, combo_index } 或 {} 空字典。
func lookup(date_str: String, difficulty_id: String) -> Dictionary:
    if not entries.has(date_str):
        return {}
    var by_diff: Dictionary = entries[date_str]
    if not by_diff.has(difficulty_id):
        return {}
    return by_diff[difficulty_id]

func has_date(date_str: String) -> bool:
    return entries.has(date_str)

# 排序的所有日期。
func all_dates() -> Array:
    var keys := entries.keys()
    keys.sort()
    return keys

func size() -> int:
    return entries.size()
```

- [ ] **Step 3: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 7 个新测试 + 之前的全绿。

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/solver/daily_puzzle_table.gd tests/test_daily_puzzle_table.gd
git commit -m "feat(solver): DailyPuzzleTable resource with lookup API + round-trip tests"
```

---

## Task 3 — 实现 Calendar 月历控件（TDD）

**Files:**
- Create: `shared/ui/calendar.gd`
- Create: `shared/ui/calendar.tscn`
- Test: `tests/test_calendar_widget.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_calendar_widget.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const Calendar = preload("res://shared/ui/calendar.gd")

func _make_calendar() -> Calendar:
    var c := Calendar.new()
    c.range_start = "2020-01-01"
    c.range_end = "2035-12-31"
    c.shown_year = 2026
    c.shown_month = 5
    return c

func test_initial_state():
    var c := _make_calendar()
    assert_eq(c.shown_year, 2026)
    assert_eq(c.shown_month, 5)
    assert_eq(c.selected_date, "")  # 默认无选中

func test_next_month_increments():
    var c := _make_calendar()
    c.go_next_month()
    assert_eq(c.shown_year, 2026)
    assert_eq(c.shown_month, 6)

func test_next_month_wraps_year():
    var c := _make_calendar()
    c.shown_year = 2026
    c.shown_month = 12
    c.go_next_month()
    assert_eq(c.shown_year, 2027)
    assert_eq(c.shown_month, 1)

func test_prev_month_wraps_year():
    var c := _make_calendar()
    c.shown_year = 2026
    c.shown_month = 1
    c.go_prev_month()
    assert_eq(c.shown_year, 2025)
    assert_eq(c.shown_month, 12)

func test_next_month_blocked_at_range_end():
    var c := _make_calendar()
    c.shown_year = 2035
    c.shown_month = 12
    c.go_next_month()
    # 不应推到 2036
    assert_eq(c.shown_year, 2035)
    assert_eq(c.shown_month, 12)

func test_prev_month_blocked_at_range_start():
    var c := _make_calendar()
    c.shown_year = 2020
    c.shown_month = 1
    c.go_prev_month()
    assert_eq(c.shown_year, 2020)
    assert_eq(c.shown_month, 1)

func test_select_date_in_range():
    var c := _make_calendar()
    var ok := c.select_date("2026-05-15")
    assert_true(ok)
    assert_eq(c.selected_date, "2026-05-15")

func test_select_date_out_of_range_rejected():
    var c := _make_calendar()
    assert_false(c.select_date("2019-12-31"))
    assert_eq(c.selected_date, "")
    assert_false(c.select_date("2036-01-01"))
    assert_eq(c.selected_date, "")

func test_select_invalid_date_rejected():
    var c := _make_calendar()
    assert_false(c.select_date("2026-02-30"))  # 2 月没 30 号
    assert_false(c.select_date("not-a-date"))
    assert_false(c.select_date(""))

func test_days_in_month_handles_leap_year():
    assert_eq(Calendar.days_in_month(2020, 2), 29)  # 闰年
    assert_eq(Calendar.days_in_month(2021, 2), 28)  # 平年
    assert_eq(Calendar.days_in_month(2024, 2), 29)  # 闰年
    assert_eq(Calendar.days_in_month(2100, 2), 28)  # 整百非 400 倍数 = 平年
    assert_eq(Calendar.days_in_month(2000, 2), 29)  # 整 400 倍数 = 闰年
    assert_eq(Calendar.days_in_month(2026, 1), 31)
    assert_eq(Calendar.days_in_month(2026, 4), 30)

func test_today_iso_format():
    # today_iso() 用 OS.get_date 输出 "YYYY-MM-DD"
    var today := Calendar.today_iso()
    assert_eq(today.length(), 10)
    assert_eq(today[4], "-")
    assert_eq(today[7], "-")
```

- [ ] **Step 2: 写控件实现**

`shared/ui/calendar.gd`:

```gdscript
# shared/ui/calendar.gd
# 基础月历控件：显示一个月的格子（7 列 × 6 行最大），prev/next 月按钮，可选中某天。
# 范围由 range_start / range_end 限定（"YYYY-MM-DD"），超出禁用导航 + 拒绝选择。
# 不依赖任何 boot/ 代码；Phase 3 Hub 其他游戏可复用。
class_name Calendar extends Control

signal date_selected(date_iso: String)
signal month_changed(year: int, month: int)

@export var range_start: String = "1970-01-01"
@export var range_end: String = "2099-12-31"

var shown_year: int = 2026
var shown_month: int = 1   # 1..12
var selected_date: String = ""

# UI 节点（由 .tscn 实例化时填充；纯逻辑测试不用）
@onready var _label_month: Label = get_node_or_null("Header/MonthLabel")
@onready var _btn_prev: Button = get_node_or_null("Header/PrevButton")
@onready var _btn_next: Button = get_node_or_null("Header/NextButton")
@onready var _grid: GridContainer = get_node_or_null("Grid")

func _ready() -> void:
    if _btn_prev: _btn_prev.pressed.connect(go_prev_month)
    if _btn_next: _btn_next.pressed.connect(go_next_month)
    _render()

# --- 月导航 ---

func go_next_month() -> void:
    var ny := shown_year
    var nm := shown_month + 1
    if nm > 12:
        nm = 1
        ny += 1
    if not _is_month_in_range(ny, nm):
        return
    shown_year = ny
    shown_month = nm
    month_changed.emit(shown_year, shown_month)
    _render()

func go_prev_month() -> void:
    var ny := shown_year
    var nm := shown_month - 1
    if nm < 1:
        nm = 12
        ny -= 1
    if not _is_month_in_range(ny, nm):
        return
    shown_year = ny
    shown_month = nm
    month_changed.emit(shown_year, shown_month)
    _render()

# --- 选日期 ---

# 返回 true = 选成功 + 发信号；false = 越界 / 非法。
func select_date(date_iso: String) -> bool:
    if not _is_valid_iso(date_iso):
        return false
    if not _is_in_range(date_iso):
        return false
    selected_date = date_iso
    date_selected.emit(date_iso)
    return true

# --- 范围 / 格式校验 ---

func _is_month_in_range(y: int, m: int) -> bool:
    # 把月转成该月第 1 天，看是否落在 [range_start, range_end]
    var first := "%04d-%02d-01" % [y, m]
    var last := "%04d-%02d-%02d" % [y, m, days_in_month(y, m)]
    # 当前月只要有任何一天落在范围内就 OK
    return first <= range_end and last >= range_start

func _is_in_range(date_iso: String) -> bool:
    return date_iso >= range_start and date_iso <= range_end

static func _is_valid_iso(s: String) -> bool:
    if s.length() != 10: return false
    if s[4] != "-" or s[7] != "-": return false
    var y := s.substr(0, 4).to_int()
    var m := s.substr(5, 2).to_int()
    var d := s.substr(8, 2).to_int()
    if y < 1: return false
    if m < 1 or m > 12: return false
    if d < 1 or d > days_in_month(y, m): return false
    return true

static func days_in_month(year: int, month: int) -> int:
    match month:
        1, 3, 5, 7, 8, 10, 12: return 31
        4, 6, 9, 11: return 30
        2:
            return 29 if _is_leap(year) else 28
        _: return 0

static func _is_leap(year: int) -> bool:
    if year % 400 == 0: return true
    if year % 100 == 0: return false
    return year % 4 == 0

static func today_iso() -> String:
    var d := Time.get_date_dict_from_system()
    return "%04d-%02d-%02d" % [d.year, d.month, d.day]

# --- 渲染（UI；纯逻辑测试无需触发）---

func _render() -> void:
    if _label_month:
        _label_month.text = "%d / %02d" % [shown_year, shown_month]
    if _btn_prev:
        # 上月若整月都在 range_start 之前则禁用
        var prev_y := shown_year if shown_month > 1 else shown_year - 1
        var prev_m := shown_month - 1 if shown_month > 1 else 12
        _btn_prev.disabled = not _is_month_in_range(prev_y, prev_m)
    if _btn_next:
        var next_y := shown_year if shown_month < 12 else shown_year + 1
        var next_m := shown_month + 1 if shown_month < 12 else 1
        _btn_next.disabled = not _is_month_in_range(next_y, next_m)
    _render_grid()

func _render_grid() -> void:
    if not _grid:
        return
    for c in _grid.get_children():
        c.queue_free()
    var days := days_in_month(shown_year, shown_month)
    # 算 1 号是周几（0=Sunday）—— Zeller 或简化版
    var first_dow := _day_of_week(shown_year, shown_month, 1)
    # 前面填空格
    for i in range(first_dow):
        var blank := Control.new()
        blank.custom_minimum_size = Vector2(32, 32)
        _grid.add_child(blank)
    for d in range(1, days + 1):
        var iso := "%04d-%02d-%02d" % [shown_year, shown_month, d]
        var btn := Button.new()
        btn.text = str(d)
        btn.custom_minimum_size = Vector2(32, 32)
        btn.disabled = not _is_in_range(iso)
        if iso == selected_date:
            btn.add_theme_color_override("font_color", Color(0.31, 0.275, 0.9))
        btn.pressed.connect(func(): select_date(iso))
        _grid.add_child(btn)

# Zeller's congruence for ISO date → 0..6 where 0=Sunday
static func _day_of_week(y: int, m: int, d: int) -> int:
    var yy := y
    var mm := m
    if mm < 3:
        mm += 12
        yy -= 1
    var k := yy % 100
    var j := yy / 100
    var h := (d + (13 * (mm + 1)) / 5 + k + k / 4 + j / 4 + 5 * j) % 7
    # h: 0=Saturday, 1=Sunday, ..., 6=Friday → 转 0=Sunday
    return (h + 6) % 7
```

- [ ] **Step 3: 写 .tscn 场景**

`shared/ui/calendar.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://shared/ui/calendar.gd" id="1"]

[node name="Calendar" type="Control"]
custom_minimum_size = Vector2(320, 280)
script = ExtResource("1")

[node name="Header" type="HBoxContainer" parent="."]
anchor_right = 1.0
offset_bottom = 32.0

[node name="PrevButton" type="Button" parent="Header"]
text = "<"
custom_minimum_size = Vector2(40, 32)

[node name="MonthLabel" type="Label" parent="Header"]
text = "0000 / 00"
size_flags_horizontal = 3
horizontal_alignment = 1

[node name="NextButton" type="Button" parent="Header"]
text = ">"
custom_minimum_size = Vector2(40, 32)

[node name="Grid" type="GridContainer" parent="."]
columns = 7
offset_top = 40.0
anchor_right = 1.0
anchor_bottom = 1.0
```

- [ ] **Step 4: 跑测试，期待 PASS**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -25
```

Expected: 11 个 calendar 测试 + 之前的全绿。

- [ ] **Step 5: Commit**

```bash
git add shared/ui/calendar.gd shared/ui/calendar.tscn tests/test_calendar_widget.gd
git commit -m "feat(shared/ui): basic monthly Calendar widget with range constraint + leap-year handling"
```

---

## Task 4 — 实现 precompute_daily.gd 工具脚本

**Files:**
- Create: `tools/precompute_daily.gd`

> 这一步**只写工具脚本**；Task 5 跑它，Task 6 验数据。脚本必须可重复跑 —— 接受相同 RNG 输入永远产同一表。

- [ ] **Step 1: 写脚本骨架**

`tools/precompute_daily.gd`:

```gdscript
# tools/precompute_daily.gd
# 一次性预生成 daily_puzzles.tres。
#
# 用法：
#   godot --headless --script tools/precompute_daily.gd
#
# 输出：games/calendar_puzzle/solver/daily_puzzles.tres
#
# 算法：
#   for date in 2020-01-01..2035-12-31:
#       for diff in [easy, medium, hard, expert, insomnia]:
#           seed = deterministic_hash(date, diff)
#           combo_index = puzzle_generator.from_seed(seed) → 返回的 board key index
#           table[date][diff] = { seed, combo_index }
#
# RNG 决定：seed 用 date + diff 拼字符串 hash，确保跨机一致。
extends SceneTree

const DailyPuzzleTable = preload("res://games/calendar_puzzle/solver/daily_puzzle_table.gd")
const Difficulty = preload("res://games/calendar_puzzle/solver/difficulty.gd")
const PuzzleGenerator = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")
const Calendar = preload("res://shared/ui/calendar.gd")

const OUTPUT_PATH := "res://games/calendar_puzzle/solver/daily_puzzles.tres"

func _init() -> void:
    print("[precompute] start")
    var t0 := Time.get_ticks_msec()

    var table := DailyPuzzleTable.new()
    var all_difficulties := Difficulty.all_ids()

    var date_strs := _enumerate_dates(DailyPuzzleTable.RANGE_START, DailyPuzzleTable.RANGE_END)
    var total := date_strs.size() * all_difficulties.size()
    print("[precompute] %d dates × %d difficulties = %d entries" \
            % [date_strs.size(), all_difficulties.size(), total])

    var processed := 0
    var failures := 0

    for i in range(date_strs.size()):
        var date_str: String = date_strs[i]
        var per_diff: Dictionary = {}
        for diff in all_difficulties:
            var seed := _seed_for(date_str, diff)
            var result := _generate_one(seed, diff)
            if result.is_empty():
                failures += 1
                push_warning("[precompute] failed %s %s seed=%d" % [date_str, diff, seed])
                continue
            per_diff[diff] = result
            processed += 1
        table.entries[date_str] = per_diff

        if (i + 1) % 100 == 0:
            var dt := (Time.get_ticks_msec() - t0) / 1000.0
            var rate := (i + 1) / max(dt, 0.001)
            var eta := (date_strs.size() - i - 1) / max(rate, 0.001)
            print("[precompute] progress %d/%d (%.1f%%), %.1f date/s, ETA %.0fs" \
                    % [i + 1, date_strs.size(), 100.0 * (i + 1) / date_strs.size(), rate, eta])

    var elapsed := (Time.get_ticks_msec() - t0) / 1000.0
    print("[precompute] generated %d/%d entries (%d failures) in %.1fs" \
            % [processed, total, failures, elapsed])

    var err := ResourceSaver.save(table, OUTPUT_PATH, ResourceSaver.FLAG_COMPRESS)
    if err != OK:
        push_error("[precompute] ResourceSaver.save failed: %d" % err)
        quit(1)
        return
    print("[precompute] saved %s" % OUTPUT_PATH)
    quit(0)

# --- helpers ---

func _enumerate_dates(start_iso: String, end_iso: String) -> Array[String]:
    var out: Array[String] = []
    var y := start_iso.substr(0, 4).to_int()
    var m := start_iso.substr(5, 2).to_int()
    var d := start_iso.substr(8, 2).to_int()
    var ey := end_iso.substr(0, 4).to_int()
    var em := end_iso.substr(5, 2).to_int()
    var ed := end_iso.substr(8, 2).to_int()
    while true:
        out.append("%04d-%02d-%02d" % [y, m, d])
        if y == ey and m == em and d == ed:
            break
        d += 1
        if d > Calendar.days_in_month(y, m):
            d = 1
            m += 1
            if m > 12:
                m = 1
                y += 1
    return out

# 用 date + diff 生成确定性 seed（跨机一致）。
# String.hash() 是 Godot 内置；返回 32-bit unsigned。
func _seed_for(date_str: String, difficulty_id: String) -> int:
    return ("%s|%s" % [date_str, difficulty_id]).hash()

# 调 PuzzleGenerator（M1 已实现）；返回 { seed, combo_index } 或 {}。
# PuzzleGenerator.generate_from_seed(seed, dig_count) 见 M1 plan；
# 它内部解一次，挖洞，记录这个挖洞配置在该解的 combo 列表里的 index。
func _generate_one(seed: int, difficulty_id: String) -> Dictionary:
    var dig_count := Difficulty.dig_count_for(difficulty_id)
    if dig_count < 0:
        return {}
    var combo := PuzzleGenerator.generate_from_seed(seed, dig_count)
    if combo == null:
        return {}
    return {
        "seed": seed,
        "combo_index": int(combo.combo_index),
    }
```

> **依赖说明**：本脚本调 `PuzzleGenerator.generate_from_seed(seed, dig_count)`，是 **M1 plan** 已经实现的 API。如果 M1 实际 API 名不同（例如 `from_seed`），同步改这里 + 同步改 Task 7 select_scene 调用即可，方法签名 `(seed: int, dig_count: int) -> Object|null` 不变。

- [ ] **Step 2: 静态语法校验**

```bash
godot --headless --check-only --script tools/precompute_daily.gd 2>&1
```

Expected: 无 error。

- [ ] **Step 3: 跑短测（只跑 5 天作为 smoke）**

临时把脚本里 `_enumerate_dates(DailyPuzzleTable.RANGE_START, DailyPuzzleTable.RANGE_END)` 改成 `_enumerate_dates("2020-01-01", "2020-01-05")`，跑：

```bash
godot --headless --script tools/precompute_daily.gd 2>&1 | tail -20
```

Expected: 看到 `[precompute] generated 25/25 entries (0 failures) in <X>s`，输出文件存在：

```bash
ls -lh games/calendar_puzzle/solver/daily_puzzles.tres
```

Expected: 文件存在，size > 0。

**改回去**：把 `_enumerate_dates(...)` 恢复成 RANGE_START / RANGE_END 后再 commit。

- [ ] **Step 4: Commit**

```bash
git add tools/precompute_daily.gd
git commit -m "feat(tools): precompute_daily.gd — generate daily_puzzles.tres for 2020-2035 × 5 difficulties"
```

---

## Task 5 — 跑全量 precompute 生成 daily_puzzles.tres

**Files:**
- Create: `games/calendar_puzzle/solver/daily_puzzles.tres`（脚本产出）

> 这一步是**长任务**，可能跑 1-3 小时（spec 估算 < 24h；M1 benchmark 应已给出精确预算）。建议放后台或夜里跑。

- [ ] **Step 1: 备份当前 working tree**

```bash
git status   # 必须干净
```

如果不干净先 commit / stash。

- [ ] **Step 2: 跑全量预生成**

```bash
cd ~/mygit/calendar-puzzle-godot
time godot --headless --script tools/precompute_daily.gd 2>&1 | tee /tmp/precompute_daily.log
```

> 期望日志里看到 progress 每 100 天打一行，最后 `generated 29000/29000 entries (0 failures) in <X>s` + `saved res://games/calendar_puzzle/solver/daily_puzzles.tres`。
> 如果 failures > 0：先 grep 失败的 (date, diff)，看是哪几个 seed 解不出；通常是 generator 边界 bug，需要回头修 M1 实现（生成器对某些 seed 死循环则要加超时）。

- [ ] **Step 3: 校验输出**

```bash
ls -lh games/calendar_puzzle/solver/daily_puzzles.tres
```

Expected: 文件存在，size 在 200KB - 2MB 之间。若 > 2MB review 序列化（考虑改 PackedByteArray + 自定义编码）。

- [ ] **Step 4: 写一个 ad-hoc 验证脚本（不入库；只确认数据可读）**

```bash
cat > /tmp/verify_table.gd <<'EOF'
extends SceneTree

const Difficulty = preload("res://games/calendar_puzzle/solver/difficulty.gd")

func _init():
    var t = load("res://games/calendar_puzzle/solver/daily_puzzles.tres")
    if t == null:
        push_error("table failed to load")
        quit(1)
        return
    print("size = %d dates" % t.size())
    print("range = [%s, %s]" % [t.all_dates()[0], t.all_dates()[-1]])
    # 抽查 5 个随机日期
    var samples = ["2020-01-01", "2025-06-15", "2026-05-26", "2030-12-31", "2035-12-31"]
    for s in samples:
        for d in Difficulty.all_ids():
            var entry = t.lookup(s, d)
            assert(not entry.is_empty(), "missing %s %s" % [s, d])
            print("  %s %s -> seed=%d combo=%d" % [s, d, entry.seed, entry.combo_index])
    quit(0)
EOF
godot --headless --script /tmp/verify_table.gd 2>&1 | tail -30
rm /tmp/verify_table.gd
```

Expected: 看到 5 × 5 = 25 行 `seed=... combo=...` 输出，无 error。

- [ ] **Step 5: 跑测试套（确认表加载不影响既有测试）**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected: 全绿。

- [ ] **Step 6: Commit 大文件**

```bash
git add games/calendar_puzzle/solver/daily_puzzles.tres
git commit -m "data(solver): precomputed daily_puzzles.tres (5800 dates × 5 difficulties)"
```

> **如果 daily_puzzles.tres > 5MB**：考虑用 git LFS。M0 时已经处理过 GodotSteam 二进制问题，同样思路。

---

## Task 6 — 实现 select_scene（难度 + 日历 + 今日题）

**Files:**
- Create: `games/calendar_puzzle/scenes/select_scene.gd`
- Create: `games/calendar_puzzle/scenes/select_scene.tscn`
- Test: `tests/test_select_scene.gd`

- [ ] **Step 1: 写 failing test（行为先行）**

`tests/test_select_scene.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const SelectScene = preload("res://games/calendar_puzzle/scenes/select_scene.gd")
const Difficulty = preload("res://games/calendar_puzzle/solver/difficulty.gd")

func test_default_state_today_and_easy():
    var s := SelectScene.new()
    s._test_init_without_ui()
    assert_eq(s.selected_difficulty, Difficulty.EASY)
    # 默认日期 = OS 当前
    assert_eq(s.selected_date.length(), 10)

func test_select_difficulty_updates_field():
    var s := SelectScene.new()
    s._test_init_without_ui()
    s.set_difficulty(Difficulty.HARD)
    assert_eq(s.selected_difficulty, Difficulty.HARD)

func test_set_invalid_difficulty_rejected():
    var s := SelectScene.new()
    s._test_init_without_ui()
    s.set_difficulty(Difficulty.HARD)
    s.set_difficulty("bogus")
    assert_eq(s.selected_difficulty, Difficulty.HARD)  # 不变

func test_set_date_in_range():
    var s := SelectScene.new()
    s._test_init_without_ui()
    var ok := s.set_date("2026-05-15")
    assert_true(ok)
    assert_eq(s.selected_date, "2026-05-15")

func test_set_date_out_of_range_rejected():
    var s := SelectScene.new()
    s._test_init_without_ui()
    s.set_date("2026-05-15")
    assert_false(s.set_date("2019-01-01"))
    assert_eq(s.selected_date, "2026-05-15")

func test_jump_to_today():
    var s := SelectScene.new()
    s._test_init_without_ui()
    s.set_date("2026-05-15")
    s.jump_to_today()
    var today := Time.get_date_dict_from_system()
    var iso := "%04d-%02d-%02d" % [today.year, today.month, today.day]
    assert_eq(s.selected_date, iso)

func test_resolve_puzzle_returns_seed_and_combo():
    var s := SelectScene.new()
    s._test_init_without_ui_with_fake_table()
    s.set_date("2020-01-01")
    s.set_difficulty(Difficulty.EASY)
    var puzzle := s.resolve_puzzle()
    assert_false(puzzle.is_empty())
    assert_true(puzzle.has("seed"))
    assert_true(puzzle.has("combo_index"))
    assert_true(puzzle.has("difficulty"))
    assert_eq(puzzle.difficulty, Difficulty.EASY)
    assert_eq(puzzle.date, "2020-01-01")
```

- [ ] **Step 2: 写 select_scene.gd**

`games/calendar_puzzle/scenes/select_scene.gd`:

```gdscript
# games/calendar_puzzle/scenes/select_scene.gd
# 选题界面：5 个难度按钮 + Calendar 月历 + "今日"快捷按钮 + "开始"按钮。
#
# 输入：GameDeps（boot 注入，用于发起 play_scene 切换、读 i18n 翻译）
# 输出：选定 {date, difficulty, seed, combo_index} → emit 信号给 boot
extends Control

signal puzzle_selected(payload: Dictionary)
signal back_pressed()

const DailyPuzzleTable = preload("res://games/calendar_puzzle/solver/daily_puzzle_table.gd")
const Difficulty = preload("res://games/calendar_puzzle/solver/difficulty.gd")
const Calendar = preload("res://shared/ui/calendar.gd")

const TABLE_PATH := "res://games/calendar_puzzle/solver/daily_puzzles.tres"

var selected_date: String = ""
var selected_difficulty: String = Difficulty.EASY

# DI：实际产线由 _ready() 加载真实表；测试用 _test_init_without_ui_with_fake_table() 注入 fake
var _table: DailyPuzzleTable = null

# UI 节点
@onready var _calendar: Calendar = get_node_or_null("Layout/CalendarPanel/Calendar")
@onready var _date_label: Label = get_node_or_null("Layout/Header/DateLabel")
@onready var _btn_today: Button = get_node_or_null("Layout/Header/TodayButton")
@onready var _diff_buttons: VBoxContainer = get_node_or_null("Layout/RightPanel/DifficultyButtons")
@onready var _btn_start: Button = get_node_or_null("Layout/Footer/StartButton")
@onready var _btn_back: Button = get_node_or_null("Layout/Footer/BackButton")

func _ready() -> void:
    # 默认日期 = 今天
    jump_to_today()
    _table = load(TABLE_PATH) as DailyPuzzleTable
    if _table == null:
        push_error("[select_scene] failed to load daily_puzzles.tres")
    _wire_ui()
    _refresh_ui()

# --- 公共 API ---

func set_difficulty(difficulty_id: String) -> void:
    if not Difficulty.is_valid(difficulty_id):
        return
    selected_difficulty = difficulty_id
    _refresh_ui()

func set_date(date_iso: String) -> bool:
    if date_iso < DailyPuzzleTable.RANGE_START or date_iso > DailyPuzzleTable.RANGE_END:
        return false
    if not Calendar._is_valid_iso(date_iso):
        return false
    selected_date = date_iso
    _refresh_ui()
    return true

func jump_to_today() -> void:
    var iso := Calendar.today_iso()
    # 若今天超出范围（spec 范围到 2035-12-31），回落到范围末端
    if iso > DailyPuzzleTable.RANGE_END:
        iso = DailyPuzzleTable.RANGE_END
    if iso < DailyPuzzleTable.RANGE_START:
        iso = DailyPuzzleTable.RANGE_START
    selected_date = iso
    _refresh_ui()

# 把当前选择转为可送 play_scene 的 payload。
func resolve_puzzle() -> Dictionary:
    if _table == null:
        return {}
    var entry := _table.lookup(selected_date, selected_difficulty)
    if entry.is_empty():
        return {}
    return {
        "date": selected_date,
        "difficulty": selected_difficulty,
        "seed": entry.seed,
        "combo_index": entry.combo_index,
    }

# --- UI 接线（测试不走）---

func _wire_ui() -> void:
    if _calendar:
        _calendar.range_start = DailyPuzzleTable.RANGE_START
        _calendar.range_end = DailyPuzzleTable.RANGE_END
        _calendar.date_selected.connect(_on_calendar_date_selected)
    if _btn_today:
        _btn_today.pressed.connect(_on_today_pressed)
    if _btn_start:
        _btn_start.pressed.connect(_on_start_pressed)
    if _btn_back:
        _btn_back.pressed.connect(_on_back_pressed)
    if _diff_buttons:
        for difficulty_id in Difficulty.all_ids():
            var btn := Button.new()
            btn.text = difficulty_id  # M7 替换为 tr(Difficulty.display_name_key(difficulty_id))
            btn.pressed.connect(func(): set_difficulty(difficulty_id))
            _diff_buttons.add_child(btn)

func _refresh_ui() -> void:
    if _date_label:
        _date_label.text = selected_date
    if _btn_start:
        # 表里没数据 → 不能开始
        _btn_start.disabled = _table == null or _table.lookup(selected_date, selected_difficulty).is_empty()

func _on_calendar_date_selected(date_iso: String) -> void:
    set_date(date_iso)

func _on_today_pressed() -> void:
    jump_to_today()

func _on_start_pressed() -> void:
    var payload := resolve_puzzle()
    if payload.is_empty():
        push_warning("[select_scene] no puzzle for %s %s" % [selected_date, selected_difficulty])
        return
    puzzle_selected.emit(payload)

func _on_back_pressed() -> void:
    back_pressed.emit()

# --- 仅测试用的初始化路径 ---

func _test_init_without_ui() -> void:
    # 不加载 .tres；测试不依赖产线数据
    jump_to_today()

func _test_init_without_ui_with_fake_table() -> void:
    _test_init_without_ui()
    var t := DailyPuzzleTable.new()
    t.entries = {
        "2020-01-01": {
            "easy": {"seed": 100, "combo_index": 0},
            "medium": {"seed": 200, "combo_index": 1},
            "hard": {"seed": 300, "combo_index": 2},
            "expert": {"seed": 400, "combo_index": 3},
            "insomnia": {"seed": 500, "combo_index": 4},
        },
    }
    _table = t
```

- [ ] **Step 3: 写 .tscn**

`games/calendar_puzzle/scenes/select_scene.tscn`:

```
[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/scenes/select_scene.gd" id="1"]
[ext_resource type="PackedScene" path="res://shared/ui/calendar.tscn" id="2"]

[node name="SelectScene" type="Control"]
anchor_right = 1.0
anchor_bottom = 1.0
script = ExtResource("1")

[node name="Layout" type="VBoxContainer" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
offset_left = 24.0
offset_top = 24.0
offset_right = -24.0
offset_bottom = -24.0

[node name="Header" type="HBoxContainer" parent="Layout"]

[node name="DateLabel" type="Label" parent="Layout/Header"]
text = "0000-00-00"
size_flags_horizontal = 3
add_theme_font_size_override = 24

[node name="TodayButton" type="Button" parent="Layout/Header"]
text = "Today"

[node name="Body" type="HBoxContainer" parent="Layout"]
size_flags_vertical = 3

[node name="CalendarPanel" type="PanelContainer" parent="Layout/Body"]
size_flags_horizontal = 3

[node name="Calendar" parent="Layout/Body/CalendarPanel" instance=ExtResource("2")]

[node name="RightPanel" type="PanelContainer" parent="Layout/Body"]
custom_minimum_size = Vector2(200, 0)

[node name="DifficultyButtons" type="VBoxContainer" parent="Layout/Body/RightPanel"]

[node name="Footer" type="HBoxContainer" parent="Layout"]

[node name="BackButton" type="Button" parent="Layout/Footer"]
text = "< Back"

[node name="Spacer" type="Control" parent="Layout/Footer"]
size_flags_horizontal = 3

[node name="StartButton" type="Button" parent="Layout/Footer"]
text = "Start"
```

> 注意：上面 `[node name="Layout/Body/CalendarPanel"]` 是个 PanelContainer，里面 `instance=ExtResource("2")` 把 calendar.tscn 实例化进去；select_scene.gd 通过 `get_node("Layout/CalendarPanel/Calendar")` 取。**若实际节点路径不一致**，调整 select_scene.gd 里 `@onready` 的路径或反过来调 .tscn 节点层级，让二者一致。

- [ ] **Step 4: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -25
```

Expected: select_scene 的 7 个测试 + 之前的全绿。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/scenes/select_scene.gd \
        games/calendar_puzzle/scenes/select_scene.tscn \
        tests/test_select_scene.gd
git commit -m "feat(scenes): select_scene with difficulty buttons + calendar + today shortcut"
```

---

## Task 7 — 接线：boot → select_scene → play_scene

**Files:**
- Modify: `boot/boot.gd`
- Modify: `games/calendar_puzzle/game.gd`
- Modify: `games/calendar_puzzle/scenes/play_scene.gd`（M2 已建；本 task 加 `load_puzzle(payload)` 入口）

> M2 完工时 boot 是直接 `add_child` 把 play_scene 挂上去。M3 改为先挂 select_scene；选完一个 puzzle 后切换到 play_scene 并传 payload。

- [ ] **Step 1: 给 play_scene 加 load_puzzle 入口**

打开 `games/calendar_puzzle/scenes/play_scene.gd`（M2 实现），在脚本末尾加：

```gdscript
# games/calendar_puzzle/scenes/play_scene.gd (append)

# M3 添加。boot / select_scene 切到 play_scene 后调用此方法注入题面。
# payload = { date: String, difficulty: String, seed: int, combo_index: int }
func load_puzzle(payload: Dictionary) -> void:
    assert(payload.has("seed") and payload.has("combo_index"), "play_scene.load_puzzle: missing seed/combo_index")
    var puzzle = PuzzleGenerator.generate_from_seed(payload.seed, Difficulty.dig_count_for(payload.difficulty))
    if puzzle == null:
        push_error("[play_scene] generator returned null for payload=%s" % str(payload))
        return
    # M2 已有 setup_board / setup_blocks API；这里调它们装载新题。
    setup_board(puzzle.board)
    setup_blocks(puzzle.remaining_blocks)
    _current_payload = payload
```

并在 play_scene.gd 顶部加：

```gdscript
const PuzzleGenerator = preload("res://games/calendar_puzzle/solver/puzzle_generator.gd")
const Difficulty = preload("res://games/calendar_puzzle/solver/difficulty.gd")

var _current_payload: Dictionary = {}
```

> M2 实际 setup_board / setup_blocks 方法名可能不同；按 M2 实现对齐。

- [ ] **Step 2: 改 game.gd —— start() 返回 select_scene**

`games/calendar_puzzle/game.gd`:

```gdscript
extends GameModule

const MANIFEST_PATH = "res://games/calendar_puzzle/manifest.tres"
const SELECT_SCENE = preload("res://games/calendar_puzzle/scenes/select_scene.tscn")
const PLAY_SCENE = preload("res://games/calendar_puzzle/scenes/play_scene.tscn")

var _deps: GameDeps = null
var _root: Node = null
var _current: Node = null

func get_manifest() -> GameManifest:
    return load(MANIFEST_PATH) as GameManifest

func start(deps: GameDeps) -> Node:
    assert(deps.is_complete(), "GameDeps incomplete - boot misconfigured")
    _deps = deps
    _root = Node2D.new()
    _root.name = "CalendarPuzzleRoot"
    _show_select()
    return _root

func _show_select() -> void:
    _swap_to(SELECT_SCENE.instantiate())
    _current.puzzle_selected.connect(_on_puzzle_selected)
    _current.back_pressed.connect(_on_back_to_menu)

func _show_play(payload: Dictionary) -> void:
    _swap_to(PLAY_SCENE.instantiate())
    _current.load_puzzle(payload)
    # play_scene 自己应该有"返回选题"信号；连过来
    if _current.has_signal("exit_to_select"):
        _current.exit_to_select.connect(_show_select)

func _swap_to(new_node: Node) -> void:
    if _current:
        _current.queue_free()
    _current = new_node
    _root.add_child(_current)

func _on_puzzle_selected(payload: Dictionary) -> void:
    _show_play(payload)

func _on_back_to_menu() -> void:
    # M4 把这里改为返回 main_menu
    _deps.on_exit.call()
```

- [ ] **Step 3: 验证 boot 启动**

```bash
godot --headless --quit-after 3 res://boot/boot.tscn 2>&1 | tail -20
```

Expected: 无 error；看到 `[boot] module 'calendar_puzzle' started` + 隐含 select_scene 已挂载（headless 看不到 UI 但加载链不该报错）。

- [ ] **Step 4: GUI 冒烟（手工）**

```bash
godot
```

观察：
- 启动后看到日历 + 5 个难度按钮 + Today / Back / Start
- 点 Today → 日历跳到今天高亮
- 翻月按钮可工作；翻到 2019 / 2036 应被禁
- 点任意难度 → 选中态
- 点 Start → 切到 play_scene，能看到题面（M2 玩法）
- play_scene 退出 → 回到 select_scene 而非直接退出

- [ ] **Step 5: 截图**

```bash
ls docs/m3-smoke-select-scene.png || echo "记得手工截图保存到此路径"
```

补充截图：select_scene 一张 + play_scene 一张。

```bash
git add docs/m3-smoke-select-scene.png docs/m3-smoke-play-after-select.png
```

- [ ] **Step 6: 跑全套测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
git add boot/boot.gd games/calendar_puzzle/game.gd games/calendar_puzzle/scenes/play_scene.gd docs/m3-smoke-*.png
git commit -m "feat(game): wire select_scene → play_scene with seeded puzzle payload"
```

---

## Task 8 — 全链路验收 + 难度切换 QA

**Files:**
- 无新文件；只做 QA 跑 + 写 evidence

- [ ] **Step 1: 5 难度都能跑通 checklist**

启动游戏，对每个难度跑一次：

```
[ ] easy     —— 在 select 选 easy + 任意日期 + Start → play_scene 显示 board，能拖块
[ ] medium   —— 同上
[ ] hard     —— 同上
[ ] expert   —— 同上
[ ] insomnia —— 同上（首次进入可能 loading 1s 内）
```

每次进 play 后立刻按返回，回到 select_scene 改难度再进。

- [ ] **Step 2: 日历边界 checklist**

```
[ ] 翻到 2020 年 1 月 → "<" 按钮禁用
[ ] 翻到 2035 年 12 月 → ">" 按钮禁用
[ ] 2020-01-01 可选；2019-12-31 不可选
[ ] 2035-12-31 可选；2036-01-01 不可选
[ ] 闰年 2-29 在 2020/2024/2028/2032 可见且可选
[ ] 平年 2-29 不显示（如 2021/2022/2023）
```

- [ ] **Step 3: 今日题 checklist**

```
[ ] 启动默认日期 = OS 当前日期
[ ] 离开选别的日期后点 Today 回到当天
[ ] 系统时钟改到 2036（如本机方便测试），重启游戏 → 日期回落到 2035-12-31（spec 范围保护）
```

- [ ] **Step 4: 跑全套测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tee /tmp/m3-final-tests.log
tail -5 /tmp/m3-final-tests.log
```

Expected: 看到 `<N> passed, 0 failed`。M3 新增约 23 个测试 + M0-M2 既有 → 总数应在 ~40+。

- [ ] **Step 5: Commit 测试日志**

```bash
mkdir -p docs/m3-evidence
cp /tmp/m3-final-tests.log docs/m3-evidence/all-tests-final.log
git add docs/m3-evidence/
git commit -m "test(m3): record full GUT pass log + difficulty/calendar QA evidence"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**:
- ✅ "5 难度可选" → Task 1 (Difficulty 常量) + Task 6 (select_scene 难度按钮) + Task 8 (5 难度 QA checklist)
- ✅ "当日题 + 日历选题" → Task 3 (Calendar 控件) + Task 6 (今日按钮 + 日历集成)
- ✅ "`daily_puzzles.tres` 完成" → Task 4-5 (precompute_daily.gd + 跑全量)
- ✅ "选完进 play_scene 跑通" → Task 7 (boot → select → play 接线)

**2. Placeholder scan**:
- 无 TBD / TODO 残留；所有代码块完整可粘
- 一处引用 M2 实际 API：`setup_board` / `setup_blocks`（Task 7 Step 1 备注"按 M2 实现对齐"），这是跨 milestone 依赖，已显式标注让执行者校对
- 一处引用 M1 实际 API：`PuzzleGenerator.generate_from_seed(seed, dig_count)`（Task 4 备注"如果 M1 API 名不同同步改这里"），同样显式标注

**3. Type consistency**:
- `Difficulty.dig_count_for(id: String) -> int` — Task 1 定义 + Task 4 (`_generate_one`) 调用 + Task 7 (play_scene.load_puzzle) 调用一致
- `DailyPuzzleTable.lookup(date, diff) -> Dictionary` — Task 2 定义 + Task 6 (`resolve_puzzle`) 调用 + Task 4 验证脚本调用一致
- `Calendar.today_iso() -> String` / `Calendar._is_valid_iso()` / `Calendar.days_in_month()` — Task 3 定义 + Task 6 (`select_scene.set_date`) / Task 4 (`_enumerate_dates`) 调用一致
- `puzzle_selected(payload: Dictionary)` 信号 payload 结构 — Task 6 定义（`{date, difficulty, seed, combo_index}`）+ Task 7 (`play_scene.load_puzzle`) 消费一致

**4. Ambiguity**:
- precompute 跑全量耗时不确定：scripts 加了 progress log + ETA，跑前看 100 天数据可估总时长；Task 5 注释提示后台 / 夜跑
- daily_puzzles.tres 文件大小若 > 5MB 提示用 git LFS（Task 5 Step 6 备注）
- M1 / M2 实际 API 名差异在 Task 4 / Task 7 显式标注交叉点

**5. Test depth**:
- 单元层：Difficulty 5 测、DailyPuzzleTable 7 测（含 round-trip）、Calendar 11 测、SelectScene 7 测 = 30 个新测试
- 集成层：Task 7 Step 3 headless boot 启动、Task 8 GUI 全难度 + 边界 + 今日 checklist
- 数据层：Task 5 Step 4 ad-hoc 验证脚本抽查 5 × 5 = 25 个 (date, diff) lookup

无发现要修。M3 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M3 实施时用 superpowers:subagent-driven-development。每个 Task 派一个 fresh subagent → review → 下一个 Task。

依赖图：

- Task 1 (Difficulty) 独立 — 可与 Task 2 并发
- Task 2 (DailyPuzzleTable) 独立 — 可与 Task 1 并发
- Task 3 (Calendar 控件) 独立 — 可与 Task 1/2 并发
- Task 4 (precompute 脚本) 依赖 Task 1 + Task 2 + Task 3 (`Calendar.days_in_month`)
- Task 5 (跑全量) 依赖 Task 4 — **长任务**，建议夜里跑
- Task 6 (select_scene) 依赖 Task 1 + Task 2 + Task 3
- Task 7 (接线) 依赖 Task 6 + M2 已完成的 play_scene
- Task 8 (全链路 QA) 依赖 Task 5 + Task 7

建议并发批次：
1. **Batch A** = Task 1 + Task 2 + Task 3（3 个 subagent 同时跑）
2. **Batch B** = Task 4（依赖 A 全完）+ Task 6（依赖 A 全完）（2 个 subagent 同时）
3. **Batch C** = Task 5（独立长任务，后台跑）+ Task 7（依赖 Task 6）
4. **Batch D** = Task 8（依赖 Task 5 + Task 7）

如 M1 / M2 出现 API 名分歧（Task 4 / Task 7 的备注），执行 Task 4 / Task 7 的 subagent 必须先 `grep -rn "generate_from_seed\|setup_board" games/` 确认实际 API 后再写代码，不可盲粘。
