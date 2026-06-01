# M4 — UI 外壳 + 存档 + 设置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建主菜单（开始 / 继续 / 设置 / 退出）、设置面板（通用 / 操作 / 皮肤三标签）、真实 SaveAdapter（.tres + Steam Cloud 双写）、自动存档（5s 节流）、3 个手动存档槽（含命名 + 缩略图 + 时间戳）。M0 的 `StubSaveAdapter` 在本 milestone 被换成真实实现。

**Architecture:**
- 存档分层：`SaveAdapter` 接口（M0 定义）← `SaveAdapterTres`（M4 新实现，把 Resource 序列化为 `user://saves/<key>.tres`）。Steam Cloud 由 Steamworks 配置 `user://saves/*` 自动同步，**代码层零额外工作**。
- 数据层：`ProfileResource`（settings + progress + tutorial_done + stats）、`SlotResource`（snapshot + name + thumbnail + saved_at）、`GameSnapshot`（puzzle 状态 + 计时）、`SettingsResource`（音量 / 全屏 / 主题 / 语言 / 键鼠绑定 / 当前皮肤）。
- 系统层：`SlotManager`（自动存档 5s 节流 + 3 个手动槽 + 缩略图渲染）、`SkinManager`（启动扫描 `skins/*.tres` + apply 时广播 signal）。
- UI 层：`main_menu.tscn`（4 按钮）、`settings_panel.tscn`（3 标签）、`shared/ui/key_capture.gd`（按键重映射控件）。
- **M4→M9 依赖**：M4 只创建 `skins/default.tres` 空骨架让 SkinManager 有东西可加载；3 个皮肤的真实色板 / 缩略图在 M9 视觉打磨阶段填。M9 plan 必须包含"填 default.tres / pastel.tres / mono_focus.tres 色板与缩略图"task。

**Tech Stack:** Godot 4.3+ (GDScript)、GUT v9。**不**新增第三方依赖；缩略图用 SubViewport 内置 capture。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Platform integration → 存档结构；§ Game systems 设置面板 / 皮肤系统；§ Visual / Audio / i18n 皮肤系统；§ Milestones M4

**Acceptance gates (从 spec 抄):**
- 主菜单按钮"继续游戏 / 新游戏 / 设置 / 退出"四项全通
- "继续游戏"读 autosave 进 play_scene 还原（题面 + 块状态 + 计时 + 提示状态）
- 设置面板三标签全可用：通用 (音量 / 全屏 / 主题 / 语言 / 重置) / 操作 (5 个 action 重绑) / 皮肤 (3 缩略图选择 + live preview)
- 3 个手动槽：保存 / 命名 / 缩略图（64×64 PNG） / 时间戳；可读回还原
- 自动存档每 5s 最多一次；scene_tree quit 时强制 flush
- KeyCapture 控件：点击 → 提示"按键" → 捕获 InputEventKey → 冲突检测 → 保存到 SettingsResource.kbm_bindings
- 皮肤切换实时生效（play_scene 收 signal 重渲染）
- GUT 全套绿（M0-M3 既有 + 本 milestone 新增 ~40+ 用例）

---

## File Structure

本 milestone 创建 / 修改的所有文件（新仓库 `~/mygit/calendar-puzzle-godot/`）：

```
calendar-puzzle-godot/
├── boot/
│   ├── boot.gd                                # MODIFY — 改用 SaveAdapterTres + 加 main_menu 路由
│   ├── main_menu/
│   │   ├── main_menu.tscn                     # NEW
│   │   └── main_menu.gd                       # NEW
│   ├── settings/
│   │   ├── settings_panel.tscn                # NEW
│   │   ├── settings_panel.gd                  # NEW
│   │   ├── tab_general.tscn                   # NEW
│   │   ├── tab_general.gd                     # NEW
│   │   ├── tab_controls.tscn                  # NEW
│   │   ├── tab_controls.gd                    # NEW
│   │   ├── tab_skins.tscn                     # NEW
│   │   └── tab_skins.gd                       # NEW
│   └── platform/
│       └── save_adapter_tres.gd               # NEW — 真实 .tres 持久化（替换 stub）
├── shared/
│   ├── save/
│   │   ├── settings_resource.gd               # NEW
│   │   ├── progress_resource.gd               # NEW
│   │   ├── stats_resource.gd                  # NEW
│   │   ├── profile_resource.gd                # NEW
│   │   ├── game_snapshot.gd                   # NEW
│   │   └── slot_resource.gd                   # NEW
│   └── ui/
│       ├── key_capture.gd                     # NEW
│       └── key_capture.tscn                   # NEW
├── games/
│   └── calendar_puzzle/
│       ├── systems/
│       │   ├── slot_manager.gd                # NEW — 自动 + 手动存档管理
│       │   └── skin_manager.gd                # NEW
│       ├── skins/
│       │   ├── skin_resource.gd               # NEW — SkinResource 类
│       │   ├── default.tres                   # NEW — 占位骨架（M9 填色板）
│       │   ├── pastel.tres                    # NEW — 占位骨架（M9 填）
│       │   └── mono_focus.tres                # NEW — 占位骨架（M9 填）
│       ├── scenes/
│       │   └── play_scene.gd                  # MODIFY — 接 SlotManager + SkinManager 信号
│       └── game.gd                            # MODIFY — 暴露 capture_thumbnail() 给 SlotManager
└── tests/
    ├── test_settings_resource.gd              # NEW
    ├── test_profile_resource.gd               # NEW
    ├── test_slot_resource.gd                  # NEW
    ├── test_save_adapter_tres.gd              # NEW
    ├── test_slot_manager.gd                   # NEW
    ├── test_skin_manager.gd                   # NEW
    ├── test_key_capture.gd                    # NEW
    └── test_main_menu.gd                      # NEW
```

---

## Task 1 — Resource 类定义（settings / progress / stats / profile）

**Files:**
- Create: `shared/save/settings_resource.gd`
- Create: `shared/save/progress_resource.gd`
- Create: `shared/save/stats_resource.gd`
- Create: `shared/save/profile_resource.gd`
- Test: `tests/test_settings_resource.gd`
- Test: `tests/test_profile_resource.gd`

- [ ] **Step 1: 写 SettingsResource**

`shared/save/settings_resource.gd`:

```gdscript
# shared/save/settings_resource.gd
# 玩家设置。持久化在 profile.tres.settings 字段。
class_name SettingsResource extends Resource

# --- 音频 ---
@export var bgm_volume: float = 0.30        # 0..1；spec § 音频 默认 BGM 30%
@export var sfx_volume: float = 0.70        # 0..1；spec 默认 SFX 70%
@export var master_volume: float = 1.0      # 0..1

# --- 显示 ---
@export var fullscreen: bool = false        # 启动时是否全屏
@export var theme: String = "system"        # "light" | "dark" | "system"
@export var locale: String = ""             # "" = 跟随 OS；"zh_CN" / "zh_TW" / "en"

# --- 操作 ---
# 5 个 action → 序列化后的 key 名（如 "R" / "F" / "H" / "Ctrl+Z" / "Escape"）
# Dictionary 在 Godot Resource 中不保留泛型，但内部约定 [String, String]
@export var kbm_bindings: Dictionary = {
    "rotate": "R",
    "mirror": "F",
    "hint":   "H",
    "undo":   "Ctrl+Z",
    "menu":   "Escape",
}

# --- 皮肤 ---
@export var current_skin_id: String = "default"

# 默认动作绑定（重置按钮调用）
const DEFAULT_BINDINGS := {
    "rotate": "R",
    "mirror": "F",
    "hint":   "H",
    "undo":   "Ctrl+Z",
    "menu":   "Escape",
}

func reset_to_defaults() -> void:
    bgm_volume = 0.30
    sfx_volume = 0.70
    master_volume = 1.0
    fullscreen = false
    theme = "system"
    locale = ""
    kbm_bindings = DEFAULT_BINDINGS.duplicate(true)
    current_skin_id = "default"

func reset_bindings_only() -> void:
    kbm_bindings = DEFAULT_BINDINGS.duplicate(true)

# 检测某个 action 是否被绑到了 key（用于冲突检测）
func find_action_for_key(key_str: String) -> String:
    for action in kbm_bindings:
        if kbm_bindings[action] == key_str:
            return action
    return ""
```

- [ ] **Step 2: 写 SettingsResource test**

`tests/test_settings_resource.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const SettingsResource = preload("res://shared/save/settings_resource.gd")

func test_defaults_match_spec():
    var s := SettingsResource.new()
    assert_almost_eq(s.bgm_volume, 0.30, 0.001)
    assert_almost_eq(s.sfx_volume, 0.70, 0.001)
    assert_almost_eq(s.master_volume, 1.0, 0.001)
    assert_false(s.fullscreen)
    assert_eq(s.theme, "system")
    assert_eq(s.locale, "")
    assert_eq(s.current_skin_id, "default")

func test_default_kbm_bindings():
    var s := SettingsResource.new()
    assert_eq(s.kbm_bindings["rotate"], "R")
    assert_eq(s.kbm_bindings["mirror"], "F")
    assert_eq(s.kbm_bindings["hint"], "H")
    assert_eq(s.kbm_bindings["undo"], "Ctrl+Z")
    assert_eq(s.kbm_bindings["menu"], "Escape")

func test_reset_to_defaults_after_mutation():
    var s := SettingsResource.new()
    s.bgm_volume = 0.99
    s.theme = "dark"
    s.kbm_bindings["rotate"] = "Q"
    s.current_skin_id = "pastel"
    s.reset_to_defaults()
    assert_almost_eq(s.bgm_volume, 0.30, 0.001)
    assert_eq(s.theme, "system")
    assert_eq(s.kbm_bindings["rotate"], "R")
    assert_eq(s.current_skin_id, "default")

func test_reset_bindings_only_preserves_other_fields():
    var s := SettingsResource.new()
    s.bgm_volume = 0.5
    s.kbm_bindings["rotate"] = "Q"
    s.reset_bindings_only()
    assert_almost_eq(s.bgm_volume, 0.5, 0.001)  # 不动
    assert_eq(s.kbm_bindings["rotate"], "R")    # 还原

func test_find_action_for_key():
    var s := SettingsResource.new()
    assert_eq(s.find_action_for_key("R"), "rotate")
    assert_eq(s.find_action_for_key("Ctrl+Z"), "undo")
    assert_eq(s.find_action_for_key("X"), "")
```

- [ ] **Step 3: 写 ProgressResource**

`shared/save/progress_resource.gd`:

```gdscript
# shared/save/progress_resource.gd
# 玩家通关进度：PB / 已通关 combo 集合 / 失眠唯一解集合。
# 翻译自微信小游戏 progress.js 的三个字典。
class_name ProgressResource extends Resource

# best_times["YYYY-MM-DD:difficulty"] = seconds (int)
@export var best_times: Dictionary = {}

# won_combos["YYYY-MM-DD:difficulty"] = { combo_index_str: true, ... }
@export var won_combos: Dictionary = {}

# insomnia_unique["YYYY-MM-DD"] = [board_key_str, board_key_str, ...]
@export var insomnia_unique: Dictionary = {}

func _bucket_key(date_str: String, difficulty: String) -> String:
    return "%s:%s" % [date_str, difficulty]

# --- best_times ---

func get_best_time(date_str: String, difficulty: String) -> int:
    var k := _bucket_key(date_str, difficulty)
    return int(best_times.get(k, -1))

# 返回 { is_new: bool, prev: int (or -1), current: int }
func record_time(date_str: String, difficulty: String, seconds: int) -> Dictionary:
    var k := _bucket_key(date_str, difficulty)
    var prev := int(best_times.get(k, -1))
    var is_new := prev < 0 or seconds < prev
    if is_new:
        best_times[k] = seconds
    return {"is_new": is_new, "prev": prev, "current": seconds}

# --- won_combos ---

func mark_won_combo(date_str: String, difficulty: String, combo_index: int) -> void:
    var k := _bucket_key(date_str, difficulty)
    var bucket: Dictionary = won_combos.get(k, {})
    bucket[str(combo_index)] = true
    won_combos[k] = bucket

func has_won_combo(date_str: String, difficulty: String, combo_index: int) -> bool:
    var k := _bucket_key(date_str, difficulty)
    var bucket: Dictionary = won_combos.get(k, {})
    return bucket.get(str(combo_index), false)

# --- insomnia_unique ---

# 返回 { is_new: bool, count: int }
func mark_insomnia_unique(date_str: String, board_key: String) -> Dictionary:
    var arr: Array = insomnia_unique.get(date_str, [])
    if arr.has(board_key):
        return {"is_new": false, "count": arr.size()}
    arr.append(board_key)
    insomnia_unique[date_str] = arr
    return {"is_new": true, "count": arr.size()}

func get_insomnia_unique_count(date_str: String) -> int:
    var arr: Array = insomnia_unique.get(date_str, [])
    return arr.size()
```

- [ ] **Step 4: 写 StatsResource + ProfileResource**

`shared/save/stats_resource.gd`:

```gdscript
# shared/save/stats_resource.gd
class_name StatsResource extends Resource

@export var total_play_seconds: int = 0       # 累计游戏秒数
@export var total_puzzles_won: int = 0        # 累计通关题数
@export var first_launch_unix: int = 0        # 首次启动时间（unix ts）

func record_session(seconds: int) -> void:
    total_play_seconds += seconds

func record_win() -> void:
    total_puzzles_won += 1
```

`shared/save/profile_resource.gd`:

