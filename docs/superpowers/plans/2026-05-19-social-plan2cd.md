# Social Plan 2c+2d Implementation Plan (Group Share + Help Invite + Voucher-ize Hint)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up two社交券 sources (群分享 / 助力邀请) end-to-end + refactor hint.js to consume cloud-issued vouchers (local-first, async cloud reconcile). Defers ad source (plan 2b) and `subscribeMessage` push (template ID not provisioned).

**Architecture:** Two new cloud functions (`shareGroup`, `helpInvite`) on top of plan 2a's foundation, plus extensions to `login` (helpToken+nickname) and `listGrants` (recentHelps). New端 module `voucher.js` for cache + pending-use queue; `hint.js` gets a `source` param. UI changes in `gameScene.js` (二级"获取路径" menu) and `selectScene.js` (helper landing modal).

**Tech Stack:** wx-server-sdk cloud functions (Node.js), vanilla JS in `minigame/js/`, `node --test` with `cloud-mock.js` shim, WeChat 云开发 env `cloudbase-2g5wjm7448ddc7bf`.

**Spec reference:** `docs/superpowers/specs/2026-05-19-social-plan2cd-design.md` (this plan implements that spec).

---

## Pre-flight

- All work happens inside `calendar-puzzle-miniprogram/`.
- Run tests from that dir: `cd calendar-puzzle-miniprogram && node --test`.
- Cloud function entry signature is `exports.main = async function (event, context, _cloudOverride)` — the third param is for tests; production code path does `require('wx-server-sdk')` + `cloud.init(...)` itself.
- No transactional DB ops are available in the mini-game cloud DB; we follow the same "best-effort + idempotent dedup" pattern as plan 2a (see `useHint/index.js` race-note).

---

## Task 1: Extend `cloud-mock.js` — unique indexes + `getOpenData` mock

**Files:**
- Modify: `calendar-puzzle-miniprogram/tests/cloud-mock.js`

The shareGroup and helpInvite cloud functions rely on (a) unique-index conflict detection for dedup, and (b) `cloud.getOpenData` to decrypt the group share's encrypted blob. The current mock has neither.

- [ ] **Step 1.1: Add unique-index test (RED)**

Add to `calendar-puzzle-miniprogram/tests/cloud-mock.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');

test('mock: setUniqueIndex enforces uniqueness on add', async function () {
  mock.reset();
  mock.setUniqueIndex('shareLog', ['openid', 'openGId', 'dateStr']);
  var db = mock.database();
  await db.collection('shareLog').add({
    data: { openid: 'a', openGId: 'g1', dateStr: '2026-05-19' },
  });
  await assert.rejects(
    db.collection('shareLog').add({
      data: { openid: 'a', openGId: 'g1', dateStr: '2026-05-19' },
    }),
    /duplicate/
  );
});

test('mock: setMockOpenData maps encryptedData+iv to decoded payload', async function () {
  mock.reset();
  mock.setMockOpenData('enc1', 'iv1', { openGId: 'group_X' });
  var got = await mock.getOpenData({ openData: [{ data: 'enc1', iv: 'iv1' }] });
  assert.strictEqual(got.list[0].openGId, 'group_X');
});

test('mock: getOpenData rejects unknown encryptedData', async function () {
  mock.reset();
  await assert.rejects(
    mock.getOpenData({ openData: [{ data: 'unknown', iv: 'iv' }] }),
    /unknown encryptedData/
  );
});
```

- [ ] **Step 1.2: Run, confirm failure**

```
cd calendar-puzzle-miniprogram && node --test tests/cloud-mock.test.js
```
Expected: 3 failures referencing `setUniqueIndex` / `setMockOpenData` / `getOpenData` not being functions.

- [ ] **Step 1.3: Implement mock extensions**

Edit `tests/cloud-mock.js`:

1. Add module-level state at top:
```js
var _uniqueIndexes = {};  // collectionName -> array of field arrays
var _openDataMap = {};     // 'enc1|iv1' -> { openGId: 'group_X' }
```

2. In `reset()`, clear them:
```js
_uniqueIndexes = {};
_openDataMap = {};
```

3. Modify `_collection().add` to enforce unique index before push:
```js
add: function (opts) {
  var indexes = _uniqueIndexes[name] || [];
  for (var i = 0; i < indexes.length; i++) {
    var fields = indexes[i];
    var conflict = store.find(function (d) {
      for (var j = 0; j < fields.length; j++) {
        if (d[fields[j]] !== opts.data[fields[j]]) return false;
      }
      return true;
    });
    if (conflict) {
      return Promise.reject({ errCode: -502002, errMsg: 'duplicate key on ' + name + ':' + fields.join(',') });
    }
  }
  var doc = { _id: _genId() };
  for (var k in opts.data) doc[k] = opts.data[k];
  store.push(doc);
  return Promise.resolve({ _id: doc._id });
},
```

4. Add to `module.exports`:
```js
setUniqueIndex: function (collectionName, fields) {
  if (!_uniqueIndexes[collectionName]) _uniqueIndexes[collectionName] = [];
  _uniqueIndexes[collectionName].push(fields);
},
setMockOpenData: function (encryptedData, iv, payload) {
  _openDataMap[encryptedData + '|' + iv] = payload;
},
getOpenData: function (opts) {
  var list = [];
  var items = (opts && opts.openData) || [];
  for (var i = 0; i < items.length; i++) {
    var key = items[i].data + '|' + items[i].iv;
    if (!(key in _openDataMap)) {
      return Promise.reject(new Error('unknown encryptedData ' + key));
    }
    list.push(_openDataMap[key]);
  }
  return Promise.resolve({ list: list });
},
```

- [ ] **Step 1.4: Run, confirm green**

```
cd calendar-puzzle-miniprogram && node --test tests/cloud-mock.test.js
```
Expected: all green. Also run full suite `node --test` to confirm no regressions.

- [ ] **Step 1.5: Commit**

```
git add calendar-puzzle-miniprogram/tests/cloud-mock.js calendar-puzzle-miniprogram/tests/cloud-mock.test.js
git commit -m "test(cloud-mock): unique index + getOpenData mocks for plan 2cd"
```

---

## Task 2: `shareGroup` cloud function (TDD)

**Files:**
- Create: `calendar-puzzle-miniprogram/minigame/cloud/functions/shareGroup/index.js`
- Create: `calendar-puzzle-miniprogram/minigame/cloud/functions/shareGroup/package.json`
- Create: `calendar-puzzle-miniprogram/tests/shareGroup.test.js`

Spec §5.2. Cloud function decrypts share blob via `cloud.getOpenData`, dedups against `shareLog`, issues a medium `share` voucher.

- [ ] **Step 2.1: Create `package.json`**

```json
{
  "name": "shareGroup",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": { "wx-server-sdk": "~2.6.3" }
}
```

- [ ] **Step 2.2: Write tests (RED)**

`tests/shareGroup.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var shareGroup = require('../minigame/cloud/functions/shareGroup/index');

function todayStr() {
  var d = new Date();
  var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function setup() {
  mock.reset();
  mock.setUniqueIndex('shareLog', ['openid', 'openGId', 'dateStr']);
  mock.setMockContext({ OPENID: 'alice' });
}

test('shareGroup: success — decrypts, logs, grants medium share voucher', async function () {
  setup();
  mock.setMockOpenData('enc1', 'iv1', { openGId: 'group_A' });
  var r = await shareGroup.main({ encryptedData: 'enc1', iv: 'iv1' }, {}, mock);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.granted, { type: 'medium', source: 'share' });

  var logs = await mock.database().collection('shareLog').where({ openid: 'alice' }).get();
  assert.strictEqual(logs.data.length, 1);
  assert.strictEqual(logs.data[0].openGId, 'group_A');
  assert.strictEqual(logs.data[0].dateStr, todayStr());

  var grants = await mock.database().collection('hintGrants').where({ openid: 'alice', type: 'medium', source: 'share' }).get();
  assert.strictEqual(grants.data.length, 1);
});

test('shareGroup: duplicate — same openid/group/day rejected', async function () {
  setup();
  mock.setMockOpenData('enc1', 'iv1', { openGId: 'group_A' });
  await shareGroup.main({ encryptedData: 'enc1', iv: 'iv1' }, {}, mock);
  var r = await shareGroup.main({ encryptedData: 'enc1', iv: 'iv1' }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'duplicate');

  var grants = await mock.database().collection('hintGrants').where({ openid: 'alice', source: 'share' }).get();
  assert.strictEqual(grants.data.length, 1);
});

test('shareGroup: different groups same day both succeed', async function () {
  setup();
  mock.setMockOpenData('enc1', 'iv1', { openGId: 'group_A' });
  mock.setMockOpenData('enc2', 'iv2', { openGId: 'group_B' });
  await shareGroup.main({ encryptedData: 'enc1', iv: 'iv1' }, {}, mock);
  var r = await shareGroup.main({ encryptedData: 'enc2', iv: 'iv2' }, {}, mock);
  assert.strictEqual(r.ok, true);

  var grants = await mock.database().collection('hintGrants').where({ openid: 'alice', source: 'share' }).get();
  assert.strictEqual(grants.data.length, 2);
});

test('shareGroup: decrypt failure returns decrypt-failed', async function () {
  setup();
  var r = await shareGroup.main({ encryptedData: 'unknown', iv: 'iv' }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'decrypt-failed');
});

test('shareGroup: missing input returns invalid-input', async function () {
  setup();
  var r = await shareGroup.main({}, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'invalid-input');
});
```

