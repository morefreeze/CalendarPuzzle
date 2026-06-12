# M2 — 核心玩法场景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `play_scene.tscn` 主玩法场景：渲染 8×7 棋盘 + palette、支持鼠标/键盘拖放、R 旋转 / F 镜像、双击移除、胜利检测；同时把 M0 临时塞进去的 `StubInputContext` 换成真正的 `InputRouter`（鼠标 + 键盘 + 触屏全路由），完成 spec § 输入抽象的硬约束（游戏代码只处理 InputContext signals）。

**Architecture:** play_scene 完全运行在 M1 的 solver 之上（用 `Board.is_valid_placement` / `Board.check_game_win`），不重复造放置校验逻辑。Scene 树由 `play_scene.gd`（Control 根节点）+ 两个子 Control（`BoardView` 自定义 _draw、`PaletteView` 用 HBoxContainer）+ 一个 `BlockGhost`（拖动预览）组成。**模块边界硬约束**：play_scene.gd 通过构造时注入的 `GameDeps.input` 订阅事件，绝不直接 `_input(event)` 监听 Godot 原始 InputEvent。

**Tech Stack:** Godot 4.3+（GDScript）、Godot Control + `_draw()` 自绘棋盘（不用 TileMap，因为 cell 内容不是图素而是字符 + 颜色）、GUT v9 集成测试（用 `SceneTree.create_timer` + 信号触发模拟交互）。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § 输入抽象层 / § 功能矩阵（核心拖放/双击移除）/ § Milestones M2 / § Testing strategy

**Acceptance gates（从 spec 抄）：**
- 鼠标左键按下/移动/松开完成方块从 palette 拖到棋盘并 fit_put 校验通过则落定
- 拖动中按 R 旋转、F 镜像；ghost preview 同步反映新形状
- 双击已放置方块 → 移回 palette
- 全部 10 方块覆盖完成（除 uncoverable 外）→ 触发 win signal → 简单"You won!" overlay
- `boot/platform/input_router.gd` 替换 M0 的 stub；启动后 boot 注入的 `deps.input` 是 InputRouter 实例
- `tests/test_play_scene.gd` 用 scene-load + signal-emit 模拟所有交互路径，全绿
- 真机 GUI 启动 → 玩一局 happy path 不报错，截图归档

---

## File Structure

本 milestone 新增 / 修改的所有文件（全部在 `~/mygit/calendar-puzzle-godot/`）：

```
calendar-puzzle-godot/
├── boot/
│   ├── boot.gd                                # MOD: 注入 InputRouter 替 StubInputContext
│   └── platform/
│       ├── input_router.gd                    # NEW: 真实 InputContext 实现
│       └── action_bindings.gd                 # NEW: 默认 rotate/mirror/hint/undo/menu 绑定表
├── games/calendar_puzzle/
│   ├── game.gd                                # MOD: start(deps) 不再仅显示 stub label,
│   │                                          #      而是 instantiate PlayScene
│   └── scenes/
│       ├── play_scene.tscn                    # NEW: 主玩法场景
│       ├── play_scene.gd                      # NEW: 玩法控制脚本
│       ├── board_view.gd                      # NEW: 棋盘自绘 Control
│       ├── palette_view.gd                    # NEW: 方块 palette
│       ├── block_ghost.gd                     # NEW: 拖动 ghost 预览
│       └── win_overlay.gd                     # NEW: 胜利覆盖层
├── tests/
│   ├── test_input_router.gd                   # NEW: InputRouter 单测（事件路由）
│   ├── test_action_bindings.gd                # NEW: 默认绑定 + lookup 单测
│   ├── test_play_scene.gd                     # NEW: play_scene 集成测试（含拖放/旋转/胜利）
│   └── fixtures/
│       └── easy_seeded_puzzle.gd              # NEW: 固定 seed 的 easy 题面，给集成测试用
└── docs/
    └── m2-smoke-screenshot.png                # NEW: 真机一局 happy path 截图
```

> Notes:
> - 不依赖 M1 的 `pack_free.tres` 进行测试；`easy_seeded_puzzle.gd` 用固定棋盘数据避免每次测试都跑 generator（M1 已经验证 generator 正确性）。
> - 不引入新插件。GUT v9 自带 scene-load + signal-await 能力。

---

## Task 1 — 定义 ActionBindings（默认键位映射）

**Files:**
- Create: `boot/platform/action_bindings.gd`
- Test: `tests/test_action_bindings.gd`

把 spec § 输入抽象层 / 按键重映射的 5 个抽象 action 默认绑定写成独立资源类，方便 M4 设置面板 KeyCapture UI 读写、M9 主题化等场景复用。本 Task 不实现 KeyCapture UI（M4），只做数据层。

- [ ] **Step 1: 写 failing tests**

`tests/test_action_bindings.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const ActionBindings = preload("res://boot/platform/action_bindings.gd")

func test_defaults_contain_all_5_actions():
    var ab = ActionBindings.new()
    var actions := ab.list_actions()
    actions.sort()
    assert_eq(actions, ["hint", "menu", "mirror", "rotate", "undo"])

func test_default_rotate_is_R():
    var ab = ActionBindings.new()
    var ev := ab.get_event_for("rotate") as InputEventKey
    assert_not_null(ev)
    assert_eq(ev.physical_keycode, KEY_R)
    assert_false(ev.ctrl_pressed)

func test_default_undo_is_ctrl_z():
    var ab = ActionBindings.new()
    var ev := ab.get_event_for("undo") as InputEventKey
    assert_not_null(ev)
    assert_eq(ev.physical_keycode, KEY_Z)
    assert_true(ev.ctrl_pressed)

func test_match_event_returns_action_id():
    var ab = ActionBindings.new()
    var probe := InputEventKey.new()
    probe.physical_keycode = KEY_F
    probe.pressed = true
    assert_eq(ab.match_event(probe), "mirror")

func test_match_event_non_match_returns_empty_string():
    var ab = ActionBindings.new()
    var probe := InputEventKey.new()
    probe.physical_keycode = KEY_X
    probe.pressed = true
    assert_eq(ab.match_event(probe), "")

func test_match_event_ignores_modifier_mismatch():
    # Ctrl+Z = undo. Plain Z must NOT match undo.
    var ab = ActionBindings.new()
    var probe := InputEventKey.new()
    probe.physical_keycode = KEY_Z
    probe.pressed = true
    probe.ctrl_pressed = false
    assert_eq(ab.match_event(probe), "")

func test_set_binding_replaces_existing():
    var ab = ActionBindings.new()
    var ev := InputEventKey.new()
    ev.physical_keycode = KEY_T
    ab.set_binding("rotate", ev)
    var got := ab.get_event_for("rotate") as InputEventKey
    assert_eq(got.physical_keycode, KEY_T)
```

- [ ] **Step 2: 跑测试看红**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 7 个 ActionBindings 测试 FAIL。

- [ ] **Step 3: 实现 action_bindings.gd**

`boot/platform/action_bindings.gd`:

