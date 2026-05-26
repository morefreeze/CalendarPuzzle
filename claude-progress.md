# Claude progress log

> 每轮会话开始读这里，每轮结束追加一段。
> "当前已验证状态" 段持续覆盖最新事实；"会话记录" 段按时间倒序追加，最新在最上面。

---

## 当前已验证状态 / Current verified state

- **本仓 / This repo**: `/Users/bytedance/mygit/CalendarPuzzle`（spec + plan + 三端旧代码 Python/React/小游戏）
- **新仓 / Sibling repo**: `/Users/bytedance/mygit/calendar-puzzle-godot`（Godot 4 Steam 移植，private GitHub: morefreeze/calendar-puzzle-godot）
- **本仓当前工作分支 / Active branch**: `feat/godot-steam`（基于 `origin/main` 含 `fix/known-bugs-batch` PR#9 合并；2 个 spec commit + 1 个 12 plan 大 commit）
- **新仓当前分支 / Godot repo branch**: `main`（23 commit，M0 + M1 已完成并 push；feat/m1-solver-port 已 merge 删除）
- **标准启动路径 / Standard startup**:
  - 旧 Backend: `python server.py` (默认 `PORT=5001`)
  - 旧 Web: `cd my-cal && npm install && npm start` (CRA, :3000)
  - 旧 Mini-program: 用微信开发者工具打开 `calendar-puzzle-miniprogram/minigame/`
  - **新 Godot 项目**: `cd ~/mygit/calendar-puzzle-godot && godot`（编辑器）/ `godot --headless --script tests/run_tests.gd`（单测）
- **标准验证路径 / Standard verification**:
  - 小游戏单测: `cd calendar-puzzle-miniprogram && npm test`
  - Python: `python -m pytest -v`
  - Web E2E: `cd my-cal && npx playwright test`
  - **Godot 单测**: `cd ~/mygit/calendar-puzzle-godot && godot --headless --script tests/run_tests.gd`（M0+M1 50/50 pass, 539 asserts, 6.6s）
  - **Godot 性能 benchmark**: `godot --headless --script tools/solver_benchmark.gd`（产出 docs/m1-benchmark-report.md）
  - **Godot 覆盖率**: `python3 tools/coverage_check.py`（产出 docs/m1-coverage.md，100% 函数覆盖）
  - **Godot boot 冒烟**: `godot --headless --quit-after 3 res://boot/boot.tscn` 看到 `[boot] module 'calendar_puzzle' started`
- **当前最高优先级未完成功能 / Next priority feature**: `godot-steam-m2-gameplay-scene`（即将开始；plan 在 docs/superpowers/plans/2026-05-26-godot-steam-m2-gameplay-scene.md，1571 行）
- **当前 blocker / Current blocker**: 无（M0+M1 已 passing；M2 核心玩法场景可随时开工）

---

## 会话记录 / Session log

### 2026-05-26 (续) — M1 实施完成：求解器层全部 GDScript 化 + benchmark

- **本轮目标 / Goal**: 接 M0 完成后，按 M1 plan 把 JS 求解器层全部翻译到 GDScript + benchmark 验证 R4 性能门 + 100% 覆盖率。
- **已完成 / Completed**: 在新仓 feat/m1-solver-port 分支上 4 个 subagent batch 串行：
  - **Batch A** (Tasks 1-3, 3 commits)：dlx.gd 157 行 + board.gd 165 行 + difficulty_config.gd 26 行；16 GUT 单测
  - **Batch B** (Tasks 4-5, 2 commits)：puzzle_generator.gd 621 行（核心 solve + dig + combo + generate_puzzle 主入口）；18 GUT 单测
  - **Batch C** (Tasks 6-7, 2 commits)：convert_pack.gd 一次性 JS → tres 转换 + pack_resource.gd Resource 类 + pack_free.tres 3MB 入库；JS-vs-GDScript round-trip 50 ref puzzles（10 dates × 5 diffs）完全对齐
  - **Batch D** (Tasks 8-10, 2 commits)：solver_benchmark.gd + docs/m1-benchmark-report.md（**insomnia p95 6.7ms，R4 阈值 3000ms，450× headroom**）+ Python coverage_check.py 静态分析（GUT 没 -gcoverage，自写）+ 6 补测把覆盖率推到 100%
