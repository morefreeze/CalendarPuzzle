var test = require('node:test');
var assert = require('node:assert');
var M = require('../minigame/js/mode');

test('createMode(): empty/missing opts → { hardcore: false }', function () {
  assert.deepStrictEqual(M.createMode(),         { hardcore: false });
  assert.deepStrictEqual(M.createMode(undefined),{ hardcore: false });
  assert.deepStrictEqual(M.createMode(null),     { hardcore: false });
  assert.deepStrictEqual(M.createMode({}),       { hardcore: false });
});

test('createMode(): truthy hardcore opt → { hardcore: true }; coerced to boolean', function () {
  assert.deepStrictEqual(M.createMode({ hardcore: true }),  { hardcore: true });
  assert.deepStrictEqual(M.createMode({ hardcore: 1 }),     { hardcore: true });
  assert.deepStrictEqual(M.createMode({ hardcore: false }), { hardcore: false });
  assert.deepStrictEqual(M.createMode({ hardcore: 0 }),     { hardcore: false });
});

test('createMode(): ignores unknown opts (forward-compat)', function () {
  assert.deepStrictEqual(M.createMode({ hardcore: true, ghost: 'ignored' }), { hardcore: true });
});

test('isHardcore(): true only when mode.hardcore === true', function () {
  assert.strictEqual(M.isHardcore(undefined),                 false);
  assert.strictEqual(M.isHardcore(null),                      false);
  assert.strictEqual(M.isHardcore({}),                        false);
  assert.strictEqual(M.isHardcore({ hardcore: false }),       false);
  assert.strictEqual(M.isHardcore({ hardcore: true }),        true);
});

test('canUseHint / canSwapPuzzle / canRestart: false in hardcore, true otherwise', function () {
  var hc = M.createMode({ hardcore: true });
  var nm = M.createMode({});
  assert.strictEqual(M.canUseHint(hc),    false);
  assert.strictEqual(M.canUseHint(nm),    true);
  assert.strictEqual(M.canSwapPuzzle(hc), false);
  assert.strictEqual(M.canSwapPuzzle(nm), true);
  assert.strictEqual(M.canRestart(hc),    false);
  assert.strictEqual(M.canRestart(nm),    true);
});

test('canClearBoard: true regardless of mode', function () {
  assert.strictEqual(M.canClearBoard(M.createMode({ hardcore: true })),  true);
  assert.strictEqual(M.canClearBoard(M.createMode({ hardcore: false })), true);
});

test('DEFAULT_MODE is the canonical { hardcore: false }', function () {
  assert.deepStrictEqual(M.DEFAULT_MODE, { hardcore: false });
});
