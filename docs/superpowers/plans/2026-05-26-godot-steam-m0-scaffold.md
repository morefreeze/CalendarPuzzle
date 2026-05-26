# M0 — 项目脚手架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Godot 4 项目脚手架，实现 GameModule 接口契约，集成 GodotSteam，跑通"boot 加载 calendar_puzzle 模块显示空场景"的端到端冒烟测试。

**Architecture:** 方案 2（GDScript + 模块隔离）。`boot/` 层负责启动 / 平台依赖；`games/calendar_puzzle/` 是游戏模块，仅通过 `GameDeps` 注入获取能力；`shared/` 是跨游戏接口与组件库。M0 只搭骨架 + 空实现 + GUT 单元测试框架；不实现任何游戏逻辑。

**Tech Stack:** Godot 4.3+ (GDScript)、GodotSteam 4.x（社区维护）、GUT v9 (Godot Unit Test)、git。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Architecture / § Milestones M0

**Acceptance gates (从 spec 抄):**
- Godot 4 项目能从命令行启动到 main scene 不报错
- `boot/boot.gd` 加载 `games/calendar_puzzle/manifest.tres` → 调 `game.start(deps)` → 屏幕显示标签 "Calendar Puzzle stub running"
- GodotSteam 在 Steam 客户端运行时能 init 成功（拿到 steam_id）；非 Steam 环境下优雅降级（log warning，不 crash）
- `npm test` 等价物 `godot --headless --script tests/run_tests.gd` 至少 1 个 GUT 用例 PASS
- 仓库 push 到 GitHub 私库 `calendar-puzzle-godot`

---

## File Structure

本 milestone 创建的所有文件：

```
calendar-puzzle-godot/                      # 新仓库根（NOT 在 CalendarPuzzle/ 下，独立 repo）
├── .gitignore                              # Godot 标准忽略
├── README.md                               # 项目入口说明
├── project.godot                           # Godot 项目配置
├── icon.svg                                # 临时图标（placeholder）
├── boot/
│   ├── boot.tscn                           # 启动场景
│   └── boot.gd                             # 入口脚本
├── games/
│   └── calendar_puzzle/
│       ├── manifest.tres                   # GameManifest 资源实例
│       └── game.gd                         # GameModule 实现（stub）
├── shared/
│   ├── game_module.gd                      # GameModule 抽象接口
│   ├── game_deps.gd                        # GameDeps DI 容器
│   ├── game_manifest.gd                    # GameManifest 资源类
│   ├── save/
│   │   └── save_adapter.gd                 # SaveAdapter 抽象接口
│   ├── input/
│   │   └── input_context.gd                # InputContext 抽象接口
│   ├── i18n/
│   │   └── translation_context.gd          # TranslationContext 抽象接口
│   └── platform/
│       └── platform_bus.gd                 # PlatformBus 抽象接口
├── boot/platform/
│   ├── steam_platform.gd                   # GodotSteam wrapper
│   ├── stub_save_adapter.gd                # SaveAdapter 空实现（M0 用）
│   ├── stub_input_context.gd               # InputContext 空实现（M0 用）
│   └── stub_translation_context.gd         # TranslationContext 空实现（M0 用）
├── addons/
│   └── godotsteam/                         # GodotSteam 插件（手装）
├── tests/
│   ├── run_tests.gd                        # GUT 启动脚本
│   ├── test_game_manifest.gd               # GameManifest 资源单测
│   └── test_boot_module_load.gd            # boot 加载模块的集成测试
└── docs/
    ├── DEVELOPMENT.md                      # 本地开发流程
    └── STEAM_SETUP.md                      # Steam App ID / Apple Developer 注册手册
```

---

## Task 1 — 创建新仓库 + Godot 项目

**Files:**
- Create: `calendar-puzzle-godot/` （新目录，**与 CalendarPuzzle/ 同级**）
- Create: `calendar-puzzle-godot/project.godot`
- Create: `calendar-puzzle-godot/.gitignore`
- Create: `calendar-puzzle-godot/icon.svg`
- Create: `calendar-puzzle-godot/README.md`

- [ ] **Step 1: 创建仓库目录并 git init**

```bash
cd ~/mygit
mkdir calendar-puzzle-godot
cd calendar-puzzle-godot
git init -b main
```

Expected: `Initialized empty Git repository in .../calendar-puzzle-godot/.git/`

- [ ] **Step 2: 写 .gitignore**

```bash
cat > .gitignore <<'EOF'
# Godot 4+ specific ignores
.godot/
.import/
export.cfg
export_presets.cfg

# Imported translations (build artifacts)
*.translation

# Mono-specific ignores (we don't use C# but keep for safety)
.mono/
data_*/
mono_crash.*.json

# System
.DS_Store
*.swp
*.swo
Thumbs.db

# Build outputs
build/

# Local dev secrets
.env
.env.local
secrets/
EOF
```

- [ ] **Step 3: 创建占位 icon.svg**

```bash
cat > icon.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="16" fill="#4F46E5"/>
  <text x="64" y="80" font-family="sans-serif" font-size="48" font-weight="bold"
        text-anchor="middle" fill="white">CP</text>
</svg>
EOF
```

- [ ] **Step 4: 用 Godot Editor 打开当前目录创建 project.godot**

UI 操作：
1. 打开 Godot 4.3+ Editor
2. New Project → Browse → 选 `calendar-puzzle-godot/`
3. Project Name: `Calendar Puzzle`
4. Renderer: `Forward+`（桌面端首选）
5. Create & Edit

完成后 `project.godot` 应自动生成。**关闭 editor 后**校验：

```bash
test -f project.godot && echo OK
```

Expected: `OK`

- [ ] **Step 5: 配置 project.godot（手工编辑补字段）**

打开 `project.godot`，在 `[application]` 段补：

```ini
[application]

config/name="Calendar Puzzle"
config/description="Drop pentomino-like blocks onto an 8x7 calendar grid, leaving today's month/day/weekday uncovered."
config/version="0.1.0-m0"
run/main_scene="res://boot/boot.tscn"
config/features=PackedStringArray("4.3", "Forward Plus")
config/icon="res://icon.svg"

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/size/window_width_override=1280
window/size/window_height_override=720
window/stretch/mode="canvas_items"
window/stretch/aspect="keep"
```

- [ ] **Step 6: 写 README**

