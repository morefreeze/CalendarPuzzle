# M7 — i18n 三语 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把游戏全部用户可见字符串走 `tr("KEY")`；扫所有 .gd 文件抽取 POT；产出 `zh_CN.po`（主，AI 写）、`zh_TW.po`（OpenCC 简转繁 + 术语微调）、`en.po`（AI 写 + 自审）三份完整翻译；Godot 自动按 OS locale + Steam 语言切换；设置面板手动覆盖。

**Architecture:** 在 M0 写的 `TranslationContext` 抽象之上加 `boot/platform/translation_context_godot.gd` 真实实现，包装 Godot 内置 `tr()` / `tr_n()`。POT extraction 由 Godot CLI 跑（`godot --headless --quit-after 1 --extract-pot`）。三份 `.po` 文件位于 `translations/`，import 后生成 `.translation` 二进制（gitignored）。boot 在启动时按优先级解析 locale：Steam 语言 → OS locale → 默认 en，写入 `SettingsResource.locale`；设置面板手选时覆盖该值并热切换。`tools/i18n_check.gd` 是开发者脚本，列各 .po 文件之间漏 key。

**Tech Stack:** Godot 4.3+ 内置 i18n（`tr()` + .po + .translation）、GUT v9、`opencc-python-reimplemented`（zh-CN → zh-TW 简转繁，pip 装；本 milestone 仅在 PO 生成阶段用，运行时不依赖）、M0 TranslationContext 抽象、M6 SteamPlatform.getCurrentGameLanguage。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Visual / Audio / i18n → i18n、§ Locked decision 11、§ Milestones M7、§ Risk register R6。

**Acceptance gates (从 spec 抄):**
- 所有用户可见字符串走 `tr("KEY")`；无硬编码中文 / 英文残留（除 push_warning / 日志 / 注释）
- `translations/messages.pot` 自动抽出，约 250-350 条
- 三份 .po 完整无缺：每个 key 在 zh_CN / zh_TW / en 都有 msgstr（不留空）
- Godot 项目设置加载 3 个 .translation 资源（zh_CN / zh_TW / en）
- 启动按优先级解析 locale：Steam 语言 → OS locale → "en"；可在设置面板手选覆盖
- Steam 语言映射正确：`schinese` → `zh_CN`，`tchinese` → `zh_TW`，`english` → `en`
- GUT：`test_translation_context.gd`（3 locale × tr/tr_n 各跑通）+ `test_i18n_extraction.gd`（启发式扫描 .gd 文件，UI 现场 0 硬编码）≥ 10 个用例全绿
- `tools/i18n_check.gd` 跑出 0 漏 key（或者列出有意忽略的 key 白名单）

---

## File Structure

本 milestone 涉及的所有文件（位于 `~/mygit/calendar-puzzle-godot/`）：

```
boot/
├── boot.gd                                 # MODIFY 启动后跑 locale 检测 + 注入 TranslationContext 真实实现
└── platform/
    └── translation_context_godot.gd        # CREATE 包装 Godot tr/tr_n（替换 M0 stub）
games/calendar_puzzle/
├── scenes/                                 # MODIFY 所有 .gd 把硬编码字符串改 tr("KEY")
├── systems/                                # 同上
└── ... (所有 user-facing 文件)
shared/
├── ui/                                     # MODIFY 所有 .gd 把 toast / button label / tooltip 走 tr
└── resources/
    └── settings_resource.gd                # MODIFY 加 locale: String 字段（如 M4 未加）
boot/main_menu/
└── settings/
    └── language_panel.gd                   # CREATE 设置面板语言选择子页面
translations/
├── messages.pot                            # CREATE Godot extract 输出
├── zh_CN.po                                # CREATE 主翻译，AI 写
├── zh_TW.po                                # CREATE OpenCC 转 + 术语微调
├── en.po                                   # CREATE 自译 + 自审
└── README.md                               # CREATE 翻译流程说明
tools/
├── i18n_check.gd                           # CREATE 跨 .po 漏 key 检测
└── opencc_convert.py                       # CREATE zh_CN.po → zh_TW.po 工具脚本
i18n/
└── keys.md                                 # CREATE 所有 key 索引 + zh-CN 原文（人工维护）
docs/
└── I18N_WORKFLOW.md                        # CREATE 完整 i18n 流程文档
tests/
├── test_translation_context.gd             # CREATE 三 locale × tr/tr_n 单测
├── test_i18n_extraction.gd                 # CREATE 启发式扫硬编码
└── test_locale_detection.gd                # CREATE Steam / OS / fallback 优先级
```

---

## Task 1 — 实现 TranslationContext 真实包装（替换 M0 stub）

**Files:**
- Create: `boot/platform/translation_context_godot.gd`
- Modify: `boot/boot.gd`（_build_deps 切真实实现）
- Test: `tests/test_translation_context.gd`

- [ ] **Step 1: 写 failing test**

`tests/test_translation_context.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const TranslationContextGodot = preload("res://boot/platform/translation_context_godot.gd")

func before_each():
    # 清掉旧 translation server 状态，重设 locale
    TranslationServer.set_locale("en")

func test_tr_returns_translated_string_when_loaded():
    # 用 ad-hoc Translation 资源测：手动创建一个 Translation 加进去
    var trans = Translation.new()
    trans.locale = "zh_CN"
    trans.add_message("hud_hint", "提示")
    TranslationServer.add_translation(trans)

    var ctx = TranslationContextGodot.new()
    ctx.set_locale("zh_CN")
    assert_eq(ctx.tr("hud_hint"), "提示")

func test_tr_falls_back_to_key_when_missing():
    var ctx = TranslationContextGodot.new()
    ctx.set_locale("en")
    assert_eq(ctx.tr("nonexistent_key_xyz"), "nonexistent_key_xyz")

func test_tr_n_singular_vs_plural():
    var trans = Translation.new()
    trans.locale = "en"
    trans.add_message("hint_remaining_one", "%d hint left")
    trans.add_plural_message("hint_remaining_one", PackedStringArray(["%d hint left", "%d hints left"]))
    TranslationServer.add_translation(trans)

    var ctx = TranslationContextGodot.new()
    ctx.set_locale("en")
    assert_eq(ctx.tr_n("hint_remaining_one", "hint_remaining_other", 1), "%d hint left")
    assert_eq(ctx.tr_n("hint_remaining_one", "hint_remaining_other", 2), "%d hints left")

func test_set_locale_then_get_locale_round_trip():
    var ctx = TranslationContextGodot.new()
    ctx.set_locale("zh_TW")
    assert_eq(ctx.get_locale(), "zh_TW")

func test_set_locale_updates_translation_server():
    var ctx = TranslationContextGodot.new()
    ctx.set_locale("zh_CN")
    assert_eq(TranslationServer.get_locale(), "zh_CN")
```

