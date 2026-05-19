# Calendar Puzzle 小游戏 · Plan 2c+2d 增量设计（群分享 + 助力）

**Date**: 2026-05-19
**Status**: Draft for review
**Scope**: `calendar-puzzle-miniprogram/minigame/`
**Predecessor**: 2026-05-18-social-features-design.md（总 spec）；plan 2a 已合并

## 0. 这份增量在哪一层

总 spec `2026-05-18-social-features-design.md` 把社交功能拆 7 步推出。本增量合并 **§5.1 群分享** 与 **§5.2 / §5.3 助力（含 helper 落地、inviter 通知）** 两步成单个 plan，并把"voucher 化 hint 路径"作为公共前置依赖一起完成。

**不在范围内**：
- §5.4 激励视频广告（流量主未开通，独立 plan 2b）
- §5.3 `subscribeMessage` 推送（模板 ID 未创建；本 plan 只做"下次进 app 拉 helpLog 聚合 + 红点"兜底，spec 总文档 §5.3 第二分支）
- §6 submitScore + 好友榜 + 勋章（独立 plan）

## 1. 决策记录（brainstorm 结论）

| 决策点 | 选择 | 理由 |
|---|---|---|
| Plan 拆分 | 2c+2d 合一 | 用户要求单 plan，公共依赖（voucher 化）只动一次 |
| subscribeMessage 推送 | **完全延后** | 模板 ID 未就位，stub 调用会被微信拒；用 in-app 聚合替代足够 |
| HMAC secret 管理 | cloud function 环境变量 `HELP_TOKEN_SECRET` | secrets 不进 git，可独立轮换 |
| helpToken 投递 | 跟 `login` 返回 | 不增加额外往返；天级轮换 |
| 广告占位 UI | 直接砍掉 | 不让玩家点 dead-end，2b 来再扩 |
| voucher 严格度 | 本地优先 + 云端异步对账 | 体力路径体验顺；社交券云端权威；负数余额行为同 0 |
| 体力进不进 hintGrants 表 | 不进 | 本地权威，记账无意义 |
| helper 落地 UX | selectScene + modal（spec §B'） | 复用 scene 文件；inviter "进度"等 submitScore plan |
| shareGroup 解密 | `wx-server-sdk cloud.getOpenData` | 标准 API，省 sessionKey 管理 |
| inviter 强券触发 | 累计 helpLog 偶数次发一张 | 简单 query count，race 概率极低，多发可接受 |

## 2. 架构

```
┌── 端 (minigame/js/) ──────────────────────────────────────────┐
│  hint.js           CHG: 引入 voucherBalance + usedQueue       │
│                         本地权威; useHint 调用入队列异步刷云  │
│  cloudClient.js    CHG: 新加 shareGroup / helpInvite RPC      │
│                         pendingUseHints 重试队列              │
│  gameScene.js      CHG: hint tier menu → 不足时弹"获取路径"   │
│                         (体力 / 群分享 / 邀请助力 三选一)     │
│  shareState.js     CHG: 邀请助力时 query 加 inviter=&t=        │
│  selectScene.js    CHG: 启动后若 query 有 inviter → helper    │
│                         landing modal                          │
│  main.js           CHG: 启动先 cloudClient.login()             │
│                         拿 openid + helpToken,失败容忍        │
└────────────────────────────────────────────────────────────────┘
                       │ wx.cloud.callFunction
                       ▼
┌── cloud/functions/ ────────────────────────────────────────────┐
│  login           CHG: 返回 {ok, openid, helpToken}             │
│                       helpToken = HMAC(openid+today+SECRET)    │
│  shareGroup      NEW: 解 encryptedData → openGId → shareLog    │
│                       去重 → grantHint(medium,'share')         │
│  helpInvite      NEW: 验 t → helpLog 去重 → 双发券             │
│                       (helper weak/helperGift +                │
│                        inviter strong/help if count%2==0)      │
│  grantHint       UNCHANGED                                     │
│  useHint         UNCHANGED                                     │
│  listGrants      UNCHANGED (端上 reconcile 用)                 │
└────────────────────────────────────────────────────────────────┘
新建 collections: shareLog, helpLog (+ 唯一索引)
环境变量: HELP_TOKEN_SECRET (cloudbase 控制台手配)
```

**关键不变量**：
- 体力源：纯本地，hint.js 自己 cap，不进 hintGrants 表
- 社交券（share/help/helperGift）：必须在 hintGrants 表里有 row 才"算数"；使用时本地即响应、useHint 异步入队
- 离线分享/助力直接拒，不进队列（社交动作本身要网络）

