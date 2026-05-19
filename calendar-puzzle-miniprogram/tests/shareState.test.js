var test = require('node:test');
var assert = require('node:assert');
var S = require('../minigame/js/shareState');

test('buildShareData with no current returns generic title, empty query', function () {
  S.setCurrent(null);
  S.clearInviterContext();
  var d = S.buildShareData();
  assert.match(d.title, /日历方块/);
  assert.strictEqual(d.query, '');
});

test('buildShareData with current returns puzzle query', function () {
  S.clearInviterContext();
  S.setCurrent({ difficulty: 'hard', difficultyLabel: '困难', comboIndex: 3, dateStr: '2026-05-19' });
  var d = S.buildShareData();
  assert.ok(d.query.indexOf('d=hard') >= 0);
  assert.ok(d.query.indexOf('c=3') >= 0);
  assert.ok(d.query.indexOf('date=2026-05-19') >= 0);
});

test('setInviterContext adds inviter+t to share query and changes title', function () {
  S.setCurrent({ difficulty: 'hard', difficultyLabel: '困难', comboIndex: 3, dateStr: '2026-05-19' });
  S.setInviterContext({ inviter: 'openid_A', t: 'token_xyz' });
  var d = S.buildShareData();
  assert.match(d.title, /帮我助力/);
  assert.ok(d.query.indexOf('inviter=openid_A') >= 0);
  assert.ok(d.query.indexOf('t=token_xyz') >= 0);
});

test('clearInviterContext removes inviter/t from query', function () {
  S.setCurrent({ difficulty: 'hard', difficultyLabel: '困难', comboIndex: 3, dateStr: '2026-05-19' });
  S.setInviterContext({ inviter: 'openid_A', t: 'token_xyz' });
  S.clearInviterContext();
  var d = S.buildShareData();
  assert.strictEqual(d.query.indexOf('inviter='), -1);
  assert.strictEqual(d.query.indexOf('&t='), -1);
});