```gdscript
# shared/save/profile_resource.gd
# 顶层 profile 容器。存档为 user://saves/profile.tres。
class_name ProfileResource extends Resource

const SettingsResource = preload("res://shared/save/settings_resource.gd")
const ProgressResource = preload("res://shared/save/progress_resource.gd")
const StatsResource = preload("res://shared/save/stats_resource.gd")

@export var settings: SettingsResource
@export var progress: ProgressResource
@export var stats: StatsResource
@export var tutorial_done: bool = false

func _init() -> void:
    if settings == null:
        settings = SettingsResource.new()
    if progress == null:
        progress = ProgressResource.new()
    if stats == null:
        stats = StatsResource.new()
        stats.first_launch_unix = int(Time.get_unix_time_from_system())
```

- [ ] **Step 5: 写 ProfileResource test**

`tests/test_profile_resource.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const ProfileResource = preload("res://shared/save/profile_resource.gd")
const SettingsResource = preload("res://shared/save/settings_resource.gd")
const ProgressResource = preload("res://shared/save/progress_resource.gd")

func test_default_init_populates_sub_resources():
    var p := ProfileResource.new()
    assert_not_null(p.settings)
    assert_not_null(p.progress)
    assert_not_null(p.stats)
    assert_false(p.tutorial_done)
    assert_true(p.stats.first_launch_unix > 0)

func test_progress_record_time_updates_pb():
    var p := ProfileResource.new()
    var r1 := p.progress.record_time("2026-05-26", "easy", 120)
    assert_true(r1.is_new)
    assert_eq(r1.prev, -1)
    var r2 := p.progress.record_time("2026-05-26", "easy", 90)
    assert_true(r2.is_new)
    assert_eq(r2.prev, 120)
    var r3 := p.progress.record_time("2026-05-26", "easy", 200)
    assert_false(r3.is_new)
    assert_eq(p.progress.get_best_time("2026-05-26", "easy"), 90)

func test_progress_mark_won_combo():
    var p := ProfileResource.new()
    assert_false(p.progress.has_won_combo("2026-05-26", "easy", 5))
    p.progress.mark_won_combo("2026-05-26", "easy", 5)
    assert_true(p.progress.has_won_combo("2026-05-26", "easy", 5))
    assert_false(p.progress.has_won_combo("2026-05-26", "easy", 6))

func test_insomnia_unique_dedup():
    var p := ProfileResource.new()
    var r1 := p.progress.mark_insomnia_unique("2026-05-26", "boardKeyA")
    assert_true(r1.is_new)
    assert_eq(r1.count, 1)
    var r2 := p.progress.mark_insomnia_unique("2026-05-26", "boardKeyA")
    assert_false(r2.is_new)
    assert_eq(r2.count, 1)
    var r3 := p.progress.mark_insomnia_unique("2026-05-26", "boardKeyB")
    assert_true(r3.is_new)
    assert_eq(r3.count, 2)
```

- [ ] **Step 6: 跑测试**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: settings 测试 5 个 + profile 测试 4 个全绿。

- [ ] **Step 7: Commit**

```bash
git add shared/save/settings_resource.gd shared/save/progress_resource.gd \
        shared/save/stats_resource.gd shared/save/profile_resource.gd \
        tests/test_settings_resource.gd tests/test_profile_resource.gd
git commit -m "feat(save): Resource classes for settings/progress/stats/profile with tests"
```

---

## Task 2 — GameSnapshot + SlotResource

**Files:**
- Create: `shared/save/game_snapshot.gd`
- Create: `shared/save/slot_resource.gd`
- Test: `tests/test_slot_resource.gd`

- [ ] **Step 1: 写 GameSnapshot**

`shared/save/game_snapshot.gd`:

```gdscript
# shared/save/game_snapshot.gd
# 单局游戏的可恢复快照。比 PuzzlePayload 多了"已放置块 + 计时 + 提示状态"。
class_name GameSnapshot extends Resource

# 题面来源（select_scene 拿到的 puzzle payload）
@export var date: String = ""                 # "YYYY-MM-DD"
@export var difficulty: String = "easy"
@export var seed: int = 0
@export var combo_index: int = 0

# 当前局状态
# placed_blocks = [{ block_id: String, x: int, y: int, rotation: int, mirror: bool }, ...]
@export var placed_blocks: Array = []

# 计时（秒）
@export var elapsed_seconds: int = 0

# 提示状态：每题独立计数（weak / medium / strong 已用次数）
@export var weak_hint_used: int = 0
@export var medium_hint_used: int = 0
@export var strong_hint_used: int = 0

# 时间戳
@export var saved_at: int = 0                 # unix ts

func is_empty() -> bool:
    return date == "" and placed_blocks.is_empty()
```

- [ ] **Step 2: 写 SlotResource**

`shared/save/slot_resource.gd`:

```gdscript
# shared/save/slot_resource.gd
# 单个存档槽（自动槽 or 手动槽）的容器。
class_name SlotResource extends Resource

const GameSnapshot = preload("res://shared/save/game_snapshot.gd")

@export var slot_id: String = ""              # "autosave" / "slot_0" / "slot_1" / "slot_2"
@export var slot_name: String = ""            # 玩家命名（仅手动槽）
@export var saved_at: int = 0                 # unix ts
@export var snapshot: GameSnapshot
@export var thumbnail: Image                  # 64×64 PNG，存 Image（Godot 内置序列化）

func _init() -> void:
    if snapshot == null:
        snapshot = GameSnapshot.new()

func is_empty() -> bool:
    return saved_at == 0 or snapshot == null or snapshot.is_empty()
```

- [ ] **Step 3: 写 SlotResource test**

`tests/test_slot_resource.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const SlotResource = preload("res://shared/save/slot_resource.gd")
const GameSnapshot = preload("res://shared/save/game_snapshot.gd")

func test_default_is_empty():
    var s := SlotResource.new()
    assert_true(s.is_empty())

func test_filled_snapshot_not_empty():
    var s := SlotResource.new()
    s.slot_id = "slot_0"
    s.slot_name = "我的存档"
    s.saved_at = 1700000000
    s.snapshot.date = "2026-05-26"
    s.snapshot.difficulty = "hard"
    s.snapshot.seed = 12345
    s.snapshot.placed_blocks = [{"block_id": "I", "x": 0, "y": 0, "rotation": 0, "mirror": false}]
    s.snapshot.elapsed_seconds = 90
    assert_false(s.is_empty())

func test_save_and_load_round_trip(tmp_path = "user://test_slot_round_trip.tres"):
    var orig := SlotResource.new()
    orig.slot_id = "slot_1"
    orig.slot_name = "round-trip-test"
    orig.saved_at = 1700000123
    orig.snapshot.date = "2026-05-26"
    orig.snapshot.difficulty = "expert"
    orig.snapshot.seed = 99999
    orig.snapshot.elapsed_seconds = 245
    orig.snapshot.weak_hint_used = 2
    # 假 64×64 缩略图
    var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
    img.fill(Color(0.1, 0.2, 0.3))
    orig.thumbnail = img

    var err := ResourceSaver.save(orig, tmp_path)
    assert_eq(err, OK)

    var loaded := load(tmp_path) as SlotResource
    assert_not_null(loaded)
    assert_eq(loaded.slot_id, "slot_1")
    assert_eq(loaded.slot_name, "round-trip-test")
    assert_eq(loaded.saved_at, 1700000123)
    assert_eq(loaded.snapshot.difficulty, "expert")
    assert_eq(loaded.snapshot.seed, 99999)
    assert_eq(loaded.snapshot.elapsed_seconds, 245)
    assert_eq(loaded.snapshot.weak_hint_used, 2)
    assert_not_null(loaded.thumbnail)
    assert_eq(loaded.thumbnail.get_width(), 64)
    assert_eq(loaded.thumbnail.get_height(), 64)

    DirAccess.remove_absolute(ProjectSettings.globalize_path(tmp_path))
```

- [ ] **Step 4: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -15
```

Expected: SlotResource 3 个测试 + 之前的全绿。

- [ ] **Step 5: Commit**

```bash
git add shared/save/game_snapshot.gd shared/save/slot_resource.gd tests/test_slot_resource.gd
git commit -m "feat(save): GameSnapshot + SlotResource with thumbnail support + round-trip test"
```

---

## Task 3 — 实现 SaveAdapterTres（真实 .tres 持久化）

**Files:**
- Create: `boot/platform/save_adapter_tres.gd`
- Test: `tests/test_save_adapter_tres.gd`

> M0 的 `StubSaveAdapter` 只往内存字典写。本 task 实现真实版本：每个 key → `user://saves/<key>.tres`。`user://saves/` 由 Steamworks 配置成 Cloud Sync 目录，零额外代码即可双写。

- [ ] **Step 1: 写 failing test**

`tests/test_save_adapter_tres.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const SaveAdapterTres = preload("res://boot/platform/save_adapter_tres.gd")
const SlotResource = preload("res://shared/save/slot_resource.gd")
const ProfileResource = preload("res://shared/save/profile_resource.gd")

# 测试目录隔离：用 user://test_saves/ 子目录，每个测试 setup/teardown 清理。
const TEST_ROOT := "user://test_saves/"

func before_each():
    _cleanup_dir(TEST_ROOT)
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(TEST_ROOT))

func after_each():
    _cleanup_dir(TEST_ROOT)

func _cleanup_dir(path: String) -> void:
    var d := DirAccess.open(path)
    if d == null:
        return
    d.list_dir_begin()
    while true:
        var name := d.get_next()
        if name == "":
            break
        if name in [".", ".."]:
            continue
        DirAccess.remove_absolute(ProjectSettings.globalize_path(path + name))
    d.list_dir_end()

func _make_adapter() -> SaveAdapterTres:
    var a := SaveAdapterTres.new()
    a.root_dir = TEST_ROOT
    return a

func test_write_and_read_round_trip():
    var a := _make_adapter()
    var slot := SlotResource.new()
    slot.slot_id = "slot_0"
    slot.slot_name = "test"
    slot.saved_at = 1700000000
    slot.snapshot.date = "2026-05-26"
    slot.snapshot.seed = 42

    var err := a.write("slot_0", slot)
    assert_eq(err, OK)

    var loaded := a.read("slot_0") as SlotResource
    assert_not_null(loaded)
    assert_eq(loaded.slot_name, "test")
    assert_eq(loaded.snapshot.seed, 42)

func test_read_unknown_key_returns_null():
    var a := _make_adapter()
    assert_null(a.read("does_not_exist"))

func test_write_thumbnail_preserved_after_round_trip():
    var a := _make_adapter()
    var slot := SlotResource.new()
    slot.slot_id = "slot_0"
    slot.saved_at = 1700000000
    slot.snapshot.date = "2026-05-26"
    var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
    img.fill(Color(0.5, 0.2, 0.8))
    slot.thumbnail = img
    a.write("slot_0", slot)

    var loaded := a.read("slot_0") as SlotResource
    assert_not_null(loaded.thumbnail)
    assert_eq(loaded.thumbnail.get_width(), 64)
    var c: Color = loaded.thumbnail.get_pixel(32, 32)
    assert_almost_eq(c.r, 0.5, 0.02)
    assert_almost_eq(c.g, 0.2, 0.02)
    assert_almost_eq(c.b, 0.8, 0.02)

func test_delete_removes_file():
    var a := _make_adapter()
    var slot := SlotResource.new()
    slot.slot_id = "slot_0"
    slot.saved_at = 1
    slot.snapshot.date = "2026-05-26"
    a.write("slot_0", slot)
    assert_not_null(a.read("slot_0"))
    var err := a.delete("slot_0")
    assert_eq(err, OK)
    assert_null(a.read("slot_0"))

func test_list_keys_returns_existing_keys():
    var a := _make_adapter()
    var s1 := SlotResource.new(); s1.saved_at = 1; s1.snapshot.date = "x"
    var s2 := SlotResource.new(); s2.saved_at = 2; s2.snapshot.date = "y"
    a.write("slot_0", s1)
    a.write("slot_1", s2)
    var keys := a.list_keys()
    var arr: Array = []
    for k in keys: arr.append(k)
    arr.sort()
    assert_eq(arr.size(), 2)
    assert_eq(arr[0], "slot_0")
    assert_eq(arr[1], "slot_1")

func test_write_profile_round_trip():
    var a := _make_adapter()
    var p := ProfileResource.new()
    p.tutorial_done = true
    p.settings.bgm_volume = 0.42
    p.settings.kbm_bindings["rotate"] = "Q"
    p.progress.record_time("2026-05-26", "hard", 180)
    a.write("profile", p)

    var loaded := a.read("profile") as ProfileResource
    assert_not_null(loaded)
    assert_true(loaded.tutorial_done)
    assert_almost_eq(loaded.settings.bgm_volume, 0.42, 0.001)
    assert_eq(loaded.settings.kbm_bindings["rotate"], "Q")
    assert_eq(loaded.progress.get_best_time("2026-05-26", "hard"), 180)
```

- [ ] **Step 2: 写实现**

`boot/platform/save_adapter_tres.gd`:

