# Session handoff

> 每轮会话结束写这里 / 每轮新会话先读它。
> 配套 `feature_list.json` 与 `claude-progress.md` 一起使用。详见 `CLAUDE.md` → "Agent handoff / 会话接力"。

---

## 当前已验证 / Currently verified

- **跨仓**：本仓 `CalendarPuzzle/` 持 spec + plan + handoff；新仓 `~/mygit/calendar-puzzle-godot/` 持 Godot 4 移植代码。
- **本仓 `feat/godot-steam`**：未 commit 改动（feature_list.json + claude-progress.md + session-handoff.md + plans/...-m3-puzzle-generation.md 的 Plan-bug log 段）；handoff 三件套 backup 仍在 `.handoff_backup/feature-hardcore-mode/`（feature/hardcore-mode 分支的过期版本）。
- **新仓 `main`**：含 M0+M1+M2+M8-mac-shortcut（已 push）+ `55616ae` fix(m2): window + test gap（本地未 push）。
- **新仓 `feat/m3-puzzle-generation`**：从 `55616ae` 派生 8 个 M3 commit（2fc4add → 193601f → acb02d8 → 89b24a0 → 040c01a → fd23a4b → 510c999 → 775a72a），**全本地未 push**。
- **测试基线**：`cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd` → **153/153 pass, 846 asserts**（M0+M1+M2 118 + M3 新 35：Difficulty 5 / DailyPuzzleTable 7 / Calendar 11 / SelectScene 7 / load_puzzle round-trip 5）。
- **🎉 可玩 Mac app**：`~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app`（193MB universal binary，含 M3 select_scene + 1.6MB daily_puzzles.tres）。默认进 select_scene 而非 play_scene。`open` 命令可启动。

## 本轮改动 / This session's changes

### 新仓 calendar-puzzle-godot（9 个新 commit）

- **`55616ae` (on main)** fix(m2): maximize window on launch + close real-input scene-tree test gap
  - `project.godot`：加 `window/size/mode=2`（Maximized）+ `resizable=true`，删 `window_width_override` / `window_height_override`
  - `tests/test_real_input_path.gd`：2 个 regression guard（router._input 直调 + 真 scene tree palette 点击 → DRAGGING），防 TestInputContext bypass 再次让"测试绿但真机不能拖"过关
  - `tools/diag_real_window_click.gd`：非 shipping 诊断工具，真窗口注入 InputEventMouseButton 证明 InputRouter chain 在源码层 OK

- **`2fc4add → 775a72a` (on feat/m3-puzzle-generation)** M3 全 8 task：
  - Task 1 `2fc4add` Difficulty 5 常量 + dig_count + weak_hint_cap + i18n key + 5 测试
  - Task 2 `193601f` DailyPuzzleTable Resource + lookup/has_date/all_dates/size API + round-trip 序列化 + 7 测试
  - Task 3 `acb02d8` shared/ui/calendar.gd + calendar.tscn 月历控件 + 范围约束 + 闰年 + Zeller + 11 测试
  - Task 4 `89b24a0` tools/precompute_daily.gd 工具脚本（adapt 真 M1 API generate_puzzle）
  - Task 6 `040c01a` games/calendar_puzzle/scenes/select_scene.gd + .tscn + 7 测试（5 难度按钮 + 月历 + Today + Start/Back）
  - Task 7 `fd23a4b` game.gd 改 mount select_scene → swap play_scene；play_scene.gd 加 load_puzzle(payload) + _apply_puzzle helper + _iso_to_date_struct
  - Task 5 `510c999` data(solver): precomputed daily_puzzles.tres 5844 dates × 5 diff = 29,220 entries, 1.6MB（838s 全量跑产出）
  - Task 8 `775a72a` test(m3): load_puzzle round-trip 5 cases + docs/m3-evidence/all-tests-final.log

### 本仓 CalendarPuzzle 待 commit 改动