```gdscript
# boot/platform/action_bindings.gd
# Default keyboard/mouse bindings for the 5 abstract actions used by the game.
# M4 settings UI persists overrides via SettingsResource.kbm_bindings; this
# class is the data layer + lookup helpers.
class_name ActionBindings extends RefCounted

# action_id → InputEvent (typically InputEventKey or InputEventMouseButton)
var _bindings: Dictionary = {}

func _init() -> void:
    _bindings = _build_defaults()

# Spec § Defaults: rotate=R, mirror=F, hint=H, undo=Ctrl+Z, menu=Escape.
func _build_defaults() -> Dictionary:
    var out: Dictionary = {}

    var rotate := InputEventKey.new()
    rotate.physical_keycode = KEY_R
    out["rotate"] = rotate

    var mirror := InputEventKey.new()
    mirror.physical_keycode = KEY_F
    out["mirror"] = mirror

    var hint := InputEventKey.new()
    hint.physical_keycode = KEY_H
    out["hint"] = hint

    var undo := InputEventKey.new()
    undo.physical_keycode = KEY_Z
    undo.ctrl_pressed = true
    out["undo"] = undo

    var menu := InputEventKey.new()
    menu.physical_keycode = KEY_ESCAPE
    out["menu"] = menu

    return out

func list_actions() -> PackedStringArray:
    return PackedStringArray(_bindings.keys())

func get_event_for(action: String) -> InputEvent:
    return _bindings.get(action, null)

func set_binding(action: String, event: InputEvent) -> void:
    _bindings[action] = event

# Returns the action_id matched by `event`, or "" if none.
# For InputEventKey, compares physical_keycode + modifier flags (ctrl/shift/alt/meta).
func match_event(event: InputEvent) -> String:
    if event is InputEventKey:
        if not event.pressed:
            return ""
        for action in _bindings.keys():
            var bound = _bindings[action]
            if not (bound is InputEventKey):
                continue
            if bound.physical_keycode != event.physical_keycode:
                continue
            if bound.ctrl_pressed != event.ctrl_pressed: continue
            if bound.shift_pressed != event.shift_pressed: continue
            if bound.alt_pressed != event.alt_pressed: continue
            if bound.meta_pressed != event.meta_pressed: continue
            return action
    elif event is InputEventMouseButton:
        if not event.pressed:
            return ""
        for action in _bindings.keys():
            var bound = _bindings[action]
            if not (bound is InputEventMouseButton):
                continue
            if bound.button_index == event.button_index:
                return action
    return ""
```

- [ ] **Step 4: 跑测试看绿**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 之前的所有测试 + 7 ActionBindings = N + 7 passed。

- [ ] **Step 5: Commit**

```bash
git add boot/platform/action_bindings.gd tests/test_action_bindings.gd
git commit -m "feat(input): ActionBindings with default rotate/mirror/hint/undo/menu mapping"
```

---

## Task 2 — 实现 InputRouter（替换 M0 stub）

**Files:**
- Create: `boot/platform/input_router.gd`
- Test: `tests/test_input_router.gd`

InputRouter 是一个挂在场景树上的 Node（不是 RefCounted），需要监听 Godot 的 `_input(event)`。它本身扩展 `InputContext` 抽象类（M0 已定义），把原生 InputEvent 翻译为 InputContext signal。

> **关键决策**：InputContext 在 M0 被定义成 `extends RefCounted`，没法挂场景树。本 Task 把 InputRouter 实现成 Node，**通过组合而非继承**：InputRouter 内部持有一个 InputContext 实例并 forward 信号。或者更直接的做法——把 M0 的 InputContext 改成 extends Node 适合 _input 用。**走后者**：M0 写 InputContext 时是 stub，没人挂到场景树；改成 Node 不影响 M0 stub（stub 不需要被 add_child 也能 emit）。

- [ ] **Step 1: 把 M0 的 InputContext 从 RefCounted 改成 Node**

打开 `shared/input/input_context.gd`，把 `extends RefCounted` 改成 `extends Node`。其余不动。

```bash
# 验证
grep "extends" shared/input/input_context.gd
# Expected: extends Node
```

- [ ] **Step 2: 同步改 M0 stub**

打开 `boot/platform/stub_input_context.gd`，确认 `extends InputContext` 不动即可（继承链自动跟随）。

跑 M0 测试验证不破坏：

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected: 所有测试仍然 PASS。

- [ ] **Step 3: 写 InputRouter failing tests**

`tests/test_input_router.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const InputRouter = preload("res://boot/platform/input_router.gd")

var _router: InputRouter
var _signals_caught: Array = []

func before_each():
    _router = InputRouter.new()
    add_child_autofree(_router)
    _signals_caught = []
    _router.pointer_pressed.connect(func(p): _signals_caught.append(["pp", p]))
    _router.pointer_released.connect(func(p): _signals_caught.append(["pr", p]))
    _router.pointer_moved.connect(func(p): _signals_caught.append(["pm", p]))
    _router.action_triggered.connect(func(a): _signals_caught.append(["act", a]))

func test_mouse_left_press_emits_pointer_pressed():
    var ev := InputEventMouseButton.new()
    ev.button_index = MOUSE_BUTTON_LEFT
    ev.pressed = true
    ev.position = Vector2(123, 456)
    _router._input(ev)
    assert_eq(_signals_caught.size(), 1)
    assert_eq(_signals_caught[0][0], "pp")
    assert_eq(_signals_caught[0][1], Vector2(123, 456))

func test_mouse_left_release_emits_pointer_released():
    var ev := InputEventMouseButton.new()
    ev.button_index = MOUSE_BUTTON_LEFT
    ev.pressed = false
    ev.position = Vector2(50, 60)
    _router._input(ev)
    assert_eq(_signals_caught[0][0], "pr")
    assert_eq(_signals_caught[0][1], Vector2(50, 60))

func test_mouse_right_button_does_not_emit_pointer():
    var ev := InputEventMouseButton.new()
    ev.button_index = MOUSE_BUTTON_RIGHT
    ev.pressed = true
    ev.position = Vector2(10, 10)
    _router._input(ev)
    assert_eq(_signals_caught.size(), 0)

func test_mouse_motion_emits_pointer_moved():
    var ev := InputEventMouseMotion.new()
    ev.position = Vector2(200, 300)
    _router._input(ev)
    assert_eq(_signals_caught[0][0], "pm")
    assert_eq(_signals_caught[0][1], Vector2(200, 300))

func test_keyboard_R_triggers_rotate_action():
    var ev := InputEventKey.new()
    ev.physical_keycode = KEY_R
    ev.pressed = true
    _router._input(ev)
    assert_eq(_signals_caught[0], ["act", "rotate"])

func test_keyboard_F_triggers_mirror_action():
    var ev := InputEventKey.new()
    ev.physical_keycode = KEY_F
    ev.pressed = true
    _router._input(ev)
    assert_eq(_signals_caught[0], ["act", "mirror"])

func test_keyboard_unbound_key_no_action():
    var ev := InputEventKey.new()
    ev.physical_keycode = KEY_X
    ev.pressed = true
    _router._input(ev)
    assert_eq(_signals_caught.size(), 0)

func test_touch_press_emits_pointer_pressed():
    var ev := InputEventScreenTouch.new()
    ev.pressed = true
    ev.position = Vector2(80, 90)
    _router._input(ev)
    assert_eq(_signals_caught[0][0], "pp")
    assert_eq(_signals_caught[0][1], Vector2(80, 90))

func test_touch_drag_emits_pointer_moved():
    var ev := InputEventScreenDrag.new()
    ev.position = Vector2(110, 120)
    _router._input(ev)
    assert_eq(_signals_caught[0][0], "pm")

func test_get_pointer_position_tracks_last_seen():
    var ev := InputEventMouseMotion.new()
    ev.position = Vector2(11, 22)
    _router._input(ev)
    assert_eq(_router.get_pointer_position(), Vector2(11, 22))

func test_is_action_held_returns_true_after_press():
    var ev := InputEventKey.new()
    ev.physical_keycode = KEY_R
    ev.pressed = true
    _router._input(ev)
    assert_true(_router.is_action_held("rotate"))
    var rel := InputEventKey.new()
    rel.physical_keycode = KEY_R
    rel.pressed = false
    _router._input(rel)
    assert_false(_router.is_action_held("rotate"))
```