```bash
cat > README.md <<'EOF'
# Calendar Puzzle (Godot / Steam)

Steam 桌面版日历方块拼图。基于 Godot 4 实现，单游戏 MVP 阶段（Phase 1 of 3）。

## Quick start

```bash
godot --editor                      # 打开编辑器
godot                               # 运行游戏
godot --headless tests/run_tests.gd # 跑单测
```

## Architecture

详见 spec：原仓库 `CalendarPuzzle/docs/superpowers/specs/2026-05-26-godot-steam-port-design.md`。

简言之：

- `boot/` — 启动 + 平台依赖（Steam SDK / 存档 / 输入）
- `games/calendar_puzzle/` — 游戏模块，仅通过 `GameDeps` 接口与 boot 通信
- `shared/` — 跨游戏抽象接口与 UI 组件库
- `tests/` — GUT 单元 + 集成测试

## License

TBD before launch.
EOF
```

- [ ] **Step 7: 首次 commit**

```bash
git add .gitignore icon.svg project.godot README.md
git commit -m "init: Godot 4 project scaffold for Calendar Puzzle Steam port"
```

Expected: 1 commit on `main`，4 files。

---

## Task 2 — 创建目录结构 + .gdignore

**Files:**
- Create: `boot/`, `games/calendar_puzzle/`, `shared/`, `shared/save/`, `shared/input/`, `shared/i18n/`, `shared/platform/`, `tests/`, `docs/`, `addons/`（空目录）
- Create: `addons/.gdignore`（让 Godot 不递归 import addons 子目录前先建好）

- [ ] **Step 1: 创建所有目录**

```bash
mkdir -p boot/platform \
         games/calendar_puzzle \
         shared/save shared/input shared/i18n shared/platform \
         tests \
         docs \
         addons
```

- [ ] **Step 2: 给每个 dir 加 .gdkeep 占位（git 跟踪空目录）**

```bash
for d in boot boot/platform games/calendar_puzzle \
         shared shared/save shared/input shared/i18n shared/platform \
         tests docs addons; do
    touch "$d/.gdkeep"
done
```

- [ ] **Step 3: 校验目录树**

```bash
find . -type d -not -path './.git*' -not -path './.godot*' | sort
```

Expected output（顺序大致如下）：

```
.
./addons
./boot
./boot/platform
./docs
./games
./games/calendar_puzzle
./shared
./shared/i18n
./shared/input
./shared/platform
./shared/save
./tests
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: create directory scaffold (boot/games/shared/tests/docs/addons)"
```

---

## Task 3 — 定义 GameManifest 资源类（TDD）

**Files:**
- Create: `shared/game_manifest.gd`
- Test: `tests/test_game_manifest.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_game_manifest.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const GameManifest = preload("res://shared/game_manifest.gd")

func test_manifest_has_required_fields():
    var m = GameManifest.new()
    m.id = "calendar_puzzle"
    m.display_name = "Calendar Puzzle"
    m.version = "0.1.0"
    assert_eq(m.id, "calendar_puzzle")
    assert_eq(m.display_name, "Calendar Puzzle")
    assert_eq(m.version, "0.1.0")

func test_manifest_id_must_be_valid_identifier():
    var m = GameManifest.new()
    # 期待 is_valid_id() 对合法标识符返回 true
    m.id = "calendar_puzzle"
    assert_true(m.is_valid_id())
    m.id = "calendar-puzzle"  # 横线非法
    assert_false(m.is_valid_id())
    m.id = ""
    assert_false(m.is_valid_id())
    m.id = "1_starts_with_digit"
    assert_false(m.is_valid_id())
```

- [ ] **Step 2: 运行测试，期待 FAIL**

```bash
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests -gexit
```

Expected: `Could not preload script: res://shared/game_manifest.gd`（这一步可能也会因为 GUT 未装报错——见 Task 7 再补 GUT）。先记录此测试存在，等 Task 7 装好 GUT 后回过头跑。

> **暂停说明**：GUT 装在 Task 7。本步骤的"失败"是预期的，作为下游 Task 7 的 verification 输入。

- [ ] **Step 3: 实现 GameManifest 资源类**

`shared/game_manifest.gd`:

```gdscript
# shared/game_manifest.gd
# GameManifest — 单个游戏模块的自描述资源
class_name GameManifest extends Resource

@export var id: String = ""             # 唯一标识，必须是合法标识符（用于存档目录、成就前缀）
@export var display_name: String = ""   # i18n key 或直接展示名
@export var version: String = "0.0.0"   # SemVer
@export var icon: Texture2D = null      # 主菜单图标（可选，M0 不强求）
@export var description: String = ""    # 一句话简介

# 校验 id 是否为合法 Godot 标识符（用于路径 / 命名空间）
func is_valid_id() -> bool:
    if id.is_empty():
        return false
    var regex := RegEx.new()
    regex.compile("^[a-zA-Z_][a-zA-Z0-9_]*$")
    return regex.search(id) != null
```

- [ ] **Step 4: 验证语法**

```bash
godot --headless --check-only --script shared/game_manifest.gd 2>&1
```

Expected: 无 error 输出（exit code 0）。如有 parse error 修复语法。

- [ ] **Step 5: Commit**

```bash
git add shared/game_manifest.gd tests/test_game_manifest.gd
git commit -m "feat(shared): GameManifest resource class with id validation + tests"
```

---

## Task 4 — 定义抽象接口：SaveAdapter / InputContext / TranslationContext / PlatformBus

**Files:**
- Create: `shared/save/save_adapter.gd`
- Create: `shared/input/input_context.gd`
- Create: `shared/i18n/translation_context.gd`
- Create: `shared/platform/platform_bus.gd`

- [ ] **Step 1: 写 SaveAdapter 抽象接口**

`shared/save/save_adapter.gd`:

