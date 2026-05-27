var test = require('node:test');
var assert = require('node:assert');
var H = require('../minigame/js/hint');

test('CAPS and COSTS are the agreed economy', function () {
  assert.deepStrictEqual(H.CAPS, { weak: 3, medium: 3, strong: 1 });
  assert.deepStrictEqual(H.COSTS, { weak: 1, medium: 2, strong: 6 });
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

test('applyMedium records target cell, does NOT change palette shape', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[0, 1], [1, 1]] } };

  var res = H.applyMedium(state, 'X-block', palette, dropped, solved);

  // Random pick — must be one of the 3 filled cells of the shape at origin (2,3)
  var validCells = [{ x: 3, y: 3 }, { x: 2, y: 4 }, { x: 3, y: 4 }];
  var hit = validCells.some(function (c) { return c.x === res.hintedCell.x && c.y === res.hintedCell.y; });
  assert.ok(hit, 'hintedCell should be one of the filled cells; got ' + JSON.stringify(res.hintedCell));

  assert.ok(shapeEq(res.updatedPalette[0].shape, [[1, 1], [0, 1]])); // unchanged
  assert.strictEqual(res.newState.mediumLocked['X-block'].length, 1);
  assert.strictEqual(res.newState.usedMedium, 1);
});

test('applyMedium evicts board block placed at wrong cell', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]], x: 0, y: 0 }];
  var solved = { 'X-block': { x: 5, y: 5, shape: [[0, 1], [1, 1]] } };

  var res = H.applyMedium(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.updatedDropped, []);
  assert.strictEqual(res.updatedPalette.length, 1);
  assert.strictEqual(res.updatedPalette[0].x, undefined);
});

test('applyMedium leaves correctly-positioned block in place', function () {
  var state = H.createHintState('p1');
  var palette = [];
  var dropped = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]], x: 5, y: 5 }];
  var solved = { 'X-block': { x: 5, y: 5, shape: [[0, 1], [1, 1]] } };

  var res = H.applyMedium(state, 'X-block', palette, dropped, solved);

  assert.strictEqual(res.updatedDropped.length, 1);
  assert.strictEqual(res.updatedDropped[0].x, 5);
});

test('applyStrong places block at solved location with solved shape', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[0, 1], [1, 1]] } };

  var res = H.applyStrong(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.updatedPalette, []);
  assert.strictEqual(res.updatedDropped.length, 1);
  assert.strictEqual(res.updatedDropped[0].id, 'X-block');
  assert.strictEqual(res.updatedDropped[0].x, 2);
  assert.strictEqual(res.updatedDropped[0].y, 3);
  assert.ok(shapeEq(res.updatedDropped[0].shape, [[0, 1], [1, 1]]));
  assert.strictEqual(res.newState.strongLocked['X-block'].x, 2);
  assert.strictEqual(res.newState.usedStrong, 1);
  assert.deepStrictEqual(res.evictedIds, []);
});

test('applyStrong evicts blockers that overlap the target', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  // Y-block is currently placed and overlaps cell (2,3)
  var dropped = [{ id: 'Y-block', label: 'Y', shape: [[1, 1]], x: 2, y: 3 }];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[0, 1], [1, 1]] } };

  var res = H.applyStrong(state, 'X-block', palette, dropped, solved);

  assert.deepStrictEqual(res.evictedIds, ['Y-block']);
  // X-block placed
  assert.strictEqual(res.updatedDropped.length, 1);
  assert.strictEqual(res.updatedDropped[0].id, 'X-block');
  // Y-block back in palette
  assert.ok(res.updatedPalette.some(function (b) { return b.id === 'Y-block'; }));
});

test('canUse returns false when cap reached', function () {
  var s = H.createHintState('p1');
  s.usedWeak = 3;
  assert.strictEqual(H.canUse(s, 'weak'), false);
  s.usedMedium = 3;
  assert.strictEqual(H.canUse(s, 'medium'), false);
  s.usedStrong = 1;
  assert.strictEqual(H.canUse(s, 'strong'), false);
});

