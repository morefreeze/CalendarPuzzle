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

test('helpInvite: helper gets weak; inviter gets 1 medium/help on N=1', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  await mock.database().collection('users').add({ openid: 'inviter1', nickname: 'Inv' });
  var t = tokenFor('inviter1');
  var r = await helpInvite._impl({ inviter: 'inviter1', t: t }, mock);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.inviterNickname, 'Inv');
  assert.deepStrictEqual(r.granted, { type: 'weak', source: 'helperGift' });

  var helperGrants = await mock.database().collection('hintGrants').where({ openid: 'helper1' }).get();
  assert.strictEqual(helperGrants.data.length, 1);
  assert.strictEqual(helperGrants.data[0].type, 'weak');
  assert.strictEqual(helperGrants.data[0].source, 'helperGift');

  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 1);
  assert.strictEqual(inviterGrants.data[0].type, 'medium');
  assert.strictEqual(inviterGrants.data[0].source, 'help');
});

test('helpInvite: N=3 inviter has 3 medium/help (one per helper)', async function () {
  setup();
  await mock.database().collection('users').add({ openid: 'inviter1', nickname: 'Inv' });
  for (var i = 1; i <= 3; i++) {
    mock.setMockContext({ OPENID: 'helper' + i });
    await helpInvite._impl({ inviter: 'inviter1', t: tokenFor('inviter1') }, mock);
  }
  var inviterGrants = await mock.database().collection('hintGrants').where({ openid: 'inviter1' }).get();
  assert.strictEqual(inviterGrants.data.length, 3);
  // All medium/help — no strong from help directly anymore (need convertHelpToStrong).
  for (var j = 0; j < inviterGrants.data.length; j++) {
    assert.strictEqual(inviterGrants.data[j].type, 'medium');
    assert.strictEqual(inviterGrants.data[j].source, 'help');
  }
});

test('helpInvite: self-help rejected', async function () {
  setup();
  mock.setMockContext({ OPENID: 'alice' });
  var r = await helpInvite._impl({ inviter: 'alice', t: tokenFor('alice') }, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'self-help');
});

test('helpInvite: bad token rejected', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  var r = await helpInvite._impl({ inviter: 'inviter1', t: 'badtoken' }, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'bad-token');
});

test('helpInvite: duplicate same helper same day rejected', async function () {
  setup();
  await mock.database().collection('users').add({ openid: 'inviter1', nickname: 'Inv' });
  mock.setMockContext({ OPENID: 'helper1' });
  var t = tokenFor('inviter1');
  await helpInvite._impl({ inviter: 'inviter1', t: t }, mock);
  var r = await helpInvite._impl({ inviter: 'inviter1', t: t }, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'duplicate');
});

test('helpInvite: inviter without users row gets fallback nickname "Ta"', async function () {
  setup();
  mock.setMockContext({ OPENID: 'helper1' });
  var r = await helpInvite._impl({ inviter: 'nobody', t: tokenFor('nobody') }, mock);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.inviterNickname, 'Ta');
});

test('helpInvite: missing HELP_TOKEN_SECRET returns server-misconfigured', async function () {
  mock.reset();
  mock.setUniqueIndex('helpLog', ['inviter', 'helper', 'dateStr']);
  delete process.env.HELP_TOKEN_SECRET;
  mock.setMockContext({ OPENID: 'helper1' });
  var r = await helpInvite._impl({ inviter: 'inviter1', t: 'anytoken' }, mock);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.err, 'server-misconfigured');
});
