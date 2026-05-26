var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var convert = require('../minigame/cloud/functions/convertHelpToStrong/index');
var grantHint = require('../minigame/cloud/functions/grantHint/index');

async function seed(type, source, n) {
  for (var i = 0; i < n; i++) {
    await grantHint._impl({ type: type, source: source }, mock);
  }
}

test('convertHelpToStrong: 2 help-medium → 1 strong/help, source rows marked used', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  await seed('medium', 'help', 2);
  var r = await convert._impl({}, mock);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.granted, { type: 'strong', source: 'help' });

  // 2 source rows now used (with marker), 1 new unused strong row
  var helpMed = await mock.database().collection('hintGrants').where({
    openid: 'alice', type: 'medium', source: 'help',
  }).get();
  assert.strictEqual(helpMed.data.length, 2);
  for (var i = 0; i < 2; i++) {
    assert.ok(helpMed.data[i].usedAt, 'source row should be marked used');
    assert.strictEqual(helpMed.data[i].usedInPuzzle, '__converted_to_strong');
  }
  var strongs = await mock.database().collection('hintGrants').where({
    openid: 'alice', type: 'strong', source: 'help', usedAt: null,
  }).get();
  assert.strictEqual(strongs.data.length, 1);
});

test('convertHelpToStrong: < 2 unused medium → insufficient-medium-credits', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  await seed('medium', 'help', 1);
  var r = await convert._impl({}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'insufficient-medium-credits');
});

test('convertHelpToStrong: 0 unused medium → insufficient-medium-credits', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  var r = await convert._impl({}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'insufficient-medium-credits');
});

test('convertHelpToStrong: DOES consume medium/share and medium/stamina (any source)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  await seed('medium', 'share', 1);
  await seed('medium', 'stamina', 1);
  var r = await convert._impl({}, mock);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.granted, { type: 'strong', source: 'help' });
});

test('convertHelpToStrong: 4 help-medium → can convert twice (2 strongs total)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  await seed('medium', 'help', 4);
  var r1 = await convert._impl({}, mock);
  assert.strictEqual(r1.ok, true);
  var r2 = await convert._impl({}, mock);
  assert.strictEqual(r2.ok, true);
  var r3 = await convert._impl({}, mock);
  assert.strictEqual(r3.ok, false);  // 0 left
  assert.strictEqual(r3.err, 'insufficient-medium-credits');

  var strongs = await mock.database().collection('hintGrants').where({
    openid: 'alice', type: 'strong', source: 'help', usedAt: null,
  }).get();
  assert.strictEqual(strongs.data.length, 2);
});

test('convertHelpToStrong: ignores already-used help-medium', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'alice' });
  await seed('medium', 'help', 3);
  // Mark one as already used
  var rows = await mock.database().collection('hintGrants').where({
    openid: 'alice', type: 'medium', source: 'help',
  }).get();
  await mock.database().collection('hintGrants').where({ _id: rows.data[0]._id }).update({
    data: { usedAt: new Date(), usedInPuzzle: 'p1' },
  });
  // 2 unused remain — should still succeed
  var r1 = await convert._impl({}, mock);
  assert.strictEqual(r1.ok, true);
  var r2 = await convert._impl({}, mock);
  assert.strictEqual(r2.ok, false);  // 0 unused now
});
