# M9 — 视觉打磨 + 音频集成 + 皮肤资产 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 UI 组件库（16 个组件 + 示例 + 单测）、玩法动画与缓动、10 SFX + 2 BGM 音频集成、10 种色盲符号、亮/暗 Theme 切换、3 个预置 SkinResource（Default / Pastel / Mono Focus）含 128×128 缩略图。

**Architecture:** UI 组件统一在 `shared/ui/`，每个组件有 `<name>_example.tscn` + 单测。Tween 动画走 Godot 4 内置 Tween node，缓动函数集中在 `shared/ui/easing.gd`。音频走 `AudioStreamPlayer` + 全局 bus（Master / BGM / SFX）；音量从 `SettingsResource` 读。皮肤是 `SkinResource` (`Resource`)，`SkinManager` 是 autoload 提供 `apply(skin_id)` + `current_skin_changed` signal。

**Tech Stack:** Godot 4.3+ Tween + AudioStreamPlayer + Theme + Resource、SVG 矢量符号 (Polygon2D) 、Pixabay Music + freesound.org 下载工具链。

**Spec reference:** `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` § Visual / Audio / i18n / § 视觉设计系统 / § 皮肤系统 / § Milestones M9 / § Risk R7

**Acceptance gates (从 spec 抄):**
- `shared/ui/` 16 个组件全部完成，每个有 `<name>_example.tscn` + 单测，所有 example 场景能独立打开预览
- 动画系统就位：方块放置 0.2s ease-out / 移除 0.15s ease-in / 菜单切换 0.3s ease-in-out
- 10 SFX + 2 BGM 文件就位（合法素材，源 + 许可证记录到 `assets/CREDITS.md`），音量响应 SettingsResource
- 10 种几何色盲符号渲染在方块上，可在设置中开关
- Light / Dark Theme 资源完成，设置切换后全屏幕生效
- 3 SkinResource (default / pastel / mono_focus) 文件完成 + 各 128×128 缩略图通过 `tools/render_skin_thumbnails.gd` 渲染生成
- `tests/test_skin_manager.gd` + `tests/test_audio_player.gd` + `tests/test_theme_switch.gd` 全绿

---

## File Structure

本 milestone 创建 / 修改的文件（全部在 `~/mygit/calendar-puzzle-godot/` 下）：

```
calendar-puzzle-godot/
├── shared/ui/
│   ├── easing.gd                              # 缓动常量与帮助函数
│   ├── button.gd + button.tscn
│   ├── icon_button.gd + icon_button.tscn
│   ├── card.gd + card.tscn
│   ├── modal.gd + modal.tscn
│   ├── toast.gd + toast.tscn
│   ├── slider.gd + slider.tscn
│   ├── switch.gd + switch.tscn
│   ├── tab_bar.gd + tab_bar.tscn
│   ├── tooltip.gd + tooltip.tscn
│   ├── progress_bar.gd + progress_bar.tscn
│   ├── number_stepper.gd + number_stepper.tscn
│   ├── dropdown_menu.gd + dropdown_menu.tscn
│   ├── calendar.gd + calendar.tscn            # M4 stub → M9 polish
│   ├── thumbnail.gd + thumbnail.tscn
│   ├── avatar.gd + avatar.tscn
│   ├── key_capture.gd + key_capture.tscn      # M4 stub → M9 polish
│   └── examples/
│       └── <name>_example.tscn                # 每组件一个示例场景
├── games/calendar_puzzle/
│   ├── assets/
│   │   ├── bgm/
│   │   │   ├── lofi_loop.ogg                  # 约 2-4MB
│   │   │   └── piano_ambient.ogg              # 约 2-4MB
│   │   ├── sfx/
│   │   │   ├── place.ogg
│   │   │   ├── rotate.ogg
│   │   │   ├── mirror.ogg
│   │   │   ├── remove.ogg
│   │   │   ├── hint.ogg
│   │   │   ├── win.ogg
│   │   │   ├── error.ogg
│   │   │   ├── ui_click.ogg
│   │   │   ├── achievement.ogg
│   │   │   └── win_fanfare.ogg
│   │   ├── symbols/                           # 10 个色盲符号 (.svg + .png 备用)
│   │   │   ├── 01_square.svg
│   │   │   ├── 02_circle.svg
│   │   │   ├── 03_triangle.svg
│   │   │   ├── 04_cross.svg
│   │   │   ├── 05_diamond.svg
│   │   │   ├── 06_pentagon.svg
│   │   │   ├── 07_hexagon.svg
│   │   │   ├── 08_star.svg
│   │   │   ├── 09_arrow.svg
│   │   │   └── 10_wave.svg
│   │   └── CREDITS.md                         # 所有音频/字体/符号来源 + 许可
│   ├── skins/
│   │   ├── skin_resource.gd                   # SkinResource 类（M9 完整版）
│   │   ├── board_palette.gd                   # BoardPalette sub-resource
│   │   ├── default.tres
│   │   ├── pastel.tres
│   │   ├── mono_focus.tres
│   │   └── thumbnails/
│   │       ├── default.png                    # 128×128
│   │       ├── pastel.png
│   │       └── mono_focus.png
│   └── systems/
│       ├── skin_manager.gd                    # autoload；apply(skin_id) + signal
│       └── audio_player.gd                    # 包装 AudioStreamPlayer + 读 SettingsResource 音量
├── boot/theme/
│   ├── light_theme.tres                       # Godot Theme resource
│   ├── dark_theme.tres
│   └── theme_manager.gd                       # apply theme to root 工具
├── tools/
│   ├── render_skin_thumbnails.gd              # 离线脚本：根据皮肤色生成 128×128 PNG
│   └── download_audio_assets.md               # 下载/审听清单（freesound + Pixabay 链接）
└── tests/
    ├── test_skin_manager.gd
    ├── test_audio_player.gd
    ├── test_theme_switch.gd
    └── test_ui_components_smoke.gd            # 16 个组件 example.tscn 都能 instantiate
```

---

## Task 1 — 写 shared/ui/easing.gd 缓动常量

**Files:**
- Create: `shared/ui/easing.gd`

- [ ] **Step 1: 写缓动帮助类**

`shared/ui/easing.gd`:

```gdscript
# shared/ui/easing.gd
# 全局缓动常量；UI 组件 / 玩法动画统一从这里取，避免参数散落。
class_name UIEasing extends RefCounted

# 持续时间（秒）
const DURATION_BLOCK_PLACE := 0.20      # 方块落下
const DURATION_BLOCK_REMOVE := 0.15     # 方块拾起
const DURATION_BLOCK_ROTATE := 0.18     # 旋转
const DURATION_MENU_TRANSITION := 0.30  # 菜单切换
const DURATION_TOAST_IN := 0.25         # toast 入场
const DURATION_TOAST_OUT := 0.20        # toast 出场
const DURATION_MODAL_FADE := 0.18       # modal 背景渐变
const DURATION_BUTTON_PRESS := 0.10     # 按钮按下视觉反馈

# 曲线对（trans / ease）
const PLACE_TRANS = Tween.TRANS_CUBIC
const PLACE_EASE = Tween.EASE_OUT

const REMOVE_TRANS = Tween.TRANS_CUBIC
const REMOVE_EASE = Tween.EASE_IN

const MENU_TRANS = Tween.TRANS_QUART
const MENU_EASE = Tween.EASE_IN_OUT

const BUTTON_TRANS = Tween.TRANS_QUAD
const BUTTON_EASE = Tween.EASE_OUT

# Helper：在节点上启动 tween，返回 Tween 实例供链式调用
static func place_tween(node: Node, property: String, final: Variant) -> Tween:
    var tw := node.create_tween()
    tw.tween_property(node, property, final, DURATION_BLOCK_PLACE) \
      .set_trans(PLACE_TRANS).set_ease(PLACE_EASE)
    return tw

static func remove_tween(node: Node, property: String, final: Variant) -> Tween:
    var tw := node.create_tween()
    tw.tween_property(node, property, final, DURATION_BLOCK_REMOVE) \
      .set_trans(REMOVE_TRANS).set_ease(REMOVE_EASE)
    return tw

static func menu_tween(node: Node, property: String, final: Variant) -> Tween:
    var tw := node.create_tween()
    tw.tween_property(node, property, final, DURATION_MENU_TRANSITION) \
      .set_trans(MENU_TRANS).set_ease(MENU_EASE)
    return tw
```

- [ ] **Step 2: 校验语法**

```bash
godot --headless --check-only --script shared/ui/easing.gd 2>&1
```

Expected: 无 error。

- [ ] **Step 3: Commit**

```bash
git add shared/ui/easing.gd
git commit -m "feat(ui): UIEasing constants + tween helpers"
```