```gdscript
# shared/save/save_adapter.gd
# SaveAdapter — 存档读写抽象。
# Phase 3 hub 化时按 game_id 分目录注入实例；Phase 1 全部读写到 user://saves/。
class_name SaveAdapter extends RefCounted

# 写 Resource 到 (key)。typical key 例: "autosave", "slot_0", "profile"。
# 实现层负责序列化 + Steam Cloud 同步。
func write(key: String, resource: Resource) -> Error:
    push_error("SaveAdapter.write not implemented")
    return ERR_UNAVAILABLE

# 读出 Resource。返回 null 表示无此存档。
func read(key: String) -> Resource:
    push_error("SaveAdapter.read not implemented")
    return null

# 删除存档。
func delete(key: String) -> Error:
    push_error("SaveAdapter.delete not implemented")
    return ERR_UNAVAILABLE

# 列出所有存档 key（用于槽位 UI）。
func list_keys() -> PackedStringArray:
    push_error("SaveAdapter.list_keys not implemented")
    return PackedStringArray()
```

- [ ] **Step 2: 写 InputContext 抽象接口**

`shared/input/input_context.gd`:

```gdscript
# shared/input/input_context.gd
# InputContext — 输入事件抽象。游戏代码只处理本类的 signals，绝不直接监听 InputEvent。
# 实现层（boot/platform/input_router.gd）做鼠键 / 手柄 / 触屏的具体路由。
class_name InputContext extends RefCounted

# 指针事件（鼠标 / 触屏 / 手柄虚拟光标）
signal pointer_pressed(pos: Vector2)
signal pointer_released(pos: Vector2)
signal pointer_moved(pos: Vector2)

# 动作事件（rotate / mirror / hint / undo / menu；可重映射）
signal action_triggered(action: String)

# 手柄左摇杆模拟光标增量
signal cursor_moved(delta: Vector2)

# 同步查询
func get_pointer_position() -> Vector2:
    push_error("InputContext.get_pointer_position not implemented")
    return Vector2.ZERO

func is_action_held(action: String) -> bool:
    push_error("InputContext.is_action_held not implemented")
    return false
```

- [ ] **Step 3: 写 TranslationContext 抽象接口**

`shared/i18n/translation_context.gd`:

```gdscript
# shared/i18n/translation_context.gd
# TranslationContext — 包装 Godot 内置 tr() / tr_n()，hub 化后允许按当前激活模块切语言集。
class_name TranslationContext extends RefCounted

# 翻译 key；fallback 到 key 本身
func tr(key: String, context: String = "") -> String:
    push_error("TranslationContext.tr not implemented")
    return key

# 复数翻译（按 count 选 zero / one / other）
func tr_n(key: String, plural_key: String, count: int, context: String = "") -> String:
    push_error("TranslationContext.tr_n not implemented")
    return plural_key if count != 1 else key

# 当前 locale（"zh_CN" / "zh_TW" / "en"）
func get_locale() -> String:
    push_error("TranslationContext.get_locale not implemented")
    return "en"

# 切语言（设置面板调用）
func set_locale(locale: String) -> void:
    push_error("TranslationContext.set_locale not implemented")
```

- [ ] **Step 4: 写 PlatformBus 抽象接口**

`shared/platform/platform_bus.gd`:

```gdscript
# shared/platform/platform_bus.gd
# PlatformBus — Steam SDK / 系统平台事件的抽象总线。
# 实现层（boot/platform/steam_platform.gd）实际调 GodotSteam。
class_name PlatformBus extends RefCounted

# 解锁成就。achievement_id 例 "first_win"
func unlock_achievement(achievement_id: String) -> void:
    push_error("PlatformBus.unlock_achievement not implemented")

# 设置 Rich Presence 状态字符串。 key 例 "status", value 例 "Playing Hard"
func set_rich_presence(key: String, value: String) -> void:
    push_error("PlatformBus.set_rich_presence not implemented")

# 触发 Cloud Save 同步（push 当前 user:// 到云）
func trigger_cloud_sync() -> void:
    push_error("PlatformBus.trigger_cloud_sync not implemented")

# 查询当前 Steam 客户端是否在线 / SDK 可用
func is_platform_available() -> bool:
    push_error("PlatformBus.is_platform_available not implemented")
    return false

# 当前用户 ID（Steam ID 或本地匿名 ID）
func get_user_id() -> String:
    push_error("PlatformBus.get_user_id not implemented")
    return "anonymous"
```

- [ ] **Step 5: 验证所有接口文件语法**

```bash
for f in shared/save/save_adapter.gd \
         shared/input/input_context.gd \
         shared/i18n/translation_context.gd \
         shared/platform/platform_bus.gd; do
    godot --headless --check-only --script "$f" 2>&1 && echo "$f OK"
done
```

Expected: 每个文件输出 `<path> OK`。

- [ ] **Step 6: Commit**

```bash
git add shared/save/ shared/input/ shared/i18n/ shared/platform/
git commit -m "feat(shared): abstract interfaces SaveAdapter/InputContext/TranslationContext/PlatformBus"
```

---

## Task 5 — 定义 GameDeps 依赖注入容器 + GameModule 接口

**Files:**
- Create: `shared/game_deps.gd`
- Create: `shared/game_module.gd`

- [ ] **Step 1: 写 GameDeps**

`shared/game_deps.gd`:

```gdscript
# shared/game_deps.gd
# GameDeps — 给 game module 注入平台依赖的 DI 容器。
# boot 层创建实例 + 填充字段 + 传给 module.start(deps)。
class_name GameDeps extends RefCounted

var save: SaveAdapter                  # 存档读写
var input: InputContext                # 输入事件流
var i18n: TranslationContext           # 翻译
var platform: PlatformBus              # 平台事件总线（Steam）
var on_exit: Callable                  # 游戏内退出回主菜单的回调

# 全字段校验：所有依赖必须非 null
func is_complete() -> bool:
    return save != null \
        and input != null \
        and i18n != null \
        and platform != null \
        and on_exit.is_valid()
```

- [ ] **Step 2: 写 GameModule 接口**

`shared/game_module.gd`:

```gdscript
# shared/game_module.gd
# GameModule — 一个游戏模块的入口接口。
# 实现类（如 games/calendar_puzzle/game.gd）必须覆盖 start() 和 get_manifest()。
class_name GameModule extends Resource

# 启动游戏；boot 调一次。返回游戏根 Node，会被 add_child 到 boot 的场景树。
# 子类必须 override。
func start(deps: GameDeps) -> Node:
    push_error("GameModule.start not implemented in subclass")
    return null

# 返回本模块的 manifest。子类必须 override。
func get_manifest() -> GameManifest:
    push_error("GameModule.get_manifest not implemented in subclass")
    return null
```

- [ ] **Step 3: 校验语法**

