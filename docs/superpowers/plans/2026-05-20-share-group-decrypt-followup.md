# Follow-up: shareGroup 真机解密路径接入

**Created**: 2026-05-20 (社交助力 plan2c+2d PR 收尾时拆出)
**Status**: pending
**Owner**: TBD
**Parent PR**: #3 — feat(minigame): plan 2c+2d 社交助力

## 背景

plan 2c (群分享换中提示券) 的 cloud function `shareGroup` 在迁移 `wx-server-sdk → @cloudbase/node-sdk` 时,
`getOpenData` 接口没有等价替代，被 stub 成 `Promise.reject(new Error('getOpenData not available...'))`。

后果：真机走「群分享换 1 张中提示」流程，cloud 端会直接返回 `{ ok:false, err:'decrypt-failed' }`,
客户端 toast 显示 "换券失败：decrypt-failed"。整个群分享换券路径**不可用**。

不影响其它路径（邀请助力 / convertHelpToStrong / 体力消耗等）。

## 涉及文件

- `calendar-puzzle-miniprogram/minigame/cloud/functions/shareGroup/index.js`
  - `makeCloud()` 里的 `getOpenData` stub（≈ line 80）
  - 调用点：`_impl()` line 25 `cloud.getOpenData({ openData: [{ data, iv }] })`

## 任务

### T1: 调研 @cloudbase/node-sdk 替代 API

旧 `wx-server-sdk` 的 `cloud.getOpenData(...)` 是把 wx 客户端 `wx.getShareInfo` 拿到的 encryptedData
用用户的 session_key 在云函数里本地解密。在新 sdk 里需要走 OpenAPI:

- 候选 1: `app.callWxOpenApi({ apiName: 'wxa.getopendata' / 'wxa.business.getopendata' })`
- 候选 2: `app.openapi.wxa.getOpenData(...)`（如果 SDK 提供 typed wrapper）
- 候选 3: 自己用 session_key 调 wx aes-128-cbc 解密（绕过 SDK；session_key 通过 `app.auth().getEndUserInfo` 等接口拿）

参考:
- https://docs.cloudbase.net/cloud-function/wx-server-sdk/api/getopendata（旧）
- https://docs.cloudbase.net/cloud-function/resource-integration/cloudbase
- https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sharing/getOpenData.html

确定可行方案 + 验证 mini-game 上下文能拿到 session_key（小游戏跟小程序的 OpenAPI 权限略有差异）。

### T2: 实现 + 单测

替换 `makeCloud` 里的 stub:

```js
getOpenData: function (opts) {
  // 走 cloudbase OpenAPI 解密 (具体 API 名根据 T1 调研结论)
  return app.callWxOpenApi({ apiName: '...', apiOptions: { ... } });
},
```

`tests/cloud-mock.js` 已经有 `setMockOpenData` 给单测 inject decoded payload，
现有 `tests/shareGroup.test.js` 应保持通过。

### T3: 真机 smoke

部署 shareGroup → 真机/微信中：
1. 进任一题目 → 提示 → 选「中」→ 走「群分享换 1 张中提示」
2. 转发到任一群（注意：必须**新群**，老群里今天分享过会 `duplicate`）
3. 期望：toast `+1 张中提示`，本地 voucher cache `medium +1`
4. 检查 `shareLog` 集合：新增一行，含正确 `openid`、`openGId`、`dateStr`
5. 再次分享到**同一群**：toast `今天这个群已经分享过`，DB 不增

### T4: 失败路径文案

- 非群分享（单聊 / 朋友圈）→ wx.shareAppMessage 不返回 shareTickets → 客户端已有 `请分享到群聊` 提示
- 网络错 → toast `网络异常`（已有）
- 服务端解密失败（OpenAPI 调用失败 / 签名不对）→ toast 应该比 `换券失败：decrypt-failed` 更友好；
  建议加一个 `share-decrypt-failed` 文案改成 `分享数据验证失败，稍后再试`

### T5: deploy + 文档

- `minigame/CHANGELOG.md` 加一行 patch note
- `minigame/cloud/README.md` 如果有部署清单，shareGroup 状态从 stub → 可用

## 验收

- [ ] 真机两台手机 / 两个群，能各自分享换券
- [ ] 同群同日 dedup 生效
- [ ] 失败路径有清晰文案，不再出现 `decrypt-failed`
- [ ] shareGroup 单测仍然 pass（cloud-mock 的 setMockOpenData 路径保留）

## 不在范围

- 群分享场景外的 share（朋友圈 / 单聊 / 收藏）— 这些不发券
- shareGroup 之外的发券路径（grantHint、helpInvite、convertHelpToStrong）— 已经在 PR #3 修好
