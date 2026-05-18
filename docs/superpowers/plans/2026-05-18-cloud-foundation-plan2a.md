# Cloud Foundation (Plan 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the WeChat 云开发 (CloudBase) backend foundation for the social features series. Establishes user identity, the `hintGrants` voucher table, and four cloud RPCs (`login`, `grantHint`, `useHint`, `listGrants`) plus a 端-side `cloudClient.js` wrapper. **Does NOT change any existing gameplay** — pure infrastructure for Plans 2b/c/d to consume.

**Architecture:** Each cloud function uses dependency-injected `wx-server-sdk` (real SDK in production, in-memory mock for tests) so we can TDD without installing wx-server-sdk locally. Tests use `node --test` (consistent with Plan 1). State of truth for hint vouchers moves to cloud DB (each grant = one row); 端 side caches for UI only. Plan 2a wires the cloud functions and the端 wrapper, but does NOT integrate with `gameScene.js` yet — Plan 2b will be the first consumer (ads).

**Tech Stack:** WeChat 云开发 (cloudbase env `cloudbase-2g5wjm7448ddc7bf`), Node.js cloud functions with `wx-server-sdk ^2.6.3`, vanilla JS for端 side, `node --test` for unit tests with custom in-memory cloud mock.

---

## Spec reference

`docs/superpowers/specs/2026-05-18-social-features-design.md`, sections 3.1-3.3 (architecture + data model), 4.1 (cap numbers used by useHint), 7 (anti-cheat — relevant for grantHint sources).

**Spec carve-out:** Plan 2a is the foundation only. Sections 5 (group share + help loop), 6 (leaderboard), 8.3 (subscribeMessage), and 5.4 (ads) are deferred to Plans 2b/2c/2d/3.

## File structure for this plan

```
calendar-puzzle-miniprogram/
├── cloud/                              ← NEW (entire tree)
│   └── functions/
│       ├── login/
│       │   ├── index.js                ← upsert user, return openid
│       │   └── package.json
│       ├── grantHint/
│       │   ├── index.js                ← insert hintGrants row
│       │   └── package.json
│       ├── useHint/
│       │   ├── index.js                ← mark row used + cap check
│       │   └── package.json
│       └── listGrants/
│           ├── index.js                ← per-tier balance + used count
│           └── package.json
├── tests/
│   ├── cloud-mock.js                   ← NEW: in-memory wx-server-sdk shim
│   ├── login.test.js                   ← NEW
│   ├── grantHint.test.js               ← NEW
│   ├── useHint.test.js                 ← NEW
│   └── listGrants.test.js              ← NEW
└── minigame/js/
    └── cloudClient.js                  ← NEW: 端 wrapper
```

## Data model: hintGrants collection

Each row = one voucher's lifecycle. Server is the source of truth.

```js
{
  _id: 'auto',                    // CloudBase auto-generates
  openid: 'oXXXXXXXX',            // CONTEXT.OPENID at grant time
  type: 'weak' | 'medium' | 'strong',
  source: 'free' | 'stamina' | 'share' | 'help' | 'ad' | 'helperGift',
  grantedAt: db.serverDate(),
  usedAt: null | db.serverDate(),
  usedInPuzzle: null | 'YYYY-MM-DD:hard:c3',
}
```

**Balance** = rows where `usedAt == null` for this user, grouped by type.
**Per-puzzle use count** = rows where `usedAt != null && usedInPuzzle == X` for this user, grouped by type.

## CAPS (server-side enforcement)

Cloud functions enforce the per-puzzle cap. Matches Plan 1's current values:

```js
const CAPS = { weak: 3, medium: 3, strong: 1 };
```

If 端 sends a `useHint` request and the cap is reached, server returns `{ ok: false, reason: 'cap-reached' }`. (端 will also have a local cap check — defense in depth.)

## Dependency injection pattern for cloud functions

Each function is structured so it can be tested without installing `wx-server-sdk`:

```js
// cloud/functions/<name>/index.js
exports.main = async function(event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  }
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;
  // ... function-specific logic
};
```

In production: WeChat runtime calls `exports.main(event, context)` with two args → `_cloudOverride` is `undefined` → real SDK loaded.
In tests: `await require('../cloud/functions/login/index').main(event, context, mockCloud)` — SDK never loaded.

