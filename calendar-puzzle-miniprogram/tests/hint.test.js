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

function shapeEq(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
  }
  return true;
}

test('applyWeak updates palette block shape to solved orientation', function () {
  var state = H.createHintState('p1');
  var palette = [
    { id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] },
  ];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[0, 1], [1, 1]] } };

  var res = H.applyWeak(state, 'X-block', palette, dropped, solved);

  assert.ok(shapeEq(res.updatedPalette[0].shape, [[0, 1], [1, 1]]));
  assert.strictEqual(res.newState.weakLocked['X-block'], true);
  assert.strictEqual(res.newState.usedWeak, 1);
  assert.deepStrictEqual(res.updatedDropped, []);
});

test('applyWeak evicts misplaced block from board back to palette', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [
    { id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]], x: 3, y: 2 },
  ];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[0, 1], [1, 1]] } };

  var res = H.applyWeak(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.updatedDropped, []);
  assert.strictEqual(res.updatedPalette.length, 1);
  assert.strictEqual(res.updatedPalette[0].id, 'X-block');
  assert.ok(shapeEq(res.updatedPalette[0].shape, [[0, 1], [1, 1]]));
  assert.strictEqual(res.updatedPalette[0].x, undefined);
  assert.strictEqual(res.updatedPalette[0].y, undefined);
});

test('applyWeak keeps block on board if already in solved orientation', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [
    { id: 'X-block', label: 'X', shape: [[0, 1], [1, 1]], x: 0, y: 0 },
  ];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[0, 1], [1, 1]] } };

  var res = H.applyWeak(state, 'X-block', palette, dropped, solved);

  assert.strictEqual(res.updatedDropped.length, 1);
  assert.deepStrictEqual(res.updatedPalette, []);
});
