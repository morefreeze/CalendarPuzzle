var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var grantHint = require('../minigame/cloud/functions/grantHint/index');
var useHint = require('../minigame/cloud/functions/useHint/index');
var listGrants = require('../minigame/cloud/functions/listGrants/index');

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
  assert.strictEqual(r1.balance.weak, 2);
  assert.strictEqual(r1.used.weak, 2);

  var r2 = await listGrants.main({ puzzleId: 'p2' }, {}, mock);
  assert.strictEqual(r2.balance.weak, 2);
  assert.strictEqual(r2.used.weak, 1);
});

test('listGrants works with no puzzleId (used all zero)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');
  var r = await listGrants.main({}, {}, mock);
  assert.strictEqual(r.balance.weak, 2);
  assert.deepStrictEqual(r.used, { weak: 0, medium: 0, strong: 0 });
});