```gdscript
# boot/platform/save_adapter_tres.gd
# 真实 SaveAdapter：把 Resource 写到 user://saves/<key>.tres。
# Steam Cloud 配置好 user://saves/* 后自动跨设备同步（不在本类代码层）。
#
# 替换 M0 的 stub_save_adapter.gd；boot.gd 改成实例化本类。
extends SaveAdapter

# 测试时可改成 user://test_saves/ 做隔离
var root_dir: String = "user://saves/"

func _init() -> void:
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(root_dir))

func _path_for(key: String) -> String:
    return root_dir + key + ".tres"

func write(key: String, resource: Resource) -> Error:
    if resource == null:
        return ERR_INVALID_PARAMETER
    if not _ensure_dir():
        return ERR_FILE_CANT_WRITE
    var path := _path_for(key)
    var err := ResourceSaver.save(resource, path)
    if err != OK:
        push_error("[SaveAdapterTres] write %s failed: %d" % [path, err])
    return err

func read(key: String) -> Resource:
    var path := _path_for(key)
    if not FileAccess.file_exists(path):
        return null
    var res := load(path)
    if res == null:
        push_warning("[SaveAdapterTres] load %s returned null (corrupt or schema mismatch)" % path)
    return res

func delete(key: String) -> Error:
    var path := _path_for(key)
    if not FileAccess.file_exists(path):
        return OK   # 删个不存在的当成功
    var abs := ProjectSettings.globalize_path(path)
    return DirAccess.remove_absolute(abs)

func list_keys() -> PackedStringArray:
    var out := PackedStringArray()
    var d := DirAccess.open(root_dir)
    if d == null:
        return out
    d.list_dir_begin()
    while true:
        var name := d.get_next()
        if name == "":
            break
        if name in [".", ".."]:
            continue
        if name.ends_with(".tres"):
            out.append(name.substr(0, name.length() - 5))
    d.list_dir_end()
    return out

func _ensure_dir() -> bool:
    var abs := ProjectSettings.globalize_path(root_dir)
    if DirAccess.dir_exists_absolute(abs):
        return true
    var err := DirAccess.make_dir_recursive_absolute(abs)
    return err == OK
```

- [ ] **Step 3: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: SaveAdapterTres 6 个测试全绿；M0 stub 测试（如果有）仍绿。

- [ ] **Step 4: Commit**

```bash
git add boot/platform/save_adapter_tres.gd tests/test_save_adapter_tres.gd
git commit -m "feat(boot): SaveAdapterTres — real .tres persistence under user://saves/"
```

---

## Task 4 — 改 boot 用 SaveAdapterTres + 加载 ProfileResource

**Files:**
- Modify: `boot/boot.gd`

- [ ] **Step 1: 替换 StubSaveAdapter → SaveAdapterTres**

打开 `boot/boot.gd`，做以下改动：

替换：
```gdscript
const StubSaveAdapter = preload("res://boot/platform/stub_save_adapter.gd")
```
为：
```gdscript
const SaveAdapterTres = preload("res://boot/platform/save_adapter_tres.gd")
const ProfileResource = preload("res://shared/save/profile_resource.gd")
```

替换 `_build_deps()` 里 `deps.save = StubSaveAdapter.new()` 为：
```gdscript
deps.save = SaveAdapterTres.new()
```

在 `_ready()` 入口（`_build_deps()` 之前）加 profile 加载逻辑：

```gdscript
var _profile: ProfileResource = null

func _ready() -> void:
    print("[boot] starting Calendar Puzzle")
    var deps := _build_deps()
    assert(deps.is_complete(), "boot: GameDeps assembly failed")
    _profile = _load_or_create_profile(deps.save)
    # 把 profile 挂到 deps 方便 game / settings 读写（约定属性扩展）
    deps.set_meta("profile", _profile)
    # 应用 SettingsResource 到 Godot（音量 / 全屏 / 语言）
    _apply_settings(_profile.settings)
    # M4 新增：先去 main_menu 而不是直接 game
    _show_main_menu(deps)

func _load_or_create_profile(save: SaveAdapter) -> ProfileResource:
    var p := save.read("profile") as ProfileResource
    if p == null:
        print("[boot] no profile.tres — creating new")
        p = ProfileResource.new()
        save.write("profile", p)
    return p

func _apply_settings(s: SettingsResource) -> void:
    AudioServer.set_bus_volume_db(AudioServer.get_bus_index("Master"),
        linear_to_db(s.master_volume))
    if AudioServer.get_bus_index("BGM") >= 0:
        AudioServer.set_bus_volume_db(AudioServer.get_bus_index("BGM"),
            linear_to_db(s.bgm_volume))
    if AudioServer.get_bus_index("SFX") >= 0:
        AudioServer.set_bus_volume_db(AudioServer.get_bus_index("SFX"),
            linear_to_db(s.sfx_volume))
    DisplayServer.window_set_mode(
        DisplayServer.WINDOW_MODE_FULLSCREEN if s.fullscreen else DisplayServer.WINDOW_MODE_WINDOWED)
    if s.locale != "":
        TranslationServer.set_locale(s.locale)
```

> 注意：`SettingsResource` 顶部 preload：

```gdscript
const SettingsResource = preload("res://shared/save/settings_resource.gd")
```

`_show_main_menu(deps)` 在 Task 5 实现；当前先留 stub：

```gdscript
func _show_main_menu(deps: GameDeps) -> void:
    push_warning("[boot] _show_main_menu pending — falling back to direct game start")
    _start_game(deps)

func _start_game(deps: GameDeps) -> void:
    var module := CalendarPuzzleGame.new()
    _game_root = module.start(deps)
    add_child(_game_root)
```

- [ ] **Step 2: 验证启动**

```bash
godot --headless --quit-after 3 res://boot/boot.tscn 2>&1 | tail -15
```

Expected: 看到 `[boot] no profile.tres — creating new` 首次出现；之后启动看到正常 module start，user:// 下出现 `saves/profile.tres`。

```bash
ls -la "$(godot --headless --script - <<<'extends SceneTree
func _init(): print(ProjectSettings.globalize_path("user://saves/")); quit()')" 2>/dev/null
```

或者直接：

```bash
find ~/Library/Application\ Support/Godot/app_userdata/Calendar\ Puzzle 2>/dev/null
find ~/.local/share/godot/app_userdata/Calendar\ Puzzle 2>/dev/null
find %APPDATA%/Godot/app_userdata/Calendar\ Puzzle 2>/dev/null
```

应能找到 `saves/profile.tres`。

- [ ] **Step 3: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add boot/boot.gd
git commit -m "feat(boot): swap StubSaveAdapter for SaveAdapterTres; load/create profile.tres at startup"
```

---

## Task 5 — 实现 main_menu

**Files:**
- Create: `boot/main_menu/main_menu.gd`
- Create: `boot/main_menu/main_menu.tscn`
- Test: `tests/test_main_menu.gd`
- Modify: `boot/boot.gd`（接 main_menu）

- [ ] **Step 1: 写 failing test**

`tests/test_main_menu.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const MainMenu = preload("res://boot/main_menu/main_menu.gd")

func test_signals_defined():
    var m := MainMenu.new()
    assert_true(m.has_signal("continue_pressed"))
    assert_true(m.has_signal("new_game_pressed"))
    assert_true(m.has_signal("settings_pressed"))
    assert_true(m.has_signal("quit_pressed"))

func test_continue_button_disabled_when_no_autosave():
    var m := MainMenu.new()
    m._test_init_without_ui()
    m.set_continue_available(false)
    assert_false(m.continue_available)

func test_continue_button_enabled_with_autosave():
    var m := MainMenu.new()
    m._test_init_without_ui()
    m.set_continue_available(true)
    assert_true(m.continue_available)
```

- [ ] **Step 2: 写 main_menu.gd**

`boot/main_menu/main_menu.gd`:

```gdscript
# boot/main_menu/main_menu.gd
# 主菜单：继续游戏 / 新游戏 / 设置 / 退出
extends Control

signal continue_pressed()
signal new_game_pressed()
signal settings_pressed()
signal quit_pressed()

var continue_available: bool = false

@onready var _btn_continue: Button = get_node_or_null("Layout/ContinueButton")
@onready var _btn_new: Button = get_node_or_null("Layout/NewGameButton")
@onready var _btn_settings: Button = get_node_or_null("Layout/SettingsButton")
@onready var _btn_quit: Button = get_node_or_null("Layout/QuitButton")

func _ready() -> void:
    if _btn_continue:
        _btn_continue.pressed.connect(func(): continue_pressed.emit())
    if _btn_new:
        _btn_new.pressed.connect(func(): new_game_pressed.emit())
    if _btn_settings:
        _btn_settings.pressed.connect(func(): settings_pressed.emit())
    if _btn_quit:
        _btn_quit.pressed.connect(func(): quit_pressed.emit())
    _refresh()

func set_continue_available(v: bool) -> void:
    continue_available = v
    _refresh()

func _refresh() -> void:
    if _btn_continue:
        _btn_continue.disabled = not continue_available

func _test_init_without_ui() -> void:
    pass
```

- [ ] **Step 3: 写 main_menu.tscn**

`boot/main_menu/main_menu.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://boot/main_menu/main_menu.gd" id="1"]

[node name="MainMenu" type="Control"]
anchor_right = 1.0
anchor_bottom = 1.0
script = ExtResource("1")

[node name="Title" type="Label" parent="."]
text = "Calendar Puzzle"
anchor_left = 0.5
anchor_right = 0.5
offset_left = -200.0
offset_top = 120.0
offset_right = 200.0
offset_bottom = 180.0
horizontal_alignment = 1

[node name="Layout" type="VBoxContainer" parent="."]
anchor_left = 0.5
anchor_right = 0.5
anchor_top = 0.5
anchor_bottom = 0.5
offset_left = -120.0
offset_top = -120.0
offset_right = 120.0
offset_bottom = 120.0
custom_minimum_size = Vector2(240, 240)

[node name="ContinueButton" type="Button" parent="Layout"]
text = "Continue"
custom_minimum_size = Vector2(0, 48)

[node name="NewGameButton" type="Button" parent="Layout"]
text = "New Game"
custom_minimum_size = Vector2(0, 48)

[node name="SettingsButton" type="Button" parent="Layout"]
text = "Settings"
custom_minimum_size = Vector2(0, 48)

[node name="QuitButton" type="Button" parent="Layout"]
text = "Quit"
custom_minimum_size = Vector2(0, 48)
```

- [ ] **Step 4: 改 boot.gd 接上 main_menu 路由**

替换 Task 4 留下的 `_show_main_menu` stub 为完整实现：

```gdscript
const MainMenu = preload("res://boot/main_menu/main_menu.tscn")
const SettingsPanel = preload("res://boot/settings/settings_panel.tscn")  # Task 6 创建

var _deps: GameDeps = null
var _menu_root: Node = null

func _show_main_menu(deps: GameDeps) -> void:
    _deps = deps
    _swap_root(MainMenu.instantiate())
    var menu: Control = _menu_root
    var autosave = deps.save.read("autosave")
    menu.set_continue_available(autosave != null)
    menu.continue_pressed.connect(_on_continue)
    menu.new_game_pressed.connect(_on_new_game)
    menu.settings_pressed.connect(_on_settings)
    menu.quit_pressed.connect(_on_quit)

func _swap_root(new_node: Node) -> void:
    if _menu_root:
        _menu_root.queue_free()
    _menu_root = new_node
    add_child(_menu_root)

func _on_continue() -> void:
    _start_game(_deps, true)

func _on_new_game() -> void:
    _start_game(_deps, false)

func _on_settings() -> void:
    var panel := SettingsPanel.instantiate()
    panel.bind(_profile)
    panel.closed.connect(_on_settings_closed)
    add_child(panel)

func _on_settings_closed() -> void:
    # 保存 profile（settings 已被 panel 直接 mutate）
    _deps.save.write("profile", _profile)
    _apply_settings(_profile.settings)

func _on_quit() -> void:
    get_tree().quit()

func _start_game(deps: GameDeps, restore_autosave: bool) -> void:
    var module := CalendarPuzzleGame.new()
    _game_root = module.start(deps)
    if restore_autosave:
        var snap = deps.save.read("autosave") as SlotResource
        if snap and not snap.is_empty() and _game_root.has_method("restore_from_snapshot"):
            _game_root.restore_from_snapshot(snap.snapshot)
    if _menu_root:
        _menu_root.queue_free()
        _menu_root = null
    add_child(_game_root)
```

> 注意顶部 preload 补：

```gdscript
const SlotResource = preload("res://shared/save/slot_resource.gd")
```

`_game_root` 的 `restore_from_snapshot(snap)` 是 Task 9 实现的 play_scene 入口。M4 这里只是先调用占位；Task 9 才真正接通。

- [ ] **Step 5: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -15
```

Expected: main_menu 3 个测试 + 之前的全绿。**Settings panel 测试还没有，因为 settings_panel.tscn 还没建——下一个 Task。**

- [ ] **Step 6: Commit**

```bash
git add boot/main_menu/ tests/test_main_menu.gd boot/boot.gd
git commit -m "feat(boot): MainMenu (continue/new/settings/quit) with autosave-aware continue button"
```

---

## Task 6 — KeyCapture 控件（重映射 UI 核心）

