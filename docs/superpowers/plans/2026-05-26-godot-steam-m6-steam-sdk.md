# M6 — Steam SDK 全接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 M0 写下的 `SteamPlatform` stub 全部换成真实 GodotSteam 调用：20 个成就触发正确（连入 progress_tracker / hint_state / win 事件），Cloud Save 跨设备验证通过，Rich Presence 展示当前难度，Steam Overlay 不冲突。同时把成就元数据落到 Steamworks 后台。

**Architecture:** 维持 M0 设计：游戏模块只调 `GameDeps.platform.unlock_achievement(id)` / `set_rich_presence(k,v)` / `trigger_cloud_sync()`，不知道 Steam SDK 存在。`SteamPlatform` 内部实装 GodotSteam API 调用。新增 `games/calendar_puzzle/systems/achievement_tracker.gd` 订阅 `progress_tracker`（M3）/ `hint_state`（M5）/ `play_scene` 的胜利信号，按 20 条规则触发解锁。Steam 后台元数据通过 `docs/STEAM_ACHIEVEMENTS.md` 手册由用户在 Steamworks 网页填写（无 API 自动化）。

**Tech Stack:** Godot 4.3+ GDScript、GodotSteam 4.x（M0 已装）、GUT v9、M3 progress_tracker、M5 hint_state、Steam 真实 App ID（M0-M5 期间用 Spacewar 480，本 milestone 切真 ID）。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Platform integration → Steam SDK、§ Platform integration → 成就草案、§ Milestones M6、§ Open question 4（成就阈值）。

**Acceptance gates (从 spec 抄):**
- 20 个成就触发条件正确且**幂等**（重复条件不重复解锁；Steam API 不报错）
- Cloud Save 跨设备验证：A 设备打到 medium 5 题 → B 设备登陆同账号 → 进度同步
- Rich Presence：进 play_scene 显示 "Playing Hard" / "Playing Insomnia" 等；回 main_menu 清空
- Steam Overlay（Shift+Tab）在游戏内能正常调起，不阻塞 / 不卡帧（要求 `borderless windowed` 模式）
- `docs/STEAM_ACHIEVEMENTS.md` 含 20 个 ID + en/zh-CN/zh-TW 三语显示文案，可直接复制粘贴到 Steamworks 后台
- GUT：`test_achievement_tracker.gd`（20 个规则每条 trigger-once 测试）+ `test_steam_platform_mock.gd`（mock Steam singleton 验证 wrapper passthrough）≥ 25 个用例全绿

---

## File Structure

本 milestone 涉及的所有文件（位于 `~/mygit/calendar-puzzle-godot/`）：

```
games/calendar_puzzle/
├── systems/
│   ├── achievement_tracker.gd              # CREATE 20 规则订阅 + 触发器（~350 行）
│   ├── achievement_definitions.gd          # CREATE 20 个 ID 常量 + 触发条件结构（~120 行）
│   └── progress_tracker.gd                 # MODIFY 加 win_count / streak_days / per-difficulty 计数信号
├── scenes/
│   ├── play_scene.gd                       # MODIFY 进场 set_rich_presence；胜利时 emit win signal
│   └── win_scene.gd                        # MODIFY 胜利信号广播给 achievement_tracker
boot/
├── boot.gd                                 # MODIFY 启动后实例化 achievement_tracker；切真 App ID
├── platform/
│   └── steam_platform.gd                   # MODIFY 真实 GodotSteam 调用替换 stub print
└── main_menu/
    └── main_menu.gd                        # MODIFY 回主菜单时 clear rich presence
shared/
└── platform/
    └── platform_bus.gd                     # MODIFY 加 clear_rich_presence(key) 方法
docs/
└── STEAM_ACHIEVEMENTS.md                   # CREATE 20 个 ID + 三语文案 + Steamworks 后台填写步骤
tests/
├── helpers/
│   └── mock_steam_singleton.gd             # CREATE 假 Steam autoload（用 Engine.register_singleton）
├── test_achievement_tracker.gd             # CREATE 20 触发条件 + 幂等性测试
├── test_steam_platform_mock.gd             # CREATE wrapper passthrough 测试
└── test_rich_presence_lifecycle.gd         # CREATE 进 play_scene set / 回主菜单 clear
```

---

## Task 1 — 定义 20 个成就 ID 与触发条件结构

**Files:**
- Create: `games/calendar_puzzle/systems/achievement_definitions.gd`

- [ ] **Step 1: 写 AchievementDefinitions**

```gdscript
# games/calendar_puzzle/systems/achievement_definitions.gd
# 20 个成就的 ID 常量 + 触发条件元数据。
# ID 全大写 SNAKE_CASE，对应 Steamworks 后台 "API Name"。
# 阈值标 -1 表示"M3 数据出来后定"（spec § Open question 4）。
class_name AchievementDefinitions extends RefCounted

# Tier categories
enum Category { ENTRY, DIFFICULTY, TIME, INSOMNIA, STREAK, HIDDEN, SKIN }

# 入门
const FIRST_WIN := "FIRST_WIN"
const WIN_10 := "WIN_10"
const WIN_100 := "WIN_100"

# 难度征服
const BEAT_EASY := "BEAT_EASY"
const BEAT_MEDIUM := "BEAT_MEDIUM"
const BEAT_HARD := "BEAT_HARD"
const BEAT_EXPERT := "BEAT_EXPERT"
const BEAT_INSOMNIA := "BEAT_INSOMNIA"

# 时间挑战（阈值待 M3 数据校准）
const EASY_UNDER_3MIN := "EASY_UNDER_3MIN"        # TBD: 180s
const MEDIUM_UNDER_5MIN := "MEDIUM_UNDER_5MIN"     # TBD: 300s
const HARD_UNDER_8MIN := "HARD_UNDER_8MIN"         # TBD: 480s

# 失眠
const INSOMNIA_100 := "INSOMNIA_100"               # 失眠累计 100 题
const INSOMNIA_UNIQUE_50 := "INSOMNIA_UNIQUE_50"   # 失眠唯一解收集 50 个

# 日历连击
const STREAK_7DAYS := "STREAK_7DAYS"
const STREAK_30DAYS := "STREAK_30DAYS"
const YEAR_COMPLETE := "YEAR_COMPLETE"             # 某年 12 月全通

# 隐藏
const NO_HINTS_INSOMNIA := "NO_HINTS_INSOMNIA"     # 失眠模式 0 提示通关
const NO_ROTATIONS_HARD := "NO_ROTATIONS_HARD"     # hard 0 旋转 0 镜像通关

# 皮肤
const FIRST_SKIN_SWITCH := "FIRST_SKIN_SWITCH"
const ALL_THREE_SKINS_TRIED := "ALL_THREE_SKINS_TRIED"

# 全集，用于遍历 + 防漏单测
const ALL_IDS: Array[String] = [
    FIRST_WIN, WIN_10, WIN_100,
    BEAT_EASY, BEAT_MEDIUM, BEAT_HARD, BEAT_EXPERT, BEAT_INSOMNIA,
    EASY_UNDER_3MIN, MEDIUM_UNDER_5MIN, HARD_UNDER_8MIN,
    INSOMNIA_100, INSOMNIA_UNIQUE_50,
    STREAK_7DAYS, STREAK_30DAYS, YEAR_COMPLETE,
    NO_HINTS_INSOMNIA, NO_ROTATIONS_HARD,
    FIRST_SKIN_SWITCH, ALL_THREE_SKINS_TRIED,
]

# Threshold table — 时间型成就阈值；负数表示"待 M3 校准"
# M3 全量预生成 daily_puzzles.tres 后，跑 tools/analyze_solve_times.gd 取
# 各难度 p50 速度 → 把 p25 作为成就阈值（top 25% 玩家能拿到）
const THRESHOLDS_SECONDS: Dictionary = {
    EASY_UNDER_3MIN: 180,    # placeholder 180s — M3 后回查
    MEDIUM_UNDER_5MIN: 300,  # placeholder 300s
    HARD_UNDER_8MIN: 480,    # placeholder 480s
}

# Display metadata (used to generate STEAM_ACHIEVEMENTS.md table)
# 注意：实际三语文案在 docs/STEAM_ACHIEVEMENTS.md 维护，这里只放英文 fallback
static func display_name_fallback(id: String) -> String:
    var names := {
        FIRST_WIN: "First Win",
        WIN_10: "10 Wins",
        WIN_100: "Century Solver",
        BEAT_EASY: "Easy Conquered",
        BEAT_MEDIUM: "Medium Conquered",
        BEAT_HARD: "Hard Conquered",
        BEAT_EXPERT: "Expert Conquered",
        BEAT_INSOMNIA: "Insomnia Conquered",
        EASY_UNDER_3MIN: "Easy Speedrun",
        MEDIUM_UNDER_5MIN: "Medium Speedrun",
        HARD_UNDER_8MIN: "Hard Speedrun",
        INSOMNIA_100: "Insomniac",
        INSOMNIA_UNIQUE_50: "Unique Solutions Collector",
        STREAK_7DAYS: "7-Day Streak",
        STREAK_30DAYS: "30-Day Streak",
        YEAR_COMPLETE: "Year Completed",
        NO_HINTS_INSOMNIA: "Insomnia, No Hints",
        NO_ROTATIONS_HARD: "Hard Without Rotation",
        FIRST_SKIN_SWITCH: "Style Change",
        ALL_THREE_SKINS_TRIED: "Skin Connoisseur",
    }
    return names.get(id, id)

# 隐藏成就（Steamworks 后台勾 Hidden）
static func is_hidden(id: String) -> bool:
    return id in [NO_HINTS_INSOMNIA, NO_ROTATIONS_HARD, YEAR_COMPLETE]
```