- [ ] **Step 2: 跑 test 期待 FAIL**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 5 个新 test FAIL，找不到 translation_context_godot.gd。

- [ ] **Step 3: 实现 TranslationContextGodot**

`boot/platform/translation_context_godot.gd`:

```gdscript
# boot/platform/translation_context_godot.gd
# Godot 内置 tr() / tr_n() 的薄包装；替换 M0 的 stub_translation_context.gd。
extends TranslationContext

func tr(key: String, _context: String = "") -> String:
    return TranslationServer.translate(key)

func tr_n(key: String, plural_key: String, count: int, _context: String = "") -> String:
    return TranslationServer.translate_plural(key, plural_key, count)

func get_locale() -> String:
    return TranslationServer.get_locale()

func set_locale(locale: String) -> void:
    TranslationServer.set_locale(locale)
```

- [ ] **Step 4: 切 boot.gd 用真实实现**

读 `boot/boot.gd`，把：

```gdscript
const StubTranslationContext = preload("res://boot/platform/stub_translation_context.gd")
# ...
deps.i18n = StubTranslationContext.new()
```

改为：

```gdscript
const TranslationContextGodot = preload("res://boot/platform/translation_context_godot.gd")
# ...
deps.i18n = TranslationContextGodot.new()
```

> **保留 stub**：测试用 `tests/helpers/stub_deps_factory.gd` 可继续用 stub_translation_context（不依赖 TranslationServer 状态），但 boot 启动用真实包装。

- [ ] **Step 5: 跑测试 PASS**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 5 个 translation_context 用例 PASS + M0-M6 累计全绿。

- [ ] **Step 6: Commit**

```bash
git add boot/platform/translation_context_godot.gd \
        boot/boot.gd \
        tests/test_translation_context.gd
git commit -m "feat(i18n): TranslationContextGodot wrapper for built-in tr/tr_n"
```

---

## Task 2 — Locale 检测优先级（Steam → OS → en）

**Files:**
- Modify: `boot/boot.gd`
- Modify: `boot/platform/steam_platform.gd`
- Modify: `shared/resources/settings_resource.gd`
- Modify: `shared/platform/platform_bus.gd`
- Test: `tests/test_locale_detection.gd`

- [ ] **Step 1: PlatformBus 加 get_steam_language 抽象**

`shared/platform/platform_bus.gd` 追加：

```gdscript
# 返回 Steam 客户端当前游戏语言（如 "english" / "schinese" / "tchinese"）；非 Steam 环境返 ""
func get_steam_language() -> String:
    push_error("PlatformBus.get_steam_language not implemented")
    return ""
```

- [ ] **Step 2: SteamPlatform 实现**

`boot/platform/steam_platform.gd` 加：

```gdscript
func get_steam_language() -> String:
    if not _initialized:
        return ""
    var Steam = Engine.get_singleton("Steam")
    return Steam.getCurrentGameLanguage()
```

- [ ] **Step 3: SettingsResource 加 locale 字段（如未加）**

`shared/resources/settings_resource.gd`（M4 已建）追加：

```gdscript
@export var locale: String = ""  # 空 = 跟随 platform 自动检测；非空 = 玩家手动覆盖
```

- [ ] **Step 4: 写 failing test**

`tests/test_locale_detection.gd`:

```gdscript
extends "res://addons/gut/test.gd"

const Boot = preload("res://boot/boot.gd")

# resolve_locale(steam_lang, os_locale, settings_override) -> "zh_CN" / "zh_TW" / "en"

func test_settings_override_wins():
    assert_eq(Boot.resolve_locale("english", "en_US", "zh_CN"), "zh_CN")
    assert_eq(Boot.resolve_locale("schinese", "zh_CN", "en"), "en")

func test_steam_schinese_maps_to_zh_CN():
    assert_eq(Boot.resolve_locale("schinese", "en_US", ""), "zh_CN")

func test_steam_tchinese_maps_to_zh_TW():
    assert_eq(Boot.resolve_locale("tchinese", "en_US", ""), "zh_TW")

func test_steam_english_maps_to_en():
    assert_eq(Boot.resolve_locale("english", "zh_CN", ""), "en")

func test_falls_back_to_os_when_no_steam():
    assert_eq(Boot.resolve_locale("", "zh_CN", ""), "zh_CN")
    assert_eq(Boot.resolve_locale("", "zh_TW", ""), "zh_TW")
    assert_eq(Boot.resolve_locale("", "en_US", ""), "en")
    assert_eq(Boot.resolve_locale("", "en_GB", ""), "en")

func test_falls_back_to_en_when_unknown_os_locale():
    assert_eq(Boot.resolve_locale("", "fr_FR", ""), "en")
    assert_eq(Boot.resolve_locale("", "ja_JP", ""), "en")

func test_unknown_steam_lang_falls_through_to_os():
    assert_eq(Boot.resolve_locale("french", "zh_CN", ""), "zh_CN")
```

- [ ] **Step 5: 实现 resolve_locale 静态函数**

在 `boot/boot.gd` 加：

```gdscript
# 解析最终 locale，三层优先级：
#   1. 玩家在设置面板手选（settings_override）
#   2. Steam 客户端语言（steam_lang）
#   3. OS locale（os_locale）
#   4. 兜底 "en"
static func resolve_locale(steam_lang: String, os_locale: String, settings_override: String) -> String:
    if settings_override != "":
        return settings_override
    var from_steam := _steam_lang_to_locale(steam_lang)
    if from_steam != "":
        return from_steam
    var from_os := _os_locale_to_supported(os_locale)
    if from_os != "":
        return from_os
    return "en"

static func _steam_lang_to_locale(steam_lang: String) -> String:
    match steam_lang:
        "schinese":  return "zh_CN"
        "tchinese":  return "zh_TW"
        "english":   return "en"
    return ""

static func _os_locale_to_supported(os_locale: String) -> String:
    if os_locale.begins_with("zh_CN") or os_locale.begins_with("zh-CN"):
        return "zh_CN"
    if os_locale.begins_with("zh_TW") or os_locale.begins_with("zh-TW") \
       or os_locale.begins_with("zh_HK") or os_locale.begins_with("zh-HK"):
        return "zh_TW"
    if os_locale.begins_with("en"):
        return "en"
    return ""
```

并在 `_ready` 内调用：

```gdscript
func _ready() -> void:
    _deps = _build_deps()
    # ... module.start(_deps) 之前 ...
    _apply_locale()

func _apply_locale() -> void:
    var profile = _deps.save.read("profile")
    var settings_override := ""
    if profile != null and "settings" in profile and profile.settings != null:
        settings_override = profile.settings.locale
    var steam_lang := _deps.platform.get_steam_language()
    var os_locale := OS.get_locale()
    var resolved := resolve_locale(steam_lang, os_locale, settings_override)
    _deps.i18n.set_locale(resolved)
    print("[boot] locale resolved: steam=%s os=%s override=%s → %s" % [steam_lang, os_locale, settings_override, resolved])
```