---

## Task 1: Cloud env config + cloud root + .gitignore

**Files:**
- Create: `calendar-puzzle-miniprogram/cloud/.gitignore`
- Modify: `calendar-puzzle-miniprogram/minigame/project.config.json`

- [ ] **Step 1: Confirm current project.config.json doesn't already declare cloudfunctionRoot**

Run from worktree root:
```bash
grep -n "cloudfunctionRoot\|cloudbaseRoot" calendar-puzzle-miniprogram/minigame/project.config.json
```
Expected: zero matches (clean slate).

- [ ] **Step 2: Add cloud function root to project.config.json**

Read the file first. Find the top-level object and add (or merge with existing `setting` neighbors):
```json
"cloudfunctionRoot": "../cloud/functions/"
```

The path is relative to `project.config.json`'s location (`minigame/`), pointing to `calendar-puzzle-miniprogram/cloud/functions/`. The Edit tool should insert this as a new top-level key alongside `setting`, `compileType`, etc.

- [ ] **Step 3: Create cloud/.gitignore**

```
node_modules/
*.zip
```

This prevents accidentally committing per-function node_modules (created during `npm install` inside each cloud function dir for deployment) or the deployment zip files WeChat tool creates.

- [ ] **Step 4: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/project.config.json calendar-puzzle-miniprogram/cloud/.gitignore
git commit -m "chore(minigame): register cloud function root + gitignore cloud node_modules"
```

(No Co-Authored-By trailer in any commit in this plan.)

---

## Task 2: cloud-mock.js (in-memory wx-server-sdk shim)

**Files:**
- Create: `calendar-puzzle-miniprogram/tests/cloud-mock.js`
- Create: `calendar-puzzle-miniprogram/tests/cloud-mock.test.js` (sanity test for the mock itself)

- [ ] **Step 1: Write sanity test for the mock**

Create `tests/cloud-mock.test.js`:
```js
var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');

test('cloud-mock add + where.get', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { name: 'a', val: 1 } });
  await db.collection('foo').add({ data: { name: 'b', val: 2 } });
  var res = await db.collection('foo').where({ name: 'a' }).get();
  assert.strictEqual(res.data.length, 1);
  assert.strictEqual(res.data[0].val, 1);
});

test('cloud-mock where.count', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 2 } });
  var res = await db.collection('foo').where({ x: 1 }).count();
  assert.strictEqual(res.total, 2);
});

test('cloud-mock where.update', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { id: 1, status: 'new' } });
  await db.collection('foo').where({ id: 1 }).update({ data: { status: 'done' } });
  var res = await db.collection('foo').where({ id: 1 }).get();
  assert.strictEqual(res.data[0].status, 'done');
});

test('cloud-mock where.limit + get returns truncated list', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 1 } });
  var res = await db.collection('foo').where({ x: 1 }).limit(2).get();
  assert.strictEqual(res.data.length, 2);
});

