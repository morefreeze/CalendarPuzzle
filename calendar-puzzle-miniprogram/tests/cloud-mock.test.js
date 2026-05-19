var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');

test('cloud-mock add + where.get', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { name: 'a', val: 1 } });
  await db.collection('foo').add({ data: { name: 'b', val: 2 } });
  var res = await db.collection('foo').where({ name: 'a' }).get();
  assert.strictEqual(res.data.length, 1);
  assert.strictEqual(res.data[0].val, 1);
});

test('cloud-mock where.count', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 2 } });
  var res = await db.collection('foo').where({ x: 1 }).count();
  assert.strictEqual(res.total, 2);
});

test('cloud-mock where.update', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { id: 1, status: 'new' } });
  await db.collection('foo').where({ id: 1 }).update({ data: { status: 'done' } });
  var res = await db.collection('foo').where({ id: 1 }).get();
  assert.strictEqual(res.data[0].status, 'done');
});

test('cloud-mock where.limit + get returns truncated list', async function () {
  mock.reset();
  var db = mock.database();
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 1 } });
  await db.collection('foo').add({ data: { x: 1 } });
  var res = await db.collection('foo').where({ x: 1 }).limit(2).get();
  assert.strictEqual(res.data.length, 2);
});

test('cloud-mock getWXContext + setMockContext', function () {
  mock.reset();
  assert.strictEqual(mock.getWXContext().OPENID, 'test-openid');
  mock.setMockContext({ OPENID: 'user2' });
  assert.strictEqual(mock.getWXContext().OPENID, 'user2');
});