- [ ] **Step 4: 实现 InputRouter**

`boot/platform/input_router.gd`:

```gdscript
# boot/platform/input_router.gd
# Concrete InputContext implementation. Translates Godot InputEvent to the
# InputContext signal vocabulary used by game modules.
# Must be added to the scene tree (it overrides _input).
extends InputContext

const ActionBindings = preload("res://boot/platform/action_bindings.gd")

var bindings: ActionBindings
var _last_pointer_pos: Vector2 = Vector2.ZERO
var _held_actions: Dictionary = {}    # action_id → true

func _init() -> void:
    bindings = ActionBindings.new()

# Godot calls this whenever any input event happens (mouse/key/touch/joypad).
func _input(event: InputEvent) -> void:
    # ---- Pointer events (mouse left button + touch + drag) ----
    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_LEFT:
            _last_pointer_pos = event.position
            if event.pressed:
                pointer_pressed.emit(event.position)
            else:
                pointer_released.emit(event.position)
        return
    if event is InputEventMouseMotion:
        _last_pointer_pos = event.position
        pointer_moved.emit(event.position)
        return
    if event is InputEventScreenTouch:
        _last_pointer_pos = event.position
        if event.pressed:
            pointer_pressed.emit(event.position)
        else:
            pointer_released.emit(event.position)
        return
    if event is InputEventScreenDrag:
        _last_pointer_pos = event.position
        pointer_moved.emit(event.position)
        return

    # ---- Action events (keyboard + mouse buttons not LMB) ----
    var matched := bindings.match_event(event)
    if matched != "":
        _held_actions[matched] = true
        action_triggered.emit(matched)
        return
    # Release tracking for is_action_held()
    if event is InputEventKey and not event.pressed:
        for action in bindings.list_actions():
            var bound = bindings.get_event_for(action) as InputEventKey
            if bound != null and bound.physical_keycode == event.physical_keycode:
                _held_actions.erase(action)

func get_pointer_position() -> Vector2:
    return _last_pointer_pos

func is_action_held(action: String) -> bool:
    return _held_actions.get(action, false)
```

- [ ] **Step 5: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 之前的所有 + 11 InputRouter 测试 PASS。

- [ ] **Step 6: Commit**

```bash
git add shared/input/input_context.gd boot/platform/input_router.gd tests/test_input_router.gd
git commit -m "feat(input): InputRouter routes mouse/touch/keyboard → InputContext signals"
```

---

## Task 3 — boot.gd 替换 StubInputContext 为 InputRouter

**Files:**
- Modify: `boot/boot.gd`
- Modify: `tests/test_boot_module_load.gd`（M0 留下的，更新 deps 装配断言）

- [ ] **Step 1: 修改 boot.gd**

打开 `boot/boot.gd`，把对 `StubInputContext` 的引用替换为 `InputRouter`，并把它 `add_child` 到 boot 节点（InputRouter 必须在场景树里才能收到 _input）：

```gdscript
# boot/boot.gd
extends Node

const StubSaveAdapter = preload("res://boot/platform/stub_save_adapter.gd")
const InputRouter = preload("res://boot/platform/input_router.gd")
const StubTranslationContext = preload("res://boot/platform/stub_translation_context.gd")
const SteamPlatform = preload("res://boot/platform/steam_platform.gd")
const CalendarPuzzleGame = preload("res://games/calendar_puzzle/game.gd")

var _game_root: Node = null
var _input_router: InputRouter = null

func _ready() -> void:
    print("[boot] starting Calendar Puzzle (M2 with InputRouter)")
    _input_router = InputRouter.new()
    _input_router.name = "InputRouter"
    add_child(_input_router)

    var deps := _build_deps()
    assert(deps.is_complete(), "boot: GameDeps assembly failed")
    var module := CalendarPuzzleGame.new()
    _game_root = module.start(deps)
    add_child(_game_root)
    print("[boot] module '%s' started" % module.get_manifest().id)

func _build_deps() -> GameDeps:
    var deps := GameDeps.new()
    deps.save = StubSaveAdapter.new()
    deps.input = _input_router          # was: StubInputContext.new()
    deps.i18n = StubTranslationContext.new()
    deps.platform = SteamPlatform.new()
    deps.on_exit = _on_game_exit
    return deps

func _on_game_exit() -> void:
    print("[boot] game requested exit")
    if _game_root:
        _game_root.queue_free()
        _game_root = null
    get_tree().quit()
```

- [ ] **Step 2: 更新 test_boot_module_load.gd**

打开 `tests/test_boot_module_load.gd`，原 M0 测试期望 deps.input 来自 stub；新版要兼容 `_input_router` 未初始化时（_build_deps 在 _ready 之前调）的场景，或者把 InputRouter 提前到 _build_deps 内部 lazy 初始化：

更稳的做法是在 _build_deps 里 lazy 初始化：

```gdscript
func _build_deps() -> GameDeps:
    if _input_router == null:
        _input_router = InputRouter.new()
        _input_router.name = "InputRouter"
        add_child(_input_router)
    var deps := GameDeps.new()
    deps.save = StubSaveAdapter.new()
    deps.input = _input_router
    deps.i18n = StubTranslationContext.new()
    deps.platform = SteamPlatform.new()
    deps.on_exit = _on_game_exit
    return deps
```

`_ready` 不再单独 add_child router，直接调 _build_deps 即可。重写 `_ready`:

```gdscript
func _ready() -> void:
    print("[boot] starting Calendar Puzzle (M2 with InputRouter)")
    var deps := _build_deps()
    assert(deps.is_complete(), "boot: GameDeps assembly failed")
    var module := CalendarPuzzleGame.new()
    _game_root = module.start(deps)
    add_child(_game_root)
    print("[boot] module '%s' started" % module.get_manifest().id)
```

M0 的 `test_game_deps_assembly_complete` 测试不需要改：deps.input 现在是 InputRouter 实例，依然非 null，`is_complete()` 仍然 true。

但加一个新断言验证类型：

```gdscript
# tests/test_boot_module_load.gd 末尾追加
const InputRouter = preload("res://boot/platform/input_router.gd")

func test_boot_injects_input_router_not_stub():
    var Boot = load("res://boot/boot.gd")
    var b = Boot.new()
    add_child_autofree(b)
    var deps = b.call("_build_deps")
    assert_true(deps.input is InputRouter, "M2 expects InputRouter, not stub")
```

- [ ] **Step 3: 跑测试 + boot 冒烟**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
godot --headless --quit-after 3 res://boot/boot.tscn 2>&1 | tail -10
```

Expected: 所有测试 PASS；boot 日志显示 "M2 with InputRouter"，无报错。

- [ ] **Step 4: Commit**

```bash
git add boot/boot.gd tests/test_boot_module_load.gd
git commit -m "feat(boot): inject InputRouter instead of stub; update integration tests"
```

---

## Task 4 — Fixture: easy_seeded_puzzle.gd（集成测试用固定题面）

**Files:**
- Create: `tests/fixtures/easy_seeded_puzzle.gd`

- [ ] **Step 1: 写 fixture**

```gdscript
# tests/fixtures/easy_seeded_puzzle.gd
# Hand-rolled easy puzzle for integration tests.
# Uses 2026-05-26 (Tue) with dig_count=3, combo=[I,U,V].
# Pre-placed: 7 blocks at fixed positions; remaining = 3 blocks in palette.
# Solved board source: pack_free.tres entry "5-26-1"[0].
class_name EasySeededPuzzle extends RefCounted