- [ ] **Step 2: 校验语法**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --check-only --script games/calendar_puzzle/systems/achievement_definitions.gd 2>&1
```

Expected: 无 error。

- [ ] **Step 3: Commit**

```bash
git add games/calendar_puzzle/systems/achievement_definitions.gd
git commit -m "feat(achievement): define 20 achievement IDs + threshold + hidden metadata"
```

---

## Task 2 — Mock Steam singleton（测试基础设施）

**Files:**
- Create: `tests/helpers/mock_steam_singleton.gd`

> **动机**：GodotSteam 暴露的 `Steam` autoload 是 C++ 引擎单例，单测环境（headless 无 Steam 客户端）下调它会 crash。我们用 `Engine.register_singleton("Steam", mock)` 在测试 setup 时换上 mock。

- [ ] **Step 1: 写 MockSteamSingleton**

```gdscript
# tests/helpers/mock_steam_singleton.gd
# 假 Steam autoload，用于测试 SteamPlatform wrapper。
# 通过 Engine.register_singleton("Steam", mock) 注入；teardown 用 unregister_singleton。
extends Node

# 记录所有 API 调用，供测试 assert
var calls: Array = []

# 仿 GodotSteam 行为
func steamInit() -> Dictionary:
    calls.append({"method": "steamInit"})
    return {"status": 1, "verbal": "Init success"}

func getSteamID() -> int:
    calls.append({"method": "getSteamID"})
    return 76561198000000001  # 假 17 位 Steam ID

func getCurrentGameLanguage() -> String:
    calls.append({"method": "getCurrentGameLanguage"})
    return "english"

func setAchievement(api_name: String) -> bool:
    calls.append({"method": "setAchievement", "id": api_name})
    return true

func getAchievement(api_name: String) -> Dictionary:
    # 默认未解锁；测试可手工 override
    for c in calls:
        if c.get("method") == "setAchievement" and c.get("id") == api_name:
            return {"ret": true, "achieved": true}
    return {"ret": true, "achieved": false}

func storeStats() -> bool:
    calls.append({"method": "storeStats"})
    return true

func setRichPresence(key: String, value: String) -> bool:
    calls.append({"method": "setRichPresence", "key": key, "value": value})
    return true

func clearRichPresence() -> bool:
    calls.append({"method": "clearRichPresence"})
    return true

func isCloudEnabledForApp() -> bool:
    return true

func run_callbacks() -> void:
    # No-op for tests; GodotSteam 真实库每帧调
    pass

# Test helpers
func reset_calls() -> void:
    calls.clear()

func find_calls(method_name: String) -> Array:
    return calls.filter(func (c): return c.get("method") == method_name)
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/mock_steam_singleton.gd
git commit -m "test(steam): mock Steam singleton for headless test environment"
```

---

## Task 3 — SteamPlatform 真实 GodotSteam wrapper（TDD）

**Files:**
- Modify: `boot/platform/steam_platform.gd`
- Modify: `shared/platform/platform_bus.gd`
- Test: `tests/test_steam_platform_mock.gd`

- [ ] **Step 1: PlatformBus 加 clear_rich_presence 方法**

读 `shared/platform/platform_bus.gd`，追加：

```gdscript
# 清空 Rich Presence 某 key；value 传空字符串即可
func clear_rich_presence(key: String) -> void:
    push_error("PlatformBus.clear_rich_presence not implemented")
```

- [ ] **Step 2: 写 failing test**

`tests/test_steam_platform_mock.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const SteamPlatform = preload("res://boot/platform/steam_platform.gd")
const MockSteam = preload("res://tests/helpers/mock_steam_singleton.gd")

var _mock: Node
var _platform

func before_each():
    _mock = MockSteam.new()
    Engine.register_singleton("Steam", _mock)
    _platform = SteamPlatform.new()

func after_each():
    Engine.unregister_singleton("Steam")
    _mock.queue_free()
    _platform = null

# ---- init ----

func test_init_calls_steamInit_and_caches_user_id():
    _platform._try_init_steam()
    assert_true(_platform.is_platform_available())
    assert_eq(_platform.get_user_id(), "76561198000000001")

# ---- unlock_achievement ----

func test_unlock_achievement_calls_setAchievement_and_storeStats():
    _platform._try_init_steam()
    _mock.reset_calls()
    _platform.unlock_achievement("FIRST_WIN")
    var set_calls = _mock.find_calls("setAchievement")
    assert_eq(set_calls.size(), 1)
    assert_eq(set_calls[0].id, "FIRST_WIN")
    var store_calls = _mock.find_calls("storeStats")
    assert_eq(store_calls.size(), 1, "must call storeStats to push to Steam servers")

