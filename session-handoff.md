# Session handoff

> 每轮会话结束写这里 / 每轮新会话先读它。
> 配套 `feature_list.json` 与 `claude-progress.md` 一起使用。详见 `CLAUDE.md` → "Agent handoff / 会话接力"。

---

## 当前已验证 / Currently verified

- **跨仓格局**：本仓 `CalendarPuzzle/` 持有 spec + plan + 旧三端（Python/React/小游戏）；新仓 `~/mygit/calendar-puzzle-godot/` 持有 Godot 4 Steam 移植代码。两仓物理独立，不互嵌 submodule。
- **本仓 `feat/godot-steam` 分支**：3 commit on top of `origin/main`（含合并的 PR#9）：spec 初版 + spec 增量（KBM 重映射 + 3 皮肤）+ 12 份 M0-M11 plan。
- **新仓 `main` 分支**：13 commit，M0 完整实施完。已 push 到 `git@github.com:morefreeze/calendar-puzzle-godot.git`（private repo）。
- **M0 验证**：
  - 6/6 GUT 单测 pass（test_game_manifest + test_calendar_puzzle_module + test_boot_module_load）
  - `boot.tscn` headless 跑通：`[boot] module 'calendar_puzzle' started`
  - GodotSteam 优雅降级（Steam 未运行时 standalone 模式）
  - GitHub repo 可见、private、main 分支跟踪

## 本轮改动 / This session's changes

### CalendarPuzzle 仓（本仓，`feat/godot-steam` 分支）
- `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md` — Steam 移植 Phase 1 spec（18 locked decisions）
- `docs/superpowers/plans/2026-05-26-godot-steam-m{0..11}-*.md` — 12 份 milestone 实施 plan（共 19,937 行）
- `feature_list.json` — 移除 `minigame-known-bugs-batch`（PR#9 已合）；新增 `godot-steam-m0-scaffold` 条目 status=passing 含完整 evidence
- `claude-progress.md` — 追加 2026-05-26 会话记录 + 更新"当前已验证状态"段
- `session-handoff.md` — 本文件，覆盖

### calendar-puzzle-godot 仓（新仓，`main` 分支）
- 完整目录结构（`boot/` `games/calendar_puzzle/` `shared/` `tests/` `docs/` `addons/`）
- 抽象接口层（`shared/`）：GameManifest / GameModule / GameDeps / SaveAdapter / InputContext / TranslationContext / PlatformBus
- 4 个 platform stub 实现（`boot/platform/`）：SaveAdapter 内存版、InputContext no-op、TranslationContext key-passthrough、SteamPlatform 真接入 + 优雅降级
- 游戏模块 stub（`games/calendar_puzzle/`）：game.gd + manifest.tres，启动后显示标签
- boot 入口（`boot/boot.gd` + `boot/boot.tscn`）：DI 注入 + 模块加载
- GodotSteam 4.19 GDExtension 装入（`addons/godotsteam/` 93MB 二进制）
- GUT v9.5.0 装入（`addons/gut/`）+ `tests/run_tests.gd` headless 测试 runner
- 文档：`README.md` + `docs/STEAM_SETUP.md` + `docs/DEVELOPMENT.md`

## 仍损坏或未验证 / Known risks / unverified

1. **GUI 真机冒烟未做**（M0 Task 11）：subagent 跑不了桌面 GUI，需要用户在本机：
   ```bash
   cd ~/mygit/calendar-puzzle-godot
   godot
   ```
   验证 1280×720 窗口显示 "Calendar Puzzle stub running" + 副标题，截图存 `docs/m0-smoke-screenshot.png`。
2. **GodotSteam 93MB 二进制在普通 git**：建议在 M1 开工前迁 `addons/godotsteam/**/*.{so,dll,dylib,framework}` 到 git-lfs，避免后续 clone 越来越慢。
3. **STEAM_APP_ID = 480**（Spacewar 测试 ID）：M11 上架前必须换成真实 App ID（需先付 $100 Steam Direct Fee，见 `docs/STEAM_SETUP.md`）。
4. **三处 plan bug 修复需要回灌到 plan 文件**：
   - M7 plan 写的 `i18n.tr()` 调用应改为 `i18n.translate()`（Object.tr 冲突，已在 M0 实施时改 API）
   - M0/M6 plan 写的 GodotSteam 安装路径应改为 Godot Asset Library 2445 v4.19（GitHub 仓已 archive）
   - M0 plan 的 `steam_platform.gd` 处理 `Steam.steamInit()` 应改 bool 而非 Dictionary（4.14+ 行为）
5. **不可控外部依赖**：Apple Developer Program $99/yr 注册流程（M8 前需到位）、Steam Direct Fee $100 一次性（M6 前需到位）。

## 下一步最佳动作 / Next best action

1. **建议先做：迁 GodotSteam 二进制到 git-lfs**（在 M1 开工前；现在历史还小成本最低）
2. **M0 GUI 冒烟**：用户在本机跑 `godot` 验证 + 截图
3. **M1 plan 实施**：求解器移植（DLX + puzzle_generator + board 三个 GDScript 文件 + JS round-trip 测试 + benchmark）。plan 在 `docs/superpowers/plans/2026-05-26-godot-steam-m1-solver.md`，约 2041 行。
4. 异步推进：Steam 开发者账号注册 + Apple Developer 账号注册

❌ **不要**：在 `~/mygit/calendar-puzzle-godot/main` 上直接堆 commit 做 M1（建议开 feature branch + PR）；不要修改 `boot/platform/stub_translation_context.gd` 改回 `tr/tr_n`（会与 Object.tr 冲突）；不要"修"已经合理的 plan bug 修复（subagent 改的 3 处都是真 bug）。

## 命令 / Commands

```bash
# 切到本仓 spec/plan 分支
cd ~/mygit/CalendarPuzzle && git checkout feat/godot-steam

# 切到新仓做 Godot 开发
cd ~/mygit/calendar-puzzle-godot

# 跑 Godot 单测
godot --headless --script tests/run_tests.gd

# 跑 boot 冒烟
godot --headless --quit-after 3 res://boot/boot.tscn

# 看新仓 GitHub
gh repo view morefreeze/calendar-puzzle-godot
```