## 3. 数据模型

### 3.1 `hintGrants`（沿用 plan 2a，不改 schema）
```js
{
  _id, openid,
  type: 'weak' | 'medium' | 'strong',
  source: 'free' | 'stamina' | 'share' | 'help' | 'ad' | 'helperGift',
  grantedAt, usedAt: null | ServerDate,
  usedInPuzzle: null | 'YYYY-MM-DD:diff:cN',
}
```
体力源**不进表**。表里实际只剩 share/help/helperGift/ad/free。

### 3.2 `shareLog`（NEW）
```js
{
  _id,
  openid,               // 分享者
  openGId,              // 解密出来的群 ID
  dateStr: 'YYYY-MM-DD',
  createdAt: ServerDate,
}
```
唯一索引：`(openid, openGId, dateStr)`。

### 3.3 `helpLog`（NEW）
```js
{
  _id,
  inviter,              // openid，被助力的人
  helper,               // openid，点链接的人
  dateStr: 'YYYY-MM-DD',
  createdAt: ServerDate,
}
```
唯一索引：`(inviter, helper, dateStr)`。

### 3.4 端上 voucher cache（localStorage key `voucherCache`）
```js
{
  openid,
  fetchedAt: number,    // ms; 启动 + listGrants 后刷新
  balance: { weak: N, medium: N, strong: N },
  pendingUse: [{ type, source, puzzleId, ts }],   // 待回放
  pendingGrant: [{ type, source, ts, retries }],   // ad 路径预留,本 plan 暂不用
}
```
`displayBalance(type) = balance[type] - pendingUse.filter(p=>p.type===type).length`。
负数照展示；`canUseSocial(type) = displayBalance(type) > 0`。

### 3.5 `users` 表
plan 2a 的 login 已 upsert `{openid, createdAt}`。本 plan 顺便加 `nickname` 字段：login 接受可选 `{nickname, avatarUrl}` 入参（端上 `wx.getUserInfo` 拿到后传），云端只在字段为空时填。helper landing modal 展示 `inviterNickname` 时用。

## 4. Voucher state machine (端)

### 4.1 hint.js 改造

**新增 / 改造 API**：
- `getVoucherBalance(type) → number` — 读 voucherCache.balance[type] - pendingUse 同 type 数量
- `canUseSocial(type) → boolean` — 余额 > 0（社交券路径）
- `canUseStamina(type) → boolean` — 体力够 COSTS[type]（体力路径，已存在逻辑）
- `applyWeak/Medium/Strong(state, blockId, palette, dropped, solvedPlacements, source)` —
  新加 `source` 参数；若 source 不是 'stamina' / 'free' / 'first-free'，从 voucherCache.balance[type] -1，往 pendingUse 推一条 {type, source, puzzleId, ts}
- `flushPendingUse(cloudClient) → Promise<void>` — 遍历 pendingUse，每条调 useHint：
  - 成功 → pendingUse 移除
  - 网络失败 → 保留
  - 业务错误（已用/cap 超） → 移除 + 不调整 balance
- `reconcile(cloudClient, puzzleId) → Promise<void>` — 调 listGrants，按云端结果重算 voucherCache.balance（balance = granted_count - used_count，按 type 聚合，体力源不算）

**首关免费弱券**：保留 `FIRST_WEAK_FREE=true` 本地逻辑（source='free'，纯端上标记，不入 hintGrants 表，不进 pendingUse）。

### 4.2 main.js 启动顺序

```
1. 渲染 loading
2. cloudClient.login()    fire-and-forget
   ↳ success: voucherCache.openid = openid; helpToken 存全局
              flushPendingUse() → reconcile(currentPuzzleId)
   ↳ fail:    log; 不阻塞; 社交按钮点击 toast "需要网络"
3. 进 selectScene（若 query 有 inviter+t，先弹 helper modal — 见 §6.3）
```

### 4.3 reconcile 触发点
- 启动 login 之后
- 进新 puzzle 时（puzzleId 变化）
- grantHint 成功 callback 后（一致性，立即对账新券）

useHint 成功不触发 reconcile（balance 已经本地 -1，云端 +1 used，差量一致，省一次网络）。

## 5. 群分享流程（2c）

### 5.1 端

入口：hint tier menu 选 medium 档后，若 displayBalance.medium ≤ 0 且体力不够 3，弹"获取路径"二级菜单（§7），点"群分享换 1 张中提示"。