- **运行过的验证 / Validations run**:
  - `godot --headless --script tests/run_tests.gd` → 50 passed, 0 failed, 539 asserts, 6.6s
  - `godot --headless --script tools/solver_benchmark.gd` → 50 puzzles 总 1605ms wall
  - `python3 tools/coverage_check.py` → 45/45 函数 100% 覆盖
  - `godot --headless --quit-after 3 res://boot/boot.tscn` → M0 boot 仍绿
- **已记录证据 / Evidence recorded**: feature_list.json `godot-steam-m1-solver` evidence 数组（5 条）
- **提交记录 / Commits**:
  - 新仓：feat/m1-solver-port 上 9 个 commits → no-ff merge 到 main (c878a45 合并 commit) → push origin/main
  - 本仓：Task 14 一并 commit 到 feat/godot-steam（feature_list.json + claude-progress.md + session-handoff.md）
- **已知风险或未解决问题 / Known risks**:
  - 5 处 plan bug 修复需要回灌到对应 plan（其中两条已记录在 M0 handoff，新增 3 条）：
    - M1 plan 测试 expected col 6 for "二" Tuesday 应改为 col 5
    - M1 plan benchmark `count_solutions_for_combo` 不应每轮调用（175s/insomnia 全枚举），应注释为可选采样
    - M1 plan coverage 用 `-gcoverage` 不存在；改 `tools/coverage_check.py` Python 静态分析路径
  - M0 GUI 手测仍未做（Task 11 跨 milestone 不阻塞）
  - GodotSteam 93MB 二进制建议 git-lfs（仍未做；M2 + M9 还会加更多资产）
- **下一步最佳动作 / Next best action**: 开新 feature branch `feat/m2-gameplay-scene` 跑 M2 plan（核心玩法场景：InputRouter + 拖放 + 旋转/镜像 + 双击移除 + 胜利检测）。M2 ~1571 行 plan，预计 11 个 task / 4 个 batch / ~3 周 plan 工期；实际派 subagent 应在 1-2 个会话内推完。

---

### 2026-05-26 — Steam port：brainstorm + 12 plan + M0 实施（编译通过）

- **本轮目标 / Goal**: 用户从 steam_plan.md 出发，决定走 Godot 路线上架 Steam → 完整 brainstorm + 12 milestone plan 写完 + 推 M0 实施至代码编译通过。
- **已完成 / Completed**:
  - brainstorm：spec 写完 `docs/superpowers/specs/2026-05-26-godot-steam-port-design.md`（lock 18 个决策含 KBM 重映射 + 3 预置皮肤的增量）
  - writing-plans：12 份 M0-M11 plan 写完 `docs/superpowers/plans/2026-05-26-godot-steam-m*.md`（19,937 行；M0 自写 + M1-M11 派 4 个并行 agent 写）
  - subagent-driven-development 执行 M0：5 个 batch 串行（每 batch implementer + 必要时 reviewer）
    - Batch 1 (Tasks 1-2)：新仓 ~/mygit/calendar-puzzle-godot 建仓 + 12 目录脚手架
    - Batch 2 (Tasks 3-5)：GameManifest + 4 抽象接口 + GameDeps + GameModule。修了 plan bug：`tr/tr_n` 与 `Object.tr` 冲突 → 改 `translate/translate_n`
    - Batch 3 (Tasks 6-7)：GodotSteam 4.19 GDExtension（Asset Library 2445，因 GitHub 仓 archive）+ GUT v9.5.0（plan 写的 godot_4 分支已删）
    - Batch 4 (Tasks 8-10)：calendar_puzzle module stub + 4 platform stubs + boot.gd/boot.tscn。修了 plan bug：`Steam.steamInit()` 4.14+ 返回 bool 不是 Dictionary
    - Batch 5 (Tasks 12-13)：docs/STEAM_SETUP.md + DEVELOPMENT.md + gh repo create private + push（128MB 30 秒）