test('cloud-mock getWXContext + setMockContext', function () {
  mock.reset();
  assert.strictEqual(mock.getWXContext().OPENID, 'test-openid');
  mock.setMockContext({ OPENID: 'user2' });
  assert.strictEqual(mock.getWXContext().OPENID, 'user2');
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: FAIL `Cannot find module './cloud-mock'`

- [ ] **Step 3: Create cloud-mock.js**

```js
// In-memory wx-server-sdk shim for unit tests.
// Provides: init, database (with collection.add/where.get/count/update + limit), getWXContext.
// Match the subset of the SDK used by our cloud functions.

var _collections = {};
var _ctx = { OPENID: 'test-openid', APPID: 'test-appid' };

function _matches(doc, query) {
  for (var k in query) {
    var qv = query[k];
    if (qv && typeof qv === 'object' && '$ne' in qv) {
      if (doc[k] === qv.$ne) return false;
    } else if (doc[k] !== qv) {
      return false;
    }
  }
  return true;
}

function _genId() {
  return 'mock_' + Math.random().toString(36).substr(2, 9);
}

function _query(store, query) {
  return {
    get: function () {
      return Promise.resolve({ data: store.filter(function (d) { return _matches(d, query); }) });
    },
    count: function () {
      return Promise.resolve({ total: store.filter(function (d) { return _matches(d, query); }).length });
    },
    update: function (opts) {
      var n = 0;
      store.forEach(function (d) {
        if (_matches(d, query)) {
          for (var k in opts.data) d[k] = opts.data[k];
          n++;
        }
      });
      return Promise.resolve({ stats: { updated: n } });
    },
    limit: function (max) {
      return {
        get: function () {
          var matched = store.filter(function (d) { return _matches(d, query); });
          return Promise.resolve({ data: matched.slice(0, max) });
        },
        update: function (opts) {
          var n = 0;
          for (var i = 0; i < store.length && n < max; i++) {
            if (_matches(store[i], query)) {
              for (var k in opts.data) store[i][k] = opts.data[k];
              n++;
            }
          }
          return Promise.resolve({ stats: { updated: n } });
        },
      };
    },
  };
}

function _collection(name) {
  if (!_collections[name]) _collections[name] = [];
  var store = _collections[name];
  return {
    add: function (opts) {
      var doc = { _id: _genId() };
      for (var k in opts.data) doc[k] = opts.data[k];
      store.push(doc);
      return Promise.resolve({ _id: doc._id });
    },
    where: function (query) { return _query(store, query); },
    doc: function (id) {
      return {
        get: function () {
          var d = store.find(function (x) { return x._id === id; });
          return d ? Promise.resolve({ data: d }) : Promise.reject({ errCode: -1, errMsg: 'not found' });
        },
      };
    },
  };
}

module.exports = {
  init: function () {},
  database: function () {
    return {
      collection: _collection,
      serverDate: function () { return new Date(); },
    };
  },
  getWXContext: function () { return _ctx; },
  setMockContext: function (ctx) {
    for (var k in ctx) _ctx[k] = ctx[k];
  },
  reset: function () {
    _collections = {};
    _ctx = { OPENID: 'test-openid', APPID: 'test-appid' };
  },
  DYNAMIC_CURRENT_ENV: 'mock-env',
};
```

- [ ] **Step 4: Run test, verify PASS**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: all tests pass (5 new from this task, plus the 15 existing Plan 1 tests).

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/tests/cloud-mock.js calendar-puzzle-miniprogram/tests/cloud-mock.test.js
git commit -m "test(cloud): add in-memory wx-server-sdk mock for cloud function tests"
```

---

## Task 3: login cloud function — upsert user, return openid

**Files:**
- Create: `calendar-puzzle-miniprogram/cloud/functions/login/index.js`
- Create: `calendar-puzzle-miniprogram/cloud/functions/login/package.json`
- Create: `calendar-puzzle-miniprogram/tests/login.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/login.test.js`:
```js
var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var login = require('../cloud/functions/login/index');

test('login creates a user row on first call for new openid', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user_alpha' });
  var res = await login.main({}, {}, mock);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.openid, 'user_alpha');
  assert.strictEqual(res.isNewUser, true);

  // Verify users collection has the new row
  var users = await mock.database().collection('users').where({ openid: 'user_alpha' }).get();
  assert.strictEqual(users.data.length, 1);
  assert.ok(users.data[0].createdAt);
});

