var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var grantHint = require('../minigame/cloud/functions/grantHint/index');
var useHint = require('../minigame/cloud/functions/useHint/index');

async function seedGrants(n, type, source) {
  for (var i = 0; i < n; i++) {
    await grantHint._impl({ type: type, source: source }, mock);
  }
}

test('useHint claims one unused voucher and marks it used', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');

  var res = await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
  assert.strictEqual(res.ok, true);
  assert.ok(res.grantId);

  var unused = await mock.database().collection('hintGrants').where({ openid: 'user1', type: 'weak', usedAt: null }).count();
  assert.strictEqual(unused.total, 1);
  var used = await mock.database().collection('hintGrants').where({ openid: 'user1', type: 'weak', usedInPuzzle: 'p1' }).count();
  assert.strictEqual(used.total, 1);
});

test('useHint returns no-grant when balance is 0', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  var res = await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'no-grant');
});

test('useHint enforces per-puzzle cap weak=3', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(10, 'weak', 'ad');

  for (var i = 0; i < 3; i++) {
    var r = await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
    assert.strictEqual(r.ok, true);
  }
  var r4 = await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
  assert.strictEqual(r4.ok, false);
  assert.strictEqual(r4.reason, 'cap-reached');

  var r5 = await useHint._impl({ type: 'weak', puzzleId: 'p2' }, mock);
  assert.strictEqual(r5.ok, true);
});

test('useHint cap is per-type', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'strong', 'ad');
  var r1 = await useHint._impl({ type: 'strong', puzzleId: 'p1' }, mock);
  assert.strictEqual(r1.ok, true);
  var r2 = await useHint._impl({ type: 'strong', puzzleId: 'p1' }, mock);
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.reason, 'cap-reached');
});

test('useHint requires both type and puzzleId', async function () {
  mock.reset();
  var r1 = await useHint._impl({ type: 'weak' }, mock);
  assert.strictEqual(r1.ok, false);
  var r2 = await useHint._impl({ puzzleId: 'p1' }, mock);
  assert.strictEqual(r2.ok, false);
});

test('useHint rejects invalid type', async function () {
  mock.reset();
  var r = await useHint._impl({ type: 'huge', puzzleId: 'p1' }, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid-type');
});
