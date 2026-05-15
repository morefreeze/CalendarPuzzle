// Render a 750×1000 share card to an off-screen canvas and save it to the
// user's photo album. Mini-game runtime has no direct "share to Moments"
// API — the user picks the saved image from their album manually.
var R = require('./render');
var B = require('./board');
var PG = require('./puzzleGenerator');

var SHARE_W = 750;
var SHARE_H = 1000;

// Difficulty pill bg colors (mirror selectScene palette).
var DIFF_BG = {
  easy: '#66BB6A', medium: '#26A69A', hard: '#5C6BC0',
  expert: '#7E57C2', insomnia: '#E53935',
};

function getHeadline(difficulty) {
  if (difficulty === 'insomnia') return '我今天睡不着觉也要把这关过了';
  return '我在日历方块拼出了今天';
}

function formatDateText(dateStr) {
  var d = PG.parseDateStr(dateStr) || new Date();
  var wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 周' + wd;
}

function formatMMSS(s) {
  var m = Math.floor(s / 60), sec = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}

// Pure draw routine — takes a 2D context sized SHARE_W×SHARE_H.
function drawShareCard(ctx, opts) {
  var difficulty = opts.difficulty;
  var diffCfg = PG.DIFFICULTY_CONFIG[difficulty] || { label: '' };
  var blocks = opts.blocks || [];
  var uncov = opts.uncov || [];
  var time = opts.time || 0;
  var dateStr = opts.dateStr || '';

  // ── Background
  R.clear(ctx, SHARE_W, SHARE_H, '#FAFAFA');

  // ── Title row
  R.textBold(ctx, '日历方块', SHARE_W / 2, 56, 40, '#333', 'center', 'middle');
  R.text(ctx, formatDateText(dateStr), SHARE_W / 2, 110, 22, '#888', 'center', 'middle');

  // ── Board card
  var cs = 78;                     // cell size
  var bw = cs * 7, bh = cs * 8;
  var bx = Math.floor((SHARE_W - bw) / 2);
  var by = 168;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  R.roundRect(ctx, bx - 14, by - 14, bw + 28, bh + 28, 14, '#fff');
  ctx.restore();

  // ── Base cells (month / day / weekday tint)
  for (var y = 0; y < 8; y++) {
    for (var x = 0; x < 7; x++) {
      var cell = B.boardLayoutData[y][x];
      var px = bx + x * cs, py = by + y * cs;
      if (cell.t === 'empty') {
        R.diagonalStripes(ctx, px, py, cs, cs, 'rgba(0,0,0,0.10)', 8);
        continue;
      }
      var fill = (cell.t === 'month') ? '#E8F5E9'
               : (cell.t === 'day') ? '#C8E6C9'
               : '#A5D6A7';
      ctx.fillStyle = fill;
      ctx.fillRect(px, py, cs, cs);
      var lbl = (typeof cell.v === 'number') ? String(cell.v) : cell.v;
      if (lbl) {
        R.text(ctx, lbl, px + cs / 2, py + cs / 2, 13, 'rgba(0,0,0,0.40)', 'center', 'middle');
      }
    }
  }

  // ── Uncoverable highlights (date markers) — gold, drawn under blocks so
  //    placed blocks visually sit "on top of" the calendar.
  for (var u = 0; u < uncov.length; u++) {
    var ucell = B.boardLayoutData[uncov[u].y][uncov[u].x];
    var ux = bx + uncov[u].x * cs, uy = by + uncov[u].y * cs;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(ux, uy, cs, cs);
    ctx.strokeStyle = '#E6A700';
    ctx.lineWidth = 3;
    ctx.strokeRect(ux + 1.5, uy + 1.5, cs - 3, cs - 3);
    var ulbl = (typeof ucell.v === 'number') ? String(ucell.v) : ucell.v;
    if (ulbl) {
      R.textBold(ctx, ulbl, ux + cs / 2, uy + cs / 2, 18, '#5D4037', 'center', 'middle');
    }
  }

  // ── Placed blocks
  for (var b = 0; b < blocks.length; b++) {
    var bl = blocks[b];
    R.blockShape(ctx, bl.shape, bl.color, bx + bl.x * cs, by + bl.y * cs, cs);
  }

  // ── Difficulty pill + time
  var rowY = by + bh + 44;
  var capH = 56;
  var pillW = 220;
  R.roundRect(ctx, bx, rowY, pillW, capH, capH / 2, DIFF_BG[difficulty] || '#66BB6A');
  R.textBold(ctx, diffCfg.label, bx + pillW / 2, rowY + capH / 2, 26, '#fff', 'center', 'middle');
  R.textBold(ctx, '⏱ ' + formatMMSS(time),
    bx + bw, rowY + capH / 2, 30, '#333', 'right', 'middle');

  // ── Headline (the "punch line")
  R.textBold(ctx, getHeadline(difficulty),
    SHARE_W / 2, rowY + capH + 70, 32, '#333', 'center', 'middle');

  // ── Footer
  R.text(ctx, '微信搜「日历方块」一起玩',
    SHARE_W / 2, SHARE_H - 48, 20, '#999', 'center', 'middle');
}