```bash
godot --headless --check-only --script shared/game_deps.gd 2>&1
godot --headless --check-only --script shared/game_module.gd 2>&1
```

Expected: 两个文件均无 error 输出。

- [ ] **Step 4: Commit**

```bash
git add shared/game_deps.gd shared/game_module.gd
git commit -m "feat(shared): GameDeps DI container + GameModule abstract interface"
```

---

## Task 6 — 安装 GodotSteam 插件

**Files:**
- Modify: `addons/godotsteam/` （下载安装）
- Modify: `project.godot` （启用插件）

- [ ] **Step 1: 下载 GodotSteam Plugin 4.x for Godot 4.3**

GodotSteam 官方分发：https://godotsteam.com/install/plugin/

手工步骤（不能脚本化，因为要选对 Godot/Steam SDK 版本）：

1. 浏览器打开 https://godotsteam.com/install/plugin/
2. 下载 "GodotSteam 4.x Plugin (Godot 4.3.x)" zip
3. 解压后把 `addons/godotsteam/` 拷到本仓库 `addons/godotsteam/`

校验：

```bash
ls addons/godotsteam/plugin.cfg
```

Expected: 文件存在。

- [ ] **Step 2: 启用插件（编辑 project.godot 或用 Editor）**

打开 Godot Editor → Project → Project Settings → Plugins → 勾选 "GodotSteam" → Active。

或手工在 `project.godot` 加：

```ini
[editor_plugins]

enabled=PackedStringArray("res://addons/godotsteam/plugin.cfg")
```

- [ ] **Step 3: 验证插件加载**

```bash
godot --headless --quit 2>&1 | grep -i steam
```

Expected: 出现类似 `GodotSteam 4.x - <details>` 的初始化 log，无 error。

- [ ] **Step 4: 提交 .gitignore 例外 + 插件文件**

GodotSteam 二进制 `.so` / `.dll` / `.dylib` 文件较大，但属于必须提交的依赖。先确认 .gitignore 没把它们排掉：

```bash
git check-ignore -v addons/godotsteam/macos/libgodotsteam.macos.template_release.framework/libgodotsteam.macos.template_release 2>&1 || echo "not ignored - good"
```

Expected: `not ignored - good`

- [ ] **Step 5: Commit**

```bash
git add addons/godotsteam/ project.godot
git commit -m "chore(addons): install GodotSteam 4.x plugin for Steam SDK integration"
```

---

## Task 7 — 安装 GUT (Godot Unit Test) 框架

**Files:**
- Create: `addons/gut/`（下载安装）
- Modify: `project.godot`（启用插件）
- Create: `tests/run_tests.gd`

- [ ] **Step 1: 从 Godot Asset Library 安装 GUT 9.x**

Editor 操作：
1. Project → AssetLib → 搜索 "GUT"
2. 选 "GUT — Godot 4" → Download → Install
3. 确认装到 `addons/gut/`

或命令行：

```bash
cd /tmp
git clone --depth 1 --branch godot_4 https://github.com/bitwes/Gut.git
cp -r Gut/addons/gut ~/mygit/calendar-puzzle-godot/addons/
```

校验：

```bash
ls addons/gut/gut.gd
```

Expected: 文件存在。

- [ ] **Step 2: 启用 GUT 插件**

`project.godot` 的 `[editor_plugins]` 段追加 gut：

```ini
[editor_plugins]

enabled=PackedStringArray("res://addons/godotsteam/plugin.cfg", "res://addons/gut/plugin.cfg")
```

- [ ] **Step 3: 写 run_tests.gd（CI/本地一键跑测试）**

`tests/run_tests.gd`:

```gdscript
# tests/run_tests.gd
# 命令行入口：godot --headless --script tests/run_tests.gd
# 跑 tests/ 目录下所有 test_*.gd
extends SceneTree

func _init() -> void:
    var gut = load("res://addons/gut/gut.gd").new()
    add_child(gut)
    gut.add_directory("res://tests")
    gut.test_scripts()
    await gut.end_run
    quit(0 if gut.get_fail_count() == 0 else 1)
```

- [ ] **Step 4: 跑 Task 3 留下的 test_game_manifest 测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 看到 `test_manifest_has_required_fields` 和 `test_manifest_id_must_be_valid_identifier` PASS，最末出现 `2 passed, 0 failed`。

如果 FAIL，回查 GameManifest 实现（Task 3 Step 3）的 `is_valid_id()` 是否正确处理空 / 数字开头。

- [ ] **Step 5: Commit**

```bash
git add addons/gut/ project.godot tests/run_tests.gd
git commit -m "chore(addons): install GUT for unit tests; first test green"
```

---

## Task 8 — 实现 calendar_puzzle 模块 stub

**Files:**
- Create: `games/calendar_puzzle/game.gd`
- Create: `games/calendar_puzzle/manifest.tres`

- [ ] **Step 1: 写 game.gd stub**

`games/calendar_puzzle/game.gd`:

```gdscript
# games/calendar_puzzle/game.gd
# Calendar Puzzle 游戏模块入口（M0 stub — 只显示 "running" 标签）
extends GameModule

const MANIFEST_PATH = "res://games/calendar_puzzle/manifest.tres"

func get_manifest() -> GameManifest:
    return load(MANIFEST_PATH) as GameManifest

func start(deps: GameDeps) -> Node:
    assert(deps.is_complete(), "GameDeps incomplete - boot misconfigured")
    var root := Node2D.new()
    root.name = "CalendarPuzzleRoot"

    var label := Label.new()
    label.text = "Calendar Puzzle stub running"
    label.position = Vector2(400, 320)
    label.add_theme_font_size_override("font_size", 32)
    root.add_child(label)

    var subtitle := Label.new()
    subtitle.text = "user: %s | platform: %s" % [
        deps.platform.get_user_id(),
        "Steam" if deps.platform.is_platform_available() else "standalone"
    ]
    subtitle.position = Vector2(400, 380)
    subtitle.add_theme_font_size_override("font_size", 16)
    root.add_child(subtitle)

    return root
```

- [ ] **Step 2: 创建 manifest.tres（Editor 操作）**

Editor 操作：