**Files:**
- Create: `shared/ui/key_capture.gd`
- Create: `shared/ui/key_capture.tscn`
- Test: `tests/test_key_capture.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_key_capture.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const KeyCapture = preload("res://shared/ui/key_capture.gd")

func _make_event(physical_keycode: int, ctrl := false, shift := false, alt := false) -> InputEventKey:
    var e := InputEventKey.new()
    e.physical_keycode = physical_keycode
    e.ctrl_pressed = ctrl
    e.shift_pressed = shift
    e.alt_pressed = alt
    e.pressed = true
    return e

func test_serialize_simple_key():
    var ev := _make_event(KEY_R)
    var s := KeyCapture.serialize_event(ev)
    assert_eq(s, "R")

func test_serialize_with_modifier():
    var ev := _make_event(KEY_Z, true, false, false)
    var s := KeyCapture.serialize_event(ev)
    assert_eq(s, "Ctrl+Z")

func test_serialize_with_multiple_modifiers():
    var ev := _make_event(KEY_S, true, true, false)
    var s := KeyCapture.serialize_event(ev)
    assert_eq(s, "Ctrl+Shift+S")

func test_serialize_escape():
    var ev := _make_event(KEY_ESCAPE)
    var s := KeyCapture.serialize_event(ev)
    assert_eq(s, "Escape")

func test_capture_state_transitions():
    var k := KeyCapture.new()
    assert_false(k.is_capturing)
    k.start_capture()
    assert_true(k.is_capturing)
    k.cancel_capture()
    assert_false(k.is_capturing)

func test_capture_consumes_input_and_emits_signal():
    var k := KeyCapture.new()
    var captured := []
    k.captured.connect(func(s): captured.append(s))
    k.start_capture()
    var ev := _make_event(KEY_Q)
    k._unhandled_input(ev)
    assert_eq(captured.size(), 1)
    assert_eq(captured[0], "Q")
    assert_false(k.is_capturing)  # 捕获后自动退出

func test_modifier_only_press_is_ignored():
    var k := KeyCapture.new()
    var captured := []
    k.captured.connect(func(s): captured.append(s))
    k.start_capture()
    var ev := _make_event(KEY_CTRL)  # 只按修饰键，不算最终绑定
    k._unhandled_input(ev)
    assert_eq(captured.size(), 0)
    assert_true(k.is_capturing)  # 仍在捕获

func test_escape_during_capture_cancels():
    var k := KeyCapture.new()
    var captured := []
    k.captured.connect(func(s): captured.append(s))
    var cancelled := [false]
    k.cancelled.connect(func(): cancelled[0] = true)
    k.start_capture()
    var ev := _make_event(KEY_ESCAPE)
    k._unhandled_input(ev)
    # Escape 用于取消（spec 默认 menu = Escape，但在 capture 中优先解读为取消）
    assert_eq(captured.size(), 0)
    assert_true(cancelled[0])
    assert_false(k.is_capturing)
```

- [ ] **Step 2: 写实现**

`shared/ui/key_capture.gd`:

```gdscript
# shared/ui/key_capture.gd
# 按键捕获控件：
#   点击 → 显示"按下按键..."状态 → 监听下一个非纯修饰键的 InputEventKey
#   → 序列化为字符串（如 "Ctrl+Z"）→ emit captured(serialized: String)
#   Escape 期间用于取消捕获，emit cancelled()。
#
# 用法：
#   var kc = KeyCapture.new()
#   kc.current_binding = "R"                 # 初始显示
#   kc.captured.connect(_on_key_captured)
#   kc.start_capture()                       # 通常由按钮 pressed 触发
class_name KeyCapture extends Control

signal captured(serialized: String)
signal cancelled()

var is_capturing: bool = false
var current_binding: String = ""

@onready var _label: Label = get_node_or_null("Label")
@onready var _btn: Button = get_node_or_null("Button")

func _ready() -> void:
    if _btn:
        _btn.pressed.connect(start_capture)
    _refresh()

func start_capture() -> void:
    is_capturing = true
    _refresh()
    set_process_unhandled_input(true)

func cancel_capture() -> void:
    is_capturing = false
    set_process_unhandled_input(false)
    _refresh()
    cancelled.emit()

func set_binding(s: String) -> void:
    current_binding = s
    _refresh()

func _refresh() -> void:
    if _label:
        _label.text = "Press a key..." if is_capturing else current_binding
    if _btn:
        _btn.text = current_binding if not is_capturing else "[capturing]"

func _unhandled_input(event: InputEvent) -> void:
    if not is_capturing:
        return
    if not (event is InputEventKey):
        return
    var key_ev: InputEventKey = event
    if not key_ev.pressed:
        return
    var kc: int = key_ev.physical_keycode
    # Escape 优先取消
    if kc == KEY_ESCAPE and not (key_ev.ctrl_pressed or key_ev.shift_pressed or key_ev.alt_pressed):
        cancel_capture()
        get_viewport().set_input_as_handled()
        return
    # 纯修饰键忽略（等真正的字符键）
    if kc in [KEY_CTRL, KEY_SHIFT, KEY_ALT, KEY_META]:
        return
    var serialized := serialize_event(key_ev)
    is_capturing = false
    set_process_unhandled_input(false)
    current_binding = serialized
    _refresh()
    captured.emit(serialized)
    get_viewport().set_input_as_handled()

# 序列化策略：[Ctrl+][Shift+][Alt+]<KeyName>
# KeyName 用 OS.get_keycode_string；对常见键给短别名。
static func serialize_event(ev: InputEventKey) -> String:
    var parts := []
    if ev.ctrl_pressed: parts.append("Ctrl")
    if ev.shift_pressed: parts.append("Shift")
    if ev.alt_pressed: parts.append("Alt")
    parts.append(_keycode_to_string(ev.physical_keycode))
    return "+".join(parts)

static func _keycode_to_string(kc: int) -> String:
    match kc:
        KEY_ESCAPE: return "Escape"
        KEY_ENTER: return "Enter"
        KEY_SPACE: return "Space"
        KEY_TAB: return "Tab"
        KEY_BACKSPACE: return "Backspace"
        _:
            # OS.get_keycode_string(kc) 在大多数键上输出 "A", "B", "R" 等
            var s := OS.get_keycode_string(kc)
            if s.is_empty():
                return "Key(%d)" % kc
            return s
```

- [ ] **Step 3: 写 .tscn**

`shared/ui/key_capture.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://shared/ui/key_capture.gd" id="1"]

[node name="KeyCapture" type="Control"]
custom_minimum_size = Vector2(160, 32)
script = ExtResource("1")

[node name="Label" type="Label" parent="."]
text = ""
anchor_right = 0.5
anchor_bottom = 1.0
offset_right = -8.0
vertical_alignment = 1

[node name="Button" type="Button" parent="."]
text = "rebind"
anchor_left = 0.5
anchor_right = 1.0
anchor_bottom = 1.0
```

- [ ] **Step 4: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: KeyCapture 8 个测试全绿。

- [ ] **Step 5: Commit**

```bash
git add shared/ui/key_capture.gd shared/ui/key_capture.tscn tests/test_key_capture.gd
git commit -m "feat(shared/ui): KeyCapture widget with modifier serialization + escape-to-cancel"
```

---

## Task 7 — Settings Panel（3 标签 UI）

**Files:**
- Create: `boot/settings/settings_panel.gd`
- Create: `boot/settings/settings_panel.tscn`
- Create: `boot/settings/tab_general.gd`
- Create: `boot/settings/tab_general.tscn`
- Create: `boot/settings/tab_controls.gd`
- Create: `boot/settings/tab_controls.tscn`
- Create: `boot/settings/tab_skins.gd`
- Create: `boot/settings/tab_skins.tscn`

> 本 task UI 较多但每个 tab 都很小。皮肤 tab 的真实预览图在 M9 才出；M4 这里只占位（用纯色 ColorRect 当 thumbnail fallback）。

- [ ] **Step 1: 写 settings_panel.gd（外壳）**

`boot/settings/settings_panel.gd`:

```gdscript
# boot/settings/settings_panel.gd
# 设置面板外壳：TabBar 切 3 个 tab，关闭时 emit closed。
# 内部 mutate 传入的 ProfileResource.settings；外部负责持久化。
extends Control

signal closed()

const ProfileResource = preload("res://shared/save/profile_resource.gd")

var _profile: ProfileResource = null

@onready var _tab_container: TabContainer = $TabContainer
@onready var _btn_close: Button = $CloseButton
@onready var _general: Control = $TabContainer/General
@onready var _controls: Control = $TabContainer/Controls
@onready var _skins: Control = $TabContainer/Skins

func bind(profile: ProfileResource) -> void:
    _profile = profile

func _ready() -> void:
    if _btn_close:
        _btn_close.pressed.connect(_on_close)
    if _profile == null:
        push_error("settings_panel: bind(profile) must be called before _ready")
        return
    _general.bind(_profile)
    _controls.bind(_profile)
    _skins.bind(_profile)

func _on_close() -> void:
    closed.emit()
    queue_free()
```

`boot/settings/settings_panel.tscn`:

```
[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://boot/settings/settings_panel.gd" id="1"]
[ext_resource type="PackedScene" path="res://boot/settings/tab_general.tscn" id="2"]
[ext_resource type="PackedScene" path="res://boot/settings/tab_controls.tscn" id="3"]
[ext_resource type="PackedScene" path="res://boot/settings/tab_skins.tscn" id="4"]

[node name="SettingsPanel" type="Control"]
anchor_right = 1.0
anchor_bottom = 1.0
script = ExtResource("1")

[node name="Bg" type="ColorRect" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
color = Color(0, 0, 0, 0.7)

[node name="TabContainer" type="TabContainer" parent="."]
anchor_left = 0.5
anchor_right = 0.5
anchor_top = 0.5
anchor_bottom = 0.5
offset_left = -360.0
offset_top = -240.0
offset_right = 360.0
offset_bottom = 240.0

[node name="General" parent="TabContainer" instance=ExtResource("2")]

[node name="Controls" parent="TabContainer" instance=ExtResource("3")]

[node name="Skins" parent="TabContainer" instance=ExtResource("4")]

[node name="CloseButton" type="Button" parent="."]
text = "X"
anchor_left = 1.0
anchor_right = 1.0
offset_left = -56.0
offset_top = 16.0
offset_right = -16.0
offset_bottom = 56.0
```

- [ ] **Step 2: 写 tab_general（音量 / 全屏 / 主题 / 语言 / 重置）**

`boot/settings/tab_general.gd`:

```gdscript
extends Control

const ProfileResource = preload("res://shared/save/profile_resource.gd")

var _profile: ProfileResource

@onready var _bgm_slider: HSlider = $V/BGMRow/Slider
@onready var _sfx_slider: HSlider = $V/SFXRow/Slider
@onready var _master_slider: HSlider = $V/MasterRow/Slider
@onready var _fullscreen_check: CheckBox = $V/FullscreenRow/Check
@onready var _theme_option: OptionButton = $V/ThemeRow/Option
@onready var _locale_option: OptionButton = $V/LocaleRow/Option
@onready var _reset_btn: Button = $V/ResetRow/Button

func bind(profile: ProfileResource) -> void:
    _profile = profile
    _populate_options()
    _load_from_settings()
    _wire_signals()

func _populate_options() -> void:
    if _theme_option.item_count == 0:
        _theme_option.add_item("System", 0)
        _theme_option.add_item("Light", 1)
        _theme_option.add_item("Dark", 2)
    if _locale_option.item_count == 0:
        _locale_option.add_item("Auto (OS)", 0)
        _locale_option.add_item("简体中文", 1)
        _locale_option.add_item("繁體中文", 2)
        _locale_option.add_item("English", 3)

func _load_from_settings() -> void:
    var s = _profile.settings
    _bgm_slider.value = s.bgm_volume * 100.0
    _sfx_slider.value = s.sfx_volume * 100.0
    _master_slider.value = s.master_volume * 100.0
    _fullscreen_check.button_pressed = s.fullscreen
    match s.theme:
        "system": _theme_option.select(0)
        "light":  _theme_option.select(1)
        "dark":   _theme_option.select(2)
    match s.locale:
        "":      _locale_option.select(0)
        "zh_CN": _locale_option.select(1)
        "zh_TW": _locale_option.select(2)
        "en":    _locale_option.select(3)

func _wire_signals() -> void:
    _bgm_slider.value_changed.connect(func(v): _profile.settings.bgm_volume = v / 100.0; _live_apply_audio())
    _sfx_slider.value_changed.connect(func(v): _profile.settings.sfx_volume = v / 100.0; _live_apply_audio())
    _master_slider.value_changed.connect(func(v): _profile.settings.master_volume = v / 100.0; _live_apply_audio())
    _fullscreen_check.toggled.connect(func(p): _profile.settings.fullscreen = p; _live_apply_fullscreen())
    _theme_option.item_selected.connect(_on_theme_changed)
    _locale_option.item_selected.connect(_on_locale_changed)
    _reset_btn.pressed.connect(_on_reset)

func _on_theme_changed(idx: int) -> void:
    var v := ["system", "light", "dark"][idx]
    _profile.settings.theme = v
    # 主题 live apply：M9 接入 ThemeManager；M4 暂时只记录值

func _on_locale_changed(idx: int) -> void:
    var v := ["", "zh_CN", "zh_TW", "en"][idx]
    _profile.settings.locale = v
    if v != "":
        TranslationServer.set_locale(v)

func _on_reset() -> void:
    _profile.settings.reset_to_defaults()
    _load_from_settings()
    _live_apply_audio()
    _live_apply_fullscreen()

func _live_apply_audio() -> void:
    AudioServer.set_bus_volume_db(AudioServer.get_bus_index("Master"),
        linear_to_db(_profile.settings.master_volume))
    if AudioServer.get_bus_index("BGM") >= 0:
        AudioServer.set_bus_volume_db(AudioServer.get_bus_index("BGM"),
            linear_to_db(_profile.settings.bgm_volume))
    if AudioServer.get_bus_index("SFX") >= 0:
        AudioServer.set_bus_volume_db(AudioServer.get_bus_index("SFX"),
            linear_to_db(_profile.settings.sfx_volume))

func _live_apply_fullscreen() -> void:
    DisplayServer.window_set_mode(
        DisplayServer.WINDOW_MODE_FULLSCREEN if _profile.settings.fullscreen
        else DisplayServer.WINDOW_MODE_WINDOWED)
```

