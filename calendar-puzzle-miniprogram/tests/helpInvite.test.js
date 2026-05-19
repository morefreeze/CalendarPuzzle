var test = require('node:test');
var assert = require('node:assert');
var crypto = require('node:crypto');
var mock = require('./cloud-mock');
var helpInvite = require('../minigame/cloud/functions/helpInvite/index');

var SECRET = 'test-secret-32-bytes-aaaaaaaaaaaa';

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function tokenFor(openid) {
  return crypto.createHmac('sha256', SECRET).update(openid + todayStr()).digest('hex');
}

function setup() {
  mock.reset();
  mock.setUniqueIndex('helpLog', ['inviter', 'helper', 'dateStr']);
  process.env.HELP_TOKEN_SECRET = SECRET;
}

test('helpInvite: helper gets weak voucher; inviter gets none on N=1', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  var t = tokenFor('inviter1');
  var r = await helpInvite.main({ inviter: 'inviter1', t: t }, {}, mock);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.inviterNickname, 'Inv');
  assert.deepStrictEqual(r.granted, { type: 'weak', source: 'helperGift' });

  var helperGrants = await mock.database().collection('hintGrants').where({ openid: 'helper1' }).get();
  assert.strictEqual(helperGrants.data.length, 1);
  assert.strictEqual(helperGrants.data[0].type, 'weak');

  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 0);
});

test('helpInvite: inviter gets strong on N=2 (even)', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });

  mock.setMockContext({ OPENID: 'helper1' });
  await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);

  mock.setMockContext({ OPENID: 'helper2' });
  var r = await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);
  assert.strictEqual(r.ok, true);

  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 1);
  assert.strictEqual(inviterGrants.data[0].type, 'strong');
  assert.strictEqual(inviterGrants.data[0].source, 'help');
});

test('helpInvite: N=3 inviter still has 1 strong (no double-grant)', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  for (var i = 1; i <= 3; i++) {
    mock.setMockContext({ OPENID: 'helper' + i });
    await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);
  }
  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 1);
});

test('helpInvite: N=4 inviter has 2 strong', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  for (var i = 1; i <= 4; i++) {
    mock.setMockContext({ OPENID: 'helper' + i });
    await helpInvite.main({ inviter: 'inviter1', t: tokenFor('inviter1') }, {}, mock);
  }
  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 2);
});

test('helpInvite: self-help rejected', async function () {
  setup();
  mock.setMockContext({ OPENID: 'alice' });
  var r = await helpInvite.main({ inviter: 'alice', t: tokenFor('alice') }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'self-help');
});

test('helpInvite: bad token rejected', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  var r = await helpInvite.main({ inviter: 'inviter1', t: 'badtoken' }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'bad-token');
});

test('helpInvite: duplicate same helper same day rejected', async function () {
  setup();
  await mock.database().collection('users').add({ data: { openid: 'inviter1', nickname: 'Inv' } });
  mock.setMockContext({ OPENID: 'helper1' });
  var t = tokenFor('inviter1');
  await helpInvite.main({ inviter: 'inviter1', t: t }, {}, mock);
  var r = await helpInvite.main({ inviter: 'inviter1', t: t }, {}, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'duplicate');
});

test('helpInvite: inviter without users row gets fallback nickname "Ta"', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  var r = await helpInvite.main({ inviter: 'nobody', t: tokenFor('nobody') }, {}, mock);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.inviterNickname, 'Ta');
});