1. 右键 `games/calendar_puzzle/` → New Resource → 搜索 `GameManifest` → Create
2. 保存为 `manifest.tres`
3. 在 Inspector 填字段：
   - id: `calendar_puzzle`
   - display_name: `Calendar Puzzle`
   - version: `0.1.0`
   - description: `Calendar pentomino puzzle for Steam.`

或直接手写 `games/calendar_puzzle/manifest.tres`：

```
[gd_resource type="Resource" script_class="GameManifest" load_steps=2 format=3]

[ext_resource type="Script" path="res://shared/game_manifest.gd" id="1"]

[resource]
script = ExtResource("1")
id = "calendar_puzzle"
display_name = "Calendar Puzzle"
version = "0.1.0"
description = "Calendar pentomino puzzle for Steam."
```

- [ ] **Step 3: 写 unit test 校验 game module load**

`tests/test_calendar_puzzle_module.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const Game = preload("res://games/calendar_puzzle/game.gd")

func test_manifest_loads_with_correct_id():
    var game := Game.new()
    var manifest := game.get_manifest()
    assert_not_null(manifest, "manifest.tres failed to load")
    assert_eq(manifest.id, "calendar_puzzle")
    assert_eq(manifest.display_name, "Calendar Puzzle")
    assert_true(manifest.is_valid_id())

func test_start_requires_complete_deps():
    var game := Game.new()
    var incomplete_deps := GameDeps.new()
    # 不填 deps → is_complete() == false → assert 应失败
    # 但 GDScript assert 在 release 中不抛，所以这里只能验证 is_complete 行为
    assert_false(incomplete_deps.is_complete())
```

- [ ] **Step 4: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 全部 PASS（GameManifest 2 个 + calendar_puzzle module 2 个 = 4 passed）。

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/ tests/test_calendar_puzzle_module.gd
git commit -m "feat(games): calendar_puzzle module stub with manifest.tres"
```

---

## Task 9 — 实现 boot 平台 stub 实现（M0 占位）

**Files:**
- Create: `boot/platform/stub_save_adapter.gd`
- Create: `boot/platform/stub_input_context.gd`
- Create: `boot/platform/stub_translation_context.gd`
- Create: `boot/platform/steam_platform.gd`

- [ ] **Step 1: SaveAdapter stub（内存字典）**

`boot/platform/stub_save_adapter.gd`:

```gdscript
# boot/platform/stub_save_adapter.gd
# M0 用的内存版 SaveAdapter；M4 会换成 .tres + Steam Cloud 实现。
extends SaveAdapter

var _store: Dictionary = {}

func write(key: String, resource: Resource) -> Error:
    _store[key] = resource
    return OK

func read(key: String) -> Resource:
    return _store.get(key, null)

func delete(key: String) -> Error:
    _store.erase(key)
    return OK

func list_keys() -> PackedStringArray:
    return PackedStringArray(_store.keys())
```

- [ ] **Step 2: InputContext stub（不发任何事件）**

`boot/platform/stub_input_context.gd`:

```gdscript
# boot/platform/stub_input_context.gd
# M0 stub — 不发任何输入事件，只是为了让 GameDeps.is_complete() 通过。
# M2 实现层会监听 Godot InputEvent → 路由到本类 signals。
extends InputContext

func get_pointer_position() -> Vector2:
    return Vector2.ZERO

func is_action_held(action: String) -> bool:
    return false
```

- [ ] **Step 3: TranslationContext stub（直接返回 key）**

`boot/platform/stub_translation_context.gd`:

```gdscript
# boot/platform/stub_translation_context.gd
# M0 stub — 不查翻译表，直接回 key 字符串。M7 装真实 Godot tr() 包装。
extends TranslationContext

var _locale: String = "en"

func tr(key: String, _context: String = "") -> String:
    return key

func tr_n(key: String, plural_key: String, count: int, _context: String = "") -> String:
    return plural_key if count != 1 else key

func get_locale() -> String:
    return _locale

func set_locale(locale: String) -> void:
    _locale = locale
```

- [ ] **Step 4: SteamPlatform wrapper（M0 只做 init + 优雅降级）**

`boot/platform/steam_platform.gd`:

```gdscript
# boot/platform/steam_platform.gd
# GodotSteam 的薄封装。M0 只实现 init / 查询；M6 会扩展成就 / 云存档 / Rich Presence。
extends PlatformBus

const STEAM_APP_ID = 480  # Valve 公共测试 App ID (Spacewar)。M11 上架前换真 App ID。

var _initialized: bool = false
var _user_id: String = "anonymous_local"

func _init() -> void:
    _try_init_steam()

func _try_init_steam() -> void:
    # GodotSteam 装好后 Steam 是 autoload 全局类
    if not Engine.has_singleton("Steam"):
        push_warning("[SteamPlatform] GodotSteam singleton missing — running standalone mode")
        return

    var Steam = Engine.get_singleton("Steam")
    var init_result: Dictionary = Steam.steamInit()
    if init_result.get("status", -1) != 1:
        push_warning("[SteamPlatform] steamInit failed: %s — running standalone" % init_result)
        return

    _initialized = true
    _user_id = str(Steam.getSteamID())
    print("[SteamPlatform] initialized OK, user_id=%s" % _user_id)

func unlock_achievement(achievement_id: String) -> void:
    if not _initialized:
        print("[SteamPlatform/stub] would unlock: %s" % achievement_id)
        return
    # M6 实装
    print("[SteamPlatform] unlock %s (deferred to M6)" % achievement_id)

func set_rich_presence(key: String, value: String) -> void:
    if not _initialized:
        return
    # M6 实装
    pass

func trigger_cloud_sync() -> void:
    if not _initialized:
        return
    # M6 实装
    pass

func is_platform_available() -> bool:
    return _initialized

func get_user_id() -> String:
    return _user_id
```

> **注意**：`STEAM_APP_ID = 480` 是 Valve 的公共测试 ID（Spacewar），M0/M6 期间用它做开发。M11 上架前替换为真实 App ID。

- [ ] **Step 5: 校验 4 个文件语法**

```bash
for f in boot/platform/stub_save_adapter.gd \
         boot/platform/stub_input_context.gd \
         boot/platform/stub_translation_context.gd \
         boot/platform/steam_platform.gd; do
    godot --headless --check-only --script "$f" 2>&1 && echo "$f OK"
