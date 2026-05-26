# Godot Steam 移植 — Phase 1（Calendar Puzzle 单游戏 MVP）

Date: 2026-05-26
Status: approved
Scope: 全新独立项目 `calendar-puzzle-godot/`（与现有 Python / React / 微信小游戏三端并列，不互相依赖）
Phase: 1 of 3（Phase 2 = DLC 内容包；Phase 3 = 合集 Hub 改造，均另立 spec）

## Background

Calendar Puzzle 当前有三个部署目标：Python solver + Flask API、React web 客户端、Taro 微信小游戏。微信小游戏版（约 6.3k 行 JS + 8 个云函数）功能最完整，覆盖体力/券/社交/3 槽存档/5 难度/教程。本 spec 设计**第四个独立部署目标**：Steam 桌面端，用 Godot 4 实现。

## Goal

把 Calendar Puzzle 上架 Steam，定价付费一次买断，覆盖 Win/Mac/Linux/Steam Deck 四平台，2027 Q1 发布。本 Phase 1 只做"单游戏 MVP"，但**架构上为未来塞进合集 Hub 留接口**（Phase 3 改造时游戏模块零修改）。

DLC 内容包（Phase 2）和合集 Hub（Phase 3）在 Phase 1 上架并验证市场后另起 brainstorm。

## Locked decisions（澄清问答凝结）

| # | 决策 | 出处 |
|---|---|---|
| 1 | 定位 = 一次买断付费 + 后续 DLC 主题包模式；非 F2P | Q1=B |
| 2 | Phase 1 只做单游戏 MVP，引擎边界设计成 Hub-ready；不在本 spec 内做 Hub / DLC | Q3=A |
| 3 | 砍掉所有 F2P 机制：体力 / 券 / 社交 / 助力 / 所有微信云函数 | Q4 |
| 4 | 保留 3 档提示**状态机**（沿用 hint.js 设计），但 UI 只露 weak；medium/strong 入口隐藏，留作后续平衡测试 | Q4 + 用户补充 |
| 5 | 弱提示上限：普通难度 3 次/题，失眠模式 5 次/题 | 用户补充 |
| 6 | "每日题" + "日历模式" 都做；预生成 2020-01-01 到 2035-12-31 全量题面到 `daily_puzzles.tres`，玩家本地查表，零后端零网络 | Q5=C 修订 |
| 7 | 排行榜 Phase 1 不做；Phase 2/3 再评估接 Steam Leaderboard API | B4 |
| 8 | 首发四平台：Windows / macOS / Linux / Steam Deck | Q6=C |
| 9 | 美术风格 = 极简扁平 + 鲜艳色块；商店物料全部自己（含 AI 辅助）出图，零外包预算 | Q7=b |
| 10 | 音频 = 2 首 royalty-free BGM + 10 个 freesound SFX；预算 $0 | Q8a=b |
| 11 | i18n = 简中（主）+ 繁中（OpenCC + 微调）+ English（自译） | Q8b=iii |
| 12 | 工期 = 8 个月，目标 2027 Q1 上架；单人业余开发（2.5h 工作日 + 4h 周末单日，月预算 ~85h） | Q9=B |
| 13 | 架构方案 = 方案 2（纯 GDScript + GameModule 接口隔离） | 用户选 |
| 14 | Steam SDK = GodotSteam（社区维护，最成熟） | Q10a=α |
| 15 | 存档格式 = Godot 原生二进制 `.tres` | Q10b=β |
| 16 | 题库 `pack_free.js` 转 `pack_free.tres` 直接打包进 `.pck`，不走 CDN | Q10c=α |

## Architecture

### 项目目录

