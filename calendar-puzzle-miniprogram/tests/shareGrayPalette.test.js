var test = require('node:test');
var assert = require('node:assert');
var P = require('../minigame/js/shareGrayPalette');

test('makeShareGrayPalette: covers every input id', function () {
  var ids = ['A', 'B', 'C', 'D'];
  var pal = P.makeShareGrayPalette(ids);
  ids.forEach(function (id) {
    assert.ok(pal[id], 'expected palette entry for id ' + id);
    assert.match(pal[id], /^#[0-9A-Fa-f]{6}$/, 'expected hex color, got ' + pal[id]);
  });
});

test('makeShareGrayPalette: distinct ids get distinct grays when within ramp size', function () {
  var ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']; // 9 ids, ramp has 9 slots
  var pal = P.makeShareGrayPalette(ids);
  var values = ids.map(function (id) { return pal[id]; });
  var unique = new Set(values);
  assert.strictEqual(unique.size, ids.length, 'expected 9 distinct grays');
});

test('makeShareGrayPalette: repeated calls produce different orderings', function () {
  var ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  var seen = new Set();
  for (var i = 0; i < 50; i++) {
    var pal = P.makeShareGrayPalette(ids);
    seen.add(ids.map(function (id) { return pal[id]; }).join(','));
  }
  assert.ok(seen.size > 1, 'expected at least 2 distinct orderings across 50 runs, got ' + seen.size);
});

test('makeShareGrayPalette: wraps when more ids than ramp slots', function () {
  var ids = [];
  for (var i = 0; i < 15; i++) ids.push('id' + i);
  var pal = P.makeShareGrayPalette(ids);
  ids.forEach(function (id) {
    assert.match(pal[id], /^#[0-9A-Fa-f]{6}$/);
  });
});

test('makeShareGrayPalette: empty input returns empty palette', function () {
  var pal = P.makeShareGrayPalette([]);
  assert.deepStrictEqual(pal, {});
});
