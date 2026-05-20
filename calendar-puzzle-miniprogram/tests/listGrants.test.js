var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var grantHint = require('../minigame/cloud/functions/grantHint/index');
var useHint = require('../minigame/cloud/functions/useHint/index');
var listGrants = require('../minigame/cloud/functions/listGrants/index');

async function seedGrants(n, type, source) {
  for (var i = 0; i < n; i++) {
    await grantHint._impl({ type: type, source: source }, mock);
  }
}

test('listGrants returns zero balance + zero used for fresh user', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  var r = await listGrants._impl({ puzzleId: 'p1' }, mock);
  assert.deepStrictEqual(r.balance, { weak: 0, medium: 0, strong: 0 });
  assert.deepStrictEqual(r.used, { weak: 0, medium: 0, strong: 0 });
});

test('listGrants reports balance correctly across types', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');
  await seedGrants(1, 'medium', 'share');
  await seedGrants(3, 'strong', 'help');
  var r = await listGrants._impl({ puzzleId: 'p1' }, mock);
  assert.deepStrictEqual(r.balance, { weak: 2, medium: 1, strong: 3 });
  assert.deepStrictEqual(r.used, { weak: 0, medium: 0, strong: 0 });
});

test('listGrants reports per-puzzle used count, filtered by puzzleId', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(5, 'weak', 'ad');
  await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
  await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
  await useHint._impl({ type: 'weak', puzzleId: 'p2' }, mock);

  var r1 = await listGrants._impl({ puzzleId: 'p1' }, mock);
  assert.strictEqual(r1.balance.weak, 2);
  assert.strictEqual(r1.used.weak, 2);

  var r2 = await listGrants._impl({ puzzleId: 'p2' }, mock);
  assert.strictEqual(r2.balance.weak, 2);
  assert.strictEqual(r2.used.weak, 1);
});

test('listGrants works with no puzzleId (used all zero)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');
  var r = await listGrants._impl({}, mock);
  assert.strictEqual(r.balance.weak, 2);
  assert.deepStrictEqual(r.used, { weak: 0, medium: 0, strong: 0 });
});

test('listGrants returns recentHelps with helper nicknames (last 7 days)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'inviter1' });
  var db = mock.database();
  // Seed helpers with nicknames
  await db.collection('users').add({ openid: 'h1', nickname: 'Helper-A' });
  await db.collection('users').add({ openid: 'h2', nickname: 'Helper-B' });
  // Seed helpLog
  var now = Date.now();
  await db.collection('helpLog').add({
    inviter: 'inviter1', helper: 'h1', dateStr: '2026-05-19', createdAt: new Date(now - 86400000),
  });
  await db.collection('helpLog').add({
    inviter: 'inviter1', helper: 'h2', dateStr: '2026-05-18', createdAt: new Date(now - 2 * 86400000),
  });

  var r = await listGrants._impl({}, mock);
  assert.ok(Array.isArray(r.recentHelps));
  assert.strictEqual(r.recentHelps.length, 2);
  var nicks = r.recentHelps.map(function (h) { return h.helperNickname; }).sort();
  assert.deepStrictEqual(nicks, ['Helper-A', 'Helper-B']);
});

test('listGrants recentHelps filters out helpLog older than 7 days', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'inviter1' });
  var db = mock.database();
  await db.collection('users').add({ openid: 'h_old', nickname: 'OLD' });
  var now = Date.now();
  await db.collection('helpLog').add({
    inviter: 'inviter1', helper: 'h_old', dateStr: '2026-05-01', createdAt: new Date(now - 10 * 86400000),
  });
  var r = await listGrants._impl({}, mock);
  assert.strictEqual(r.recentHelps.length, 0);
});

test('listGrants recentHelps falls back to "Ta" when helper has no nickname', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'inviter1' });
  await mock.database().collection('helpLog').add({
    inviter: 'inviter1', helper: 'mystery', dateStr: '2026-05-19', createdAt: new Date(),
  });
  var r = await listGrants._impl({}, mock);
  assert.strictEqual(r.recentHelps[0].helperNickname, 'Ta');
});

test('listGrants helpMediumBalance counts only unused medium/help', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  await seedGrants(3, 'medium', 'help');    // 3 unused medium/help
  await seedGrants(2, 'medium', 'share');   // not counted (wrong source)
  await seedGrants(4, 'weak', 'help');      // not counted (wrong type)
  // Use one of the help-mediums in a puzzle
  await useHint._impl({ type: 'medium', puzzleId: 'p1' }, mock);
  var r = await listGrants._impl({}, mock);
  // Note: useHint picks oldest unused medium (any source), so it may consume
  // share or help — assert helpMediumBalance is between 2-3 inclusive.
  assert.ok(r.helpMediumBalance >= 2 && r.helpMediumBalance <= 3,
    'helpMediumBalance: ' + r.helpMediumBalance);
});

test('listGrants helpMediumBalance is 0 when no help vouchers exist', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  await seedGrants(5, 'medium', 'share');
  var r = await listGrants._impl({}, mock);
  assert.strictEqual(r.helpMediumBalance, 0);
});