- `feature_list.json`：新加 priority=0 `godot-steam-m3-puzzle-generation` entry（status: passing），其它 entry priority 顺移 1-7；M2 entry evidence 加 2026-05-29 的 window+test fix 行
- `claude-progress.md`：当前已验证状态段更新（M3/.tres/Mac app size）；2026-05-29 会话记录段插最前
- `session-handoff.md`：本文件，覆盖
- `docs/superpowers/plans/2026-05-26-godot-steam-m3-puzzle-generation.md`：底部加 "Plan-bug log (post-execution corrections — 2026-05-29)" 段 + "Execution log (2026-05-29)" 表

## 仍损坏或未验证 / Known risks / unverified

- **所有 commit 都 local**，未 push GitHub。等用户手测 Mac app 后再 push + merge feat/m3-puzzle-generation → main。
- **Mac GUI 完整手测未做**（subagent 跑不了 GUI）。用户需做：
  1. `open ~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app`
  2. 默认看到 select_scene（不是直接 play_scene 了）：5 难度按钮 + 月历 + Today + Start/Back
  3. 选 easy / today / Start → 进 play_scene 能拖块（M2 拖放仍 work）
  4. 翻日历到 2020-01 → "<" 应禁用；翻到 2035-12 → ">" 应禁用
  5. 闰年（如 2020-02-29）应显示且可选；平年（2021-02-29）不显示
  6. 改难度回 select_scene 重选
- **`tests/fixtures/easy_seeded_puzzle.gd` 内部 date/board 不一致**仍未修（plan 原说 "M3 顺手 fix"，但 M3 没碰它；M2 用防御性从 `*` 推 uncoverable 让测试过仍 work）。后续清理。
- 历史遗留风险（沿用之前 handoff）：`server.py:220` `if False and 'gameId' in data:` **有意禁用** (commit `bb9bf39`)；`board.py::mark_date` 坐标常量是物理日历布局；都不要"修"。

## 下一步最佳动作 / Next best action

按优先级：

1. **用户验 Mac app**（本机 10 分钟）：跑 `open ~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app`，过一遍上面"Mac GUI 完整手测未做"的 6 条 checklist。
2. **Push + merge**：feat/m3-puzzle-generation push GitHub → merge main；本仓 feat/godot-steam handoff/plan 更新 commit + push。
3. **决定下一段**：
   - (a) **主线推进 M4** = UI 外壳 + 主菜单 + 设置面板 + 3 槽手动存档 + 自动存档。spec 估 70h 占月预算 ~85h 的大头。plan 已就绪 (`docs/superpowers/plans/2026-05-26-godot-steam-m4-ui-shell-saves.md`)。
   - (b) **完整 M8** = Apple Developer $99 注册 + codesign + notarytool + Win/Linux/Deck export。让 Mac app 外发不踩 Gatekeeper。
   - (c) **修 fixture date/board 不一致** = 小清理，先做无负担。
4. M3 手测发现 bug 任何一类 → 在 feat/m3-puzzle-generation 上继续修，按现有 plan-bug log 模式追加新条目。

❌ **不要**：
- 不要 push feat/m3-puzzle-generation 在用户验证前（commits 全 local 等于可回滚）
- 不要 push `build/mac/CalendarPuzzle.app`（193MB 在 .gitignore，Steam Cloud 不是分发渠道）
- 不要"修"已禁用的 server.py:220 gameId 解码分支
- 不要改 board.py::mark_date 坐标常量

## 命令 / Commands

```bash
# 本仓 spec/plan/handoff
cd ~/mygit/CalendarPuzzle && git checkout feat/godot-steam

# 新仓 Godot 开发
cd ~/mygit/calendar-puzzle-godot && git checkout feat/m3-puzzle-generation

# 启动 Mac app（验 M3：默认进 select_scene）
open ~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app

# 跑 Godot 全套单测
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd

# 跑 boot 冒烟（应进 select_scene 无 ERROR）
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --quit-after 3 res://boot/boot.tscn

# 重新构建 Mac app
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --export-release "macOS" build/mac/CalendarPuzzle.app

# 全量重跑预生成（如果改了 PuzzleGenerator）
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tools/precompute_daily.gd

# 看新仓 GitHub
gh repo view morefreeze/calendar-puzzle-godot

# 看 M3 commits
cd ~/mygit/calendar-puzzle-godot && git log --oneline main..feat/m3-puzzle-generation
```