const SOLVED_BOARD_STR := "*SSUUN#SSJJUN#*QJUUNNQQJTTTNQQZVTLIZZZVTLIZVVV*LI####LLI"

static func build() -> Dictionary:
    var rows: Array = []
    for y in range(8):
        var row: Array = []
        for x in range(7):
            row.append(SOLVED_BOARD_STR.substr(y * 7 + x, 1))
        rows.append(row)
    var combo := ["I", "U", "V"]
    var date := {"year": 2026, "month": 5, "day": 26, "weekday": 2}
    # Delegate the pre/remaining split to PuzzleGenerator so the fixture stays
    # in sync if Board.INITIAL_BLOCK_TYPES order changes.
    var PG := load("res://games/calendar_puzzle/solver/puzzle_generator.gd")
    var parts: Dictionary = PG.puzzle_from_combo(rows, combo)
    return {
        "date": date,
        "solved_board": rows,
        "remaining_blocks": parts.remaining_blocks,
        "pre_placed_blocks": parts.pre_placed_blocks,
        "difficulty": "easy",
    }
```

- [ ] **Step 2: 校验语法**

```bash
godot --headless --check-only --script tests/fixtures/easy_seeded_puzzle.gd 2>&1
```

Expected: 无 error。

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/easy_seeded_puzzle.gd
git commit -m "test(fixtures): hand-rolled easy puzzle for play_scene integration tests"
```

---

## Task 5 — 实现 BoardView（棋盘自绘 Control）

**Files:**
- Create: `games/calendar_puzzle/scenes/board_view.gd`

BoardView 是个 Control，自绘 8×7 网格：
- 每格 80×80 px，整张棋盘 560×640 px
- 月份格背景浅绿、日期格中绿、星期格深绿；empty/# 隐藏
- uncoverable 高亮金边
- placed block 用 block.color 填色 + block.label 居中字

> 用 `_draw()` 自绘比 GridContainer + Panel 更直接，因为格子不是子节点而是绘制目标；省 ~30 个 Control 节点开销。

- [ ] **Step 1: 写 board_view.gd**

```gdscript
# games/calendar_puzzle/scenes/board_view.gd
# 8×7 self-drawn calendar grid. Renders the board layout + uncoverable
# highlights + placed blocks + ghost preview overlay.
class_name BoardView extends Control

const Board = preload("res://games/calendar_puzzle/solver/board.gd")

const CELL_SIZE := 80.0
const COLS := 7
const ROWS := 8

# State (set by play_scene; this Control is dumb).
var uncoverable_cells: Array = []      # [{x,y}, ...]
var placed_blocks: Array = []          # [{id,label,color,shape,x,y}, ...]
var ghost: Dictionary = {}             # { block, x, y, valid: bool } or {}

# Palette colors (M9 will swap via SkinResource; M2 uses miniprogram defaults).
const COLOR_MONTH := Color(0.91, 0.96, 0.91)        # very light green
const COLOR_DAY := Color(0.78, 0.90, 0.79)
const COLOR_WEEKDAY := Color(0.65, 0.84, 0.65)
const COLOR_EMPTY := Color(1, 1, 1, 0)
const COLOR_UNCOV_FILL := Color(1.0, 0.84, 0.0)
const COLOR_UNCOV_BORDER := Color(0.9, 0.65, 0.0)
const COLOR_GRID_LINE := Color(0.2, 0.2, 0.25, 0.4)
const COLOR_GHOST_VALID := Color(1, 1, 1, 0.4)
const COLOR_GHOST_INVALID := Color(1.0, 0.2, 0.2, 0.4)

func _ready() -> void:
    custom_minimum_size = Vector2(CELL_SIZE * COLS, CELL_SIZE * ROWS)
    queue_redraw()

func _draw() -> void:
    # 1. cell backgrounds + labels per Board.LAYOUT
    for y in range(ROWS):
        for x in range(COLS):
            var cell = Board.LAYOUT[y][x]
            var rect := Rect2(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            var bg := COLOR_EMPTY
            match cell.t:
                "month": bg = COLOR_MONTH
                "day": bg = COLOR_DAY
                "weekday": bg = COLOR_WEEKDAY
                _: bg = COLOR_EMPTY
            if bg.a > 0:
                draw_rect(rect, bg)
                draw_rect(rect, COLOR_GRID_LINE, false, 1.0)
                if cell.v != null:
                    _draw_text(str(cell.v), rect, Color(0.15, 0.15, 0.15), 16)

    # 2. uncoverable highlights
    for u in uncoverable_cells:
        var rect := Rect2(u.x * CELL_SIZE, u.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        draw_rect(rect, COLOR_UNCOV_FILL)
        draw_rect(rect, COLOR_UNCOV_BORDER, false, 3.0)

    # 3. placed blocks
    for b in placed_blocks:
        _draw_block(b, _color_from_hex(b.color), 1.0)

    # 4. ghost preview (if dragging)
    if not ghost.is_empty() and ghost.has("block"):
        var ghost_color: Color
        if ghost.valid:
            ghost_color = _color_from_hex(ghost.block.color)
            ghost_color.a = 0.55
        else:
            ghost_color = COLOR_GHOST_INVALID
        var pos_block := {
            "id": ghost.block.id, "label": ghost.block.label,
            "color": ghost.block.color, "shape": ghost.block.shape,
            "x": ghost.x, "y": ghost.y,
        }
        _draw_block(pos_block, ghost_color, 0.55)

func _draw_block(b: Dictionary, color: Color, _alpha: float) -> void:
    for sy in range(b.shape.size()):
        for sx in range(b.shape[sy].size()):
            if b.shape[sy][sx] != 1:
                continue
            var cx: int = b.x + sx
            var cy: int = b.y + sy
            if cx < 0 or cx >= COLS or cy < 0 or cy >= ROWS:
                continue
            var rect := Rect2(cx * CELL_SIZE + 2, cy * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4)
            draw_rect(rect, color)
            _draw_text(b.label, rect, Color.WHITE, 22)

func _draw_text(text: String, rect: Rect2, color: Color, font_size: int) -> void:
    var font := ThemeDB.fallback_font
    var text_size := font.get_string_size(text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size)
    var pos := rect.position + Vector2(
        (rect.size.x - text_size.x) / 2.0,
        (rect.size.y + text_size.y) / 2.0 - 4
    )
    draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, color)

func _color_from_hex(hex: String) -> Color:
    return Color.html(hex)

# Convert a Vector2 pixel position to grid cell. Returns Vector2i(-1,-1) if OOB.
func pixel_to_cell(pos: Vector2) -> Vector2i:
    var lx := pos.x - global_position.x
    var ly := pos.y - global_position.y
    if lx < 0 or ly < 0 or lx >= CELL_SIZE * COLS or ly >= CELL_SIZE * ROWS:
        return Vector2i(-1, -1)
    return Vector2i(int(lx / CELL_SIZE), int(ly / CELL_SIZE))

# play_scene calls these whenever state changes.
func set_uncoverable(cells: Array) -> void:
    uncoverable_cells = cells
    queue_redraw()

func set_placed(blocks: Array) -> void:
    placed_blocks = blocks
    queue_redraw()

func set_ghost(g: Dictionary) -> void:
    ghost = g
    queue_redraw()

func clear_ghost() -> void:
    ghost = {}
    queue_redraw()
```

- [ ] **Step 2: 校验语法**

```bash
godot --headless --check-only --script games/calendar_puzzle/scenes/board_view.gd 2>&1
```

Expected: 无 error。

- [ ] **Step 3: Commit**

```bash
git add games/calendar_puzzle/scenes/board_view.gd
git commit -m "feat(scene): BoardView self-drawn 8×7 grid with cells/uncoverable/blocks/ghost"
```

