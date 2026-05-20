// Difficulty selection scene
var R = require('./render');
var stamina = require('./stamina');
var progress = require('./progress');
var PG = require('./puzzleGenerator');
var DIFF = PG.DIFFICULTY_CONFIG;

module.exports = function createSelectScene(safeInsets, menuRect, onSelect, callbacks) {
  callbacks = callbacks || {};
  var scene = {};
  scene.dirty = true;

  var btnRects = [];
  var infoBtn = null;
  var helpOpen = false;
  var replayBtn = null;
  var message = '';
  var msgTimer = null;
  // Helper landing modal layout — recomputed each render when
  // GameGlobal.pendingHelperModal is set (cleared on dismiss click).
  var helperModalLayout = null;

  function getHelperModal() {
    return (typeof GameGlobal !== 'undefined') ? GameGlobal.pendingHelperModal : null;
  }

  function showMsg(m) {
    message = m;
    scene.dirty = true;
    if (msgTimer) clearTimeout(msgTimer);
    if (m) msgTimer = setTimeout(function () { message = ''; scene.dirty = true; }, 3000);
  }

  function formatMMSS(s) {
    var m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  scene.render = function (ctx, W, H) {
    R.clear(ctx, W, H, '#FAFAFA');
    var padBottom = safeInsets.bottom || 0;
    var menuBottom = menuRect.bottom || 0;
    var contentTop = Math.max((safeInsets.top || 0) + 10, menuBottom + 6);
    var safeH = H - contentTop - padBottom;
    var y = contentTop + safeH * 0.04;

    // Title
    R.textBold(ctx, '日历方块挑战', W / 2, y, 28, '#333', 'center');
    y += 40;

    // Stamina capsule with countdown
    var cur = stamina.getStamina();
    var rs = stamina.getRecoverSeconds();
    var capW = W * 0.62, capH = 56;
    var capX = (W - capW) / 2;
    R.roundRect(ctx, capX, y, capW, capH, 12, '#FFF8E1', '#FFB300');
    R.textBold(ctx, '体力 ' + cur + ' / ' + stamina.MAX_STAMINA,
      capX + 14, y + capH / 2 - 4, 18, '#E65100', 'left', 'middle');
    if (cur < stamina.MAX_STAMINA) {
      R.text(ctx, '↻ ' + formatMMSS(rs) + ' 后 +1',
        capX + capW - 14, y + capH / 2 - 4, 13, '#F57C00', 'right', 'middle');
    } else {
      R.text(ctx, '满格', capX + capW - 14, y + capH / 2 - 4, 13, '#2E7D32', 'right', 'middle');
    }
    y += capH + 12;

    // Today completed chip
    var todayStr = PG.formatDateStr(new Date());
    var doneToday = progress.countCompletedForDate(todayStr);
    if (doneToday > 0) {
      var chipW = 130, chipH = 24;
      var chipX = (W - chipW) / 2;
      R.roundRect(ctx, chipX, y, chipW, chipH, 12, '#E8F5E9', '#66BB6A');
      R.textBold(ctx, '今日已通关 ' + doneToday + ' 题',
        chipX + chipW / 2, y + chipH / 2 - 1, 12, '#2E7D32', 'center', 'middle');
      y += chipH + 10;
    }

    // Subtitle
    R.text(ctx, '选择难度 · 越往下越烧脑', W / 2, y, 14, '#888', 'center');
    y += 28;

    // Message
    if (message) {
      R.text(ctx, message, W / 2, y, 14, '#2196F3', 'center');
      y += 22;
    }

    // Difficulty buttons. Color = saturation graded by difficulty; insomnia
    // is the red-alert top tier (0-stamina free practice).
    var diffs = ['easy', 'medium', 'hard', 'expert', 'insomnia'];
    var bgs   = {
      easy: '#66BB6A', medium: '#26A69A', hard: '#5C6BC0',
      expert: '#7E57C2', insomnia: '#E53935',
    };
    var btnW = Math.min(W * 0.78, 320), btnH = 60, btnGap = 10;
    // Shrink button height if 5 buttons would overflow the remaining space.
    var availH = H - y - padBottom - 16;
    var needH = diffs.length * btnH + (diffs.length - 1) * btnGap;
    if (needH > availH) {
      btnH = Math.max(44, Math.floor((availH - (diffs.length - 1) * btnGap) / diffs.length));
    }
    btnRects = [];

    // Inner text positions scale with btnH so we degrade gracefully on small
    // screens (SE-class). At btnH=60 these resolve to the original 12/36.
    var labelY = Math.max(8, Math.round(btnH * 0.20));
    var subY   = Math.max(28, Math.round(btnH * 0.60));
    var costY  = Math.round(btnH / 2 - 6);
    var labelSize = btnH < 54 ? 20 : 22;
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      var cfg = DIFF[d];
      var cost = (cfg.staminaCost != null) ? cfg.staminaCost : cfg.digCount;
      var bx = (W - btnW) / 2;
      // Insomnia badge: shown when the player has discovered ≥1 placement
      // today. Suppresses the right cost text to keep the layout clean.
      var insomniaUniq = (d === 'insomnia') ? progress.getUniqueInsomniaCount(todayStr) : 0;
      var showBadge = insomniaUniq > 0;

      R.roundRect(ctx, bx, y, btnW, btnH, 14, bgs[d]);
      R.textBold(ctx, cfg.label, bx + 14, y + labelY, labelSize, '#fff', 'left');
      R.text(ctx, cfg.sub, bx + 14, y + subY, 12, 'rgba(255,255,255,0.85)', 'left');
      if (!showBadge) {
        var costTxt = cost === 0
          ? '挖 ' + cfg.digCount + ' 块 · 免费'
          : '挖 ' + cfg.digCount + ' 块 · 耗体力 ' + cost;
        R.text(ctx, costTxt,
          bx + btnW - 14, y + costY, 12, 'rgba(255,255,255,0.85)', 'right');
      } else {
        var bdgTxt = '今日 ' + insomniaUniq + ' 种';
        ctx.font = 'bold 12px sans-serif';
        var bdgW = ctx.measureText(bdgTxt).width + 14;
        var bdgH = 22;
        var bdgX = bx + btnW - bdgW - 10;
        var bdgY = y + (btnH - bdgH) / 2;
        R.roundRect(ctx, bdgX, bdgY, bdgW, bdgH, 11, '#fff');
        R.textBold(ctx, bdgTxt, bdgX + bdgW / 2, bdgY + bdgH / 2, 12, '#E53935', 'center', 'middle');
      }
      btnRects.push({ x: bx, y: y, w: btnW, h: btnH, diff: d });
      y += btnH + btnGap;
    }

    // Info / rules button (top-right, below capsule menu).
    var iSize = 32;
    infoBtn = { x: W - iSize - 12, y: contentTop, w: iSize, h: iSize };
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.arc(infoBtn.x + iSize / 2, infoBtn.y + iSize / 2, iSize / 2, 0, Math.PI * 2);
    ctx.fill();
    R.textBold(ctx, 'ⓘ', infoBtn.x + iSize / 2, infoBtn.y + iSize / 2 - 1, 18, '#555', 'center', 'middle');

    // Help overlay
    if (helpOpen) {
      R.overlay(ctx, W, H);
      var hW = W * 0.84, hH = 400;
      var hx = (W - hW) / 2, hy = (H - hH) / 2;
      R.roundRect(ctx, hx, hy, hW, hH, 16, '#fff');
      R.textBold(ctx, '怎么玩', hx + hW / 2, hy + 20, 18, '#333', 'center');
      var lines = [
        '· 棋盘上保留当月、当日、当日星期三格',
        '· 把所有方块拖到棋盘其余位置',
        '· 双击棋盘上方块可移除',
        '· 长按棋盘上方块可拖到新位置',
        '· 选中方块后下方可旋转 / 翻转',
        '· 提示可锁定某一块的正确方向',
        '· 换题消耗体力（通关后免费）',
        '· 已通关的题在手选面板带绿勾',
      ];
      for (var li = 0; li < lines.length; li++) {
        R.text(ctx, lines[li], hx + 20, hy + 56 + li * 26, 13, '#333');
      }
      // Replay tutorial button (sits above the "知道了" close button).
      var rbW = hW - 60, rbH = 36;
      replayBtn = {
        x: hx + (hW - rbW) / 2,
        y: hy + hH - rbH * 2 - 24,
        w: rbW, h: rbH,
      };
      R.button(ctx, replayBtn.x, replayBtn.y, replayBtn.w, replayBtn.h,
        '🎓 重新体验新手教程', '#FFB300', '#fff', 8);

      var cbW = 100, cbH = 36;
      var cbX = hx + (hW - cbW) / 2, cbY = hy + hH - cbH - 16;
      R.button(ctx, cbX, cbY, cbW, cbH, '知道了', '#66BB6A', '#fff', 8);
    } else {
      replayBtn = null;
    }

    // Helper landing modal (helper just opened an invite link → cloud
    // helpInvite resolved → set GameGlobal.pendingHelperModal).
    // mode='fresh' = just succeeded; mode='duplicate' = already helped today (silent rebroadcast).
    var hm = getHelperModal();
    if (hm) {
      R.overlay(ctx, W, H);
      var mW = Math.min(W * 0.8, 320), mH = 200;
      var mx = (W - mW) / 2, my = (H - mH) / 2;
      R.roundRect(ctx, mx, my, mW, mH, 16, '#fff');
      var isDup = hm.mode === 'duplicate';
      var title = isDup ? '今日已助力' : '👏 助力成功';
      var sub = isDup
        ? '今天已为 ' + hm.inviterNickname + ' 助力过啦'
        : '已为 ' + hm.inviterNickname + ' 助力';
      var detail = isDup ? '弱提示先前已到账' : '+1 张弱提示已到账';
      R.textBold(ctx, title, mx + mW / 2, my + 28, 19, '#2E7D32', 'center');
      R.text(ctx, sub, mx + mW / 2, my + 76, 14, '#333', 'center');
      R.text(ctx, detail, mx + mW / 2, my + 104, 13, '#666', 'center');
      var btnW = 180, btnH = 40;
      var btnX = mx + (mW - btnW) / 2, btnY = my + mH - btnH - 18;
      R.button(ctx, btnX, btnY, btnW, btnH, '去玩今天的题', '#43A047', '#fff', 8);
      helperModalLayout = {
        rect: { x: mx, y: my, w: mW, h: mH },
        btn: { x: btnX, y: btnY, w: btnW, h: btnH },
      };
    } else {
      helperModalLayout = null;
    }
  };

  scene.onTouchStart = function () {};
  scene.onTouchMove = function () {};

  scene.onTouchEnd = function (x, y) {
    // Helper landing modal — any click anywhere dismisses it (one-shot).
    if (helperModalLayout) {
      if (typeof GameGlobal !== 'undefined') GameGlobal.pendingHelperModal = null;
      helperModalLayout = null;
      scene.dirty = true;
      return;
    }
    if (helpOpen) {
      if (replayBtn && R.hitTest(x, y, replayBtn)) {
        helpOpen = false;
        if (callbacks.onReplayTutorial) callbacks.onReplayTutorial();
        return;
      }
      helpOpen = false; scene.dirty = true; return;
    }
    if (infoBtn && R.hitTest(x, y, infoBtn)) {
      helpOpen = true; scene.dirty = true; return;
    }
    for (var i = 0; i < btnRects.length; i++) {
      if (R.hitTest(x, y, btnRects[i])) {
        var d = btnRects[i].diff;
        var cfg = DIFF[d];
        var cost = (cfg.staminaCost != null) ? cfg.staminaCost : cfg.digCount;
        if (cost > 0 && !stamina.consumeStamina(cost)) {
          showMsg('体力不足！需要 ' + cost + ' 点，当前 ' + stamina.getStamina() + ' 点');
          return;
        }
        onSelect(d);
        return;
      }
    }
  };

  scene.update = function () {};

  return scene;
};
