# Changelog

## [0.7.0] — 2026-05-27

> 硬核模式 — 一键关掉所有辅助（提示 / 换题 / 重开），换"全凭脑子"的专注挑战。可叠加在 5 档已有难度上；通关解锁 "🔥 硬核通关" 标识，按日期 + 难度记录战绩。

### Added
- **硬核开关**（`selectScene` 难度按钮下方一行，🔥 toggle，本地持久化 storage key `calendarPuzzleHardcoreOn`，重启小游戏保留上次状态）。开启后任何底层难度均进入硬核局。
- **游戏内暂停菜单**：左下角 ☰ 按钮（避开微信胶囊菜单），点开弹出锚定 popover（不占半屏，游戏 UI 仍可见）。MVP 三条：`🔥 放弃硬核`（仅硬核局可见，单向降级 + 二次确认）、`🏠 返回首页`、当前题面只读信息。
- **通关结算页 "🔥 硬核通关" 标签**（仅硬核局展示），结算卡自动加高 24px 防遮挡。
- **存档列表 🔥 badge**：继续游戏 / 槽位选择 / 覆盖确认 / 未完成对局四处难度后追加 🔥，一眼区分硬核存档。
- `progress.hardcoreDays` 持久化每日每难度的硬核通关记录（storage key `calendarPuzzleHardcoreDays`）。
- `mode.js` 模块：mode 对象 + capability helpers（`canUseHint` / `canSwapPuzzle` / `canRestart` / `canClearBoard`），未来扩展模式（限时、每日挑战…）的统一容器。

### Changed
- 硬核局控制行折叠为 1 个按钮 "🧹 清空"（替代 "↺ 重开"），**清空时计时器不重置**；提示、🎲 随机、🎯 选题在硬核局不渲染。
- 存档 slot payload 新增 `mode: { hardcore: bool }` 字段；老存档无此字段自动视作非硬核（向后兼容，无需迁移脚本）。
- `createGameScene(...)` 入参增加第 7 位 `modeOpts`；`selectScene` `onSelect(difficulty, savedState, modeOpts)`；`main.js` 三层透传。

### Fixed
- `gameScene.js` `padBottom` ReferenceError — ☰ 按钮位置误引用了 `computeLayout` 内的局部变量，改用闭包绑定的 `safeInsets.bottom`（与帮助弹窗、胜利卡片的写法一致）。

### Tests
- 新 `tests/mode.test.js`：mode 模块全分支（7 用例）。
- 新 `tests/progress.hardcore.test.js`：hardcoreDays 持久化 + 幂等 + 跨难度并存 + storage round-trip（5 用例）。
- `tests/slotStore.test.js` +2：`mode` 字段 round-trip + 老 payload 无字段回读。
- `npm test` 总数 234 → 248（+14），全绿。

### Manual verification required (真机 / 微信开发者工具)
- 见 `docs/superpowers/specs/2026-05-27-hardcore-mode-design.md` §6.2 (1-8)。
- 额外验证：
  - ☰ 按钮在左下角不撞胶囊菜单 + popover 锚定 ☰ 上方弹出，点 ☰ 外任意位置关闭。
  - 存档列表硬核局难度后显示 🔥；非硬核老存档无此后缀。
  - 硬核开关重启小游戏后保留上次 ON/OFF 状态。
  - 硬核 expert 通关 → 结算页 "🔥 硬核通关" 不与时间行重叠。

## [0.6.0] — 2026-05-27

> 中提示位置违规检测 — drop 后如果跟中提示对不上，弹个对话框让玩家立刻取回重选。

### 改动一览

- **中提示不一致对话框**：drop 后如果（a）刚放的方块占了别的方块的中提示位，或（b）刚放的方块是被中提示的那一块但没盖全提示位，弹一个白底圆角对话框。主按钮「取回并重新选中」一键撤回 + 自动选中那块；次级文字按钮「本局不再提示」整局闭嘴；右上角 × 仅关闭这次（下次再违规还弹）。
- **跨重载**：「本局不再提示」状态搭车 `hintState.mediumMismatchIgnored` 走存档；同一道题恢复后继续闭嘴，换题或新开局自动重置。

### 详情

- `hint.js` 新增纯函数 `findMediumMismatch(state, blockId, blockCells)` + `setMediumMismatchIgnored(state)`，检测逻辑优先级：自己有中提示但没盖全 → `right-block-wrong-loc`；别的块的中提示位被占 → `wrong-block-on-hint`；都没命中返回 null。一次 drop 最多弹一次（找到第一个违规就返回）。
- `gameScene.js` `placeBlock` 末尾、`checkWin` 之前插入检测调用；触发时模态层渲染对话框、tap handler 接管所有点击直到关闭。modal state 是 in-memory（`var mediumMismatchModal = null`），不参与存档；`hintState.mediumMismatchIgnored` 持久。
- `restoreHintState` 兜底新字段：缺字段 → 默认 `false`，向后兼容历史存档。`applyWeak`/`applyMedium`/`applyStrong` 全部转写新字段，避免下一次提示把 ignored 状态吃掉。

### 测试

- `tests/hint.test.js` +14 用例：`createHintState` 字段默认、`restoreHintState` 缺字段 / `true` round-trip、`applyWeak/Medium/Strong` 各自的字段保留回归、`findMediumMismatch` 全分支（null / right-block / wrong-block / 优先级 / blockCells null/空 / 不受 mediumMismatchIgnored 影响）、`setMediumMismatchIgnored` 不可变性。
- `npm test` → **234/234 pass**。
- gameScene 模态渲染 + tap：无单元测试 harness，手测路径见下方。