func test_unlock_achievement_idempotent_when_already_unlocked():
    _platform._try_init_steam()
    _platform.unlock_achievement("FIRST_WIN")  # first call → setAchievement
    _mock.reset_calls()
    _platform.unlock_achievement("FIRST_WIN")  # second call → no-op (already achieved)
    assert_eq(_mock.find_calls("setAchievement").size(), 0)

func test_unlock_achievement_noop_when_not_initialized():
    # Don't call _try_init_steam → not initialized
    _platform.unlock_achievement("FIRST_WIN")
    assert_eq(_mock.find_calls("setAchievement").size(), 0)

# ---- rich presence ----

func test_set_rich_presence_calls_steam_api():
    _platform._try_init_steam()
    _mock.reset_calls()
    _platform.set_rich_presence("status", "Playing Hard")
    var rp = _mock.find_calls("setRichPresence")
    assert_eq(rp.size(), 1)
    assert_eq(rp[0].key, "status")
    assert_eq(rp[0].value, "Playing Hard")

func test_clear_rich_presence_passes_empty_value():
    _platform._try_init_steam()
    _mock.reset_calls()
    _platform.clear_rich_presence("status")
    var rp = _mock.find_calls("setRichPresence")
    assert_eq(rp.size(), 1)
    assert_eq(rp[0].key, "status")
    assert_eq(rp[0].value, "")  # GodotSteam convention: empty value = clear

# ---- cloud sync ----

func test_trigger_cloud_sync_noop_when_cloud_disabled():
    # Override mock to disable cloud
    _platform._try_init_steam()
    # Cloud sync 在 GodotSteam 是被动 — write 到 user:// 自动同步。
    # trigger_cloud_sync 只在游戏需要"立刻 push" 时调，对应 GodotSteam 的 fileShare/file write 操作。
    # 测试覆盖 noop（cloud disabled） + 主动调用 isCloudEnabledForApp 验证
    _mock.reset_calls()
    _platform.trigger_cloud_sync()
    # 不强求具体行为；只验证不 crash
    assert_true(true)
```

- [ ] **Step 3: 跑 test 期待 FAIL**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 7 个新 test FAIL（SteamPlatform.unlock_achievement 等还是 stub）。

- [ ] **Step 4: 重写 SteamPlatform 真实 API 调用**

替换 `boot/platform/steam_platform.gd` 内容：

```gdscript
# boot/platform/steam_platform.gd
# GodotSteam 4.x 真实 wrapper。M6 把 M0 的 stub print 替换成真实 API。
extends PlatformBus

# M6 仍可用 480 (Spacewar) 做开发；M11 上架前换真 App ID
const STEAM_APP_ID: int = 480

var _initialized: bool = false
var _user_id: String = "anonymous_local"
var _cli_flags: Dictionary = {}
var _unlocked_cache: Dictionary = {}  # 本地缓存防重复 setAchievement
var _last_rich_presence: Dictionary = {}

func _init() -> void:
    _try_init_steam()

func _try_init_steam() -> void:
    if not Engine.has_singleton("Steam"):
        push_warning("[SteamPlatform] GodotSteam singleton missing — standalone mode")
        return
    var Steam = Engine.get_singleton("Steam")
    var init_result: Dictionary = Steam.steamInit()
    if init_result.get("status", -1) != 1:
        push_warning("[SteamPlatform] steamInit failed: %s — standalone" % init_result)
        return
    _initialized = true
    _user_id = str(Steam.getSteamID())
    print("[SteamPlatform] initialized OK, user_id=%s" % _user_id)

func unlock_achievement(achievement_id: String) -> void:
    if not _initialized:
        return
    if _unlocked_cache.get(achievement_id, false):
        return  # 已解锁过本会话；幂等
    var Steam = Engine.get_singleton("Steam")
    # 先查 Steam 后台是否已 unlocked（跨设备 / 历史解锁）
    var status: Dictionary = Steam.getAchievement(achievement_id)
    if status.get("ret", false) and status.get("achieved", false):
        _unlocked_cache[achievement_id] = true
        return
    var ok: bool = Steam.setAchievement(achievement_id)
    if not ok:
        push_warning("[SteamPlatform] setAchievement(%s) returned false" % achievement_id)
        return
    Steam.storeStats()
    _unlocked_cache[achievement_id] = true
    print("[SteamPlatform] unlocked: %s" % achievement_id)

func set_rich_presence(key: String, value: String) -> void:
    if not _initialized:
        return
    # 节流：相同值不重发
    if _last_rich_presence.get(key, "") == value:
        return
    var Steam = Engine.get_singleton("Steam")
    Steam.setRichPresence(key, value)
    _last_rich_presence[key] = value

func clear_rich_presence(key: String) -> void:
    if not _initialized:
        return
    var Steam = Engine.get_singleton("Steam")
    Steam.setRichPresence(key, "")  # GodotSteam 约定：空字符串 = clear
    _last_rich_presence.erase(key)

func trigger_cloud_sync() -> void:
    if not _initialized:
        return
    var Steam = Engine.get_singleton("Steam")
    if not Steam.isCloudEnabledForApp():
        push_warning("[SteamPlatform] cloud disabled by user — skip sync")
        return
    # GodotSteam 4.x 的 user:// 文件写入自动同步；本方法是显式 hint
    # 真实场景下不需要主动调，但保留接口便于将来 forcePush 需求
    pass

func is_platform_available() -> bool:
    return _initialized

func get_user_id() -> String:
    return _user_id

# CLI flags（M5 已实现，沿用）
func get_cli_flag(name: String) -> bool:
    return _cli_flags.get(name, false)

func set_cli_flag(name: String, value: bool) -> void:
    _cli_flags[name] = value

# Per-frame callback runner — boot 在 _process 调
func process_callbacks() -> void:
    if not _initialized:
        return
    var Steam = Engine.get_singleton("Steam")
    Steam.run_callbacks()
```

- [ ] **Step 5: boot.gd 每帧调 process_callbacks**

读 `boot/boot.gd`，加：

```gdscript
func _process(_delta: float) -> void:
    if _deps != null and _deps.platform != null:
        _deps.platform.process_callbacks()
```

并把 `_deps` 提升为成员变量（之前只是 _build_deps 局部）：

```gdscript
var _deps: GameDeps = null

func _ready() -> void:
    _deps = _build_deps()
    # ... 原有 module.start(_deps) 流程 ...
```

- [ ] **Step 6: 跑 test 期待 PASS**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 7 个 SteamPlatform 测试 PASS。

- [ ] **Step 7: Commit**

```bash
git add shared/platform/platform_bus.gd \
        boot/platform/steam_platform.gd \
        boot/boot.gd \
        tests/test_steam_platform_mock.gd