- [ ] **Step 2.3: Run, confirm failure**

```
cd calendar-puzzle-miniprogram && node --test tests/shareGroup.test.js
```
Expected: all fail with "Cannot find module".

- [ ] **Step 2.4: Implement `shareGroup/index.js`**

```js
// Decrypts a wx.getShareInfo blob → derives openGId → dedups via shareLog →
// issues one 'medium','share' hintGrant. Best-effort: shareLog insert + hintGrants insert
// are two non-atomic writes; if the second fails, the dedup will still hold (slight
// player loss of one voucher; cloud function logs surface this).

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  }
  var encryptedData = event && event.encryptedData;
  var iv = event && event.iv;
  if (!encryptedData || !iv) return { ok: false, err: 'invalid-input' };

  var openid = cloud.getWXContext().OPENID;
  var openGId;
  try {
    var decoded = await cloud.getOpenData({ openData: [{ data: encryptedData, iv: iv }] });
    openGId = decoded && decoded.list && decoded.list[0] && decoded.list[0].openGId;
    if (!openGId) return { ok: false, err: 'decrypt-failed' };
  } catch (e) {
    return { ok: false, err: 'decrypt-failed' };
  }

  var db = cloud.database();
  var d = new Date();
  var dateStr = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  try {
    await db.collection('shareLog').add({
      data: {
        openid: openid,
        openGId: openGId,
        dateStr: dateStr,
        createdAt: db.serverDate(),
      },
    });
  } catch (e) {
    if (e && (e.errCode === -502002 || /duplicate/.test(e.errMsg || e.message || ''))) {
      return { ok: false, err: 'duplicate' };
    }
    return { ok: false, err: 'log-failed' };
  }

  await db.collection('hintGrants').add({
    data: {
      openid: openid,
      type: 'medium',
      source: 'share',
      grantedAt: db.serverDate(),
      usedAt: null,
      usedInPuzzle: null,
    },
  });

  return { ok: true, granted: { type: 'medium', source: 'share' } };
};
```

- [ ] **Step 2.5: Run, confirm green**

```
cd calendar-puzzle-miniprogram && node --test tests/shareGroup.test.js
```
Expected: 5/5 pass.

- [ ] **Step 2.6: Commit**

```
git add calendar-puzzle-miniprogram/minigame/cloud/functions/shareGroup/ calendar-puzzle-miniprogram/tests/shareGroup.test.js
git commit -m "feat(cloud): shareGroup — decrypt + dedup + grant medium share voucher"
```

---

## Task 3: `helpInvite` cloud function (TDD)

**Files:**
- Create: `calendar-puzzle-miniprogram/minigame/cloud/functions/helpInvite/index.js`
- Create: `calendar-puzzle-miniprogram/minigame/cloud/functions/helpInvite/package.json`
- Create: `calendar-puzzle-miniprogram/tests/helpInvite.test.js`

Spec §6.4. Validates HMAC token, dedupes via helpLog, double-grants (helper weak + inviter strong on even count).

- [ ] **Step 3.1: Create `package.json`**

```json
{
  "name": "helpInvite",
  "version": "1.0.0",
  "description": "Verify HMAC + helpLog dedup + double-grant (helper weak, inviter strong on even)",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "^2.6.3"
  }
}
```

- [ ] **Step 3.2: Write tests (RED)**

`tests/helpInvite.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');
var crypto = require('node:crypto');
var mock = require('./cloud-mock');
var helpInvite = require('../minigame/cloud/functions/helpInvite/index');

var SECRET = 'test-secret-32-bytes-aaaaaaaaaaaa';

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function tokenFor(openid) {
  return crypto.createHmac('sha256', SECRET).update(openid + todayStr()).digest('hex');
}

function setup() {
  mock.reset();
  mock.setUniqueIndex('helpLog', ['inviter', 'helper', 'dateStr']);
  process.env.HELP_TOKEN_SECRET = SECRET;
}

test('helpInvite: helper gets weak voucher; inviter gets none on N=1', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  var t = tokenFor('inviter1');
  var r = await helpInvite.main({ inviter: 'inviter1', t: t }, {}, mock);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.inviterNickname, 'Inv');
  assert.deepStrictEqual(r.granted, { type: 'weak', source: 'helperGift' });

  var helperGrants = await mock.database().collection('hintGrants').where({ openid: 'helper1' }).get();
  assert.strictEqual(helperGrants.data.length, 1);
  assert.strictEqual(helperGrants.data[0].type, 'weak');

  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 0);
});

test('helpInvite: inviter gets strong on N=2 (even)', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });

  mock.setMockContext({ OPENID: 'helper1' });
  await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);

  mock.setMockContext({ OPENID: 'helper2' });
  var r = await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);
  assert.strictEqual(r.ok, true);

  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 1);
  assert.strictEqual(inviterGrants.data[0].type, 'strong');
  assert.strictEqual(inviterGrants.data[0].source, 'help');
});

test('helpInvite: N=3 inviter still has 1 strong (no double-grant)', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  for (var i = 1; i <= 3; i++) {
    mock.setMockContext({ OPENID: 'helper' + i });
    await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);
  }
  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 1);
});

test('helpInvite: N=4 inviter has 2 strong', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  for (var i = 1; i <= 4; i++) {
    mock.setMockContext({ OPENID: 'helper' + i });
    await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);
  }
  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 2);
});

test('helpInvite: self-help rejected', async function () {
  setup();
  mock.setMockContext({ OPENID: 'alice' });
  var r = await helpInvite.main({ inviter: 'alice', t: tokenFor('alice') }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'self-help');
});

test('helpInvite: bad token rejected', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  var r = await helpInvite.main({ inviter: 'inviter1', t: 'badtoken' }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'bad-token');
});

test('helpInvite: duplicate same helper same day rejected', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  mock.setMockContext({ OPENID: 'helper1' });
  var t = tokenFor('inviter1');
  await helpInvite.main({ inviter: 'inviter1', t: t }, {}, mock);
  var r = await helpInvite.main({ inviter: 'inviter1', t: t }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'duplicate');
});

test('helpInvite: inviter without users row gets fallback nickname "Ta"', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  var r = await helpInvite.main({ inviter: 'nobody', t: tokenFor('nobody') }, {}, mock);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.inviterNickname, 'Ta');
});
```

- [ ] **Step 3.3: Run, confirm failure**

```
cd calendar-puzzle-miniprogram && node --test tests/helpInvite.test.js
```
Expected: all fail with module-not-found.

- [ ] **Step 3.4: Implement `helpInvite/index.js`**

```js
// Validates an inviter→helper invite using an HMAC token tied to (inviter, today, SECRET).
// Inserts a helpLog row (unique by inviter+helper+dateStr) → grants helper a weak
// 'helperGift' voucher → on every even cumulative helpLog count for that inviter, also
// grants the inviter one strong 'help' voucher.
// SECRET comes from env HELP_TOKEN_SECRET (configured in cloudbase console per cloud function).
// Race: if two helpers complete simultaneously when count is about to cross an even
// boundary, both may see N%2==0 and double-grant. Accepted per spec §6.4.

var crypto = require('crypto');

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function expectedToken(openid, dateStr, secret) {
  return crypto.createHmac('sha256', secret).update(openid + dateStr).digest('hex');
}

function timingSafeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  }
  var inviter = event && event.inviter;
  var t = event && event.t;
  if (!inviter || !t) return { ok: false, err: 'invalid-input' };

  var helper = cloud.getWXContext().OPENID;
  if (inviter === helper) return { ok: false, err: 'self-help' };

  var secret = process.env.HELP_TOKEN_SECRET;
  if (!secret) return { ok: false, err: 'server-misconfigured' };

  var dateStr = todayStr();
  if (!timingSafeEq(t, expectedToken(inviter, dateStr, secret))) {
    return { ok: false, err: 'bad-token' };
  }

  var db = cloud.database();

  try {
    await db.collection('helpLog').add({
      data: {
        inviter: inviter,
        helper: helper,
        dateStr: dateStr,
        createdAt: db.serverDate(),
      },
    });
  } catch (e) {
    if (e && (e.errCode === -502002 || /duplicate/.test(e.errMsg || e.message || ''))) {
      return { ok: false, err: 'duplicate' };
    }
    return { ok: false, err: 'log-failed' };
  }

  var countRes = await db.collection('helpLog').where({ inviter: inviter, dateStr: dateStr }).count();
  var N = countRes.total;

  await db.collection('hintGrants').add({
    data: {
      openid: helper,
      type: 'weak',
      source: 'helperGift',
      grantedAt: db.serverDate(),
      usedAt: null,
      usedInPuzzle: null,
    },
  });

  if (N % 2 === 0) {
    await db.collection('hintGrants').add({
      data: {
        openid: inviter,
        type: 'strong',
        source: 'help',
        grantedAt: db.serverDate(),
        usedAt: null,
        usedInPuzzle: null,
      },
    });
  }

  var userRes = await db.collection('users').where({ openid: inviter }).limit(1).get();
  var nickname = (userRes.data && userRes.data[0] && userRes.data[0].nickname) || 'Ta';

  return {
    ok: true,
    inviterNickname: nickname,
    granted: { type: 'weak', source: 'helperGift' },
  };
};
```

