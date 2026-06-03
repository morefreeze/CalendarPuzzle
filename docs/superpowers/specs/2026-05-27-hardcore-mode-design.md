# 硬核模式（Hardcore Mode）设计

- 日期：2026-05-27
- 作用域：仅小游戏端 `calendar-puzzle-miniprogram/minigame/`（web `my-cal/` 与 Python 后端不动）
- 基线分支：`feature/medium-hint-mismatch-dialog`（0.6.0 中提示不匹配弹窗合入后）
- 实现分支建议：`feature/hardcore-mode`

## 1. 需求摘要

在 `selectScene` 难度选择界面，难度按钮下方加一个 `🔥 硬核模式` 开关（每局重选，不跨启动持久）。开关 ON 时，无论选择哪个底层难度（easy / medium / hard / expert / insomnia），进入游戏后：

- **禁用**：提示按钮（弱 / 中 / 强全禁，按钮不渲染）；随机换题 🎲；选题 🎯。
- **替换**：原"↺ 重开"按钮 → "🧹 清空"：清掉所有已落方块回 palette，**计时器不重置**。
- **保留**：双击移除单个方块；错放即时反馈；分享得券（券池继续增长，留给非硬核局使用）。
- **新增**：顶栏右上角 ☰ 暂停菜单（半屏 sheet），首发条目：`🔥 放弃硬核` / `🏠 返回首页` / 题面信息块。

通关时：

- 结算页加 "🔥 硬核通关" 文案行。
- `progress` 记录 `hardcoreDays[dateStr][difficulty] = true`，幂等。

存档：

- 存档 payload 增加 `mode: { hardcore: bool }` 字段，round-trip。
- 老存档无此字段时默认 `{ hardcore: false }`，向后兼容。
- 恢复硬核存档时保留硬核状态，暂停菜单中可一键"放弃硬核"**单向降级**为普通局（本局不计入 hardcoreDays）。

## 2. 架构

### 2.1 Mode 抽象（新文件）

`minigame/js/mode.js`（~30 行）：

```js
var DEFAULT_MODE = { hardcore: false };

function createMode(opts) {
  opts = opts || {};
  return { hardcore: !!opts.hardcore };
}

function isHardcore(mode) { return !!(mode && mode.hardcore); }

// Capability 助手 — 未来加模式只要在这里加键。
function canUseHint(mode)    { return !isHardcore(mode); }
function canSwapPuzzle(mode) { return !isHardcore(mode); }
function canRestart(mode)    { return !isHardcore(mode); }   // 普通"重开"（重置计时器）
function canClearBoard(mode) { return true; }                 // 任何模式都允许"清空"，硬核下作为"重开"的替代

module.exports = { DEFAULT_MODE, createMode, isHardcore,
                   canUseHint, canSwapPuzzle, canRestart, canClearBoard };
```

设计取舍：选用"容器对象 + capability 助手"，比裸 boolean `isHardcore` 多一层间接，但禁用规则散落点收敛到 4 个具名函数，未来加"限时""每日挑战"等模式只需扩 `createMode` + 加 capability，不必全局重命名。

### 2.2 selectScene 入口 UI

布局（5 个难度按钮 grid 之下）：

```
 ┌─────────────────────────────────┐
 │  接水  泡咖啡  开个会  加班  失眠  │  ← 现有 5 难度按钮（不动）
 └─────────────────────────────────┘

      🔥 硬核模式     [   OFF  ●  ]
      关闭提示・换题・券，重开变为清空棋盘
```

- 状态：`selectScene` 实例变量 `this.hardcoreOn = false`，**不读不写 storage**。
- 点击开关 → flip + 重绘；点击难度按钮 → `wx.createGameScene({ difficulty, mode: createMode({ hardcore: this.hardcoreOn }) })`。
- "今日 X 种" 的 insomnia 徽章不变（硬核结果不进 `insomniaUnique`）。
- 视觉：开关一行 + 灰色小字一行，字号留给实现阶段定（参考现有难度卡片字号体系）。

### 2.3 gameScene 内 gating（4 个改动点）

