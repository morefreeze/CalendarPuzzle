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
