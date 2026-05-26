# Session handoff

> 每轮会话结束写这里 / 每轮新会话先读它。
> 配套 `feature_list.json` 与 `claude-progress.md` 一起使用。详见 `CLAUDE.md` → "Agent handoff / 会话接力"。

---

## 当前已验证 / Currently verified

- **跨仓格局**：本仓 `CalendarPuzzle/` 持有 spec + plan；新仓 `~/mygit/calendar-puzzle-godot/` 持有 Godot 4 Steam 移植代码。
- **本仓 `feat/godot-steam` 分支**：5 commit on top of `origin/main`（spec + spec 增量 + 12 plan + M0 handoff + M1 handoff）。
- **新仓 `main` 分支**：23 commit，M0 + M1 完整实施完。已 push 到 `git@github.com:morefreeze/calendar-puzzle-godot.git`。
- **M0 验证**：6/6 单测 + boot.tscn 端到端 + GodotSteam 优雅降级 + GitHub push（已 passing）
- **M1 验证**：50/50 单测 + JS-vs-GDScript round-trip 50 ref puzzles + 100% 函数覆盖 + insomnia p95 6.7ms（R4 阈值 3000ms 450× headroom）（已 passing）

## 本轮改动 / This session's changes

### CalendarPuzzle 仓（`feat/godot-steam` 分支）
- `feature_list.json`：新增 `godot-steam-m1-solver` 条目 priority=0 status=passing；`godot-steam-m0-scaffold` 降到 priority=1
- `claude-progress.md`：追加 2026-05-26 (续) M1 会话记录 + 更新"当前已验证状态"段
- `session-handoff.md`：本文件，覆盖

### calendar-puzzle-godot 仓（`main` 分支，10 个新 commit）
- `games/calendar_puzzle/solver/`：
  - `dlx.gd` — Dancing Links 算法（157 行）
  - `board.gd` — 8×7 棋盘 + 10 方块定义 + mark_date + 放置验证（165 行）
  - `difficulty_config.gd` — 5 难度常量（26 行）
  - `puzzle_generator.gd` — 题目生成（621 行；核心 solve + dig + combo + generate_puzzle 主入口）
  - `pack_resource.gd` — PackResource 类
  - `pack_free.tres` — 3MB 题库二进制，2562 date keys
- `tests/` 新增：test_dlx.gd（5）+ test_board.gd（11）+ test_puzzle_generator.gd（18+3）+ test_difficulty_config.gd（3）+ test_pack_conversion.gd（4）= 44 新测试
- `tools/`：
  - `convert_pack.gd` — JS pack → tres 一次性转换
  - `solver_benchmark.gd` — 50 puzzles 性能报告
  - `coverage_check.py` — 函数级覆盖率静态分析（GUT 无 -gcoverage）
  - `reference_puzzles.json` + `tests/fixtures/reference_puzzles.json` — JS round-trip fixture
- `docs/`：m1-benchmark-report.md + m1-coverage.md
- M1 在 `feat/m1-solver-port` 上累计，no-ff merge 到 main（merge commit c878a45）+ push + 删 feature branch

## 仍损坏或未验证 / Known risks / unverified

1. **M0 GUI 真机冒烟仍未做**：用户需要在本机跑 `cd ~/mygit/calendar-puzzle-godot && godot` 验证 1280×720 窗口 + 截图 → `docs/m0-smoke-screenshot.png`。**跨 milestone 不阻塞 M2 推进**。
2. **GodotSteam 93MB 二进制**：仍在普通 git。M2 + M9 还会加更多 GodotSteam 资源；建议 M2 开工前迁 git-lfs。
3. **STEAM_APP_ID = 480**（Spacewar 测试 ID）：M11 上架前必须换；Steam Direct Fee $100 + Apple Developer $99/yr 异步推进。
4. **5 处 plan bug 修复需要回灌**（M0 3 处 + M1 2 处）：
   - M7 plan `i18n.tr()` 调用 → 应改 `i18n.translate()`（Object.tr 冲突）
   - M0/M6 plan GodotSteam 安装路径 → Asset Library 2445 v4.19（GitHub archive）
   - M0 plan `steam_platform.gd` Steam.steamInit() 返回 bool 处理
   - M1 plan 测试期望 Tuesday 在 col 6 → 改 col 5
   - M1 plan benchmark `count_solutions_for_combo` 全枚举太慢 → 改采样
   - M1 plan coverage `-gcoverage` 不存在 → 改 `tools/coverage_check.py` Python 路径

## 下一步最佳动作 / Next best action

1. **优先建议**：迁 `addons/godotsteam/**/*.{so,dll,dylib,framework}` 到 git-lfs（M2 开工前；现在 .git 32M+ 成本最低）
2. **M2 plan 实施**：核心玩法场景（InputRouter 真实现 + BoardView 自绘 8×7 + 拖放 + R 旋转 + F 镜像 + 双击移除 + 胜利检测 + 集成测试）
   - Plan: `docs/superpowers/plans/2026-05-26-godot-steam-m2-gameplay-scene.md`（1571 行，11 task）
   - 建议拆 4 batch：A（ActionBindings + InputRouter）/ B（BoardView + PaletteView + WinOverlay）/ C（play_scene FSM + 接入）/ D（集成测试 + 手测）
3. **异步推进**：Steam Direct Fee 注册 + Apple Developer 账号注册

❌ **不要**：
- 不要在新仓 `main` 上直接堆 M2 commit（按 M1 的做法开 `feat/m2-gameplay-scene`）
- 不要修改 `boot/platform/stub_translation_context.gd` 改回 `tr/tr_n`（与 Object.tr 冲突）
- 不要"修"已经合理的 5 处 plan bug 修复
- 不要在没跑 `godot --headless --quit-after 3 res://boot/boot.tscn` 回归就 mark milestone 完成

## 命令 / Commands

```bash
# 本仓 spec/plan
cd ~/mygit/CalendarPuzzle && git checkout feat/godot-steam

# 新仓 Godot 开发
cd ~/mygit/calendar-puzzle-godot
git checkout -b feat/m2-gameplay-scene  # M2 新 branch

# 跑测试 (M0+M1)
godot --headless --script tests/run_tests.gd  # 50/50 应全绿

# 跑 boot 冒烟
godot --headless --quit-after 3 res://boot/boot.tscn  # [boot] module 'calendar_puzzle' started

# 跑性能 benchmark
godot --headless --script tools/solver_benchmark.gd

# 跑覆盖率
python3 tools/coverage_check.py

# 看 GitHub 仓
gh repo view morefreeze/calendar-puzzle-godot
```