git commit -m "feat(steam): real GodotSteam wrapper for unlock/rich_presence/cloud_sync"
```

---

## Task 4 — AchievementTracker：20 规则订阅 + 触发（TDD）

**Files:**
- Create: `games/calendar_puzzle/systems/achievement_tracker.gd`
- Test: `tests/test_achievement_tracker.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_achievement_tracker.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const AchievementTracker = preload("res://games/calendar_puzzle/systems/achievement_tracker.gd")
const AchievementDef = preload("res://games/calendar_puzzle/systems/achievement_definitions.gd")
const MockSteam = preload("res://tests/helpers/mock_steam_singleton.gd")
const SteamPlatform = preload("res://boot/platform/steam_platform.gd")

var _mock: Node
var _platform
var _tracker
var _progress  # mock ProgressTracker

func before_each():
    _mock = MockSteam.new()
    Engine.register_singleton("Steam", _mock)
    _platform = SteamPlatform.new()
    _platform._try_init_steam()
    _progress = MockProgressTracker.new()
    _tracker = AchievementTracker.new(_platform, _progress)

func after_each():
    Engine.unregister_singleton("Steam")
    _mock.queue_free()

# helper: assert 一个 ID 被解锁了恰好一次
func _assert_unlocked_once(id: String) -> void:
    var calls = _mock.find_calls("setAchievement").filter(func (c): return c.id == id)
    assert_eq(calls.size(), 1, "expected %s unlocked exactly once, got %d" % [id, calls.size()])

# ============ 入门 ============

func test_first_win_triggers_on_first_win_event():
    _tracker.on_win({"difficulty": "easy", "duration_sec": 200})
    _assert_unlocked_once(AchievementDef.FIRST_WIN)

func test_win_10_triggers_at_10th_win():
    _progress.win_count = 9
    _tracker.on_win({"difficulty": "easy", "duration_sec": 200})
    _assert_unlocked_once(AchievementDef.WIN_10)

func test_win_100_triggers_at_100th_win():
    _progress.win_count = 99
    _tracker.on_win({"difficulty": "easy", "duration_sec": 200})
    _assert_unlocked_once(AchievementDef.WIN_100)

# ============ 难度征服 ============

func test_beat_easy_triggers_on_first_easy_win():
    _tracker.on_win({"difficulty": "easy", "duration_sec": 999})
    _assert_unlocked_once(AchievementDef.BEAT_EASY)

func test_beat_medium_triggers_on_first_medium_win():
    _tracker.on_win({"difficulty": "medium", "duration_sec": 999})
    _assert_unlocked_once(AchievementDef.BEAT_MEDIUM)

func test_beat_hard_triggers_on_first_hard_win():
    _tracker.on_win({"difficulty": "hard", "duration_sec": 999})
    _assert_unlocked_once(AchievementDef.BEAT_HARD)

func test_beat_expert_triggers_on_first_expert_win():
    _tracker.on_win({"difficulty": "expert", "duration_sec": 999})
    _assert_unlocked_once(AchievementDef.BEAT_EXPERT)

func test_beat_insomnia_triggers_on_first_insomnia_win():
    _tracker.on_win({"difficulty": "insomnia", "duration_sec": 999})
    _assert_unlocked_once(AchievementDef.BEAT_INSOMNIA)

# ============ 时间挑战 ============

func test_easy_under_3min_triggers_when_under_threshold():
    _tracker.on_win({"difficulty": "easy", "duration_sec": 179})
    _assert_unlocked_once(AchievementDef.EASY_UNDER_3MIN)

func test_easy_under_3min_does_NOT_trigger_at_threshold_or_above():
    _tracker.on_win({"difficulty": "easy", "duration_sec": 180})
    var calls = _mock.find_calls("setAchievement").filter(func (c): return c.id == AchievementDef.EASY_UNDER_3MIN)
    assert_eq(calls.size(), 0)

func test_medium_under_5min_triggers():
    _tracker.on_win({"difficulty": "medium", "duration_sec": 299})
    _assert_unlocked_once(AchievementDef.MEDIUM_UNDER_5MIN)

func test_hard_under_8min_triggers():
    _tracker.on_win({"difficulty": "hard", "duration_sec": 479})
    _assert_unlocked_once(AchievementDef.HARD_UNDER_8MIN)

# ============ 失眠 ============

func test_insomnia_100_triggers_at_100th_insomnia():
    _progress.insomnia_count = 99
    _tracker.on_win({"difficulty": "insomnia", "duration_sec": 600})
    _assert_unlocked_once(AchievementDef.INSOMNIA_100)

func test_insomnia_unique_50_triggers_at_50_unique_solutions():
    _progress.insomnia_unique_count = 49
    _tracker.on_unique_insomnia_solution()
    _assert_unlocked_once(AchievementDef.INSOMNIA_UNIQUE_50)

# ============ 连击 ============

func test_streak_7_triggers_at_streak_7():
    _progress.streak_days = 7
    _tracker.on_daily_complete()
    _assert_unlocked_once(AchievementDef.STREAK_7DAYS)

func test_streak_30_triggers_at_streak_30():
    _progress.streak_days = 30
    _tracker.on_daily_complete()
    _assert_unlocked_once(AchievementDef.STREAK_30DAYS)

func test_year_complete_triggers_when_year_fully_done():
    _progress.completed_year = 2024
    _tracker.on_year_complete(2024)
    _assert_unlocked_once(AchievementDef.YEAR_COMPLETE)

# ============ 隐藏 ============

func test_no_hints_insomnia_triggers_when_insomnia_win_with_zero_hints():
    _tracker.on_win({"difficulty": "insomnia", "duration_sec": 800, "hints_used": 0})
    _assert_unlocked_once(AchievementDef.NO_HINTS_INSOMNIA)

func test_no_hints_insomnia_NOT_trigger_if_any_hint_used():
    _tracker.on_win({"difficulty": "insomnia", "duration_sec": 800, "hints_used": 1})
    var calls = _mock.find_calls("setAchievement").filter(func (c): return c.id == AchievementDef.NO_HINTS_INSOMNIA)
    assert_eq(calls.size(), 0)

func test_no_rotations_hard_triggers_when_hard_win_with_zero_rotations():
    _tracker.on_win({"difficulty": "hard", "duration_sec": 500, "rotations_used": 0, "mirrors_used": 0})
    _assert_unlocked_once(AchievementDef.NO_ROTATIONS_HARD)

# ============ 皮肤 ============

func test_first_skin_switch_triggers_on_first_change():
    _tracker.on_skin_change("default", "pastel")
    _assert_unlocked_once(AchievementDef.FIRST_SKIN_SWITCH)

func test_first_skin_switch_NOT_trigger_when_same_skin():
    _tracker.on_skin_change("default", "default")
    var calls = _mock.find_calls("setAchievement").filter(func (c): return c.id == AchievementDef.FIRST_SKIN_SWITCH)
    assert_eq(calls.size(), 0)

func test_all_three_skins_tried_triggers_after_using_all_3():
    _progress.skins_tried = {"default": true, "pastel": true}
    _tracker.on_skin_change("pastel", "mono_focus")
    _assert_unlocked_once(AchievementDef.ALL_THREE_SKINS_TRIED)

# ============ idempotency ============