```
calendar-puzzle-godot/
├── boot/                                # 启动 + 平台层 + 主菜单（未来替换为 hub）
│   ├── boot.gd                          # 入口：init Steam → load GameModule → 注入 deps
│   ├── main_menu/                       # 标题界面：开始 / 继续 / 设置 / 退出 / 成就
│   ├── settings/                        # 设置面板：音量 / 全屏 / 主题 / 语言 / 重置
│   ├── platform/
│   │   ├── steam_platform.gd            # GodotSteam wrapper（成就/云存档/语言检测）
│   │   ├── save_adapter.gd              # SaveAdapter 实现（.tres + Steam Cloud 双写）
│   │   └── input_router.gd              # InputContext 实现（鼠键 / 手柄 / 触屏统一）
│   └── theme/                           # 全局主题资源（颜色 / 字体 / 控件样式）
├── games/
│   └── calendar_puzzle/                 # 游戏模块 — Phase 3 hub 化时整包搬走
│       ├── manifest.tres                # GameManifest（id/name/version/icon）
│       ├── game.gd                      # 实现 GameModule interface（入口）
│       ├── scenes/
│       │   ├── play_scene.tscn          # 主玩法（棋盘 / 方块 / HUD / 提示）
│       │   ├── select_scene.tscn        # 难度 + 日历选题
│       │   └── win_scene.tscn           # 胜利总结
│       ├── solver/
│       │   ├── dlx.gd                   # 翻译自 minigame/js/dlx.js
│       │   ├── puzzle_generator.gd      # 翻译自 puzzleGenerator.js
│       │   ├── board.gd                 # 翻译自 board.js
│       │   ├── pack_free.tres           # 3M 预生成题库（一次性脚本转换）
│       │   └── daily_puzzles.tres       # 5800 天 × 5 难度的预解算结果
│       ├── systems/
│       │   ├── hint_state.gd            # 3 档提示状态机（UI 只露 weak）
│       │   ├── progress_tracker.gd      # PB / 胜利组合 / 失眠唯一解
│       │   └── slot_manager.gd          # 自动存档 + 3 手动槽
│       └── assets/                      # 该游戏专属（图标 / 音效 / 主题覆盖）
├── shared/                              # 跨游戏复用（Phase 3 hub 直接用）
│   ├── ui/                              # Button / Modal / Toast / Slider / Calendar 等 ~15 个
│   ├── input/                           # InputContext 接口定义
│   ├── save/                            # SaveAdapter 接口定义
│   └── i18n/                            # 翻译加载器
├── translations/                        # zh_CN.po / zh_TW.po / en.po
├── tools/
│   ├── convert_pack.gd                  # pack_free.js → pack_free.tres
│   ├── precompute_daily.gd              # 全量预生成 daily_puzzles.tres
│   ├── solver_benchmark.gd              # 性能基准测试
│   └── build_all.sh                     # 4 平台构建脚本
└── tests/                               # GUT 单元 + scene 集成
```

