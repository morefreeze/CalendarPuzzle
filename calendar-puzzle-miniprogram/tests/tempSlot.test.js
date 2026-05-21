var test = require('node:test');
var assert = require('node:assert');
var SS = require('../minigame/js/slotStore');
var TS = require('../minigame/js/tempSlot');

function fakeStorage() {
  var store = {};
  return {
    setItem: function (k, v) { store[k] = String(v); },
    getItem: function (k) { return k in store ? store[k] : null; },
    removeItem: function (k) { delete store[k]; },
  };
}

function fakeTimer() {
  var fns = {};
  var nextId = 1;
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

test('tempSlot: markDirty does NOT write immediately — debounced', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var timer = fakeTimer();
  var ts = TS.create({
    store: store,
    scheduleTimeout: timer.schedule,
    cancelTimeout: timer.cancel,
  });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  assert.strictEqual(store.readSlot('temp'), null);          // not written yet
  assert.strictEqual(timer.pending(), 1);                     // timer armed
});

test('tempSlot: markDirty writes once timer fires', function () {
  var store = SS.create({ storage: fakeStorage() });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  var got = store.readSlot('temp');
  assert.notStrictEqual(got, null);
  assert.strictEqual(got.slotId, 'temp');
  assert.strictEqual(got.date, '2026-05-20');
});

test('tempSlot: rapid markDirty coalesces into ONE write (debounce)', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var timer = fakeTimer();
  var writeCount = 0;
  var origSet = s.setItem;
  s.setItem = function (k, v) { writeCount++; origSet(k, v); };
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [{ type: 'I-block' }] });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [{ type: 'I-block' }, { type: 'T-block' }] });
  assert.strictEqual(timer.pending(), 1);                     // still one timer
  timer.fireAll();
  assert.strictEqual(writeCount, 1);                          // single write
  // Final write reflects the LAST payload (2 placed blocks):
  assert.strictEqual(store.readSlot('temp').placedBlocks.length, 2);
});

test('tempSlot: flush writes pending payload immediately + cancels timer', function () {
  var store = SS.create({ storage: fakeStorage() });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  assert.strictEqual(store.readSlot('temp'), null);
  assert.strictEqual(timer.pending(), 1);
  ts.flush();
  assert.notStrictEqual(store.readSlot('temp'), null);        // written
  assert.strictEqual(timer.pending(), 0);                      // timer cancelled
});

test('tempSlot: flush with no pending payload is a no-op', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var ts = TS.create({ store: store, scheduleTimeout: fakeTimer().schedule, cancelTimeout: fakeTimer().cancel });
  ts.flush();
  assert.strictEqual(store.readSlot('temp'), null);
});

test('tempSlot: flush after timer already fired is a no-op (no double-write)', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var timer = fakeTimer();
  var writeCount = 0;
  var origSet = s.setItem;
  s.setItem = function (k, v) { writeCount++; origSet(k, v); };
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  assert.strictEqual(writeCount, 1);
  ts.flush();
  assert.strictEqual(writeCount, 1);
});

test('tempSlot: clear deletes temp slot + cancels pending timer + drops pending payload', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();                                            // now persisted
  assert.notStrictEqual(store.readSlot('temp'), null);
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [{ type: 'I-block' }] });
  ts.clear();
  assert.strictEqual(store.readSlot('temp'), null);
  assert.strictEqual(timer.pending(), 0);
  // After clear, even if a stale timer somehow fired, nothing would write
  timer.fireAll();
  assert.strictEqual(store.readSlot('temp'), null);
});

test('tempSlot: hasUnsavedSession is false when temp slot is empty', function () {
  var store = SS.create({ storage: fakeStorage() });
  var ts = TS.create({ store: store, scheduleTimeout: fakeTimer().schedule, cancelTimeout: fakeTimer().cancel });
  assert.strictEqual(ts.hasUnsavedSession(), false);
});

test('tempSlot: hasUnsavedSession is true after temp slot is written', function () {
  var store = SS.create({ storage: fakeStorage() });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  assert.strictEqual(ts.hasUnsavedSession(), true);
});

test('tempSlot: hasUnsavedSession is false after clear', function () {
  var store = SS.create({ storage: fakeStorage() });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  ts.clear();
  assert.strictEqual(ts.hasUnsavedSession(), false);
});

test('tempSlot: peekUnsaved returns the current temp slot record (or null)', function () {
  var store = SS.create({ storage: fakeStorage() });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  assert.strictEqual(ts.peekUnsaved(), null);
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  var peek = ts.peekUnsaved();
  assert.strictEqual(peek.slotId, 'temp');
  assert.strictEqual(peek.date, '2026-05-20');
});

function fakeBinding(initial) {
  var bound = initial || null;
  return {
    getBound: function () { return bound; },
    bind: function (id) { bound = id; },
    clearActive: function () { bound = null; },
  };
}

test('tempSlot: writes to TEMP_SLOT_ID when no binding provided', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  assert.notStrictEqual(store.readSlot('temp'), null);
});

test('tempSlot: routes write to bound slot when binding returns a named slot', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var timer = fakeTimer();
  var binding = fakeBinding('named-2');
  var ts = TS.create({ store: store, binding: binding, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  assert.strictEqual(store.readSlot('temp'), null);
  var got = store.readSlot('named-2');
  assert.notStrictEqual(got, null);
  assert.strictEqual(got.slotId, 'named-2');
});

test('tempSlot: flips active target mid-session via binding.bind', function () {
  var store = SS.create({ storage: fakeStorage() });
  var timer = fakeTimer();
  var binding = fakeBinding(null);
  var ts = TS.create({ store: store, binding: binding, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  // First write → temp (no binding)
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  timer.fireAll();
  assert.notStrictEqual(store.readSlot('temp'), null);
  // Now bind to named-1
  binding.bind('named-1');
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [{ type: 'I-block' }] });
  timer.fireAll();
  // The post-bind write went to named-1
  assert.notStrictEqual(store.readSlot('named-1'), null);
  // temp still has the pre-bind state (caller is responsible for deleteSlot('temp') when picking)
  assert.notStrictEqual(store.readSlot('temp'), null);
});

test('tempSlot: cancelPending drops the timer + pending payload without writing', function () {
  var s = fakeStorage();
  var store = SS.create({ storage: s });
  var timer = fakeTimer();
  var ts = TS.create({ store: store, scheduleTimeout: timer.schedule, cancelTimeout: timer.cancel });
  ts.markDirty({ date: '2026-05-20', difficulty: 'easy', comboIndex: 0, placedBlocks: [] });
  assert.strictEqual(timer.pending(), 1);
  ts.cancelPending();
  assert.strictEqual(timer.pending(), 0);
  timer.fireAll();
  assert.strictEqual(store.readSlot('temp'), null);
});
