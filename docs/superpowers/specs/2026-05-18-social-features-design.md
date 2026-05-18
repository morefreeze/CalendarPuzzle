# Calendar Puzzle 小游戏 · 社交功能设计

**Date**: 2026-05-18
**Status**: Draft for review
**Scope**: `calendar-puzzle-miniprogram/minigame/`

## 1. 目标

让目前纯本地、纯单机的小游戏获得三件事：

- **A 留存**：玩家被关卡卡住时有"救场"路径，不直接流失
- **B 拉新**：把分享变成有意义的获益动作，让链接接收者真的转化
- **C 社交感**：好友间能看到彼此的进度和成绩

非目标：竞速直播、关卡共创、自定义关、跨小程序数据互通。

## 2. 范围摘要

| 模块 | 状态 |
|---|---|
| 3 级 hint 系统（弱/中/强） | 新增 |
| 体力 / 群分享 / 助力 / 激励视频广告 4 路获取 hint | 新增 |
| 微信云开发后端（首次引入） | 新增 |
| 互助型助力（helper 也得奖励） | 新增 |
| 好友榜（单日单关）+ 无提示勋章 | 新增 |
| `subscribeMessage` 助力通知 | 新增 |
| 求救信号 / 复盘分享 / 周关 / 关卡赠送 | 不做（未来 spec） |

## 3. 架构

### 3.1 端 / 云分工

```
┌─────────────────── 微信小游戏（端）──────────────────┐
│  minigame/js/                                        │
│    hint.js          ← 新增：3 级提示状态机           │
│    cloudClient.js   ← 新增：云函数 wrapper          │
│    ads.js           ← 新增：激励视频广告封装         │
│    leaderboard.js   ← 新增：好友榜 UI + 数据         │
│    helperGift.js    ← 新增：助力 helper 落地页       │
│    shareState.js    ← 改：加 inviter token + 助力 cb │
│    gameScene.js     ← 改：嵌入 hint 按钮 + 触发      │
│    stamina.js       ← 不变（被 hint.js 消费）        │
└──────────────────────────────────────────────────────┘
                       │  wx.cloud.callFunction
                       ▼
┌─────────────── 微信云开发（cloud/）──────────────────┐
│  functions/                                          │
│    login         首次入库 user                       │
│    shareGroup    群分享验证 + 计数                   │
│    helpInvite    助力链路（A 帮 B 助力的写入）       │
│    grantHint     根据动作（分享/广告/助力）发券      │
│    submitScore   通关时间提交 + 勋章判定             │
│    friendsScore  拉好友榜（关系链 KV 桥）            │
│  database/                                           │
│    users         openid, nickname, createdAt         │
│    hintGrants    每张券一行（审计 + 防并发）         │
│    shareLog      openid, openGId, date（群去重）     │
│    helpLog       inviter, helper, date（助力去重）   │
│    scores        当日通关成绩 + 勋章                 │
└──────────────────────────────────────────────────────┘
```

### 3.2 关键技术决策

- **不引入 server.py**：solver 仍跑端上（`dlx.js`），云端只做数据/社交。两个后端解耦。
- **登录态**：首次冷启动调 `login` 云函数。后续云函数通过 `CONTEXT.OPENID` 自动识别身份，端上不传 openid。
- **同步 vs 异步**：
  - 同步等响应：领取 hint、使用 hint、提交分数、群分享换券
  - 异步：助力到账通知、leaderboard 刷新
- **本地 cache + 云端 source of truth**：所有计数本地缓存用于秒级响应，但**领取 / 使用都必须走云函数**。云函数失败时使用动作直接拒绝（不允许"先扣本地等会儿补"，否则离线刷券）。

### 3.3 hintGrants 数据模型

每张 hint 券一行（不做 counter 加减，天然防并发，留审计 trail）：

```js
{
  _id: 'auto',
  openid: 'xxx',
  type: 'weak' | 'medium' | 'strong',
  source: 'free' | 'stamina' | 'share' | 'help' | 'ad' | 'helperGift',
  grantedAt: ServerDate,
  usedAt: null | ServerDate,
  usedInPuzzle: null | 'YYYY-MM-DD:hard:c3',  // 关卡标识
}
```

**每关上限判定**：查询 `usedInPuzzle == 当前关 && usedAt != null && type == X` 的记录数 ≥ 上限则拒绝使用。

**每关上限**：弱 3、中 3、强 1。每关首次免费送 1 张弱券。

