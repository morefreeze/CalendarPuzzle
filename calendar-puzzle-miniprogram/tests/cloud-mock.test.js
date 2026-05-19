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

test('mock: setUniqueIndex enforces uniqueness on add', async function () {
  mock.reset();
  mock.setUniqueIndex('shareLog', ['openid', 'openGId', 'dateStr']);
  var db = mock.database();
  await db.collection('shareLog').add({
    data: { openid: 'a', openGId: 'g1', dateStr: '2026-05-19' },
  });
  await assert.rejects(
    db.collection('shareLog').add({
      data: { openid: 'a', openGId: 'g1', dateStr: '2026-05-19' },
    }),
    /duplicate/
  );
});

test('mock: setMockOpenData maps encryptedData+iv to decoded payload', async function () {
  mock.reset();
  mock.setMockOpenData('enc1', 'iv1', { openGId: 'group_X' });
  var got = await mock.getOpenData({ openData: [{ data: 'enc1', iv: 'iv1' }] });
  assert.strictEqual(got.list[0].openGId, 'group_X');
});

test('mock: getOpenData rejects unknown encryptedData', async function () {
  mock.reset();
  await assert.rejects(
    mock.getOpenData({ openData: [{ data: 'unknown', iv: 'iv' }] }),
    /unknown encryptedData/
  );
});
