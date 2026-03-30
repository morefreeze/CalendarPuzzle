// Difficulty selection scene
var R = require('./render');
var stamina = require('./stamina');
var DIFF = require('./puzzleGenerator').DIFFICULTY_CONFIG;

module.exports = function createSelectScene(safeInsets, menuRect, onSelect) {
  var scene = {};
  scene.dirty = true;

  var btnRects = [];
  var message = '';
  var msgTimer = null;

  function showMsg(m) {
    message = m;
    scene.dirty = true;
    if (msgTimer) clearTimeout(msgTimer);
    if (m) msgTimer = setTimeout(function () { message = ''; scene.dirty = true; }, 3000);
  }

  scene.render = function (ctx, W, H) {
    R.clear(ctx, W, H, '#FAFAFA');
    var padBottom = safeInsets.bottom || 0;
    var menuBottom = menuRect.bottom || 0;
    var contentTop = Math.max((safeInsets.top || 0) + 10, menuBottom + 6);
    var safeH = H - contentTop - padBottom;
    var y = contentTop + safeH * 0.04;

    // Title
    R.textBold(ctx, '\u65E5\u5386\u65B9\u5757\u6311\u6218', W / 2, y, 28, '#333', 'center');
    y += 40;

    // Stamina bar
    var cur = stamina.getStamina();
    var rs = stamina.getRecoverSeconds();
    var barW = W * 0.7, barH = 50;
    var barX = (W - barW) / 2;
    R.roundRect(ctx, barX, y, barW, barH, 10, '#FFF3E0', '#FFB74D');
    R.textBold(ctx, '\u4F53\u529B: ' + cur + ' / ' + stamina.MAX_STAMINA, W / 2, y + 12, 16, '#E65100', 'center');
    if (cur < stamina.MAX_STAMINA) {
      var rd = Math.floor(rs / 60) + ':' + (rs % 60 < 10 ? '0' : '') + (rs % 60);
      R.text(ctx, '\u6062\u590D\u4E0B\u4E00\u70B9: ' + rd, W / 2, y + 32, 12, '#F57C00', 'center');
    }
    y += barH + 15;

    // Message
    if (message) {
      R.text(ctx, message, W / 2, y, 14, '#2196F3', 'center');
      y += 25;
    }

    // Subtitle
    R.text(ctx, '\u9009\u62E9\u96BE\u5EA6\u5F00\u59CB\u6E38\u620F', W / 2, y, 16, '#666', 'center');
    y += 35;

    // Difficulty buttons
    var diffs = ['easy', 'medium', 'hard', 'expert'];
    var colors = { easy: '#4CAF50', medium: '#FF9800', hard: '#F44336', expert: '#9C27B0' };
    var btnW = W * 0.65, btnH = 60;
    btnRects = [];

    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      var cfg = DIFF[d];
      var bx = (W - btnW) / 2;
      R.roundRect(ctx, bx, y, btnW, btnH, 12, colors[d]);
      R.textBold(ctx, cfg.label, W / 2, y + 15, 20, '#fff', 'center');
      R.text(ctx, '\u653E\u7F6E ' + cfg.digCount + ' \u4E2A\u65B9\u5757 | \u6D88\u8017 ' + cfg.digCount + ' \u4F53\u529B', W / 2, y + 40, 12, 'rgba(255,255,255,0.85)', 'center');
      btnRects.push({ x: bx, y: y, w: btnW, h: btnH, diff: d });
      y += btnH + 15;
    }
  };

  scene.onTouchStart = function () {};
  scene.onTouchMove = function () {};

  scene.onTouchEnd = function (x, y) {
    for (var i = 0; i < btnRects.length; i++) {
      if (R.hitTest(x, y, btnRects[i])) {
        var d = btnRects[i].diff;
        var cost = DIFF[d].digCount;
        if (!stamina.consumeStamina(cost)) {
          showMsg('\u4F53\u529B\u4E0D\u8DB3\uFF01\u9700\u8981 ' + cost + ' \u70B9\uFF0C\u5F53\u524D ' + stamina.getStamina() + ' \u70B9');
          return;
        }
        onSelect(d);
        return;
      }
    }
  };

  scene.update = function () {
    // Stamina recovery updates the display
  };

  return scene;
};