## 4. Hint 系统详细

### 4.1 经济参数

| 提示 | 体力 | 群分享 | 助力 | 广告 | 每关上限 |
|---|---|---|---|---|---|
| 弱 | 1 | — | — | — | 3（首次免费） |
| 中 | 3 | 1 次新群分享 | — | 1 广告 | 3 |
| 强 | 6 | 1 次新群分享 | 2 人助力累计 | 1 广告 | 1 |

价格定位参考：当前难度阶梯 easy 3 / medium 5 / hard 7 / expert 9 / insomnia 0，所以单 hint 必须 < 单关代价。

### 4.2 3 级语义

| 操作 | 弱（朝向锁） | 中（位置锁） | 强（完整锁） |
|---|---|---|---|
| 用户选块（未放置 + 已放置都可选） | ✓ | ✓ | ✓ |
| 揭示信息 | 旋转角 + 镜像 | (x,y) 单格 | 旋转 + 镜像 + (x,y) |
| 视觉表现 | 托盘中块旋转/镜像到目标姿态；旋转 / 镜像按钮禁用 | 棋盘目标格：drag-preview 透明度 + 该块颜色 | 直接落子动画；挡路块弹回托盘 |
| 块已在棋盘但姿态/位置不对 | 拿回托盘 | 拿回托盘 | 不会发生 |
| 撤销 | ✗ | ✗ | 双击触发 modal："强提示锁定，不能移除" |
| 关切换 | 全部清空 | 全部清空 | 全部清空 |

### 4.3 玩家进入 hint 的流程

1. `gameScene.js` 顶部加 💡 圆按钮
2. 点击 → 弹三选一菜单（弱 / 中 / 强），每行显示：剩余券数 + 本关已用/上限 + 不足时的获取入口
3. 选了某档但没券 → 二级弹窗列出获取路径（"花 N 体力" / "群分享换" / "看广告" / "邀请好友助力"），按钮各自独立
4. 拿到券立刻进入"选块阶段"：托盘所有块可点（弱）/ 加棋盘上的块也可点（中/强）
5. 选块完成 → 应用 lock + 视觉提示

### 4.4 与现有交互的兼容

- 棋盘上已放置块的拖动逻辑不变；只在 lock flag 命中时阻止
- 现有双击移除加 1 个前置判断：strong-locked 块走 modal 路径
- 弱锁后用户再点旋转按钮 → `wx.showToast("提示已锁定方向")`
- hint 菜单 0.5s 无操作自动收起

## 5. 社交闭环

### 5.1 群分享换中提示

```
玩家点"中提示"且无券，选"分享到群"
  → wx.shareAppMessage({ withShareTicket: true })
  → 微信回调 shareTicket
  → wx.getShareInfo({ shareTicket }) → encryptedData + iv
  → 云函数 shareGroup({ encryptedData, iv })
      → 服务端解密拿 openGId
      → shareLog 表查 { openid, openGId, today } 是否存在
      → 不存在 → 插入 + grantHint(medium, 'share')
      → 存在 → 返回"今天这个群已经分享过"
  → 端上 toast + 刷新券数
```

**边界**：玩家如果分享给单个好友而非群，shareTicket 不返回；返回失败 toast"请分享到群聊"。

### 5.2 助力链路（互助型）

分享 query 形式：`?inviter=<openid>&t=<server-issued-token>`

```
helper 点链接 → 端上读 query → 云函数 helpInvite({ inviter, t })
  → 校验 t 签名 + 防自助（inviter !== CONTEXT.OPENID）
  → helpLog 表去重（inviter + helper + date 唯一）
  → 通过 → 写 helpLog
  → 给 inviter grantHint(strong, 'help')
      （source='help' 的总数每累计 2 次触发 1 张强券）
  → 给 helper grantHint(weak, 'helperGift') 1 张
  → 返回 inviter 昵称 + 当前进度
  → helper 端弹"已为某某助力 + 你获得 1 张弱提示"
  → inviter 端：subscribeMessage 已订阅 → 推送通知；否则下次进 app 拉 helpLog 汇总展示
```

**Token 设计**：服务端 issue 一次，HMAC-SHA256(openid + dateStr + secret)，端上分享时带上，云函数验签后写入。防止伪造 inviter 给陌生人发助力。

### 5.3 inviter 通知模式