`boot/settings/tab_general.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://boot/settings/tab_general.gd" id="1"]

[node name="General" type="Control"]
script = ExtResource("1")

[node name="V" type="VBoxContainer" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
offset_left = 24.0
offset_top = 24.0
offset_right = -24.0
offset_bottom = -24.0

[node name="MasterRow" type="HBoxContainer" parent="V"]

[node name="Label" type="Label" parent="V/MasterRow"]
text = "Master Volume"
custom_minimum_size = Vector2(160, 0)

[node name="Slider" type="HSlider" parent="V/MasterRow"]
min_value = 0.0
max_value = 100.0
step = 1.0
value = 100.0
size_flags_horizontal = 3

[node name="BGMRow" type="HBoxContainer" parent="V"]

[node name="Label" type="Label" parent="V/BGMRow"]
text = "BGM Volume"
custom_minimum_size = Vector2(160, 0)

[node name="Slider" type="HSlider" parent="V/BGMRow"]
min_value = 0.0
max_value = 100.0
step = 1.0
value = 30.0
size_flags_horizontal = 3

[node name="SFXRow" type="HBoxContainer" parent="V"]

[node name="Label" type="Label" parent="V/SFXRow"]
text = "SFX Volume"
custom_minimum_size = Vector2(160, 0)

[node name="Slider" type="HSlider" parent="V/SFXRow"]
min_value = 0.0
max_value = 100.0
step = 1.0
value = 70.0
size_flags_horizontal = 3

[node name="FullscreenRow" type="HBoxContainer" parent="V"]

[node name="Label" type="Label" parent="V/FullscreenRow"]
text = "Fullscreen"
custom_minimum_size = Vector2(160, 0)

[node name="Check" type="CheckBox" parent="V/FullscreenRow"]

[node name="ThemeRow" type="HBoxContainer" parent="V"]

[node name="Label" type="Label" parent="V/ThemeRow"]
text = "Theme"
custom_minimum_size = Vector2(160, 0)

[node name="Option" type="OptionButton" parent="V/ThemeRow"]
custom_minimum_size = Vector2(160, 0)

[node name="LocaleRow" type="HBoxContainer" parent="V"]

[node name="Label" type="Label" parent="V/LocaleRow"]
text = "Language"
custom_minimum_size = Vector2(160, 0)

[node name="Option" type="OptionButton" parent="V/LocaleRow"]
custom_minimum_size = Vector2(160, 0)

[node name="ResetRow" type="HBoxContainer" parent="V"]

[node name="Spacer" type="Control" parent="V/ResetRow"]
size_flags_horizontal = 3

[node name="Button" type="Button" parent="V/ResetRow"]
text = "Reset All"
```

- [ ] **Step 3: 写 tab_controls（5 个 KeyCapture）**

`boot/settings/tab_controls.gd`:

```gdscript
extends Control

const ProfileResource = preload("res://shared/save/profile_resource.gd")
const KeyCaptureScene = preload("res://shared/ui/key_capture.tscn")
const SettingsResource = preload("res://shared/save/settings_resource.gd")

var _profile: ProfileResource

const ACTIONS := ["rotate", "mirror", "hint", "undo", "menu"]

@onready var _list: VBoxContainer = $V/ActionList
@onready var _reset_btn: Button = $V/ResetButton

# 缓存每个 action 对应的 KeyCapture 实例
var _captures: Dictionary = {}

func bind(profile: ProfileResource) -> void:
    _profile = profile
    _build_rows()
    _reset_btn.pressed.connect(_on_reset_bindings)

func _build_rows() -> void:
    for c in _list.get_children():
        c.queue_free()
    _captures.clear()
    for action in ACTIONS:
        var row := HBoxContainer.new()
        var label := Label.new()
        label.text = action
        label.custom_minimum_size = Vector2(120, 32)
        row.add_child(label)
        var kc: KeyCapture = KeyCaptureScene.instantiate()
        kc.current_binding = _profile.settings.kbm_bindings.get(action, "")
        kc.captured.connect(func(serialized): _on_action_captured(action, serialized))
        row.add_child(kc)
        _list.add_child(row)
        _captures[action] = kc

func _on_action_captured(action: String, serialized: String) -> void:
    # 冲突检测：若 serialized 已被其它 action 占用，弹 warning 并把对方变成 "Unbound"
    var conflict_action := _profile.settings.find_action_for_key(serialized)
    if conflict_action != "" and conflict_action != action:
        push_warning("[settings] key %s was bound to '%s', re-assigning to '%s'" % [serialized, conflict_action, action])
        _profile.settings.kbm_bindings[conflict_action] = ""
        if _captures.has(conflict_action):
            _captures[conflict_action].set_binding("")
    _profile.settings.kbm_bindings[action] = serialized

func _on_reset_bindings() -> void:
    _profile.settings.reset_bindings_only()
    _build_rows()
```

`boot/settings/tab_controls.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://boot/settings/tab_controls.gd" id="1"]

[node name="Controls" type="Control"]
script = ExtResource("1")

[node name="V" type="VBoxContainer" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
offset_left = 24.0
offset_top = 24.0
offset_right = -24.0
offset_bottom = -24.0

[node name="Hint" type="Label" parent="V"]
text = "Click a binding to rebind. Press Escape to cancel capture."

[node name="ActionList" type="VBoxContainer" parent="V"]
size_flags_vertical = 3

[node name="ResetButton" type="Button" parent="V"]
text = "Reset Bindings to Default"
```

- [ ] **Step 4: 写 tab_skins（皮肤选择器）**

`boot/settings/tab_skins.gd`:

```gdscript
extends Control

const ProfileResource = preload("res://shared/save/profile_resource.gd")

var _profile: ProfileResource

@onready var _grid: HBoxContainer = $V/Grid
@onready var _current_label: Label = $V/CurrentLabel

# Task 8 SkinManager 注入；M4 暂时直接扫描目录
const SKINS_DIR := "res://games/calendar_puzzle/skins/"

func bind(profile: ProfileResource) -> void:
    _profile = profile
    _build_thumbnails()
    _refresh_label()

func _build_thumbnails() -> void:
    for c in _grid.get_children():
        c.queue_free()
    var ids := _scan_skin_ids()
    for id in ids:
        var box := VBoxContainer.new()
        var thumb := ColorRect.new()
        thumb.custom_minimum_size = Vector2(128, 128)
        thumb.color = _placeholder_color_for(id)
        box.add_child(thumb)
        var btn := Button.new()
        btn.text = id
        btn.pressed.connect(func(): _on_skin_picked(id))
        box.add_child(btn)
        _grid.add_child(box)

func _scan_skin_ids() -> Array[String]:
    var out: Array[String] = []
    var d := DirAccess.open(SKINS_DIR)
    if d == null:
        return out
    d.list_dir_begin()
    while true:
        var name := d.get_next()
        if name == "":
            break
        if name in [".", ".."]:
            continue
        if name.ends_with(".tres") and name != "skin_resource.gd":
            out.append(name.get_basename())
    d.list_dir_end()
    out.sort()
    return out

func _placeholder_color_for(id: String) -> Color:
    # M9 用真实 thumbnail；M4 用 hash 出一个稳定颜色当占位
    var h := id.hash()
    return Color((h & 0xFF) / 255.0, ((h >> 8) & 0xFF) / 255.0, ((h >> 16) & 0xFF) / 255.0)

func _on_skin_picked(id: String) -> void:
    _profile.settings.current_skin_id = id
    _refresh_label()
    # 广播给 play_scene 重渲染（Task 8 SkinManager 接管；M4 这里直接走 signal）
    var bus := Engine.get_main_loop().root.get_node_or_null("/root/SkinBus")
    if bus and bus.has_method("emit_skin_changed"):
        bus.emit_skin_changed(id)

func _refresh_label() -> void:
    _current_label.text = "Current: %s" % _profile.settings.current_skin_id
```

`boot/settings/tab_skins.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://boot/settings/tab_skins.gd" id="1"]

[node name="Skins" type="Control"]
script = ExtResource("1")

[node name="V" type="VBoxContainer" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
offset_left = 24.0
offset_top = 24.0
offset_right = -24.0
offset_bottom = -24.0

[node name="CurrentLabel" type="Label" parent="V"]
text = "Current: default"

[node name="Grid" type="HBoxContainer" parent="V"]
size_flags_vertical = 3
```

- [ ] **Step 5: 语法验证**

```bash
for f in boot/settings/*.gd; do
    godot --headless --check-only --script "$f" 2>&1 && echo "$f OK"
done
```

Expected: 4 行 OK。

- [ ] **Step 6: 跑全套测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected: 全绿（无新测试但既有不能被打破）。

- [ ] **Step 7: GUI 冒烟（手工）**

```bash
godot
```

操作：
- 主菜单 → Settings → 出弹层
- 切 General tab → 拖音量滑块 → 听到（若有 BGM）实时变化
- 切 General tab → 切换主题/语言/全屏 → 全屏立刻生效
- 切 Controls tab → 5 行可见，点 rotate 旁的 "rebind" 按 Q → 看到变 "Q"
- 切 Skins tab → 看到至少 3 个占位色块（default/pastel/mono_focus；这一步前提是 Task 8 已创建 3 个 .tres）
- 关闭 → 重启游戏 → 设置保留

> Task 8 还没跑的话，Skins tab 可能空；先记笔记，Task 8 完成后回测。

- [ ] **Step 8: Commit**

```bash
git add boot/settings/
git commit -m "feat(settings): SettingsPanel with general/controls/skins tabs (live apply audio + fullscreen + locale)"
```

---

## Task 8 — SkinResource + SkinManager + 3 个 .tres 骨架

**Files:**
- Create: `games/calendar_puzzle/skins/skin_resource.gd`
- Create: `games/calendar_puzzle/skins/default.tres`
- Create: `games/calendar_puzzle/skins/pastel.tres`
- Create: `games/calendar_puzzle/skins/mono_focus.tres`
- Create: `games/calendar_puzzle/systems/skin_manager.gd`
- Test: `tests/test_skin_manager.gd`

> **M4→M9 依赖**：本 task 只创建 SkinResource 类定义 + 3 个 .tres 空骨架，让 SkinManager 能扫到、能切换。**真实色板和缩略图在 M9 视觉打磨阶段填**（M9 plan 必须包含一个"填 default/pastel/mono_focus 色板"task）。

- [ ] **Step 1: 写 SkinResource 类**

`games/calendar_puzzle/skins/skin_resource.gd`:

```gdscript
# games/calendar_puzzle/skins/skin_resource.gd
# 一个皮肤的数据载体：棋盘配色 + 10 方块色 + 缩略图。
# Phase 2 DLC 也用这个类；DLC 只往 skins/ 投新 .tres + 在 manifest 声明归属。
class_name SkinResource extends Resource

@export var id: String = ""                       # 唯一 id，匹配 .tres 文件名（无扩展名）
@export var display_name: String = ""             # i18n key（M7 解析）
@export var board_bg: Color = Color(0.98, 0.98, 0.98)
@export var board_grid: Color = Color(0.9, 0.9, 0.92)
@export var board_date_marker: Color = Color(0.31, 0.275, 0.9)
@export var block_colors: Array[Color] = []       # 长度 10，对应 I/L/J/S/Z/P/Y/N/T/U
@export var thumbnail: Texture2D = null           # 128×128 预览图（M9 填）

func is_complete() -> bool:
    return id != "" and block_colors.size() == 10
```

- [ ] **Step 2: 写 SkinManager**

`games/calendar_puzzle/systems/skin_manager.gd`:

```gdscript
# games/calendar_puzzle/systems/skin_manager.gd
# 启动扫描 skins/*.tres → 注册 list；apply(id) 切换并广播。
# 通常注册为 Autoload "SkinBus" 让 settings tab + play_scene 都能拿到。
class_name SkinManager extends Node

signal skin_changed(skin_id: String, skin: SkinResource)

const SkinResource = preload("res://games/calendar_puzzle/skins/skin_resource.gd")
const SKINS_DIR := "res://games/calendar_puzzle/skins/"

var _registry: Dictionary = {}    # id -> SkinResource
var _current_id: String = "default"

func _ready() -> void:
    rescan()

func rescan() -> void:
    _registry.clear()
    var d := DirAccess.open(SKINS_DIR)
    if d == null:
        push_error("[SkinManager] skins/ dir not found")
        return
    d.list_dir_begin()
    while true:
        var name := d.get_next()
        if name == "":
            break
        if name in [".", ".."]: continue
        if not name.ends_with(".tres"): continue
        var skin: SkinResource = load(SKINS_DIR + name) as SkinResource
        if skin == null:
            push_warning("[SkinManager] failed to load %s" % name)
            continue
        if skin.id == "":
            skin.id = name.get_basename()
        _registry[skin.id] = skin
    d.list_dir_end()
    print("[SkinManager] registered %d skins: %s" % [_registry.size(), _registry.keys()])

func all_ids() -> Array:
    var keys := _registry.keys()
    keys.sort()
    return keys

func get_skin(id: String) -> SkinResource:
    return _registry.get(id, null)

func get_current() -> SkinResource:
    return _registry.get(_current_id, null)

func apply(id: String) -> void:
    if not _registry.has(id):
        push_warning("[SkinManager] unknown skin id: %s" % id)
        return
    _current_id = id
    skin_changed.emit(id, _registry[id])

# 供 tab_skins 通过 SkinBus autoload 调用的别名
func emit_skin_changed(id: String) -> void:
    apply(id)
```

