var test = require('node:test');
var assert = require('node:assert');
var SS = require('../minigame/js/slotStore');
var CSS = require('../minigame/js/cloudSlotSync');

function fakeStorage() {
  var s = {};
  return {
    getItem: function (k) { return k in s ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; },
    _peek: function () { return s; },
  };
}

function fakeTimer() {
  var fns = {}, nextId = 1;
  return {
    schedule: function (cb, ms) { var id = nextId++; fns[id] = { cb: cb, ms: ms }; return id; },
    cancel: function (id) { delete fns[id]; },
    fireAll: function () {
      var ids = Object.keys(fns);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var f = fns[id]; delete fns[id]; if (f) f.cb();
      }
    },
    pending: function () { return Object.keys(fns).length; },
  };
}

function fakeClient(opts) {
  opts = opts || {};
  var calls = [];
  var responses = opts.responses || [];
  var idx = 0;
  return {
    syncSlots: function (slots) {
      calls.push(slots);
      var resp = responses[idx] || { ok: true, slots: [] };
      idx++;
      if (resp instanceof Error) return Promise.reject(resp);
      return Promise.resolve(resp);
    },
    _calls: function () { return calls; },
  };
}

test('cloudSlotSync.mergeOnLogin: empty local + empty cloud → no local writes', async function () {
  var store = SS.create({ storage: fakeStorage() });
  var client = fakeClient();
  var sync = CSS.create({ store: store, cloudClient: client });
  await sync.mergeOnLogin();
  assert.strictEqual(client._calls().length, 1);
  assert.deepStrictEqual(client._calls()[0], []);
});

test('cloudSlotSync.mergeOnLogin: local-only slot → uploaded to cloud', async function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  store.writeSlot('named-1', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  var client = fakeClient();
  var sync = CSS.create({ store: store, cloudClient: client });
  await sync.mergeOnLogin();
  var call = client._calls()[0];
  assert.strictEqual(call.length, 1);
  assert.strictEqual(call[0].slotId, 'named-1');
  assert.ok(call[0].savedAt > 0);
});

test('cloudSlotSync.mergeOnLogin: cloud-newer slot → written to local', async function () {
  var store = SS.create({ storage: fakeStorage() });
  store.writeSlot('named-1', { date: '2026-05-19', difficulty: 'easy', comboIndex: 0 });
  var oldLocal = store.readSlot('named-1');

  var newerCloud = {
    slotId: 'named-1',
    payload: { schemaVersion: 1, slotId: 'named-1', date: '2026-05-21', difficulty: 'expert', comboIndex: 0, savedAt: oldLocal.savedAt + 10000 },
    savedAt: oldLocal.savedAt + 10000,
    deletedAt: null,
  };
  var client = fakeClient({ responses: [{ ok: true, slots: [newerCloud] }] });
  var sync = CSS.create({ store: store, cloudClient: client });
  await sync.mergeOnLogin();
  assert.strictEqual(store.readSlot('named-1').date, '2026-05-21');
});

test('cloudSlotSync.mergeOnLogin: cloud tombstone → local slot deleted', async function () {
  var store = SS.create({ storage: fakeStorage() });
  store.writeSlot('named-2', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  var local = store.readSlot('named-2');
  var tombstone = { slotId: 'named-2', payload: null, savedAt: 0, deletedAt: local.savedAt + 10000 };
  var client = fakeClient({ responses: [{ ok: true, slots: [tombstone] }] });
  var sync = CSS.create({ store: store, cloudClient: client });
  await sync.mergeOnLogin();
  assert.strictEqual(store.readSlot('named-2'), null);
});

test('cloudSlotSync.mergeOnLogin: network failure swallowed (no throw)', async function () {
  var store = SS.create({ storage: fakeStorage() });
  var client = fakeClient({ responses: [new Error('network')] });
  var sync = CSS.create({ store: store, cloudClient: client });
  await sync.mergeOnLogin();
});

test('cloudSlotSync.pushNamedSlot: sends slot to cloud', async function () {
  var store = SS.create({ storage: fakeStorage() });
  store.writeSlot('named-1', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  var client = fakeClient();
  var sync = CSS.create({ store: store, cloudClient: client });
  await sync.pushNamedSlot('named-1');
  assert.strictEqual(client._calls().length, 1);
  assert.strictEqual(client._calls()[0][0].slotId, 'named-1');
});

test('cloudSlotSync.pushNamedSlot: deleted slot pushes tombstone', async function () {
  var store = SS.create({ storage: fakeStorage() });
  var client = fakeClient();
  var nowMs = 12345;
  var sync = CSS.create({ store: store, cloudClient: client, now: function () { return nowMs; } });
  await sync.pushNamedSlot('named-1');
  var sent = client._calls()[0][0];
  assert.strictEqual(sent.payload, null);
  assert.strictEqual(sent.deletedAt, nowMs);
});

test('cloudSlotSync.pushNamedSlot: rejects non-named slotId (no-op)', async function () {
  var store = SS.create({ storage: fakeStorage() });
  var client = fakeClient();
  var sync = CSS.create({ store: store, cloudClient: client });
  await sync.pushNamedSlot('temp');
  assert.strictEqual(client._calls().length, 0);
});

test('cloudSlotSync.pushNamedSlot: network failure queues retry', async function () {
  var store = SS.create({ storage: fakeStorage() });
  store.writeSlot('named-1', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  var timer = fakeTimer();
  var client = fakeClient({ responses: [new Error('net1'), { ok: true, slots: [] }] });
  var sync = CSS.create({ store: store, cloudClient: client, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  await sync.pushNamedSlot('named-1');
  assert.strictEqual(timer.pending(), 1);
  timer.fireAll();
  // Allow the queued promise chain to resolve before asserting
  await new Promise(function (r) { setImmediate(r); });
  assert.strictEqual(client._calls().length, 2);
});