---

## Task 6 — 实现 PaletteView（剩余方块列表）

**Files:**
- Create: `games/calendar_puzzle/scenes/palette_view.gd`

Palette 在棋盘下方，HBoxContainer 横排所有 remaining_blocks 的缩略图。每个 block 用一个子 Control，可以被 play_scene "拾取"——拾取交互由 play_scene 通过 InputContext 监听全局指针事件实现，PaletteView 只负责渲染 + 暴露"哪个 block 在什么位置"的查询。

- [ ] **Step 1: 写 palette_view.gd**

```gdscript
# games/calendar_puzzle/scenes/palette_view.gd
# Horizontal row of remaining (unplaced) blocks. Provides
# hit_test(pos) -> block_id|"" for play_scene's pickup logic.
class_name PaletteView extends HBoxContainer

const Board = preload("res://games/calendar_puzzle/solver/board.gd")

const TILE_SIZE := 28.0   # palette is smaller than board cells
const TILE_GAP := 12.0
const ITEM_WIDTH := 4 * TILE_SIZE + 12      # max 4 cells wide
const ITEM_HEIGHT := 4 * TILE_SIZE + 12

var blocks: Array = []                       # remaining_blocks
var _item_rects: Dictionary = {}             # block_id → global Rect2

func _ready() -> void:
    add_theme_constant_override("separation", int(TILE_GAP))

func set_blocks(remaining: Array) -> void:
    blocks = remaining
    _rebuild()

func _rebuild() -> void:
    for child in get_children():
        child.queue_free()
    _item_rects.clear()
    for b in blocks:
        var item := Control.new()
        item.custom_minimum_size = Vector2(ITEM_WIDTH, ITEM_HEIGHT)
        item.set_meta("block_id", b.id)
        item.draw.connect(_draw_item.bind(item, b))
        add_child(item)
    # Defer rect collection one frame so Godot has laid out children.
    call_deferred("_collect_rects")

func _collect_rects() -> void:
    _item_rects.clear()
    for child in get_children():
        if child is Control and child.has_meta("block_id"):
            var bid: String = child.get_meta("block_id")
            _item_rects[bid] = Rect2(child.global_position, child.size)

func _draw_item(item: Control, b: Dictionary) -> void:
    var color := Color.html(b.color)
    for sy in range(b.shape.size()):
        for sx in range(b.shape[sy].size()):
            if b.shape[sy][sx] != 1:
                continue
            var rect := Rect2(sx * TILE_SIZE + 2, sy * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4)
            item.draw_rect(rect, color)

# Return block_id at the given global pixel position, or "" if none.
func hit_test(global_pos: Vector2) -> String:
    for bid in _item_rects.keys():
        if _item_rects[bid].has_point(global_pos):
            return bid
    return ""

func find_block(block_id: String) -> Dictionary:
    for b in blocks:
        if b.id == block_id:
            return b
    return {}
```

- [ ] **Step 2: 校验语法**

```bash
godot --headless --check-only --script games/calendar_puzzle/scenes/palette_view.gd 2>&1
```

Expected: 无 error。

- [ ] **Step 3: Commit**

```bash
git add games/calendar_puzzle/scenes/palette_view.gd
git commit -m "feat(scene): PaletteView horizontal row of remaining blocks with hit_test"
```

---

## Task 7 — 实现 WinOverlay（胜利覆盖层）

**Files:**
- Create: `games/calendar_puzzle/scenes/win_overlay.gd`

简单半透明黑遮罩 + "You Won!" 大字 + Close 按钮（暂时只触发 hide）。M5 会加教程动画，M9 会加皮肤化的胜利粒子；本 Task 最小可视化。

- [ ] **Step 1: 写 win_overlay.gd**

```gdscript
# games/calendar_puzzle/scenes/win_overlay.gd
# Full-screen translucent overlay that announces the win. Hidden by default;
# play_scene calls show_win() on Board.check_game_win() == true.
class_name WinOverlay extends Control

signal close_pressed

func _ready() -> void:
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    mouse_filter = Control.MOUSE_FILTER_STOP
    visible = false
    _build_ui()

func _build_ui() -> void:
    var bg := ColorRect.new()
    bg.color = Color(0, 0, 0, 0.55)
    bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    add_child(bg)

    var center := CenterContainer.new()
    center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    add_child(center)

    var vbox := VBoxContainer.new()
    vbox.alignment = BoxContainer.ALIGNMENT_CENTER
    center.add_child(vbox)

    var title := Label.new()
    title.text = "You Won!"
    title.add_theme_font_size_override("font_size", 72)
    title.add_theme_color_override("font_color", Color.WHITE)
    title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    vbox.add_child(title)

    vbox.add_child(_spacer(40))

    var btn := Button.new()
    btn.text = "Continue"
    btn.custom_minimum_size = Vector2(200, 56)
    btn.pressed.connect(func(): close_pressed.emit())
    vbox.add_child(btn)

func _spacer(h: int) -> Control:
    var s := Control.new()
    s.custom_minimum_size = Vector2(0, h)
    return s

func show_win() -> void:
    visible = true
    queue_redraw()

func hide_win() -> void:
    visible = false
```

- [ ] **Step 2: 语法校验**

```bash
godot --headless --check-only --script games/calendar_puzzle/scenes/win_overlay.gd 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add games/calendar_puzzle/scenes/win_overlay.gd
git commit -m "feat(scene): WinOverlay translucent congratulations + continue button"
```

---

## Task 8 — 实现 PlayScene（玩法控制脚本主体）

**Files:**
- Create: `games/calendar_puzzle/scenes/play_scene.gd`
- Create: `games/calendar_puzzle/scenes/play_scene.tscn`

PlayScene 是主控制脚本：
- 持有 GameDeps（注入式，构造时由 game.gd 传入）
- 用 EasySeededPuzzle.build() 初始化状态（M3 会替换为真的 daily lookup）
- 订阅 deps.input 的 pointer_pressed/moved/released/action_triggered
- 状态机：`idle` → `dragging` → `placed/rejected`
- 双击检测：连续两次 pointer_pressed in < 350ms 在同一 placed block 上
- 旋转/镜像：dragging 中按 R/F → 变换 ghost 的 shape
- 胜利检测：每次 placed 后调 Board.check_game_win

- [ ] **Step 1: 写 play_scene.gd**