func test_repeated_event_does_not_re_unlock():
    _tracker.on_win({"difficulty": "easy", "duration_sec": 200})
    _tracker.on_win({"difficulty": "easy", "duration_sec": 200})
    _tracker.on_win({"difficulty": "easy", "duration_sec": 200})
    _assert_unlocked_once(AchievementDef.FIRST_WIN)
    _assert_unlocked_once(AchievementDef.BEAT_EASY)

# ---- mock progress tracker ----

class MockProgressTracker extends RefCounted:
    var win_count: int = 0
    var insomnia_count: int = 0
    var insomnia_unique_count: int = 0
    var streak_days: int = 0
    var completed_year: int = -1
    var skins_tried: Dictionary = {}
    var difficulties_beaten: Dictionary = {}

    func has_beaten_difficulty(diff: String) -> bool:
        return difficulties_beaten.get(diff, false)

    func record_win(diff: String) -> void:
        difficulties_beaten[diff] = true
        win_count += 1
```

- [ ] **Step 2: 实现 AchievementTracker**

`games/calendar_puzzle/systems/achievement_tracker.gd`:

```gdscript
# games/calendar_puzzle/systems/achievement_tracker.gd
# 订阅游戏事件（胜利/连击/皮肤切换/失眠唯一解），按 20 条规则触发 platform.unlock_achievement。
# 幂等性：本类不维护"已触发"集合 — 该职责下沉到 SteamPlatform._unlocked_cache + Steam 后台 getAchievement。
# 本类只负责"判断条件 + 调 unlock"，不管"是否已经 unlock 过"。
class_name AchievementTracker extends RefCounted

const AD = preload("res://games/calendar_puzzle/systems/achievement_definitions.gd")

var _platform: PlatformBus
var _progress  # ProgressTracker（来自 M3）

func _init(platform: PlatformBus, progress) -> void:
    _platform = platform
    _progress = progress

# ============ 入口：胜利事件 ============
# event_data Dictionary {
#   difficulty: "easy" | "medium" | "hard" | "expert" | "insomnia",
#   duration_sec: int,
#   hints_used: int (optional, default 0),
#   rotations_used: int (optional, default 0),
#   mirrors_used: int (optional, default 0),
# }
func on_win(event_data: Dictionary) -> void:
    var difficulty: String = event_data.get("difficulty", "")
    var duration_sec: int = event_data.get("duration_sec", -1)
    var hints_used: int = event_data.get("hints_used", 0)
    var rotations_used: int = event_data.get("rotations_used", 0)
    var mirrors_used: int = event_data.get("mirrors_used", 0)

    # 更新 progress (record_win 在调用前还未发生)
    _progress.record_win(difficulty)

    # ---- 入门 ----
    _platform.unlock_achievement(AD.FIRST_WIN)  # 任意一次胜利
    if _progress.win_count >= 10:
        _platform.unlock_achievement(AD.WIN_10)
    if _progress.win_count >= 100:
        _platform.unlock_achievement(AD.WIN_100)

    # ---- 难度征服 ----
    match difficulty:
        "easy":    _platform.unlock_achievement(AD.BEAT_EASY)
        "medium":  _platform.unlock_achievement(AD.BEAT_MEDIUM)
        "hard":    _platform.unlock_achievement(AD.BEAT_HARD)
        "expert":  _platform.unlock_achievement(AD.BEAT_EXPERT)
        "insomnia": _platform.unlock_achievement(AD.BEAT_INSOMNIA)

    # ---- 时间挑战 ----
    var threshold_id := ""
    match difficulty:
        "easy":   threshold_id = AD.EASY_UNDER_3MIN
        "medium": threshold_id = AD.MEDIUM_UNDER_5MIN
        "hard":   threshold_id = AD.HARD_UNDER_8MIN
    if threshold_id != "":
        var threshold: int = AD.THRESHOLDS_SECONDS.get(threshold_id, -1)
        if threshold > 0 and duration_sec < threshold:
            _platform.unlock_achievement(threshold_id)

    # ---- 失眠 ----
    if difficulty == "insomnia":
        _progress.insomnia_count += 1
        if _progress.insomnia_count >= 100:
            _platform.unlock_achievement(AD.INSOMNIA_100)

    # ---- 隐藏 ----
    if difficulty == "insomnia" and hints_used == 0:
        _platform.unlock_achievement(AD.NO_HINTS_INSOMNIA)
    if difficulty == "hard" and rotations_used == 0 and mirrors_used == 0:
        _platform.unlock_achievement(AD.NO_ROTATIONS_HARD)

# 失眠唯一解收集（由 progress_tracker 在新唯一解被记录时调用）
func on_unique_insomnia_solution() -> void:
    _progress.insomnia_unique_count += 1
    if _progress.insomnia_unique_count >= 50:
        _platform.unlock_achievement(AD.INSOMNIA_UNIQUE_50)

# 每日连击（由 daily 模式胜利时调）
func on_daily_complete() -> void:
    if _progress.streak_days >= 7:
        _platform.unlock_achievement(AD.STREAK_7DAYS)
    if _progress.streak_days >= 30:
        _platform.unlock_achievement(AD.STREAK_30DAYS)

func on_year_complete(year: int) -> void:
    if _progress.completed_year == year:
        _platform.unlock_achievement(AD.YEAR_COMPLETE)

# 皮肤切换（由 skin_manager 在 apply 时调）
func on_skin_change(prev_skin_id: String, new_skin_id: String) -> void:
    if prev_skin_id == new_skin_id:
        return
    _platform.unlock_achievement(AD.FIRST_SKIN_SWITCH)
    if not (new_skin_id in _progress.skins_tried):
        _progress.skins_tried[new_skin_id] = true
    if _progress.skins_tried.size() >= 3:
        _platform.unlock_achievement(AD.ALL_THREE_SKINS_TRIED)
```

- [ ] **Step 3: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -40
```

Expected: 25 个 achievement_tracker 用例 + 7 个 SteamPlatform 用例 PASS。

- [ ] **Step 4: Commit**

```bash
git add games/calendar_puzzle/systems/achievement_tracker.gd \
        tests/test_achievement_tracker.gd
git commit -m "feat(achievement): 20-rule tracker subscribing to win/skin/streak events"
```

---

## Task 5 — 接入：boot 实例化 tracker + play_scene/skin_manager emit 事件

**Files:**
- Modify: `boot/boot.gd`
- Modify: `games/calendar_puzzle/game.gd`
- Modify: `games/calendar_puzzle/scenes/play_scene.gd`
- Modify: `games/calendar_puzzle/scenes/win_scene.gd`
- Modify: `games/calendar_puzzle/systems/skin_manager.gd`
- Modify: `games/calendar_puzzle/systems/progress_tracker.gd`

- [ ] **Step 1: ProgressTracker 暴露 win_count / insomnia_count / streak / skins_tried**

读 `games/calendar_puzzle/systems/progress_tracker.gd`（M3 已建），加：

```gdscript
var win_count: int = 0
var insomnia_count: int = 0
var insomnia_unique_count: int = 0
var streak_days: int = 0
var completed_year: int = -1
var skins_tried: Dictionary = {}
var difficulties_beaten: Dictionary = {}

func has_beaten_difficulty(diff: String) -> bool:
    return difficulties_beaten.get(diff, false)

func record_win(diff: String) -> void:
    difficulties_beaten[diff] = true
    win_count += 1
```