```js
wx.shareAppMessage({
  ...shareState.buildShareData(),
  withShareTicket: true,
  success(res) {
    if (!res.shareTickets || !res.shareTickets[0]) {
      showToast('请分享到群聊'); return;
    }
    wx.getShareInfo({
      shareTicket: res.shareTickets[0],
      success(info) {
        cloudClient.shareGroup({
          encryptedData: info.encryptedData, iv: info.iv
        }).then(r => {
          if (r.ok) {
            voucherCache.balance.medium += 1;
            reconcile(); showToast('+1 张中提示');
          } else if (r.err === 'duplicate') {
            showToast('今天这个群已经分享过');
          } else {
            showToast('换券失败：' + r.err);
          }
        });
      },
      fail() { showToast('分享信息获取失败'); }
    });
  },
  fail() { /* 用户取消，静默 */ }
});
```

### 5.2 云端 `shareGroup({encryptedData, iv})`

```
1. openid = CONTEXT.OPENID
2. cloud.getOpenData({openData:[{data:encryptedData, iv}]})
   ↳ 失败 → {ok:false, err:'decrypt-failed'}
   ↳ 拿到 openGId
3. db.shareLog 查 (openid, openGId, dateStr=today)
   ↳ 存在 → {ok:false, err:'duplicate'}
4. db.shareLog 插入 (openid, openGId, dateStr, createdAt)
5. db.hintGrants 插入 (openid, type:'medium', source:'share',
                       grantedAt, usedAt:null, usedInPuzzle:null)
6. return {ok:true, granted:{type:'medium', source:'share'}}
```

**容错**：step 4 成功 step 5 失败 → 留下一个 shareLog row 但 grant 不入账；下次同群同天分享被 dup 拒。玩家受影响（少 1 张券）。可接受，云函数日志告警即可。

### 5.3 边界
- 玩家分享给单人：`res.shareTickets` 为空 → toast "请分享到群聊"
- 同群同天再分享：duplicate 错误
- 多个不同群：每个群每天可换 1 张（无总数上限 — 但 spec §4.1 每关 medium cap=3 自动限流）

## 6. 助力流程（2d）

### 6.1 inviter 端（hint 不足，点"邀请好友助力"）

```js
// helpToken 是 login 返回时存到 cloudClient 内部
shareState.setInviterContext({
  inviter: cloudClient.getOpenid(),
  t: cloudClient.getHelpToken()
});
// 直接触发 wx.shareAppMessage
wx.shareAppMessage({
  title: '帮我助力一次，我送你一张提示券',
  query: 'inviter=' + openid + '&t=' + helpToken
         + '&date=' + dateStr,
  // 不要 withShareTicket（助力可发个人也可群）
});
```

小游戏环境 `wx.shareAppMessage` 可程序触发。流程：玩家在 hint 二级菜单点"邀请好友助力" → 端先调 `shareState.setInviterContext({inviter, t})` → 立即调 `wx.shareAppMessage({...buildShareData()})` → 完成或取消后 `shareState.clearInviterContext()`（一次性）。

`shareState.buildShareData()` 改造：
```js
function buildShareData() {
  var base = current ? {
    title: '日历方块「' + current.difficultyLabel + '」挑战 — 来比比谁快！',
    query: 'd=' + current.difficulty + '&c=' + current.comboIndex
           + '&date=' + current.dateStr,
  } : { title: '日历方块挑战 — 用方块拼出今天', query: '' };
  if (inviterCtx) {
    base.title = '帮我助力一次，我送你一张提示券';
    base.query += '&inviter=' + inviterCtx.inviter + '&t=' + inviterCtx.t;
  }
  base.imageUrl = '';
  return base;
}
```
`inviterCtx` 由 hint UI 在分享前调 `shareState.setInviterContext({inviter, t})` 设置；分享完成回调里清空（一次性）。

### 6.2 helper 端（点链接进游戏）

main.js / selectScene.js 启动时解析 query：
```js
var opts = wx.getLaunchOptionsSync();
var q = (opts && opts.query) || {};
if (q.inviter && q.t) {
  cloudClient.helpInvite({ inviter: q.inviter, t: q.t })
    .then(r => {
      if (r.ok) {
        voucherCache.balance.weak += 1;
        reconcile();
        showHelperLandingModal({ inviterNickname: r.inviterNickname });
      } else {
        var msg = ({
          'self-help': '不能给自己助力',
          'duplicate': '今天已经为他助力过啦',
          'bad-token': '链接无效',
        })[r.err] || '助力失败：' + r.err;
        showToast(msg);
      }
    })
    .catch(() => showToast('助力失败：网络异常'));
}
```