**模块边界硬约束**：`games/calendar_puzzle/` 内任何文件**不许直接引用** `boot/` 内类，只能通过 `GameDeps` 拿能力。Phase 3 加 hub 时替换 boot 即可，games/* 零改动。

### GameModule 接口

```gdscript
# shared/game_module.gd
class_name GameModule extends Resource

func start(deps: GameDeps) -> Node:
    push_error("override me")
    return null

func get_manifest() -> GameManifest:
    push_error("override me")
    return null
```

```gdscript
# shared/game_deps.gd
class_name GameDeps extends RefCounted
var save: SaveAdapter          # 读写存档（按 manifest.id 分目录）
var input: InputContext        # 统一输入事件流
var i18n: TranslationContext   # tr() 包装
var platform: PlatformBus      # 解锁成就 / Rich Presence / Cloud sync trigger
var on_exit: Callable          # 退出游戏回主菜单的回调
```

### 数据流

```
玩家输入 → InputRouter（boot/）→ InputContext.event signal
                                            ↓
                            play_scene（games/calendar_puzzle/）接收
                                            ↓
                            puzzle_state 更新（放置/旋转/移除）
                                            ↓
                  提示请求 → hint_state → solver.find_weak_hint() → 坐标
                                            ↓
                  5s 节流 → slot_manager → SaveAdapter.write(payload)
                                            ↓
                            SaveAdapter 写本地 .tres + Steam Cloud 同步
                                            ↓
                  胜利 → progress_tracker → PlatformBus.unlock("first_win")
```

## Game systems

### 功能矩阵

| 模块 | 行为 | 实现来源 |
|---|---|---|
| 核心拖放 | 鼠标/手柄/触屏放置；预览 ghost；R 旋转 / F 镜像；双击移除 | 重写 |
| 5 难度 | easy(3) / medium(5) / hard(7) / expert(9) / insomnia(10) digCount | 翻译 `puzzleGenerator.js` |
| 教程 | 5 步（目标 → 锁块 → 放置 → 移除 → 完成），可跳过 | 重写 |
| 当日题 | 按本地日期查 `daily_puzzles.tres` | 新增 |
| 日历选题 | 翻日历选 2020-01-01 到 2035-12-31 任意日期 | 新增 UI |
| 随机换题 | 同难度内换题；`played_combos` 防重 | 翻译 `progress.js` |
| 提示系统 | 3 档状态机（weak 3 次 / insomnia 5 次，medium 3 次 / strong 1 次），**UI 仅露 weak** | 翻译 `hint.js` |
| 自动保存 | 5s 节流 + 切场景/关闭立即写；单文件 | 新写 |
| 手动存档 | 3 槽（命名 + 缩略图 + 时间戳） | 简化自 `slotStore.js` |
| 个人最佳 | 每难度/每日期记最快时间 | 翻译 `progress.js` |
| 胜利组合 | 按难度记录已胜组合 index | 翻译 `progress.js` |
| 失眠唯一解 | 失眠模式每题独特解集（board key 去重） | 翻译 `progress.js` |
| Steam 成就 | 见下 | 新增 |
| 设置面板 | 音量 / 全屏 / 主题 / 语言 / 重置 | 新增 |

**砍掉**：体力、券、所有社交、所有微信云函数。

### 求解器移植

| 来源 | 目标 | 行数估 | 备注 |
|---|---|---|---|
| `minigame/js/dlx.js` (147) | `solver/dlx.gd` | ~180 | 算法不变；Array 1:1 |
| `minigame/js/puzzleGenerator.js` (616) | `solver/puzzle_generator.gd` | ~700 | RNG 换 `RandomNumberGenerator`（按 seed 可复现） |
| `minigame/js/board.js` (192) | `solver/board.gd` | ~220 | 网格常量、方块定义、坐标转换 |
| `minigame/js/hint.js` (346) | `systems/hint_state.gd` | ~400 | 3 档状态机；UI 层只绑定 weak |
| `minigame/js/pack_free.js` (3M data) | `solver/pack_free.tres` | — | `tools/convert_pack.gd` 一次性转换 |

**性能预估**（基于 JS 实测 247ms 解 877 解）：

- GDScript 通常比 V8 慢 2-5×
- 失眠求解：估 0.5-1.2s（仅生成新题时跑一次，可显示 loading）
- 弱提示求解：< 100ms（找单个有效放置，剪枝早）
- 其它难度：< 50ms

**M1 必须跑 `solver_benchmark.gd`** 给出 10 天 × 5 难度真实耗时；如果失眠超 3s，回头看 R4 缓解方案。

### 每日题与日历模式（零后端方案）

```
玩家选日期（含"今天"快捷入口）
        ↓
DailyPuzzleTable.lookup(date, difficulty)  ← 查 daily_puzzles.tres
        ↓
返回 { seed, combo_index }
        ↓
PuzzleGenerator.from_seed(seed, combo_index)
        ↓
完全离线生成棋盘 + dig
```

`daily_puzzles.tres` 由 `tools/precompute_daily.gd` 在开发期一次性跑出（5800 天 × 5 难度 = 29k 条记录，每条 ~30 字节，~1MB 数据）。生成预算由 M1 benchmark 推导，小时级（< 24h）接受。

**"今日同题"**：所有玩家查同一行 → 天然同步，无需服务器、零运营成本。日历范围超出 2035 时出 DLC 同步刷新表。

### 提示系统设计

沿用 `hint.js` 的 3 档状态机不变：

- **Weak**: 高亮一个可放置的空格（每题最多 3 次；失眠 5 次）
- **Medium**: 高亮一个可放置的方块（每题最多 3 次）
- **Strong**: 直接落下一个方块并锁定（每题最多 1 次）

Phase 1 UI 只渲染 weak 按钮；medium/strong 通过开发者控制台启用，留做后续平衡测试。代码完整保留，不浪费已有 600+ 行成熟逻辑。

## Platform integration

### Steam SDK（GodotSteam）

| 功能 | Phase 1 | 备注 |
|---|---|---|
| 成就 | ✅ | ~20 个（草案见下） |
| Cloud Save | ✅ | 自动同步 `user://saves/` |
| Rich Presence | ✅ | "正在玩 Hard 模式"等 |
| 语言检测 | ✅ | 按 Steam 语言切 zh-CN / zh-TW / en |
| Overlay | ✅ | 用 borderless windowed 不阻 overlay |
| Workshop | ❌ Phase 2 评估 | 玩家自定义题库 |
| 排行榜 | ❌ Phase 2 评估 | Steam Leaderboard API 直连 |

**成就草案**（~20 个）：

- **入门**：通关第一题 / 解开 10 题 / 解开 100 题
- **难度征服**：每个难度首次通关（×5）
- **时间挑战**：easy 3 分钟内 / medium 5 分钟内 / hard 8 分钟内
- **失眠王**：失眠模式累计 100 题 / 唯一解收集 50 个
- **日历完美**：连续 7 天 / 连续 30 天 / 某历史年份全月份
- **隐藏**：不用提示通关失眠 / 一次旋转镜像都不用通关 hard

具体阈值（"3 分钟"）在 M3 数据全跑出来后定，写进 M6 成就实现。

### 存档结构

```
user://saves/                            # Steam Cloud 整目录同步
├── profile.tres                         # 玩家档案
│   ├── settings: SettingsResource       # 音量 / 全屏 / 主题 / 语言
│   ├── progress: ProgressResource       # PB / 胜利组合 / 失眠唯一解
│   ├── tutorial_done: bool
│   └── stats: StatsResource             # 总时长 / 题数
├── autosave.tres                        # 自动存档（5s 节流）
│   └── snapshot: GameSnapshot           # 当前 puzzle + 块状态 + 提示状态 + 计时
└── slots/
    ├── slot_0.tres                      # 手动槽 1
    ├── slot_1.tres                      # 手动槽 2
    └── slot_2.tres                      # 手动槽 3
        ├── snapshot: GameSnapshot
        ├── slot_name: String
        ├── thumbnail: Image (64×64)
        └── saved_at: int (unix ts)
```

冲突解决：`saved_at` newer-wins（Steam Cloud LWW，无需手写）。配额：每文件 ≤ 1MB（实际 < 50KB），Steam Cloud 100MB 免费配额够用。

### 多平台构建矩阵

| 平台 | 输出 | 测试要点 |
|---|---|---|
| Windows x86_64 | `.exe` + .pck | Win 10 / 11；OneDrive 同步 user 目录可能与 Steam Cloud 打架 |
| macOS Universal | `.app` + .pck | Apple 公证（Developer ID + notarytool，$99/年）；Apple Silicon + Intel 双架构 |
| Linux x86_64 | `.x86_64` + .pck | glibc 兼容；Wayland vs X11 |
| Steam Deck | 同 Linux 构建 | Steam Deck Verified 申请；手柄 / UI ≥ 8mm / 7" 屏可读 / Cloud Save |

### 输入抽象层

```gdscript
class_name InputContext

signal pointer_pressed(pos: Vector2)
signal pointer_released(pos: Vector2)
signal pointer_moved(pos: Vector2)
signal action_triggered(action: String)   # "rotate" / "mirror" / "hint" / "undo" / "menu"
signal cursor_moved(delta: Vector2)        # 手柄左摇杆模拟光标

func get_pointer_position() -> Vector2: ...
func is_action_held(action: String) -> bool: ...
```

实现层（`boot/platform/input_router.gd`）适配到：

- **鼠键**：左键 = pointer，R/F = action
- **手柄**：A = pointer_pressed at cursor，左摇杆 = cursor_moved，RB/LB = rotate/mirror
- **触屏（Deck / 未来 mobile）**：触摸事件 = pointer
- **Steam Deck trackpad**：经 Steam Input 自动当鼠标处理

**模块边界硬约束**：游戏代码永远只处理 `InputContext` signals，绝不直接监听 `InputEvent`。

## Visual / Audio / i18n

### 视觉设计系统

**色板**

```
亮色（默认）                  暗色
背景 #FAFAFA                  背景 #0F0F12
卡片 #FFFFFF                  卡片 #1B1B20
主文字 #1A1A1F                主文字 #F2F2F4
次文字 #6B6B73                次文字 #9B9BA3
分隔线 #E5E5E8                分隔线 #2A2A30
强调主色 #4F46E5              强调主色 #818CF8
成功 #16A34A                  成功 #22C55E
警告 #EAB308                  警告 #FACC15
错误 #DC2626                  错误 #F87171
```

**10 种方块配色**（提饱和度版小游戏色相）：

```
I #EF4444   L #F97316   J #FACC15   S #84CC16   Z #22C55E
P #14B8A6   Y #06B6D4   N #3B82F6   T #8B5CF6   U #EC4899
```

**色盲友好**：每方块除颜色外加一个小几何符号（10 种不同），不依赖纯色辨别。

**字体**（全部打包，避免依赖系统字体）

| 用途 | 字体 | 许可 |
|---|---|---|
| UI 数字 / 计时 | JetBrains Mono | 开源 |
| 中文 UI | Source Han Sans（Regular / Medium / Bold） | Adobe 开源 |
| 英文 UI | Inter（Regular / Medium / Bold） | Google Fonts |
| 标题装饰 | Fraunces | Google Fonts |

**组件库**（`shared/ui/`，~15 个）：Button / IconButton / Card / Modal / Toast / Slider / Switch / TabBar / Tooltip / ProgressBar / NumberStepper / DropdownMenu / Calendar（日历选题用）/ Thumbnail / Avatar。

每个组件配套 `shared/ui/examples/<name>_example.tscn` 与最小单元测试。

### 音频

| 类别 | 数量 | 来源 | 成本 |
|---|---|---|---|
| BGM | 2 首循环 | Pixabay Music / FMA（CC0/CC-BY） | $0 |
| SFX 放置 / 旋转 / 镜像 / 移除 / 提示 / 胜利 / 错误 / UI 点击 / 成就 | 10 | freesound.org | $0 |

设置：BGM / SFX / 总音量三档独立，默认 BGM 30% / SFX 70%。

### i18n

**字符串量估**：~300 条（按钮 ~30、教程 ~50、成就 ~40、设置 ~30、对话 ~50、错误/提示 ~50、店面 ~50）。

**流程**：

1. 代码所有用户可见字符串用 `tr("KEY")`
2. Godot 自带 extractor 扫出 → `translations/messages.pot`
3. 三份 .po：`zh_CN.po`（主，用户写）/ `zh_TW.po`（OpenCC 简转繁 + 人工微调术语）/ `en.po`（自译，1 轮自审 + 友人抽样）
4. Godot 自动按 OS_locale 切换；设置面板可手动覆盖

**纪律**：禁用拼接，复数用 `tr_n()`。

## Build & release pipeline

### 本地一键构建

`tools/build_all.sh`：

```bash
godot --export-release "Windows Desktop" build/win/CalendarPuzzle.exe
godot --export-release "macOS" build/mac/CalendarPuzzle.zip
godot --export-release "Linux/X11" build/linux/CalendarPuzzle.x86_64
```

### Mac 公证（仅 macOS 上跑）

```bash
codesign --deep --force --options runtime --sign "Developer ID Application: ..." build/mac/CalendarPuzzle.app
xcrun notarytool submit build/mac/CalendarPuzzle.zip --wait
xcrun stapler staple build/mac/CalendarPuzzle.app
```

### Steamworks 上传

```bash
steamcmd +login <user> +run_app_build content_builder/app_build.vdf +quit
```

按 Win/Mac/Linux 三个 depot 拆分，玩家只下自己平台二进制。

### CI/CD

**Phase 1 不上 CI**：单人项目，手动跑 `build_all.sh` 比维护 3 平台 GitHub Actions runner 简单；Mac 公证密钥不放云端避免泄露。Phase 2 用户量起来再上。

### Costs / Budget

Phase 1 总现金支出（除个人时间）：

| 项 | 一次性 | 年费 | 备注 |
|---|---|---|---|
| Steam Direct Fee | $100 | — | 销售额达 $1000 后 Valve 退还 |
| Apple Developer Program | — | $99 | macOS 公证必须；不发 Mac 可省 |
| 字体 / 图标 / 音频 / 美术 | $0 | — | 全部用开源 + freesound + 自制 |
| 后端 / CDN / 服务器 | $0 | $0 | 零后端架构 |
| **小计** | **$100** | **$99** | — |

砍 Mac 首发的话现金成本降到 $100 一次性。预算超出 buffer 项：宣传片外包 $200-500（R7 缓解）/ 首图补救外包 $200-500（R7 缓解）。

### Steam 店面物料清单

| 资产 | 尺寸 | 工具 |
|---|---|---|
| Small Capsule | 462×174 | HTML/SVG 模板 → PNG |
| Main Capsule | 616×353 | 同上 |
| Header Capsule | 460×215 | 同上 |
| Library Capsule | 600×900 | 同上 |
| Library Hero | 3840×1240 | 同上 |
| Library Logo | 1280×720 | 同上 |
| 截图 × 5+ | 1920×1080 | 游戏内 F12 截图 + 调色 |
| 宣传片 30-60s | — | OBS 录屏 + DaVinci Resolve（自做；预算超出可外包 $200-500 补救） |

## Milestones

按 ~85h/月计：

| # | 里程碑 | 周 | 工时 | 验收门槛 |
|---|---|---|---|---|
| M0 | 项目脚手架 | 2 | 40 | Godot 4 项目跑通；GameModule stub；boot 加载 stub 显示空场景；GodotSteam 集成验证 |
| M1 | 求解器移植 + benchmark | 2 | 40 | DLX + generator 翻完；GUT 95% 通过；10 天 × 5 难度 benchmark 报告产出 |
| M2 | 核心玩法场景 | 3 | 60 | 鼠键拖放 + R 旋转 + F 镜像 + 双击移除 + 胜利检测；input 抽象接好 |
| M3 | 难度系统 + 日历 + 全量预生成 | 3 | 60 | 5 难度可选；当日题 + 日历选题；`daily_puzzles.tres` 完成 |
| M4 | UI 外壳 + 存档 | 3 | 60 | 主菜单 / 设置 / 3 槽手动存档 + 自动存档 + 缩略图 |
| M5 | 提示 + 教程 | 2 | 40 | 弱提示 3/5 次 UI 工作；medium/strong 隐藏代码可用；5 步教程 |
| M6 | Steam SDK 全接入 | 2 | 40 | 20 个成就触发正确；Cloud Save 跨设备验证；Rich Presence；overlay 不冲突 |
| M7 | i18n 三语 | 1.5 | 30 | 所有字符串 tr()；zh-CN / zh-TW / en 三份 .po 完成；Steam 语言检测 |
| M8 | 多平台 + 公证 + Deck 验收 | 2 | 40 | Win/Mac/Linux native 都跑；Mac 公证通过；Deck 实机过 Verified 标准 |
| M9 | 视觉打磨 + 音频集成 | 3 | 60 | 组件库收尾；动画 / 缓动；10 SFX + 2 BGM 接入；色盲符号；主题切换 |
| M10 | 店面物料 + 宣传片 + Beta | 2 | 40 | 7 张 capsule + 8-10 张截图 + 30-60s 宣传片；Steam Playtest 5-10 人 |
| M11 | 上架审核 + 修改 + 发布 | 1.5-2 | 30-40 | Steamworks 审核通过；价格定；2027 Q1 发布 |

**累计 27-27.5 周 ≈ 6.5-7 个月** + **1-1.5 个月 buffer** = **8 个月**。

**M0-M2 关键路径**：求解器移植不通则一切免谈，前 7 周紧盯。M11 Steam 审核外部不可控，buffer 必须留。

## Testing strategy

| 层 | 工具 | 覆盖 | 频率 |
|---|---|---|---|
| 单元 | GUT (Godot Unit Test) | solver/dlx, puzzle_generator, hint_state, progress_tracker, slot_manager, save_adapter | 每提交本地 |
| 集成 | Godot scene test | play_scene 完整玩法 / save→reload round-trip / hint flow | 每 milestone 收尾 |
| 真机手测 | 4 平台清单 | 关键路径在每平台至少跑一次（Win 高频 / Mac+Linux+Deck 每 2-3 milestone） | M2 起每月全平台 |
| Steam 集成 | Steam beta branch | 成就触发 / Cloud Save / overlay / screenshot | M6 后每周 |
| Beta 测试 | Steam Playtest | 5-10 邀请玩家 | M10-M11 |

**回归基线**：M2 起每个 milestone 收尾，所有单测 + 之前 milestone 的集成测试必须绿。任何 milestone 退步**禁止进下一个**。

## Risk register

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | 单人 + 业余 8 个月工期滑期 | **高** | 上架日期推迟 | M11 留 1.5 月 buffer；每 milestone 收尾做"按计划/超期/可砍"复盘 |
| R2 | Steam Deck Verified 未过 | 中 | 损失 Deck 推荐位 | M8 至少跑 3 轮 Deck 适配；提前研究 Verified checklist |
| R3 | Mac 公证流程踩坑 | 中 | 延期 1-2 周 | M8 第 1 周尝试公证，留 1 周排错 |
| R4 | 求解器 GDScript 比预期慢 > 5× | 低 | 失眠生成卡顿 | M1 benchmark 提前暴露；超阈值方案：①减 dig 步数 ②worker thread 异步 ③极端退到 C# solver |
| R5 | pack_free.js → tres 转换错位 | 低 | 题面错，玩家解不出 | M1 转换脚本同时写 round-trip 单测（JS 解 vs GDScript 解对齐） |
| R6 | i18n 漏字符串 / 翻译质量 | 中 | 海外评论差评 | M7 收尾跑 extraction 工具检漏；en.po 找 1-2 海外友人验收 |
| R7 | 美术质量低于市场期，CTR < 2% | 中 | 销量平淡 | M10 Beta 收截图反馈；上架后 1 月监测 CTR，必要时 $200-500 外包补救首图 |
| R8 | Steam 审核退回 | 中 | 推迟 1-2 周 | M11 buffer 覆盖；常见拒因 checklist M10 自检 |
| R9 | 个人事务 / 工作冲突挤占时间 | **高** | 累积滑期 | 每月对比预算 vs 实际工时；连续 2 月超 20% 主动砍范围 |
| R10 | 当前 `fix/known-bugs-batch` 在途影响精力分配 | 中 | 启动延迟 | 建议小游戏 0.5.5 收尾发布后再正式启动 M0 |

**砍范围优先级**（M9 还差进度时按序削）：

1. 砍繁体中文（剩简中 + 英文）
2. 砍宣传片（用 5 张精修截图 + GIF 上架）
3. 砍 macOS 首发（Win + Linux + Deck 先发，Mac 1-2 月后补丁）
4. 砍 2 个最难做的成就（保留核心 18 个）

**不砍**：核心玩法 / 5 难度 / Steam Cloud / Deck 适配（决定 Verified 徽章，影响曝光最大）。

## Open questions

留待实现期解决，不阻塞 spec：

1. 字号最小值（影响 Steam Deck 7" 可读性）—— M8 真机测试时定
2. Cloud Save 写频率 vs 配额—— M6 集成时压测
3. 失眠"唯一解收集"成就上限—— M3 全量预生成后才知道实际数量
4. 成就阈值（"3 分钟通关 easy" 等）—— M3 数据出来后定
5. 价格点（$3 / $5 / $7）—— M11 上架前一周看竞品决定

## Out of scope（明确不在 Phase 1）

- DLC 内容包 / 主题包（Phase 2）
- 合集 Hub 改造（Phase 3）
- Workshop / Mod 支持
- 排行榜（Steam Leaderboard 集成）
- 多人 / P2P
- 微交易 / IAP
- 移动端（iOS/Android）
- 微信小游戏现有云函数 / 存档迁移（Steam 是新身份体系，不导旧数据）
- CI/CD 流水线
- 后端服务（每日题用预生成查表方案，零后端）