首次成为 inviter（在收到第一个助力之前）小游戏弹窗：
"开启通知 → 每次助力第一时间知道"
- 允许 → `wx.requestSubscribeMessage(['help-arrived-template-id'])` → 后续走推送
- 拒绝 → 沉默累加 → 下次进 app 头部红点 + "你收到 N 次助力"卡片

### 5.4 激励视频广告（甲方案：先用测试 ID）

`ads.js` 封装 `wx.createRewardedVideoAd`，包含：
- 测试 unitId 常量 + TODO 注释（流量主开通后改正式 ID）
- `showRewardedAd(onSuccess, onFail)` 接口
- `onClose.isEnded === true` 才回 success
- 加载失败 / 用户关闭 / 不支持 createRewardedVideoAd（低版本基础库）→ 各自不同的 onFail 原因

**广告成功后**：必须调云函数 `grantHint(type, 'ad')` 发券，端上不能直接发（防 jailcrack）。云端无法验证广告是否真看完，容忍此风险。

**`grantHint` 网络失败的兜底**：广告看完了但 `grantHint` 调用失败 → 端上把"待补发券"写本地待重试队列 `pendingAdGrants[]`，下次 app 启动或网络恢复时重试，最多 3 次。重试期间 UI 显示"广告券到账中"。

## 6. 好友榜 + 勋章

### 6.1 完成关卡时

```js
// 端上
submitScore({
  dateStr, difficulty, combo,
  timeMs,
  hintsUsed: { weak: 0, medium: 1, strong: 0 }
})
```

云函数 `submitScore`：
- 校验 `timeMs >= 10000`（人类反应下限保护）
- 计算 badges：`hintsUsed.weak + .medium + .strong === 0` → 含 `nohint` 勋章
- 写入 scores 表
- 同步写微信 KV：`wx.setUserCloudStorage({ KVDataList: [{ key: 'd_2026-05-18_hard', value: JSON.stringify({ timeMs, badges }) }] })`

### 6.2 拉好友榜

`leaderboard.js` 调用 `wx.getFriendCloudStorage({ keyList: ['d_2026-05-18_hard'] })` →
返回授权过该数据的好友列表 + 各自的 KV value → 端上排序 + 渲染。

UI：通关页 + 关切换页都有一个横向滚动卡片，每卡：头像 + 昵称 + 时间 + 勋章。

### 6.3 勋章

MVP 只有 1 个：`nohint`（无提示通关）。后续可加：`speedrun`（前 10%）、`streak3`（3 连）等，本 spec 不展开。

## 7. 防作弊

| 风险 | 缓解 |
|---|---|
| 端上改本地 hintGrants 缓存白嫖 | 使用 hint 时必须云函数验证；本地 cache 只是 UI |
| 端上伪造时间提交 leaderboard | 云函数校验 `timeMs >= 10000`；后续可加方差检测 |
| 同一玩家双设备互助 | 助力时校验 `inviter !== CONTEXT.OPENID` |
| 群分享 / 助力链接伪造 | encryptedData 后端解密 + token HMAC 验签 |
| 跳过广告拿券 | 容忍（无法服务端校验，普通用户成本高） |

## 8. 测试策略

| 测试 | 工具 | 触发 |
|---|---|---|
| hint 状态机 unit | 端上 JS + mock | npm test |
| 云函数 unit | 云开发本地调试 + jest | manual / CI |
| 分享 + 助力端到端 | 两台微信真机 | 发版前 smoke |
| Solver 兼容（hint 揭示的姿态在某个解里） | 复用 `dlx.js` | npm test |
| 广告流程 | 微信开发者工具 + 测试 unitId | manual |

## 9. 推出顺序（不属于本 spec 的实现范围，仅供参考）

1. 云开发环境 + login + grantHint + 端上 cloudClient 框架
2. hint 状态机 + UI（先只支持体力 source）
3. ads.js + 看广告换 hint
4. shareGroup + 群分享换 hint
5. helpInvite + helper 落地页 + 互助奖励
6. subscribeMessage + 助力推送
7. submitScore + 好友榜 + nohint 勋章

## 10. 开放问题（待实现时确认）

- 关卡标识 `usedInPuzzle` 格式以 `${dateStr}:${difficulty}:c${comboIndex}` 为准（与 `shareState.js` 现有 query 对齐）
- subscribeMessage 模板 ID 需要在小游戏后台创建后填入 cloudClient
- 流量主开通后正式 adUnitId 需要更新 `ads.js` 常量