### 6.3 helper landing modal（selectScene.js）

复用 hint popup 一样的圆角白底容器。三行：
- ✓ 助力图标（emoji 👏 即可）
- "已为 **[昵称]** 助力成功 +1 张弱提示"
- 按钮「去玩今天的题」 → 关闭 modal，留在 selectScene 当前页

无 inviter 进度展示（spec §B' — 等 submitScore plan）。

### 6.4 云端 `helpInvite({inviter, t})`

```
1. helper = CONTEXT.OPENID
2. inviter === helper → {ok:false, err:'self-help'}
3. expectT = HMAC_SHA256(inviter + todayStr + HELP_TOKEN_SECRET)
   timingSafeEqual(expectT, t) === false → {ok:false, err:'bad-token'}
4. 插入 helpLog (inviter, helper, dateStr=today, createdAt)
   ↳ unique index 冲突 → {ok:false, err:'duplicate'}
5. query helpLog where inviter=X and dateStr=today → 总数 N
6. db.hintGrants 插入 (openid=helper, type='weak', source='helperGift',...)
7. if N % 2 === 0:
     db.hintGrants 插入 (openid=inviter, type='strong', source='help',...)
8. inviterNickname = db.users.where(openid:inviter).nickname || 'Ta'
9. return {ok:true, inviterNickname,
           granted:{type:'weak', source:'helperGift'}}
```

**token 防重放**：HMAC 包含 dateStr → 隔天链接自动失效。本日内同一 inviter 的 token 重复可用（reuse 即同一 inviter 多次分享给不同 helper），由 helpLog 唯一索引去重。

**race**：两个 helper 同时点链接，step 5 都 query 到 N=1，step 7 都不发 inviter 券，结果累计 2 次只发 1 张 strong（正确）。但若 N=2 / N=4 时并发，可能两 helper 都看到 N%2==0 都发券 → 多发 1 张。概率极低，可接受。

### 6.5 inviter 通知（spec §5.3 兜底分支）

不调 `wx.requestSubscribeMessage`，不写 push。inviter 下次进 app：
- main.js 启动后 `cloudClient.listGrants(null)`（全局，不限 puzzle）
- 服务端 listGrants 顺带返回 `recentHelps: [{helper:openid, helperNickname, ts}, ...]` 字段（按 helpLog 查最近 7 天 inviter=me 的记录）
- 端上对比上次见过的 helpLog 最大 ts（存 localStorage `lastSeenHelpTs`），若有更新 → selectScene 顶部红点 + 卡片"你最近收到 [N] 次助力 👏"

listGrants 改造在本 plan 完成（schema 加 recentHelps 字段）。

## 7. hint 二级"获取路径"菜单（gameScene.js）

### 7.1 当前 tier menu 改造

每档行右侧（覆盖现有"已用 N / 上限"展示）：
```
[弱]  剩余 X · 本关 N/3   ← 体力 1
[中]  剩余 X · 本关 N/3   ← 体力 3
[强]  剩余 X · 本关 N/1   ← 体力 6
```
`剩余 X` = displayBalance(type)（社交券余额，负数照展示如"-1"，灰色）。

点击行：
- 体力足 → 直接消耗体力路径（已有逻辑，source='stamina'，**hint.js 内部不入 hintGrants 表**，本地 weak/medium/strong used 计数 +1）
- 体力不足 → 弹"获取路径"二级菜单（7.2）

### 7.2 二级菜单内容

```
─ 怎么拿到 [中提示]？ ─
○ 花 3 体力（体力不足）   ← 按钮，灰色 disabled
○ 群分享换 1 张             ← 触发 §5.1
○ 邀请好友助力 (仅强提示)  ← type==strong 时显示
─────────────────────
[取消]
```

**显示规则**：
- type='weak'：只显示"花 1 体力"（无社交源）。体力不够 → 提示"等体力恢复"
- type='medium'：显示 "花 3 体力" + "群分享换"
- type='strong'：显示 "花 6 体力" + "邀请好友助力（每 2 位朋友 +1）"

广告按钮不显示（plan 2b 接入时再加）。

### 7.3 与现有 hintMode 状态机的衔接

- gameScene 当前 `hintMode + hintTier + Hint.applyWeak/Medium/Strong` 不变
- 体力路径不变（兼容现有用户行为）
- 社交券路径新加 `pendingSource: 'share' | 'help' | 'helperGift'` 局部 var，进入 applyXxx 时透传