```gdscript
# games/calendar_puzzle/scenes/play_scene.gd
# Main gameplay scene controller. Wires BoardView + PaletteView + WinOverlay
# to a finite state machine driven by InputContext signals.
extends Control

const Board = preload("res://games/calendar_puzzle/solver/board.gd")
const BoardView = preload("res://games/calendar_puzzle/scenes/board_view.gd")
const PaletteView = preload("res://games/calendar_puzzle/scenes/palette_view.gd")
const WinOverlay = preload("res://games/calendar_puzzle/scenes/win_overlay.gd")
const EasySeededPuzzle = preload("res://tests/fixtures/easy_seeded_puzzle.gd")

signal won

# State machine
enum State { IDLE, DRAGGING }

# DI
var deps: GameDeps

# Puzzle state
var puzzle: Dictionary = {}                # from EasySeededPuzzle or generator
var placed_blocks: Array = []              # subset of original pre_placed; players add
var palette_blocks: Array = []             # blocks not yet placed; removed → palette
var uncoverable: Array = []

# Interaction state
var state: int = State.IDLE
var drag_block: Dictionary = {}            # the block being dragged (with current shape)
var drag_offset: Vector2 = Vector2.ZERO    # within-block grab offset, in cell units
var _last_click_time_ms: int = 0
var _last_click_block_id: String = ""
const DOUBLE_CLICK_MS := 350

# UI
@onready var board_view: BoardView = $VBox/BoardView
@onready var palette_view: PaletteView = $VBox/PaletteView
@onready var win_overlay: WinOverlay = $WinOverlay

func setup(d: GameDeps) -> void:
    deps = d

func _ready() -> void:
    assert(deps != null, "play_scene.setup(deps) must be called before adding to tree")
    _bind_input()
    _load_puzzle()
    win_overlay.close_pressed.connect(func(): deps.on_exit.call())

func _bind_input() -> void:
    deps.input.pointer_pressed.connect(_on_pointer_pressed)
    deps.input.pointer_moved.connect(_on_pointer_moved)
    deps.input.pointer_released.connect(_on_pointer_released)
    deps.input.action_triggered.connect(_on_action_triggered)

func _load_puzzle() -> void:
    puzzle = EasySeededPuzzle.build()
    uncoverable = Board.get_uncoverable_cells(puzzle.date)
    placed_blocks = []
    for b in puzzle.pre_placed_blocks:
        placed_blocks.append(Board.clone_block(b))
    palette_blocks = []
    for b in puzzle.remaining_blocks:
        palette_blocks.append(Board.clone_block(b))
    board_view.set_uncoverable(uncoverable)
    board_view.set_placed(placed_blocks)
    palette_view.set_blocks(palette_blocks)

# -----------------------------------------------------------
# Input handlers
# -----------------------------------------------------------

func _on_pointer_pressed(pos: Vector2) -> void:
    if state != State.IDLE:
        return
    # First: hit-test palette
    var pal_id := palette_view.hit_test(pos)
    if pal_id != "":
        _begin_drag_from_palette(pal_id, pos)
        return
    # Then: hit-test placed block (for double-click → remove)
    var cell := board_view.pixel_to_cell(pos)
    if cell.x < 0:
        return
    var block = Board.get_block_at_cell(placed_blocks, cell.x, cell.y)
    if block == null:
        return
    var now := Time.get_ticks_msec()
    if block.id == _last_click_block_id and now - _last_click_time_ms <= DOUBLE_CLICK_MS:
        _remove_to_palette(block)
        _last_click_block_id = ""
        return
    _last_click_block_id = block.id
    _last_click_time_ms = now

func _on_pointer_moved(pos: Vector2) -> void:
    if state != State.DRAGGING:
        return
    _update_ghost(pos)

func _on_pointer_released(pos: Vector2) -> void:
    if state != State.DRAGGING:
        return
    var cell := _ghost_top_left_cell(pos)
    if cell.x >= 0:
        var ok := Board.is_valid_placement(
            drag_block,
            {"x": cell.x, "y": cell.y},
            placed_blocks,
            uncoverable
        )
        if ok:
            drag_block.x = cell.x
            drag_block.y = cell.y
            placed_blocks.append(drag_block)
            _check_win()
    # else: snap back — palette already has the block reserved
    if state == State.DRAGGING and not (drag_block in placed_blocks):
        # restore to palette
        palette_blocks.append(drag_block)
        palette_view.set_blocks(palette_blocks)
    state = State.IDLE
    drag_block = {}
    board_view.clear_ghost()
    board_view.set_placed(placed_blocks)

func _on_action_triggered(action: String) -> void:
    if state != State.DRAGGING:
        return
    match action:
        "rotate":
            drag_block.shape = Board.rotate_shape(drag_block.shape)
            _update_ghost(deps.input.get_pointer_position())
        "mirror":
            drag_block.shape = Board.flip_shape(drag_block.shape)
            _update_ghost(deps.input.get_pointer_position())

# -----------------------------------------------------------
# Internal helpers
# -----------------------------------------------------------

func _begin_drag_from_palette(block_id: String, pos: Vector2) -> void:
    var b := palette_view.find_block(block_id)
    if b.is_empty():
        return
    # Remove from palette; pickup into drag_block
    palette_blocks = palette_blocks.filter(func(x): return x.id != block_id)
    palette_view.set_blocks(palette_blocks)
    drag_block = Board.clone_block(b)
    drag_block["x"] = 0
    drag_block["y"] = 0
    drag_offset = Vector2(0, 0)    # grab from top-left for simplicity
    state = State.DRAGGING
    _update_ghost(pos)

func _ghost_top_left_cell(pos: Vector2) -> Vector2i:
    return board_view.pixel_to_cell(pos)

func _update_ghost(pos: Vector2) -> void:
    var cell := _ghost_top_left_cell(pos)
    if cell.x < 0:
        board_view.clear_ghost()
        return
    var valid := Board.is_valid_placement(
        drag_block,
        {"x": cell.x, "y": cell.y},
        placed_blocks,
        uncoverable
    )
    board_view.set_ghost({
        "block": drag_block, "x": cell.x, "y": cell.y, "valid": valid,
    })

func _remove_to_palette(block: Dictionary) -> void:
    placed_blocks = placed_blocks.filter(func(b): return b.id != block.id)
    # palette version drops x/y; clone fresh from puzzle.remaining or pre_placed
    var fresh := Board.clone_block(block)
    fresh.erase("x")
    fresh.erase("y")
    palette_blocks.append(fresh)
    board_view.set_placed(placed_blocks)
    palette_view.set_blocks(palette_blocks)

func _check_win() -> void:
    if Board.check_game_win(placed_blocks, uncoverable):
        win_overlay.show_win()
        won.emit()
```

- [ ] **Step 2: 写 play_scene.tscn**

`games/calendar_puzzle/scenes/play_scene.tscn`:

```
[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/scenes/play_scene.gd" id="1"]
[ext_resource type="Script" path="res://games/calendar_puzzle/scenes/board_view.gd" id="2"]
[ext_resource type="Script" path="res://games/calendar_puzzle/scenes/palette_view.gd" id="3"]
[ext_resource type="Script" path="res://games/calendar_puzzle/scenes/win_overlay.gd" id="4"]

[node name="PlayScene" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
script = ExtResource("1")

[node name="VBox" type="VBoxContainer" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
alignment = 1

[node name="BoardView" type="Control" parent="VBox"]
custom_minimum_size = Vector2(560, 640)
script = ExtResource("2")

[node name="PaletteView" type="HBoxContainer" parent="VBox"]
custom_minimum_size = Vector2(0, 140)
alignment = 1
script = ExtResource("3")

[node name="WinOverlay" type="Control" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
visible = false
script = ExtResource("4")
```

- [ ] **Step 3: 校验语法 + scene load**

```bash
godot --headless --check-only --script games/calendar_puzzle/scenes/play_scene.gd 2>&1
godot --headless -s addons/gut/gut_cmdln.gd -gtest=res://tests/test_game_manifest.gd -gexit 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/scenes/play_scene.gd games/calendar_puzzle/scenes/play_scene.tscn
git commit -m "feat(scene): PlayScene main controller (drag/drop/rotate/mirror/double-click/win)"
```

---

## Task 9 — 修改 game.gd 把 PlayScene 挂上

**Files:**
- Modify: `games/calendar_puzzle/game.gd`
- Modify: `tests/test_calendar_puzzle_module.gd`

M0 时 game.gd 返回的是一个只显示 "stub running" 的 Node2D。M2 起换成实例化 play_scene.tscn 并 setup(deps)。

- [ ] **Step 1: 改 game.gd**

