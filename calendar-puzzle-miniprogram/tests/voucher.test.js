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

test('voucher: applyUsed eagerly decrements balance + appends pendingUse', function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyGranted('medium', 'share');
  assert.strictEqual(v.displayBalance('medium'), 2);
  v.applyUsed('medium', 'share', 'p1');
  // displayBalance now reads state.balance directly (eager-decrement model)
  assert.strictEqual(v.displayBalance('medium'), 1);
  assert.strictEqual(v.getBalance().medium, 1);
  assert.strictEqual(v.getPendingUse().length, 1);
});

test('voucher: displayBalance can go negative; not clamped', function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');
  v.applyUsed('medium', 'share', 'p1');
  v.applyUsed('medium', 'share', 'p1');  // over-use
  assert.strictEqual(v.displayBalance('medium'), -1);
  assert.strictEqual(v.getBalance().medium, -1);
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
  v1.applyGranted('strong', 'help');               // balance.strong = 1
  v1.applyUsed('strong', 'help', 'p1');            // eager-decrement → balance.strong = 0, pending = 1
  var v2 = V.create({ storage: s });
  assert.deepStrictEqual(v2.getBalance(), { weak: 0, medium: 0, strong: 0 });
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

test('voucher: flushPendingUse — business error rolls back the eager decrement', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');               // balance.medium = 1
  v.applyUsed('medium', 'share', 'p1');            // eager: balance.medium = 0, pending = 1
  assert.strictEqual(v.getBalance().medium, 0);
  var fakeClient = {
    useHint: function () { return Promise.resolve({ ok: false, reason: 'cap-reached' }); },
  };
  await v.flushPendingUse(fakeClient);
  assert.strictEqual(v.getPendingUse().length, 0);
  // 云端拒绝 → 回滚到 applyUsed 之前的余额
  assert.strictEqual(v.getBalance().medium, 1);
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

test('voucher: malformed JSON in storage falls back to empty state', function () {
  var s = fakeStorage();
  s.setItem(V.STORAGE_KEY, '{not json');
  var v = V.create({ storage: s });
  assert.deepStrictEqual(v.getBalance(), { weak: 0, medium: 0, strong: 0 });
  assert.strictEqual(v.getPendingUse().length, 0);
});

test('voucher: partial balance schema in storage backfills missing keys', function () {
  var s = fakeStorage();
  s.setItem(V.STORAGE_KEY, JSON.stringify({ balance: { weak: 2 } }));
  var v = V.create({ storage: s });
  assert.deepStrictEqual(v.getBalance(), { weak: 2, medium: 0, strong: 0 });
  assert.strictEqual(v.displayBalance('medium'), 0);
});

test('voucher: helpMediumBalance default 0, set/get round-trips', function () {
  var v = V.create({ storage: fakeStorage() });
  assert.strictEqual(v.getHelpMediumBalance(), 0);
  v.setHelpMediumBalance(3);
  assert.strictEqual(v.getHelpMediumBalance(), 3);
});

test('voucher: reconcile pulls helpMediumBalance + recentHelps from listGrants', async function () {
  var v = V.create({ storage: fakeStorage() });
  var now = Date.now();
  var fakeClient = {
    listGrants: function () {
      return Promise.resolve({
        ok: true,
        balance: { weak: 0, medium: 3, strong: 1 },
        helpMediumBalance: 2,
        recentHelps: [
          { helper: 'h1', helperNickname: 'A', ts: now - 1000 },
          { helper: 'h2', helperNickname: 'B', ts: now - 2000 },
        ],
      });
    },
  };
  await v.reconcile(fakeClient, 'p1');
  assert.deepStrictEqual(v.getBalance(), { weak: 0, medium: 3, strong: 1 });
  assert.strictEqual(v.getHelpMediumBalance(), 2);
  assert.strictEqual(v.getRecentHelps().length, 2);
  assert.strictEqual(v.getHelpsTodayCount(), 2);
});

test('voucher: applyUsed on medium dips into helpMediumBalance once non-help mediums exhausted', function () {
  var v = V.create({ storage: fakeStorage() });
  // 2 medium total, 1 of which is help-medium.
  v.setBalance({ weak: 0, medium: 2, strong: 0 });
  v.setHelpMediumBalance(1);
  v.applyUsed('medium', 'share', 'p1');
  // 第一次用券：还有 1 张 non-help → helpMediumBalance 不动
  assert.strictEqual(v.getBalance().medium, 1);
  assert.strictEqual(v.getHelpMediumBalance(), 1);
  v.applyUsed('medium', 'share', 'p2');
  // 第二次用券：non-help 耗尽（balance.medium - helpMediumBalance = 0 - 1 = -1）→ 同时扣 helpMediumBalance
  assert.strictEqual(v.getBalance().medium, 0);
  assert.strictEqual(v.getHelpMediumBalance(), 0);
});

test('voucher: confirmUseSynced ok=true removes pending without touching balance', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');               // balance = 1
  v.applyUsed('medium', 'share', 'p1');            // balance = 0, pending = 1
  v.confirmUseSynced('medium', 'share', 'p1', true);
  assert.strictEqual(v.getPendingUse().length, 0);
  assert.strictEqual(v.getBalance().medium, 0);     // 云端已扣，本地不再变
});

test('voucher: confirmUseSynced ok=false rolls back balance', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');               // balance = 1
  v.applyUsed('medium', 'share', 'p1');            // balance = 0, pending = 1
  v.confirmUseSynced('medium', 'share', 'p1', false);
  assert.strictEqual(v.getPendingUse().length, 0);
  assert.strictEqual(v.getBalance().medium, 1);     // 云端拒绝 → 余额回滚
});

test('voucher: reconcile subtracts pending uses from cloud balance', async function () {
  var v = V.create({ storage: fakeStorage() });
  v.applyGranted('medium', 'share');               // balance = 1
  v.applyUsed('medium', 'share', 'p1');            // eager: balance = 0, pending = 1
  // Cloud 还没处理我们这次用券请求，listGrants 返回 medium=1
  var fakeClient = {
    listGrants: function () {
      return Promise.resolve({
        ok: true,
        balance: { weak: 0, medium: 1, strong: 0 },
      });
    },
  };
  await v.reconcile(fakeClient, 'p1');
  // 期望：1 (cloud) - 1 (pending) = 0
  assert.strictEqual(v.getBalance().medium, 0);
});

test('voucher: getHelpsTodayCount filters by local-day boundaries', function () {
  var v = V.create({ storage: fakeStorage() });
  var d = new Date();
  var startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  v.setRecentHelps([
    { helper: 'h1', helperNickname: 'A', ts: startOfToday + 60000 },        // today
    { helper: 'h2', helperNickname: 'B', ts: startOfToday + 120000 },        // today
    { helper: 'h3', helperNickname: 'C', ts: startOfToday - 86400000 },      // yesterday
  ]);
  assert.strictEqual(v.getHelpsTodayCount(), 2);
});