- **运行过的验证 / Validations run**:
  - `cd ~/mygit/calendar-puzzle-godot && godot --headless --script tests/run_tests.gd` → 6 passed, 0 failed, 0 orphans, 19 asserts
  - `godot --headless --quit-after 3 res://boot/boot.tscn` → `[boot] module 'calendar_puzzle' started`，Steam 未运行时 standalone 优雅降级
  - `gh repo view morefreeze/calendar-puzzle-godot` → private, main branch, pushed 2026-05-26T12:24:23Z
- **已记录证据 / Evidence recorded**: 见 `feature_list.json` 的 `godot-steam-m0-scaffold` evidence 数组
- **提交记录 / Commits**:
  - 本仓 `feat/godot-steam` 3 个新 commit（spec + spec 增量 + 12 plan）
  - 新仓 `main` 13 commit（M0 全过程）
- **已知风险或未解决问题 / Known risks**:
  - addons/godotsteam 93MB 二进制 commit 进 git，建议 M1 前迁 git-lfs（现在 .git 32M，越拖越贵）
  - STEAM_APP_ID 仍是 480（Spacewar），M11 上架前必换。Steam Direct Fee $100 + Apple Developer $99/yr 异步推进（docs/STEAM_SETUP.md）
  - M0 Task 11 真机 GUI 截图未做（subagent 无法跑桌面 GUI，需用户手测一次）
  - 三处 plan bug 修复需要回灌：(a) M7 plan 写的 `i18n.tr()` 调用应改 `i18n.translate()`；(b) M0/M6 plan 关于 GodotSteam 源应改 Asset Library 2445；(c) M0 plan 的 steam_platform.gd 应改 bool 处理
- **下一步最佳动作 / Next best action**: M1 plan 实施（求解器移植 + benchmark）。开新会话/沿用本会话都行；建议先做 git-lfs 迁移再开 M1，避免 binaries 持续累积。

---

### 2026-05-25 — feat 0.5.5：退出自动存入第一个空名槽（spillover）

- **本轮目标 / Goal**: 用户："在退出时 优先存入第一个空的槽位，如果没有才存到临时槽位"。前一轮刚 bump 完 0.5.4 发布摘要，这一单是新增功能，单独 0.5.5。
- **已完成 / Completed**:
  - 调研：grep 退出路径（`flushSaveNow` 是唯一 helper，被 4 个 back/save 点 + scene.onHide 共用；最终汇 wx.onHide）。读 `tempSlot.js`（`_writeNow` 已经判 bound|TEMP），读 `slotsGlobal.js`（tempSlot.create 拿到 store + binding 单例）。
  - 设计：把 spillover 逻辑放在 `tempSlot.flush(opts)`，opts 给 `preferEmptyNamed + namedSlotIds`。逻辑：未绑命名槽 + 扫到第一个空名槽 → 把 pending（或现有 temp 记录）写进去 + 删 temp + bind；否则回落老路径（写 pending 到 bound|temp）。注意 pending 可能为空，但已有 temp 记录仍应被提升 → 用 `pending || store.readSlot(TEMP_SLOT_ID)`。
  - TDD: tests/tempSlot.test.js +7 用例（未绑+空名槽、未绑+已占跳下个、全满回落、已绑不挤压、无 opts legacy 守卫、pending 空但 temp 有→提升、pending+temp 都空→no-op）。RED 6 个 fail（test 20 legacy 立即过）→ 实现 flush(opts) → 全过。
  - gameScene: flushSaveNow 一处改 `_tempSlot.flush()` → `_tempSlot.flush({ preferEmptyNamed: true, namedSlotIds: NAMED_SLOT_IDS })`。其它 markDirty/timer 路径（边玩边存）继续走老 flush，写 bound|temp——只在退出触发挤压。
- **运行过的验证 / Validations run**:
  - `node --check minigame/js/tempSlot.js minigame/js/gameScene.js` → OK
  - `npm test` → **220/220 pass**（213 + 7 新）
- **已记录证据 / Evidence recorded**: feature_list.json evidence 数组追加 0.5.5 一行 + verification 数组追加手测 #6 一行。
- **提交记录 / Commits**: 仍未提交。
- **已知风险或未解决问题 / Known risks**:
  - 已胜利对局退出时也会触发提升（preferEmptyNamed 不区分 isWon）。如果用户觉得"刚通关的题不该占用一个槽"，要加 isWon guard 显式跳过。
  - 边玩边存仍写 bound|temp（不挤压）— 设计上只有"退出"才挤压，避免高频写名槽。
