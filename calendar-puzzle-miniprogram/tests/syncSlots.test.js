var test = require('node:test');
var assert = require('node:assert');
var mock = require('./cloud-mock');
var syncSlots = require('../minigame/cloud/functions/syncSlots/index');

test('syncSlots: empty client + empty server → empty merged', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  var r = await syncSlots._impl({ slots: [] }, mock);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.slots, []);
});

test('syncSlots: client uploads new slot — stored + echoed back', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  var clientSlot = { slotId: 'named-1', payload: { slotId: 'named-1', savedAt: 1000, date: '2026-05-20' }, savedAt: 1000, deletedAt: null };
  var r = await syncSlots._impl({ slots: [clientSlot] }, mock);
  assert.strictEqual(r.slots.length, 1);
  assert.strictEqual(r.slots[0].slotId, 'named-1');
  assert.strictEqual(r.slots[0].savedAt, 1000);
});

test('syncSlots: server-newer payload wins over client-older', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  await mock.database().collection('saveSlots').add({
    openid: 'u1', slotId: 'named-2', payload: { slotId: 'named-2', savedAt: 5000, date: '2026-05-20' }, savedAt: 5000, deletedAt: null,
  });
  var clientSlot = { slotId: 'named-2', payload: { slotId: 'named-2', savedAt: 1000, date: '2026-05-19' }, savedAt: 1000, deletedAt: null };
  var r = await syncSlots._impl({ slots: [clientSlot] }, mock);
  assert.strictEqual(r.slots[0].savedAt, 5000);
  assert.strictEqual(r.slots[0].payload.date, '2026-05-20');
});

test('syncSlots: client-newer wins, upserts server', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  await mock.database().collection('saveSlots').add({
    openid: 'u1', slotId: 'named-1', payload: { slotId: 'named-1', savedAt: 1000 }, savedAt: 1000, deletedAt: null,
  });
  var clientSlot = { slotId: 'named-1', payload: { slotId: 'named-1', savedAt: 5000, date: '2026-05-21' }, savedAt: 5000, deletedAt: null };
  var r = await syncSlots._impl({ slots: [clientSlot] }, mock);
  assert.strictEqual(r.slots[0].savedAt, 5000);
  var srv = await mock.database().collection('saveSlots').where({ openid: 'u1', slotId: 'named-1' }).get();
  assert.strictEqual(srv.data.length, 1);
  assert.strictEqual(srv.data[0].savedAt, 5000);
});

test('syncSlots: client tombstone (deletedAt > server.savedAt) → server deleted', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  await mock.database().collection('saveSlots').add({
    openid: 'u1', slotId: 'named-1', payload: { slotId: 'named-1', savedAt: 1000 }, savedAt: 1000, deletedAt: null,
  });
  var clientTomb = { slotId: 'named-1', payload: null, savedAt: 0, deletedAt: 5000 };
  var r = await syncSlots._impl({ slots: [clientTomb] }, mock);
  assert.strictEqual(r.slots[0].deletedAt, 5000);
  assert.strictEqual(r.slots[0].payload, null);
});

test('syncSlots: server tombstone (deletedAt > client.savedAt) → client gets tombstone back', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  await mock.database().collection('saveSlots').add({
    openid: 'u1', slotId: 'named-2', payload: null, savedAt: 0, deletedAt: 5000,
  });
  var clientOlder = { slotId: 'named-2', payload: { slotId: 'named-2', savedAt: 1000 }, savedAt: 1000, deletedAt: null };
  var r = await syncSlots._impl({ slots: [clientOlder] }, mock);
  assert.strictEqual(r.slots[0].deletedAt, 5000);
  assert.strictEqual(r.slots[0].payload, null);
});

test('syncSlots: server has slots client did not send — included in response', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  await mock.database().collection('saveSlots').add({
    openid: 'u1', slotId: 'named-3', payload: { slotId: 'named-3', savedAt: 2000 }, savedAt: 2000, deletedAt: null,
  });
  var r = await syncSlots._impl({ slots: [] }, mock);
  assert.strictEqual(r.slots.length, 1);
  assert.strictEqual(r.slots[0].slotId, 'named-3');
});

test('syncSlots: rejects non-named slotIds (temp must not sync)', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  var bad = { slotId: 'temp', payload: { slotId: 'temp', savedAt: 1000 }, savedAt: 1000, deletedAt: null };
  var r = await syncSlots._impl({ slots: [bad] }, mock);
  assert.strictEqual(r.slots.length, 0);
  var srv = await mock.database().collection('saveSlots').where({ openid: 'u1', slotId: 'temp' }).get();
  assert.strictEqual(srv.data.length, 0);
});

test('syncSlots: per-user isolation — u2 does not see u1 slots', async function () {
  mock.reset();
  mock.setMockContext({ OPENID: 'u1' });
  await syncSlots._impl({ slots: [{ slotId: 'named-1', payload: { slotId: 'named-1', savedAt: 1000 }, savedAt: 1000, deletedAt: null }] }, mock);

  mock.setMockContext({ OPENID: 'u2' });
  var r = await syncSlots._impl({ slots: [] }, mock);
  assert.strictEqual(r.slots.length, 0);
});