test('login is idempotent: second call for same openid does not duplicate user', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user_beta' });
  await login.main({}, {}, mock);
  var res = await login.main({}, {}, mock);
  assert.strictEqual(res.isNewUser, false);
  var users = await mock.database().collection('users').where({ openid: 'user_beta' }).get();
  assert.strictEqual(users.data.length, 1);
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: FAIL `Cannot find module '../cloud/functions/login/index'`

- [ ] **Step 3: Create the cloud function**

`cloud/functions/login/index.js`:
```js
// Resolves user's openid + upserts a row in the `users` collection.
// Idempotent: second call for same openid returns isNewUser: false.

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  }
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var existing = await db.collection('users').where({ openid: openid }).get();
  if (existing.data && existing.data.length > 0) {
    return { ok: true, openid: openid, isNewUser: false };
  }

  await db.collection('users').add({
    data: { openid: openid, createdAt: db.serverDate() },
  });
  return { ok: true, openid: openid, isNewUser: true };
};
```

`cloud/functions/login/package.json`:
```json
{
  "name": "login",
  "version": "1.0.0",
  "description": "openid resolution + user upsert",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/cloud/functions/login/ calendar-puzzle-miniprogram/tests/login.test.js
git commit -m "feat(cloud): login function — upsert user, return openid"
```

---

## Task 4: grantHint cloud function — insert voucher row

**Files:**
- Create: `calendar-puzzle-miniprogram/cloud/functions/grantHint/index.js`
- Create: `calendar-puzzle-miniprogram/cloud/functions/grantHint/package.json`
- Create: `calendar-puzzle-miniprogram/tests/grantHint.test.js`

- [ ] **Step 1: Write failing tests**

`tests/grantHint.test.js`:
```js
var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var grantHint = require('../cloud/functions/grantHint/index');

test('grantHint inserts a row with correct fields', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  var res = await grantHint.main({ type: 'weak', source: 'ad' }, {}, mock);
  assert.strictEqual(res.ok, true);
  assert.ok(res.grantId);

  var rows = await mock.database().collection('hintGrants').where({ openid: 'user1' }).get();
  assert.strictEqual(rows.data.length, 1);
  var row = rows.data[0];
  assert.strictEqual(row.type, 'weak');
  assert.strictEqual(row.source, 'ad');
  assert.strictEqual(row.usedAt, null);
  assert.strictEqual(row.usedInPuzzle, null);
  assert.ok(row.grantedAt);
});

test('grantHint rejects invalid type', async function () {
  mock.reset();
  var res = await grantHint.main({ type: 'huge', source: 'ad' }, {}, mock);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'invalid-type');
});

test('grantHint rejects invalid source', async function () {
  mock.reset();
  var res = await grantHint.main({ type: 'weak', source: 'haxor' }, {}, mock);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'invalid-source');
});

test('grantHint requires both type and source', async function () {
  mock.reset();
  var res = await grantHint.main({ type: 'weak' }, {}, mock);
  assert.strictEqual(res.ok, false);
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: FAIL on the new tests.

- [ ] **Step 3: Create the cloud function**

`cloud/functions/grantHint/index.js`:
```js
// Inserts a hintGrants row. The voucher is unused (usedAt=null) until useHint consumes it.
// Source-specific gating (e.g. "only grant 'share' after server-verified group share")
// happens UPSTREAM in the calling cloud function (shareGroup, helpInvite, etc.).
// This function trusts its caller — only validates type/source enum.

var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };
var VALID_SOURCES = { free: 1, stamina: 1, share: 1, help: 1, ad: 1, helperGift: 1 };

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  }
  var type = event && event.type;
  var source = event && event.source;
  if (!type || !VALID_TYPES[type]) return { ok: false, reason: 'invalid-type' };
  if (!source || !VALID_SOURCES[source]) return { ok: false, reason: 'invalid-source' };

  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;
  var insert = await db.collection('hintGrants').add({
    data: {
      openid: openid,
      type: type,
      source: source,
      grantedAt: db.serverDate(),
      usedAt: null,
      usedInPuzzle: null,
    },
  });
  return { ok: true, grantId: insert._id };
};
```

`cloud/functions/grantHint/package.json`:
```json
{
  "name": "grantHint",
  "version": "1.0.0",
  "description": "Insert a hint voucher row",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
cd calendar-puzzle-miniprogram && npm test
```

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/cloud/functions/grantHint/ calendar-puzzle-miniprogram/tests/grantHint.test.js
git commit -m "feat(cloud): grantHint function — insert voucher with type+source enum check"
```

---

## Task 5: useHint cloud function — claim voucher + per-puzzle cap

**Files:**
- Create: `calendar-puzzle-miniprogram/cloud/functions/useHint/index.js`
- Create: `calendar-puzzle-miniprogram/cloud/functions/useHint/package.json`
- Create: `calendar-puzzle-miniprogram/tests/useHint.test.js`

- [ ] **Step 1: Write failing tests**

`tests/useHint.test.js`:
```js
var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var grantHint = require('../cloud/functions/grantHint/index');
var useHint = require('../cloud/functions/useHint/index');

async function seedGrants(n, type, source) {
  for (var i = 0; i < n; i++) {
    await grantHint.main({ type: type, source: source }, {}, mock);
  }
}

test('useHint claims one unused voucher and marks it used', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');

  var res = await useHint.main({ type: 'weak', puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(res.ok, true);
  assert.ok(res.grantId);

  // 1 used, 1 unused
  var unused = await mock.database().collection('hintGrants').where({ openid: 'user1', type: 'weak', usedAt: null }).count();
  assert.strictEqual(unused.total, 1);
  var used = await mock.database().collection('hintGrants').where({ openid: 'user1', type: 'weak', usedInPuzzle: 'p1' }).count();
  assert.strictEqual(used.total, 1);
});

test('useHint returns no-grant when balance is 0', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  var res = await useHint.main({ type: 'weak', puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'no-grant');
});

test('useHint enforces per-puzzle cap weak=3', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(10, 'weak', 'ad');

  // 3 successful uses on puzzle p1
  for (var i = 0; i < 3; i++) {
    var r = await useHint.main({ type: 'weak', puzzleId: 'p1' }, {}, mock);
    assert.strictEqual(r.ok, true);
  }
  // 4th use on same puzzle hits cap
  var r4 = await useHint.main({ type: 'weak', puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(r4.ok, false);
  assert.strictEqual(r4.reason, 'cap-reached');

  // But on a different puzzle, can use again
  var r5 = await useHint.main({ type: 'weak', puzzleId: 'p2' }, {}, mock);
  assert.strictEqual(r5.ok, true);
});

test('useHint cap is per-type', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'strong', 'ad');
  var r1 = await useHint.main({ type: 'strong', puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(r1.ok, true);
  // strong cap=1
  var r2 = await useHint.main({ type: 'strong', puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.reason, 'cap-reached');
});

test('useHint requires both type and puzzleId', async function () {
  mock.reset();
  var r1 = await useHint.main({ type: 'weak' }, {}, mock);
  assert.strictEqual(r1.ok, false);
  var r2 = await useHint.main({ puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(r2.ok, false);
});

test('useHint rejects invalid type', async function () {
  mock.reset();
  var r = await useHint.main({ type: 'huge', puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid-type');
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: useHint tests fail; existing pass.

- [ ] **Step 3: Create the cloud function**

`cloud/functions/useHint/index.js`:
```js
// Atomically claims an unused hint voucher of given type for the current puzzle.
// Enforces per-puzzle cap before claiming. Returns the consumed grant's _id.

var CAPS = { weak: 3, medium: 3, strong: 1 };
var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  }
  var type = event && event.type;
  var puzzleId = event && event.puzzleId;
  if (!type || !VALID_TYPES[type]) return { ok: false, reason: 'invalid-type' };
  if (!puzzleId) return { ok: false, reason: 'invalid-puzzleId' };

  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  // Per-puzzle cap check
  var usedCount = await db.collection('hintGrants').where({
    openid: openid, type: type, usedInPuzzle: puzzleId,
  }).count();
  if (usedCount.total >= CAPS[type]) {
    return { ok: false, reason: 'cap-reached' };
  }

  // Find any unused voucher of this type
  var unused = await db.collection('hintGrants').where({
    openid: openid, type: type, usedAt: null,
  }).limit(1).get();
  if (!unused.data || unused.data.length === 0) {
    return { ok: false, reason: 'no-grant' };
  }

  var grantId = unused.data[0]._id;
  // Mark used. (Race: another concurrent useHint could pick the same row.
  // For mini-game scale, ignored; production would use a transaction.)
  await db.collection('hintGrants').where({ _id: grantId }).update({
    data: { usedAt: db.serverDate(), usedInPuzzle: puzzleId },
  });
  return { ok: true, grantId: grantId };
};
```

`cloud/functions/useHint/package.json`:
```json
{
  "name": "useHint",
  "version": "1.0.0",
  "description": "Claim a voucher + enforce per-puzzle cap",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
cd calendar-puzzle-miniprogram && npm test
```

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/cloud/functions/useHint/ calendar-puzzle-miniprogram/tests/useHint.test.js
git commit -m "feat(cloud): useHint function — claim voucher + per-puzzle cap enforcement"
```

---

## Task 6: listGrants cloud function — balance + per-puzzle used

**Files:**
- Create: `calendar-puzzle-miniprogram/cloud/functions/listGrants/index.js`
- Create: `calendar-puzzle-miniprogram/cloud/functions/listGrants/package.json`
- Create: `calendar-puzzle-miniprogram/tests/listGrants.test.js`

- [ ] **Step 1: Write failing tests**

`tests/listGrants.test.js`:
```js
var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var grantHint = require('../cloud/functions/grantHint/index');
var useHint = require('../cloud/functions/useHint/index');
var listGrants = require('../cloud/functions/listGrants/index');

async function seedGrants(n, type, source) {
  for (var i = 0; i < n; i++) {
    await grantHint.main({ type: type, source: source }, {}, mock);
  }
}

test('listGrants returns zero balance + zero used for fresh user', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  var r = await listGrants.main({ puzzleId: 'p1' }, {}, mock);
  assert.deepStrictEqual(r.balance, { weak: 0, medium: 0, strong: 0 });
  assert.deepStrictEqual(r.used, { weak: 0, medium: 0, strong: 0 });
});

test('listGrants reports balance correctly across types', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');
  await seedGrants(1, 'medium', 'share');
  await seedGrants(3, 'strong', 'help');
  var r = await listGrants.main({ puzzleId: 'p1' }, {}, mock);
  assert.deepStrictEqual(r.balance, { weak: 2, medium: 1, strong: 3 });
  assert.deepStrictEqual(r.used, { weak: 0, medium: 0, strong: 0 });
});

test('listGrants reports per-puzzle used count, filtered by puzzleId', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(5, 'weak', 'ad');
  await useHint.main({ type: 'weak', puzzleId: 'p1' }, {}, mock);
  await useHint.main({ type: 'weak', puzzleId: 'p1' }, {}, mock);
  await useHint.main({ type: 'weak', puzzleId: 'p2' }, {}, mock);

  var r1 = await listGrants.main({ puzzleId: 'p1' }, {}, mock);
  assert.strictEqual(r1.balance.weak, 2);   // 5 granted - 3 used = 2
  assert.strictEqual(r1.used.weak, 2);      // only p1

  var r2 = await listGrants.main({ puzzleId: 'p2' }, {}, mock);
  assert.strictEqual(r2.balance.weak, 2);   // same balance
  assert.strictEqual(r2.used.weak, 1);      // only p2
});

test('listGrants works with no puzzleId (used all zero)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');
  var r = await listGrants.main({}, {}, mock);
  assert.strictEqual(r.balance.weak, 2);
  assert.deepStrictEqual(r.used, { weak: 0, medium: 0, strong: 0 });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd calendar-puzzle-miniprogram && npm test
```

- [ ] **Step 3: Create the cloud function**

`cloud/functions/listGrants/index.js`:
```js
// Returns per-tier balance (unused voucher count) and per-puzzle used count.
// puzzleId is optional; if omitted, used counts are all 0.

var TYPES = ['weak', 'medium', 'strong'];

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  }
  var puzzleId = event && event.puzzleId;
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var balance = { weak: 0, medium: 0, strong: 0 };
  var used = { weak: 0, medium: 0, strong: 0 };

  for (var i = 0; i < TYPES.length; i++) {
    var t = TYPES[i];
    var b = await db.collection('hintGrants').where({
      openid: openid, type: t, usedAt: null,
    }).count();
    balance[t] = b.total;

    if (puzzleId) {
      var u = await db.collection('hintGrants').where({
        openid: openid, type: t, usedInPuzzle: puzzleId,
      }).count();
      used[t] = u.total;
    }
  }

  return { ok: true, balance: balance, used: used };
};
```

`cloud/functions/listGrants/package.json`:
```json
{
  "name": "listGrants",
  "version": "1.0.0",
  "description": "Read voucher balance + per-puzzle used count",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
cd calendar-puzzle-miniprogram && npm test
```

- [ ] **Step 5: Commit**

```bash
git add calendar-puzzle-miniprogram/cloud/functions/listGrants/ calendar-puzzle-miniprogram/tests/listGrants.test.js
git commit -m "feat(cloud): listGrants function — per-tier balance + per-puzzle used count"
```

---

## Task 7: cloudClient.js (端-side wrapper)

**Files:**
- Create: `calendar-puzzle-miniprogram/minigame/js/cloudClient.js`

(No unit tests for this file — it's a thin wrapper over `wx.cloud.callFunction` which only runs in WeChat env. Smoke tested manually in Task 8.)

- [ ] **Step 1: Create the wrapper**

`minigame/js/cloudClient.js`:
```js
// Thin wrapper over wx.cloud.callFunction. Caches openid after first login.
// All RPCs return promises with normalized error handling.

var CLOUD_ENV = 'cloudbase-2g5wjm7448ddc7bf';
var _initialized = false;
var _openid = null;

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

function login() {
  return _call('login', {}).then(function (r) {
    if (r && r.ok) _openid = r.openid;
    return r;
  });
}

function getOpenid() { return _openid; }

function grantHint(type, source) {
  return _call('grantHint', { type: type, source: source });
}

function useHint(type, puzzleId) {
  return _call('useHint', { type: type, puzzleId: puzzleId });
}

function listGrants(puzzleId) {
  return _call('listGrants', { puzzleId: puzzleId });
}

module.exports = {
  init: init,
  login: login,
  getOpenid: getOpenid,
  grantHint: grantHint,
  useHint: useHint,
  listGrants: listGrants,
  CLOUD_ENV: CLOUD_ENV,
};
```

- [ ] **Step 2: Verify syntax**

```bash
cd calendar-puzzle-miniprogram/minigame && node --check js/cloudClient.js
```
Expected: clean (no output).

- [ ] **Step 3: Verify all unit tests still pass (nothing should change)**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: all tests pass (no new ones added in this task).

- [ ] **Step 4: Commit**

```bash
git add calendar-puzzle-miniprogram/minigame/js/cloudClient.js
git commit -m "feat(minigame): cloudClient.js wrapper for login/grantHint/useHint/listGrants"
```

---

## Task 8: Deploy doc + manual smoke check

**Files:**
- Create: `calendar-puzzle-miniprogram/cloud/README.md`

- [ ] **Step 1: Create deploy doc**

`cloud/README.md`:
```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add calendar-puzzle-miniprogram/cloud/README.md
git commit -m "docs(cloud): deploy + smoke-test instructions for Plan 2a"
```

- [ ] **Step 3: Final test sanity**

```bash
cd calendar-puzzle-miniprogram && npm test
```
Expected: all tests pass (~28 tests total: 15 from Plan 1 + 5 cloud-mock + 2 login + 4 grantHint + 6 useHint + 4 listGrants).

---

## Self-review notes

**Spec coverage** (against `2026-05-18-social-features-design.md`):
- §3.1 cloud architecture (login + grantHint + cloudClient): ✓ Tasks 3, 4, 7
- §3.3 hintGrants data model: ✓ Tasks 4, 5 (shape + per-puzzle cap enforcement)
- §4.1 economy (caps): ✓ Task 5 (server-side enforcement via CAPS constant)
- §5 share/help flows: **deferred to Plans 2c, 2d**
- §5.4 ads: **deferred to Plan 2b**
- §6 leaderboard, §8.3 push: **deferred to Plan 3 / Plan 2d**

**Placeholder scan**: no TBD/TODO/etc. The README.md created in Task 8 includes deferred-to-later notes that are explicit references to future plans, not placeholders for this plan.

**Type consistency**:
- `grantHint` returns `{ ok, grantId }` or `{ ok, reason }` — consistent across tests
- `useHint` returns `{ ok, grantId }` or `{ ok, reason }` — same
- `listGrants` returns `{ ok, balance, used }` — consistent
- `login` returns `{ ok, openid, isNewUser }` — consistent
- CAPS values `weak: 3, medium: 3, strong: 1` match Plan 1's current state (post-tuning commit `0b033b2`)
- Cloud function signatures all `(event, context, _cloudOverride)` — DI pattern consistent

**Risk callout**: 
- The `useHint` find-then-update pattern has a theoretical race (two concurrent calls picking the same row). For mini-game traffic this is negligible; production-grade fix would use cloudbase transactions which are out of scope here.
- `_cloudOverride` parameter on cloud function signatures is a test-only seam. WeChat runtime only passes `(event, context)` so it's always `undefined` in production. No security/perf concern.
- Cloud functions per-function `package.json` declares `wx-server-sdk ~2.6.3`. Newer versions may exist; pin to 2.6.3 to match Plan 1 era. Deployment-time `npm install` happens server-side.