---

## Task 2 — 写 16 个 UI 组件骨架（每个 .gd + .tscn + example.tscn）

> 每个组件做最小可用版（scene + 一个 export 接口 + style override）。复杂交互（如 Calendar 的日期跳转、KeyCapture 的冲突检测）M4 已留 stub；本 task 在视觉/动画/focus state 上 polish。

**Files:**
- Create: `shared/ui/<name>.gd` + `shared/ui/<name>.tscn` for each of 16 components
- Create: `shared/ui/examples/<name>_example.tscn` for each

> 16 个组件的 spec 一致：
> - 极简扁平 + 4F46E5 主色（亮色） / 818CF8（暗色）
> - focus state 用 1.5px outline + 4F46E5/818CF8 主色
> - press/hover 用 alpha 透明度变化 + UIEasing.DURATION_BUTTON_PRESS Tween
> - 所有可点击控件 hitbox ≥ 32×32（Deck 触屏兼容）

下列 Step 1-16 每步**结构相同**，按组件名写。每步约 8-15 分钟。

- [ ] **Step 1: Button**（已经在 M4 有原型；这里 polish hover/press/focus 动画）

`shared/ui/button.gd`:

```gdscript
# shared/ui/button.gd
# 标准 Button，统一 hover/press/focus 视觉。
class_name UIButton extends Button

const UIEasing = preload("res://shared/ui/easing.gd")

@export var primary: bool = false  # 主色高亮 vs 默认次色

var _base_modulate: Color

func _ready() -> void:
    _base_modulate = modulate
    mouse_entered.connect(_on_hover)
    mouse_exited.connect(_on_unhover)
    button_down.connect(_on_press)
    button_up.connect(_on_release)
    focus_entered.connect(_on_focus)
    focus_exited.connect(_on_blur)

func _on_hover() -> void:
    var tw := create_tween()
    tw.tween_property(self, "modulate", _base_modulate * 1.1, UIEasing.DURATION_BUTTON_PRESS) \
      .set_trans(UIEasing.BUTTON_TRANS).set_ease(UIEasing.BUTTON_EASE)

func _on_unhover() -> void:
    var tw := create_tween()
    tw.tween_property(self, "modulate", _base_modulate, UIEasing.DURATION_BUTTON_PRESS) \
      .set_trans(UIEasing.BUTTON_TRANS).set_ease(UIEasing.BUTTON_EASE)

func _on_press() -> void:
    var tw := create_tween()
    tw.tween_property(self, "scale", Vector2(0.97, 0.97), UIEasing.DURATION_BUTTON_PRESS) \
      .set_trans(UIEasing.BUTTON_TRANS).set_ease(UIEasing.BUTTON_EASE)

func _on_release() -> void:
    var tw := create_tween()
    tw.tween_property(self, "scale", Vector2.ONE, UIEasing.DURATION_BUTTON_PRESS) \
      .set_trans(UIEasing.BUTTON_TRANS).set_ease(UIEasing.BUTTON_EASE)

func _on_focus() -> void:
    # 描边由 Theme 提供；这里只标 hint
    pass

func _on_blur() -> void:
    pass
```

`shared/ui/button.tscn` (manual write):

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://shared/ui/button.gd" id="1"]

[node name="UIButton" type="Button"]
text = "Button"
custom_minimum_size = Vector2(64, 32)
script = ExtResource("1")
```

`shared/ui/examples/button_example.tscn`:

```
[gd_scene load_steps=3 format=3]

[ext_resource type="PackedScene" path="res://shared/ui/button.tscn" id="1"]

[node name="ButtonExample" type="VBoxContainer"]
anchors_preset = 15
custom_minimum_size = Vector2(300, 200)

[node name="DefaultBtn" parent="." instance=ExtResource("1")]
text = "Default"

[node name="PrimaryBtn" parent="." instance=ExtResource("1")]
text = "Primary"
primary = true
```

- [ ] **Step 2: IconButton**

`shared/ui/icon_button.gd` — `extends UIButton`，加 `@export var icon_texture: Texture2D`，把 `icon` property 绑过去；example 用 1 个临时占位 icon。

- [ ] **Step 3: Card**

`shared/ui/card.gd` — `extends PanelContainer`，预设 StyleBoxFlat 圆角 8px + 阴影 + bg color 从 Theme 读；example 内含一个 Label 和 Button。

- [ ] **Step 4: Modal**

`shared/ui/modal.gd` — `extends CanvasLayer`，背景半透明黑遮罩 + 中央 Card；signal `dismissed`；open/close 用 `UIEasing.DURATION_MODAL_FADE` tween 渐变 modulate.a。

- [ ] **Step 5: Toast**

`shared/ui/toast.gd` — `extends Control`，底部出现 → 2.5s 后自动消失；fade in `UIEasing.DURATION_TOAST_IN` / out `UIEasing.DURATION_TOAST_OUT`；提供 `static func show_text(parent: Node, text: String)`。

- [ ] **Step 6: Slider**

`shared/ui/slider.gd` — `extends HSlider`，绑 focus state outline；value 变化时小幅 scale tween 反馈；example 三个分别绑 BGM / SFX / Master 音量。

- [ ] **Step 7: Switch**

`shared/ui/switch.gd` — `extends CheckButton`，覆盖图形为 iOS 风开关；toggle 动画 0.15s ease-out 滑块位移。

- [ ] **Step 8: TabBar**

`shared/ui/tab_bar.gd` — `extends TabBar` 包装；focus state 用底部 2px underline；切换时 indicator slide `UIEasing.menu_tween`。

- [ ] **Step 9: Tooltip**

`shared/ui/tooltip.gd` — `extends PanelContainer`，hover 控件 800ms 后弹；位置避免溢出屏幕。

- [ ] **Step 10: ProgressBar**

`shared/ui/progress_bar.gd` — `extends ProgressBar`，平滑 tween 到目标值（0.5s ease-out）。

- [ ] **Step 11: NumberStepper**

`shared/ui/number_stepper.gd` — `extends HBoxContainer` 含 [−] [value] [+]；min/max/step export；点 +/− 后 value tween 切换。

- [ ] **Step 12: DropdownMenu**

`shared/ui/dropdown_menu.gd` — `extends OptionButton` 包装；focus outline + 下拉动画。

- [ ] **Step 13: Calendar**（M4 已 stub，本 task 全实现）

`shared/ui/calendar.gd`：
- 月份导航箭头 `< 月 >`
- 6 行 × 7 列 GridContainer 显示日期
- export `min_date` / `max_date` (限 2020-01-01 到 2035-12-31)
- export `selected_date` + signal `date_selected(date: Dictionary)`
- 当日特殊高亮（圆形 4F46E5 背景）
- 选中日期描边 outline
- 切月用 `UIEasing.menu_tween` 横向滑动 GridContainer

- [ ] **Step 14: Thumbnail**

`shared/ui/thumbnail.gd` — `extends TextureRect`，固定 4:3 / 1:1 ratio；提供 fallback texture + loading spinner。

- [ ] **Step 15: Avatar**

`shared/ui/avatar.gd` — `extends TextureRect`，圆形 clip + 64×64 默认；export `user_id`，无图时显示首字母（Steam 头像 M6 取）。

- [ ] **Step 16: KeyCapture**（M4 已 stub，本 task 完整化）

`shared/ui/key_capture.gd`：
- 显示当前绑定（"R" / "Ctrl+Z" / "Mouse 3"）
- 点击 → 进入 capture mode → 显示 "Press a key…"
- 监听下一个 InputEvent（KeyboardKey / MouseButton / modifier 组合）
- 校验是否冲突（如已绑定其他 action）→ 弹 Toast 警告
- export signal `binding_changed(action: String, new_binding: String)`

每个组件做完后：

```bash
# 单文件语法 check
godot --headless --check-only --script shared/ui/<name>.gd 2>&1
# 打开 example.tscn 在 editor 预览（手测一次）
godot --quit-after 3 res://shared/ui/examples/<name>_example.tscn
```

- [ ] **Step 17: 写 examples 总索引场景方便预览**

`shared/ui/examples/index.tscn`：一个 ScrollContainer 把所有 16 个 example.tscn instance 塞进 VBoxContainer，按组件名 group 显示。手测：

```bash
godot res://shared/ui/examples/index.tscn
```

- [ ] **Step 18: Commit**

```bash
git add shared/ui/
git commit -m "feat(ui): 16 components with examples + animations (M9 polish)"
```

---

## Task 3 — 写 UI components smoke test

**Files:**
- Create: `tests/test_ui_components_smoke.gd`

- [ ] **Step 1: 写测试**

`tests/test_ui_components_smoke.gd`:

```gdscript
extends "res://addons/gut/test.gd"