### 手测路径

1. 任意题打开 → 用中提示在 A 块上揭一格 → 把 B 块（≠ A）拖到那一格 → 对话框弹出，文案带两个块的 mini-icon → 点「取回并重新选中」→ B 块回 palette 并自动选中。
2. 同上揭 A 块一格 → A 块拖到别处（没盖到提示位）→ 对话框弹「你刚把 A 放到了别的位置」→ 关 × → 下次再这样放还弹。
3. 同上揭 A 块一格 → B 块拖到提示位 → 点「本局不再提示」→ 之后再随便错放都不弹 → 退游戏 → 从存档恢复 → 错放还是不弹。换题或新开局后恢复弹。
4. 教程模式 / 存档 `initialDropped` 自动放置不走 `placeBlock` → 不弹。

## [0.5.5] — 2026-05-25

> 退出时自动占用第一个空的命名槽位，避免新对局沉到临时槽里被下次会话遗忘。

### 改动一览

- **退出自动存名槽**：当前对局**没绑命名槽**（新开局，或从临时槽恢复）时，按 back / 切后台 / 杀进程 触发的自动存档，会优先写入第一个空命名槽（named-1 → named-2 → named-3）并自动绑定到该槽。三个命名槽都满了才回落到临时槽（保留旧行为）。已绑命名槽的对局不变，仍写入自己绑定的那一槽。

### 为什么

之前：新开局或从临时槽恢复的对局，所有自动存档都落临时槽。下次会话用户必须主动从"继续上次"入口才能恢复，否则在槽位列表里看不到。  
现在：只要还有空名槽，新对局会主动占一槽，下次会话直接在槽位列表里看到，跟手动 💾 保存的对局对齐。命名槽满了再回落临时槽，行为不打破。

### 详情

`tempSlot.flush()` 扩展接受 `{ preferEmptyNamed: true, namedSlotIds: [...] }`：
- 已绑命名槽 → 直接走 bound 路径（不动）。
- 未绑命名槽 → 扫 `namedSlotIds` 找第一个 `readSlot() === null` 的槽，把当前 pending（或如果 pending 是空、直接读 TEMP 现有记录）写进去，删掉 TEMP 记录，给 binding bind 到新槽。
- 没空槽 → 回落老路径：pending 写入 bound|TEMP。

`gameScene.flushSaveNow()`（4 个 exit 调用点 + `scene.onHide`/wx.onHide 共用同一个 helper）改成 `_tempSlot.flush({ preferEmptyNamed: true, namedSlotIds: NAMED_SLOT_IDS })`。其它路径（定时 debounce、放/拿/重置方块时的 markDirty）继续走老 flush，写 bound|TEMP——只有"退出"才触发挤压。

### 测试

- `tests/tempSlot.test.js` +7 用例：未绑 + named-1 空 → 写 named-1 + 删 temp + bind；未绑 + named-1 已用 + named-2 空 → 写 named-2；3 槽全满 → 回落 temp；已绑 → 尊重 binding 不挤压；`flush()` 无 opts → 旧行为不变；pending 为空但 temp 有记录 → 提升现有 temp；pending+temp 都空 → no-op return null。
- `npm test` → **220/220 pass**（213 + 7）。

### 手测路径

- **空槽 → 新对局自动占**：清掉所有槽（删 named-1/2/3） → 新开一局 → 玩几步 → 按返回 → 进选择场景看槽位列表：应该看到 named-1 已占当前对局。
- **占用 → 跳到下一空槽**：手动 💾 保存到 named-1 → 新开第二局 → 退出 → named-2 应该被自动占。
- **全满 → 回落 temp**：所有 3 个命名槽都有数据 → 新开一局 → 退出 → 槽位列表显示三个原槽未变；"继续上次"入口能看到这一局（从 temp 恢复）。
- **已绑不挤压**：从 named-2 恢复一局 → 玩几步 → 退出 → 名 1 仍空 → named-2 被覆盖更新（不要被挤到 named-1）。

## [0.5.4] — 2026-05-25

> 已知 bug 批修 5 单：存档恢复（hintState + playedCombos）、用券防回滚（useHint 幂等化）、失眠难度卡顿（删死代码）、拖出棋盘自动选中。

### 改动一览

- **存档恢复完整**：上次发的提示（含"强提示锁定方块"）和"已尝试过的 combo"现在会一起存进存档槽，重新加载游戏不再丢失。
- **用券不再"鬼回血"**：用一张社交券（分享/助力券）后，就算被微信杀进程也不会在重进时把已用的券数加回来。
- **失眠秒开**：选"失眠"难度进入立刻可玩，不再卡 1–5 秒。
- **拖出 = 选中**：把棋盘上的方块拖出棋盘，立刻进入"已选中"态——可以直接点新位置放下，或者用旋转/镜像按钮调整，省一次点击。

### ⚠️ 上线步骤

1. **必须先在微信云开发控制台手动部署 `useHint` 云函数**——否则"用券不回血"那条修复客户端单方面无效（attemptId 会被老云函数无视，等同 legacy 行为）。其它 4 条修复纯客户端，发版即生效。
2. 新 collection `useHintAttempts` 由云函数首次写入时自动创建，不必手动建表。建议运营一段时间后给 `(openid, attemptId)` 加 unique index + `createdAt` 加 7 天 TTL。

### 手测路径（gameScene 整链路无集成测试，必须真机走一遍）