- **下一步最佳动作 / Next best action**: 6 条手测路径走一遍 + 整理 commits。

---

### 2026-05-24 (cont.) — bug-batch #5：拖出棋盘自动选中

- **本轮目标 / Goal**: 用户说"拖动再拉出棋盘 要把这个方块放在选择上 就像点击候选一样"。把"拖动板上方块完全脱出棋盘"的语义对齐到"点击候选卡片"——拖出 = 选中。
- **已完成 / Completed**:
  - 定位：grep `selected = `, `dragFromBoard` 找到 onTouchEnd drag-end 分支（gameScene.js:2380-2428）。三条"块离开棋盘"的路径：`removeDropped` (462) / 拖出 fullyOff (2408-2417) / `resetAllPlaced` (480)。
  - 改动：仅修拖出 fullyOff 分支，一行 `selected = null` → `selected = rbOff`。
  - 不改：`removeDropped` （双击移除）保留 `selected=null`——双击的语义是"不要"，与拖出的"想换地方"不同。如果用户要改也告诉我即可，但默认不变。
  - 视觉链路确认：palette 渲染 `selected.id === item.block.id` 高亮 (1074) + tap-to-place (2533) + 旋转/镜像 (2452-2466) + preview ghost (1057,1907) 都靠 `selected` 引用，赋成 rbOff 全部自动通。
- **运行过的验证 / Validations run**:
  - `node --check minigame/js/gameScene.js` → OK
  - `npm test` → 213/213 pass
- **已记录证据 / Evidence recorded**: feature_list.json `minigame-known-bugs-batch` evidence 数组追加 Bug #5 两行。
- **提交记录 / Commits**: 仍未提交。
- **已知风险或未解决问题 / Known risks**: 无新增。
- **下一步最佳动作 / Next best action**: 等用户给下一个 bug，或开始整理这一批的手测 + commits。

---

### 2026-05-24 (cont.) — bug-batch #4：进失眠卡 5 秒（删死代码）

- **本轮目标 / Goal**: 用户问"进失眠难度会卡5秒 都在做什么"。先诊断而非盲修。
- **已完成 / Completed**:
  - 调研：grep `insomnia` 路径找到 `digCount=10` 特殊性 → 通读 `puzzleGenerator.js::generatePuzzle/solveBoardForCombo` + `gameScene.js` init 段 → 跑实测脚本 5 难度对比（easy/medium/hard 3-4ms, expert 10ms, insomnia 247ms 877 解）→ grep 确认 `solutionCount` 这个被 setTimeout 异步算出的值在 minigame/js/ 整个目录**零读取点**，明确是死代码（0.3.0 UX 重写 commit f0dc6bc 漏删）。
  - 用户确认后直接删 gameScene.js 三处共 ~9 行：行 266 `var solutionCount = -1;`、行 289-294 `setTimeout` + `PG.countSolutionsForCombo` 调用、destroy 时的 `clearTimeout(solutionCountTimer)`。
  - 保留：`puzzleGenerator.js::countSolutionsForCombo` 函数本身 + 导出（公共 API，无调用者也不再拖慢任何路径，留作未来调试用）。
- **运行过的验证 / Validations run**:
  - 实测 benchmark 跑了一次 `PG.generatePuzzle` + `PG.countSolutionsForCombo` 在 2026-05-24 这个日期上 5 个难度的耗时
  - `grep solutionCount minigame/` → 0 命中
  - `node --check minigame/js/gameScene.js` → OK
  - `npm test` → 213/213 pass（删死代码不影响任何测试）
- **已记录证据 / Evidence recorded**: feature_list.json `minigame-known-bugs-batch` evidence 数组追加 Bug #4 两行（根因 + Fix landed）。
- **提交记录 / Commits**: 仍未提交，全批等用户审阅。
- **已知风险或未解决问题 / Known risks**: 无新增。失眠卡顿是死代码暴露的；删了之后失眠跟其它难度一样顺。
- **下一步最佳动作 / Next best action**: 等用户给下一个 bug，或开始整理这一批的手测 + commits。

