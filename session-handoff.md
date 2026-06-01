# Session handoff

> 每轮会话结束写这里 / 每轮新会话先读它。
> 配套 `feature_list.json` 与 `claude-progress.md` 一起使用。详见 `CLAUDE.md` → "Agent handoff / 会话接力"。

---

## 当前已验证 / Currently verified

- **跨仓**：本仓 `CalendarPuzzle/` 持 spec + plan + handoff；新仓 `~/mygit/calendar-puzzle-godot/` 持 Godot 4 移植代码。
- **本仓 `feat/godot-steam`**：未 commit 改动（feature_list.json + claude-progress.md + session-handoff.md + plans/...-m4-ui-shell-saves.md 的 Plan-bug log 段）。`.handoff_backup/feature-hardcore-mode/` 仍是 feature/hardcore-mode 分支的过期版本。
- **新仓 `main`**：含 M0+M1+M2+M8-mac-shortcut（已 push）+ `55616ae` fix(m2): window + test gap（本地未 push）。
- **新仓 `feat/m3-puzzle-generation`**：从 `55616ae` 派生 8 个 M3 commit，**全本地未 push**。
- **新仓 `feat/m4-ui-shell-saves`**：从 `feat/m3-puzzle-generation` tip 派生 11 个 M4 commit，**全本地未 push**。当前 HEAD。
- **测试基线**：`cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd` → **195/195 pass, 976 asserts**（M0+M1+M2 118 + M3 35 + M4 41 + 1 个 M3-era latent fix 的 regression）。
- **🎉 可玩 Mac app**：`~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app`（194MB universal binary，含 M3 select_scene + M4 main_menu/settings/slot_picker/skin/save 全套 + 1.6MB daily_puzzles.tres + boot.gd `_game_module` 持有 fix）。默认进 main_menu。`open` 命令可启动。**Start 按钮 bug 已修**：用户第一次跑 Mac app 报告"Start 没反应"，根因 boot.gd 局部 `module := CalendarPuzzleGame.new()` 的 Resource 函数返回即被 GC，select.puzzle_selected → module._on_puzzle_selected 的 callable 立刻失效。boot.gd 加 `var _game_module: Resource = null` 实例变量持有引用即可。M3-era latent，到 M4 用户手测才暴露。

## 本轮改动 / This session's changes

### 新仓 calendar-puzzle-godot 11 个新 commit（on feat/m4-ui-shell-saves）

| commit | task | tests after |
|---|---|---|
| `34a67ab` | Task 1 — Settings/Progress/Stats/Profile Resource 类 + 9 tests | 162/162 |
| `0151508` | Task 2 — GameSnapshot + SlotResource + 3 round-trip tests | 165/165 |
| `f35cb22` | Task 3 — SaveAdapterTres real .tres persistence + 6 tests | 171/171 |
| `797babb` | Task 4 — boot 切 SaveAdapterTres + profile load/create + plan-bug #M4-1 fix | 171/171 |
| `76e91a8` | Task 5 — MainMenu (Continue/New/Settings/Quit) + 3 tests + plan-bug #M4-2 stub | 174/174 |
| `3d046f1` | Task 6 — KeyCapture widget (modifier serialization + escape-cancel) + 8 tests | 182/182 |
| `49a1fe3` | Task 8 — SkinResource + SkinManager autoload + 3 placeholder .tres + 5 tests | 187/187 |
| `8c47985` | Task 9 — SlotManager (5s throttled autosave + 3 manual slots + thumbnail) + 7 tests + plan-bug #M4-3 (M2 真 API) | 194/194 |
| `f4703fe` | Task 7 — SettingsPanel 3 标签 (General + Controls KeyCapture + Skins) + plan-bug #M4-4 + #M4-5 | 194/194 |
| `3e21882` | Task 10 — SlotPicker UI + play_scene HUD 加 Save/Load 按钮 + plan-bug #M4-7 (M2 没 HUD) | 194/194 |
| `810445f` | Task 11 — final evidence log docs/m4-evidence/all-tests-final.log | 194/194 |
| `<chore .uid sweep>` | chore: 一批 M3/M4 subagent 漏 add 的 .gd.uid 全部 sweep 进库 | 194/194 |
| `b1887cf` | fix(boot): hold game module Resource — 修 Start 按钮无响应 + regression test + diag tool | **195/195** |

### 本仓 CalendarPuzzle 待 commit 改动

- `feature_list.json`：新加 priority=0 `godot-steam-m4-ui-shell-saves` entry（status: passing），其它 entry priority 顺移 1-8；
- `claude-progress.md`：当前已验证状态段更新（M4/.app size/默认进 main_menu）；2026-05-30→2026-06-01 会话记录段插最前
- `session-handoff.md`：本文件，覆盖
- `docs/superpowers/plans/2026-05-26-godot-steam-m4-ui-shell-saves.md`：底部新加 "Plan-bug log (post-execution corrections — 2026-06-01)" 段 + "Execution log" 表

## 仍损坏或未验证 / Known risks / unverified