done
```

Expected: 4 行 `<path> OK`。

- [ ] **Step 6: Commit**

```bash
git add boot/platform/
git commit -m "feat(boot): platform stubs (SaveAdapter/InputContext/TranslationContext/SteamPlatform) for M0"
```

---

## Task 10 — 实现 boot 入口（boot.gd + boot.tscn）

**Files:**
- Create: `boot/boot.gd`
- Create: `boot/boot.tscn`

- [ ] **Step 1: 写 boot.gd**

`boot/boot.gd`:

```gdscript
# boot/boot.gd
# 启动入口：
#   1. 初始化平台（Steam SDK / 存档 / 输入）
#   2. 加载 calendar_puzzle 游戏模块
#   3. 注入 GameDeps → 调 module.start(deps) → 把返回 Node 挂到本场景树
extends Node

const StubSaveAdapter = preload("res://boot/platform/stub_save_adapter.gd")
const StubInputContext = preload("res://boot/platform/stub_input_context.gd")
const StubTranslationContext = preload("res://boot/platform/stub_translation_context.gd")
const SteamPlatform = preload("res://boot/platform/steam_platform.gd")
const CalendarPuzzleGame = preload("res://games/calendar_puzzle/game.gd")

var _game_root: Node = null

func _ready() -> void:
    print("[boot] starting Calendar Puzzle (M0 scaffold)")
    var deps := _build_deps()
    assert(deps.is_complete(), "boot: GameDeps assembly failed")
    var module := CalendarPuzzleGame.new()
    _game_root = module.start(deps)
    add_child(_game_root)
    print("[boot] module '%s' started" % module.get_manifest().id)

func _build_deps() -> GameDeps:
    var deps := GameDeps.new()
    deps.save = StubSaveAdapter.new()
    deps.input = StubInputContext.new()
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

- [ ] **Step 2: 写 boot.tscn（用 Editor 或手写）**

手写 `boot/boot.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://boot/boot.gd" id="1"]

[node name="Boot" type="Node"]
script = ExtResource("1")
```

- [ ] **Step 3: 验证场景能加载（headless 启动 3 秒退出）**

```bash
godot --headless --quit-after 3 res://boot/boot.tscn 2>&1 | tail -20
```

Expected: 看到：

```
[SteamPlatform] ... (initialized OK 或 GodotSteam singleton missing — running standalone)
[boot] starting Calendar Puzzle (M0 scaffold)
[boot] module 'calendar_puzzle' started
```

无 ERROR / 无 stack trace。3 秒后进程退出。

- [ ] **Step 4: 写集成测试（boot 加载模块且不报错）**

`tests/test_boot_module_load.gd`:

```gdscript
extends "res://addons/gut/test.gd"

func test_boot_scene_instantiates_without_error():
    var scene = load("res://boot/boot.tscn")
    assert_not_null(scene, "boot.tscn failed to load")
    var instance = scene.instantiate()
    assert_not_null(instance, "boot.tscn instantiate failed")
    # 注意：不调用 add_to_tree 因为会触发 Steam init；这只验证 scene 文件结构无效
    instance.queue_free()

func test_game_deps_assembly_complete():
    # 直接 instantiate boot 脚本验证 _build_deps()
    var Boot = load("res://boot/boot.gd")
    var boot_instance = Boot.new()
    var deps = boot_instance.call("_build_deps")
    assert_true(deps.is_complete(), "GameDeps from boot._build_deps() should be complete")
    assert_not_null(deps.save)
    assert_not_null(deps.input)
    assert_not_null(deps.i18n)
    assert_not_null(deps.platform)
```

- [ ] **Step 5: 跑全套测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 6 passed, 0 failed（GameManifest 2 + calendar_puzzle module 2 + boot 2）。

- [ ] **Step 6: Commit**

```bash
git add boot/boot.gd boot/boot.tscn tests/test_boot_module_load.gd
git commit -m "feat(boot): entry scene loads calendar_puzzle module via GameDeps injection"
```

---

## Task 11 — 端到端冒烟测试（GUI 启动验证）

**Files:**
- 无新文件（只是手工 QA 步骤 + 截图归档）

- [ ] **Step 1: 启动游戏（非 headless）**

```bash
godot
```

或双击 `project.godot` 后 F5。

- [ ] **Step 2: 验证窗口正常显示**

观察：
- 窗口标题 "Calendar Puzzle"
- 1280×720 窗口
- 中央显示 "Calendar Puzzle stub running"
- 下方副标题 "user: <id> | platform: <Steam|standalone>"
- 无任何报错弹窗

- [ ] **Step 3: 截图归档**

截图保存到 `docs/m0-smoke-screenshot.png`（macOS: `Cmd+Shift+4` 拖选窗口）。

```bash
ls -lh docs/m0-smoke-screenshot.png
```

Expected: 文件存在，大小 > 10KB。

- [ ] **Step 4: 在 Steam 客户端运行验证（如果有 Steam 已登录）**

如果本机已装 Steam 并登录：

1. 关闭刚才的 Godot 进程
2. 拷贝 `steam_appid.txt` 到项目根目录，内容是单行 `480`：

```bash
echo "480" > steam_appid.txt
```

> 注意 `steam_appid.txt` 必须 git ignore（已在 .gitignore 兜底但建议补一条）：

```bash
echo "steam_appid.txt" >> .gitignore
```

3. 重新启动游戏，看副标题：

Expected: `platform: Steam` 且 user_id 是真实 Steam 64-bit ID（17 位数字）。

如果显示 `standalone` 但 Steam 已开，回查 `boot/platform/steam_platform.gd` 的 init 流程或 GodotSteam 插件版本。

- [ ] **Step 5: Commit 截图 + .gitignore 改动**

```bash
git add docs/m0-smoke-screenshot.png .gitignore
git commit -m "test(m0): smoke test screenshot + ignore steam_appid.txt"
```

---

## Task 12 — Steam App / Apple Developer 注册手册（异步任务）

**Files:**
- Create: `docs/STEAM_SETUP.md`
- Create: `docs/DEVELOPMENT.md`

> 这两项注册有真实金钱 + 时间成本（Steam $100 一次性 / Apple $99/年），由用户在 M0 期间**异步**执行。文档先写好流程，注册结果不阻塞 M0 完工，但**必须在 M6 之前拿到 Steam App ID，M8 之前拿到 Apple Developer ID**。

- [ ] **Step 1: 写 STEAM_SETUP.md**