---

### 2026-05-24 — bug-batch #3：useHint 幂等化（修"用券后重入数量被恢复"）

- **本轮目标 / Goal**: 用户报"使用提示没有正确减少助力券 再次进游戏数量没变还能用"。先做 voucher 链路全面调研，列出 4 个可能场景（A/B/C/D），请用户确认。用户回"场景 A useHint 幂等" → 落地架构性修复（client 生 attemptId + cloud dedup）。
- **已完成 / Completed**:
  - **调研阶段**：
    - 通读 voucher.js / main.js / gameScene.js voucher 调用点 / cloud `useHint` + `listGrants` 函数 + cloud-mock harness。
    - 区分两条重入路径：cold boot (`main.init` → `login → flushPendingUse → reconcile`) vs warm (`wx.onShow` → `reconcile only`)。**关键差异**：warm 路径不跑 flushPendingUse。
    - 列出 4 个可能让 balance 被恢复的场景。最大嫌疑是场景 A：用券后 cloud 成功标记 grant，但 in-scene callback 因 scene 销毁 / 后台 JS 暂停丢失 → pending 残留 → 冷启动 flushPendingUse 重发 → cloud 返 no-grant → `_rollback`。
  - **TDD 修复（架构性，client + cloud）**：
    - RED-1 (cloud): tests/useHint.test.js +5 用例覆盖 attemptId 命中 replay、replay 业务失败、无 attemptId legacy、不同 attemptId 各自 claim、按 openid 隔离。先跑：2 fail（demand new behavior）+ 3 pass（document legacy/orthogonality）。
    - GREEN-1 (cloud): minigame/cloud/functions/useHint/index.js 新增 `(openid, attemptId)` 查 `useHintAttempts` collection 的去重逻辑。命中 replay 缓存 response；未命中正常 claim 后写入。缺 attemptId 走 legacy（向后兼容）。
    - RED-2 (client): tests/voucher.test.js +5 用例覆盖 applyUsed 返回 entry、entry 有 attemptId、唯一性、跨 storage round-trip、flushPendingUse 透传 attemptId。先跑：5 fail。
    - GREEN-2 (client): voucher.js 加 `_genAttemptId`（`Date.now().toString(36)` + 8 位随机）、applyUsed push 含 attemptId 的 entry 并 return entry、flushPendingUse 用 `item.attemptId`。
    - 接线: cloudClient.js useHint 签名扩 `attemptId` 参数；gameScene.js:2276 把 `voucher.applyUsed(...)` 改成 `var entry = voucher.applyUsed(...)`，`cloudClient.useHint(...)` 加 `entry.attemptId`。
- **运行过的验证 / Validations run**:
  - `cd calendar-puzzle-miniprogram && npm test` → 213/213 pass（203 + 10 新）
  - `node --check` 4 文件（voucher.js / cloudClient.js / gameScene.js / cloud/functions/useHint/index.js）→ OK
- **已记录证据 / Evidence recorded**: feature_list.json `minigame-known-bugs-batch` evidence 数组追加 Bug #3 两行（根因 + Fix landed）。
- **提交记录 / Commits**: 仍未提交 — 等用户审阅完整批。
- **已知风险或未解决问题 / Known risks**:
  - **客户端代码改完 ≠ 修复生效**：云函数 `useHint` 必须**手动在微信云开发控制台部署**才有去重保护。在部署前，新客户端会向老云函数传 attemptId（被无视），等同 legacy，bug 路径仍存在。建议同步给新 `useHintAttempts` collection 加 `(openid, attemptId)` unique index + `createdAt` 7 天 TTL。
  - 仍无 gameScene 集成测试，3 单修复的接线均未做真机走读。手测 3 条路径详见 session-handoff.md。
- **下一步最佳动作 / Next best action**: (1) 部署云函数 + 真机手测 3 条路径，全过则 evidence 推到 `passing`。(2) 等用户给下一个 bug。

---

### 2026-05-23 (cont.) — bug-batch #2：存档丢失 playedCombos + 完整 scene-state 审计