| # | 位置 | 现状 | 硬核行为 |
|---|---|---|---|
| 1 | `gameScene.js:957` 提示按钮渲染 | `R.button(..., '💡 提示', ...)` | `canUseHint(mode) === false` → 不渲染 `L.hintBtn = null`；右侧按钮整体左移（沿用 insomnia 同款"少一个按钮"布局） |
| 2 | `gameScene.js:2622` 提示按钮命中 | `if (L.hintBtn && R.hitTest...)` | `L.hintBtn` 为 null 时已被 if 防住，无需额外改 |
| 3 | `gameScene.js:962` 随机换题按钮 + `:965` 选题按钮 | `R.button(..., '🎲 随机', ...)` / `'🎯 选题'` | `canSwapPuzzle(mode) === false` → 同上不渲染，命中点失效 |
| 4 | `gameScene.js:958` 重开按钮 + `:2636` 命中 | `'↺ 重开'`，`showToast('已重开当前题')`，`puzzle.resetTimer()` | `canRestart(mode) === false` → 按钮文案改 `'🧹 清空'`；命中走新分支 `clearBoardKeepTimer()`：把 `dropped` 全部 push 回 palette、`puzzle.placed` 清空、`showToast('已清空棋盘')`、**不**调用 `puzzle.resetTimer()` |

`createGameScene` 入参增加 `opts.mode`，实例属性 `this.mode = createMode(opts.mode)`；`captureState()` 拼 payload 时 `mode: this.mode`；scene init 时如有 `savedState.mode`，用它覆盖入参 mode（存档优先）。

### 2.4 暂停菜单（新组件）

入口：顶栏右上角 `☰` 图标按钮，点击弹半屏 sheet（盖住下半部分，点空白处关闭）。

**首发条目**（按用户确认）：

1. `🔥 放弃硬核` — **仅当 `isHardcore(mode) === true` 时显示**。点击 → 二次确认弹窗（"放弃后本局不再计入今日硬核通关，确定?"）→ 确定 → `this.mode = createMode({hardcore:false})` → 重绘控制行（提示/换题/重开重新出现）→ `captureState` 写盘 → `showToast('已切回普通模式')`。**单向**：之后该条目消失。
2. `🏠 返回首页` — 等价 `backBtn` 行为。**保留**左上 `backBtn` 不删，提供双入口（左上肌肉记忆 + 菜单标准位）。
3. **题面信息**（只读区块）：`2026-05-27 · 加班赶报告 · 🔥 硬核`（若非硬核则不显示 🔥 后缀）。

**不在 MVP**：音效开关、关于、版本号、重玩教程 — 留给后续按需追加（暂停菜单是 sheet，加条目 = 加 1 行，未来无架构成本）。

### 2.5 通关判定 & 进度记录

`progress.js` 新增：

```js
function markHardcoreCleared(dateStr, difficulty) {
  var rec = getRecord();
  rec.hardcoreDays = rec.hardcoreDays || {};
  var entry = rec.hardcoreDays[dateStr] = rec.hardcoreDays[dateStr] || {};
  if (entry[difficulty]) return false;
  entry[difficulty] = true;
  putRecord(rec);
  return true;  // first-time-today-at-this-difficulty
}

function hasHardcoreCleared(dateStr, difficulty) {
  var rec = getRecord();
  var entry = rec.hardcoreDays && rec.hardcoreDays[dateStr];
  return !!(entry && entry[difficulty]);
}
```

按日期 + 底层难度记录，符合"硬核可搭配任何难度"的语义，未来"今日硬核刷满 5 难度有奖励"无需 schema 演进。

`gameScene` `puzzle.success` 路径（约 `gameScene.js:421` 附近 `insomniaUnique = ...` 处）增加：

```js
var hardcoreCleared = false;
if (mode.isHardcore(this.mode)) {
  hardcoreCleared = progress.markHardcoreCleared(puzzle.dateStr, difficulty);
}
// 传给 winStats，结算页根据 hardcoreCleared / mode 显示 "🔥 硬核通关"
```

注意：结算页文案只看本局 `mode.hardcore`（说明本局确实是硬核），不看 `markHardcoreCleared` 的返回值（false 表示今日同难度第二次以上通关，仍然是硬核局，文案仍要显示）。

