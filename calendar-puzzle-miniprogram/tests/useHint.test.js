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

// ---- Idempotency via attemptId ----
// Scenario from bug #3: in-scene useHint succeeds cloud-side but client callback
// is dropped (scene destroyed / WeChat backgrounded the JS runtime). On next cold
// boot, flushPendingUse retries the same entry. Without idempotency, cloud either
// (a) claims a SECOND grant, or (b) returns no-grant → client rolls back the
// already-correct decrement. attemptId fixes both: cloud sees the same attemptId,
// replays the cached response, no second claim.

test('useHint with attemptId — replay returns cached response, does not claim a second grant', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');

  var r1 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'A' }, mock);
  assert.strictEqual(r1.ok, true);
  var firstGrantId = r1.grantId;

  // Cloud-side state after first call: exactly 1 unused grant remaining.
  var unusedAfter1 = await mock.database().collection('hintGrants').where({ openid: 'user1', type: 'weak', usedAt: null }).count();
  assert.strictEqual(unusedAfter1.total, 1);

  // Retry the SAME attemptId — must not claim another grant; must return the same response.
  var r2 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'A' }, mock);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.grantId, firstGrantId, 'replay must return the original grantId');

  var unusedAfter2 = await mock.database().collection('hintGrants').where({ openid: 'user1', type: 'weak', usedAt: null }).count();
  assert.strictEqual(unusedAfter2.total, 1, 'replay must NOT claim a second grant');
});

test('useHint replays cached business-failure response (no-grant) without re-checking caps', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  // No grants seeded → first call returns no-grant.
  var r1 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'B' }, mock);
  assert.strictEqual(r1.ok, false);
  assert.strictEqual(r1.reason, 'no-grant');

  // Now seed a grant. Retry SAME attemptId must still return the cached no-grant
  // (because the original attempt is what we are replaying — not a fresh use).
  await seedGrants(1, 'weak', 'ad');
  var r2 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'B' }, mock);
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.reason, 'no-grant');

  // The fresh grant must remain unused (replay must not consume it).
  var unused = await mock.database().collection('hintGrants').where({ openid: 'user1', type: 'weak', usedAt: null }).count();
  assert.strictEqual(unused.total, 1);
});

test('useHint without attemptId — legacy behavior, each call claims a new grant', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');

  var r1 = await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
  assert.strictEqual(r1.ok, true);
  // No-attemptId path: second call WILL claim the second grant (legacy semantics).
  var r2 = await useHint._impl({ type: 'weak', puzzleId: 'p1' }, mock);
  assert.strictEqual(r2.ok, true);
  assert.notStrictEqual(r2.grantId, r1.grantId);
});

test('useHint with different attemptIds — each is a distinct claim', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(2, 'weak', 'ad');

  var r1 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'X' }, mock);
  var r2 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'Y' }, mock);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r2.ok, true);
  assert.notStrictEqual(r2.grantId, r1.grantId);
});

test('useHint attemptId is scoped per openid — same attemptId on different openid is a fresh attempt', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user1' });
  await seedGrants(1, 'weak', 'ad');
  var r1 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'A' }, mock);
  assert.strictEqual(r1.ok, true);

  mock.setMockContext({ OPENID: 'user2' });
  await seedGrants(1, 'weak', 'ad');
  var r2 = await useHint._impl({ type: 'weak', puzzleId: 'p1', attemptId: 'A' }, mock);
  assert.strictEqual(r2.ok, true, "user2's first attempt with id=A must NOT collide with user1's");
});