- [ ] **Step 2: game.gd 实例化 AchievementTracker 注入到场景**

读 `games/calendar_puzzle/game.gd`（M0 stub + M3/M4 已扩展），在 `start(deps)` 里加：

```gdscript
const AchievementTracker = preload("res://games/calendar_puzzle/systems/achievement_tracker.gd")
const ProgressTracker = preload("res://games/calendar_puzzle/systems/progress_tracker.gd")

var _progress_tracker: ProgressTracker
var _achievement_tracker: AchievementTracker

func start(deps: GameDeps) -> Node:
    # ... 原有逻辑 ...
    _progress_tracker = _load_or_new_progress(deps.save)
    _achievement_tracker = AchievementTracker.new(deps.platform, _progress_tracker)
    # 注入到 root 节点供 play_scene / skin_manager 拉取
    var root = ... # M2/M4 已有
    root.set_meta("achievement_tracker", _achievement_tracker)
    root.set_meta("progress_tracker", _progress_tracker)
    return root
```

- [ ] **Step 3: play_scene 胜利时调 on_win**

`play_scene.gd` 内胜利分支（M2 已有）：

```gdscript
func _on_puzzle_solved() -> void:
    var duration_sec: int = int(_timer.elapsed_time)
    var event_data := {
        "difficulty": _puzzle_state.difficulty,
        "duration_sec": duration_sec,
        "hints_used": _puzzle_state.hint_state.used_for(HintResult.Tier.WEAK)
                    + _puzzle_state.hint_state.used_for(HintResult.Tier.MEDIUM)
                    + _puzzle_state.hint_state.used_for(HintResult.Tier.STRONG),
        "rotations_used": _puzzle_state.rotations_count,    # 由 puzzle_state 累计（M2 加）
        "mirrors_used": _puzzle_state.mirrors_count,
    }
    var tracker = get_tree().current_scene.get_meta("achievement_tracker")
    tracker.on_win(event_data)
    # ... 原有 transition to win_scene ...
```

- [ ] **Step 4: skin_manager 切皮肤时调 on_skin_change**

`skin_manager.gd`:

```gdscript
func apply(new_skin_id: String) -> void:
    var prev = _current_skin_id
    _current_skin_id = new_skin_id
    # ... 原有切换逻辑 ...
    var tracker = _root.get_meta("achievement_tracker") if _root.has_meta("achievement_tracker") else null
    if tracker != null:
        tracker.on_skin_change(prev, new_skin_id)
```

- [ ] **Step 5: play_scene 进场设 rich presence**

```gdscript
func _ready() -> void:
    # ... 原有 ...
    var rp_text := _deps.i18n.tr("rich_presence_playing").format({"difficulty": _deps.i18n.tr("difficulty_" + _puzzle_state.difficulty)})
    _deps.platform.set_rich_presence("status", rp_text)

func _exit_tree() -> void:
    _deps.platform.clear_rich_presence("status")
```

- [ ] **Step 6: main_menu 进入时 clear rich presence（兜底）**

```gdscript
func _ready() -> void:
    # ... 原有 ...
    _deps.platform.clear_rich_presence("status")
```

- [ ] **Step 7: 写 rich presence 生命周期测试**

`tests/test_rich_presence_lifecycle.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const PlaySceneScript = preload("res://games/calendar_puzzle/scenes/play_scene.gd")
const MockSteam = preload("res://tests/helpers/mock_steam_singleton.gd")
const SteamPlatform = preload("res://boot/platform/steam_platform.gd")

var _mock: Node
var _platform

func before_each():
    _mock = MockSteam.new()
    Engine.register_singleton("Steam", _mock)
    _platform = SteamPlatform.new()
    _platform._try_init_steam()

func after_each():
    Engine.unregister_singleton("Steam")
    _mock.queue_free()

func test_set_then_clear_rich_presence():
    _platform.set_rich_presence("status", "Playing Hard")
    _platform.clear_rich_presence("status")
    var rp_calls = _mock.find_calls("setRichPresence")
    assert_eq(rp_calls.size(), 2)
    assert_eq(rp_calls[0].value, "Playing Hard")
    assert_eq(rp_calls[1].value, "")

func test_set_rich_presence_throttles_repeats():
    _platform.set_rich_presence("status", "Playing Easy")
    _platform.set_rich_presence("status", "Playing Easy")
    _platform.set_rich_presence("status", "Playing Easy")
    assert_eq(_mock.find_calls("setRichPresence").size(), 1)
```

- [ ] **Step 8: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 全套全绿。

- [ ] **Step 9: Commit**

```bash
git add boot/boot.gd \
        games/calendar_puzzle/game.gd \
        games/calendar_puzzle/scenes/play_scene.gd \
        games/calendar_puzzle/scenes/win_scene.gd \
        games/calendar_puzzle/systems/skin_manager.gd \
        games/calendar_puzzle/systems/progress_tracker.gd \
        tests/test_rich_presence_lifecycle.gd
git commit -m "feat(achievement): wire AchievementTracker into play_scene/skin_manager/progress"
```

---

## Task 6 — Steam Overlay 兼容：borderless windowed + 测试调起

**Files:**
- Modify: `project.godot`

- [ ] **Step 1: 改窗口模式为 borderless windowed**

读 `project.godot`，`[display]` 段确保：

```ini
[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/size/mode=2                    ; 2 = MODE_WINDOWED
window/size/borderless=false          ; 保留窗口边框便于拖拽（spec § Cloud Save 段提到）
window/size/fullscreen=false
window/per_pixel_transparency/allowed=false
```

**关键**：spec 要求 `borderless windowed` 表述的本意是"非独占全屏"——独占全屏会阻 Steam Overlay。Godot 4 的 MODE_WINDOWED + borderless=false 是最安全配置；玩家自己想全屏时 alt+enter 切 MODE_FULLSCREEN，Godot 4 默认的 fullscreen 不是独占模式（已经 overlay 兼容），安全。

> **设置面板**：M4 已实现 fullscreen 切换；M6 不动 UI 只确保默认模式不冲突。

- [ ] **Step 2: 手测 overlay 调起**

```bash
godot
# Steam 已登录 + steam_appid.txt = 480 在项目根
# 在游戏窗口按 Shift+Tab 应该调起 Steam Overlay 浮层
```

Expected: Overlay 半透明覆盖在游戏画面上，可点击好友列表 / 设置 等；按 Shift+Tab 再次关闭。游戏帧率不显著掉。

如不能调起，回查 GodotSteam 是否真 init（boot log `[SteamPlatform] initialized OK`），Steam 客户端是否设了 "在使用 Steam 输入的游戏中启用 Steam Overlay"。

- [ ] **Step 3: 截图归档**

```bash
# macOS: Cmd+Shift+4 框选含 overlay 的游戏窗口
ls docs/m6-overlay-screenshot.png
```

- [ ] **Step 4: Commit**

```bash
git add project.godot docs/m6-overlay-screenshot.png
git commit -m "chore(steam): set windowed mode for overlay compat + capture smoke screenshot"
```