## 3. 数据流

**新开局**：
```
selectScene.hardcoreOn=true
  → 点 expert 按钮
  → createGameScene({difficulty:'expert', mode: createMode({hardcore:true})})
  → gameScene.this.mode = {hardcore:true}
  → render 时 canUseHint(mode)=false → L.hintBtn=null
  → canSwapPuzzle(mode)=false → 🎲/🎯 不渲染
  → canRestart(mode)=false → 按钮文案 '🧹 清空'
  → 顶栏 ☰ 渲染
```

**通关**：
```
puzzle.success 触发
  → hardcoreCleared = progress.markHardcoreCleared('2026-05-27', 'expert')
  → winStats.hardcore = true
  → 结算页渲染 "🔥 硬核通关" 文案行
```

**退出 & 恢复**：
```
退出 → captureState() = {..., mode: {hardcore:true}} → tempSlot/named slot 落盘
恢复 → scene init 读 savedState.mode → this.mode = createMode(savedState.mode)
     → 控制行渲染同新开局；☰ 菜单中"放弃硬核"可见
```

**放弃硬核**：
```
☰ → 放弃硬核 → 二次确认 → this.mode = createMode({hardcore:false})
  → 重绘控制行（4 按钮全回）→ captureState 写盘
  → showToast('已切回普通模式')
  → ☰ 菜单中"放弃硬核"条目消失
后续 puzzle.success → mode.hardcore=false → 不调 markHardcoreCleared
                  → 结算页无 "🔥 硬核通关"
```

## 4. 数据 schema

### 4.1 存档 slot payload（演进）

```js
{
  difficulty: 'expert',
  puzzle: { dateStr, ... },
  dropped: [...],
  hintState: {...},        // 硬核局始终为 createHintState 初值（从不被填充）
  playedCombos: {...},
  mode: { hardcore: true } // 新字段，缺省时视作 { hardcore: false }
}
```

### 4.2 progress 持久层

```js
{
  // ... 现有字段
  hardcoreDays: {
    '2026-05-27': { easy: true, expert: true },
    '2026-05-28': { hard: true },
  }
}
```

稀疏存储；首次通关写入；同日同难度第二次通关无副作用。

## 5. 错误处理 & 兼容性

- **老存档恢复**：`savedState.mode` 不存在 → `createMode(undefined)` → `{hardcore:false}`，与原有行为完全一致。
- **老 progress 数据**：`rec.hardcoreDays` 不存在 → 首次 markHardcoreCleared 时懒创建。
- **createGameScene 老调用**：未传 `opts.mode` → 视作 `{hardcore:false}`。
- **硬核局意外触发提示路径**：在硬核下 hint 按钮不渲染，hintBtn 命中分支已被 `if (L.hintBtn && ...)` 守护。即使外部代码 bug 调到 `applyWeak/Medium/Strong`，hintState 会被更新但 UI 不响应——不构成数据腐蚀。
- **券花费旁路**：当前 spend 路径只通过提示按钮触发；本期不在 `voucher.applyUsed` 加 hardcore 守护（YAGNI）。未来如出现"硬核局也能花券的别处路径"，再补一行 `if (isHardcore(currentMode)) throw ...`。记入 §8 未来工作。

## 6. 测试

### 6.1 单元测试

| 文件 | 用例 |
|---|---|
| 新 `tests/mode.test.js` | `createMode()` 缺省 / 传 `{hardcore:true}`；`isHardcore` 两分支；4 个 capability 函数（硬核态 / 非硬核态）共 8 断言 |
| 新 `tests/progress.hardcore.test.js`（仓库当前无 `progress.test.js`） | `markHardcoreCleared` 首次返回 true；同日同难度重复返回 false；同日不同难度并存；`hasHardcoreCleared` 三态读取；storage round-trip |
| `tests/slotStore.test.js` | +1：`mode: {hardcore:true}` round-trip；+1：老 payload 无 `mode` 字段恢复后视作 `{hardcore:false}` |

### 6.2 手测路径（真机 / 微信开发者工具）