1. **存档保留提示状态**：发一次强提示锁住某方块 → 退首页/切后台 → 从存档槽重入 → 该方块仍无法双击移除，"强提示 1/1" 计数还在。
2. **存档保留 combo 历史**：多次随机换题 → 退出 → 重入存档 → 再点"随机换一题" → 不会立刻又抽到刚刚弃局的 combo。
3. **用券防回滚**：用一张社交券 → 立刻杀进程 → 重新进入 → 券数 N-1 不变。云开发后台 `hintGrants` 表对应 grant 的 `usedAt` 已落，`useHintAttempts` 表有对应 attemptId 记录。
4. **失眠秒开**：选"失眠"难度 → 立刻可拖动方块/触摸响应，不再有 1-5 秒卡顿。
5. **拖出自动选中**：板上方块拖出 7×8 区域 → 候选卡片高亮（已选中态），旋转/镜像按钮立刻可用，点新位置直接放下。

### 详情 — Bug #5: 拖块出棋盘后未自动选中

**症状**：把棋盘上的方块拖动到棋盘外（完全脱出 7×8 区域）会被放回候选区，但 `selected` 被设成 `null`。玩家想立刻在另一个位置点放下，得先点候选卡片重新选中——比点击候选直接选中多一步。

**改法**：`gameScene.js:2413` 把 `selected = null` 改成 `selected = rbOff`（rbOff 就是刚 push 进 palette 的那个 block）。拖出 = 选中。语义跟"点击候选卡片"对齐：放回 palette 同时进入「待放下」态，旋转/镜像按钮、tap-to-place、preview ghost 立刻可用。

注意：双击移除（`removeDropped` at :462）依然 `selected = null`——那是"我不想要这个块了"的语义，与拖出"我想换地方放"不同。如果你也想让双击移除选中，告诉我。

### 详情 — Bug #4: 进失眠难度卡 5 秒

**症状**：选择"失眠"难度后界面卡顿 5 秒（不响应触摸 / 动画暂停）才能正常游玩。其它难度顺滑。

**根因**：`gameScene.js` init 时启动一个 `setTimeout(50ms)` 调用 `PG.countSolutionsForCombo`，结果赋给 `solutionCount` 变量并触发 `scene.dirty = true` 重画。但 `solutionCount` 在整个 minigame codebase 里**没有任何读取点**（grep 零结果）。0.3.0 UX 重写（commit `f0dc6bc`）把展示位置删了，但忘了删这段计算。

为什么只有失眠明显：失眠 `digCount=10` 表示棋盘上 10 块全部要玩家放，留下的空格大，DLX 穷举所有解时数量爆炸。实测今日（2026-05-24）：
- easy/medium/hard：1-3 解，3-4ms
- expert：7 解，10ms
- **insomnia：877 解，247ms（开发机；真机 5-20× 慢 → 1-5s 卡顿）**

**改法**：删 3 处共 ~9 行死代码：
- `gameScene.js:266` `var solutionCount = -1;`
- `gameScene.js:289-294` `setTimeout` + `countSolutionsForCombo` 调用
- `gameScene.js:2566` `clearTimeout(solutionCountTimer)`（destroy 时）

保留：`puzzleGenerator.js::countSolutionsForCombo` 函数本身 + 导出 — 公共 API，未来调试/统计可能再用，且无调用者不再拖慢任何路径。

### 详情 — Bug #3: useHint 不幂等 → 用券后重入数量被恢复

**症状**：玩家用一次提示消耗一张助力券（或任意社交券），后台/杀进程退出再进入游戏后，券数没变还能再用。

**根因**：`cloudClient.useHint` 没有幂等键。最常见路径：
1. 用户点用券 → `voucher.applyUsed` eager 扣减本地 balance + 入 `pendingUse` 队列 + 持久化。
2. `cloudClient.useHint` 请求飞出，cloud 端**成功**标记 grant `usedAt`。
3. 但响应回客户端时 scene 已销毁 / 微信把 JS runtime 后台挂起 → `confirmUseSynced(true)` 这条 callback 没跑到 → 本地 `pendingUse` 里那条记录没出队。
4. 用户下次冷启动 → `main.init()` 跑 `flushPendingUse`，对那条 pending 重发 `useHint`。
5. Cloud 这一次返回 `{ok: false, reason: 'no-grant'}`（grant 已用），客户端走 `_rollback` 把本地 balance 加回来。`reconcile` 通常能纠正，但**网络稍差或时序错开**就留下"券回来了"的可见 bug。

**改法（幂等化）**：
- 客户端 `voucher.applyUsed` 现在为每个 pending 条目生成 `attemptId`（`Date.now()` + 随机 8 位），存入 `pendingUse` 条目内一同落盘。
- `voucher.applyUsed` 改成返回该条目（之前是 void），调用方拿 `entry.attemptId` 透传给 `cloudClient.useHint`。
- `cloudClient.useHint(type, puzzleId, attemptId)` 签名扩展。`flushPendingUse` 重试时也用 `item.attemptId`。
- **云函数 `useHint`**：进来先按 `(openid, attemptId)` 查新 collection `useHintAttempts`；命中就 replay 缓存的 response 不再 claim；未命中就走原 cap-check + claim 流程，结束时写入 `(openid, attemptId, response, createdAt)`。
- 兼容：缺 `attemptId` 走 legacy（不去重）→ 老客户端 / 老云函数任一边没升级，仍然可用，只是失去幂等保护。两端都升级才彻底修。

### 详情 — Bug #1: 存档丢失提示状态（含强提示锁定方块）

