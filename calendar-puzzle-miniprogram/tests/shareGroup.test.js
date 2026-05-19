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