1. **开关入口** — selectScene 勾 🔥 → 选 expert → 进游戏 → 控制行只有 "🧹 清空" 一个按钮，无 💡 提示 / 🎲 随机 / 🎯 选题。
2. **清空 vs 重开** — 硬核局放几个方块 → 点 "🧹 清空" → 棋盘空，方块回 palette，**顶栏/底栏计时器数字继续跑**（不归零）。
3. **暂停菜单** — 顶栏右上 ☰ → sheet 弹出，含 `🔥 放弃硬核` / `🏠 返回首页` / 题面信息块；点空白处关闭。
4. **放弃硬核** — ☰ → 放弃硬核 → 二次确认 → 确定 → 控制行恢复 4 按钮、☰ 菜单中"放弃硬核"消失、本局通关结算无 "🔥 硬核通关"、`progress.hardcoreDays` 不被写入。
5. **存档恢复** — 硬核 expert 局玩 3 步 → 退出（含 0.5.5 自动占空名槽路径）→ 从槽恢复 → 控制行仍是 1 按钮、☰ 菜单中"放弃硬核"仍可见、题面 badge "🔥 硬核" 仍显示。
6. **券与分享解耦** — 硬核局触发分享得券（若 0.6.0 流程允许在游戏内分享）→ 券数 +1；硬核局任何路径都无法花券。
7. **通关记录** — 硬核 expert 通关 → 结算页 "🔥 硬核通关" 显示 → 检视 progress → `hardcoreDays['2026-05-27'].expert === true`。
8. **0.6.0 中提示不匹配** — 硬核局放置任意方块，**不**弹出中提示不匹配 modal（因 `hintState.medium` 始终为 null）。

## 7. 已知风险

- **顶栏 ☰ 与 backBtn 视觉冲突**：`gameScene.js:617` 已占左上，新 ☰ 在右上，需确认 menuRect 安全区不挤压；实现时若发现冲突，优先收缩 ☰ 图标尺寸 / 调整 padding，**不**删 backBtn。
- **存档 schema 升版**：本变更不需要迁移脚本，但要确保 `slotStore.test.js` 的"老 payload"用例真正走"无 mode 字段"路径。
- **依赖分支**：基于未合 main 的 `feature/medium-hint-mismatch-dialog`。如该分支后续 force-push 或被 rebase，硬核分支需要相应处理。
- **暂停菜单未做的副作用**：MVP 不含音效、关于、版本号 — 用户若期望"暂停菜单一上来就标配这些"，会有落差。spec 已明确范围，文档/CHANGELOG 也要说清"MVP 三条"。

## 8. 未来工作（明确不在本次范围）

- 券花费路径在 `voucher.applyUsed` 层加硬核守护（防御性，当前无入口可触发）。
- 暂停菜单加：音效开关 / 重玩教程 / 关于+版本号 / 反馈入口。
- 硬核连胜统计（连续 N 天通关硬核任意难度）。
- 硬核刷满当日所有难度的成就 / 奖励。
- web `my-cal/` 端的硬核（当前 web 无提示/券/存档概念，需先补齐这些再谈硬核）。

## 9. 文件清单（实现阶段会动到的）

- 新增 `minigame/js/mode.js`
- 新增 `minigame/js/pauseMenu.js`（或并入 gameScene 内一个 namespace）
- 改 `minigame/js/selectScene.js`：硬核开关 UI + 状态 + 传参
- 改 `minigame/js/gameScene.js`：mode 属性 + 4 处控制行 gating + 顶栏 ☰ + clearBoardKeepTimer + 通关判定
- 改 `minigame/js/progress.js`：`markHardcoreCleared` / `hasHardcoreCleared`
- 改 `minigame/js/slotStore.js` schema（只是 payload 字段透传，不改 storage 接口）
- 新增 `minigame/tests/mode.test.js`
- 新增 `minigame/tests/progress.hardcore.test.js`（仓库当前无 `progress.test.js`，直接新建）
- 改 `minigame/tests/slotStore.test.js`：+2 用例
- 改 `minigame/CHANGELOG.md`：`[0.7.0] — 2026-05-27` 段