- `captureState()` 之前只塞了占位符 `hintsUsed: 0`，从来不持久化 `hintState`。重新载入存档后：
  - `strongLocked[blockId]` 丢失 → 强提示自动落下的方块可被双击移除（`isFullyLocked` 拦截失效）；
  - `usedWeak/Medium/Strong` 计数清零 → 强提示一局 1 次的上限被绕过，玩家能在同一道题上无限再发强提示；
  - `weakLocked` / `mediumLocked` 也一并丢失 → 弱提示锁的朝向、中提示已揭示的格子在重载后失效。
  改法：`captureState` 把 `hintState` 直接落入 slot payload；`createGameScene` 初始化时改调新加的纯函数 `Hint.restoreHintState(saved, puzzleId)` —— 有合法旧状态就深拷贝，puzzleId 不匹配 / 缺字段 / 数据损坏一律回落到 `createHintState`，兼容历史存档。

### 详情 — Bug #2: 存档丢失 playedCombos

- `playedCombos`（本局已尝试的 combo 索引集合）只挂在 `puzzle._playedCombos` 上随 scene 共生死，从未进入 slot payload。重载存档后该集合清空 → `executeRandomSwitch` 把刚弃局的 combo 又抽中。改法：`captureState` 加 `playedCombos`；scene init 时 union 合并 `savedState.playedCombos`，最后再 `playedCombos[当前 combo] = true`。声明位置上提到 `captureState` 之前，避免 `var` 提升导致首次落盘 `playedCombos === undefined`。

### 测试

- `tests/hint.test.js` +7 用例（`restoreHintState` 全分支 + 强提示重载回归用例）。
- `tests/slotStore.test.js` +2 用例（嵌套 `hintState` round-trip + `playedCombos` 数字键 round-trip）。
- `tests/useHint.test.js` +5 用例（attemptId replay 缓存 / 业务失败缓存 / 无 attemptId legacy / 不同 attemptId 各自 claim / 按 openid 隔离）。
- `tests/voucher.test.js` +5 用例（applyUsed 返回 entry / entry 有 attemptId / 唯一性 / 跨 storage round-trip / flushPendingUse 透传 attemptId）。
- `npm test` → **213/213 pass**。

## [0.5.2] — 2026-05-22

> 提示兑换 UX 放宽 + 修掉 3 个存档恢复 bug（计时归零 / 计时停在上次操作 / 跨日日期 marker 错位）。

### 强提示兑换 UX

- **提示面板**：中/强 tier 卡片右侧多了一个竖向紫色「2 / ↓ / 1」按钮，点击直接消耗 2 张中提示换 1 张强提示，结果以 toast 反馈。中券 < 2 张时按钮隐藏、卡片回到全宽。
- **体力确认弹窗（强档）**：在原「否/是」之上多了第三个按钮「用 2 张中提示兑换」，强档 + 中券 ≥ 2 张时出现。弹窗高度从 220 增加到 270 容纳。
- **兑换门槛放宽**：现在**任意来源**的中提示券都能 2 → 1 换强（群分享 / 邀请好友助力 / 体力买的中提示都算），不再限定"助力"来源。云函数 `convertHelpToStrong` 同步去掉 `source: 'help'` 过滤；错误码 `insufficient-help-credits` → `insufficient-medium-credits`（客户端兼容新旧两种）。

### 顺手修复（存档恢复）

- **0.5.0 计时器归零**：恢复存档时 `var timer = 0;` 因为 hoisting 顺序晚于 `savedState.elapsedMs` 还原，导致还原值被覆盖回 0。声明上移到与 `dropped` / `palette` 同级。
- **0.5.0 退出快照陈旧**：`_tempSlot.flush()` 只写最近一次 markDirty 的 payload，但 markDirty 只在放/拿方块时触发 —— 静置一段时间后点返回 / 切后台 / 进悬浮窗，落盘的 `elapsedMs` 仍是上次操作时的秒数。新增 `flushSaveNow()` 在所有退出路径（返回按钮 / 教程跳过 / 胜利返回 / 💾确认 / `wx.onHide`）先 `markDirty(captureState())` 抓最新 timer 再 flush。
- **跨日恢复 marker 错位 + 通关失败**：`getUncoverableCells()` 没传日期参数，兜底成今天。导致跨日恢复存档时：(1) 棋盘金色 marker 显示今天的月/日/周几而非存档当天的；(2) 放置判定 & 胜利判定都按今天的 marker 算 —— 跨天存档**根本无法完成**。改为 `getUncoverableCells(PG.parseDateStr(puzzle.dateStr))`。

### 小调整

