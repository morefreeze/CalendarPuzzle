// Main game controller — scene management and game loop
var createSelectScene = require('./selectScene');
var createGameScene = require('./gameScene');
var PG = require('./puzzleGenerator');
var shareState = require('./shareState');
var progress = require('./progress');
var cloudClient = require('./cloudClient');
var Voucher = require('./voucher');
var slotsGlobal = require('./slotsGlobal');

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
      slotsGlobal.cloudSlotSync.mergeOnLogin();
      tryConsumeInviterLink(launchQuery);
    }, function () { /* offline — game still playable via stamina */ });
  } catch (e) { /* wx.cloud unavailable — same fallback */ }

  // First-launch tutorial gates everything except the helper-invite flow.
  // Friends-shared puzzle deep-links (d/c/date) get stashed and consumed
  // after the tutorial finishes — onboarding wins, but the share intent is
  // preserved.
  if (!progress.isTutorialDone()) {
    if (isSharedPuzzleQuery(launchQuery)) {
      pendingSharedQuery = launchQuery;
    }
    startTutorial();
    return;
  }
  if (tryLaunchShared(launchQuery)) return;
  goToSelect();
}

// Set during cold-start when a first-launch user arrives via a friend's
// puzzle-share card. Consumed by the tutorial's onBack so the player lands
// on the shared puzzle after onboarding. One-shot — cleared on consume.
var pendingSharedQuery = null;

// In-memory dedup so init + onShow don't double-call helpInvite for the same (inviter,t).
// Cleared on app cold start (module reload); within one session, same link is processed once.
var lastProcessedInvite = null;

function tryConsumeInviterLink(q) {
  if (!q || !q.inviter || !q.t) return;
  var key = q.inviter + '|' + q.t;
  if (lastProcessedInvite === key) return;
  lastProcessedInvite = key;
  cloudClient.helpInvite(q.inviter, q.t).then(function (r) {
    if (r && r.ok) {
      voucher.applyGranted('weak', 'helperGift');
      voucher.reconcile(cloudClient, null);
      GameGlobal.pendingHelperModal = {
        inviterNickname: r.inviterNickname || 'Ta',
        mode: 'fresh',
      };
      // Force-route to selectScene so the modal always renders, regardless of what
      // the user tapped while helpInvite was in-flight (cold-start race: user may
      // have tapped into difficulty → gameScene, which doesn't render this modal).
      goToSelect();
    } else if (r && r.err === 'duplicate') {
      // 第一次冷启动已经 grant 过了；这次只是 surface 反馈给用户。
      // 同样进 selectScene 渲染 modal（带 'duplicate' 文案），保证用户能看到「已经助力」状态。
      GameGlobal.pendingHelperModal = {
        inviterNickname: r.inviterNickname || 'Ta',
        mode: 'duplicate',
      };
      goToSelect();
    } else {
      var errCode = (r && r.err) || 'unknown';
      var msg = ({
        'self-help': '不能给自己助力',
        'bad-token': '链接无效或已过期',
        'invalid-input': '链接信息缺失',
        'server-misconfigured': '助力服务暂不可用',
        'log-failed': '助力失败（网络）',
      })[errCode] || ('助力失败：' + errCode);
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

// Pure validation: does `q` look like a valid puzzle-share deep-link?
// (Helper-invite links carry inviter+t and route through tryConsumeInviterLink
// — those don't count here.)
function isSharedPuzzleQuery(q) {
  if (!q || !q.d || q.c === undefined) return false;
  if (q.inviter && q.t) return false;
  if (!PG.DIFFICULTY_CONFIG[q.d]) return false;
  var ci = parseInt(q.c, 10);
  if (isNaN(ci) || ci < 0) return false;
  return true;
}

function tryLaunchShared(q) {
  if (!isSharedPuzzleQuery(q)) return false;
  var ci = parseInt(q.c, 10);
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
  currentScene = createSelectScene(safeInsets, menuRect, function (difficulty, savedState, modeOpts) {
    startGame(difficulty, savedState, modeOpts);
  }, {
    onReplayTutorial: function () { startTutorial(); },
  });
  currentScene.dirty = true;
}

function startGame(difficulty, savedState, modeOpts) {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = null; // clear while generating

  showLoading();

  setTimeout(function () {
    var puzzle = PG.generatePuzzle(difficulty, {
      date: savedState ? new Date(savedState.date) : new Date(),
      comboIndex: savedState ? savedState.comboIndex : undefined,
    });
    if (!puzzle) {
      goToSelect();
      return;
    }
    launchGameScene(difficulty, puzzle, savedState, modeOpts);
  }, 50);
}

function launchGameScene(difficulty, puzzle, savedState, modeOpts) {
  shareState.setCurrent({
    difficulty: difficulty,
    difficultyLabel: PG.DIFFICULTY_CONFIG[difficulty].label,
    comboIndex: puzzle.currentComboIndex,
    dateStr: puzzle.dateStr,
  });
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = createGameScene(difficulty, puzzle, safeInsets, menuRect, {
    onSwitchPuzzle: function (newPuzzle) {
      launchGameScene(difficulty, newPuzzle, null, currentScene && currentScene.mode ? currentScene.mode : null);
    },
    onBack: function () {
      // Tutorial → shared-puzzle handoff: if a friend's share-card brought a
      // first-time player in, the deep-link was stashed and consumed here.
      if (pendingSharedQuery) {
        var q = pendingSharedQuery;
        pendingSharedQuery = null;
        if (tryLaunchShared(q)) return;
      }
      goToSelect();
    },
  }, savedState, modeOpts);
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

// Called when the mini-game returns to foreground (warm relaunch from a share card,
// switching back from another app, etc.). game.js wires wx.onShow → main.onShow.
function onShow(query) {
  // Refresh voucher cache so footer / popup counts reflect any cloud-side changes
  // that happened while we were backgrounded (e.g. a friend just clicked our invite).
  if (cloudClient.getOpenid && cloudClient.getOpenid()) {
    voucher.reconcile(cloudClient, null);
  }
  // If the user just tapped a fresh invite share card, the new query is here.
  // tryConsumeInviterLink dedups internally so back-to-back init+onShow with the
  // same (inviter,t) only call helpInvite once.
  tryConsumeInviterLink(query || {});
}

// Floating-window (悬浮窗) and background-hide lifecycle: flush pending temp-slot
// write so the most recent state lands in whichever slot is active (temp or bound).
// This protects against force-kill while the game is in the floating window or
// otherwise backgrounded. Does NOT promote temp → named (that's only via explicit
// 💾 button or 继续游戏 grid load).
if (typeof wx !== 'undefined' && wx.onHide) {
  wx.onHide(function () {
    try {
      // Let the active scene re-snapshot first so the saved elapsedMs
      // reflects the live timer (idle ticks aren't covered by markDirty).
      if (currentScene && currentScene.onHide) currentScene.onHide();
      slotsGlobal.tempSlot.flush();
      var bound = slotsGlobal.slotBinding.getBound();
      if (bound) slotsGlobal.cloudSlotSync.pushNamedSlot(bound);
    } catch (e) { /* swallow */ }
  });
}

if (typeof wx !== 'undefined' && wx.onShow) {
  wx.onShow(function () {
    try { slotsGlobal.cloudSlotSync.mergeOnLogin(); } catch (e) {}
  });
}

module.exports = {
  init: init,
  render: render,
  onShow: onShow,
  onTouchStart: onTouchStart,
  onTouchMove: onTouchMove,
  onTouchEnd: onTouchEnd,
  onWheel: onWheel,
};