- [ ] **Step 6: stub_save_adapter 测试桩补 get_steam_language**

`boot/platform/stub_save_adapter.gd` 无需改。但 `tests/helpers/stub_deps_factory.gd` 里 `SteamPlatform` 测试模式下 `get_steam_language()` 返 ""，不破测试。

- [ ] **Step 7: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -30
```

Expected: 7 个 locale_detection 用例 PASS。

- [ ] **Step 8: Commit**

```bash
git add boot/boot.gd \
        boot/platform/steam_platform.gd \
        shared/platform/platform_bus.gd \
        shared/resources/settings_resource.gd \
        tests/test_locale_detection.gd
git commit -m "feat(i18n): 4-tier locale resolution (settings → steam → os → en)"
```

---

## Task 3 — 审计全部 .gd 文件硬编码字符串 → 改 tr("KEY")

**Files:**
- Modify: 所有 user-facing .gd 文件（M0-M6 已交付的）
- Create: `i18n/keys.md`

> **本任务是 M7 最劳动密集的环节**。预计 ~300 条 key。subagent 实施时按文件分批做，每批 5-10 个文件一次 commit。

- [ ] **Step 1: 写 keys.md 框架**

`i18n/keys.md`:

```markdown
# i18n Key Index

本文件列所有 `tr("KEY")` 用到的 key + 其 zh-CN 原文 + 出处文件 + 备注。
是 `.po` 文件的人工索引，便于追踪、避免冲突、保持术语一致。

## 命名约定

- 全小写 + snake_case
- 前缀按区域：`hud_*` / `menu_*` / `settings_*` / `tutorial_*` / `achievement_*` / `dialog_*` / `toast_*` / `difficulty_*`
- 复数 key 后缀 `_one` / `_other`（Godot tr_n 约定）

## Key 列表

### HUD（play_scene）
| Key | zh-CN | 出处 |
|---|---|---|
| hud_hint | 提示 | play_scene.gd / hint button |
| hud_hint_tooltip | 弱提示：高亮一个可放置的空格 | play_scene.gd |
| hud_hint_no_solution | 当前状态无解 | play_scene.gd |
| hud_timer_label | 用时 | play_scene.gd |
| hud_pause | 暂停 | play_scene.gd |
| hud_back_to_menu | 回主菜单 | play_scene.gd |

### Difficulty
| Key | zh-CN |
|---|---|
| difficulty_easy | 入门 |
| difficulty_medium | 普通 |
| difficulty_hard | 困难 |
| difficulty_expert | 专家 |
| difficulty_insomnia | 失眠 |

### Menu
| Key | zh-CN |
|---|---|
| menu_start | 开始游戏 |
| menu_continue | 继续 |
| menu_daily | 每日题 |
| menu_calendar | 日历选题 |
| menu_settings | 设置 |
| menu_achievements | 成就 |
| menu_quit | 退出 |

### Settings
| Key | zh-CN |
|---|---|
| settings_volume_bgm | 背景音乐 |
| settings_volume_sfx | 音效 |
| settings_volume_master | 总音量 |
| settings_fullscreen | 全屏 |
| settings_language | 语言 |
| settings_skin | 皮肤 |
| settings_keybind | 按键映射 |
| settings_reset | 重置 |
| language_zh_CN | 简体中文 |
| language_zh_TW | 繁體中文 |
| language_en | English |
| language_auto | 跟随系统 |

### Tutorial
| Key | zh-CN |
|---|---|
| tutorial_step0_goal_title | 教程 1/5：目标 |
| tutorial_step0_goal_body | 把方块放上去，让今天的"月 / 日 / 星期"三个格保留为空白。 |
| tutorial_step1_locked_title | 教程 2/5：锁定区域 |
| tutorial_step1_locked_body | 灰色的 # 是棋盘边界，不能放方块。 |
| tutorial_step2_place_title | 教程 3/5：放置 |
| tutorial_step2_place_body | 从底部方块栏拖一个方块到棋盘上。R 旋转，F 镜像。 |
| tutorial_step3_remove_title | 教程 4/5：移除 |
| tutorial_step3_remove_body | 双击棋盘上的方块可移除。 |
| tutorial_step4_completion_title | 教程 5/5：胜利条件 |
| tutorial_step4_completion_body | 所有方块都用上，并且只露出今天日期的 3 格，就胜利了。 |
| tutorial_next | 下一步 |
| tutorial_skip | 跳过教程 |

### Achievement (display only — Steamworks 后台是权威；这里仅游戏内成就页同步显示)
| Key | zh-CN |
|---|---|
| achievement_FIRST_WIN_name | 初战告捷 |
| achievement_FIRST_WIN_desc | 解开你的第一道谜题。 |
| ... (20 个，参考 docs/STEAM_ACHIEVEMENTS.md)

### Toast / Dialog
| Key | zh-CN |
|---|---|
| toast_saved | 已保存 |
| toast_save_failed | 保存失败 |
| toast_hint_locked | 该方块已被提示锁定，无法旋转 |
| dialog_quit_title | 退出 |
| dialog_quit_body | 当前进度已自动保存。确认退出吗？ |
| dialog_yes | 是 |
| dialog_no | 否 |
| dialog_reset_settings_body | 这会把所有设置（音量 / 全屏 / 皮肤 / 按键 / 语言）还原为默认。无法撤销。 |

### Rich Presence
| Key | zh-CN |
|---|---|
| rich_presence_playing | 正在玩 {difficulty} |
| rich_presence_main_menu | 在主菜单 |

### Win Scene
| Key | zh-CN |
|---|---|
| win_title | 胜利！ |
| win_time | 用时：{time} |
| win_play_again | 再来一题 |
| win_back_to_menu | 回主菜单 |
| win_new_pb | 新纪录！ |

### Errors
| Key | zh-CN |
|---|---|
| error_save_quota_exceeded | 存档空间不足 |
| error_no_internet | 当前离线（功能仍可用） |

总数: ~120-200 条（按 M0-M6 实际暴露的字符串）
```

- [ ] **Step 2: 批量替换硬编码字符串**

按文件类别分批，每批一次 commit：

**批次 A — HUD / play scene**

涉及文件：`games/calendar_puzzle/scenes/play_scene.gd` / `win_scene.gd` / `select_scene.gd`

示例 diff（play_scene.gd）：

```diff
- _hint_button.text = "💡"
- _hint_button.tooltip_text = "Weak hint: highlight an empty cell"
+ _hint_button.text = _deps.i18n.tr("hud_hint")
+ _hint_button.tooltip_text = _deps.i18n.tr("hud_hint_tooltip")