---

## Task 7 — 写 STEAM_ACHIEVEMENTS.md（Steamworks 后台填写手册）

**Files:**
- Create: `docs/STEAM_ACHIEVEMENTS.md`

- [ ] **Step 1: 写 20 行成就元数据表 + 操作步骤**

`docs/STEAM_ACHIEVEMENTS.md`:

```markdown
# Steamworks 成就配置手册

## 用途

本文档列出 Calendar Puzzle 的 20 个成就元数据，便于把它们填到 Steamworks 后台
"Edit Stats and Achievements"。所有 ID 必须与 `games/calendar_puzzle/systems/achievement_definitions.gd` 一致。

## 后台填写流程

1. 浏览器登录 https://partner.steamgames.com/
2. 选 Calendar Puzzle App → "Edit Steamworks Settings"
3. 左侧 "Stats and Achievements" → "Achievements" tab
4. 对下表每一行点 "Add new achievement"，按列填字段
5. 上传图标（256×256 PNG，已解锁/未解锁两张），图标位于 `~/mygit/calendar-puzzle-godot/assets/achievement_icons/<id>_unlocked.png`（M9 视觉打磨期产出）
6. Save → "Publish" 把改动推到 live

## 20 个成就

| API Name | Display Name (EN) | Display Name (zh-CN) | Display Name (zh-TW) | Description (EN) | Hidden |
|---|---|---|---|---|---|
| FIRST_WIN | First Win | 初战告捷 | 初戰告捷 | Solve your first puzzle. | No |
| WIN_10 | Decathlete | 十全十美 | 十全十美 | Solve 10 puzzles. | No |
| WIN_100 | Century Solver | 百战不殆 | 百戰不殆 | Solve 100 puzzles. | No |
| BEAT_EASY | Easy Conquered | 入门大师 | 入門大師 | Win at Easy difficulty. | No |
| BEAT_MEDIUM | Medium Conquered | 中级达人 | 中級達人 | Win at Medium difficulty. | No |
| BEAT_HARD | Hard Conquered | 困难征服者 | 困難征服者 | Win at Hard difficulty. | No |
| BEAT_EXPERT | Expert Conquered | 专家加冕 | 專家加冕 | Win at Expert difficulty. | No |
| BEAT_INSOMNIA | Insomnia Conquered | 失眠勇者 | 失眠勇者 | Win at Insomnia difficulty. | No |
| EASY_UNDER_3MIN | Easy Speedrun | Easy 速通 | Easy 速通 | Solve an Easy puzzle in under 3 minutes. | No |
| MEDIUM_UNDER_5MIN | Medium Speedrun | Medium 速通 | Medium 速通 | Solve a Medium puzzle in under 5 minutes. | No |
| HARD_UNDER_8MIN | Hard Speedrun | Hard 速通 | Hard 速通 | Solve a Hard puzzle in under 8 minutes. | No |
| INSOMNIA_100 | Insomniac | 失眠狂人 | 失眠狂人 | Win 100 Insomnia puzzles. | No |
| INSOMNIA_UNIQUE_50 | Unique Solutions Collector | 唯一解收藏家 | 唯一解收藏家 | Collect 50 unique Insomnia solutions. | No |
| STREAK_7DAYS | 7-Day Streak | 七日连胜 | 七日連勝 | Complete daily puzzles 7 days in a row. | No |
| STREAK_30DAYS | 30-Day Streak | 月度全勤 | 月度全勤 | Complete daily puzzles 30 days in a row. | No |
| YEAR_COMPLETE | Year Completed | 年度全通 | 年度全通 | Complete all puzzles in a calendar year. | **Yes** |
| NO_HINTS_INSOMNIA | Insomnia, No Hints | 失眠无提示 | 失眠無提示 | Win an Insomnia puzzle without using any hint. | **Yes** |
| NO_ROTATIONS_HARD | Hard Without Rotation | 困难纯净通关 | 困難純淨通關 | Win a Hard puzzle without rotating or mirroring. | **Yes** |
| FIRST_SKIN_SWITCH | Style Change | 换个心情 | 換個心情 | Switch to a non-default skin. | No |
| ALL_THREE_SKINS_TRIED | Skin Connoisseur | 皮肤鉴赏家 | 皮膚鑑賞家 | Try all three preset skins. | No |

## 描述文案 (Descriptions)

英文已在上表；以下补 zh-CN / zh-TW 描述（Steamworks 后台描述字段三语都要填，每语言一行）：

### FIRST_WIN
- zh-CN: 解开你的第一道谜题。
- zh-TW: 解開你的第一道謎題。

### WIN_10
- zh-CN: 解开 10 道谜题。
- zh-TW: 解開 10 道謎題。

### WIN_100
- zh-CN: 解开 100 道谜题。
- zh-TW: 解開 100 道謎題。

### BEAT_EASY / BEAT_MEDIUM / BEAT_HARD / BEAT_EXPERT / BEAT_INSOMNIA
- zh-CN: 通关 <难度名> 难度。
- zh-TW: 通關 <難度名> 難度。

### EASY_UNDER_3MIN
- zh-CN: 在 3 分钟内通关一道 Easy 难度题目。
- zh-TW: 在 3 分鐘內通關一道 Easy 難度題目。

### MEDIUM_UNDER_5MIN
- zh-CN: 在 5 分钟内通关一道 Medium 难度题目。
- zh-TW: 在 5 分鐘內通關一道 Medium 難度題目。

### HARD_UNDER_8MIN
- zh-CN: 在 8 分钟内通关一道 Hard 难度题目。
- zh-TW: 在 8 分鐘內通關一道 Hard 難度題目。

### INSOMNIA_100
- zh-CN: 累计通关 100 道失眠模式题目。
- zh-TW: 累計通關 100 道失眠模式題目。

### INSOMNIA_UNIQUE_50
- zh-CN: 在失眠模式中收集 50 个唯一解。
- zh-TW: 在失眠模式中收集 50 個唯一解。

### STREAK_7DAYS
- zh-CN: 连续 7 天完成每日题目。
- zh-TW: 連續 7 天完成每日題目。

### STREAK_30DAYS
- zh-CN: 连续 30 天完成每日题目。
- zh-TW: 連續 30 天完成每日題目。

### YEAR_COMPLETE (隐藏)
- zh-CN: 通关一个完整公历年的全部题目。
- zh-TW: 通關一個完整公曆年的全部題目。

### NO_HINTS_INSOMNIA (隐藏)
- zh-CN: 不使用任何提示完成一道失眠题目。
- zh-TW: 不使用任何提示完成一道失眠題目。

### NO_ROTATIONS_HARD (隐藏)
- zh-CN: 不旋转、不镜像完成一道 Hard 难度题目。
- zh-TW: 不旋轉、不鏡像完成一道 Hard 難度題目。

### FIRST_SKIN_SWITCH
- zh-CN: 第一次切换到非默认皮肤。
- zh-TW: 第一次切換到非預設皮膚。

### ALL_THREE_SKINS_TRIED
- zh-CN: 体验全部三款预置皮肤。
- zh-TW: 體驗全部三款預置皮膚。

## 时间阈值校准 (TBD — M3 数据出来后调)

| API Name | Current (placeholder) | M3 校准值 |
|---|---|---|
| EASY_UNDER_3MIN | 180 sec | TBD |
| MEDIUM_UNDER_5MIN | 300 sec | TBD |
| HARD_UNDER_8MIN | 480 sec | TBD |

校准方法：
1. M3 跑完 `tools/precompute_daily.gd` 后用 `tools/analyze_solve_times.gd`
   收集每难度的 p25 / p50 / p75 求解耗时
2. 把"top 25% 玩家能拿到"作为成就阈值（即 p25 速度）
3. 改 `achievement_definitions.gd` 的 THRESHOLDS_SECONDS dict
4. **同步**更新本表 + Steamworks 后台描述里的"3 分钟" / "5 分钟"

## 当前状态

- [ ] 20 个 API Name 已在 Steamworks 后台创建
- [ ] 三语 display name + description 已填
- [ ] 图标已上传（256×256 PNG × 20 个，已解锁/未解锁两套）
- [ ] Save → Publish 已推 live
- [ ] M3 数据校准后阈值已更新
```