## 8. 异常 / 离线行为

| 场景 | 行为 |
|---|---|
| 启动 login 失败 | 体力路径正常；社交按钮 toast "需要网络" |
| useHint 队列回放网络失败 | 保留队列，下次 reconcile 时重试 |
| useHint 队列回放业务错（cap 超 / 已用） | 队列移除 + reconcile 拉云端值（balance 向高对齐 used） |
| grantHint 成功但 reconcile 还没回 | UI optimistic +1 displayBalance；下次 reconcile 覆盖 |
| shareGroup 解密失败 | toast "分享换券失败"，玩家可重试 |
| helpInvite duplicate | toast，不再发券 |
| helpInvite bad-token（隔天链接） | toast "链接无效" |
| 同账号多设备 | 体力 cap 各设备本地独立（双倍体力可接受，spec §7 未列）；社交券云端去重 |

## 9. 安全 / 防作弊

| 风险 | 缓解 |
|---|---|
| 端伪造本地 voucherCache 白嫖社交券 | useHint 必走云端；本地超量使用会让云端 used > cap，反作弊体现为负余额（再用被拒）。已揭示的 1 张被白嫖，可接受 |
| 端改 stamina 本地白嫖体力券 | 不在 spec §7 范围 |
| 群分享伪造 encryptedData | `cloud.getOpenData` 内置签名校验 |
| 助力链接伪造 inviter | HMAC token 验签 + `inviter !== helper` |
| 双号互助（开 2 个微信账号自己给自己助力） | helpLog `(inviter, helper, dateStr)` 唯一索引下，2 个账号一天只能助力一次；玩家费力获益小，容忍 |
| 跳过广告拿券 | 本 plan 不做广告，N/A |

## 10. 测试策略

### 10.1 端上 unit（`tests/`，node --test）
- `voucher.test.js`：voucherCache 增删减 / displayBalance / pendingUse 入队 / 负数余额
- `hint.test.js` (已存在) 扩展：applyXxx 加 source 参数测试
- `shareState.test.js`：inviterCtx 注入 query / 一次性清空

### 10.2 云函数 unit（`tests/`，扩展 cloud-mock.js）
- `shareGroup.test.js`：成功 / 重复 / 解密失败 / shareLog 唯一索引模拟
- `helpInvite.test.js`：成功（helper 必发 + inviter 偶数次发 + 奇数次不发） / self-help / bad-token / duplicate
- `login.test.js`（已存在）扩展：helpToken 返回 + nickname 入参 upsert
- `listGrants.test.js`（已存在）扩展：recentHelps 字段返回（按 inviter=me 最近 7 天 helpLog）

### 10.3 端到端 smoke（发版前，两台微信真机）
1. A 分享到群 → +1 中提示
2. A 再分享同群 → "已分享过"
3. A 分享到不同群 → 再 +1
4. A 邀请助力分享给 B、C → A 得 1 张强，B/C 各 1 张弱
5. B 再次助力 A → "今天已经为他助力过啦"
6. A 给自己助力（A 端打开自己分享的链接） → "不能给自己"

## 11. 部署 ops 步骤（属于推出 checklist，不在 plan task 内）

1. cloudbase 控制台 → 云函数 `helpInvite` → 环境变量 → 新增 `HELP_TOKEN_SECRET = <openssl rand -hex 32>`
2. cloudbase 控制台 → 同样为 `login` 配 `HELP_TOKEN_SECRET`
3. cloudbase 控制台 → 数据库 → 新建 collection `shareLog`，加唯一索引 `(openid, openGId, dateStr)`
4. cloudbase 控制台 → 数据库 → 新建 collection `helpLog`，加唯一索引 `(inviter, helper, dateStr)`
5. 部署 4 个云函数：`login`（改）、`shareGroup`（新）、`helpInvite`（新）、`listGrants`（改：recentHelps 字段）
6. 发版前端 smoke（§10.3）

## 12. 开放问题（实现时再敲）

- `recentHelps` 默认拉最近 7 天合理吗？还是参考"上次见过的 ts"差量？— 差量简单，先 7 天
- `users.nickname` 用户没授权 `getUserInfo` 时存什么？— 'Ta'，UI 兜底 fallback
- helper modal 关掉后下次再点链接还要不要再弹？— 同 helpLog 已 duplicate，云端拒，端上 toast 即可
- 邀请助力分享文案要不要 A/B？— MVP 单文案：「帮我助力一次，我送你一张提示券」