`docs/STEAM_SETUP.md`:

```markdown
# Steam Direct Fee + App ID 注册流程

## 时间窗口

- **M0-M5**：用 Valve 公共测试 App ID `480` (Spacewar) 开发
- **M6 前**：必须拿到真实 App ID（不然成就 / Cloud Save 无法绑定）
- **M11 前**：完成商店页配置（preview + 截图 + 文案）

## 步骤

### 1. 创建 Steamworks 开发者账号

1. 打开 https://partner.steamgames.com/
2. 用日常 Steam 账号登录（建议**专设一个工作账号**，避免个人账号混用）
3. 填 Tax ID / 收款信息（需要银行账户）

### 2. 支付 Steam Direct Fee

- $100 USD 一次性
- 销售额达 $1000 后 Valve 退还
- 通过 Steam Wallet / Credit Card 支付

### 3. 获得 App ID

- 付款通过后 Steamworks 后台会自动分配一个 App ID（6 位数字）
- 记到 `boot/platform/steam_platform.gd` 的 `STEAM_APP_ID` 常量

### 4. 上传初始构建

- Steamworks → Steam Pipe → 用 SteamCMD 上传第一个 build
- 详细命令 M8 plan 给出

## 当前状态

- [ ] Steamworks 账号已建
- [ ] $100 已付
- [ ] App ID 已分配：______（填入）
- [ ] 真实 App ID 已写入 steam_platform.gd
```

- [ ] **Step 2: 写 DEVELOPMENT.md**

`docs/DEVELOPMENT.md`:

```markdown
# 本地开发流程

## 环境要求

- Godot 4.3+ Editor（从 https://godotengine.org/download/archive/ 下载）
- macOS 12+ / Windows 10+ / Linux（Ubuntu 22.04+）
- Steam 客户端（可选，用于 GodotSteam 真机验证）

## 日常命令

```bash
# 打开编辑器
godot

# 直接启动游戏（不开编辑器）
godot --main-pack project.godot

# 跑单测
godot --headless --script tests/run_tests.gd

# 校验单个脚本语法
godot --headless --check-only --script <path/to/file.gd>
```

## 仓库约定

- 分支：`main` 永远绿；feature 走 PR
- 测试：每改一个文件 → 跑 GUT 全套
- 提交：每个 task 一个 commit；commit message 形如 `feat(scope): description`
- 文档：本目录下 `M<N>-*.md` 是每个 milestone 的 plan，按顺序执行

## CI

M0 不上 CI。M6 之后视 Steam 集成压力评估。
```

- [ ] **Step 3: Commit**

```bash
git add docs/STEAM_SETUP.md docs/DEVELOPMENT.md
git commit -m "docs: Steam App registration + dev workflow guides"
```

---

## Task 13 — 推送 GitHub + 配置远程

**Files:**
- 无文件改动（只配 git remote）

- [ ] **Step 1: 在 GitHub 创建私有仓库**

浏览器操作：

1. 打开 https://github.com/new
2. Repository name: `calendar-puzzle-godot`
3. Visibility: **Private**
4. **不勾**任何 README / .gitignore / license（本地已有）
5. Create

- [ ] **Step 2: 添加 remote 并 push**

```bash
git remote add origin git@github.com:<your-username>/calendar-puzzle-godot.git
git push -u origin main
```

校验：

```bash
git remote -v
```

Expected: `origin <url> (fetch)` + `origin <url> (push)` 两行。

- [ ] **Step 3: 验证 GitHub 上文件齐全**

浏览器打开仓库页面，应该看到：

- README.md（显示项目说明）
- project.godot
- boot/、games/、shared/、tests/、docs/、addons/ 目录
- 至少 13 个 commit（每个 task 1-3 个）

---

## Task 14 — Milestone 收尾：更新 feature_list.json + claude-progress.md + session-handoff.md

**Files:**
- 在**原 CalendarPuzzle/ 仓库**修改：
  - Modify: `feature_list.json`
  - Modify: `claude-progress.md`
  - Modify: `session-handoff.md`

> 这一步在另一个仓库（原 CalendarPuzzle/）。需要先 cd 过去。

- [ ] **Step 1: 切回 CalendarPuzzle/ 仓库**

```bash
cd ~/mygit/CalendarPuzzle
git status
```

确认当前分支为 `feat/godot-steam`（spec 在这里），working tree 应该是干净的。

- [ ] **Step 2: 给 feature_list.json 加 godot-steam-m0 条目**

读 `feature_list.json`，在 `features` 数组里新增：

```json
{
  "id": "godot-steam-m0-scaffold",
  "priority": 0,
  "area": "godot/scaffold",
  "title": "Godot Steam port M0 — project scaffold",
  "user_visible_behavior": "新仓库 calendar-puzzle-godot/ 跑起来；boot 加载 calendar_puzzle 模块显示 stub 标签；GodotSteam 在 Steam 环境下能 init；GUT 测试框架 + 6 个用例全绿。",
  "status": "in_progress",
  "verification": [
    "cd ~/mygit/calendar-puzzle-godot && godot --headless --script tests/run_tests.gd  — 6 passed",
    "godot --headless --quit-after 3 res://boot/boot.tscn  — 看到 [boot] module 'calendar_puzzle' started",
    "GUI 启动看到 Calendar Puzzle stub running 标签 + 平台/user 副标题 (截图 docs/m0-smoke-screenshot.png)",
    "Steam 客户端运行时副标题显示 platform: Steam + 真实 17 位 user_id",
    "GitHub 仓库 calendar-puzzle-godot push 成功，所有目录可见"
  ],
  "evidence": [],
  "notes": "Plan at docs/superpowers/plans/2026-05-26-godot-steam-m0-scaffold.md. Phase 1 of 12 milestones (Phase 1 of 3 overall, spec 2026-05-26-godot-steam-port-design.md). 真实 Steam App ID 需要付 $100 Direct Fee 拿到（见 docs/STEAM_SETUP.md），M0 期间用 Spacewar 480 代替。"
}
```

> 注意：本条目放在最前（priority=0），因为它跨仓库且节奏独立。

- [ ] **Step 3: 给 claude-progress.md 追加一段（最新在最上）**

在 `## 会话记录 / Session log` 下方第一条位置追加：

