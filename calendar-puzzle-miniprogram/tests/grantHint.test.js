var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var grantHint = require('../minigame/cloud/functions/grantHint/index');

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