test('isOrientationLocked true after weak applied', function () {
  var s = H.createHintState('p1');
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1]] } };
  var r = H.applyWeak(s, 'X-block', [{ id: 'X-block', label: 'X', shape: [[1]] }], [], solved);
  assert.strictEqual(H.isOrientationLocked(r.newState, 'X-block'), true);
  assert.strictEqual(H.isOrientationLocked(r.newState, 'Y-block'), false);
});

test('isFullyLocked true after strong applied', function () {
  var s = H.createHintState('p1');
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1]] } };
  var r = H.applyStrong(s, 'X-block', [{ id: 'X-block', label: 'X', shape: [[1]] }], [], solved);
  assert.strictEqual(H.isFullyLocked(r.newState, 'X-block'), true);
});

test('applyMedium accumulates a new cell on each call to same block', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [1, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 5, y: 5, shape: [[1, 1], [1, 1]] } };

  var cur = state, pal = palette, drp = dropped;
  var seen = {};
  for (var i = 0; i < 4; i++) {
    var r = H.applyMedium(cur, 'X-block', pal, drp, solved);
    assert.ok(r.hintedCell, 'call ' + i + ' should reveal a cell');
    var key = r.hintedCell.x + ',' + r.hintedCell.y;
    assert.ok(!seen[key], 'cell ' + key + ' revealed twice');
    seen[key] = true;
    cur = r.newState; pal = r.updatedPalette; drp = r.updatedDropped;
  }
  assert.strictEqual(cur.mediumLocked['X-block'].length, 4);
  assert.strictEqual(H.isMediumExhausted(cur, 'X-block', solved), true);

  // 5th call returns null (exhausted)
  var r5 = H.applyMedium(cur, 'X-block', pal, drp, solved);
  assert.strictEqual(r5.hintedCell, null);

  // All 4 cells of the 2x2 square should have been seen
  assert.deepStrictEqual(Object.keys(seen).sort(), ['5,5', '5,6', '6,5', '6,6']);
});

test('applyMedium returns null hintedCell when block exhausted', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1]] } };

  var r1 = H.applyMedium(state, 'X-block', palette, dropped, solved);
  assert.strictEqual(H.isMediumExhausted(r1.newState, 'X-block', solved), true);

  var r2 = H.applyMedium(r1.newState, 'X-block', r1.updatedPalette, r1.updatedDropped, solved);
  assert.strictEqual(r2.hintedCell, null);
});

test('applyMedium accepts and passes through source param without changing state', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1, 1], [0, 1]] } };
  var res = H.applyMedium(state, 'X-block', palette, dropped, solved, 'share');
  assert.strictEqual(res.newState.usedMedium, 1);
  // No source field on state itself — purely a caller-side tag
});