- _show_toast("当前状态无解")
+ _show_toast(_deps.i18n.tr("hud_hint_no_solution"))
```

> **重要原则**：tr() 调用点参数始终是 key 字符串字面量（`tr("hud_hint")`），不要拼接（`tr("hud_" + name)`）—— 因为 POT extractor 静态扫描时找不到动态拼出的 key。需要动态选 key 时用 match/dict 映射到具体字面量。

**批次 B — Main menu / settings**

涉及文件：`boot/main_menu/main_menu.gd` / `boot/main_menu/settings/*.gd`

**批次 C — Tutorial**

涉及文件：`boot/main_menu/tutorial.gd` / `boot/main_menu/steps/*.gd`

**批次 D — Shared UI**

涉及文件：`shared/ui/toast.gd` / `shared/ui/modal.gd` / etc.

**批次 E — Achievements / Rich presence string**

涉及文件：`games/calendar_puzzle/scenes/win_scene.gd`（成就触发后展示）/ `play_scene.gd`（rich presence text）

- [ ] **Step 3: 每批提交时 commit**

```bash
# 每批改完
git add <changed-files>
git commit -m "refactor(i18n): replace hardcoded strings with tr() in <批次名>"
```

- [ ] **Step 4: 全部完成后 commit keys.md**

```bash
git add i18n/keys.md
git commit -m "docs(i18n): central key index with zh-CN原文 + 出处"
```

---

## Task 4 — 抽取 POT + 配置 project.godot

**Files:**
- Create: `translations/messages.pot`
- Modify: `project.godot`

- [ ] **Step 1: 配置 project.godot 加入 i18n 段**

读 `project.godot`，在 `[internationalization]` 段（如不存在则新建）：

```ini
[internationalization]

locale/translations=PackedStringArray("res://translations/zh_CN.translation", "res://translations/zh_TW.translation", "res://translations/en.translation")
locale/fallback="en"
locale/translation_remaps={
}
```

> 此时 .translation 文件还没生成（要在 Task 5 之后从 .po import），Godot 启动会 warn 找不到——OK，先确保配置正确，后面补文件。

- [ ] **Step 2: 配置 POT extraction（项目级）**

`project.godot` 加：

```ini
[internationalization]
# ... 上面已加 ...
locale/pseudolocalization/replace_with_accents=false

[gui]

# 让 POT generator 扫这些目录
```

或在编辑器 UI：Project → Project Settings → Localization → POT Generation → Add：

- res://boot/
- res://games/calendar_puzzle/
- res://shared/

并 Output：`res://translations/messages.pot`

手写 `project.godot` 对应字段：

```ini
[internationalization]

locale/translations=PackedStringArray("res://translations/zh_CN.translation", "res://translations/zh_TW.translation", "res://translations/en.translation")
locale/fallback="en"
locale/pseudolocalization/replace_with_accents=false

[POT]

# Godot 4 实际把 POT generation 信息存在以下位置
files=PackedStringArray("res://boot/main_menu/main_menu.tscn", "res://boot/main_menu/tutorial.tscn", "res://games/calendar_puzzle/scenes/play_scene.tscn", "res://games/calendar_puzzle/scenes/win_scene.tscn", "res://games/calendar_puzzle/scenes/select_scene.tscn")
output_path="res://translations/messages.pot"
```

> **注意**：Godot 4 的 POT generator 主要扫 `.tscn` 里的 Label.text / Button.text，对 `.gd` 内 `tr("KEY")` 调用需要 GDScript-aware 扫描。Godot 4.3+ 已支持扫 `.gd` 文件内的 `tr()` 调用，确保 Godot 版本符合。

- [ ] **Step 3: 跑 extraction**

CLI 方式：

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --quit-after 1 --editor 2>&1 | head -20
# 这个不会自动 extract，需在 editor UI 内手工 click "Generate POT"
```

替代方案 — 编辑器 UI：

1. 打开 Godot Editor
2. Project → Tools → Localization → "Generate POT"
3. 或 Project → Project Settings → Localization → POT Generation tab → Click "Generate POT"

或用 Godot 4.3+ 的命令行参数（如可用）：

```bash
godot --headless --quit-after 1 -- --extract-pot translations/messages.pot
```

> 若 CLI 不可用，**手工 Editor 跑一次 + commit 结果**即可，频率低（每次新加大量字符串后跑一次）。

- [ ] **Step 4: 验证 messages.pot 内容**

```bash
wc -l translations/messages.pot
head -30 translations/messages.pot
```

Expected: 文件存在，包含 `msgid "hud_hint"` / `msgid "tutorial_step0_goal_body"` 等条目，行数 200+。

如果某些 key 漏抽（常见原因：动态拼接 / .tscn 外部资源），手工补到 .pot：

```
#: games/calendar_puzzle/scenes/play_scene.gd:NN
msgid "missing_key_xyz"
msgstr ""
```

- [ ] **Step 5: Commit**

```bash
git add project.godot translations/messages.pot
git commit -m "feat(i18n): configure POT extraction; generate messages.pot (~N keys)"
```

---

## Task 5 — 写 zh_CN.po（主翻译）

**Files:**
- Create: `translations/zh_CN.po`

- [ ] **Step 1: 复制 messages.pot → zh_CN.po**

```bash
cd ~/mygit/calendar-puzzle-godot
cp translations/messages.pot translations/zh_CN.po
```

- [ ] **Step 2: 编辑 zh_CN.po header**

文件头改为：

```
msgid ""
msgstr ""
"Project-Id-Version: Calendar Puzzle 0.1.0\n"
"PO-Revision-Date: 2026-05-26\n"
"Language-Team: zh-CN\n"
"Language: zh_CN\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"X-Generator: hand-translated\n"
"Plural-Forms: nplurals=1; plural=0;\n"
```

- [ ] **Step 3: 按 keys.md 表填 msgstr**

对每个 msgid 填中文 msgstr。示例：

```
#: games/calendar_puzzle/scenes/play_scene.gd:120
msgid "hud_hint"
msgstr "提示"

#: games/calendar_puzzle/scenes/play_scene.gd:121
msgid "hud_hint_tooltip"
msgstr "弱提示：高亮一个可放置的空格"

#: boot/main_menu/tutorial.gd:N
msgid "tutorial_step0_goal_body"
msgstr "把方块放上去，让今天的“月 / 日 / 星期”三个格保留为空白。"

#: boot/main_menu/main_menu.gd:N
msgid "menu_start"
msgstr "开始游戏"

# ... 200+ 条 ...
```

**复数处理示例**：

```
msgid "hint_remaining_one"
msgid_plural "hint_remaining_other"
msgstr[0] "剩 %d 次"
```

> **AI 助力**：本 task 由 AI（如 claude）批量生成 msgstr 后人工核 1 轮关键词。术语保持一致：方块 / 棋盘 / 提示 / 失眠 / 教程 / 皮肤 等。

- [ ] **Step 4: 在 Editor 里 import zh_CN.po → zh_CN.translation**

Editor 操作：

1. Project → Project Settings → Localization → Translations tab → Add → 选 `translations/zh_CN.po`
2. Godot 自动生成 `translations/zh_CN.translation`

或检查 `project.godot` 已写 `locale/translations` 列表（Task 4 已加），重启 editor / reimport：

```bash
godot --headless --quit-after 1 --editor 2>&1
```

`.translation` 文件被 `.gitignore` 排除（M0 .gitignore 已写 `*.translation`），不入库；玩家端 Godot 启动会自动从 .po 重新 import。

> **重要**：Godot 4 的 `.po` 文件**会被 import 为 .translation**，CI/build 时仓库只需提交 `.po`，build 时 godot 自动生成 `.translation` 并打进 .pck。

- [ ] **Step 5: 手测语言切换**

```bash
godot
# 主菜单应显示中文（如系统是 zh_CN）
# 设置 → 语言 → English / 繁体 → 切换后 UI 立刻变
```

- [ ] **Step 6: Commit**

```bash
git add translations/zh_CN.po
git commit -m "feat(i18n): zh_CN.po complete (primary locale, ~N keys)"
```

---

## Task 6 — 写 zh_TW.po（OpenCC 简转繁 + 术语微调）

**Files:**
- Create: `tools/opencc_convert.py`
- Create: `translations/zh_TW.po`

- [ ] **Step 1: 装 opencc**

```bash
pip install opencc-python-reimplemented
```

或用 uv（user CLAUDE.md 偏好）：

```bash
uv pip install opencc-python-reimplemented
```

- [ ] **Step 2: 写 opencc_convert.py**

`tools/opencc_convert.py`:

```python
#!/usr/bin/env python3
"""
zh_CN.po → zh_TW.po converter.

把 zh_CN.po 内所有 msgstr "..." 用 OpenCC s2twp 配置（简→台湾正体含常用词转换）转一遍。
header / msgid / 注释保持不变，只动 msgstr 行内容。

usage:
    python tools/opencc_convert.py translations/zh_CN.po translations/zh_TW.po
"""

import re
import sys
from opencc import OpenCC


def main():
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} <source-po> <dest-po>")
        sys.exit(1)

    src_path, dst_path = sys.argv[1], sys.argv[2]
    cc = OpenCC("s2twp")  # 简体→台湾正体 + 常用词汇转换

    with open(src_path, encoding="utf-8") as f:
        lines = f.readlines()

    out_lines = []
    in_header = True
    for line in lines:
        if line.startswith('msgstr "'):
            # 提 msgstr 内容
            m = re.match(r'^msgstr "(.*)"$', line.rstrip("\n"))
            if m:
                content = m.group(1)
                if in_header and ("Language:" in content or "Language-Team:" in content):
                    # header 部分 Language 字段单独处理
                    content = content.replace("zh_CN", "zh_TW").replace("zh-CN", "zh-TW")
                else:
                    content = cc.convert(content)
                line = f'msgstr "{content}"\n'
        elif line.startswith("msgstr["):
            # 复数形式
            m = re.match(r'^(msgstr\[\d+\]) "(.*)"$', line.rstrip("\n"))
            if m:
                prefix, content = m.group(1), m.group(2)
                content = cc.convert(content)
                line = f'{prefix} "{content}"\n'

        # 退出 header 块的启发
        if line.strip() == "":
            in_header = False

        out_lines.append(line)

    with open(dst_path, "w", encoding="utf-8") as f:
        f.writelines(out_lines)

    print(f"wrote {dst_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 跑转换**

```bash
python tools/opencc_convert.py translations/zh_CN.po translations/zh_TW.po
```

Expected: `wrote translations/zh_TW.po`

- [ ] **Step 4: 人工微调术语（~50 处）**

OpenCC 的 s2twp 已做大部分常用词转换（如"软件"→"軟體"、"网络"→"網路"），但游戏术语需人工再过一遍。以下是 Calendar Puzzle 特定的术语校正表：

| 简体 (zh_CN) | OpenCC 直转 | 校正 (zh_TW) | 备注 |
|---|---|---|---|
| 方块 | 方塊 | 方塊 | OK |
| 棋盘 | 棋盤 | 棋盤 | OK |
| 提示 | 提示 | 提示 | OK |
| 关卡 | 關卡 | 關卡 | OK |
| 失眠 | 失眠 | 失眠 | 保留 |
| 皮肤 | 皮膚 | 皮膚 | OK |
| 设置 | 設定 | 設定 | OpenCC 已转 |
| 菜单 | 菜單 | 選單 | 台湾常用"選單" |
| 视频 | 視頻 | 影片 | 台湾常用"影片" |
| 鼠标 | 滑鼠 | 滑鼠 | OK |
| 网络 | 網路 | 網路 | OK |
| 移除 | 移除 | 移除 | OK |
| 旋转 | 旋轉 | 旋轉 | OK |
| 镜像 | 鏡像 | 鏡像 | OK |
| 默认 | 預設 | 預設 | OK |
| 跟随系统 | 跟隨系統 | 跟隨系統 | OK |
| 简体中文 | 簡體中文 | 簡體中文 | OK |
| 繁体中文 | 繁體中文 | 繁體中文 | OK |
| 教程 | 教程 | 教學 | 台湾常用"教學" |
| 跳过 | 跳過 | 略過 | 台湾常用"略過" |
| 等等 | ... | ... | ... |

人工检查 `translations/zh_TW.po` 把上述 zh-CN → zh-TW 替换跑一遍：

```bash
# 用 sed 批量替换（举例）
sed -i '' 's/教程/教學/g' translations/zh_TW.po
sed -i '' 's/菜單/選單/g' translations/zh_TW.po
sed -i '' 's/跳過教程/略過教學/g' translations/zh_TW.po
# ... 其余术语 ...
```

或在编辑器手工 search-replace 50 处。

- [ ] **Step 5: Import 到 Godot**

Editor: Project → Project Settings → Localization → Add `translations/zh_TW.po`。

`project.godot` 的 `locale/translations` Task 4 已包含 zh_TW.translation。

- [ ] **Step 6: 手测**

```bash
godot
# 设置 → 语言 → 繁体中文 → UI 切换
# 确认菜单 / 教学 / 略过 等术语显示繁体
```

- [ ] **Step 7: Commit**

```bash
git add tools/opencc_convert.py translations/zh_TW.po
git commit -m "feat(i18n): zh_TW.po via OpenCC s2twp + 50 manual term overrides"
```

---

## Task 7 — 写 en.po（AI 翻 + 自审）

**Files:**
- Create: `translations/en.po`

- [ ] **Step 1: 复制 messages.pot → en.po**

```bash
cp translations/messages.pot translations/en.po
```

- [ ] **Step 2: 编辑 header**

```
msgid ""
msgstr ""
"Project-Id-Version: Calendar Puzzle 0.1.0\n"
"PO-Revision-Date: 2026-05-26\n"
"Language-Team: en\n"
"Language: en\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"X-Generator: hand-translated\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"
```

- [ ] **Step 3: 按 keys.md 中文原文 → AI 翻译英文**

示例：

```
msgid "hud_hint"
msgstr "Hint"

msgid "hud_hint_tooltip"
msgstr "Weak hint: highlight one empty cell"

msgid "tutorial_step0_goal_body"
msgstr "Place blocks so that today's month, day, and weekday cells remain uncovered."

msgid "menu_start"
msgstr "Start"

msgid "menu_continue"
msgstr "Continue"

msgid "menu_daily"
msgstr "Daily Puzzle"

msgid "menu_calendar"
msgstr "Calendar"

msgid "menu_settings"
msgstr "Settings"

msgid "menu_achievements"
msgstr "Achievements"

msgid "menu_quit"
msgstr "Quit"

msgid "difficulty_easy"
msgstr "Easy"

msgid "difficulty_medium"
msgstr "Medium"

msgid "difficulty_hard"
msgstr "Hard"

msgid "difficulty_expert"
msgstr "Expert"

msgid "difficulty_insomnia"
msgstr "Insomnia"

msgid "rich_presence_playing"
msgstr "Playing {difficulty}"

msgid "win_title"
msgstr "You Win!"

msgid "win_time"
msgstr "Time: {time}"

msgid "win_new_pb"
msgstr "New personal best!"

# Plural example
msgid "hint_remaining_one"
msgid_plural "hint_remaining_other"
msgstr[0] "%d hint left"
msgstr[1] "%d hints left"

# 全部 ~200-300 条按相同模式翻完
```

> **质量保证**：spec § Risk register R6 要求 "en.po 找 1-2 海外友人验收"。本 task 完成 AI 翻译后写 `docs/I18N_REVIEW_NEEDED.md` 列出所有 msgstr 供人工抽查（最终 review 在 M10 Beta 期）。

- [ ] **Step 4: Import + 手测**

Editor add en.po → restart → 设置 → 语言 → English → UI 切换。

- [ ] **Step 5: Commit**

```bash
git add translations/en.po
git commit -m "feat(i18n): en.po complete (AI-translated; human spot-check pending M10)"
```

---

## Task 8 — i18n_check.gd 跨 .po 漏 key 检测

**Files:**
- Create: `tools/i18n_check.gd`

- [ ] **Step 1: 写检测脚本**

`tools/i18n_check.gd`:

```gdscript
# tools/i18n_check.gd
# 跨 .po 漏 key 检测。比较 zh_CN.po / zh_TW.po / en.po，列出：
#   - msgid 出现在 zh_CN 但缺在 zh_TW 或 en（漏译）
#   - msgid 在某个 .po 内 msgstr 为空（未填）
#   - msgid 出现在 .po 但不出现在 messages.pot（已废弃/陈旧）
#
# 使用：godot --headless --script tools/i18n_check.gd
extends SceneTree

const PO_FILES := {
    "zh_CN": "res://translations/zh_CN.po",
    "zh_TW": "res://translations/zh_TW.po",
    "en":    "res://translations/en.po",
}
const POT_FILE := "res://translations/messages.pot"

func _init() -> void:
    var pot_keys: Dictionary = _parse_po_keys(POT_FILE)
    print("[i18n_check] POT has %d keys" % pot_keys.size())

    var all_locale_keys: Dictionary = {}  # locale → Dictionary[key → msgstr]
    for locale in PO_FILES:
        all_locale_keys[locale] = _parse_po_entries(PO_FILES[locale])
        print("[i18n_check] %s.po has %d entries" % [locale, all_locale_keys[locale].size()])

    var problems: int = 0

    # 1. 每个 locale 应覆盖所有 pot keys
    for locale in PO_FILES:
        var entries: Dictionary = all_locale_keys[locale]
        for key in pot_keys:
            if not entries.has(key):
                push_error("[%s.po] missing msgid: %s" % [locale, key])
                problems += 1
            elif entries[key] == "":
                push_error("[%s.po] empty msgstr for: %s" % [locale, key])
                problems += 1

    # 2. 每个 .po 不应有 pot 不包含的 key（陈旧）
    for locale in PO_FILES:
        var entries: Dictionary = all_locale_keys[locale]
        for key in entries:
            if not pot_keys.has(key):
                push_warning("[%s.po] stale key (not in POT): %s" % [locale, key])

    if problems == 0:
        print("[i18n_check] OK — all keys covered across 3 locales")
        quit(0)
    else:
        print("[i18n_check] FOUND %d problems" % problems)
        quit(1)

# 简易 .po parser — 只关心 msgid + msgstr 配对
func _parse_po_entries(path: String) -> Dictionary:
    var result: Dictionary = {}
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        push_error("can't open " + path)
        return result
    var current_msgid := ""
    var capturing_msgstr := false
    var current_msgstr := ""
    while not file.eof_reached():
        var line := file.get_line().strip_edges()
        if line.begins_with("msgid "):
            if current_msgid != "":
                result[current_msgid] = current_msgstr
            current_msgid = _strip_quotes(line.substr(6))
            current_msgstr = ""
            capturing_msgstr = false
        elif line.begins_with("msgstr "):
            current_msgstr = _strip_quotes(line.substr(7))
            capturing_msgstr = true
        elif line.begins_with("\"") and capturing_msgstr:
            # 多行 continuation
            current_msgstr += _strip_quotes(line)
        elif line == "" and current_msgid != "":
            result[current_msgid] = current_msgstr
            current_msgid = ""
            current_msgstr = ""
            capturing_msgstr = false
    if current_msgid != "":
        result[current_msgid] = current_msgstr
    # 删 header（msgid "")
    result.erase("")
    return result

func _parse_po_keys(path: String) -> Dictionary:
    var entries := _parse_po_entries(path)
    var keys: Dictionary = {}
    for k in entries:
        keys[k] = true
    return keys

func _strip_quotes(s: String) -> String:
    if s.length() >= 2 and s[0] == "\"" and s[s.length() - 1] == "\"":
        return s.substr(1, s.length() - 2)
    return s
```

- [ ] **Step 2: 跑检测**

```bash
cd ~/mygit/calendar-puzzle-godot
godot --headless --script tools/i18n_check.gd 2>&1
```

Expected: `[i18n_check] OK — all keys covered across 3 locales` 退出码 0。

如有漏，回 Task 5/6/7 补 msgstr 后重跑。

- [ ] **Step 3: Commit**

```bash
git add tools/i18n_check.gd
git commit -m "feat(i18n): cross-locale missing key checker (godot --script)"
```

---

## Task 9 — i18n_extraction 启发式测试（防回归）

**Files:**
- Create: `tests/test_i18n_extraction.gd`

> **目标**：写一个测试，扫所有 user-facing .gd 文件，启发式查"硬编码用户可见字符串"残留。准确率不要求 100%，但能在 PR review 前 catch 明显回归。

- [ ] **Step 1: 写启发式扫描**

`tests/test_i18n_extraction.gd`:

```gdscript
extends "res://addons/gut/test.gd"

# 扫描以下目录的 .gd 文件，查违规的硬编码字符串赋值给 UI 节点属性
const SCAN_DIRS := [
    "res://boot/main_menu",
    "res://games/calendar_puzzle/scenes",
    "res://games/calendar_puzzle/systems",
    "res://shared/ui",
]

# 违规模式：UI 属性赋字符串字面量（应当用 tr()）
# 例：`button.text = "Click me"` → 违规
#     `label.text = tr("hud_hint")` → OK
#     `_log("debug message")` → OK（log/print 不算用户可见）
const VIOLATION_PATTERNS := [
    # 简化的正则：UI 属性 = "字符串"（不含 tr 调用 / 不含 i18n key 引用）
    # 实际用 String.match 不是 regex，匹配启发式行
]

# 白名单 key — 测试本身、注释、log 字面量
const WHITELIST_FILES := [
    "tests/",
    "tools/",
]

func test_no_hardcoded_strings_in_user_facing_files():
    var violations: Array = []
    for dir in SCAN_DIRS:
        _scan_dir(dir, violations)
    if violations.size() > 0:
        var msg := "Found %d potential hardcoded user-visible strings:\n" % violations.size()
        for v in violations:
            msg += "  %s:%d: %s\n" % [v.file, v.line, v.text]
        fail_test(msg)

func _scan_dir(dir_path: String, out_violations: Array) -> void:
    var dir := DirAccess.open(dir_path)
    if dir == null:
        return
    dir.list_dir_begin()
    var name := dir.get_next()
    while name != "":
        var full := dir_path + "/" + name
        if dir.current_is_dir() and not name.begins_with("."):
            _scan_dir(full, out_violations)
        elif name.ends_with(".gd"):
            _scan_file(full, out_violations)
        name = dir.get_next()
    dir.list_dir_end()

func _scan_file(path: String, out_violations: Array) -> void:
    var f := FileAccess.open(path, FileAccess.READ)
    if f == null: return
    var line_no := 0
    while not f.eof_reached():
        line_no += 1
        var line := f.get_line()
        var stripped := line.strip_edges()
        # 跳过注释 / 空行 / log / push_*
        if stripped.begins_with("#") or stripped == "":
            continue
        if stripped.begins_with("print(") or stripped.begins_with("push_warning(") \
           or stripped.begins_with("push_error(") or stripped.begins_with("printerr("):
            continue
        # 启发：行内含 `.text = "` 或 `.tooltip_text = "` 或 `.placeholder_text = "`
        # 但不含 `tr(` 调用
        var suspicious_props := [".text = \"", ".tooltip_text = \"", ".placeholder_text = \""]
        for prop in suspicious_props:
            if prop in stripped and not ("tr(" in stripped):
                # 进一步排除：text = "" 这种空字符串赋值
                if "= \"\"" in stripped:
                    continue
                out_violations.append({
                    "file": path,
                    "line": line_no,
                    "text": stripped,
                })
                break
```

- [ ] **Step 2: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | tail -20
```

Expected: 0 violations（如 Task 3 替换完整）。若有 violations 输出，回 Task 3 补漏。

- [ ] **Step 3: Commit**

```bash
git add tests/test_i18n_extraction.gd
git commit -m "test(i18n): heuristic scanner for hardcoded UI strings (regression guard)"
```

---

## Task 10 — 设置面板加 Language 选择子页面

**Files:**
- Create: `boot/main_menu/settings/language_panel.gd`
- Modify: `boot/main_menu/settings/settings_scene.tscn`（M4 已建）

- [ ] **Step 1: 写 language_panel.gd**

```gdscript
# boot/main_menu/settings/language_panel.gd
# 设置面板"语言"子页面：列 4 个选项（Auto / 简体 / 繁体 / English），选后立刻应用。
extends Control

const Boot = preload("res://boot/boot.gd")

@onready var _option_auto: Button = $V/OptionAuto
@onready var _option_zh_cn: Button = $V/OptionZhCN
@onready var _option_zh_tw: Button = $V/OptionZhTW
@onready var _option_en: Button = $V/OptionEn

var _deps

func _ready() -> void:
    # 文案绑 tr
    _option_auto.text = _deps.i18n.tr("language_auto")
    _option_zh_cn.text = _deps.i18n.tr("language_zh_CN")
    _option_zh_tw.text = _deps.i18n.tr("language_zh_TW")
    _option_en.text = _deps.i18n.tr("language_en")
    _option_auto.pressed.connect(func (): _apply(""))
    _option_zh_cn.pressed.connect(func (): _apply("zh_CN"))
    _option_zh_tw.pressed.connect(func (): _apply("zh_TW"))
    _option_en.pressed.connect(func (): _apply("en"))

func _apply(override_locale: String) -> void:
    var profile = _deps.save.read("profile")
    if profile == null:
        profile = preload("res://shared/resources/profile_resource.gd").new()
    if profile.settings == null:
        profile.settings = preload("res://shared/resources/settings_resource.gd").new()
    profile.settings.locale = override_locale
    _deps.save.write("profile", profile)
    # 立即应用 — 重新解析 locale
    var resolved := Boot.resolve_locale(
        _deps.platform.get_steam_language(),
        OS.get_locale(),
        override_locale,
    )
    _deps.i18n.set_locale(resolved)
    # 重新刷新本页文案
    _ready()
    # 通知父级 settings_scene refresh 所有 UI（M4 提供 refresh 信号即可）
    get_parent().refresh_all_labels()
```

- [ ] **Step 2: 在 settings_scene.tscn 加 LanguagePanel 节点**

Editor 操作（或手写 .tscn）：

加 `TabContainer` 或新 tab，名 "Language"，子节点为 LanguagePanel 实例。

- [ ] **Step 3: 手测**

```bash
godot
# 主菜单 → 设置 → 语言 → 选 English → 全部 UI 立刻切英文
# 重启游戏 → 仍是英文（locale 持久化到 profile.settings.locale）
# 改回 "跟随系统" → 重启 → 跟随 OS / Steam
```

- [ ] **Step 4: Commit**

```bash
git add boot/main_menu/settings/language_panel.gd \
        boot/main_menu/settings/settings_scene.tscn
git commit -m "feat(i18n): settings language panel (auto/zh_CN/zh_TW/en + hot apply)"
```

---

## Task 11 — 写 I18N_WORKFLOW.md 文档

**Files:**
- Create: `docs/I18N_WORKFLOW.md`
- Create: `translations/README.md`

- [ ] **Step 1: 写 workflow doc**

`docs/I18N_WORKFLOW.md`:

```markdown
# i18n 工作流

## 加新文案的标准流程

1. 在 `.gd` / `.tscn` 内写 `tr("new_key_name")`（不是直接写中文）
2. 在 `i18n/keys.md` 表里追加 key + zh-CN 原文 + 出处
3. Editor 跑 Project → Tools → Localization → "Generate POT"
4. `python tools/opencc_convert.py translations/zh_CN.po translations/zh_TW.po`
5. 手工补 zh_TW 术语校正（参考 Task 6 表）
6. 手工补 en.po 翻译
7. `godot --headless --script tools/i18n_check.gd` 验证 0 漏
8. 手测三语切换显示正确
9. Commit `i18n/keys.md` + 3 个 .po + 修改的 .gd/.tscn

## 三语优先级

- **zh-CN** — 主语言，用户手写
- **zh-TW** — OpenCC 简转繁 + 50 处人工术语校正
- **en** — AI 翻译 + M10 海外友人 spot-check

## locale 解析

启动时按以下优先级解析最终 locale：

1. `SettingsResource.locale`（玩家设置面板手选）
2. Steam 客户端语言（GodotSteam `getCurrentGameLanguage`）：
   - `schinese` → zh_CN
   - `tchinese` → zh_TW
   - `english` → en
3. `OS.get_locale()` 头匹配 zh_CN / zh_TW / zh_HK / en
4. 兜底 `en`

## 命名约定

- 全小写 + snake_case
- 区域前缀：hud_ / menu_ / settings_ / tutorial_ / dialog_ / toast_ / difficulty_ / win_ / error_
- 复数：`<key>_one` + `<key>_other` （tr_n）
- 不许动态拼接 key（POT extractor 静态扫描）

## 工具

- `tools/opencc_convert.py` — zh_CN.po → zh_TW.po
- `tools/i18n_check.gd` — 跨 .po 漏 key 检测
- `tests/test_i18n_extraction.gd` — 启发式扫硬编码（CI 每次跑）

## 文件

- `translations/messages.pot` — Godot extract 输出
- `translations/zh_CN.po` / `zh_TW.po` / `en.po` — 3 份翻译源
- `translations/*.translation` — Godot import 后的二进制，**gitignored**
- `i18n/keys.md` — 人工 key 索引
```

`translations/README.md`:

```markdown
# Translations

3 份 .po 文件 → Godot 自动 import 为 .translation 二进制（不入 git）→ 打进 .pck 发布。

| 文件 | 用途 | 维护方 |
|---|---|---|
| messages.pot | POT extraction 输出（template） | godot extractor |
| zh_CN.po | 简体中文（主） | 手写 |
| zh_TW.po | 繁体中文 | opencc + 人工微调 |
| en.po | 英文 | AI + 人工 spot-check |

详见 `docs/I18N_WORKFLOW.md`。
```

- [ ] **Step 2: Commit**

```bash
git add docs/I18N_WORKFLOW.md translations/README.md
git commit -m "docs(i18n): workflow + translations README"
```

---

## Self-Review

**1. Spec coverage**:
- ✅ 所有用户可见字符串 tr() → Task 3 批量替换 + Task 9 启发式回归测试
- ✅ zh-CN / zh-TW / en 三份 .po 完整 → Task 5-7 分别落 + Task 8 i18n_check 验证 0 漏
- ✅ Steam 语言检测 → Task 2 resolve_locale + steam_lang_to_locale 映射 + 7 个单测
- ✅ 设置面板手选覆盖 → Task 10 language_panel.gd 热切换

**2. Placeholder scan**:
- en.po 海外友人 spot-check 标注 M10 Beta（spec § R6，非 plan 缺陷）
- Task 3 的具体 key 总数（~200-300）取决于 M0-M6 实际暴露的字符串；plan 中给的 keys.md 是模板，实际数据由实施时填写

**3. Type consistency**:
- `TranslationContext.tr(key, context)` / `tr_n(key, plural_key, count, context)` / `set_locale(locale)` / `get_locale()` — M0 接口 + M7 真实实现签名一致
- `GameDeps.i18n` 从 M0 流到 Task 10 设置面板，一致
- `SettingsResource.locale` 在 M4 SettingsResource 上扩展，与 ProfileResource.settings 关联一致
- `PlatformBus.get_steam_language()` 新增 — Task 2 定义 + Task 2 实现 + Task 2 测试一致

**4. Ambiguity**:
- POT extraction Godot CLI vs Editor UI 双路径 — 标注若 CLI 在 4.3 上不可用则用 Editor，频率不高可接受
- Task 9 启发式扫描是"防回归"性质不是"完全正确"，明确标注；不强求 100% 准确率但 catch 明显问题

**5. 跨依赖核对**:
- 依赖 M0：TranslationContext 抽象 / GameDeps.i18n 注入路径
- 依赖 M4：SettingsResource / ProfileResource / SaveAdapter
- 依赖 M6：SteamPlatform.getCurrentGameLanguage（M6 已实现 GodotSteam 真实调用）
- 不依赖 M8：多平台构建在 M8 单独处理，本 plan 只确保 .po → .translation import 路径走通

无发现要修。M7 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven），M7 实施时用 superpowers:subagent-driven-development。

派发节奏建议：
- Task 1（translation_context 真实实现）+ Task 2（locale 检测）一批：独立，纯 boot 层
- Task 3（硬编码替换）单独，**逐文件 batch 改 + commit**；这是劳动密集任务，subagent 实施时按 keys.md 表分 5-7 个 batch 跑，每个 batch 一个 commit；建议每 batch 完后跑一次 GUT 防回归
- Task 4（POT 抽取 + project.godot 配置）单独，依赖 Task 3 完成
- Task 5-7（三份 .po）可一定程度并发，但因为 zh_TW 依赖 zh_CN（OpenCC 转），en 独立；建议顺序 Task 5 → Task 6 + Task 7 并发
- Task 8（i18n_check）单独，依赖 Task 5-7 完成；如 check 不过回 Task 5/6/7 补
- Task 9（启发式扫描）单独，依赖 Task 3 完成
- Task 10（设置面板）单独，依赖 Task 1-2 完成
- Task 11（doc）随时可写

**重要风险点**：
- Task 4 POT extraction 在 Godot 4.3 的 CLI 行为可能与编辑器 UI 行为有差异；若 CLI 无法抽取 `.gd` 内 tr() 调用，回退到 Editor UI 手工抽取（频率不高，可接受）
- Task 6 OpenCC s2twp 需要 pip install 依赖；本 milestone 仅在生成 zh_TW.po 阶段用，运行时不依赖 — `tools/opencc_convert.py` 是开发期工具不打进游戏
- Task 3 硬编码替换涉及大量文件（M0-M6 累计 30+ .gd / .tscn 文件），subagent 实施时务必每 batch 后跑 GUT 确保未破坏已通过的测试
