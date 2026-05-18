var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var login = require('../cloud/functions/login/index');

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