- **本轮目标 / Goal**: 用户要求 "以防万一你再梳理一下现在存档中需要记录的变量都有哪些 不要再遗漏了 考虑恢复游戏要恢复成和当时一样"，做穷尽审计；然后用户说"补上"，把审计出的唯一 MISSING 项（`playedCombos`）也修了。
- **已完成 / Completed**:
  - **审计**（dispatch Explore agent + 手动核验关键代码）：
    - 表 A（scene-level mutable state）：枚举 createGameScene closure 内所有 var/赋值点，分类成 PERSISTED / TRANSIENT / DERIVED / MISSING。结论：除 `playedCombos` 外，其余都已 PERSISTED 或合理 TRANSIENT/DERIVED。`wonCombos` 是 DERIVED（init 时 `progress.getWonCombos(date, difficulty)` 重读，不是 MISSING；Explore agent 一开始误判，我手动改正）；`isWon` 也是 DERIVED（首次 `checkWin()` 从棋盘重判）；`prePlaced` 严格说也可派生但存着无害（puzzleGenerator 改动的 robustness 备份）。
    - 表 B（跨模块状态）：`stamina` / `progress` / `voucher` / `shareState` / `slotsGlobal.*` 均为设备级持久化，**不应**并入 slot payload — voucher 的 slot-bound 会导致 save-scum。这是设计取舍不是 bug。
  - **修 bug #2 `playedCombos`**（TDD）：
    - RED: tests/slotStore.test.js 加 1 个 `playedCombos` 数字键 round-trip 用例（slotStore 是通用 JSON，立即过 — regression guard）。
    - GREEN: gameScene.js 把 `playedCombos` 声明从行 250 上移到 captureState 之前（避免 var 提升导致首次落盘 undefined），改成 union 合并 `savedState.playedCombos` + 标记当前 combo；captureState 加 `playedCombos: Object.assign({}, playedCombos)`。
    - 旧位置（行 250）的声明 + 当前 combo 标记一并删除。
- **运行过的验证 / Validations run**:
  - `cd calendar-puzzle-miniprogram && npm test` → 203/203 pass
  - `node --check minigame/js/gameScene.js` → OK
  - grep 确认 `playedCombos` 只有 1 处声明（行 133）+ 1 处 reset（行 520 在 `executeRandomSwitch` 内当所有 combo 都已玩过时）
- **已记录证据 / Evidence recorded**: feature_list.json `minigame-known-bugs-batch` 的 evidence 数组追加 bug #2 两行（根因 + fix landed）。
- **提交记录 / Commits**: 仍未提交 — 等用户审阅完整批。
- **已知风险或未解决问题 / Known risks**:
  - 仍无 gameScene 集成测试，bug #1 + #2 的接线均未做真机走读。手测路径见 session-handoff.md。
  - voucher 是否应 slot-bound 是悬而未决的设计问题；当前选择保持设备级。
- **下一步最佳动作 / Next best action**: 用户给下一个 bug 描述继续，或对整批做手测后整理 commit。

---

### 2026-05-23 — bug-batch 修复 #1：存档丢失提示使用状态

- **本轮目标 / Goal**: 用户报：载入存档后，存档不记录提示使用情况（含强提示自动落下的方块）。从 `feature/hint-convert-relax-and-slot-timer` 切 `fix/known-bugs-batch` 分支，承载一批已知 bug；本轮先修第 1 单。
- **已完成 / Completed**:
  - 建分支 `fix/known-bugs-batch`。
  - 根因定位：`gameScene.js:128` `captureState()` 写 `hintsUsed: 0` 占位符且从未持久化 `hintState`；`gameScene.js:121` init 永远 `Hint.createHintState(...)` 起新的。后果：重载存档后 `strongLocked[blockId]` 丢失（强提示自动落下的方块可被双击移除）、`used*` 计数清零（强提示一局 1 次的 cap 被绕过）、`weakLocked` / `mediumLocked` 也丢。
  - TDD 修复：先写 7 个 `Hint.restoreHintState` 失败用例 + 1 个 `slotStore` 嵌套 `hintState` round-trip 用例；watched red；再加 `hint.js::restoreHintState` 纯函数（puzzleId 匹配 + 深拷贝，兼容 legacy / 损坏数据回落到 `createHintState`）；最后把 `captureState()` 改持久化 `hintState`、把 init 改成 `Hint.restoreHintState(...)`。
  - 单测 + 语法 check + 云端字段约束扫描三项均过；CHANGELOG 加 `[0.5.3]` 段；`feature_list.json` 加 `minigame-known-bugs-batch` 条目。
