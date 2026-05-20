var test = require('node:test');
var assert = require('node:assert');
var SS = require('../minigame/js/slotStore');

function fakeStorage() {
  var store = {};
  return {
    setItem: function (k, v) { store[k] = String(v); },
    getItem: function (k) { return k in store ? store[k] : null; },
    removeItem: function (k) { delete store[k]; },
    _peek: function () { return store; },
  };
}

test('slotStore: writeSlot then readSlot round-trips and stamps savedAt + schemaVersion + slotId', function () {
  var s = fakeStorage();
  var fixedNow = 1716181000000;
  var ss = SS.create({ storage: s, now: function () { return fixedNow; } });
  ss.writeSlot('named-1', {
    date: '2026-05-20',
    difficulty: 'easy',
    comboIndex: 3,
    placedBlocks: [{ type: 'I-block', x: 2, y: 3, rotation: 0, mirrored: false, locked: false }],
    paletteBlocks: ['T-block', 'L-block'],
    elapsedMs: 87000,
    hintsUsed: 1,
  });
  var got = ss.readSlot('named-1');
  assert.strictEqual(got.slotId, 'named-1');
  assert.strictEqual(got.savedAt, fixedNow);
  assert.strictEqual(got.schemaVersion, SS.SCHEMA_VERSION);
  assert.strictEqual(got.date, '2026-05-20');
  assert.strictEqual(got.difficulty, 'easy');
  assert.strictEqual(got.comboIndex, 3);
  assert.deepStrictEqual(got.paletteBlocks, ['T-block', 'L-block']);
  assert.strictEqual(got.elapsedMs, 87000);
  assert.strictEqual(got.hintsUsed, 1);
});

test('slotStore: writeSlot uses STORAGE_KEY_PREFIX + slotId for the storage key', function () {
  var s = fakeStorage();
  var ss = SS.create({ storage: s });
  ss.writeSlot('named-2', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  var keys = Object.keys(s._peek());
  assert.deepStrictEqual(keys, [SS.STORAGE_KEY_PREFIX + 'named-2']);
});

test('slotStore: readSlot returns null for non-existent slot', function () {
  var ss = SS.create({ storage: fakeStorage() });
  assert.strictEqual(ss.readSlot('named-1'), null);
  assert.strictEqual(ss.readSlot('temp'), null);
});

test('slotStore: readAllNamed returns 3-element array, null for empty slots', function () {
  var ss = SS.create({ storage: fakeStorage() });
  ss.writeSlot('named-2', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  var all = ss.readAllNamed();
  assert.strictEqual(all.length, 3);
  assert.strictEqual(all[0], null);
  assert.strictEqual(all[1].slotId, 'named-2');
  assert.strictEqual(all[2], null);
});

test('slotStore: readAllNamed preserves NAMED_SLOT_IDS order', function () {
  var ss = SS.create({ storage: fakeStorage() });
  ss.writeSlot('named-3', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  ss.writeSlot('named-1', { date: '2026-05-19', difficulty: 'hard', comboIndex: 1 });
  var all = ss.readAllNamed();
  assert.strictEqual(all[0].date, '2026-05-19');  // named-1
  assert.strictEqual(all[1], null);                // named-2
  assert.strictEqual(all[2].date, '2026-05-20');  // named-3
});

test('slotStore: deleteSlot removes the storage key', function () {
  var s = fakeStorage();
  var ss = SS.create({ storage: s });
  ss.writeSlot('named-1', { date: '2026-05-20', difficulty: 'easy', comboIndex: 0 });
  assert.notStrictEqual(ss.readSlot('named-1'), null);
  ss.deleteSlot('named-1');
  assert.strictEqual(ss.readSlot('named-1'), null);
  assert.deepStrictEqual(Object.keys(s._peek()), []);
});

test('slotStore: deleteSlot is idempotent (no throw on missing key)', function () {
  var ss = SS.create({ storage: fakeStorage() });
  ss.deleteSlot('named-1');                  // never existed
  ss.deleteSlot('named-1');                  // again
  assert.strictEqual(ss.readSlot('named-1'), null);
});

test('slotStore: malformed JSON in storage reads as null (no throw)', function () {
  var s = fakeStorage();
  s.setItem(SS.STORAGE_KEY_PREFIX + 'named-1', '{not json');
  var ss = SS.create({ storage: s });
  assert.strictEqual(ss.readSlot('named-1'), null);
});

test('slotStore: writeSlot with null/undefined payload is a no-op', function () {
  var s = fakeStorage();
  var ss = SS.create({ storage: s });
  ss.writeSlot('named-1', null);
  ss.writeSlot('named-1', undefined);
  assert.strictEqual(ss.readSlot('named-1'), null);
});
