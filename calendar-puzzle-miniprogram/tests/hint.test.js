var test = require('node:test');
var assert = require('node:assert');
var H = require('../minigame/js/hint');

test('CAPS and COSTS are the agreed economy', function () {
  assert.deepStrictEqual(H.CAPS, { weak: 5, medium: 3, strong: 1 });
  assert.deepStrictEqual(H.COSTS, { weak: 1, medium: 3, strong: 6 });
  assert.strictEqual(H.FIRST_WEAK_FREE, true);
});

test('createHintState returns fresh empty state', function () {
  var s = H.createHintState('2026-05-18:hard:c3');
  assert.strictEqual(s.puzzleId, '2026-05-18:hard:c3');
  assert.deepStrictEqual(s.weakLocked, {});
  assert.deepStrictEqual(s.mediumLocked, {});
  assert.deepStrictEqual(s.strongLocked, {});
  assert.strictEqual(s.usedWeak, 0);
  assert.strictEqual(s.usedMedium, 0);
  assert.strictEqual(s.usedStrong, 0);
});