function _renderToTempFile(opts, onTempPath, onError) {
  var canvas;
  try {
    canvas = wx.createCanvas();           // off-screen (main canvas already created)
    canvas.width = SHARE_W;
    canvas.height = SHARE_H;
  } catch (e) { onError('init'); return; }
  var ctx;
  try { ctx = canvas.getContext('2d'); } catch (e) { onError('init'); return; }
  try { drawShareCard(ctx, opts); } catch (e) { onError('render'); return; }
  wx.canvasToTempFilePath({
    canvas: canvas,
    x: 0, y: 0, width: SHARE_W, height: SHARE_H,
    destWidth: SHARE_W, destHeight: SHARE_H,
    fileType: 'png',
    success: function (res) { onTempPath(res.tempFilePath); },
    fail: function () { onError('export'); },
  });
}

function _saveWithAuth(filePath, onSuccess, onError) {
  wx.saveImageToPhotosAlbum({
    filePath: filePath,
    success: function () { onSuccess(); },
    fail: function (err) {
      var msg = (err && err.errMsg) || '';
      // The system "deny once" returns errMsg with "auth deny" / "auth denied".
      // The user actively cancelling the system save dialog returns "cancel".
      if (msg.indexOf('auth') >= 0) onError('denied');
      else if (msg.indexOf('cancel') >= 0) onError('cancel');
      else onError('save');
    },
  });
}

// Public entry. Callbacks: { onSuccess, onError(reason) }. Reasons:
// 'init' | 'render' | 'export' | 'denied' | 'cancel' | 'save'.
function generateAndSave(opts, callbacks) {
  callbacks = callbacks || {};
  var ok = callbacks.onSuccess || function () {};
  var err = callbacks.onError || function () {};

  _renderToTempFile(opts, function (tempPath) {
    wx.getSetting({
      success: function (res) {
        var auth = res.authSetting && res.authSetting['scope.writePhotosAlbum'];
        if (auth === false) {
          // Already-denied path — push the user to settings instead of
          // calling saveImageToPhotosAlbum (which would silently fail).
          // Both wx.showModal and wx.openSetting are wrapped: rare runtime
          // versions may not implement them and we don't want an
          // uncaught error to surface to the user.
          try {
            wx.showModal({
              title: '需要相册权限',
              content: '保存分享图需要相册权限，请在设置中开启后重试',
              confirmText: '去设置',
              cancelText: '取消',
              success: function (mr) {
                if (!mr.confirm) return;
                try { wx.openSetting({}); } catch (e) {}
              },
            });
          } catch (e) {}
          err('denied');
          return;
        }
        _saveWithAuth(tempPath, ok, err);
      },
      fail: function () { _saveWithAuth(tempPath, ok, err); },
    });
  }, err);
}

module.exports = {
  generateAndSave: generateAndSave,
  // Exported for unit-test friendliness (not used by the game directly).
  _drawShareCard: drawShareCard,
  SHARE_W: SHARE_W,
  SHARE_H: SHARE_H,
};
