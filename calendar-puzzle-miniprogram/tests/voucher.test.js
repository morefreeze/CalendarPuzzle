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
