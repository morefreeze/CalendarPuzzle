// Main game controller — scene management and game loop
var createSelectScene = require('./selectScene');
var createGameScene = require('./gameScene');
var PG = require('./puzzleGenerator');
var shareState = require('./shareState');
var progress = require('./progress');
var cloudClient = require('./cloudClient');
var Voucher = require('./voucher');

var ctx, W, H, safeInsets, menuRect;
var currentScene = null;
var staminaRefreshInterval = null;

// Voucher singleton — shared across scenes via GameGlobal.
// wx.* may be undefined in unit tests (this module isn't required from node tests).
var wxStorage = {
  getItem: function (k) { return wx.getStorageSync(k) || null; },
  setItem: function (k, v) { wx.setStorageSync(k, v); },
  removeItem: function (k) { wx.removeStorageSync(k); },
};
var voucher = Voucher.create({ storage: wxStorage });
GameGlobal.voucher = voucher;
GameGlobal.cloudClient = cloudClient;
GameGlobal.pendingHelperModal = null;  // populated by tryConsumeInviterLink

function init(canvas, context, width, height, safe, menuBtn, launchQuery) {
  ctx = context;
  W = width;
  H = height;
  safeInsets = safe || { top: 0, bottom: 0, left: 0, right: 0 };
  menuRect = menuBtn || { top: 0, bottom: 0, left: W, right: W, width: 0, height: 0 };

  // Start stamina refresh (for the select screen timer)
  staminaRefreshInterval = setInterval(function () {
    if (currentScene) currentScene.dirty = true;
  }, 1000);

  // Cloud bootstrap — fire-and-forget. If wx.cloud is unavailable or login
  // fails, the game stays fully playable via the stamina path.
  try {
    cloudClient.login().then(function (r) {
      if (!(r && r.ok)) return;
      voucher.setOpenid(r.openid);
      voucher.flushPendingUse(cloudClient).then(function () {
        return voucher.reconcile(cloudClient, null);
      });
      tryConsumeInviterLink(launchQuery);
    }, function () { /* offline — game still playable via stamina */ });
  } catch (e) { /* wx.cloud unavailable — same fallback */ }

  if (tryLaunchShared(launchQuery)) return;
  // First-launch tutorial — unless the user already completed (or skipped) it.
  if (!progress.isTutorialDone()) {
    startTutorial();
    return;
  }
  goToSelect();
}

function tryConsumeInviterLink(q) {
  if (!q || !q.inviter || !q.t) return;
  cloudClient.helpInvite(q.inviter, q.t).then(function (r) {
    if (r && r.ok) {
      voucher.applyGranted('weak', 'helperGift');
      voucher.reconcile(cloudClient, null);
      GameGlobal.pendingHelperModal = { inviterNickname: r.inviterNickname || 'Ta' };
      if (currentScene) currentScene.dirty = true;
    } else {
      var msg = ({
        'self-help': '不能给自己助力',
        'duplicate': '今天已经为他助力过啦',
        'bad-token': '链接无效',
      })[r && r.err] || '助力失败';
      if (typeof wx !== 'undefined' && wx.showToast) {
        wx.showToast({ title: msg, icon: 'none', duration: 2000 });
      }
    }
  }, function () { /* network */ });
}

function startTutorial() {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = null;
  showLoading();
  setTimeout(function () {
    var puz = PG.generateTutorialPuzzle();
    if (!puz) {
      progress.markTutorialDone();
      goToSelect();
      return;
    }
    launchGameScene('easy', puz);
  }, 50);
}

function tryLaunchShared(q) {
  if (!q || !q.d || q.c === undefined) return false;
  // Helper-flow takes priority over puzzle-deep-link: if the link also carries
  // inviter+t, this is an invite share — route the helper through selectScene
  // so they see the "助力成功" modal (set by tryConsumeInviterLink).
  if (q.inviter && q.t) return false;
  if (!PG.DIFFICULTY_CONFIG[q.d]) return false;
  var ci = parseInt(q.c, 10);
  if (isNaN(ci) || ci < 0) return false;
  var date = PG.parseDateStr(q.date) || new Date();
  showLoading();
  setTimeout(function () {
    var puzzle = PG.generatePuzzle(q.d, { comboIndex: ci, date: date });
    if (!puzzle) {
      goToSelect();
      return;
    }
    launchGameScene(q.d, puzzle);
  }, 50);
  return true;
}

function showLoading() {
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('正在生成谜题...', W / 2, H / 2);
}

function goToSelect() {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = createSelectScene(safeInsets, menuRect, function (difficulty) {
    startGame(difficulty);
  }, {
    onReplayTutorial: function () { startTutorial(); },
  });
  currentScene.dirty = true;
}

function startGame(difficulty) {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = null; // clear while generating

  showLoading();

  setTimeout(function () {
    var puzzle = PG.generatePuzzle(difficulty);
    if (!puzzle) {
      goToSelect();
      return;
    }
    launchGameScene(difficulty, puzzle);
  }, 50);
}

function launchGameScene(difficulty, puzzle) {
  shareState.setCurrent({
    difficulty: difficulty,
    difficultyLabel: PG.DIFFICULTY_CONFIG[difficulty].label,
    comboIndex: puzzle.currentComboIndex,
    dateStr: puzzle.dateStr,
  });
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = createGameScene(difficulty, puzzle, safeInsets, menuRect, {
    onSwitchPuzzle: function (newPuzzle) {
      launchGameScene(difficulty, newPuzzle);
    },
    onBack: function () {
      goToSelect();
    },
  });
  currentScene.dirty = true;
}

function render() {
  if (currentScene && currentScene.dirty) {
    currentScene.render(ctx, W, H);
    currentScene.dirty = false;
  }
}

function onTouchStart(x, y) {
  if (currentScene) currentScene.onTouchStart(x, y);
}

function onTouchMove(x, y) {
  if (currentScene) currentScene.onTouchMove(x, y);
}

function onTouchEnd(x, y) {
  if (currentScene) currentScene.onTouchEnd(x, y);
}

function onWheel(dy) {
  if (currentScene && currentScene.onWheel) currentScene.onWheel(dy);
}

module.exports = {
  init: init,
  render: render,
  onTouchStart: onTouchStart,
  onTouchMove: onTouchMove,
  onTouchEnd: onTouchEnd,
  onWheel: onWheel,
};
