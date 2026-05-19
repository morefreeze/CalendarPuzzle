var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var login = require('../minigame/cloud/functions/login/index');

test('login creates a user row on first call for new openid', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user_alpha' });
  var res = await login.main({}, {}, mock);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.openid, 'user_alpha');
  assert.strictEqual(res.isNewUser, true);

  var users = await mock.database().collection('users').where({ openid: 'user_alpha' }).get();
  assert.strictEqual(users.data.length, 1);
  assert.ok(users.data[0].createdAt);
});

test('login is idempotent: second call for same openid does not duplicate user', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'user_beta' });
  await login.main({}, {}, mock);
  var res = await login.main({}, {}, mock);
  assert.strictEqual(res.isNewUser, false);
  var users = await mock.database().collection('users').where({ openid: 'user_beta' }).get();
  assert.strictEqual(users.data.length, 1);
});

var crypto = require('node:crypto');
var SECRET = 'test-secret-32-bytes-aaaaaaaaaaaa';

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

test('login returns helpToken = HMAC(openid+today+SECRET)', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_gamma' });
  var res = await login.main({}, {}, mock);
  var expected = crypto.createHmac('sha256', SECRET).update('user_gamma' + todayStr()).digest('hex');
  assert.strictEqual(res.helpToken, expected);
});

test('login fills nickname+avatarUrl on first call when provided', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_delta' });
  await login.main({ nickname: 'Del', avatarUrl: 'http://x' }, {}, mock);
  var u = await mock.database().collection('users').where({ openid: 'user_delta' }).get();
  assert.strictEqual(u.data[0].nickname, 'Del');
  assert.strictEqual(u.data[0].avatarUrl, 'http://x');
});

test('login does NOT overwrite existing nickname', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_eps' });
  await login.main({ nickname: 'First' }, {}, mock);
  await login.main({ nickname: 'Second' }, {}, mock);
  var u = await mock.database().collection('users').where({ openid: 'user_eps' }).get();
  assert.strictEqual(u.data[0].nickname, 'First');
});

test('login fills nickname on later call if it was empty before', async function () {
  mock.reset();
  process.env.HELP_TOKEN_SECRET = SECRET;
  mock.setMockContext({ OPENID: 'user_zeta' });
  await login.main({}, {}, mock);  // creates row with no nickname
  await login.main({ nickname: 'Later' }, {}, mock);
  var u = await mock.database().collection('users').where({ openid: 'user_zeta' }).get();
  assert.strictEqual(u.data[0].nickname, 'Later');
});