- [ ] **Step 3: 创建 3 个 .tres 占位骨架**

`games/calendar_puzzle/skins/default.tres`:

```
[gd_resource type="Resource" script_class="SkinResource" load_steps=2 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/skins/skin_resource.gd" id="1"]

[resource]
script = ExtResource("1")
id = "default"
display_name = "skin.default"
board_bg = Color(0.98, 0.98, 0.98, 1)
board_grid = Color(0.9, 0.9, 0.92, 1)
board_date_marker = Color(0.31, 0.275, 0.9, 1)
block_colors = Array[Color]([Color(0.94, 0.27, 0.27, 1), Color(0.97, 0.45, 0.09, 1), Color(0.98, 0.8, 0.08, 1), Color(0.52, 0.8, 0.09, 1), Color(0.13, 0.77, 0.37, 1), Color(0.08, 0.72, 0.65, 1), Color(0.02, 0.71, 0.83, 1), Color(0.23, 0.51, 0.96, 1), Color(0.55, 0.36, 0.96, 1), Color(0.92, 0.28, 0.6, 1)])
```

`games/calendar_puzzle/skins/pastel.tres`:

```
[gd_resource type="Resource" script_class="SkinResource" load_steps=2 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/skins/skin_resource.gd" id="1"]

[resource]
script = ExtResource("1")
id = "pastel"
display_name = "skin.pastel"
board_bg = Color(0.97, 0.95, 0.92, 1)
board_grid = Color(0.82, 0.85, 0.88, 1)
board_date_marker = Color(0.55, 0.50, 0.85, 1)
block_colors = Array[Color]([Color(0.85, 0.65, 0.65, 1), Color(0.85, 0.72, 0.55, 1), Color(0.85, 0.80, 0.55, 1), Color(0.72, 0.80, 0.60, 1), Color(0.60, 0.78, 0.65, 1), Color(0.55, 0.75, 0.72, 1), Color(0.55, 0.72, 0.78, 1), Color(0.60, 0.68, 0.82, 1), Color(0.68, 0.62, 0.80, 1), Color(0.80, 0.62, 0.72, 1)])
```

> M9 会用色彩师工具替换为真正的莫兰迪低饱和度精确色板。M4 这里用粗略估算保证 SkinManager 能识别 + apply 不 crash。

`games/calendar_puzzle/skins/mono_focus.tres`:

```
[gd_resource type="Resource" script_class="SkinResource" load_steps=2 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/skins/skin_resource.gd" id="1"]

[resource]
script = ExtResource("1")
id = "mono_focus"
display_name = "skin.mono_focus"
board_bg = Color(0.06, 0.06, 0.07, 1)
board_grid = Color(0.18, 0.18, 0.20, 1)
board_date_marker = Color(0.95, 0.95, 0.95, 1)
block_colors = Array[Color]([Color(0.30, 0.30, 0.32, 1), Color(0.40, 0.40, 0.42, 1), Color(0.50, 0.50, 0.52, 1), Color(0.35, 0.35, 0.37, 1), Color(0.45, 0.45, 0.47, 1), Color(0.55, 0.55, 0.57, 1), Color(0.40, 0.40, 0.42, 1), Color(0.50, 0.50, 0.52, 1), Color(0.60, 0.60, 0.62, 1), Color(0.31, 0.27, 0.90, 1)])
```

> 最后一个 U 块用 accent 蓝色作为"选中态"提示色（spec § 皮肤系统 mono_focus 说明）。M9 微调。

- [ ] **Step 4: 写 SkinManager test**

`tests/test_skin_manager.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const SkinManager = preload("res://games/calendar_puzzle/systems/skin_manager.gd")

func test_rescan_finds_three_default_skins():
    var sm := SkinManager.new()
    add_child_autofree(sm)
    sm.rescan()
    var ids := sm.all_ids()
    assert_true(ids.has("default"))
    assert_true(ids.has("pastel"))
    assert_true(ids.has("mono_focus"))
    assert_true(ids.size() >= 3)

func test_get_skin_returns_resource():
    var sm := SkinManager.new()
    add_child_autofree(sm)
    sm.rescan()
    var s := sm.get_skin("default")
    assert_not_null(s)
    assert_eq(s.id, "default")
    assert_eq(s.block_colors.size(), 10)

func test_get_skin_unknown_returns_null():
    var sm := SkinManager.new()
    add_child_autofree(sm)
    sm.rescan()
    assert_null(sm.get_skin("bogus"))

func test_apply_emits_signal():
    var sm := SkinManager.new()
    add_child_autofree(sm)
    sm.rescan()
    var captured := []
    sm.skin_changed.connect(func(id, _skin): captured.append(id))
    sm.apply("pastel")
    assert_eq(captured.size(), 1)
    assert_eq(captured[0], "pastel")

func test_apply_unknown_id_no_signal():
    var sm := SkinManager.new()
    add_child_autofree(sm)
    sm.rescan()
    var captured := []
    sm.skin_changed.connect(func(id, _skin): captured.append(id))
    sm.apply("does_not_exist")
    assert_eq(captured.size(), 0)
```

- [ ] **Step 5: 注册 SkinBus 为 Autoload**

`project.godot` 的 `[autoload]` 段：

```ini
[autoload]

SkinBus="*res://games/calendar_puzzle/systems/skin_manager.gd"
```

> `*` 前缀让它常驻；tab_skins.gd 通过 `/root/SkinBus` 访问。

- [ ] **Step 6: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -15
```

Expected: SkinManager 5 个测试 + 之前的全绿。

- [ ] **Step 7: Commit**

```bash
git add games/calendar_puzzle/skins/ games/calendar_puzzle/systems/skin_manager.gd \
        tests/test_skin_manager.gd project.godot
git commit -m "feat(skins): SkinResource + SkinManager + 3 default skins (placeholder palettes — M9 finalizes)"
```

---

## Task 9 — SlotManager（自动 + 手动存档 + 缩略图）

**Files:**
- Create: `games/calendar_puzzle/systems/slot_manager.gd`
- Modify: `games/calendar_puzzle/scenes/play_scene.gd`
- Modify: `games/calendar_puzzle/game.gd`
- Test: `tests/test_slot_manager.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_slot_manager.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const SlotManager = preload("res://games/calendar_puzzle/systems/slot_manager.gd")
const SaveAdapterTres = preload("res://boot/platform/save_adapter_tres.gd")
const GameSnapshot = preload("res://shared/save/game_snapshot.gd")

const TEST_ROOT := "user://test_slot_manager/"

func before_each():
    _cleanup(TEST_ROOT)
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(TEST_ROOT))

func after_each():
    _cleanup(TEST_ROOT)

func _cleanup(p: String) -> void:
    var d := DirAccess.open(p)
    if d == null: return
    d.list_dir_begin()
    while true:
        var n := d.get_next()
        if n == "": break
        if n in [".", ".."]: continue
        DirAccess.remove_absolute(ProjectSettings.globalize_path(p + n))
    d.list_dir_end()

func _make_mgr() -> SlotManager:
    var save := SaveAdapterTres.new()
    save.root_dir = TEST_ROOT
    var m := SlotManager.new()
    add_child_autofree(m)
    m.bind(save)
    return m

func _make_snap() -> GameSnapshot:
    var s := GameSnapshot.new()
    s.date = "2026-05-26"
    s.difficulty = "hard"
    s.seed = 42
    s.elapsed_seconds = 100
    return s

func test_manual_save_and_load():
    var m := _make_mgr()
    var snap := _make_snap()
    var err := m.save_manual(0, "my-slot", snap, null)
    assert_eq(err, OK)
    var loaded := m.load_manual(0)
    assert_not_null(loaded)
    assert_eq(loaded.slot_name, "my-slot")
    assert_eq(loaded.snapshot.seed, 42)

func test_three_independent_manual_slots():
    var m := _make_mgr()
    var s1 := _make_snap(); s1.seed = 100
    var s2 := _make_snap(); s2.seed = 200
    var s3 := _make_snap(); s3.seed = 300
    m.save_manual(0, "A", s1, null)
    m.save_manual(1, "B", s2, null)
    m.save_manual(2, "C", s3, null)
    assert_eq(m.load_manual(0).snapshot.seed, 100)
    assert_eq(m.load_manual(1).snapshot.seed, 200)
    assert_eq(m.load_manual(2).snapshot.seed, 300)

func test_manual_slot_index_out_of_range_rejected():
    var m := _make_mgr()
    assert_ne(m.save_manual(-1, "x", _make_snap(), null), OK)
    assert_ne(m.save_manual(3, "x", _make_snap(), null), OK)
    assert_null(m.load_manual(-1))
    assert_null(m.load_manual(3))

func test_delete_manual_slot():
    var m := _make_mgr()
    m.save_manual(0, "x", _make_snap(), null)
    assert_not_null(m.load_manual(0))
    m.delete_manual(0)
    assert_null(m.load_manual(0))

func test_autosave_throttle_writes_at_most_once_per_window():
    # 直接调内部 _flush_autosave 检查写次数
    var m := _make_mgr()
    m.throttle_ms = 5000
    var snap := _make_snap()
    var counter := [0]
    # monkey-patch: wrap save adapter write to count
    var orig_write = m._save.write
    # 由于 GDScript 不支持直接 monkey-patch Callable，我们改成读 saved 文件的修改时间间隔验证。
    m.mark_autosave_dirty(snap)
    m._force_flush_for_test()
    counter[0] += 1
    # 立即再写一次 dirty — 不应再立即落盘（节流）
    snap.seed = 99
    m.mark_autosave_dirty(snap)
    var saved_after_throttle := m.load_autosave()
    # 节流期内还是上一次的值
    assert_eq(saved_after_throttle.snapshot.seed, 42)

func test_autosave_force_flush_on_quit():
    var m := _make_mgr()
    var snap := _make_snap()
    snap.seed = 777
    m.mark_autosave_dirty(snap)
    m.force_flush()
    var loaded := m.load_autosave()
    assert_not_null(loaded)
    assert_eq(loaded.snapshot.seed, 777)

func test_thumbnail_round_trip():
    var m := _make_mgr()
    var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
    img.fill(Color(0.2, 0.4, 0.6))
    m.save_manual(1, "with-thumb", _make_snap(), img)
    var loaded := m.load_manual(1)
    assert_not_null(loaded.thumbnail)
    assert_eq(loaded.thumbnail.get_width(), 64)
    var c: Color = loaded.thumbnail.get_pixel(32, 32)
    assert_almost_eq(c.r, 0.2, 0.02)
```

- [ ] **Step 2: 写 SlotManager**

`games/calendar_puzzle/systems/slot_manager.gd`:

```gdscript
# games/calendar_puzzle/systems/slot_manager.gd
# 存档槽管理：
#   - autosave   = key "autosave"     5s 节流；scene_tree quit 时强制 flush
#   - manual 0/1/2 = key "slot_0/1/2"  玩家主动保存
#
# 设计：本类持有 SaveAdapter（M4 = SaveAdapterTres），暴露
#   bind(save) / mark_autosave_dirty(snap) / save_manual(idx, name, snap, thumb) / load_*
#
# 节流用 Godot Timer node（一次性）；mark_autosave_dirty 多次只重启计时器。
class_name SlotManager extends Node

const SlotResource = preload("res://shared/save/slot_resource.gd")
const GameSnapshot = preload("res://shared/save/game_snapshot.gd")

const AUTOSAVE_KEY := "autosave"
const MANUAL_SLOT_COUNT := 3
const DEFAULT_THROTTLE_MS := 5000

@export var throttle_ms: int = DEFAULT_THROTTLE_MS

var _save: SaveAdapter = null
var _pending_snapshot: GameSnapshot = null
var _timer: Timer = null

func bind(save: SaveAdapter) -> void:
    _save = save

func _ready() -> void:
    _timer = Timer.new()
    _timer.one_shot = true
    _timer.timeout.connect(_flush_autosave)
    add_child(_timer)
    # quit 时强制 flush
    get_tree().auto_accept_quit = false
    tree_exiting.connect(force_flush)

func _notification(what: int) -> void:
    if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_PREDELETE:
        force_flush()
        if what == NOTIFICATION_WM_CLOSE_REQUEST:
            get_tree().quit()

# --- autosave ---

# 调用此方法表示游戏状态有变；最多每 throttle_ms 写一次。
func mark_autosave_dirty(snapshot: GameSnapshot) -> void:
    _pending_snapshot = snapshot
    if _timer == null:
        # 测试场景没经 _ready 时（e.g. before bind to tree）
        return
    if _timer.is_stopped():
        _timer.start(throttle_ms / 1000.0)

func _flush_autosave() -> void:
    if _save == null or _pending_snapshot == null:
        return
    var slot := SlotResource.new()
    slot.slot_id = AUTOSAVE_KEY
    slot.slot_name = "autosave"
    slot.saved_at = int(Time.get_unix_time_from_system())
    slot.snapshot = _pending_snapshot
    var err := _save.write(AUTOSAVE_KEY, slot)
    if err != OK:
        push_warning("[SlotManager] autosave write failed: %d" % err)
    _pending_snapshot = null

func force_flush() -> void:
    if _timer:
        _timer.stop()
    _flush_autosave()

func load_autosave() -> SlotResource:
    if _save == null:
        return null
    return _save.read(AUTOSAVE_KEY) as SlotResource

func has_autosave() -> bool:
    var s := load_autosave()
    return s != null and not s.is_empty()

# --- manual slots ---

func _manual_key(index: int) -> String:
    return "slot_%d" % index