- **运行过的验证 / Validations run**:
  - `cd calendar-puzzle-miniprogram && npm test` → 202/202 pass
  - `node --check minigame/js/gameScene.js && node --check minigame/js/hint.js` → OK
  - `grep` 验证 `cloudSlotSync.js` + `cloud/functions/*` 对 slot payload 字段无白名单 → 加 `hintState` 字段安全
- **已记录证据 / Evidence recorded**: feature_list.json → `minigame-known-bugs-batch` 的 `evidence` 数组（含根因 + 修复落地行）。
- **提交记录 / Commits**: 未提交 — 留给用户审阅后一次性 commit / 等批量 bug 修完再整理。
- **已知风险或未解决问题 / Known risks**:
  - `createGameScene(savedState)` 整链路至今无集成测试 — 本次修复只在单元层证明 `hintState` 持久化 + `restoreHintState` 行为正确，gameScene 接线**未做手测**。需用户在微信开发者工具/真机上跑：发 1 次强提示 → 退首页 → 重入存档槽 → 验证方块仍锁 + 计数保留。
  - 上一份 handoff 的“当前已验证”段写的是 `feature/tutorial-locked-step` 分支（与现实不符），本轮已覆写。
- **下一步最佳动作 / Next best action**: (1) 手测 Bug #1 修复结果，把结果补进 `feature_list.json` 的 `evidence`，过则推 `passing`。(2) 等用户给下一个 bug 描述。

---

### 2026-05-20 — bootstrap agent handoff

- **本轮目标 / Goal**: 引入 walkinglabs 的 agent-handoff 模板 (session-handoff / feature_list / claude-progress)，让多 agent 接力工作不丢上下文。
- **已完成 / Completed**:
  - 新增 `feature_list.json` (4 个 feature 条目；当前 `minigame-tutorial-locked-step` 标 `in_progress`).
  - 新增 `session-handoff.md` (含当前已验证 / 本轮改动 / 仍未验证 / 下一步 / 命令).
  - 新增 `claude-progress.md` (本文件).
  - 在 `CLAUDE.md` 顶部加入 "Agent handoff / 会话接力" 章节 (At session start / While working / At session end / How it composes).
  - **追加**: 在 "Agent handoff" 章节内补充 "Feature lifecycle / 交付后清理" 子节，明确：session-handoff = 快照（overwrite 即遗忘）；claude-progress = append-only；feature_list.json 在分支 merge 到 main 时**删除条目**（或可选 archive 到 `feature_list.archive.json`）；git worktree 并行场景的协调规则。
- **运行过的验证 / Validations run**: 无 — 本轮是脚手架 session，未触碰业务代码或测试。
- **已记录证据 / Evidence recorded**: 无。
- **提交记录 / Commits**: 未提交 — 留给用户审阅后决定是否一次性 commit。
- **已知风险或未解决问题 / Known risks**:
  - `feature_list.json` 中 `minigame-tutorial-locked-step` 标 `in_progress` 是基于分支名 + 近期 commits 推断，需用户确认是否仍在做。
  - `CLAUDE.md` 的 "Mini-program" 段描述 (Taro/TypeScript/yarn @ `calendar-puzzle-miniprogram/CalendarPuzzle/`) 与实际目录 (`calendar-puzzle-miniprogram/minigame/`, 原生 WeChat minigame `game.js`/`game.json`) 不一致，待修正。
  - 根目录未跟踪文件 (`.DS_Store`, `.vscode/`, `a.csv`, `pack_data/`, `CLAUDE.md`) 未处理。
- **下一步最佳动作 / Next best action**: 用户审阅本脚手架；若可接受，下一个 agent/session 应：(1) 读 `claude-progress.md` 与 `session-handoff.md`，(2) 接手 `minigame-tutorial-locked-step`，跑 5 步 onboarding 取证据，(3) 更新 `feature_list.json` 与本文件。
