# Cloud Functions Deployment

Environment: `cloudbase-2g5wjm7448ddc7bf`

## First-time setup

1. Open the project in WeChat 开发者工具.
2. Click the "云开发" (Cloud Development) button in the top toolbar.
3. Confirm the env `cloudbase-2g5wjm7448ddc7bf` is selected.
4. In the "云函数" tab, you should see 4 functions detected automatically (login, grantHint, useHint, listGrants) — they map to the `functions/` directory specified by `cloudfunctionRoot` in `minigame/project.config.json`.

## Deploy a function

For each of `login`, `grantHint`, `useHint`, `listGrants`:

1. Right-click the function folder under "云函数" → "上传并部署：云端安装依赖（不上传 node_modules）".
2. Wait for the upload to complete. The cloud will run `npm install` on `package.json` server-side.

## Manual smoke test

After deploying all 4 functions, in 开发者工具's "调试器" → "Console", run:

```js
const cc = require('./js/cloudClient');
cc.init();
cc.login().then(console.log);          // → { ok: true, openid: 'oXXX...', isNewUser: true|false }
cc.grantHint('weak', 'ad').then(console.log);  // → { ok: true, grantId: 'xxx' }
cc.listGrants('test-puzzle').then(console.log); // → { ok: true, balance: { weak: 1, ... }, used: { weak: 0, ... } }
cc.useHint('weak', 'test-puzzle').then(console.log); // → { ok: true, grantId: 'xxx' }
cc.listGrants('test-puzzle').then(console.log); // → { ok: true, balance: { weak: 0, ... }, used: { weak: 1, ... } }
```

If all 5 calls succeed and the balance/used numbers match the expected progression, Plan 2a foundation is verified.

## Inspecting data

In 开发者工具 → 云开发 → 数据库, you can browse the `users` and `hintGrants` collections to inspect rows after smoke testing.

---

## Plan 2c+2d deploy steps (群分享 + 助力 + voucher 化)

### 1. Environment variables (cloudbase console)

Both `login` and `helpInvite` need a shared HMAC secret. In the cloudbase
console (微信开发者工具 → 云开发 → 云函数 → select function → 配置 → 环境变量),
set on **each** of these two functions:

```
HELP_TOKEN_SECRET = <openssl rand -hex 32 output>
```

The two functions MUST share the same value — `login` issues the token,
`helpInvite` verifies it. Recommend generating once and pasting into both
function configurations.

### 2. Database collections + indexes

In cloudbase console → 数据库 → 集合管理, create two new collections and
add **唯一索引** (unique compound index) for each:

| Collection | Fields (unique index) |
|------------|-----------------------|
| `shareLog` | `openid`, `openGId`, `dateStr` |
| `helpLog`  | `inviter`, `helper`, `dateStr` |

Without the unique indexes, the cloud functions can still write but will
not dedupe correctly (allows farming vouchers).

### 3. Deploy functions

From 开发者工具, right-click each of these directories under "云函数" →
"上传并部署：云端安装依赖（不上传 node_modules）":

- `cloud/functions/login` (updated — returns helpToken + nickname upsert)
- `cloud/functions/listGrants` (updated — returns recentHelps + helpMediumBalance)
- `cloud/functions/shareGroup` (new)
- `cloud/functions/helpInvite` (new)
- `cloud/functions/convertHelpToStrong` (new — burns 2x medium/help → 1x strong/help)

Wait for each to finish. Cloudbase will run `npm install` server-side.

### 4. Smoke test in DevTools console

After deploying + setting env vars:

```js
const cc = require('./js/cloudClient');
cc.login({ nickname: 'TestUser' }).then(console.log);
// → { ok: true, openid: 'o...', isNewUser: false, helpToken: '<64-hex>' }
//   If helpToken is null, HELP_TOKEN_SECRET is missing on login — fix env vars.
```

End-to-end smoke (two phones) is covered in plan §16 (`docs/superpowers/plans/2026-05-19-social-plan2cd.md`).