test('applyStrong accepts and passes through source param', function () {
  var state = H.createHintState('p1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1, 1]] } };
  var res = H.applyStrong(state, 'X-block', palette, dropped, solved, 'help');
  assert.strictEqual(res.newState.usedStrong, 1);
});

// ---- restoreHintState ----
// Used when reloading a save slot: prefers the saved hint state if it is well-formed
// AND its puzzleId matches the current puzzle; otherwise returns a fresh state.

test('restoreHintState: null/undefined saved → fresh state with given puzzleId', function () {
  var fresh = H.restoreHintState(null, 'p1');
  assert.strictEqual(fresh.puzzleId, 'p1');
  assert.deepStrictEqual(fresh.weakLocked, {});
  assert.deepStrictEqual(fresh.mediumLocked, {});
  assert.deepStrictEqual(fresh.strongLocked, {});
  assert.strictEqual(fresh.usedWeak, 0);
  assert.strictEqual(fresh.usedMedium, 0);
  assert.strictEqual(fresh.usedStrong, 0);

  var fresh2 = H.restoreHintState(undefined, 'p2');
  assert.strictEqual(fresh2.puzzleId, 'p2');
});

test('restoreHintState: matching puzzleId + well-formed state → deep-cloned restore', function () {
  // Build a non-trivial saved state via a real apply sequence
  var solved = {
    'X-block': { x: 2, y: 3, shape: [[0, 1], [1, 1]] },
    'Y-block': { x: 5, y: 1, shape: [[1, 1]] },
  };
  var palette = [
    { id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] },
    { id: 'Y-block', label: 'Y', shape: [[1, 1]] },
  ];
  var s0 = H.createHintState('2026-05-20:easy:c0');
  var w = H.applyWeak(s0, 'X-block', palette, [], solved);
  var m = H.applyMedium(w.newState, 'Y-block', w.updatedPalette, w.updatedDropped, solved);
  var st = H.applyStrong(m.newState, 'Y-block', m.updatedPalette, m.updatedDropped, solved);
  var saved = st.newState;

  // Round-trip via JSON to simulate slot persistence
  var rehydrated = JSON.parse(JSON.stringify(saved));
  var restored = H.restoreHintState(rehydrated, '2026-05-20:easy:c0');

  assert.strictEqual(restored.puzzleId, '2026-05-20:easy:c0');
  assert.strictEqual(restored.weakLocked['X-block'], true);
  assert.strictEqual(restored.mediumLocked['Y-block'].length, 1);
  assert.deepStrictEqual(restored.strongLocked['Y-block'], { x: 5, y: 1 });
  assert.strictEqual(restored.usedWeak, 1);
  assert.strictEqual(restored.usedMedium, 1);
  assert.strictEqual(restored.usedStrong, 1);

  // Must be a deep clone — mutating restored state must not mutate the saved record
  restored.weakLocked['Z-block'] = true;
  restored.mediumLocked['Y-block'].push({ x: 99, y: 99 });
  restored.strongLocked['Y-block'].x = -1;
  assert.strictEqual(rehydrated.weakLocked['Z-block'], undefined);
  assert.strictEqual(rehydrated.mediumLocked['Y-block'].length, 1);
  assert.strictEqual(rehydrated.strongLocked['Y-block'].x, 5);
});

test('restoreHintState: puzzleId mismatch → fresh state for the requested puzzleId', function () {
  var saved = {
    puzzleId: '2026-05-19:easy:c0',
    weakLocked: { 'X-block': true },
    mediumLocked: {},
    strongLocked: { 'Y-block': { x: 1, y: 2 } },
    usedWeak: 2, usedMedium: 0, usedStrong: 1,
  };
  var restored = H.restoreHintState(saved, '2026-05-20:easy:c0');
  assert.strictEqual(restored.puzzleId, '2026-05-20:easy:c0');
  assert.deepStrictEqual(restored.weakLocked, {});
  assert.deepStrictEqual(restored.strongLocked, {});
  assert.strictEqual(restored.usedWeak, 0);
  assert.strictEqual(restored.usedStrong, 0);
});

test('restoreHintState: missing maps default to {} and missing counters to 0', function () {
  var partial = { puzzleId: 'p1' };
  var restored = H.restoreHintState(partial, 'p1');
  assert.deepStrictEqual(restored.weakLocked, {});
  assert.deepStrictEqual(restored.mediumLocked, {});
  assert.deepStrictEqual(restored.strongLocked, {});
  assert.strictEqual(restored.usedWeak, 0);
  assert.strictEqual(restored.usedMedium, 0);
  assert.strictEqual(restored.usedStrong, 0);
});