```gdscript
# games/calendar_puzzle/game.gd
extends GameModule

const MANIFEST_PATH = "res://games/calendar_puzzle/manifest.tres"
const PLAY_SCENE = preload("res://games/calendar_puzzle/scenes/play_scene.tscn")

func get_manifest() -> GameManifest:
    return load(MANIFEST_PATH) as GameManifest

func start(deps: GameDeps) -> Node:
    assert(deps.is_complete(), "GameDeps incomplete - boot misconfigured")
    var scene := PLAY_SCENE.instantiate()
    scene.setup(deps)
    return scene
```

- [ ] **Step 2: 更新 test_calendar_puzzle_module.gd**

把 M0 的 `test_start_requires_complete_deps` 保留；新增一个测试验证 start() 返回的 Node 是 Control（PlayScene 根）：

```gdscript
# tests/test_calendar_puzzle_module.gd 追加
const StubSaveAdapter = preload("res://boot/platform/stub_save_adapter.gd")
const StubInputContext = preload("res://boot/platform/stub_input_context.gd")
const StubTranslationContext = preload("res://boot/platform/stub_translation_context.gd")
const SteamPlatform = preload("res://boot/platform/steam_platform.gd")

func test_start_returns_play_scene_control_node():
    var deps := GameDeps.new()
    deps.save = StubSaveAdapter.new()
    deps.input = StubInputContext.new()
    deps.i18n = StubTranslationContext.new()
    deps.platform = SteamPlatform.new()
    deps.on_exit = func(): pass
    var game := Game.new()
    var scene := game.start(deps)
    assert_not_null(scene)
    assert_true(scene is Control, "PlayScene root should be a Control")
    scene.queue_free()
```

- [ ] **Step 3: 跑全套测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -10
```

Expected: 全 PASS。

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/game.gd tests/test_calendar_puzzle_module.gd
git commit -m "feat(game): start(deps) instantiates PlayScene instead of stub label"
```

---

## Task 10 — 集成测试：模拟拖放/旋转/胜利

**Files:**
- Create: `tests/test_play_scene.gd`

集成测试不通过 InputRouter（避免依赖原生 InputEvent），而是直接调用 PlayScene 注入的 deps.input 上的 emit_signal，模拟 InputContext 已经把事件翻译完毕。

- [ ] **Step 1: 写 test_play_scene.gd**

```gdscript
extends "res://addons/gut/test.gd"

const Game = preload("res://games/calendar_puzzle/game.gd")
const Board = preload("res://games/calendar_puzzle/solver/board.gd")
const StubSaveAdapter = preload("res://boot/platform/stub_save_adapter.gd")
const StubTranslationContext = preload("res://boot/platform/stub_translation_context.gd")
const SteamPlatform = preload("res://boot/platform/steam_platform.gd")
const StubInputContext = preload("res://boot/platform/stub_input_context.gd")

var scene: Control
var deps: GameDeps
var input_stub: StubInputContext

func before_each():
    deps = GameDeps.new()
    deps.save = StubSaveAdapter.new()
    input_stub = StubInputContext.new()
    add_child_autofree(input_stub)
    deps.input = input_stub
    deps.i18n = StubTranslationContext.new()
    deps.platform = SteamPlatform.new()
    deps.on_exit = func(): pass
    scene = Game.new().start(deps)
    add_child_autofree(scene)
    # let _ready + deferred _collect_rects settle
    await get_tree().process_frame
    await get_tree().process_frame

func test_initial_state_has_7_placed_3_palette():
    assert_eq(scene.placed_blocks.size(), 7)
    assert_eq(scene.palette_blocks.size(), 3)
    assert_eq(scene.state, scene.State.IDLE)

func test_pickup_from_palette_enters_dragging_state():
    var palette_view = scene.get_node("VBox/PaletteView")
    var first_id: String = scene.palette_blocks[0].id
    var pickup_pos: Vector2 = palette_view._item_rects[first_id].position + Vector2(4, 4)
    input_stub.pointer_pressed.emit(pickup_pos)
    assert_eq(scene.state, scene.State.DRAGGING)
    assert_eq(scene.drag_block.id, first_id)
    assert_eq(scene.palette_blocks.size(), 2, "palette decremented during drag")

func test_rotate_action_during_drag_changes_shape():
    var palette_view = scene.get_node("VBox/PaletteView")
    var bid: String = scene.palette_blocks[0].id
    input_stub.pointer_pressed.emit(palette_view._item_rects[bid].position + Vector2(4,4))
    var orig_shape: Array = scene.drag_block.shape.duplicate(true)
    input_stub.action_triggered.emit("rotate")
    assert_ne(scene.drag_block.shape, orig_shape, "shape should change after rotate")

func test_mirror_action_during_drag_changes_shape():
    var palette_view = scene.get_node("VBox/PaletteView")
    var bid: String = scene.palette_blocks[0].id
    input_stub.pointer_pressed.emit(palette_view._item_rects[bid].position + Vector2(4,4))
    var orig_shape: Array = scene.drag_block.shape.duplicate(true)
    input_stub.action_triggered.emit("mirror")
    assert_ne(scene.drag_block.shape, orig_shape)

func test_release_at_invalid_cell_snaps_back_to_palette():
    var palette_view = scene.get_node("VBox/PaletteView")
    var bid: String = scene.palette_blocks[0].id
    input_stub.pointer_pressed.emit(palette_view._item_rects[bid].position + Vector2(4,4))
    # Release way OOB
    input_stub.pointer_released.emit(Vector2(-100, -100))
    assert_eq(scene.state, scene.State.IDLE)
    assert_eq(scene.palette_blocks.size(), 3, "block returns to palette")

func test_release_at_solved_cell_places_block_and_wins():
    # The seeded puzzle has 3 remaining blocks (I/U/V); their solved positions
    # come from EasySeededPuzzle.solved_placements path. Drop each at its
    # solved cell → win triggers.
    var PG = load("res://games/calendar_puzzle/solver/puzzle_generator.gd")
    var solved_pos := PG.solved_placements(scene.puzzle.solved_board)
    var won_signal_caught := [false]
    scene.won.connect(func(): won_signal_caught[0] = true)

    var palette_view = scene.get_node("VBox/PaletteView")
    var board_view = scene.get_node("VBox/BoardView")
    await get_tree().process_frame

    # Process palette items in current order; rebuild may shift indices each iter.
    while scene.palette_blocks.size() > 0:
        var b: Dictionary = scene.palette_blocks[0]
        var bid: String = b.id
        palette_view._collect_rects()
        var pickup_pos: Vector2 = palette_view._item_rects[bid].position + Vector2(4, 4)
        input_stub.pointer_pressed.emit(pickup_pos)
        # Rotate/mirror until shape matches solved (brute force up to 8 orientations)
        var target: Dictionary = solved_pos[bid]
        var tries := 0
        while tries < 8 and scene.drag_block.shape != target.shape:
            input_stub.action_triggered.emit("rotate")
            tries += 1
        if scene.drag_block.shape != target.shape:
            # try with mirror prefix
            input_stub.action_triggered.emit("mirror")
            tries = 0
            while tries < 4 and scene.drag_block.shape != target.shape:
                input_stub.action_triggered.emit("rotate")
                tries += 1
        # Drop at solved top-left cell (board_view's pixel space)
        var release_pos := board_view.global_position + Vector2(
            target.x * board_view.CELL_SIZE + 4,
            target.y * board_view.CELL_SIZE + 4,
        )
        input_stub.pointer_released.emit(release_pos)
        await get_tree().process_frame

    assert_eq(scene.placed_blocks.size(), 10, "all 10 blocks placed")
    assert_true(won_signal_caught[0], "won signal should have fired")

func test_double_click_placed_block_removes_to_palette():
    # Pick any placed block from the initial fixture
    var board_view = scene.get_node("VBox/BoardView")
    var target_block: Dictionary = scene.placed_blocks[0]
    var click_pos := board_view.global_position + Vector2(
        target_block.x * board_view.CELL_SIZE + 4,
        target_block.y * board_view.CELL_SIZE + 4,
    )
    input_stub.pointer_pressed.emit(click_pos)
    await get_tree().create_timer(0.05).timeout
    input_stub.pointer_pressed.emit(click_pos)
    await get_tree().process_frame
    assert_eq(scene.placed_blocks.size(), 6, "1 placed block removed")
    assert_eq(scene.palette_blocks.size(), 4, "palette gained 1")
```