- [ ] **Step 3.5: Run, confirm green**

```
cd calendar-puzzle-miniprogram && node --test tests/helpInvite.test.js
```
Expected: 8/8 pass.

- [ ] **Step 3.6: Commit**

```
git add calendar-puzzle-miniprogram/minigame/cloud/functions/helpInvite/ calendar-puzzle-miniprogram/tests/helpInvite.test.js
git commit -m "feat(cloud): helpInvite — HMAC verify + helpLog dedup + double-grant (helper weak, inviter strong on even)"
```

---

## Task 4: Extend `login` — return helpToken + accept nickname/avatarUrl

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/cloud/functions/login/index.js`
- Modify: `calendar-puzzle-miniprogram/tests/login.test.js`

Spec §3.5. login returns `{ok, openid, isNewUser, helpToken}` where helpToken = HMAC(openid+today+SECRET). If caller passes `{nickname, avatarUrl}`, fill those fields (only if currently empty).

- [ ] **Step 4.1: Add tests (RED)**

Append to `tests/login.test.js`:

```js
var crypto = require('node:crypto');
var SECRET = 'test-secret-32-bytes-aaaaaaaaaaaa';

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

test('login returns helpToken = HMAC(openid+today+SECRET)', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_gamma' });
  var res = await login.main({}, {}, mock);
  var expected = crypto.createHmac('sha256', SECRET).update('user_gamma' + todayStr()).digest('hex');
  assert.strictEqual(res.helpToken, expected);
});

test('login fills nickname+avatarUrl on first call when provided', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_delta' });
  await login.main({ nickname: 'Del', avatarUrl: 'http://x' }, {}, mock);
  var u = await mock.database().collection('users').where({ openid: 'user_delta' }).get();
  assert.strictEqual(u.data[0].nickname, 'Del');
  assert.strictEqual(u.data[0].avatarUrl, 'http://x');
});

test('login does NOT overwrite existing nickname', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_eps' });
  await login.main({ nickname: 'First' }, {}, mock);
  await login.main({ nickname: 'Second' }, {}, mock);
  var u = await mock.database().collection('users').where({ openid: 'user_eps' }).get();
  assert.strictEqual(u.data[0].nickname, 'First');
});

test('login fills nickname on later call if it was empty before', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_zeta' });
  await login.main({}, {}, mock);  // creates row with no nickname
  await login.main({ nickname: 'Later' }, {}, mock);
  var u = await mock.database().collection('users').where({ openid: 'user_zeta' }).get();
  assert.strictEqual(u.data[0].nickname, 'Later');
});
```

- [ ] **Step 4.2: Run, confirm failures**

```
cd calendar-puzzle-miniprogram && node --test tests/login.test.js
```
Expected: 4 new tests fail (helpToken undefined / nickname not stored).

- [ ] **Step 4.3: Update `login/index.js`**

Replace with:

```js
// Resolves user's openid + upserts a row in `users`.
// Optionally fills nickname/avatarUrl on first-set (does not overwrite existing).
// Returns helpToken = HMAC_SHA256(openid + todayStr, env.HELP_TOKEN_SECRET)
// so the client can include it when sharing an invite link.

var crypto = require('crypto');

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  }
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;
  var nickname = event && event.nickname;
  var avatarUrl = event && event.avatarUrl;

  var existing = await db.collection('users').where({ openid: openid }).get();
  var isNewUser = !(existing.data && existing.data.length > 0);

  if (isNewUser) {
    var row = { openid: openid, createdAt: db.serverDate() };
    if (nickname) row.nickname = nickname;
    if (avatarUrl) row.avatarUrl = avatarUrl;
    await db.collection('users').add({ data: row });
  } else {
    var current = existing.data[0];
    var patch = {};
    if (nickname && !current.nickname) patch.nickname = nickname;
    if (avatarUrl && !current.avatarUrl) patch.avatarUrl = avatarUrl;
    if (Object.keys(patch).length > 0) {
      await db.collection('users').where({ openid: openid }).update({ data: patch });
    }
  }

  var secret = process.env.HELP_TOKEN_SECRET;
  var helpToken = secret
    ? crypto.createHmac('sha256', secret).update(openid + todayStr()).digest('hex')
    : null;

  return { ok: true, openid: openid, isNewUser: isNewUser, helpToken: helpToken };
};
```

- [ ] **Step 4.4: Run, confirm green**

```
cd calendar-puzzle-miniprogram && node --test tests/login.test.js
```
Expected: all tests pass (original 2 + new 4 = 6).

- [ ] **Step 4.5: Commit**

```
git add calendar-puzzle-miniprogram/minigame/cloud/functions/login/index.js calendar-puzzle-miniprogram/tests/login.test.js
git commit -m "feat(cloud): login returns helpToken + accepts nickname/avatarUrl (no overwrite)"
```

---

## Task 5: Extend `listGrants` — return `recentHelps`

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/cloud/functions/listGrants/index.js`
- Modify: `calendar-puzzle-miniprogram/tests/listGrants.test.js`

Spec §6.5. Add `recentHelps: [{helper, helperNickname, ts}, ...]` — pulls helpLog rows where `inviter == me` in last 7 days. Used by端 to render the "你最近收到 N 次助力" card.

- [ ] **Step 5.1: Add tests (RED)**

Append to `tests/listGrants.test.js`:

```js
test('listGrants returns recentHelps with helper nicknames (last 7 days)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'inviter1' });
  var db = mock.database();
  // Seed helpers with nicknames
  await db.collection('users').add({ data: { openid: 'h1', nickname: 'Helper-A' } });
  await db.collection('users').add({ data: { openid: 'h2', nickname: 'Helper-B' } });
  // Seed helpLog
  var now = Date.now();
  await db.collection('helpLog').add({
    data: { inviter: 'inviter1', helper: 'h1', dateStr: '2026-05-19', createdAt: new Date(now - 86400000) },
  });
  await db.collection('helpLog').add({
    data: { inviter: 'inviter1', helper: 'h2', dateStr: '2026-05-18', createdAt: new Date(now - 2 * 86400000) },
  });

  var r = await listGrants.main({}, {}, mock);
  assert.ok(Array.isArray(r.recentHelps));
  assert.strictEqual(r.recentHelps.length, 2);
  var nicks = r.recentHelps.map(function (h) { return h.helperNickname; }).sort();
  assert.deepStrictEqual(nicks, ['Helper-A', 'Helper-B']);
});

test('listGrants recentHelps filters out helpLog older than 7 days', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'inviter1' });
  var db = mock.database();
  await db.collection('users').add({ data: { openid: 'h_old', nickname: 'OLD' } });
  var now = Date.now();
  await db.collection('helpLog').add({
    data: { inviter: 'inviter1', helper: 'h_old', dateStr: '2026-05-01', createdAt: new Date(now - 10 * 86400000) },
  });
  var r = await listGrants.main({}, {}, mock);
  assert.strictEqual(r.recentHelps.length, 0);
});

test('listGrants recentHelps falls back to "Ta" when helper has no nickname', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'inviter1' });
  await mock.database().collection('helpLog').add({
    data: { inviter: 'inviter1', helper: 'mystery', dateStr: '2026-05-19', createdAt: new Date() },
  });
  var r = await listGrants.main({}, {}, mock);
  assert.strictEqual(r.recentHelps[0].helperNickname, 'Ta');
});
```

Note: the existing in-memory mock's `where()` only supports exact equality. We need range filters for the 7-day cutoff. We'll do filtering in JS after fetching all `inviter=me` helpLog rows (acceptable for the small per-inviter row count).

- [ ] **Step 5.2: Run, confirm failure**

```
cd calendar-puzzle-miniprogram && node --test tests/listGrants.test.js
```
Expected: new tests fail (recentHelps undefined).