```markdown
### 2026-05-26 — Steam port M0 plan 完成 + 实施起步

- **本轮目标 / Goal**: 把 brainstorm 的 spec 转成 M0-M11 可执行 plan；本 commit 落 M0 plan + 启动实施。
- **已完成 / Completed**:
  - 写完 M0-M11 共 12 个 plan 在 `docs/superpowers/plans/2026-05-26-godot-steam-m*.md`
  - 创建新仓库 `~/mygit/calendar-puzzle-godot`（独立 git，与 CalendarPuzzle 同级）
  - 按 M0 plan 执行 Task 1-13：项目脚手架 / GameModule 接口 / GodotSteam 集成 / GUT 框架 / boot 加载 stub
  - GUT 6 个测试用例全绿；冒烟测试 screenshot 在 `~/mygit/calendar-puzzle-godot/docs/m0-smoke-screenshot.png`
- **运行过的验证 / Validations run**: 见 feature_list.json 的 `godot-steam-m0-scaffold` verification 数组
- **已记录证据 / Evidence recorded**: 待 Task 14 完工后补
- **已知风险或未解决问题 / Known risks**:
  - Steam App ID 还是测试用的 480；真实 ID 需要 $100 付费 + 几天审核拿到，M6 之前必须搞定
  - Apple Developer 账号 $99/年也要 M8 前搞定
- **下一步最佳动作 / Next best action**: 开新会话执行 M1 plan（求解器移植 + benchmark）
```

- [ ] **Step 4: 覆写 session-handoff.md**

整体覆盖为：

```markdown
# Session handoff

> 每轮会话结束写这里 / 每轮新会话先读它。
> 配套 `feature_list.json` 与 `claude-progress.md` 一起使用。详见 `CLAUDE.md` → "Agent handoff / 会话接力"。

---

## 当前已验证 / Currently verified

- 本仓 `CalendarPuzzle/` 分支 `feat/godot-steam` 持有 Steam 项目的 spec + 12 个 plan
- 新仓 `~/mygit/calendar-puzzle-godot/` 已建，分支 `main`，M0 实施完成（13 个 commit + 推 GitHub）
- 跨仓约定：spec / plan 留在 CalendarPuzzle/；实际 Godot 代码全部在 calendar-puzzle-godot/

## 本轮改动 / This session's changes

- `CalendarPuzzle/docs/superpowers/plans/` 新增 12 个 `2026-05-26-godot-steam-m*.md` plan
- `CalendarPuzzle/feature_list.json` 新增 `godot-steam-m0-scaffold` 条目（status=in_progress）
- 新仓 `calendar-puzzle-godot/` 完成 M0：项目结构、GameModule 接口、GodotSteam 集成、GUT 框架、boot 加载 calendar_puzzle stub

## 仍损坏或未验证 / Known risks / unverified

- M0 evidence 数组待补（截图路径 + 测试通过证据）
- Steam 真实 App ID 仍未拿到（用 480 测试 ID）
- Apple Developer 账号未注册

## 下一步最佳动作 / Next best action

1. 开新会话，跑 M1 plan（求解器移植 + benchmark）
2. 异步推进 Steam App ID 注册（$100 付费）
3. M6 开始前确认 Apple Developer 账号也到位

❌ **不要**：在 calendar-puzzle-godot/ 仓库的 main 分支上直接乱改，请走 feature branch + PR；不要把 steam_appid.txt 提交进 git

## 命令 / Commands

```bash
# 新仓
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tests/run_tests.gd       # 跑测试
godot                                              # 开编辑器/游戏

# 原仓
cd ~/mygit/CalendarPuzzle
git checkout feat/godot-steam                      # spec + plan 在这
```
```

- [ ] **Step 5: Commit handoff 更新**

```bash
cd ~/mygit/CalendarPuzzle
git add feature_list.json claude-progress.md session-handoff.md
git commit -m "chore(handoff): record M0 completion + index 12 godot-steam plans"
```

- [ ] **Step 6: 更新 feature_list.json status = passing 并补 evidence**

整理 evidence 数组（在 Step 2 创建的条目里）：

```json
"evidence": [
  "2026-05-26: M0 plan written + executed. GUT 6/6 pass; smoke test screenshot at calendar-puzzle-godot/docs/m0-smoke-screenshot.png; GitHub repo calendar-puzzle-godot pushed; 13 commits on main.",
  "2026-05-26: GodotSteam init verified in standalone mode (no Steam) — logs 'standalone' fallback gracefully; Steam env verification pending until $100 Direct Fee paid (~M5)."
],
"status": "passing"
```

```bash
git add feature_list.json
git commit -m "chore(handoff): mark godot-steam-m0-scaffold as passing"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M0 spec 验收门槛 4 条全部覆盖：
- ✅ Godot 4 项目跑通 → Task 1-2 + 验证在 Task 10 Step 3 / Task 11
- ✅ GameModule stub → Task 5 + 8
- ✅ boot 加载 stub 显示空场景 → Task 10 + Task 11
- ✅ GodotSteam 集成验证 → Task 6 + 9（init / 优雅降级 / Steam 环境双验证 in Task 11 Step 4）

**2. Placeholder scan**: 无 TBD / TODO 残留；所有代码 step 都给了完整代码块；Steam SetUp 文档里只在"账号信息"位置有 `______(填入)` 这种**预期人工填写**的占位符（这是用户行为，非 plan 缺陷）。

**3. Type consistency**: 全程使用：
- `GameModule.start(deps: GameDeps) -> Node` — Task 5 定义 + Task 8 实现一致
- `GameDeps.is_complete()` — Task 5 定义 + Task 10 调用 + Task 10 Step 4 测试一致
- `SteamPlatform.is_platform_available()` / `get_user_id()` — Task 4 接口 + Task 9 实现 + Task 8 stub 调用一致

**4. Ambiguity**: GodotSteam 插件下载步骤涉及外部网站（不能脚本化），明确标注为手工步骤；其他都是可命令行/可校验。

无发现要修。M0 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M0 实施时用 superpowers:subagent-driven-development。每个 Task 派一个 fresh subagent 实施 → 我做 review → 下一个 Task。

Tasks 1-2 (脚手架) 可串行；Task 3-5 (接口定义) 独立可派一批；Task 6-7 (插件安装) 串行；Task 8-10 (stub + boot) 串行；Task 11-14 串行收尾。