test('restoreHintState: malformed input (string/number/array) → fresh state', function () {
  assert.strictEqual(H.restoreHintState('garbage', 'p1').usedWeak, 0);
  assert.strictEqual(H.restoreHintState(42, 'p1').usedWeak, 0);
  assert.strictEqual(H.restoreHintState([], 'p1').usedWeak, 0);
  assert.strictEqual(H.restoreHintState('garbage', 'p1').puzzleId, 'p1');
});

test('restoreHintState: strong-locked block stays locked after restore (regression for slot-load bug)', function () {
  // Reproduces the user-reported bug: after loading a slot, strong-hinted blocks
  // were no longer marked as locked, so the player could remove them and burn
  // another strong hint (which is supposed to cap at 1 per puzzle).
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1, 1]] } };
  var afterStrong = H.applyStrong(
    H.createHintState('p1'),
    'X-block',
    [{ id: 'X-block', label: 'X', shape: [[1, 1]] }],
    [],
    solved
  );
  // Save → reload (JSON round-trip)
  var slot = JSON.parse(JSON.stringify(afterStrong.newState));
  var restored = H.restoreHintState(slot, 'p1');

  assert.strictEqual(H.isFullyLocked(restored, 'X-block'), true, 'strong-locked block must remain locked after reload');
  assert.strictEqual(H.canUse(restored, 'strong'), false, 'strong-hint cap (1) must remain enforced after reload');
});

test('createHintState initialises mediumMismatchIgnored to false', function () {
  var s = H.createHintState('p-mm-1');
  assert.strictEqual(s.mediumMismatchIgnored, false);
});

test('restoreHintState defaults mediumMismatchIgnored to false when absent', function () {
  var saved = { puzzleId: 'p-mm-rt-1', weakLocked: {}, mediumLocked: {}, strongLocked: {}, usedWeak: 0, usedMedium: 0, usedStrong: 0 };
  var s = H.restoreHintState(saved, 'p-mm-rt-1');
  assert.strictEqual(s.mediumMismatchIgnored, false);
});

test('restoreHintState round-trips mediumMismatchIgnored: true', function () {
  var saved = { puzzleId: 'p-mm-rt-2', weakLocked: {}, mediumLocked: {}, strongLocked: {}, usedWeak: 0, usedMedium: 0, usedStrong: 0, mediumMismatchIgnored: true };
  var s = H.restoreHintState(saved, 'p-mm-rt-2');
  assert.strictEqual(s.mediumMismatchIgnored, true);
});

function _stateWithIgnored(puzzleId) {
  return H.restoreHintState({
    puzzleId: puzzleId,
    weakLocked: {}, mediumLocked: {}, strongLocked: {},
    usedWeak: 0, usedMedium: 0, usedStrong: 0,
    mediumMismatchIgnored: true,
  }, puzzleId);
}

test('applyWeak preserves mediumMismatchIgnored when true', function () {
  var state = _stateWithIgnored('p-prop-1');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1], [0, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 0, y: 0, shape: [[1, 0], [1, 1]] } };
  var res = H.applyWeak(state, 'X-block', palette, dropped, solved);
  assert.strictEqual(res.newState.mediumMismatchIgnored, true, 'flag must survive applyWeak');
});

test('applyMedium preserves mediumMismatchIgnored when true', function () {
  var state = _stateWithIgnored('p-prop-2');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[1, 1]] } };
  var res = H.applyMedium(state, 'X-block', palette, dropped, solved);
  assert.strictEqual(res.newState.mediumMismatchIgnored, true, 'flag must survive applyMedium');
});

test('applyStrong preserves mediumMismatchIgnored when true', function () {
  var state = _stateWithIgnored('p-prop-3');
  var palette = [{ id: 'X-block', label: 'X', shape: [[1, 1]] }];
  var dropped = [];
  var solved = { 'X-block': { x: 2, y: 3, shape: [[1, 1]] } };
  var res = H.applyStrong(state, 'X-block', palette, dropped, solved);
  assert.strictEqual(res.newState.mediumMismatchIgnored, true, 'flag must survive applyStrong');
});