- [ ] **Step 5.3: Update `listGrants/index.js`**

Replace with:

```js
// Returns per-tier balance + per-puzzle used count + recentHelps (last 7 days)
// for the calling user.
// puzzleId is optional; if omitted, used counts are all 0.

var TYPES = ['weak', 'medium', 'strong'];
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  }
  var puzzleId = event && event.puzzleId;
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var balance = { weak: 0, medium: 0, strong: 0 };
  var used = { weak: 0, medium: 0, strong: 0 };

  var promises = [];
  for (var i = 0; i < TYPES.length; i++) {
    (function (tt) {
      promises.push(
        db.collection('hintGrants').where({ openid: openid, type: tt, usedAt: null }).count()
          .then(function (r) { balance[tt] = r.total; })
      );
      if (puzzleId) {
        promises.push(
          db.collection('hintGrants').where({ openid: openid, type: tt, usedInPuzzle: puzzleId }).count()
            .then(function (r) { used[tt] = r.total; })
        );
      }
    })(TYPES[i]);
  }
  await Promise.all(promises);

  var cutoff = Date.now() - SEVEN_DAYS_MS;
  var helpRes = await db.collection('helpLog').where({ inviter: openid }).get();
  var recent = (helpRes.data || []).filter(function (row) {
    var t = row.createdAt instanceof Date ? row.createdAt.getTime() : Date.parse(row.createdAt);
    return !isNaN(t) && t >= cutoff;
  });
  var nickById = {};
  if (recent.length > 0) {
    var helperIds = recent.map(function (r) { return r.helper; });
    var usersRes = await db.collection('users').where({ openid: helperIds[0] }).get();
    // mock supports single-equality; fetch one by one (small N)
    for (var j = 0; j < helperIds.length; j++) {
      var uRes = await db.collection('users').where({ openid: helperIds[j] }).get();
      var row = uRes.data && uRes.data[0];
      nickById[helperIds[j]] = (row && row.nickname) || 'Ta';
    }
  }
  var recentHelps = recent.map(function (r) {
    return {
      helper: r.helper,
      helperNickname: nickById[r.helper] || 'Ta',
      ts: r.createdAt instanceof Date ? r.createdAt.getTime() : Date.parse(r.createdAt),
    };
  });

  return { ok: true, balance: balance, used: used, recentHelps: recentHelps };
};
```

(The `usersRes` first-batch line is dead — kept the loop for clarity. Remove that single-fetch line in cleanup; just keep the loop.)

After writing, remove the dead first-batch `usersRes` line so the function is:

```js
  if (recent.length > 0) {
    var helperIds = recent.map(function (r) { return r.helper; });
    for (var j = 0; j < helperIds.length; j++) {
      var uRes = await db.collection('users').where({ openid: helperIds[j] }).get();
      var row = uRes.data && uRes.data[0];
      nickById[helperIds[j]] = (row && row.nickname) || 'Ta';
    }
  }
```

- [ ] **Step 5.4: Run, confirm green**

```
cd calendar-puzzle-miniprogram && node --test tests/listGrants.test.js
```
Expected: all green (3 existing + 3 new = 6).

- [ ] **Step 5.5: Commit**

```
git add calendar-puzzle-miniprogram/minigame/cloud/functions/listGrants/index.js calendar-puzzle-miniprogram/tests/listGrants.test.js
git commit -m "feat(cloud): listGrants returns recentHelps (inviter's last-7-day helpLog + helper nicknames)"
```

---

## Task 6: Create `voucher.js`端 module (TDD)

**Files:**
- Create: `calendar-puzzle-miniprogram/minigame/js/voucher.js`
- Create: `calendar-puzzle-miniprogram/tests/voucher.test.js`

Spec §3.4 + §4.1. Pure-JS module managing `voucherCache` (localStorage-backed in prod, in-memory for tests). Exposes balance / displayBalance / pendingUse queue / flushPendingUse / reconcile.

- [ ] **Step 6.1: Write tests (RED)**

`tests/voucher.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');
var V = require('../minigame/js/voucher');

function fakeStorage() {
  var store = {};
  return {
    setItem: function (k, v) { store[k] = String(v); },
    getItem: function (k) { return k in store ? store[k] : null; },
    removeItem: function (k) { delete store[k]; },
    _peek: function () { return store; },
  };
}

test('voucher: fresh cache has zero balances', function () {
  var s = fakeStorage();
  var v = V.create({ storage: s });
  assert.deepStrictEqual(v.getBalance(), { weak: 0, medium: 0, strong: 0 });
  assert.strictEqual(v.displayBalance('weak'), 0);
});

test('voucher: applyGranted bumps balance', function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyGranted('weak', 'helperGift');
  assert.deepStrictEqual(v.getBalance(), { weak: 1, medium: 1, strong: 0 });
});

test('voucher: applyUsed adds to pendingUse, lowers displayBalance', function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyGranted('medium', 'share');
  assert.strictEqual(v.displayBalance('medium'), 2);
  v.applyUsed('medium', 'share', 'p1');
  assert.strictEqual(v.displayBalance('medium'), 1);
  assert.strictEqual(v.getBalance().medium, 2);
  assert.strictEqual(v.getPendingUse().length, 1);
});

test('voucher: displayBalance can go negative; not clamped', function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyUsed('medium', 'share', 'p1');
  v.applyUsed('medium', 'share', 'p1');  // over-use
  assert.strictEqual(v.displayBalance('medium'), -1);
});

test('voucher: canUseSocial true when displayBalance > 0, false when <= 0', function () {
  var v = V.create({ storage: fakeStorage() });
  assert.strictEqual(v.canUseSocial('weak'), false);
  v.applyGranted('weak', 'helperGift');
  assert.strictEqual(v.canUseSocial('weak'), true);
  v.applyUsed('weak', 'helperGift', 'p1');
  assert.strictEqual(v.canUseSocial('weak'), false);
});

test('voucher: setBalance overwrites (reconcile path)', function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('weak', 'helperGift');
  v.setBalance({ weak: 5, medium: 0, strong: 1 });
  assert.deepStrictEqual(v.getBalance(), { weak: 5, medium: 0, strong: 1 });
});

test('voucher: state persists to storage and reloads', function () {
  var s = fakeStorage();
  var v1 = V.create({ storage: s });
  v1.applyGranted('strong', 'help');
  v1.applyUsed('strong', 'help', 'p1');
  var v2 = V.create({ storage: s });
  assert.deepStrictEqual(v2.getBalance(), { weak: 0, medium: 0, strong: 1 });
  assert.strictEqual(v2.getPendingUse().length, 1);
});

test('voucher: flushPendingUse — success removes from queue', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyUsed('medium', 'share', 'p1');
  var fakeClient = {
    useHint: function () { return Promise.resolve({ ok: true }); },
  };
  await v.flushPendingUse(fakeClient);
  assert.strictEqual(v.getPendingUse().length, 0);
});

test('voucher: flushPendingUse — network failure keeps queue', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyUsed('medium', 'share', 'p1');
  var fakeClient = {
    useHint: function () { return Promise.reject(new Error('network')); },
  };
  await v.flushPendingUse(fakeClient);
  assert.strictEqual(v.getPendingUse().length, 1);
});

test('voucher: flushPendingUse — business error removes from queue but does NOT adjust balance', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyUsed('medium', 'share', 'p1');
  var balBefore = v.getBalance().medium;
  var fakeClient = {
    useHint: function () { return Promise.resolve({ ok: false, reason: 'cap-reached' }); },
  };
  await v.flushPendingUse(fakeClient);
  assert.strictEqual(v.getPendingUse().length, 0);
  assert.strictEqual(v.getBalance().medium, balBefore);
});

test('voucher: reconcile sets balance from cloud listGrants response', async function () {
  var v = V.create({ storage: fakeStorage() });
  var fakeClient = {
    listGrants: function () {
      return Promise.resolve({ ok: true, balance: { weak: 3, medium: 1, strong: 0 } });
    },
  };
  await v.reconcile(fakeClient, 'p1');
  assert.deepStrictEqual(v.getBalance(), { weak: 3, medium: 1, strong: 0 });
});

test('voucher: reconcile network failure leaves balance untouched', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('weak', 'helperGift');
  var fakeClient = { listGrants: function () { return Promise.reject(new Error('net')); } };
  await v.reconcile(fakeClient, 'p1');
  assert.strictEqual(v.getBalance().weak, 1);
});
```

- [ ] **Step 6.2: Run, confirm failure**

```
cd calendar-puzzle-miniprogram && node --test tests/voucher.test.js
```
Expected: all fail with module-not-found.

- [ ] **Step 6.3: Implement `minigame/js/voucher.js`**