# 烟雾测试：保证 16 个组件的 example.tscn 都能 instantiate 而不 crash。
# 不做交互测，只做"能加载"。

const COMPONENT_NAMES = [
    "button", "icon_button", "card", "modal", "toast", "slider",
    "switch", "tab_bar", "tooltip", "progress_bar", "number_stepper",
    "dropdown_menu", "calendar", "thumbnail", "avatar", "key_capture",
]

func test_all_examples_load_without_error():
    for name in COMPONENT_NAMES:
        var path = "res://shared/ui/examples/%s_example.tscn" % name
        var packed = load(path)
        assert_not_null(packed, "无法 load: %s" % path)
        var inst = packed.instantiate()
        assert_not_null(inst, "无法 instantiate: %s" % path)
        inst.queue_free()

func test_all_components_have_gd_and_tscn():
    for name in COMPONENT_NAMES:
        var gd_path = "res://shared/ui/%s.gd" % name
        var tscn_path = "res://shared/ui/%s.tscn" % name
        assert_true(ResourceLoader.exists(gd_path), "缺 %s" % gd_path)
        assert_true(ResourceLoader.exists(tscn_path), "缺 %s" % tscn_path)
```

- [ ] **Step 2: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | grep test_ui_components_smoke
```

Expected: 2 个测试 PASS。

- [ ] **Step 3: Commit**

```bash
git add tests/test_ui_components_smoke.gd
git commit -m "test(ui): smoke test all 16 component examples load"
```

---

## Task 4 — 音频资产下载 + 许可证记录

**Files:**
- Create: `tools/download_audio_assets.md`
- Create: `games/calendar_puzzle/assets/CREDITS.md`
- Create: 12 个 .ogg 文件（手工放置）

> 这一步是**人工下载 + 试听筛选**，不能脚本化。给出明确搜索条件和许可校验 checklist。

- [ ] **Step 1: 写下载手册**

`tools/download_audio_assets.md`:

```markdown
# 音频资产下载手册

> 全部要求 **CC0** 或 **CC-BY** 许可（CC-BY 在 CREDITS.md 注明作者）。
> 禁止 CC-NC / CC-ND / Royalty-Free Music Library 等限制商用的。

## BGM (2 首)

### `lofi_loop.ogg` — 主菜单 + 轻度玩法

来源候选：
- Pixabay Music: https://pixabay.com/music/search/lofi/?mood=relaxed
  - 搜索关键词：`lofi calm puzzle`、`lofi chill loop`
  - 推荐时长：90-180 秒（要无缝可循环）
- FMA (Free Music Archive): https://freemusicarchive.org/genre/Chill_out/
  - 关键词：`lofi chill loop`

筛选标准：
- 节奏 80-95 BPM
- 无人声（不会与 SFX 打架）
- loop 点干净（首尾相接无 click）

下载后转 ogg：`ffmpeg -i input.mp3 -c:a libvorbis -q:a 5 lofi_loop.ogg`

### `piano_ambient.ogg` — 失眠模式 / 长玩

来源候选：
- Pixabay Music: 搜 `piano ambient sleep` / `ambient piano relaxing`
- Bensound: https://www.bensound.com/royalty-free-music/relaxation （注意许可）

筛选标准：
- 比 lofi_loop 更慢更安静
- 时长 120-240 秒
- 钢琴 / 微调环境音

## SFX (10 个)

全部去 https://freesound.org 找（CC0 优先）。

| 文件 | 搜索关键词 | 时长 | 备注 |
|---|---|---|---|
| `place.ogg` | "wood block place" / "soft tap" | 0.1-0.3s | 主要交互音；最频繁；柔和不刺耳 |
| `rotate.ogg` | "ui rotate swoosh" / "ui flip" | 0.1-0.2s | 比 place 稍轻 |
| `mirror.ogg` | "ui swap" / "soft whoosh" | 0.1-0.2s | 与 rotate 略不同 |
| `remove.ogg` | "ui undo" / "soft pop" | 0.1-0.3s | 拾起反向 |
| `hint.ogg` | "ui notification soft" / "gentle chime" | 0.3-0.5s | 提示出现的小铃声 |
| `win.ogg` | "ui success" / "win bell" | 0.5-1.0s | 胜利时 |
| `error.ogg` | "ui error soft" / "buzzer mild" | 0.2-0.4s | 非法放置 |
| `ui_click.ogg` | "ui button click" / "soft tick" | 0.05-0.15s | 按钮通用 |
| `achievement.ogg` | "achievement unlock" / "ui notification" | 1.0-1.5s | 解成就时 |
| `win_fanfare.ogg` | "level complete fanfare short" | 2.0-3.0s | 失眠模式特殊胜利 |

### 试听 + 筛选流程

1. 每个 SFX 至少候选 3 个
2. 在 Godot Editor 里建临时 AudioStreamPlayer 节点逐个试听
3. 用 SettingsResource 默认音量 (BGM 30% / SFX 70%) 试听，确保不太响
4. 在 macOS / Win / Linux 各听一次（不同系统混音器音量曲线略不同）

### 转码统一

freesound 大多是 wav；统一转 ogg 节省体积：

```bash
for f in *.wav; do
  ffmpeg -i "$f" -c:a libvorbis -q:a 4 "${f%.wav}.ogg"
  rm "$f"
done
```

ogg q:a 4 大约 96kbps，SFX 听不出降质；BGM 用 q:a 5 (~144kbps)。
```

- [ ] **Step 2: 人工下载 + 试听 + 放置**

用户按 download_audio_assets.md 操作：

1. 下载 2 首 BGM、10 个 SFX
2. ffmpeg 转 ogg
3. 放置：
   - `games/calendar_puzzle/assets/bgm/lofi_loop.ogg`
   - `games/calendar_puzzle/assets/bgm/piano_ambient.ogg`
   - `games/calendar_puzzle/assets/sfx/<name>.ogg`（10 个）

校验：

```bash
find games/calendar_puzzle/assets -name "*.ogg" | wc -l
```

Expected: `12`

- [ ] **Step 3: 写 CREDITS.md（音频 + 字体来源 + 许可）**

`games/calendar_puzzle/assets/CREDITS.md`:

```markdown
# Calendar Puzzle Asset Credits

## Music (BGM)

| File | Source | Author | License | URL |
|---|---|---|---|---|
| `bgm/lofi_loop.ogg` | <Pixabay/FMA/其它> | <作者名> | <CC0/CC-BY> | <原始 URL> |
| `bgm/piano_ambient.ogg` | <来源> | <作者> | <许可> | <URL> |

## Sound Effects (SFX)

| File | Source | Author | License | URL |
|---|---|---|---|---|
| `sfx/place.ogg` | freesound.org | <user> | CC0 | https://freesound.org/people/<user>/sounds/<id>/ |
| `sfx/rotate.ogg` | ... | ... | ... | ... |
| `sfx/mirror.ogg` | ... | ... | ... | ... |
| `sfx/remove.ogg` | ... | ... | ... | ... |
| `sfx/hint.ogg` | ... | ... | ... | ... |
| `sfx/win.ogg` | ... | ... | ... | ... |
| `sfx/error.ogg` | ... | ... | ... | ... |
| `sfx/ui_click.ogg` | ... | ... | ... | ... |
| `sfx/achievement.ogg` | ... | ... | ... | ... |
| `sfx/win_fanfare.ogg` | ... | ... | ... | ... |

## Fonts

| Font | License | URL |
|---|---|---|
| JetBrains Mono | Apache 2.0 | https://www.jetbrains.com/lp/mono/ |
| Source Han Sans | SIL OFL | https://github.com/adobe-fonts/source-han-sans |
| Inter | SIL OFL | https://rsms.me/inter/ |
| Fraunces | SIL OFL | https://fonts.google.com/specimen/Fraunces |

## Symbols (色盲友好符号)

`assets/symbols/*.svg` — 自制，CC0。

## 法律合规 checklist

- [ ] 每个 CC-BY 项作者已记录到上表
- [ ] 无 CC-NC 项（CC-NC 禁止商用，本游戏付费销售属商用）
- [ ] 无 CC-ND 项（CC-ND 禁止修改，转码 ogg 算修改）
- [ ] 在 Settings → About 显示 "Credits" 按钮链到本文件
```

- [ ] **Step 4: Commit 音频 + credits**

```bash
git add games/calendar_puzzle/assets/bgm/ \
        games/calendar_puzzle/assets/sfx/ \
        games/calendar_puzzle/assets/CREDITS.md \
        tools/download_audio_assets.md
git commit -m "feat(audio): 2 BGM + 10 SFX assets with CREDITS.md"
```

---

## Task 5 — 实现 AudioPlayer 系统（autoload + 读 SettingsResource 音量）

**Files:**
- Create: `games/calendar_puzzle/systems/audio_player.gd`
- Modify: `project.godot`（注册 audio_player 为 autoload + 配 AudioBus）

- [ ] **Step 1: 配置 audio bus layout**

Editor 操作：

1. 打开底部 "Audio" 面板（如不可见，Window → Audio）
2. Master bus 默认已有
3. 加两个 bus：`BGM` 和 `SFX`（点 "Add Bus" 两次）
4. 把每个 bus 的 Send 设到 Master
5. Save 为 `default_bus_layout.tres`（Godot 默认路径）

校验：

```bash
ls default_bus_layout.tres
```

- [ ] **Step 2: 写 AudioPlayer**

`games/calendar_puzzle/systems/audio_player.gd`:

```gdscript
# games/calendar_puzzle/systems/audio_player.gd
# autoload；提供 play_sfx / play_bgm；按 SettingsResource 实时调音量。
extends Node

const SFX_DIR = "res://games/calendar_puzzle/assets/sfx/"
const BGM_DIR = "res://games/calendar_puzzle/assets/bgm/"

# 预加载所有 SFX (10 个文件，总大小 < 1MB)
var _sfx_cache: Dictionary = {}

# BGM player 单例（一次只放一首）
var _bgm_player: AudioStreamPlayer = null
var _current_bgm_path: String = ""

# bus 索引
var _master_idx: int
var _bgm_idx: int
var _sfx_idx: int

func _ready() -> void:
    _master_idx = AudioServer.get_bus_index("Master")
    _bgm_idx = AudioServer.get_bus_index("BGM")
    _sfx_idx = AudioServer.get_bus_index("SFX")

    _preload_sfx()
    _create_bgm_player()
    _apply_volumes_from_settings()

func _preload_sfx() -> void:
    var dir := DirAccess.open(SFX_DIR)
    if dir == null:
        push_error("[AudioPlayer] cannot open " + SFX_DIR)
        return
    dir.list_dir_begin()
    var name := dir.get_next()
    while name != "":
        if name.ends_with(".ogg"):
            var stream := load(SFX_DIR + name) as AudioStream
            _sfx_cache[name.replace(".ogg", "")] = stream
        name = dir.get_next()

func _create_bgm_player() -> void:
    _bgm_player = AudioStreamPlayer.new()
    _bgm_player.bus = "BGM"
    add_child(_bgm_player)

# 播 SFX
func play_sfx(name: String) -> void:
    if not _sfx_cache.has(name):
        push_warning("[AudioPlayer] unknown sfx: " + name)
        return
    var p := AudioStreamPlayer.new()
    p.stream = _sfx_cache[name]
    p.bus = "SFX"
    add_child(p)
    p.play()
    p.finished.connect(func(): p.queue_free())

# 播 BGM；同 path 不重启
func play_bgm(name: String) -> void:
    var path := BGM_DIR + name + ".ogg"
    if path == _current_bgm_path and _bgm_player.playing:
        return
    var stream := load(path) as AudioStream
    if stream == null:
        push_warning("[AudioPlayer] unknown bgm: " + name)
        return
    if stream is AudioStreamOggVorbis:
        stream.loop = true
    _bgm_player.stream = stream
    _bgm_player.play()
    _current_bgm_path = path

func stop_bgm() -> void:
    _bgm_player.stop()
    _current_bgm_path = ""

# 从 SettingsResource 拉音量（线性 0..1 → dB）
# 由 Settings 面板调用：每次 slider 变化触发
func apply_volumes(master: float, bgm: float, sfx: float) -> void:
    AudioServer.set_bus_volume_db(_master_idx, linear_to_db(master))
    AudioServer.set_bus_volume_db(_bgm_idx, linear_to_db(bgm))
    AudioServer.set_bus_volume_db(_sfx_idx, linear_to_db(sfx))

func _apply_volumes_from_settings() -> void:
    # M4 SettingsResource 默认 master=1.0 / bgm=0.3 / sfx=0.7
    # 实际 boot 注入；这里给 fallback
    apply_volumes(1.0, 0.3, 0.7)
```

- [ ] **Step 3: 注册 autoload**

`project.godot` 的 `[autoload]` 段（无则新建）追加：

```ini
[autoload]

AudioPlayer="*res://games/calendar_puzzle/systems/audio_player.gd"
```

- [ ] **Step 4: 让 SettingsResource 变化时调用 apply_volumes**

`games/calendar_puzzle/systems/settings_resource.gd`（M4 已有，本步骤补 signal hookup）：

确保 `bgm_volume` / `sfx_volume` / `master_volume` 是 `@export`，且在 setter 中触发：

```gdscript
# settings_resource.gd 节选
@export var master_volume: float = 1.0 :
    set(v):
        master_volume = clampf(v, 0.0, 1.0)
        emit_changed()

@export var bgm_volume: float = 0.3 :
    set(v):
        bgm_volume = clampf(v, 0.0, 1.0)
        emit_changed()

@export var sfx_volume: float = 0.7 :
    set(v):
        sfx_volume = clampf(v, 0.0, 1.0)
        emit_changed()
```

在 boot 或 settings_panel 监听 `changed` signal 调用 AudioPlayer.apply_volumes()。

- [ ] **Step 5: 在 boot 启动时调一次（用已存档音量）**

`boot/boot.gd` 的 `_ready()` 末尾追加：

```gdscript
# 应用音量
var settings = deps.save.read("profile") if deps.save.read("profile") != null else null
if settings and "settings" in settings:
    var s = settings.settings
    AudioPlayer.apply_volumes(s.master_volume, s.bgm_volume, s.sfx_volume)
```

- [ ] **Step 6: 写测试**

`tests/test_audio_player.gd`:

```gdscript
extends "res://addons/gut/test.gd"

# 注意：单测在 headless 无音频后端，只验证 API 不 crash + bus volume 设置正确

func test_apply_volumes_changes_bus_db():
    var ap = get_node("/root/AudioPlayer")
    ap.apply_volumes(1.0, 0.5, 0.75)

    var master_idx = AudioServer.get_bus_index("Master")
    var bgm_idx = AudioServer.get_bus_index("BGM")
    var sfx_idx = AudioServer.get_bus_index("SFX")

    assert_almost_eq(AudioServer.get_bus_volume_db(master_idx), linear_to_db(1.0), 0.01)
    assert_almost_eq(AudioServer.get_bus_volume_db(bgm_idx), linear_to_db(0.5), 0.01)
    assert_almost_eq(AudioServer.get_bus_volume_db(sfx_idx), linear_to_db(0.75), 0.01)

func test_play_sfx_unknown_warns_but_no_crash():
    var ap = get_node("/root/AudioPlayer")
    ap.play_sfx("nonexistent_sfx")  # 应该 push_warning 不 crash
    assert_true(true)

func test_play_bgm_then_stop():
    var ap = get_node("/root/AudioPlayer")
    ap.play_bgm("lofi_loop")
    # headless 没真音频；只校验没崩
    ap.stop_bgm()
    assert_eq(ap._current_bgm_path, "")

func test_sfx_cache_loaded_all_10():
    var ap = get_node("/root/AudioPlayer")
    assert_eq(ap._sfx_cache.size(), 10, \
        "应该 cache 10 个 SFX，实际 %d" % ap._sfx_cache.size())
```

- [ ] **Step 7: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | grep test_audio_player
```

Expected: 4 个测试 PASS。

- [ ] **Step 8: Commit**

```bash
git add games/calendar_puzzle/systems/audio_player.gd \
        boot/boot.gd \
        project.godot \
        default_bus_layout.tres \
        tests/test_audio_player.gd
git commit -m "feat(audio): AudioPlayer autoload + bus routing + volume from settings"
```

---

## Task 6 — 色盲符号 SVG + Polygon2D 渲染

**Files:**
- Create: `games/calendar_puzzle/assets/symbols/<NN>_<name>.svg` (10 个)
- Create: `games/calendar_puzzle/systems/block_symbol.gd`
- Create: `games/calendar_puzzle/systems/block_symbol_renderer.tscn`

- [ ] **Step 1: 自画 10 个简单几何 SVG**

10 个形状对应 10 个方块 (I/L/J/S/Z/P/Y/N/T/U)：

| index | 形状 | 对应方块 |
|---|---|---|
| 01 | square | I |
| 02 | circle | L |
| 03 | triangle | J |
| 04 | cross | S |
| 05 | diamond | Z |
| 06 | pentagon | P |
| 07 | hexagon | Y |
| 08 | star | N |
| 09 | arrow | T |
| 10 | wave | U |

每个 SVG 用一个统一模板（白色 fill + 透明背景 + viewBox 100×100），举例：

`games/calendar_puzzle/assets/symbols/01_square.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="25" y="25" width="50" height="50" fill="white"/>
</svg>
```

`games/calendar_puzzle/assets/symbols/02_circle.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="25" fill="white"/>
</svg>
```

`games/calendar_puzzle/assets/symbols/03_triangle.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,25 75,70 25,70" fill="white"/>
</svg>
```

`04_cross.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="40" y="20" width="20" height="60" fill="white"/>
  <rect x="20" y="40" width="60" height="20" fill="white"/>
</svg>
```

`05_diamond.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,20 80,50 50,80 20,50" fill="white"/>
</svg>
```

`06_pentagon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,20 78,42 67,75 33,75 22,42" fill="white"/>
</svg>
```

`07_hexagon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,20 78,35 78,65 50,80 22,65 22,35" fill="white"/>
</svg>
```

`08_star.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,20 58,42 80,42 62,56 70,78 50,64 30,78 38,56 20,42 42,42" fill="white"/>
</svg>
```

`09_arrow.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="20,40 60,40 60,25 85,50 60,75 60,60 20,60" fill="white"/>
</svg>
```

`10_wave.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M20,50 Q35,30 50,50 T80,50" stroke="white" stroke-width="8" fill="none"/>
</svg>
```

- [ ] **Step 2: 在 Godot 里 import SVG 为 Texture2D**

Godot 4 原生支持 .svg import。打开 Editor 后 SVG 自动 import 为 Texture2D。

校验：

```bash
ls games/calendar_puzzle/assets/symbols/*.svg | wc -l
```

Expected: `10`

启动 Editor 一次让 importer 跑过；再校验：

```bash
ls .godot/imported/01_square.svg-*.ctex 2>/dev/null && echo OK
```

- [ ] **Step 3: 写 BlockSymbol 显示节点**

`games/calendar_puzzle/systems/block_symbol.gd`:

```gdscript
# games/calendar_puzzle/systems/block_symbol.gd
# 单个色盲符号 sprite；按方块 id 自动加载对应 svg。
class_name BlockSymbol extends Sprite2D

# 方块 id → 符号文件 index (与 spec § 视觉设计系统 一致)
const SYMBOL_INDEX = {
    "I": "01_square", "L": "02_circle", "J": "03_triangle",
    "S": "04_cross",  "Z": "05_diamond", "P": "06_pentagon",
    "Y": "07_hexagon","N": "08_star",    "T": "09_arrow", "U": "10_wave",
}

const SYMBOL_DIR = "res://games/calendar_puzzle/assets/symbols/"

@export var block_id: String = "I" :
    set(v):
        block_id = v
        _refresh()

func _ready() -> void:
    _refresh()

func _refresh() -> void:
    if not SYMBOL_INDEX.has(block_id):
        push_warning("[BlockSymbol] unknown block_id " + block_id)
        return
    var path = SYMBOL_DIR + SYMBOL_INDEX[block_id] + ".svg"
    texture = load(path)
    modulate = Color(1, 1, 1, 0.6)  # 半透明白色叠在方块上
    centered = true
    scale = Vector2(0.4, 0.4)  # 在 64×64 cell 上显示 ~26×26
```

- [ ] **Step 4: 在 SettingsResource 加 toggle**

`settings_resource.gd` 加 export：

```gdscript
@export var show_colorblind_symbols: bool = true
```

- [ ] **Step 5: 在 PlayScene 的 block 渲染时按 settings 决定挂不挂 BlockSymbol**

修改 `games/calendar_puzzle/scenes/play_scene.gd`（M2 的 block 渲染处）：

```gdscript
# 节选
func _create_block_visual(block_id: String, pos: Vector2) -> Node2D:
    var node := Node2D.new()
    # ...基础方块 ColorRect 略
    if _settings.show_colorblind_symbols:
        var sym := preload("res://games/calendar_puzzle/systems/block_symbol.gd").new()
        sym.block_id = block_id
        node.add_child(sym)
    return node
```

- [ ] **Step 6: 跑游戏手测**

```bash
godot
```

进入 play scene，肉眼确认每块上有不同符号。在设置里 toggle 关掉应消失。

- [ ] **Step 7: Commit**

```bash
git add games/calendar_puzzle/assets/symbols/ \
        games/calendar_puzzle/systems/block_symbol.gd \
        games/calendar_puzzle/scenes/play_scene.gd \
        games/calendar_puzzle/systems/settings_resource.gd
git commit -m "feat(colorblind): 10 geometric symbols overlay on blocks (toggleable)"
```

---

## Task 7 — Light / Dark Theme 资源 + Theme Manager

**Files:**
- Create: `boot/theme/light_theme.tres`
- Create: `boot/theme/dark_theme.tres`
- Create: `boot/theme/theme_manager.gd`
- Modify: `boot/boot.gd`

- [ ] **Step 1: 在 Editor 创建 Theme resource（手工 UI 步骤）**

Editor 操作：

1. FileSystem → 右键 `boot/theme/` → New Resource → Theme → 保存 `light_theme.tres`
2. 双击打开 Theme Editor
3. Default Base Color → `#FAFAFA`（背景）
4. Default Font → 加载 `assets/fonts/Inter-Regular.ttf`（M4 已有），Size 14
5. 给以下 control type 设 StyleBoxFlat（按 spec § 视觉设计系统 亮色）：
   - Button: bg_color=#FFFFFF, fg_color=#1A1A1F, border=#E5E5E8 1px
   - Panel: bg_color=#FFFFFF, corner_radius=8
   - LineEdit: bg=#FFFFFF, fg=#1A1A1F, border=#E5E5E8
   - PanelContainer (Card): bg=#FFFFFF, shadow_size=4 shadow_color=rgba(0,0,0,0.06)
6. Save

重复创建 `dark_theme.tres`，颜色按 spec 暗色一栏：

- Default Base: #0F0F12
- Button bg: #1B1B20, fg: #F2F2F4, border: #2A2A30
- Panel: #1B1B20
- Card shadow: rgba(0,0,0,0.4)

- [ ] **Step 2: 写 theme_manager.gd**

`boot/theme/theme_manager.gd`:

```gdscript
# boot/theme/theme_manager.gd
# 切换全局 Theme（亮/暗）。autoload 入 ThemeManager。
extends Node

const LIGHT_PATH = "res://boot/theme/light_theme.tres"
const DARK_PATH = "res://boot/theme/dark_theme.tres"

enum Mode { LIGHT, DARK }

signal theme_changed(mode: Mode)

var _current: Mode = Mode.LIGHT
var _light: Theme
var _dark: Theme

func _ready() -> void:
    _light = load(LIGHT_PATH) as Theme
    _dark = load(DARK_PATH) as Theme
    assert(_light != null and _dark != null, "theme resources missing")

func apply(mode: Mode) -> void:
    _current = mode
    var theme = _light if mode == Mode.LIGHT else _dark
    get_tree().root.theme = theme
    theme_changed.emit(mode)

func toggle() -> void:
    apply(Mode.DARK if _current == Mode.LIGHT else Mode.LIGHT)

func get_current() -> Mode:
    return _current
```

- [ ] **Step 3: 注册 autoload**

`project.godot` 的 `[autoload]` 追加：

```ini
ThemeManager="*res://boot/theme/theme_manager.gd"
```

- [ ] **Step 4: boot 启动时按 SettingsResource 应用主题**

`boot/boot.gd` 末尾追加：

```gdscript
# theme
var theme_mode_str = settings.settings.theme_mode if settings else "light"
ThemeManager.apply(ThemeManager.Mode.DARK if theme_mode_str == "dark" else ThemeManager.Mode.LIGHT)
```

SettingsResource 加 `@export var theme_mode: String = "light"`。

- [ ] **Step 5: 写测试**

`tests/test_theme_switch.gd`:

```gdscript
extends "res://addons/gut/test.gd"

func test_theme_manager_loads_both_themes():
    var tm = get_node("/root/ThemeManager")
    assert_not_null(tm._light, "light_theme.tres 加载失败")
    assert_not_null(tm._dark, "dark_theme.tres 加载失败")

func test_apply_light_sets_root_theme():
    var tm = get_node("/root/ThemeManager")
    tm.apply(tm.Mode.LIGHT)
    assert_eq(get_tree().root.theme, tm._light)
    assert_eq(tm.get_current(), tm.Mode.LIGHT)

func test_apply_dark_sets_root_theme():
    var tm = get_node("/root/ThemeManager")
    tm.apply(tm.Mode.DARK)
    assert_eq(get_tree().root.theme, tm._dark)
    assert_eq(tm.get_current(), tm.Mode.DARK)

func test_toggle_flips_mode():
    var tm = get_node("/root/ThemeManager")
    tm.apply(tm.Mode.LIGHT)
    tm.toggle()
    assert_eq(tm.get_current(), tm.Mode.DARK)
    tm.toggle()
    assert_eq(tm.get_current(), tm.Mode.LIGHT)

func test_theme_changed_signal_fires():
    var tm = get_node("/root/ThemeManager")
    tm.apply(tm.Mode.LIGHT)
    var fired = [false, -1]
    tm.theme_changed.connect(func(mode):
        fired[0] = true
        fired[1] = mode
    )
    tm.apply(tm.Mode.DARK)
    assert_true(fired[0])
    assert_eq(fired[1], tm.Mode.DARK)
```

- [ ] **Step 6: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | grep test_theme_switch
```

Expected: 5 个测试 PASS。

- [ ] **Step 7: Commit**

```bash
git add boot/theme/ project.godot tests/test_theme_switch.gd boot/boot.gd \
        games/calendar_puzzle/systems/settings_resource.gd
git commit -m "feat(theme): light/dark Theme resources + ThemeManager autoload"
```

---

## Task 8 — SkinResource 类 + 3 个 .tres + SkinManager

**Files:**
- Create: `games/calendar_puzzle/skins/skin_resource.gd`
- Create: `games/calendar_puzzle/skins/board_palette.gd`
- Create: `games/calendar_puzzle/skins/default.tres`
- Create: `games/calendar_puzzle/skins/pastel.tres`
- Create: `games/calendar_puzzle/skins/mono_focus.tres`
- Create: `games/calendar_puzzle/systems/skin_manager.gd`

- [ ] **Step 1: 写 BoardPalette 资源类**

`games/calendar_puzzle/skins/board_palette.gd`:

```gdscript
# games/calendar_puzzle/skins/board_palette.gd
# 棋盘配色子资源（嵌在 SkinResource 里）
class_name BoardPalette extends Resource

@export var background: Color = Color("FAFAFA")    # 棋盘外背景
@export var board_bg: Color = Color("FFFFFF")      # 棋盘内底色
@export var grid_line: Color = Color("E5E5E8")     # 格线
@export var date_marker_bg: Color = Color("FEF3C7")# 日期标记格底色
@export var date_marker_fg: Color = Color("1A1A1F")# 日期标记文字
@export var disabled_cell: Color = Color("9B9BA3") # 不可放置格
```

- [ ] **Step 2: 写 SkinResource 类（spec 已定义；这是完整版）**

`games/calendar_puzzle/skins/skin_resource.gd`:

```gdscript
# games/calendar_puzzle/skins/skin_resource.gd
class_name SkinResource extends Resource

@export var id: String = "default"
@export var display_name: String = "Default"     # i18n key
@export var board_palette: BoardPalette
@export var block_colors: Array[Color] = []      # 必须 10 个，顺序 I/L/J/S/Z/P/Y/N/T/U
@export var block_symbols: Array[Texture2D] = [] # 可选 10 个；null 用默认
@export var particle_preset: PackedScene         # 可选
@export var thumbnail: Texture2D                 # 128×128

const REQUIRED_BLOCK_COUNT := 10
const BLOCK_ORDER := ["I", "L", "J", "S", "Z", "P", "Y", "N", "T", "U"]

func is_valid() -> bool:
    if id.is_empty():
        return false
    if board_palette == null:
        return false
    if block_colors.size() != REQUIRED_BLOCK_COUNT:
        return false
    return true

func get_color_for_block(block_id: String) -> Color:
    var idx := BLOCK_ORDER.find(block_id)
    if idx < 0 or idx >= block_colors.size():
        push_warning("[SkinResource] unknown block_id %s" % block_id)
        return Color.MAGENTA
    return block_colors[idx]
```

- [ ] **Step 3: 写 default.tres（spec 鲜艳 10 色）**

`games/calendar_puzzle/skins/default.tres`:

```
[gd_resource type="Resource" script_class="SkinResource" load_steps=4 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/skins/skin_resource.gd" id="1"]
[ext_resource type="Script" path="res://games/calendar_puzzle/skins/board_palette.gd" id="2"]

[sub_resource type="Resource" id="palette_default"]
script = ExtResource("2")
background = Color(0.980, 0.980, 0.980, 1)
board_bg = Color(1, 1, 1, 1)
grid_line = Color(0.898, 0.898, 0.910, 1)
date_marker_bg = Color(0.996, 0.953, 0.780, 1)
date_marker_fg = Color(0.102, 0.102, 0.122, 1)
disabled_cell = Color(0.608, 0.608, 0.639, 1)

[resource]
script = ExtResource("1")
id = "default"
display_name = "skin_name_default"
board_palette = SubResource("palette_default")
block_colors = Array[Color]([
    Color(0.937, 0.267, 0.267, 1),   ; I #EF4444
    Color(0.976, 0.451, 0.086, 1),   ; L #F97316
    Color(0.980, 0.800, 0.082, 1),   ; J #FACC15
    Color(0.518, 0.800, 0.086, 1),   ; S #84CC16
    Color(0.133, 0.773, 0.369, 1),   ; Z #22C55E
    Color(0.078, 0.722, 0.651, 1),   ; P #14B8A6
    Color(0.024, 0.714, 0.831, 1),   ; Y #06B6D4
    Color(0.231, 0.510, 0.965, 1),   ; N #3B82F6
    Color(0.545, 0.361, 0.965, 1),   ; T #8B5CF6
    Color(0.925, 0.282, 0.600, 1),   ; U #EC4899
])
```

- [ ] **Step 4: 写 pastel.tres（莫兰迪 10 色）**

10 个 pastel hex（莫兰迪低饱和度，与默认色相对应但去饱和度 + 提亮）：

```
I #D9A5A5   L #DDB89B   J #DCCB97   S #B5C49C   Z #9DC4A8
P #9CB8B3   Y #A5BFC4   N #A8B4CC   T #B7AACC   U #CDA8BD
```

`games/calendar_puzzle/skins/pastel.tres`:

```
[gd_resource type="Resource" script_class="SkinResource" load_steps=4 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/skins/skin_resource.gd" id="1"]
[ext_resource type="Script" path="res://games/calendar_puzzle/skins/board_palette.gd" id="2"]

[sub_resource type="Resource" id="palette_pastel"]
script = ExtResource("2")
background = Color(0.965, 0.957, 0.945, 1)
board_bg = Color(0.984, 0.980, 0.972, 1)
grid_line = Color(0.882, 0.875, 0.863, 1)
date_marker_bg = Color(0.875, 0.835, 0.788, 1)
date_marker_fg = Color(0.298, 0.275, 0.243, 1)
disabled_cell = Color(0.745, 0.725, 0.700, 1)

[resource]
script = ExtResource("1")
id = "pastel"
display_name = "skin_name_pastel"
board_palette = SubResource("palette_pastel")
block_colors = Array[Color]([
    Color(0.851, 0.647, 0.647, 1),   ; I #D9A5A5
    Color(0.867, 0.722, 0.608, 1),   ; L #DDB89B
    Color(0.863, 0.796, 0.592, 1),   ; J #DCCB97
    Color(0.710, 0.769, 0.612, 1),   ; S #B5C49C
    Color(0.616, 0.769, 0.659, 1),   ; Z #9DC4A8
    Color(0.612, 0.722, 0.702, 1),   ; P #9CB8B3
    Color(0.647, 0.749, 0.769, 1),   ; Y #A5BFC4
    Color(0.659, 0.706, 0.800, 1),   ; N #A8B4CC
    Color(0.718, 0.667, 0.800, 1),   ; T #B7AACC
    Color(0.804, 0.659, 0.741, 1),   ; U #CDA8BD
])
```

- [ ] **Step 5: 写 mono_focus.tres（灰阶 + 单 accent）**

10 个 grayscale + 一个 accent（#4F46E5 主色）。这里 10 块全用同一 accent，靠符号区分；棋盘背景纯黑 / 纯白：

```
I-U 全部 #2A2A30（深灰），accent 高亮当前选中块为 #4F46E5
```

为了让"未选中"块也能区分（依靠符号），实际 colors 给一个递增灰度也可。本 plan 走"全等灰 + 符号区分"，方块 colors 全部相同：

`games/calendar_puzzle/skins/mono_focus.tres`:

```
[gd_resource type="Resource" script_class="SkinResource" load_steps=4 format=3]

[ext_resource type="Script" path="res://games/calendar_puzzle/skins/skin_resource.gd" id="1"]
[ext_resource type="Script" path="res://games/calendar_puzzle/skins/board_palette.gd" id="2"]

[sub_resource type="Resource" id="palette_mono"]
script = ExtResource("2")
background = Color(0.059, 0.059, 0.071, 1)        ; #0F0F12
board_bg = Color(0.106, 0.106, 0.125, 1)          ; #1B1B20
grid_line = Color(0.165, 0.165, 0.188, 1)         ; #2A2A30
date_marker_bg = Color(0.310, 0.275, 0.898, 1)    ; #4F46E5 accent
date_marker_fg = Color(0.949, 0.949, 0.953, 1)
disabled_cell = Color(0.243, 0.243, 0.275, 1)

[resource]
script = ExtResource("1")
id = "mono_focus"
display_name = "skin_name_mono_focus"
board_palette = SubResource("palette_mono")
block_colors = Array[Color]([
    Color(0.30, 0.30, 0.33, 1),   ; I
    Color(0.34, 0.34, 0.38, 1),   ; L
    Color(0.38, 0.38, 0.42, 1),   ; J
    Color(0.42, 0.42, 0.47, 1),   ; S
    Color(0.46, 0.46, 0.51, 1),   ; Z
    Color(0.50, 0.50, 0.55, 1),   ; P
    Color(0.54, 0.54, 0.60, 1),   ; Y
    Color(0.58, 0.58, 0.64, 1),   ; N
    Color(0.62, 0.62, 0.68, 1),   ; T
    Color(0.66, 0.66, 0.72, 1),   ; U
])
```

> "区分"靠递增灰度 (0.30→0.66) + 符号叠加；accent 色由 SkinManager 通过 selected-block 高亮 highlight 使用。

- [ ] **Step 6: 写 SkinManager**

`games/calendar_puzzle/systems/skin_manager.gd`:

```gdscript
# games/calendar_puzzle/systems/skin_manager.gd
# autoload；启动时扫描 skins/*.tres，可切换并广播 current_skin_changed。
extends Node

const SKINS_DIR = "res://games/calendar_puzzle/skins/"

signal current_skin_changed(skin: SkinResource)

var _skins_by_id: Dictionary = {}    # id → SkinResource
var _current: SkinResource = null

func _ready() -> void:
    _scan_skins()

func _scan_skins() -> void:
    var dir := DirAccess.open(SKINS_DIR)
    if dir == null:
        push_error("[SkinManager] cannot open " + SKINS_DIR)
        return
    dir.list_dir_begin()
    var name := dir.get_next()
    while name != "":
        if name.ends_with(".tres") and not name.begins_with("."):
            var skin := load(SKINS_DIR + name) as SkinResource
            if skin and skin.is_valid():
                _skins_by_id[skin.id] = skin
            else:
                push_warning("[SkinManager] skip invalid skin: " + name)
        name = dir.get_next()
    print("[SkinManager] loaded %d skins: %s" % [_skins_by_id.size(), _skins_by_id.keys()])

func list_skins() -> Array[SkinResource]:
    var out: Array[SkinResource] = []
    for k in _skins_by_id.keys():
        out.append(_skins_by_id[k])
    return out

func get_by_id(id: String) -> SkinResource:
    return _skins_by_id.get(id, null)

func apply(skin_id: String) -> bool:
    var skin: SkinResource = _skins_by_id.get(skin_id, null)
    if skin == null:
        push_warning("[SkinManager] unknown skin id: " + skin_id)
        return false
    _current = skin
    current_skin_changed.emit(skin)
    return true

func get_current() -> SkinResource:
    return _current
```

- [ ] **Step 7: 注册 autoload**

`project.godot` 的 `[autoload]` 追加：

```ini
SkinManager="*res://games/calendar_puzzle/systems/skin_manager.gd"
```

- [ ] **Step 8: boot 启动时按 settings.current_skin_id 应用**

`boot/boot.gd` 末尾追加：

```gdscript
var skin_id = settings.settings.current_skin_id if settings else "default"
SkinManager.apply(skin_id)
```

- [ ] **Step 9: 写测试**

`tests/test_skin_manager.gd`:

```gdscript
extends "res://addons/gut/test.gd"

func test_skin_manager_loads_3_presets():
    var sm = get_node("/root/SkinManager")
    var skins = sm.list_skins()
    assert_eq(skins.size(), 3, "应该加载 3 个预置皮肤，实际 %d" % skins.size())
    var ids = []
    for s in skins:
        ids.append(s.id)
    assert_true("default" in ids)
    assert_true("pastel" in ids)
    assert_true("mono_focus" in ids)

func test_each_skin_has_10_block_colors():
    var sm = get_node("/root/SkinManager")
    for s in sm.list_skins():
        assert_eq(s.block_colors.size(), 10, \
            "皮肤 %s block_colors 应该 10 个，实际 %d" % [s.id, s.block_colors.size()])

func test_apply_changes_current_and_fires_signal():
    var sm = get_node("/root/SkinManager")
    var fired = [null]
    sm.current_skin_changed.connect(func(skin): fired[0] = skin)

    var ok = sm.apply("pastel")
    assert_true(ok)
    assert_eq(sm.get_current().id, "pastel")
    assert_not_null(fired[0])
    assert_eq(fired[0].id, "pastel")

func test_apply_unknown_returns_false():
    var sm = get_node("/root/SkinManager")
    var ok = sm.apply("nonexistent")
    assert_false(ok)

func test_get_color_for_block_returns_expected():
    var sm = get_node("/root/SkinManager")
    sm.apply("default")
    var c = sm.get_current().get_color_for_block("I")
    # default I = #EF4444
    assert_almost_eq(c.r, 0.937, 0.01)
    assert_almost_eq(c.g, 0.267, 0.01)
    assert_almost_eq(c.b, 0.267, 0.01)
```

- [ ] **Step 10: 跑测试**

```bash
godot --headless --script tests/run_tests.gd 2>&1 | grep test_skin
```

Expected: 5 个 PASS。

- [ ] **Step 11: Commit**

```bash
git add games/calendar_puzzle/skins/ \
        games/calendar_puzzle/systems/skin_manager.gd \
        project.godot \
        boot/boot.gd \
        tests/test_skin_manager.gd
git commit -m "feat(skin): SkinResource + SkinManager + 3 presets (default/pastel/mono_focus)"
```

---

## Task 9 — render_skin_thumbnails 工具生成 128×128 缩略图

**Files:**
- Create: `tools/render_skin_thumbnails.gd`
- Create: `games/calendar_puzzle/skins/thumbnails/{default,pastel,mono_focus}.png`

- [ ] **Step 1: 写离线渲染脚本**

`tools/render_skin_thumbnails.gd`:

```gdscript
# tools/render_skin_thumbnails.gd
# 离线渲染：根据 skin 的 10 色生成 128×128 PNG 缩略图。
# 布局：5×2 网格，每格 24×24 + 4px 间隙，外加 8px 边框。
# 跑法: godot --headless --script tools/render_skin_thumbnails.gd
extends SceneTree

const OUTPUT_DIR = "res://games/calendar_puzzle/skins/thumbnails/"
const THUMB_SIZE := Vector2i(128, 128)
const COLS := 5
const ROWS := 2
const CELL_SIZE := Vector2i(20, 20)
const CELL_GAP := 4
const PADDING := 8

func _init() -> void:
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))

    var sm = load("res://games/calendar_puzzle/systems/skin_manager.gd").new()
    add_child(sm)
    sm._scan_skins()  # autoload _ready 不跑，手动调

    for skin in sm.list_skins():
        var img = _render_skin(skin)
        var out_path = OUTPUT_DIR + skin.id + ".png"
        var err = img.save_png(ProjectSettings.globalize_path(out_path))
        if err == OK:
            print("✓ %s → %s" % [skin.id, out_path])
        else:
            push_error("save_png failed for %s: %s" % [skin.id, err])

    quit(0)

func _render_skin(skin) -> Image:
    var img = Image.create(THUMB_SIZE.x, THUMB_SIZE.y, false, Image.FORMAT_RGBA8)
    img.fill(skin.board_palette.background)

    # 画 board_bg 圆角矩形外框（简化为矩形）
    var inner = Rect2i(Vector2i(PADDING, PADDING), THUMB_SIZE - Vector2i(PADDING*2, PADDING*2))
    img.fill_rect(inner, skin.board_palette.board_bg)

    # 画 10 个色块
    for i in range(10):
        var row = i / COLS
        var col = i % COLS
        var origin = Vector2i(
            PADDING + 8 + col * (CELL_SIZE.x + CELL_GAP),
            PADDING + 8 + row * (CELL_SIZE.y + CELL_GAP)
        )
        img.fill_rect(Rect2i(origin, CELL_SIZE), skin.block_colors[i])

    return img
```

- [ ] **Step 2: 跑脚本**

```bash
godot --headless --script tools/render_skin_thumbnails.gd
```

Expected:
```
✓ default → res://games/calendar_puzzle/skins/thumbnails/default.png
✓ pastel → res://games/calendar_puzzle/skins/thumbnails/pastel.png
✓ mono_focus → res://games/calendar_puzzle/skins/thumbnails/mono_focus.png
```

校验：

```bash
ls -lh games/calendar_puzzle/skins/thumbnails/*.png
file games/calendar_puzzle/skins/thumbnails/default.png
```

Expected: 3 个 PNG，每个 ~1-5KB，128×128 像素。

- [ ] **Step 3: 在每个 .tres 里设置 thumbnail 字段**

修改 3 个 .tres 文件，在末尾的 `[resource]` 段加：

```
thumbnail = ExtResource("3")
```

并在文件顶 ext_resource 加：

```
[ext_resource type="Texture2D" path="res://games/calendar_puzzle/skins/thumbnails/default.png" id="3"]
```

（每个文件用对应的 png 路径）

- [ ] **Step 4: 手测：在 Settings UI 看到 3 个皮肤的预览图**

启动游戏 → 设置 → 皮肤 → 看到 3 张 128×128 缩略图。

- [ ] **Step 5: Commit**

```bash
git add tools/render_skin_thumbnails.gd \
        games/calendar_puzzle/skins/thumbnails/ \
        games/calendar_puzzle/skins/*.tres
git commit -m "feat(skin): 128x128 PNG thumbnails generated via render tool"
```

---

## Task 10 — 在 play_scene 接入皮肤变化 + 玩法动画

**Files:**
- Modify: `games/calendar_puzzle/scenes/play_scene.gd`
- Modify: `games/calendar_puzzle/scenes/play_scene.tscn`

- [ ] **Step 1: play_scene 订阅 SkinManager.current_skin_changed**

`games/calendar_puzzle/scenes/play_scene.gd` 节选：

```gdscript
func _ready() -> void:
    # ... 已有逻辑
    SkinManager.current_skin_changed.connect(_on_skin_changed)
    _apply_skin(SkinManager.get_current())

func _on_skin_changed(skin: SkinResource) -> void:
    _apply_skin(skin)

func _apply_skin(skin: SkinResource) -> void:
    if skin == null:
        return
    # 重渲染棋盘背景
    $BoardBackground.color = skin.board_palette.board_bg
    # 重渲染所有已放置 block 颜色
    for block_node in $BlocksContainer.get_children():
        var bid = block_node.get_meta("block_id")
        var rect = block_node.get_node("Rect") as ColorRect
        rect.color = skin.get_color_for_block(bid)
    # 重画日期 marker bg / fg
    $DateMarker.color = skin.board_palette.date_marker_bg
    $DateMarker.font_color = skin.board_palette.date_marker_fg
```

- [ ] **Step 2: 给方块放置 / 移除加 tween 动画**

在 `_place_block(block, pos)` 中：

```gdscript
const UIEasing = preload("res://shared/ui/easing.gd")

func _place_block(block: Block, target_pos: Vector2) -> void:
    var node = _create_block_visual(block.id, target_pos)
    $BlocksContainer.add_child(node)
    # 入场动画
    node.scale = Vector2(1.15, 1.15)
    node.modulate.a = 0.0
    var tw = node.create_tween().set_parallel(true)
    tw.tween_property(node, "scale", Vector2.ONE, UIEasing.DURATION_BLOCK_PLACE) \
      .set_trans(UIEasing.PLACE_TRANS).set_ease(UIEasing.PLACE_EASE)
    tw.tween_property(node, "modulate:a", 1.0, UIEasing.DURATION_BLOCK_PLACE) \
      .set_trans(UIEasing.PLACE_TRANS).set_ease(UIEasing.PLACE_EASE)

    AudioPlayer.play_sfx("place")

func _remove_block(node: Node2D) -> void:
    var tw = node.create_tween().set_parallel(true)
    tw.tween_property(node, "scale", Vector2(0.8, 0.8), UIEasing.DURATION_BLOCK_REMOVE) \
      .set_trans(UIEasing.REMOVE_TRANS).set_ease(UIEasing.REMOVE_EASE)
    tw.tween_property(node, "modulate:a", 0.0, UIEasing.DURATION_BLOCK_REMOVE) \
      .set_trans(UIEasing.REMOVE_TRANS).set_ease(UIEasing.REMOVE_EASE)
    tw.finished.connect(func(): node.queue_free())

    AudioPlayer.play_sfx("remove")
```

旋转、镜像类似，加 rotation tween。

- [ ] **Step 3: 菜单切换动画**

`boot/main_menu/main_menu.gd` 或 settings_panel 转场用：

```gdscript
const UIEasing = preload("res://shared/ui/easing.gd")

func transition_to(scene_path: String) -> void:
    var tw = create_tween()
    tw.tween_property(self, "modulate:a", 0.0, UIEasing.DURATION_MENU_TRANSITION) \
      .set_trans(UIEasing.MENU_TRANS).set_ease(UIEasing.MENU_EASE)
    tw.finished.connect(func(): get_tree().change_scene_to_file(scene_path))
```

- [ ] **Step 4: 手测：换皮肤 + 动画感**

启动游戏：

1. 进 settings → skin → 切换 default ↔ pastel ↔ mono_focus → 棋盘 + 方块颜色立即变
2. 进 play → 放块看到入场动画
3. 拾起 / 移除看到出场动画
4. 切换菜单看到淡入淡出

- [ ] **Step 5: Commit**

```bash
git add games/calendar_puzzle/scenes/ boot/main_menu/
git commit -m "feat(playscene): live skin switching + place/remove animations + audio"
```

---

## Self-Review

按 writing-plans 自审清单走一遍：

**1. Spec coverage**: M9 spec 验收门槛 7 项全覆盖：
- ✅ 16 UI 组件 + example + 单测 → Task 2 + Task 3
- ✅ 动画系统（place/remove/menu） → Task 1 (easing) + Task 10 (集成)
- ✅ 10 SFX + 2 BGM 集成 + 音量从 SettingsResource → Task 4 (下载) + Task 5 (AudioPlayer)
- ✅ 10 色盲符号 + 设置开关 → Task 6
- ✅ Light/Dark Theme 切换 → Task 7
- ✅ 3 SkinResource + thumbnails → Task 8 + Task 9
- ✅ test_skin_manager + test_audio_player + test_theme_switch → Task 5/7/8 各自 step

**2. Placeholder scan**: CREDITS.md 里 `<作者> / <URL>` 是预期用户下载时填写的位置（不能 plan 阶段确定）；其他无 TBD。

**3. Type consistency**: SkinResource 的 BLOCK_ORDER `["I","L","J","S","Z","P","Y","N","T","U"]` 在 default/pastel/mono_focus.tres + skin_manager + block_symbol 的 SYMBOL_INDEX 一致；`SkinManager.current_skin_changed(skin: SkinResource)` 签名在 Task 8 + Task 10 订阅一致；`AudioPlayer.play_sfx(name: String)` 在 Task 5 定义 + Task 10 调用一致。

**4. Ambiguity**: 音频下载是人工流程；Task 4 给了具体 freesound / Pixabay 搜索关键词与筛选标准但不能 100% 决定哪个候选最终入选；这是接受的。SVG 符号自画方案选简单几何，确保不依赖 AI 绘图。

无发现要修。M9 plan 完工。

---

## Execution Handoff

按 user CLAUDE.md 默认偏好（subagent-driven）。

并行化建议：

- **Week 1**：Task 1 (easing) + Task 2 (16 组件，可拆 2-3 个 agent 分别做 4-6 个组件) + Task 4 Step 1 (download_audio_assets.md)
- **Week 2**：Task 3 (smoke test) + Task 5 (AudioPlayer 集成) + Task 6 (色盲符号) + Task 7 (Theme)
- **Week 3**：Task 8 (Skin) + Task 9 (thumbnails) + Task 10 (集成到 play_scene)
- **Week 3-3.5**：手测 + 微调（颜色、动画时长、音量平衡）

音频下载 Task 4 Step 2 异步进行，与组件库开发并行。如果 freesound 找不到合意素材，可砍范围（用 5 SFX 而非 10），但优先保证 place/rotate/win/error/ui_click 5 个核心音。

R7 (美术质量) 缓解：M9 完成后**主动找 1-2 个朋友盲测视觉**，收反馈再微调；若反馈普遍差，仍可 M10 阶段补救。