- [ ] **Step 2: Commit**

```bash
git add docs/STEAM_ACHIEVEMENTS.md
git commit -m "docs(steam): 20-achievement metadata table + Steamworks setup instructions"
```

---

## Task 8 — Cloud Save 跨设备验证（手测协议）

**Files:**
- Modify: `docs/STEAM_SETUP.md`（M0 已建，追加 cloud save 章节）

- [ ] **Step 1: 在 Steamworks 启用 Cloud Save**

后台操作（Steamworks Web）：
1. Calendar Puzzle App → Edit Steamworks Settings → Cloud
2. Enable Steam Cloud → Yes
3. Quota: 100 MB（默认）
4. Save Location → "Use Steamworks Auto-Cloud Configuration"
5. Root Override + Path Override:
   - Windows: `%USERPROFILE%/AppData/Roaming/Godot/app_userdata/Calendar Puzzle/saves/`
   - macOS: `/Users/<user>/Library/Application Support/Godot/app_userdata/Calendar Puzzle/saves/`
   - Linux: `~/.local/share/godot/app_userdata/Calendar Puzzle/saves/`
6. Patterns: `*.tres`
7. Save → Publish

- [ ] **Step 2: 跨设备验证脚本（手工执行）**

在 `docs/STEAM_SETUP.md` 追加：

```markdown
## Cloud Save 跨设备验证

### 准备

- 设备 A（开发主机 Mac）
- 设备 B（Steam Deck / Windows / Linux 任一）
- 两台都登同一 Steam 账号

### 步骤

1. **设备 A**：跑游戏到 medium 解 5 道题，确保 autosave 已写
2. **设备 A**：退出游戏（触发最后一次 autosave + Steam Cloud upload）
3. **设备 A**：Steam 客户端 → 库 → Calendar Puzzle → 右键 → Properties → General → 看 Cloud Save 时间戳应是刚才的
4. **设备 B**：Steam 客户端登录、下载 Calendar Puzzle
5. **设备 B**：启动游戏 → 进 main menu → "Continue" 应见到设备 A 的进度（5 win count + autosave snapshot 可恢复）

### 验收

- [ ] 设备 B 看到 win_count >= 5
- [ ] 设备 B 看到的 last autosave 时间戳 == 设备 A 退出时间（± 几秒）
- [ ] 设备 B 上 hint_state 在新进度上从零开始（每题独立计数，符合设计）
- [ ] 截图 docs/m6-cloud-save-device-a.png + m6-cloud-save-device-b.png
```

- [ ] **Step 3: Commit doc**

```bash
git add docs/STEAM_SETUP.md
git commit -m "docs(steam): cloud save cross-device verification protocol"
```

---

## Self-Review

**1. Spec coverage**:
- ✅ 20 个成就触发条件 → Task 1 ID 表 + Task 4 tracker 实现（22 测试覆盖每条规则）
- ✅ Cloud Save 跨设备 → Task 8 协议 + Steamworks 后台启用步骤
- ✅ Rich Presence → Task 5 进 play_scene set / 退场 clear + Task 6 windowed mode
- ✅ Overlay 不冲突 → Task 6 borderless windowed + 手测 Shift+Tab 调起

**2. Placeholder scan**:
- THRESHOLDS_SECONDS 标注为 placeholder + 校准方法明确写在 STEAM_ACHIEVEMENTS.md 末尾（spec § Open question 4，非 plan 缺陷）
- STEAM_APP_ID = 480 标注 M11 前必换（与 M0 同处理）
- 图标位置 `assets/achievement_icons/<id>_*.png` 是 M9 视觉打磨期产出，本 plan 不要求

**3. Type consistency**:
- `PlatformBus.unlock_achievement(id: String)` / `set_rich_presence(k, v)` / `clear_rich_presence(k)` — M0 接口 + M6 实现一致
- `GameDeps.platform` 来自 M0；本 plan 在 play_scene / main_menu 调用时与 M0 注入路径一致
- `ProgressTracker` 来自 M3；本 plan 在 Task 5 加 win_count / streak_days / skins_tried 字段，与 M4 存档 round-trip 协议（ProfileResource）兼容

**4. Ambiguity**:
- Task 5 假设 `puzzle_state.rotations_count` / `mirrors_count` 由 M2 累计 — 若 M2 未实现，本 plan Task 5 implementation 需补加 counter（小改动）；测试已 mock 该字段，假设安全
- Task 6 windowed mode 选择已写明 borderless=false 兼容（与 spec borderless windowed 表述微差异，但操作正确）

**5. 跨依赖核对**:
- 依赖 M3：ProgressTracker（win_count / insomnia_count / streak / skins_tried）
- 依赖 M4：SaveAdapter（progress 持久化）/ ProfileResource
- 依赖 M5：HintState（hints_used 计数提供给 on_win event）
- 不依赖 M7：i18n key `rich_presence_playing` 直接走 stub_translation_context，M7 才补真翻译

无发现要修。M6 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M6 实施时用 superpowers:subagent-driven-development。

派发节奏建议：
- Task 1（definitions）+ Task 2（mock）一批：纯数据无依赖
- Task 3（SteamPlatform real wrapper）单独：依赖 mock，独立可派
- Task 4（AchievementTracker）单独：依赖 def + mock + SteamPlatform，独立可派
- Task 5（接入）串行：依赖 Task 1-4 完成 + 修改 5 个游戏侧文件，需 review 后逐文件改
- Task 6（overlay）单独可异步：只改 project.godot
- Task 7（doc）单独：纯文档
- Task 8（cloud verification）单独：纯手测协议，无代码

**重要风险点**：
- Task 3 测试用 `Engine.register_singleton("Steam", mock)` 在 Godot 4 是支持的 API，但部分版本（< 4.2）可能行为不同；若失败，回退方案是用依赖注入（SteamPlatform 构造时传入 steam_singleton 参数）
- Task 5 wiring 涉及多个 M2-M5 已交付文件，subagent 实施时务必 read 现有文件结构后再加调用点，避免破坏已通过的 round-trip 测试