- 弱提示文案：「弱：揭示方向（旋转+镜像）」→「弱：揭示（固定）方块朝向」
- 0.5.0 CHANGELOG「系统手势调整」一条加了 2026-05-22 更正：小游戏**不支持**左边缘右滑收悬浮窗系统手势（[官方答复](https://developers.weixin.qq.com/community/minigame/doc/0006ca0d65c550653e09102d45b400)）；当初移除的手势是对的，但理由是错的。

### ⚠️ 上线步骤

- 云函数 `convertHelpToStrong` 必须**手动在微信云开发控制台部署**才会生效。函数名保留（向后兼容老客户端），语义已放宽到任意来源中提示。部署前客户端兑换按钮虽然显示（前端门已放开），但实际 RPC 会撞老逻辑返回 `insufficient-help-credits`，客户端 toast 仍读「需要 2 张中提示」—— 不会误导用户但实际不会兑换成功。

### 已知遗留

- `createGameScene(savedState)` 整链路仍无集成测试。这次 3 个存档恢复 bug 都是手动发现的；建议下一轮补一组 mock-wx 集成用例覆盖 timer / uncov / 退出落盘三条路径。
- 客户端 `voucher.applyGranted('strong', ...)` 是 eager grant，但 medium 余额的 -2 要等下一次 `reconcile` 才同步 —— 中间有几百毫秒的 UI 错配窗口（pre-existing，不在本次范围）。

## [0.5.1] — 2026-05-21

> 存档槽位云同步：3 个命名槽位现在跨设备同步，登录后自动 newer-wins 合并。

### 跨设备同步

- 命名槽位（3 个）现在镜像到微信云端。登录后自动 pull 云端 → 与本地 newer-wins 合并 → push 回云端。换设备登录同一个微信号，存档跟着走。
- 临时槽不上云（继续保持纯本地崩溃保护语义）。
- 触发时机：
  - **登录成功后**：跑一次 mergeOnLogin。
  - **`wx.onShow`（回前台）**：再跑一次 mergeOnLogin，及时拉取其他设备的更新。
  - **保存到命名槽 / 覆盖 / 胜利清槽**：fire-and-forget push 到云端。
  - **`wx.onHide`（切后台 / 进悬浮窗）**：把绑定的命名槽 push 一次，确保切走前的最新进度在云端。
- 网络失败自动重试（指数退避 1s / 3s / 9s，最多 3 次），失败后静默丢弃 —— 下次 mergeOnLogin 会修复。

### 工程基础

- 1 个新云函数 `syncSlots`：单 RPC 完成 upload + download + merge。基于 `@cloudbase/node-sdk`，与 `listGrants` 等其他云函数同款脚手架。
- 1 个新客户端模块 `cloudSlotSync.js`：mergeOnLogin + pushNamedSlot + 内部重试队列。
- 195 / 195 node --test 通过：9 个 syncSlots 云函数测试（cloud-mock 驱动）+ 9 个 cloudSlotSync 客户端测试（fake cloudClient + fakeTimer 驱动）。
- 云端表 `saveSlots`：一行一个 (openid, slotId)，含 `payload` / `savedAt` / `deletedAt` 字段，per-user 隔离。Tombstone 保留（不真删行），保证 newer-wins 在跨设备删除场景仍正确。

### ⚠️ 上线步骤

- `syncSlots` 云函数必须**手动在微信云开发控制台部署**才会生效，纯小游戏代码部署不会自动部署云函数。

### 顺手修复

- **0.5.0 临时槽遗漏**：3 槽满 / 不满都不是前提；只要点难度进游戏、不放块直接返回，临时槽不会被写入，下次进新局也不弹"继续/放弃"。现在 `createGameScene` 初始化时立即 stamp 一次状态到当前活跃槽（temp / 绑定的命名槽），保证"开了就退"也算一局可恢复。教程不受影响。

### 已知遗留

- 游戏中每秒的节流写不上云（避免高频 RPC）—— 云端只在显式保存 / 切后台 / 胜利时同步。强杀时如果距离最近一次 onHide 太久，云端可能滞后几秒；本地仍是最新的。
- 没有冲突解决 UI：跨设备 newer-wins 是隐式的，玩家不会被告知"你的存档被另一台设备的新版覆盖了"。

## [0.5.0] — 2026-05-21

> 存档槽位上线：3 个命名槽 + 1 个临时槽，自动保存到当前活跃槽。从此停下来去做别的事不再丢局，"继续游戏"入口随时回到之前的进度。

### 3 个命名槽 + 1 个临时槽

- 每盘游戏有一个「当前保存目标」：默认 = 临时槽，玩家通过游戏内的 💾 按钮选择一个命名槽后自动改写到该槽。
- 保存节奏：节流 1 秒，每次方块动作后自动落盘 —— 一旦绑定到命名槽，玩家不需要重复按 💾。
- 槽位冻结上下文：原 `(date, difficulty, comboIndex)` + 棋盘 + 计时，跨日读档仍是同一道题。
- 胜利清槽：通关后绑定的槽位自动清空。

### 主菜单「继续游戏」入口

- 主菜单加一个「继续游戏」一级入口，没存档时灰色禁用。
- 点进去显示三个槽位缩略图 + 难度 + 日期 + 保存时间，点缩略图直接读档。
- 缩略图复刻手动选题的小棋盘风格：锁定方块用统一灰色，玩家放置的方块保留各自颜色，日期标记金色。

### 临时槽崩溃保护

- 游戏中每次方块动作 → 1 秒后自动写临时槽，悬浮窗 / 切后台 / 强杀都能恢复。
- `wx.onHide` 把待写状态立刻 flush 落盘。
- 临时槽全局共享：任何难度的新游戏开始前若临时槽有内容，弹「还有未完成的对局」对话框：
  - 「继续未完成」：不扣体力，恢复原局。
  - 「放弃，开新局」：扣体力开新难度，临时槽清空（按钮上方小灰字标新难度名）。
  - 「×」：弹窗消失，临时槽保留，玩家停留在主菜单（什么都不变）。

### 满槽覆盖警告

- 3 个命名槽都占用时点 💾 → 红色「⚠️ 槽位已满 — 覆盖哪个？」弹窗。
- 3 个槽显示保存时间，「(最旧)」/「(最近)」标注便于选择。

### 系统手势调整

- 去掉游戏内的左边缘右滑回主菜单手势。回主菜单只剩右上角「返回」按钮。
  > **更正（2026-05-22）**：原本写"与微信'右划收进悬浮窗'系统手势冲突"是误判 —— 小游戏**不支持**左边缘右滑收悬浮窗这一系统手势（[官方答复](https://developers.weixin.qq.com/community/minigame/doc/0006ca0d65c550653e09102d45b400)），收进悬浮窗只能走右上角胶囊菜单。手势已删除，但实际不存在要避让的系统手势；不 revert，仅更正措辞。

### 工程基础

- 5 个新模块（`slotStore` / `tempSlot` / `slotBinding` / `slotUI` / `slotsGlobal`），各自职责单一、可独立测试。
- 178 / 178 node --test 通过：slotStore CRUD + schema 迁移、tempSlot 节流 + 路由 + cancelPending、slotBinding 状态机、slotUI 布局 + 命中测试。
- 槽位 schema v1：`{ schemaVersion, slotId, boundSlotId, savedAt, date, difficulty, comboIndex, placedBlocks, paletteBlocks, prePlacedBlocks, elapsedMs, hintsUsed }`。stamina / voucher 余额不入槽。
- 难度文案统一从 `puzzleGenerator.DIFFICULTY_CONFIG` 读，slotUI 不再有冗余的难度映射。

### 已知遗留

- 跨设备云同步（P3）：登录后异步镜像命名槽到云端、newer-wins 合并 —— 留给下个版本。本次仅本地存储，换设备槽位不跟随。
- `hintsUsed` 字段当前固定 0，捕获 hintState 用量是后续 polish 工作。

## [0.4.0] — 2026-05-20

> 社交助力系统正式上线（plan 2c + 2d）+ 体力消耗确认弹窗 + 大量 UX/工程修复。

### 群分享换中提示券（plan 2c）

- 提示弹窗里点「中」/「强」，体力 + 助力券都不够时，弹出「获取路径」二级菜单。
- **群分享换中提示**：选「群分享换 1 张中提示」→ 转发到群 → 云端验证（同群同日不重复）后到账 +1 张中提示券。
- ⚠️ 真机解密链路目前是 stub（`shareGroup` 的 `getOpenData` 因 SDK 迁移待接 OpenAPI），换券会返回 `decrypt-failed`。详见 `docs/superpowers/plans/2026-05-20-share-group-decrypt-followup.md`。

### 邀请好友助力（plan 2d）

- **邀请链接**：从二级菜单点「邀请好友助力」→ 转发到好友/群，分享链接带签名 token（HMAC，当天有效），防止伪造。
- **每个朋友点链接 = 你 +1 张中提示券（助力专用）+ 朋友 +1 张弱提示券**。
- **2 张助力中可兑换 1 张强提示券**：助力中累积 ≥ 2 张时，二级菜单出现「兑换强提示」按钮，主动消耗。普通中提示券（群分享 / 体力买的）**不可兑换**，严格区分。
- 提示弹窗底部常驻「邀请好友助力（今日 N 次助力）」入口，方便随时邀请、查看今日累计。
- 朋友点链接进入小游戏时，会弹「👏 助力成功 · 已为 Ta 助力 · +1 张弱提示已到账」modal；当天已助力过同一邀请人时，弹「今日已助力 · 弱提示先前已到账」。

### 体力消耗确认弹窗

- 选完提示档（强/中/弱）后，**有助力券就优先用券**，不消耗体力（之前默认走体力，体感不明显）。
- 没券需要扣体力时，弹出确认 modal：「使用 X 提示将消耗 N 体力 · 当前体力 X / Y」+ 是 / 否。
- 勾选「今天不再提醒」→ 接下来的同类操作直接扣体力不再弹，**次日 5 点自动失效**。
- 首次免费的弱提示（cost = 0）不弹。

### 助力券系统（本地优先 + 云端同步）

- **本地优先**：用券立即扣本地余额，UI 立刻反映；离线状态下用券也能正常进行，离线操作攒在队列里。
- **有网时自动批量同步到云端**：冷启动 / 切回前台 / 群分享 / 兑换强 / **每次打开提示弹窗**都会自动跑一次同步，确保「剩余 N 张」永远是最新值。
- 云端拒绝（业务错误 / 券真的没了）→ 自动回滚本地余额。

### UX 优化

- 提示弹窗高度加大到 340，第三档（强提示）行不再被遮挡。
- 「本关已用 N」改成「本关 N/上限」格式（如 `本关 0/3`），剩余空间更直观。
- 弱提示档对齐 `1 体力 · 剩余 N · 本关 N/3` 格式，移除 `/ 关` 后缀。
- 邀请助力底部 chip 文案：`今日 0 次助力 · 已获取中提示 0 次`，含义更明确。

### 重要修复

- **SDK 迁移遗留 bug**（最坑）：之前迁移 wx-server-sdk → @cloudbase/node-sdk 时，所有 `add({ data: {...} })` / `update({ data: {...} })` 没改成 top-level 写法，导致迁移后所有发券 / 写助力记录 / 写用户行的字段都嵌套在 `data` 子对象下，listGrants 查不到 → 「剩余 N 张」永远停在迁移前的几张。6 个云函数全修：`grantHint` / `helpInvite` / `shareGroup` / `convertHelpToStrong` / `login` / `useHint`。
- **助力成功 modal 漏渲染**：冷启动后 helper modal 在某些时序下没渲染（用户点击难度后场景已切到 gameScene）。修：tryConsumeInviterLink 成功/重复都强制 `goToSelect()` 保证 modal 一定渲染。
- **warm-show 不刷新**：切后台再回到前台不会重新同步云端余额。修：加 `wx.onShow` 监听，回前台自动 reconcile + 重新处理 invite link。
- **券余额跳回旧值**：随机切下一题后「剩余 N」可能跳回原始值（之前 race：boot flush 清空 pending 但 reconcile 还没跑）。修：改用 eager-decrement 模型，applyUsed 立即扣本地余额，confirmUseSynced 处理云端回包。

### 工程基础

- 云函数全部走 `@cloudbase/node-sdk`（旧的 wx-server-sdk 完全移除），用 `tcb.SYMBOL_DEFAULT_ENV` 替代硬编码 env id。
- `helpInvite` 加 `ALLOW_SELF_HELP_OPENIDS` 环境变量（逗号分隔 openid 白名单）方便单设备 E2E 调试；**生产环境务必不配置**。
- 测试覆盖：93 / 93 node --test pass。涵盖 voucher 模块所有路径（eager-decrement、reconcile-subtract-pending、confirmUseSynced ok / !ok、helpMedium dip）+ 所有云函数 `_impl` 路径。

### 已知遗留

- shareGroup 真机解密路径（getOpenData stub）— follow-up 见 [share-group-decrypt-followup.md](../../docs/superpowers/plans/2026-05-20-share-group-decrypt-followup.md)。
- 迁移期间因 SDK shape bug 写入云端的「嵌套 data 子对象」旧行 listGrants 看不到（不影响新流程），可在 cloudbase 控制台手动清理。

## [0.3.4] — 2026-05-19

> 三级提示系统上线 + 云开发后端基础就位。

### 三级提示系统（💡 菜单升级为三档）

- **弱提示**：1 体力，揭示该方块在解里的正确朝向（旋转 + 镜像）。托盘里的方块自动转到正确姿态，朝向锁定后旋转 / 镜像按钮被禁用；放错位置的块会自动弹回托盘。
- **中提示**：2 体力，揭示该方块在解里**一格 cell 的位置**（不告诉朝向）。**可对同一方块重复中提示**，每次随机揭示一格未揭示的 cell；位置以方块色描边 + 中心点高亮，在已放置块上也清晰可见。
- **强提示**：6 体力，直接把方块放到正确位置 + 正确朝向。该位置上的挡路块自动弹回托盘。强提示锁定的方块**不能双击移除**也**不能被拖动**（双击有 modal 提示）。
- **首次免费**：每关第一张弱提示免体力，照顾"刚开始毫无头绪"的新手场景。
- **每关上限**：弱 3 / 中 3 / 强 1，下关重置。文案显示 "本关已用 N"，达到上限显示 "本关已用完 · 下关重置"。
- **方块选择面板**：从托盘 + 已放置块里挑，缩略图显示块形状，已提示过的方块带 ✓ 标记。

### 微信云开发基础（玩家不可见，但已就绪）

- 接入云开发环境，4 个云函数（登录 / 发券 / 用券 / 查券）+ `hintGrants` 数据表。
- 服务端强制每关用券上限，防止前端绕过。
- 为后续社交功能（分享换提示、看广告换提示、好友助力、好友榜）打基础。

### UX 优化与修复

- 中提示位置标识改为方块色描边 + 中心点（之前的 35% 透明遮罩压在已放块上看不清楚）。
- 中提示对不对称块（J / S / Z）的标识落在该块实际占用的格子上（不再是 bounding-box 原点 —— 对这些形状原点可能不属于块）。
- 强提示锁定的块拖动也被拦截（之前 touchMove 阶段会先从棋盘弹出，造成短暂消失闪烁）。
- 选档后没点块就 "返回" 不会扣体力（之前选档时就扣，对玩家不友好）。
- 提示菜单"返回 / 取消"按钮不再遮挡第三排方块（弹窗高度统一为 290px，第三排和按钮间有 18px 间隙）。
- 提示上限文案从 "0/3" 改为 "本关已用 N"，避免被误解为"全局只能用 3 次"。

## [0.2.0] — 2026-05-14

> 自 `v0.1.0` 以来的第一次正式 tag 发布。涵盖了过去几天里所有交互、视觉、玩法和工程层面的大改。

### 分享与可复现谜题

- **邀请朋友挑战**：通关后弹窗与棋盘下方都有「🎯 邀请朋友挑战这一题」按钮，一键拉起微信好友选择面板。分享卡片标题随当前难度变化。
- **可复现谜题深链**：分享 query 携带 `d`（难度）/`c`（combo 索引）/`date`（题目日期）。朋友点开冷启**直达同一题**，跳过难度选择，且**不消耗体力**。
- **WeChat 分享菜单接入**：右上角胶囊菜单显示「转发」和「分享到朋友圈」。

### 谜题空间扩展

- **多基底解 pack 接入（免费版）**：按 `(月, 日, 星期)` 索引的解 pack 直接打进主包，每键 20 个不同的完整解，gzip 后 ~690 KB。每次换题不仅块的组合不同，**整张棋盘的底盘布局**也可能不同。
- **单日可玩题量大幅提升**（2026-05-14 为例）：等电梯 ~50 → **727**，等公交 ~100 → ~2000，普通人 ~30 → ~600，蹲坑 ~10 → **199**。
- **`gen_pack.py` 离线 pack 生成器**：支持 `--top-k`（免费版）/ `--all`（付费版）/ `--parallel` 多核加速。

### 进度与最佳时间

- **持久化通关记录**：按"日期 + 难度"分桶记录已通关的 combo 索引（`wx.setStorageSync`，key = `calendarPuzzleWonCombos`），冷启动 / 返回主菜单 / 好友分享链接进入同一谜题都能看到完成状态。
- **手动选题面板「已通关」绿勾**：每个缩略图右上角根据当前 `(日期, 难度)` 桶显示绿底白勾，再也不会反复刷到同一题。
- **最佳通关时间（PB）**：按"日期 + 难度"自动记录，通关弹窗对比显示新纪录或旧最佳。
- **「今日已通关 N 题」chip**：选难度页显示当日累计通关数。

### 顶部信息架构（UX 全面重构）

- 难度提升为正中主标题（22px 粗体），副标题给出"约 X 分钟"时间锚点。
- **难度命名换梗**：黑铁/白银/黄金/钻石 → **等电梯 / 等公交 / 普通人 / 蹲坑**，比金属段位更有梯度直觉。
- 计时器降级（13px、灰色、副位）。
- **"解法 N" 隐藏**：对玩家无意义、且容易引发"是不是只有 1 解我还做不出来"的焦虑。
- 体力胶囊带恢复倒计时 `↻ mm:ss`，并挪到难度行右侧（不再和 WeChat 菜单挤同一行、和大标题撞色）。
- 返回箭头加圆形按压态背景，hit area 由 28px 扩到 44px。

### 控制行

- 紫色"换题"大按钮消失，整合为**单行 4 个等宽按钮**：💡 提示 / ↺ 重开 / 🎲 随机 / 🎯 选题。
- **↺ 重开**：把当前题已放下的方块全部收回 palette，无体力消耗。
- 随机 / 选题切换显性化为两个独立按钮，当前模式高亮品牌绿。
- **题目总数 `(199)`、`(1819)` 等数字隐藏**。
- 颜色统一收敛到品牌绿 `#43A047` + 中性灰，紫 / 青 / 橙杂色全部下线。

### 棋盘视觉

- **月份格 / 日期格 / 星期格语义视觉化**：月份左上小圆点、星期下划线、日期保持纯净 —— 不靠纯色就能分辨结构。
- **今日标记换色**：深橙 `#FF7043` 撞橙色 pentomino → **深金 `#FFB300` + 深金描边**。
- **已固定方块**：透明度 0.6 → **0.92** + 左上角 🔒 角标 + 双击 toast"题面方块不可移除"。
- **角落不可用区** 45° 浅斜线纹。
- 棋盘外加 12-16px padding + 柔和阴影做卡片化，1px 浅描边替代原来的 3px 粗黑边。
- 被方块覆盖的数字/星期标签彻底消失（不再幽幽透出）。

### 待放置方块面板

- **卡片统一为正方形**（60-72px 自适应屏宽），形状居中。
- **去掉 U/V/I/L/J/Q/S/N/T/Z 字母**：对玩家是无意义的数学命名。
- 选中态：scale 1.06 + 绿色阴影 + 粗描边。
- 拖动中原 palette 卡片淡化为 alpha 0.25，看清"已抽走"。
- 棋盘下方常驻 `💡 双击棋盘上的方块可移除` 提示。

### 拖放系统

- **落点预览**：拖动方块越过棋盘时，按 `Math.round` 吸附位置在棋盘上叠加半透明预览（alpha 0.35）。可放置 → 原色，不可放置 → 浅灰 `#bbbbbb`。
- **snap 落地动画**：拖动放置时 60ms ease-out，"有重量感"。点击放置不触发 snap，避免零位移闪烁。
- **棋盘内任意搬动方块**：触摸棋盘上**已放置的非锁定方块**可直接拖到任何合法位置；落点非法 / 越界自动回到原位；松手时若没移动则原样恢复，双击仍可收回 palette。锁定的题面方块依旧抓不起来。
- **手选面板滚动 vs 点击**：滚动距离 ≥ 8px 即判定为滚动，松手时不再误触发选题。
- **鼠标滚轮支持**：PC / 开发者工具中鼠标滚动可在手选面板里上下浏览缩略图。

### 反馈系统

- **通关 confetti**：120 颗彩纸抛洒、3× 下落速度、8 色调色板、120ms 内全部生成。
- **通关弹窗模态化**：50% 黑色 backdrop + 右上 × 关闭 + 点弹窗外部关闭。
- **通关弹窗 CTA**：🎲 随机下一题（主，绿色）+ 🎯 邀请朋友挑战这一题（次，橙色）。关闭弹窗后棋盘下方的橙色分享按钮仍保留。
- **Toast 顶部浮动**：5s 自动消失，不再挤棋盘空间、不再消失后让棋盘抖一下。
- **触觉反馈**：拖起 light / 落子 medium / 通关 long。
- **完全移除 shake**：任何不可放置情况只 toast 不抖（包括点击、拖动、越界）。
- 移除 palette 首张卡呼吸动画（与选中态 scale 1.06 互相干涉看起来像抖）。

### 新手与帮助

- 选难度页右上 ⓘ **规则速查**按钮 + 7 行规则弹层。

### 工程

- **主题接口**：`board.js::THEMES` + `setCellTheme(name)` API，未来新增主题只需添一项后调用。
- **修复 `_playedCombos` / `_wonCombos` 不透传**（latent bug）：换题时随机模式的"避免重复"逻辑现在跨换题真正生效。
- 移除"放置成功"/"已移除方块"等冗余 toast。

### 已知延后（下个版本）

- 完整 4 步**交互式新手教程**（用户实操放置 / 删除 / 通关）。
- **音效**（拿起 / 放下 / 通关，可关闭）。
- **历史日期回看** + **各难度时间统计折线图**。

## [0.1.3] — 2026-05-13

### 新增

- 接入微信小游戏分享：右上角胶囊菜单显示"转发"和"分享到朋友圈"。
- 通过 `wx.onShareAppMessage` 提供默认分享标题。

## [0.1.2] — 2026-05-12

### 改动

- 中文本地化：月份、星期、所有 UI 文案改为简体中文。

---

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