func save_manual(index: int, slot_name: String, snapshot: GameSnapshot, thumbnail: Image) -> Error:
    if index < 0 or index >= MANUAL_SLOT_COUNT:
        push_warning("[SlotManager] save_manual index %d out of range" % index)
        return ERR_INVALID_PARAMETER
    if _save == null:
        return ERR_UNAVAILABLE
    var slot := SlotResource.new()
    slot.slot_id = _manual_key(index)
    slot.slot_name = slot_name
    slot.saved_at = int(Time.get_unix_time_from_system())
    slot.snapshot = snapshot
    if thumbnail != null:
        slot.thumbnail = thumbnail
    return _save.write(_manual_key(index), slot)

func load_manual(index: int) -> SlotResource:
    if index < 0 or index >= MANUAL_SLOT_COUNT or _save == null:
        return null
    return _save.read(_manual_key(index)) as SlotResource

func delete_manual(index: int) -> Error:
    if index < 0 or index >= MANUAL_SLOT_COUNT or _save == null:
        return ERR_INVALID_PARAMETER
    return _save.delete(_manual_key(index))

# --- test helpers ---

# 测试中跳过 timer 直接 flush（避免在 unit test 里等 5s）
func _force_flush_for_test() -> void:
    _flush_autosave()
```

- [ ] **Step 3: 修 play_scene 接 SlotManager + SkinBus**

打开 `games/calendar_puzzle/scenes/play_scene.gd`，追加：

```gdscript
const SlotManager = preload("res://games/calendar_puzzle/systems/slot_manager.gd")
const GameSnapshot = preload("res://shared/save/game_snapshot.gd")

var _slot_manager: SlotManager = null

func setup_slot_manager(save_adapter: SaveAdapter) -> void:
    _slot_manager = SlotManager.new()
    add_child(_slot_manager)
    _slot_manager.bind(save_adapter)
    # 把 SkinBus 信号接到自身重渲染
    var bus = get_tree().root.get_node_or_null("SkinBus")
    if bus:
        bus.skin_changed.connect(_on_skin_changed)

# 每次玩家放置 / 移除 / 旋转 / 镜像 / 用提示后调
func _mark_state_dirty() -> void:
    if _slot_manager == null:
        return
    _slot_manager.mark_autosave_dirty(_current_snapshot())

func _current_snapshot() -> GameSnapshot:
    var s := GameSnapshot.new()
    s.date = _current_payload.get("date", "")
    s.difficulty = _current_payload.get("difficulty", "easy")
    s.seed = _current_payload.get("seed", 0)
    s.combo_index = _current_payload.get("combo_index", 0)
    # placed_blocks / elapsed_seconds / hint counts 按 M2 实际状态结构填
    s.placed_blocks = _serialize_placed_blocks() if has_method("_serialize_placed_blocks") else []
    s.elapsed_seconds = _elapsed_seconds if has_method("_elapsed_seconds") else 0
    return s

func restore_from_snapshot(snap: GameSnapshot) -> void:
    # 把题面 + 已放置块 + 计时 + 提示状态全部还原
    var payload := {
        "date": snap.date,
        "difficulty": snap.difficulty,
        "seed": snap.seed,
        "combo_index": snap.combo_index,
    }
    load_puzzle(payload)
    # 然后逐个 reapply placed_blocks（按 M2 setup API）
    for b in snap.placed_blocks:
        if has_method("place_block_from_snapshot"):
            call("place_block_from_snapshot", b)

func _on_skin_changed(_id: String, skin: SkinResource) -> void:
    # 触发棋盘 + 块重渲染（按 M2 / M9 渲染层接口）
    if has_method("apply_skin"):
        apply_skin(skin)

# 捕获 64x64 缩略图（供 SlotManager.save_manual 调用）
func capture_thumbnail() -> Image:
    var vp := get_viewport()
    if vp == null:
        return null
    var img := vp.get_texture().get_image()
    if img == null:
        return null
    img.resize(64, 64, Image.INTERPOLATE_LANCZOS)
    return img
```

> M2 / M9 接口（`_serialize_placed_blocks` / `place_block_from_snapshot` / `apply_skin` / `_elapsed_seconds`）由各自 milestone 实现；M4 这里都用 `has_method` 容错调用，避免 M4 单独执行时崩溃。M2 / M9 完工后回测确保接通。

- [ ] **Step 4: 修 game.gd 在切到 play 时初始化 SlotManager**

`games/calendar_puzzle/game.gd` 内 `_show_play()` 改为：

```gdscript
func _show_play(payload: Dictionary) -> void:
    _swap_to(PLAY_SCENE.instantiate())
    _current.setup_slot_manager(_deps.save)
    _current.load_puzzle(payload)
    if _current.has_signal("exit_to_select"):
        _current.exit_to_select.connect(_show_select)
```

- [ ] **Step 5: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: SlotManager 7 个测试 + 之前的全绿。

- [ ] **Step 6: Commit**

```bash
git add games/calendar_puzzle/systems/slot_manager.gd \
        games/calendar_puzzle/scenes/play_scene.gd \
        games/calendar_puzzle/game.gd \
        tests/test_slot_manager.gd
git commit -m "feat(systems): SlotManager (5s throttled autosave + 3 manual slots + thumbnail capture)"
```

---

## Task 10 — 手动存档槽 UI（暂停菜单 Save/Load 三槽）

**Files:**
- Create: `games/calendar_puzzle/scenes/slot_picker.tscn`
- Create: `games/calendar_puzzle/scenes/slot_picker.gd`
- Modify: `games/calendar_puzzle/scenes/play_scene.gd`（添加 Save/Load 按钮）

> 现存 spec 暗示玩家在 play_scene 暂停菜单或主菜单都可以 save / load。本 task 实现最小路径：play_scene 顶部加 Save / Load 按钮 → 弹 slot_picker 列出 3 槽 → 选一槽 save/load。

- [ ] **Step 1: 写 slot_picker.gd**

`games/calendar_puzzle/scenes/slot_picker.gd`:

```gdscript
# games/calendar_puzzle/scenes/slot_picker.gd
# 3 槽选择器：Save 模式 = 让玩家选目标槽 + 填名字；Load 模式 = 选已有槽。
extends Control

signal slot_chosen(index: int, slot_name: String)
signal cancelled()

const SlotManager = preload("res://games/calendar_puzzle/systems/slot_manager.gd")

enum Mode { SAVE, LOAD }

var mode: int = Mode.SAVE
var _mgr: SlotManager = null

@onready var _title: Label = $V/Title
@onready var _grid: GridContainer = $V/Grid
@onready var _btn_cancel: Button = $V/Footer/Cancel

func setup(slot_mgr: SlotManager, m: int) -> void:
    _mgr = slot_mgr
    mode = m
    _title.text = "Save Game" if mode == Mode.SAVE else "Load Game"
    _build_rows()

func _ready() -> void:
    if _btn_cancel:
        _btn_cancel.pressed.connect(func(): cancelled.emit(); queue_free())

func _build_rows() -> void:
    for c in _grid.get_children():
        c.queue_free()
    for i in range(SlotManager.MANUAL_SLOT_COUNT):
        var slot = _mgr.load_manual(i)
        var row := HBoxContainer.new()
        var thumb := TextureRect.new()
        thumb.custom_minimum_size = Vector2(64, 64)
        if slot and slot.thumbnail:
            thumb.texture = ImageTexture.create_from_image(slot.thumbnail)
        row.add_child(thumb)
        var info := VBoxContainer.new()
        info.size_flags_horizontal = SIZE_EXPAND_FILL
        var name_label := Label.new()
        name_label.text = (slot.slot_name if slot else "<empty>")
        info.add_child(name_label)
        var ts_label := Label.new()
        ts_label.text = Time.get_datetime_string_from_unix_time(slot.saved_at) if slot else ""
        info.add_child(ts_label)
        row.add_child(info)
        var btn := Button.new()
        if mode == Mode.SAVE:
            btn.text = "Save here"
            btn.pressed.connect(func(): _on_save_picked(i))
        else:
            btn.text = "Load"
            btn.disabled = slot == null or slot.is_empty()
            btn.pressed.connect(func(): _on_load_picked(i))
        row.add_child(btn)
        _grid.add_child(row)

func _on_save_picked(i: int) -> void:
    # 简化：弹个 LineEdit dialog；M4 用内联输入
    var dlg := AcceptDialog.new()
    dlg.title = "Slot name"
    var input := LineEdit.new()
    input.text = "slot %d" % (i + 1)
    dlg.add_child(input)
    add_child(dlg)
    dlg.popup_centered(Vector2(300, 100))
    dlg.confirmed.connect(func():
        slot_chosen.emit(i, input.text)
        queue_free())

func _on_load_picked(i: int) -> void:
    slot_chosen.emit(i, "")
    queue_free()
```

`games/calendar_puzzle/scenes/slot_picker.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/scenes/slot_picker.gd" id="1"]

[node name="SlotPicker" type="Control"]
anchor_right = 1.0
anchor_bottom = 1.0
script = ExtResource("1")

