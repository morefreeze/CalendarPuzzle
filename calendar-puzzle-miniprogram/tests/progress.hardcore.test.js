var test = require('node:test');
var assert = require('node:assert');

// Install a fresh in-memory wx shim BEFORE requiring the module, since
// progress.js does not DI the storage layer.
function installWX() {
  global.wx = {
    _s: {},
    setStorageSync: function (k, v) { this._s[k] = v; },
    getStorageSync: function (k) { return k in this._s ? this._s[k] : ''; },
  };
}
function resetWX() { if (global.wx) global.wx._s = {}; }

installWX();
var progress = require('../minigame/js/progress');

test('markHardcoreCleared: first time at (date, difficulty) returns true and persists', function () {
  resetWX();
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'expert'), true);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'), true);
});

test('markHardcoreCleared: idempotent — second call at same (date, difficulty) returns false', function () {
  resetWX();
  progress.markHardcoreCleared('2026-05-27', 'expert');
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'expert'), false);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'), true);
});

test('markHardcoreCleared: distinct (difficulty) on same date both record', function () {
  resetWX();
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'easy'),   true);
  assert.strictEqual(progress.markHardcoreCleared('2026-05-27', 'expert'), true);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'easy'),    true);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'),  true);
});

test('hasHardcoreCleared: false when never marked / different date / different difficulty', function () {
  resetWX();
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'expert'), false);
  progress.markHardcoreCleared('2026-05-27', 'expert');
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-28', 'expert'), false);
  assert.strictEqual(progress.hasHardcoreCleared('2026-05-27', 'hard'),   false);
});

test('storage round-trip: hardcoreDays survives a fresh require-cycle via wx storage', function () {
  resetWX();
  progress.markHardcoreCleared('2026-05-27', 'insomnia');
  // Drop the cached module so the next require re-reads wx storage.
  delete require.cache[require.resolve('../minigame/js/progress')];
  var progress2 = require('../minigame/js/progress');
  assert.strictEqual(progress2.hasHardcoreCleared('2026-05-27', 'insomnia'), true);
});