- **所有 commit 都 local**，**未 push GitHub**。等用户手测 Mac app 验过后一起 push（M3 8 个 + M4 11 个 + M2 follow-up 1 个 + 本仓 handoff 1 个 = ~20 commits 待发车）。
- **Mac GUI 完整手测未做** — subagent 跑不了 GUI。用户需做（约 15-20 分钟）：
  1. `open ~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app`
  2. 默认看到 **main_menu**（4 按钮：Continue / New Game / Settings / Quit）。首次启动 Continue 灰，New Game 亮。
  3. New Game → select_scene → 5 难度 + 月历 + Today + Start → play_scene 拖块（M2 + M3 + M4 都不应回归）。
  4. 关掉 → 重启 → Continue 现在应该亮（autosave 已经写过）→ 点 Continue → 应恢复到上次的题/计时/已放块。**注意**：M4 留了已知问题，autosave 在 play_scene 拖放/旋/镜处**没有自动触发**（_mark_state_dirty 未接 input handlers），所以 Continue 可能恢复到很久前的状态。Manual Save 仍 work。
  5. 主菜单 → Settings → 3 标签：
     - General：拖音量滑块、勾全屏（取消应回 Maximized 不是小窗）、切主题/语言、Reset All
     - Controls：点 rotate 旁 "rebind" → 按 Q → 显示 "Q"；按 Ctrl+Z 给 undo → 显示 "Ctrl+Z"；冲突时弹 warning + 把对方变空
     - Skins：3 占位色块（M9 才填真实色板/thumbnail）；点 pastel → "Current: pastel"
  6. play_scene 顶右角 💾 Save / 📂 Load 按钮 → SlotPicker 弹层 3 槽（thumbnail + name + timestamp）→ Save 弹 dialog 取名 → Load 恢复对应槽。
  7. 关闭游戏 → 重启 → 设置全保留（profile.tres 持久化）。
- **`_mark_state_dirty` 未接 input handlers**（M4 已知 deferred）：autosave 不会因玩家拖放自动触发。下一段 quick win 是把 `_mark_state_dirty()` 接到 `_on_pointer_pressed` / `_on_pointer_released` / `_on_action_triggered` 中——预计 1-2 commit + 集成测试可能需要 update。
- **tests/fixtures/easy_seeded_puzzle.gd date/board 不一致**仍未修（M3 留的）。M4 用真实 SeededPuzzle generator 路径，fixture 只用于 M2 集成测试。
- 历史风险沿用：`server.py:220` `if False and 'gameId' in data:` 有意禁用（commit `bb9bf39`）；`board.py::mark_date` 物理日历坐标常量；都不要"修"。

## 下一步最佳动作 / Next best action

按优先级：

1. **用户验 Mac app**（本机 15-20 分钟）：`open ~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app`，过一遍上面"Mac GUI 完整手测未做"的 7 条 checklist。
2. **Push + merge**：feat/m4-ui-shell-saves push GitHub → merge main（feat/m3 commits 跟随 base 一起带过去）；本仓 feat/godot-steam handoff/plan 更新 commit + push。
3. **决定下一段**（优先级建议）：
   - (a) **接通 _mark_state_dirty**（1-2 commit，1 个 session）— 把 hook 接进 M2 input handlers，autosave 真正自动触发；测试可能要 update。**最小 quick win**，让 Continue 真有用。
   - (b) **M5 提示 + 教程**（plan 已就绪 `docs/superpowers/plans/2026-05-26-godot-steam-m5-hints-tutorial.md`）— 弱提示 3/5 次 UI + 5 步教程。spec 估 40h。
   - (c) **完整 M8 公证**（Apple Dev $99 + codesign + Win/Linux/Deck export）— 让 Mac app 外发不踩 Gatekeeper。
   - (d) **修 fixture date/board 不一致** + 小清理。

❌ **不要**：
- 不要 push feat/m4-ui-shell-saves 在用户验证前
- 不要 push `build/mac/CalendarPuzzle.app`（194MB 在 .gitignore）
- 不要"修"已禁用的 server.py:220
- 不要改 board.py::mark_date 坐标常量
- 不要在 _ready() 里 preload 还不存在的 .tscn（Plan-bug #M4-2 教训）

## 命令 / Commands

```bash
# 本仓 spec/plan/handoff
cd ~/mygit/CalendarPuzzle && git checkout feat/godot-steam

# 新仓 Godot 开发
cd ~/mygit/calendar-puzzle-godot && git checkout feat/m4-ui-shell-saves

# 启动 Mac app（验 M4：默认进 main_menu）
open ~/mygit/calendar-puzzle-godot/build/mac/CalendarPuzzle.app

# 跑 Godot 全套单测
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . -s tests/run_tests.gd

# 跑 boot 冒烟（应进 main_menu 无 ERROR）
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --quit-after 3 res://boot/boot.tscn

# 重新构建 Mac app
cd ~/mygit/calendar-puzzle-godot && godot --headless --path . --export-release "macOS" build/mac/CalendarPuzzle.app

# 看新仓 GitHub
gh repo view morefreeze/calendar-puzzle-godot

# 看 M4 commits
cd ~/mygit/calendar-puzzle-godot && git log --oneline main..feat/m4-ui-shell-saves

# 删用户数据重新测首次启动
rm -rf "$HOME/Library/Application Support/Godot/app_userdata/Calendar Puzzle/saves"
```
