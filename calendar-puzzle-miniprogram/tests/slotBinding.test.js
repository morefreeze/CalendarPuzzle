var test = require('node:test');
var assert = require('node:assert');
var SB = require('../minigame/js/slotBinding');

test('slotBinding: fresh instance has no binding', function () {
  var b = SB.create();
  assert.strictEqual(b.getBound(), null);
});

test('slotBinding: bind sets the current slot, getBound returns it', function () {
  var b = SB.create();
  b.bind('named-2');
  assert.strictEqual(b.getBound(), 'named-2');
});

test('slotBinding: re-bind replaces previous binding', function () {
  var b = SB.create();
  b.bind('named-1');
  b.bind('named-3');
  assert.strictEqual(b.getBound(), 'named-3');
});

test('slotBinding: clearActive resets to null', function () {
  var b = SB.create();
  b.bind('named-2');
  b.clearActive();
  assert.strictEqual(b.getBound(), null);
});

test('slotBinding: two instances are independent (in-memory state)', function () {
  var a = SB.create();
  var b = SB.create();
  a.bind('named-1');
  assert.strictEqual(a.getBound(), 'named-1');
  assert.strictEqual(b.getBound(), null);
});