[node name="Bg" type="ColorRect" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
color = Color(0, 0, 0, 0.7)

[node name="V" type="VBoxContainer" parent="."]
anchor_left = 0.5
anchor_right = 0.5
anchor_top = 0.5
anchor_bottom = 0.5
offset_left = -240.0
offset_top = -180.0
offset_right = 240.0
offset_bottom = 180.0

[node name="Title" type="Label" parent="V"]
text = "Save Game"

[node name="Grid" type="GridContainer" parent="V"]
columns = 1
size_flags_vertical = 3

[node name="Footer" type="HBoxContainer" parent="V"]

[node name="Cancel" type="Button" parent="V/Footer"]
text = "Cancel"
```

- [ ] **Step 2: 在 play_scene 加 Save/Load 按钮触发**

打开 `games/calendar_puzzle/scenes/play_scene.gd`，在 `_ready()` 末尾加：

```gdscript
const SlotPickerScene = preload("res://games/calendar_puzzle/scenes/slot_picker.tscn")

func _open_save_picker() -> void:
    var p := SlotPickerScene.instantiate()
    add_child(p)
    p.setup(_slot_manager, 0)  # 0 = SAVE
    p.slot_chosen.connect(_on_save_chosen)

func _open_load_picker() -> void:
    var p := SlotPickerScene.instantiate()
    add_child(p)
    p.setup(_slot_manager, 1)  # 1 = LOAD
    p.slot_chosen.connect(_on_load_chosen)

func _on_save_chosen(index: int, slot_name: String) -> void:
    var thumb := capture_thumbnail()
    var snap := _current_snapshot()
    _slot_manager.save_manual(index, slot_name, snap, thumb)

func _on_load_chosen(index: int, _name: String) -> void:
    var slot := _slot_manager.load_manual(index)
    if slot == null or slot.is_empty():
        return
    restore_from_snapshot(slot.snapshot)
```

> M2 实际 play_scene HUD 上加两个按钮（"💾 Save" / "📂 Load"），点击调上面方法。具体绑定按 M2 HUD 接口对齐。

- [ ] **Step 3: 跑测试 + 手工 QA**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected: 之前全绿（本 task 无新单测；交互流靠 Task 11 手工 QA）。

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/scenes/slot_picker.gd \
        games/calendar_puzzle/scenes/slot_picker.tscn \
        games/calendar_puzzle/scenes/play_scene.gd
git commit -m "feat(scenes): slot picker UI for 3 manual save slots (save/load modes)"
```

---

## Task 11 — 端到端冒烟 + 全链路 QA

**Files:**
- Create: `docs/m4-evidence/`（测试日志 + 截图）

- [ ] **Step 1: 跑全套测试**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tests/run_tests.gd 2>&1 | tee /tmp/m4-tests.log
tail -5 /tmp/m4-tests.log
```

Expected: 看到 `<N> passed, 0 failed`。M4 新增约 ~35 个 test：settings 5 + profile 4 + slot 3 + save_adapter 6 + key_capture 8 + skin_manager 5 + slot_manager 7 + main_menu 3 ≈ 41。加 M0-M3 既有 → 80+。

- [ ] **Step 2: GUI 启动 + 主菜单 QA**

```bash
godot
```

观察：

```
[ ] 主菜单显示 4 个按钮
[ ] 首次启动 Continue 灰显
[ ] New Game → select_scene → 选难度 + 日期 → Start → play_scene
[ ] 在 play_scene 玩 30 秒 → Escape 或自带返回回主菜单 → Continue 现在亮
[ ] Continue → 回到刚才的题面 + 计时 + 已放块
```

- [ ] **Step 3: 手动存档 QA**

```
[ ] play_scene 点 Save → SlotPicker → 选 slot 0 → 输名字 "test1"
[ ] 文件系统看到 user://saves/slot_0.tres 存在
[ ] 改完题再 Save → 选 slot 1 → 输 "test2"
[ ] Load → SlotPicker → 选 slot 0 → 题恢复到 test1 时的状态
[ ] 3 个槽都有数据后 thumbnail 缩略图可见
```

- [ ] **Step 4: 设置面板 QA**

```
[ ] 主菜单 → Settings → 弹出
[ ] General tab: 拖音量滑块实时听变化
[ ] General tab: 切换主题（M9 完整生效；M4 至少 settings.theme 字段被改）
[ ] General tab: 切语言 → 立即 i18n 切（M7 完整接入后看效果）
[ ] General tab: Reset All → 所有控件回默认
[ ] Controls tab: 5 个 action 行可见；点 rotate 旁按钮 → "[capturing]"
[ ] Controls tab: 按 Q → 显示 "Q"；点 mirror 按 Q → 冲突警告 + rotate 变 "" + mirror 变 "Q"
[ ] Controls tab: Reset Bindings → 5 个回默认
[ ] Controls tab: 按 Ctrl+Z 给 undo → 显示 "Ctrl+Z"
[ ] Skins tab: 看到 3 个色块（default/pastel/mono_focus 占位色）
[ ] Skins tab: 点 pastel → "Current: pastel" + play_scene 重新进入时颜色变化
[ ] 关闭设置 → 重启游戏 → 所有设置保留
```

- [ ] **Step 5: Autosave 节流 + quit-flush QA**

```
[ ] 玩 6 秒不停拖块 → 看 file mtime 5s 间隔 ~1 次（不是每次拖都写）
[ ] 关游戏 (Cmd+Q) → 重启 → Continue → 状态恢复到关闭前的最后一刻
[ ] 系统强杀（kill -9）→ 重启 → Continue → 状态恢复到最后一次 autosave flush（最多丢 5s）
```

- [ ] **Step 6: 截图归档**

```bash
mkdir -p docs/m4-evidence
# 主菜单 / 设置三标签 / slot picker 各截 1 张
ls docs/m4-evidence/main-menu.png \
   docs/m4-evidence/settings-general.png \
   docs/m4-evidence/settings-controls.png \
   docs/m4-evidence/settings-skins.png \
   docs/m4-evidence/slot-picker-save.png \
   docs/m4-evidence/slot-picker-load.png
cp /tmp/m4-tests.log docs/m4-evidence/all-tests-final.log
```

- [ ] **Step 7: Commit evidence**

```bash
git add docs/m4-evidence/
git commit -m "test(m4): all-tests + UI screenshots evidence"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**:
- ✅ "主菜单 (继续/新游戏/设置/退出)" → Task 5 (main_menu) + Task 11 QA
- ✅ "设置面板含 KeyCapture 重映射 UI" → Task 6 (KeyCapture) + Task 7 (tab_controls)
- ✅ "皮肤选择器" → Task 7 (tab_skins) + Task 8 (SkinManager + 3 .tres)
- ✅ "3 槽手动存档 + 缩略图" → Task 9 (SlotManager.save_manual) + Task 10 (SlotPicker UI) + Task 11 QA
- ✅ "自动存档 5s 节流" → Task 9 (Timer one-shot + mark_autosave_dirty)
- ✅ "替换 StubSaveAdapter" → Task 3 (SaveAdapterTres) + Task 4 (boot.gd 切换)
- ✅ "Steam Cloud 同步" → 文档化为零代码（Steamworks 后台配置 `user://saves/*`；M6 验证）

**2. Placeholder scan**:
- 无 TBD / TODO 残留；所有代码块完整可粘
- 显式的"M9 完成"占位（tab_skins 用 ColorRect 占位 + 3 个 .tres 用粗略色板）已在文件结构 + Task 8 标注 "M4→M9 依赖"；M9 plan 必须 follow up
- 显式的"M2 接口对齐"占位（`_serialize_placed_blocks` / `place_block_from_snapshot` / `apply_skin` / `_elapsed_seconds`）用 `has_method` 容错，让 M4 单独跑测不崩
- Steam Cloud 配置不是代码任务，写在 M6 而非 M4

**3. Type consistency**:
- `SaveAdapter.write(key: String, resource: Resource) -> Error` — M0 接口 + Task 3 实现 + Task 9 (SlotManager.save_manual / autosave) 调用一致
- `SaveAdapter.read(key: String) -> Resource` — 同上 + Task 9 load_autosave/load_manual + Task 5 boot.continue 一致
- `SlotResource{slot_id, slot_name, saved_at, snapshot, thumbnail}` — Task 2 定义 + Task 3 round-trip 测试 + Task 9 SlotManager 填充 + Task 10 SlotPicker 渲染一致
- `GameSnapshot{date, difficulty, seed, combo_index, placed_blocks, elapsed_seconds, weak/medium/strong_hint_used, saved_at}` — Task 2 定义 + Task 9 _current_snapshot 填 + Task 9 restore_from_snapshot 读一致
- `SettingsResource.kbm_bindings: Dictionary[String, String]` — Task 1 定义 + Task 6 KeyCapture serialize 输出格式（"R" / "Ctrl+Z"）+ Task 7 tab_controls 写入 + Task 1 find_action_for_key 冲突检测一致
- `ProfileResource.settings/progress/stats/tutorial_done` — Task 1 定义 + Task 4 boot 加载 + Task 7 settings_panel bind 修改一致
- `SkinResource.id/display_name/board_*/block_colors/thumbnail` — Task 8 定义 + Task 8 三个 .tres 填字段 + Task 8 SkinManager.rescan 读 + Task 7 tab_skins 渲染 + Task 9 play_scene apply_skin 接收一致

**4. Ambiguity**:
- M2 实际 play_scene 渲染 / 状态序列化 API 不在 M4 控制范围 → 显式 `has_method` 容错调用 + 在 Task 9 Step 3 备注 "M2 / M9 完工后回测"
- M9 真实皮肤色板和 thumbnail 未做 → Task 8 注释 "M4→M9 依赖"，并在 Step 3 placeholder 色板里给可工作但粗糙的初始值
- Steam Cloud 同步零代码（M0 spec 已论述 user://saves/* 整目录自动同步）→ 不写代码任务，M6 在 Steamworks 配置 + 验证

**5. Test depth**:
- 单元层 ~41 个新测试：SettingsResource 5 / ProfileResource 4 / SlotResource 3 / SaveAdapterTres 6 / KeyCapture 8 / SkinManager 5 / SlotManager 7 / MainMenu 3
- 集成层：Task 4 boot 启动 + profile 自动建文件、Task 8 SkinManager 实际扫描 res:// 目录、Task 11 手工 QA 全链路
- 数据层：SaveAdapterTres 用 user://test_saves/ 隔离目录 + before_each/after_each 清理；SlotManager 同样隔离

无发现要修。M4 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M4 实施时用 superpowers:subagent-driven-development。每个 Task 派一个 fresh subagent → review → 下一个 Task。

依赖图：

- Task 1 (Resource 类) 独立 — 可与 Task 2 / Task 6 并发
- Task 2 (GameSnapshot + SlotResource) 独立 — 可与 Task 1 / Task 6 并发
- Task 3 (SaveAdapterTres) 依赖 Task 1 + Task 2
- Task 4 (boot 切换) 依赖 Task 3
- Task 5 (MainMenu) 依赖 Task 4
- Task 6 (KeyCapture) 独立 — 可与 Task 1-5 并发
- Task 7 (Settings Panel) 依赖 Task 1 + Task 6 + Task 8 (skin scan)
- Task 8 (SkinManager + 3 .tres) 独立 — 可与 Task 1-5 并发
- Task 9 (SlotManager) 依赖 Task 1 + Task 2 + Task 3
- Task 10 (SlotPicker UI) 依赖 Task 9
- Task 11 (QA) 依赖全部

建议并发批次：

1. **Batch A**（4 个 subagent 同时）= Task 1 + Task 2 + Task 6 + Task 8
2. **Batch B** = Task 3 (依赖 1+2) → Task 9 (依赖 3)；Task 4 (依赖 3) → Task 5 (依赖 4)；Task 7 (依赖 1+6+8)
3. **Batch C** = Task 10 (依赖 9)
4. **Batch D** = Task 11 (依赖全部)

跨 milestone 注意：
- Task 9 的 play_scene 修改使用 `has_method` 容错调用 M2 接口；M2 完工后回测确保 `_serialize_placed_blocks` / `place_block_from_snapshot` 真的实现了
- Task 8 的 3 个 .tres 用粗略色板；M9 必须有"细化 3 个皮肤"task 填精确色 + 真 thumbnail
- Steam Cloud 配置在 M6（Steamworks 后台设置 `user://saves/*`），M4 不接 — 别把它塞进本 milestone scope

---

## Plan-bug log (post-execution corrections — 2026-06-01)

> 本段在首次执行 M4 时（2026-06-01）现场发现并修正的 plan 偏差。**原 task 文本未改，保留 diff 价值**；如未来重跑 M4 plan，按本段调整再粘。

### 1. Task 2 — `func test_save_and_load_round_trip(tmp_path = "...")` 同 M3 老 bug

GUT 不传参 → 默认参数死代码。改：

```gdscript
func test_save_and_load_round_trip():
    var tmp_path = "user://test_slot_round_trip.tres"
    ...
```

(M3 Task 2 已 fix；M4 Task 2 同样需要。)

### 2. Task 4 + Task 7 — `_apply_settings` / `_live_apply_fullscreen` 强制 WINDOWED 会蹂躏 M2 Maximized fix

M2 follow-up commit `55616ae` 在 `project.godot` 加了 `window/size/mode=2`（Maximized），让 Mac app 开窗即满屏。Task 4 plan 的 `_apply_settings` 和 Task 7 plan 的 `tab_general._live_apply_fullscreen` 都用：

```gdscript
DisplayServer.window_set_mode(
    DisplayServer.WINDOW_MODE_FULLSCREEN if s.fullscreen
    else DisplayServer.WINDOW_MODE_WINDOWED)
```

`s.fullscreen=false`（默认）时强制走 WINDOWED 把 Maximized 改回小窗。修：

```gdscript
# Task 4 _apply_settings：默认 false 时**不动**窗口模式（保持 project.godot 的 Maximized）
if s.fullscreen:
    DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)

# Task 7 _live_apply_fullscreen：用户取消勾选时回 MAXIMIZED 不是 WINDOWED
func _live_apply_fullscreen() -> void:
    if _profile.settings.fullscreen:
        DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
    else:
        DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
```

### 3. Task 5 — boot.gd 不能 preload 还不存在的 `settings_panel.tscn`

Task 5 plan 写 `const SettingsPanel = preload("res://boot/settings/settings_panel.tscn")`，但 settings_panel 在 Task 7 才建，preload 在 parse time fail。

Fix：Task 5 的 `_on_settings` 留 stub `push_warning("[boot] settings panel pending — Task 7 will land")`；Task 7 时再加 preload + 改 stub body。

### 4. Task 7 — plan 没明说要更新 boot.gd 接 Task 5 stub

Task 7 plan 列了 8 个新文件但漏掉 `boot/boot.gd` 修改。Task 7 实际需要：

```gdscript
# boot.gd 顶部加 preload：
const SettingsPanel = preload("res://boot/settings/settings_panel.tscn")

# 把 Task 5 留的 push_warning stub 替换为真实 body：
func _on_settings() -> void:
    var panel := SettingsPanel.instantiate()
    panel.bind(_profile)
    panel.closed.connect(_on_settings_closed)
    add_child(panel)
```

`_on_settings_closed` 在 Task 5 已建好（保存 profile + reapply settings），不动。

### 5. Task 9 — play_scene plan 引用了 M2 不存在的 API

Plan 写：
- `_serialize_placed_blocks()` — 不存在；M2 用 `placed_blocks: Array` 实例变量直接访问
- `place_block_from_snapshot(b)` — 不存在；restore 逻辑改成"基于 generate_puzzle 还原 generated state → 用 snap 覆写 placed → 重算 palette = (full 10 - placed_ids)"
- `_elapsed_seconds` 字段 — 不存在；M2 有 `get_elapsed_seconds() -> float` getter
- `apply_skin(skin)` — 不存在（M9 工作）；保留 `has_method` 守卫，但要用 `call("apply_skin", skin)` 而非直接调用——GDScript 静态解析在 `has_method` 守卫里仍拒绝直接调用未声明方法

正确 restore_from_snapshot 框架（详见已实施 commit `8c47985`）：

```gdscript
func restore_from_snapshot(snap: GameSnapshot) -> void:
    if snap == null or snap.is_empty(): return
    var payload := { "date": snap.date, "difficulty": snap.difficulty,
                     "seed": snap.seed, "combo_index": snap.combo_index }
    load_puzzle(payload)                              # base state
    if snap.placed_blocks.size() > 0:
        # overwrite placed_blocks + 重算 palette + 重锚 timer
        ...
    _start_time_ms = Time.get_ticks_msec() - snap.elapsed_seconds * 1000
```

`_mark_state_dirty` 暂时**不**接到 M2 input handlers — 风险大，会触发 7 个 play_scene_integration 测试回归。M5+ 接。

---

## Execution log (2026-05-30 → 2026-06-01)

Branch: `feat/m4-ui-shell-saves` on `~/mygit/calendar-puzzle-godot/`，从 `feat/m3-puzzle-generation` tip 派生（M3 全套 commits 都在 base）。

| Task | Commit | Tests | Plan-bug fix |
|---|---|---|---|
| 1 Resource 类 | `34a67ab` | 162/162 | — |
| 2 GameSnapshot+SlotResource | `0151508` | 165/165 | #M4-? 默认参数 |
| 3 SaveAdapterTres | `f35cb22` | 171/171 | — |
| 4 boot SaveAdapterTres | `797babb` | 171/171 | #M4-1 fullscreen→Maximized |
| 5 MainMenu | `76e91a8` | 174/174 | #M4-2 settings stub |
| 6 KeyCapture widget | `3d046f1` | 182/182 | — |
| 8 Skin foundation | `49a1fe3` | 187/187 | — |
| 9 SlotManager | `8c47985` | 194/194 | #M4-3 M2 真 API |
| 7 Settings panel | TBD（in flight） | TBD | #M4-4 fullscreen + #M4-5 boot 接线 |
| 10 SlotPicker UI | TBD | TBD | TBD |
| 11 全链路 QA | TBD | TBD | TBD |