- [ ] **Step 2: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 之前所有 + 7 个 play_scene 测试 PASS。

> **如果 `test_release_at_solved_cell_places_block_and_wins` FAIL**：solved shape vs palette shape 的 orientation 可能不在 8 个变换内匹配（罕见，但 board.gd 的 rotate/flip 顺序与 generator 的 all_orientations 顺序略有不同时会发生）。回退方案：把测试改成"对每个 remaining block 直接 _begin_drag_from_palette 后设 drag_block.shape = solved.shape"，绕过 rotate/mirror 模拟，专测 placement + win。这样仍验证胜利路径。

- [ ] **Step 3: Commit**

```bash
git add tests/test_play_scene.gd
git commit -m "test(scene): play_scene integration (pickup/rotate/mirror/place/win/double-click-remove)"
```

---

## Task 11 — 端到端真机冒烟（GUI 启动 + 玩一局）

**Files:**
- Create: `docs/m2-smoke-screenshot.png`

按 M0 套路，但这次是真的玩一局。

- [ ] **Step 1: 启动游戏**

```bash
godot
```

按 F5 启动。

- [ ] **Step 2: 验证初始 UI**

观察：
- 1280×720 窗口
- 棋盘居中显示 8×7 网格，月份/日期/星期格背景色不同
- 今天的月/日/星期 cell 标金色（uncoverable）
- 棋盘下方横排 3 个 remaining blocks（I/U/V，颜色不同）
- 棋盘上预先放着 7 个 placed blocks，颜色饱满，每格中央有字母

无 ERROR 弹窗。

- [ ] **Step 3: 拖一个方块上去**

鼠标拖一个 palette block → ghost 跟随光标移动 → 在某个非法位置（覆盖了 uncoverable 或与既有块重叠）应显示红色 ghost；松开 → 块回到 palette。再尝试合法位置 → 松开 → 块固化。

- [ ] **Step 4: 按 R 旋转 / F 镜像**

拖动中按 R / F → ghost 形状变。

- [ ] **Step 5: 双击移除**

双击棋盘上任意已放置块（间隔 < 350ms）→ 块回到 palette。

- [ ] **Step 6: 玩到胜利**

把所有 3 个 palette block 摆到对应位置 → "You Won!" overlay 弹出 → 点 Continue → 游戏退出（M2 行为，M3 改为返回选题）。

- [ ] **Step 7: 截图归档**

胜利 overlay 状态下截图，保存到 `docs/m2-smoke-screenshot.png`。

```bash
ls -lh docs/m2-smoke-screenshot.png
```

Expected: 文件存在，> 30KB。

- [ ] **Step 8: Commit**

```bash
git add docs/m2-smoke-screenshot.png
git commit -m "test(m2): smoke test screenshot of win overlay after happy-path play"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M2 spec 验收门槛全覆盖：
- ✅ 鼠键拖放 → Task 8 (_on_pointer_pressed/_on_pointer_moved/_on_pointer_released) + Task 10 integration test
- ✅ R 旋转 / F 镜像 → Task 8 (_on_action_triggered) + Task 10 (test_rotate_action / test_mirror_action)
- ✅ 双击移除 → Task 8 (DOUBLE_CLICK_MS check) + Task 10 (test_double_click_placed_block_removes)
- ✅ 胜利检测 → Task 7 (WinOverlay) + Task 8 (_check_win) + Task 10 (test_release_at_solved_cell_places_block_and_wins)
- ✅ Input 抽象接好 → Task 1 (ActionBindings) + Task 2 (InputRouter) + Task 3 (boot 注入) + Task 6/8 (game 代码只订阅 InputContext signal，没有任何 `_input(event)`)
- ✅ 真机冒烟 → Task 11

**2. Placeholder scan**:
- Task 4 fixture 用 EasySeededPuzzle 硬编码 base + combo；M3 会被真实 generator 替换。这是设计选择不是占位
- 无其他 TBD / TODO

**3. Type consistency**:
- `Dictionary` 形 block（{id, label, color, shape, key, x, y}）从 fixture → palette → drag_block → placed_blocks 全程一致；shape 是 2D `Array of Array of int(0|1)`
- `Vector2i` 用于 cell 坐标（pixel_to_cell / _ghost_top_left_cell 返回），`Vector2` 用于 pixel 坐标——两者严格区分
- `GameDeps.input: InputContext` —— stub 和 InputRouter 都 extends 它；Task 2 Step 1 把 InputContext 从 RefCounted 改成 Node 以支持 _input；M0 stub 跟随继承变化无需改
- ActionBindings 的 InputEvent 比较只关心 physical_keycode + 修饰键，不依赖 keycode（键盘 layout 无关，对国际化友好）

**4. Ambiguity**:
- 双击检测 350ms 是 OS 通用默认；不依赖系统设置以保证跨平台一致
- 拖动 grab offset 简化为 "总抓 top-left"（drag_offset = ZERO）—— 用户体验略生硬但不影响功能；M9 polishing 时改为按 click 位置偏移
- BoardView 用 `_draw()` 而非 GridContainer + TextureRect，理由在 Task 5 文档注释里写明（节点开销 + 自定义高亮）
- Integration test `test_release_at_solved_cell` 用枚举 8 orientations + mirror 暴力匹配 solved.shape，可能偶发不匹配；Task 10 Step 2 写了回退方案

**5. 模块边界**:
- `games/calendar_puzzle/scenes/*.gd` 全部 only depend on `solver/` + `tests/fixtures/`；**没有任何 import 自 `boot/` 或直接调 Steam SDK**
- play_scene 通过 deps.input 订阅事件，符合 spec § 输入抽象 / 模块边界硬约束
- WinOverlay 的 Continue 按钮触发 `deps.on_exit.call()`，把"退出"决策权还给 boot（M3 会改为切到 select_scene；M2 阶段直接退出 game ok）

无发现要修。M2 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M2 实施时用 superpowers:subagent-driven-development。每个 Task 派一个 fresh subagent → review → 下一个。

**串行依赖**:
- Task 1 (ActionBindings) → Task 2 (InputRouter 用 ActionBindings)
- Task 2 → Task 3 (boot 注入 InputRouter)
- Task 4 (fixture) → Task 8 (play_scene 用 fixture)
- Task 5-7 (BoardView / PaletteView / WinOverlay) → Task 8 (play_scene 组合三者)
- Task 8 → Task 9 (game.gd 用 play_scene.tscn)
- Task 9 → Task 10 (integration test 经 Game.new().start())
- Task 10 → Task 11 (真机验证；测试绿了才动 GUI)

**可并行**:
- Task 1 与 Task 4-7 完全独立；可派两个 worker
- Task 5 / 6 / 7 三个 view 文件独立；同时派 3 个 worker 可压缩到一轮
- Task 11 是手工步骤，需要用户在物理机上跑

视图层（Task 5-7）改动较多 GDScript，建议同一个 subagent 跑相邻文件以共享上下文；逻辑层（Task 8 play_scene）独占一个 subagent，因为它最长最复杂。