```js
// Voucher cache + pending-use queue. Local-first; reconciled with cloud listGrants.
// Pure JS, no wx.* — production injects wx.getStorageSync wrapper, tests inject in-memory.

var STORAGE_KEY = 'voucherCache';
var TYPES = ['weak', 'medium', 'strong'];

function emptyState() {
  return {
    openid: null,
    fetchedAt: 0,
    balance: { weak: 0, medium: 0, strong: 0 },
    pendingUse: [],
    pendingGrant: [],
  };
}

function _read(storage) {
  try {
    var raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    var parsed = JSON.parse(raw);
    // backfill in case schema evolved
    var base = emptyState();
    for (var k in parsed) base[k] = parsed[k];
    return base;
  } catch (e) {
    return emptyState();
  }
}

function _write(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function create(opts) {
  opts = opts || {};
  var storage = opts.storage;
  if (!storage) throw new Error('voucher.create: storage required');
  var state = _read(storage);

  function getBalance() {
    return { weak: state.balance.weak, medium: state.balance.medium, strong: state.balance.strong };
  }

  function getPendingUse() {
    return state.pendingUse.slice();
  }

  function _pendingCount(type) {
    var n = 0;
    for (var i = 0; i < state.pendingUse.length; i++) {
      if (state.pendingUse[i].type === type) n++;
    }
    return n;
  }

  function displayBalance(type) {
    return state.balance[type] - _pendingCount(type);
  }

  function canUseSocial(type) {
    return displayBalance(type) > 0;
  }

  function applyGranted(type, source) {
    state.balance[type] = state.balance[type] + 1;
    _write(storage, state);
  }

  function applyUsed(type, source, puzzleId) {
    state.pendingUse.push({ type: type, source: source, puzzleId: puzzleId, ts: Date.now() });
    _write(storage, state);
  }

  function setBalance(b) {
    state.balance = { weak: b.weak || 0, medium: b.medium || 0, strong: b.strong || 0 };
    state.fetchedAt = Date.now();
    _write(storage, state);
  }

  function flushPendingUse(client) {
    if (!client || !client.useHint) return Promise.resolve();
    var queue = state.pendingUse.slice();
    if (queue.length === 0) return Promise.resolve();
    var idx = 0;
    function step() {
      if (idx >= queue.length) return Promise.resolve();
      var item = queue[idx++];
      return client.useHint(item.type, item.puzzleId).then(function (r) {
        if (r && r.ok) {
          _removeFromQueue(item);
        } else {
          // business error — remove from queue, do NOT touch balance
          _removeFromQueue(item);
        }
        return step();
      }, function () {
        // network error — leave in queue, stop iterating (avoid retry storm)
        return Promise.resolve();
      });
    }
    return step();
  }

  function _removeFromQueue(item) {
    for (var i = 0; i < state.pendingUse.length; i++) {
      var p = state.pendingUse[i];
      if (p.type === item.type && p.puzzleId === item.puzzleId && p.ts === item.ts) {
        state.pendingUse.splice(i, 1);
        _write(storage, state);
        return;
      }
    }
  }

  function reconcile(client, puzzleId) {
    if (!client || !client.listGrants) return Promise.resolve();
    return client.listGrants(puzzleId).then(function (r) {
      if (r && r.ok && r.balance) {
        setBalance(r.balance);
      }
    }, function () { /* ignore */ });
  }

  function getOpenid() { return state.openid; }
  function setOpenid(oid) { state.openid = oid; _write(storage, state); }

  return {
    getBalance: getBalance,
    getPendingUse: getPendingUse,
    displayBalance: displayBalance,
    canUseSocial: canUseSocial,
    applyGranted: applyGranted,
    applyUsed: applyUsed,
    setBalance: setBalance,
    flushPendingUse: flushPendingUse,
    reconcile: reconcile,
    getOpenid: getOpenid,
    setOpenid: setOpenid,
  };
}

module.exports = { create: create, STORAGE_KEY: STORAGE_KEY };
```

- [ ] **Step 6.4: Run, confirm green**

```
cd calendar-puzzle-miniprogram && node --test tests/voucher.test.js
```
Expected: 12/12 pass.

- [ ] **Step 6.5: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/voucher.js calendar-puzzle-miniprogram/tests/voucher.test.js
git commit -m "feat(minigame): voucher.js — local-first balance + pendingUse queue + cloud reconcile"
```

---

## Task 7: Add `source` param to `hint.js` (no behavior change yet)

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/hint.js`
- Modify: `calendar-puzzle-miniprogram/tests/hint.test.js`

The hint state machine doesn't itself talk to cloud — it stays pure, and only gets a `source` tag passed through so callers (gameScene) can decide whether to enqueue via voucher.js. This keeps hint.js's existing 12-test coverage intact and adds two new tests for source pass-through.

- [ ] **Step 7.1: Add test for source pass-through (RED)**

Append to `tests/hint.test.js`:

```js
test('applyMedium accepts and passes through source param without changing state', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1, 1], [0, 1]] } };
  var res = H.applyMedium(state, 'X-block', palette, dropped, solved, 'share');
  assert.strictEqual(res.newState.usedMedium, 1);
  // No source field on state itself — purely a caller-side tag
});

test('applyStrong accepts and passes through source param', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1, 1]] } };
  var res = H.applyStrong(state, 'X-block', palette, dropped, solved, 'help');
  assert.strictEqual(res.newState.usedStrong, 1);
});
```

- [ ] **Step 7.2: Run; either passes (since JS ignores extra params) or fails — note actual outcome**

```
cd calendar-puzzle-miniprogram && node --test tests/hint.test.js
```
JS will accept the extra arg silently. Tests should pass without code changes. **In that case skip Step 7.3.** If anything errors, fix in Step 7.3.

- [ ] **Step 7.3: (only if 7.2 failed) Update `hint.js` to accept the param**

Add `source` as the last formal param to `applyWeak / applyMedium / applyStrong`:

```js
function applyMedium(state, blockId, palette, dropped, solvedPlacements, source) {
  // ... body unchanged; `source` ignored here (caller logs to voucher.js)
}
```

- [ ] **Step 7.4: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/hint.js calendar-puzzle-miniprogram/tests/hint.test.js
git commit -m "test(minigame): hint.applyXxx accepts source param (caller tag, no state change)"
```

---

## Task 8: Extend `cloudClient.js` — shareGroup / helpInvite RPCs + helpToken cache

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/cloudClient.js`

Add `shareGroup`, `helpInvite`, `getHelpToken`. Cache helpToken from login response.

- [ ] **Step 8.1: Edit `cloudClient.js`**

Replace the whole file with:

```js
// Thin wrapper over wx.cloud.callFunction. Caches openid + helpToken after login.

var CLOUD_ENV = 'cloudbase-2g5wjm7448ddc7bf';
var _initialized = false;
var _openid = null;
var _helpToken = null;

function init() {
  if (_initialized) return;
  if (typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('wx.cloud not available — are you running outside WeChat?');
  }
  wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
  _initialized = true;
}

function _call(name, data) {
  init();
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: function (res) {
        if (res && res.result) resolve(res.result);
        else reject(new Error('empty result from ' + name));
      },
      fail: function (err) {
        reject(err);
      },
    });
  });
}

function login(extra) {
  return _call('login', extra || {}).then(function (r) {
    if (r && r.ok) {
      _openid = r.openid;
      _helpToken = r.helpToken || null;
    }
    return r;
  });
}

function getOpenid() { return _openid; }
function getHelpToken() { return _helpToken; }

function grantHint(type, source) {
  return _call('grantHint', { type: type, source: source });
}

function useHint(type, puzzleId) {
  return _call('useHint', { type: type, puzzleId: puzzleId });
}

function listGrants(puzzleId) {
  return _call('listGrants', { puzzleId: puzzleId });
}

function shareGroup(encryptedData, iv) {
  return _call('shareGroup', { encryptedData: encryptedData, iv: iv });
}

function helpInvite(inviter, t) {
  return _call('helpInvite', { inviter: inviter, t: t });
}

module.exports = {
  init: init,
  login: login,
  getOpenid: getOpenid,
  getHelpToken: getHelpToken,
  grantHint: grantHint,
  useHint: useHint,
  listGrants: listGrants,
  shareGroup: shareGroup,
  helpInvite: helpInvite,
  CLOUD_ENV: CLOUD_ENV,
};
```

- [ ] **Step 8.2: Smoke-import sanity check**

There are no unit tests for cloudClient (it's a wx.cloud wrapper). Run the full suite to confirm no regression elsewhere:

```
cd calendar-puzzle-miniprogram && node --test
```
Expected: no test file imports cloudClient directly; all current tests pass.

- [ ] **Step 8.3: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/cloudClient.js
git commit -m "feat(minigame): cloudClient — shareGroup + helpInvite RPCs + helpToken cache"
```

---

## Task 9: Extend `shareState.js` — inviter context injection

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/shareState.js`
- Create: `calendar-puzzle-miniprogram/tests/shareState.test.js`

Spec §6.1. New `setInviterContext` / `clearInviterContext`; `buildShareData` adds `inviter=&t=` to query when context is set.

- [ ] **Step 9.1: Write tests (RED)**

`tests/shareState.test.js`:

```js
var test = require('node:test');
var assert = require('node:assert');
var S = require('../minigame/js/shareState');

test('buildShareData with no current returns generic title, empty query', function () {
  S.setCurrent(null);
  S.clearInviterContext();
  var d = S.buildShareData();
  assert.match(d.title, /日历方块/);
  assert.strictEqual(d.query, '');
});

test('buildShareData with current returns puzzle query', function () {
  S.clearInviterContext();
  S.setCurrent({ difficulty: 'hard', difficultyLabel: '困难', comboIndex: 3, dateStr: '2026-05-19' });
  var d = S.buildShareData();
  assert.ok(d.query.indexOf('d=hard') >= 0);
  assert.ok(d.query.indexOf('c=3') >= 0);
  assert.ok(d.query.indexOf('date=2026-05-19') >= 0);
});

test('setInviterContext adds inviter+t to share query and changes title', function () {
  S.setCurrent({ difficulty: 'hard', difficultyLabel: '困难', comboIndex: 3, dateStr: '2026-05-19' });
  S.setInviterContext({ inviter: 'openid_A', t: 'token_xyz' });
  var d = S.buildShareData();
  assert.match(d.title, /帮我助力/);
  assert.ok(d.query.indexOf('inviter=openid_A') >= 0);
  assert.ok(d.query.indexOf('t=token_xyz') >= 0);
});

test('clearInviterContext removes inviter/t from query', function () {
  S.setCurrent({ difficulty: 'hard', difficultyLabel: '困难', comboIndex: 3, dateStr: '2026-05-19' });
  S.setInviterContext({ inviter: 'openid_A', t: 'token_xyz' });
  S.clearInviterContext();
  var d = S.buildShareData();
  assert.strictEqual(d.query.indexOf('inviter='), -1);
  assert.strictEqual(d.query.indexOf('&t='), -1);
});
```

- [ ] **Step 9.2: Run, confirm failure**

```
cd calendar-puzzle-miniprogram && node --test tests/shareState.test.js
```
Expected: 3rd and 4th tests fail (setInviterContext/clearInviterContext don't exist).

- [ ] **Step 9.3: Update `minigame/js/shareState.js`**

```js
// Module-level mutable share state. wx.onShareAppMessage and the in-canvas
// invite button both read from this so the share content always reflects
// what the player is currently looking at. inviterCtx is a one-shot overlay
// used by the "邀请好友助力" flow — caller MUST clear it after the share
// callback fires.

var current = null;
var inviterCtx = null;

function setCurrent(s) { current = s; }
function getCurrent() { return current; }

function setInviterContext(ctx) { inviterCtx = ctx; }
function clearInviterContext() { inviterCtx = null; }
function getInviterContext() { return inviterCtx; }

function buildShareData() {
  var base;
  if (!current) {
    base = { title: '日历方块挑战 — 用方块拼出今天', query: '' };
  } else {
    var label = current.difficultyLabel || '';
    base = {
      title: '日历方块「' + label + '」挑战 — 来比比谁快！',
      query: 'd=' + current.difficulty + '&c=' + current.comboIndex + '&date=' + current.dateStr,
    };
  }
  if (inviterCtx) {
    base.title = '帮我助力一次，我送你一张提示券';
    var prefix = base.query ? base.query + '&' : '';
    base.query = prefix + 'inviter=' + inviterCtx.inviter + '&t=' + inviterCtx.t;
  }
  base.imageUrl = '';
  return base;
}

module.exports = {
  setCurrent: setCurrent,
  getCurrent: getCurrent,
  setInviterContext: setInviterContext,
  clearInviterContext: clearInviterContext,
  getInviterContext: getInviterContext,
  buildShareData: buildShareData,
};
```

- [ ] **Step 9.4: Run, confirm green**

```
cd calendar-puzzle-miniprogram && node --test tests/shareState.test.js
```
Expected: 4/4 pass.

- [ ] **Step 9.5: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/shareState.js calendar-puzzle-miniprogram/tests/shareState.test.js
git commit -m "feat(minigame): shareState — inviter context overlay for help-invite share query"
```

---

## Task 10: `gameScene.js` — hint tier menu shows voucher balance

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Spec §7.1. The existing tier menu shows 3 buttons (weak/medium/strong). Augment each row to display **social voucher balance** alongside the existing "本关 N/cap" text. This task is purely UX read-only — clicking still routes through the existing stamina path.

- [ ] **Step 10.1: Wire voucher module into the scene**

At the top of `gameScene.js`, near the other `require` lines (around line 1-10):

```js
var Voucher = require('./voucher');
```

Find the scene's setup block (look for `Hint.createHintState` near line 57). Just after that block create the voucher instance, using `wx.getStorageSync`/`wx.setStorageSync` wrapped to match our injected storage interface:

```js
var wxStorage = {
  getItem: function (k) { return wx.getStorageSync(k) || null; },
  setItem: function (k, v) { wx.setStorageSync(k, v); },
  removeItem: function (k) { wx.removeStorageSync(k); },
};
var voucher = Voucher.create({ storage: wxStorage });
```

- [ ] **Step 10.2: Render voucher balance in tier menu**

Find `L.hintTierBtns.push({...})` (around line 555). After computing each tier button rect, build the label string to include voucher info. Currently the rendering loop draws tier labels somewhere downstream — find the place where each tier's text is drawn (search for `hintTierBtns` in the draw section).

Replace the row's text composition with:

```js
var tierKey = ['weak', 'medium', 'strong'][ti];
var balance = voucher.displayBalance(tierKey);
var balanceLabel = '剩余 ' + balance;
var capUsed = Hint.countUsed(hintState, tierKey);
var cap = Hint.CAPS[tierKey];
var costLabel = '体力 ' + Hint.COSTS[tierKey];
// e.g.  弱   剩余 0 · 本关 0/3   体力 1
```

Render the row as three text spans within the row rect (left tier name, middle balance/usage, right cost).

- [ ] **Step 10.3: Manual smoke (no automated test for canvas)**

```
cd calendar-puzzle-miniprogram && yarn dev   # or open WeChat DevTools and reload
```

Open the WeChat DevTools, enter a puzzle, click 💡 → confirm each tier row now displays `剩余 N` (currently 0 for new users). Existing stamina-path interaction must still work.

- [ ] **Step 10.4: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame): hint tier menu shows social voucher balance + per-tier cost"
```

---

## Task 11: `gameScene.js` — 二级"获取路径" menu (群分享 path)

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Spec §7.2. When player clicks a tier row with insufficient stamina (and insufficient social vouchers), show a second-level menu listing how to obtain the voucher. This task implements the menu + the **群分享** branch only.

- [ ] **Step 11.1: Add submenu state and layout**

Near the existing `hintMode` / `hintTier` vars (around line 55):

```js
var sourceMenuOpen = false;  // second-level "怎么拿到"
```

In the layout block (where `L.hintPopup` is computed), add:

```js
if (sourceMenuOpen) {
  var smW = 280, smH = 200;
  L.sourceMenu = { x: (W - smW) / 2, y: (H - smH) / 2, w: smW, h: smH };
  L.sourceMenuBtns = [];
  var bx = L.sourceMenu.x + 20, by = L.sourceMenu.y + 50, bw = smW - 40, bh = 36;
  // Stamina cost row (always shown, disabled if insufficient)
  L.sourceMenuBtns.push({ kind: 'stamina', x: bx, y: by, w: bw, h: bh });
  by += bh + 8;
  if (hintTier === 'medium') {
    L.sourceMenuBtns.push({ kind: 'share', x: bx, y: by, w: bw, h: bh });
    by += bh + 8;
  } else if (hintTier === 'strong') {
    L.sourceMenuBtns.push({ kind: 'help', x: bx, y: by, w: bw, h: bh });
    by += bh + 8;
  }
  L.sourceMenuCloseBtn = { x: L.sourceMenu.x + (smW - 90) / 2, y: L.sourceMenu.y + smH - 46, w: 90, h: 34 };
}
```

- [ ] **Step 11.2: Trigger the submenu when tier insufficient**

Find the tier-row click handler (where the existing code routes to `applyMedium` via stamina). Replace the branch to:

```js
var tierKey = ['weak', 'medium', 'strong'][tierIndex];
var staminaOk = stamina.getStamina() >= Hint.COSTS[tierKey];
var socialOk = voucher.canUseSocial(tierKey);
if (staminaOk) {
  // existing stamina path — unchanged
} else if (socialOk) {
  // social voucher path — implemented in Task 11 (medium share) and Task 12 (strong help)
  // For now route to socialApply(tierKey, 'share' or 'helperGift' or 'help')
  socialApply(tierKey);  // see Step 11.4
} else {
  hintTier = tierKey;
  sourceMenuOpen = true;
  rebuildLayout();
}
```

- [ ] **Step 11.3: Render the submenu**

In the draw block, after the tier popup draw, if `sourceMenuOpen`:

```js
if (sourceMenuOpen && L.sourceMenu) {
  R.roundRect(ctx, L.sourceMenu.x, L.sourceMenu.y, L.sourceMenu.w, L.sourceMenu.h, 12, '#fff', '#ddd');
  R.text(ctx, '怎么拿到 ' + tierLabel(hintTier) + '？', L.sourceMenu.x + 20, L.sourceMenu.y + 20, 14, '#333');
  for (var bi = 0; bi < L.sourceMenuBtns.length; bi++) {
    var btn = L.sourceMenuBtns[bi];
    var enabled, label;
    if (btn.kind === 'stamina') {
      enabled = false;
      label = '花 ' + Hint.COSTS[hintTier] + ' 体力（不足）';
    } else if (btn.kind === 'share') {
      enabled = true;
      label = '群分享换 1 张中提示';
    } else if (btn.kind === 'help') {
      enabled = true;
      label = '邀请好友助力（每 2 位 +1）';
    }
    R.button(ctx, btn.x, btn.y, btn.w, btn.h, label, enabled ? BRAND : '#ccc', '#fff', 6);
  }
  R.button(ctx, L.sourceMenuCloseBtn.x, L.sourceMenuCloseBtn.y, L.sourceMenuCloseBtn.w, L.sourceMenuCloseBtn.h, '取消', '#888', '#fff', 6);
}
```

Add `tierLabel` helper at top of file:

```js
function tierLabel(t) { return { weak: '弱提示', medium: '中提示', strong: '强提示' }[t]; }
```

- [ ] **Step 11.4: Implement the share-button handler**

Add a `triggerShareGroup` function:

```js
function triggerShareGroup() {
  if (!cloudClient.getOpenid()) { showToast('需要网络'); return; }
  wx.shareAppMessage({
    withShareTicket: true,
    title: shareState.buildShareData().title,
    query: shareState.buildShareData().query,
    success: function (res) {
      if (!res.shareTickets || !res.shareTickets[0]) {
        showToast('请分享到群聊'); return;
      }
      wx.getShareInfo({
        shareTicket: res.shareTickets[0],
        success: function (info) {
          cloudClient.shareGroup(info.encryptedData, info.iv).then(function (r) {
            if (r.ok) {
              voucher.applyGranted('medium', 'share');
              showToast('+1 张中提示');
              voucher.reconcile(cloudClient, currentPuzzleId());
              sourceMenuOpen = false;
              rebuildLayout();
            } else if (r.err === 'duplicate') {
              showToast('今天这个群已经分享过');
            } else {
              showToast('换券失败：' + r.err);
            }
          }, function () {
            showToast('网络异常');
          });
        },
        fail: function () { showToast('分享信息获取失败'); },
      });
    },
    fail: function () { /* user cancelled */ },
  });
}
```

(`currentPuzzleId()` — reuse whatever the existing code constructs for `Hint.createHintState`.)

In the click handler for `L.sourceMenuBtns`, route `kind === 'share'` to `triggerShareGroup()`.

- [ ] **Step 11.5: Implement `socialApply` for medium when balance > 0**

```js
function socialApply(tierKey) {
  // Pick a hinted block — reuse existing tier menu logic that calls Hint.applyMedium etc.
  // After successful local apply, also record on the voucher cache:
  // Find the appropriate source from voucher state — but since voucher.applyUsed just
  // decrements pendingUse, we don't strictly need to differentiate sources here. Use
  // a generic 'share' tag for medium and 'help' for strong (helperGift weak is also
  // present but weak has no second-level menu).
  var sourceTag = tierKey === 'medium' ? 'share' : (tierKey === 'strong' ? 'help' : 'helperGift');
  // ... call Hint.applyXxx as the existing code does, passing sourceTag through
  voucher.applyUsed(tierKey, sourceTag, currentPuzzleId());
  // Asynchronously confirm with cloud
  cloudClient.useHint(tierKey, currentPuzzleId()).then(function (r) {
    if (!r.ok) {
      // business error — already applied locally; let next reconcile align
      voucher.reconcile(cloudClient, currentPuzzleId());
    }
  }, function () {
    // network — leave in pendingUse for later flush
  });
}
```

- [ ] **Step 11.6: Manual smoke**

WeChat DevTools, enter a puzzle, drain stamina, click medium tier → submenu shows "花 X 体力 / 群分享换 / 取消". Click 群分享换 → triggers wx.shareAppMessage. If shared to a real chat (use real device), shareGroup is called.

- [ ] **Step 11.7: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame): hint tier — 二级 menu 群分享换中提示 path (calls shareGroup cloud fn)"
```

---

## Task 12: `gameScene.js` — 二级 menu 邀请助力 path (strong tier)

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/gameScene.js`

Spec §6.1 inviter side. When strong tier and no voucher and stamina insufficient → submenu shows "邀请好友助力（每 2 位 +1）" → triggers `wx.shareAppMessage` with `inviter=&t=` in query.

- [ ] **Step 12.1: Implement `triggerHelpInvite`**

```js
function triggerHelpInvite() {
  var openid = cloudClient.getOpenid();
  var token = cloudClient.getHelpToken();
  if (!openid || !token) { showToast('需要网络'); return; }
  shareState.setInviterContext({ inviter: openid, t: token });
  var share = shareState.buildShareData();
  wx.shareAppMessage({
    title: share.title,
    query: share.query,
    success: function () { /* user shared — inviter token in query */ },
    fail: function () { /* cancelled */ },
    complete: function () { shareState.clearInviterContext(); },
  });
  sourceMenuOpen = false;
  rebuildLayout();
}
```

- [ ] **Step 12.2: Route the click**

In the `L.sourceMenuBtns` click handler, route `kind === 'help'` → `triggerHelpInvite()`.

- [ ] **Step 12.3: Wire `getInviterContext` to `wx.onShareAppMessage`**

The existing global `wx.onShareAppMessage` handler builds share content from `shareState.buildShareData()`. Confirm no extra wiring needed — `setInviterContext` flips a module-level flag that `buildShareData()` reads, and `clearInviterContext` is called from the `complete` callback.

- [ ] **Step 12.4: Manual smoke**

DevTools won't show the friend dialog, but query string can be inspected. Real-device smoke (two phones) deferred to Task 16.

- [ ] **Step 12.5: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/gameScene.js
git commit -m "feat(minigame): hint tier — 二级 menu 邀请助力 path (sets shareState inviterCtx)"
```

---

## Task 13: `selectScene.js` — helper landing modal + 启动 query 解析

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/selectScene.js`
- Modify: `calendar-puzzle-miniprogram/minigame/js/main.js`

Spec §6.2 + §6.3. On launch, parse `inviter` / `t` from query. If present, call `helpInvite`; on success render a modal in selectScene.

- [ ] **Step 13.1: Parse query at launch in `main.js`**

Near the existing entry, after `cloudClient.login()`:

```js
var launchOpts = (typeof wx !== 'undefined' && wx.getLaunchOptionsSync) ? wx.getLaunchOptionsSync() : null;
var launchQuery = (launchOpts && launchOpts.query) || {};
GameGlobal.launchQuery = launchQuery;  // make available to selectScene
```

- [ ] **Step 13.2: Add helper landing modal state to `selectScene.js`**

At scene setup:

```js
var helperModal = null;  // { inviterNickname } when shown

function tryConsumeInviterLink() {
  var q = GameGlobal.launchQuery || {};
  if (!q.inviter || !q.t) return;
  // One-shot — clear so re-enters don't double-fire
  GameGlobal.launchQuery = {};
  cloudClient.helpInvite(q.inviter, q.t).then(function (r) {
    if (r.ok) {
      voucher.applyGranted('weak', 'helperGift');
      voucher.reconcile(cloudClient, null);
      helperModal = { inviterNickname: r.inviterNickname };
      rebuildLayout();
    } else {
      var msg = ({
        'self-help': '不能给自己助力',
        'duplicate': '今天已经为他助力过啦',
        'bad-token': '链接无效',
      })[r.err] || '助力失败';
      showToast(msg);
    }
  }, function () { showToast('助力失败：网络异常'); });
}
```

Call `tryConsumeInviterLink()` once during scene init (after voucher / cloudClient are ready).

- [ ] **Step 13.3: Render the modal**

Layout block:

```js
if (helperModal) {
  var mW = 300, mH = 200;
  L.helperModal = { x: (W - mW) / 2, y: (H - mH) / 2, w: mW, h: mH };
  L.helperModalBtn = { x: L.helperModal.x + (mW - 160) / 2, y: L.helperModal.y + mH - 56, w: 160, h: 40 };
}
```

Draw block:

```js
if (helperModal && L.helperModal) {
  R.roundRect(ctx, L.helperModal.x, L.helperModal.y, L.helperModal.w, L.helperModal.h, 14, '#fff', '#ddd');
  R.text(ctx, '👏 已为 ' + helperModal.inviterNickname + ' 助力成功',
         L.helperModal.x + L.helperModal.w / 2, L.helperModal.y + 60, 16, '#222', 'center');
  R.text(ctx, '+1 张弱提示已到账', L.helperModal.x + L.helperModal.w / 2,
         L.helperModal.y + 96, 14, '#666', 'center');
  R.button(ctx, L.helperModalBtn.x, L.helperModalBtn.y, L.helperModalBtn.w, L.helperModalBtn.h,
           '去玩今天的题', BRAND, '#fff', 8);
}
```

Click handler: hit-test `L.helperModalBtn` → `helperModal = null; rebuildLayout();` (no navigation; just close, player is already in selectScene).

- [ ] **Step 13.4: Manual smoke**

In DevTools, set the **场景值 / 启动参数** to `?inviter=fakeopenid&t=faketoken` — confirm modal appears (will toast "链接无效" with fake token, which is expected). Real link smoke deferred to Task 16.

- [ ] **Step 13.5: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/selectScene.js calendar-puzzle-miniprogram/minigame/js/main.js
git commit -m "feat(minigame): helper landing modal — consumes inviter link, grants weak voucher"
```

---

## Task 14: `main.js` — login + flushPendingUse + reconcile at boot

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/js/main.js`

Spec §4.2.

- [ ] **Step 14.1: Wire startup sequence**

Near the top of `main.js`, after existing requires:

```js
var cloudClient = require('./cloudClient');
var Voucher = require('./voucher');
var wxStorage = {
  getItem: function (k) { return wx.getStorageSync(k) || null; },
  setItem: function (k, v) { wx.setStorageSync(k, v); },
  removeItem: function (k) { wx.removeStorageSync(k); },
};
var voucher = Voucher.create({ storage: wxStorage });
GameGlobal.voucher = voucher;  // shared with scenes
GameGlobal.cloudClient = cloudClient;
```

Add boot async block (fire-and-forget):

```js
(function bootCloud() {
  try {
    cloudClient.login().then(function (r) {
      if (!(r && r.ok)) return;
      voucher.setOpenid(r.openid);
      voucher.flushPendingUse(cloudClient).then(function () {
        return voucher.reconcile(cloudClient, null);
      });
    }, function () { /* offline — game still playable via stamina */ });
  } catch (e) { /* wx.cloud unavailable — same fallback */ }
})();
```

Update `gameScene.js` and `selectScene.js` to read voucher from `GameGlobal.voucher` instead of creating their own:

```js
var voucher = GameGlobal.voucher;
```

(Drop the per-scene `Voucher.create(...)` lines added in Task 10 & 13.)

- [ ] **Step 14.2: Run full unit suite to catch regressions**

```
cd calendar-puzzle-miniprogram && node --test
```
Expected: all green.

- [ ] **Step 14.3: Manual smoke in DevTools**

Reload mini-game. Console should show no errors, `login` called (check Network tab), voucher cache initialized.

- [ ] **Step 14.4: Commit**

```
git add calendar-puzzle-miniprogram/minigame/js/main.js calendar-puzzle-miniprogram/minigame/js/gameScene.js calendar-puzzle-miniprogram/minigame/js/selectScene.js
git commit -m "feat(minigame): boot — login + flushPendingUse + reconcile; voucher on GameGlobal"
```

---

## Task 15: `cloud/README.md` — deploy + ops checklist

**Files:**
- Modify: `calendar-puzzle-miniprogram/minigame/cloud/README.md`

- [ ] **Step 15.1: Update README**

Append a new section "Plan 2c+2d deploy steps":

```markdown
## Plan 2c+2d deploy steps

### 1. Environment variables (cloudbase console)

Both `login` and `helpInvite` need a shared HMAC secret. In the cloudbase console
(微信开发者工具 → 云开发 → 云函数 → 选中函数 → 配置 → 环境变量), set on **each** of
these two functions:

```
HELP_TOKEN_SECRET = <openssl rand -hex 32 output>
```

The two functions MUST share the same value — login issues a token, helpInvite
verifies it.

### 2. Database collections + indexes

In cloudbase console → 数据库 → 集合管理:

| Collection | Unique index |
|------------|--------------|
| `shareLog` | `(openid, openGId, dateStr)` |
| `helpLog`  | `(inviter, helper, dateStr)` |

Create both collections empty. Add a **唯一索引** for the listed fields (combined).
Without these, the cloud functions can still write but cannot dedup.

### 3. Deploy functions

From DevTools, right-click each of these directories → "上传并部署：云端安装依赖":

- `cloud/functions/login` (updated)
- `cloud/functions/listGrants` (updated)
- `cloud/functions/shareGroup` (new)
- `cloud/functions/helpInvite` (new)

### 4. Smoke test in DevTools console

```js
require('./js/cloudClient').login({ nickname: 'TestUser' }).then(console.log);
// Expect: {ok:true, openid:'...', isNewUser:..., helpToken:'<64-hex>'}
```
```

- [ ] **Step 15.2: Commit**

```
git add calendar-puzzle-miniprogram/minigame/cloud/README.md
git commit -m "docs(cloud): deploy + ops steps for plan 2c+2d (env vars, collections, indexes)"
```

---

## Task 16: End-to-end smoke (two real WeChat phones)

**Pre-req:** Tasks 1-15 deployed to dev env per Task 15.

This is the verification gate before merging the plan. No code changes; document outcome in the PR description.

- [ ] **Smoke 16.1: 群分享换中提示 — happy path**

User A enters puzzle, drains stamina, clicks 💡 → 中提示 → submenu "群分享换" → shares to a real WeChat group. After share, `listGrants` should show `balance.medium = 1`.

- [ ] **Smoke 16.2: 群分享 — 重复同群**

A reshares to the SAME group same day → toast "今天这个群已经分享过", `balance.medium` unchanged.

- [ ] **Smoke 16.3: 群分享 — 不同群**

A shares to a DIFFERENT group → `balance.medium = 2`.

- [ ] **Smoke 16.4: 助力链路 — A invites B**

A enters puzzle, drains stamina, clicks 💡 → 强提示 → submenu "邀请好友助力" → shares to B (individual chat is OK for help). B taps link → modal shows "已为 [A nickname] 助力成功 / +1 张弱提示"; in B's `listGrants`, `balance.weak = 1`. A still has 0 strong (N=1 not even).

- [ ] **Smoke 16.5: 助力 — A invites C**

A repeats with C. After C taps link, A's `balance.strong = 1` (N=2 even). C's `balance.weak = 1`.

- [ ] **Smoke 16.6: 助力 — B 重复点链接**

B reopens the same link → modal not shown, toast "今天已经为他助力过啦".

- [ ] **Smoke 16.7: 助力 — A 给自己**

A copies the link from share preview, opens in own WeChat → toast "不能给自己助力".

- [ ] **Smoke 16.8: 离线行为**

Disable network. Use 1 medium voucher locally (assume balance was 1). hint applied, no toast about network. Re-enable network → `flushPendingUse` consumes the queued useHint → cloud `used` count rises.

If all 8 smoke cases pass, plan is verified.

---

## Self-Review Notes

Coverage check against spec sections:

| Spec § | Task |
|---|---|
| §0 scope carve-out | (documented in plan goal) |
| §1 decisions | (encoded in implementation) |
| §2 architecture | Tasks 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 |
| §3.1 hintGrants | (unchanged, plan 2a) |
| §3.2 shareLog | Task 2 (creation) + Task 15 (index) |
| §3.3 helpLog | Task 3 + Task 15 |
| §3.4 voucherCache | Task 6 |
| §3.5 users.nickname | Task 4 |
| §4 voucher state | Task 6 + Task 7 + Task 14 |
| §5 群分享 flow | Task 2 + Task 11 |
| §6 助力 flow | Task 3 + Task 12 + Task 13 |
| §6.5 recentHelps | Task 5 |
| §7 二级 menu | Task 11 + Task 12 |
| §8 异常 | Task 6 (queue retry) + Task 11/12 (toasts) |
| §9 防作弊 | Task 3 (HMAC + self-help check) |
| §10 测试 | Task 1, 2, 3, 4, 5, 6, 7, 9 (unit) + Task 16 (e2e) |
| §11 ops | Task 15 |

No placeholders. Code in every step. Test fixtures match cloud-mock style. Each task ends with a commit and small enough to review in isolation.

Open items (deferred per spec §0, §12):
- subscribeMessage push (separate plan once template ID exists)
- ads.js + 看广告换 hint (plan 2b)
- submitScore + 好友榜 (separate plan)
