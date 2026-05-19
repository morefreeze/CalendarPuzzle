// WeChat Mini Game entry point
var main = require('./js/main');
var shareState = require('./js/shareState');
var cloudClient = require('./js/cloudClient'); // force-bundle for Plan 2b/c/d

// TEMP smoke test — runs once at startup, logs to console.
// REMOVE this block after Plan 2a verification (see commit log).
(function runCloudSmoke() {
  function log(label, data) { console.log('[SMOKE] ' + label + ':', data); }
  function err(label, e) { console.error('[SMOKE] ' + label + ' FAILED:', e); }
  try {
    cloudClient.init();
    log('init', 'OK');
  } catch (e) { err('init', e); return; }

  cloudClient.login()
    .then(function (r) { log('login', r); return cloudClient.grantHint('weak', 'ad'); })
    .then(function (r) { log('grantHint(weak,ad)', r); return cloudClient.listGrants('smoke-puzzle'); })
    .then(function (r) { log('listGrants before use', r); return cloudClient.useHint('weak', 'smoke-puzzle'); })
    .then(function (r) { log('useHint(weak)', r); return cloudClient.listGrants('smoke-puzzle'); })
    .then(function (r) { log('listGrants after use (expect balance.weak=0, used.weak=1)', r); })
    .catch(function (e) { err('chain', e); });
})();

// Create canvas
var canvas = wx.createCanvas();
var ctx = canvas.getContext('2d');

// Handle DPR for crisp rendering
var sysInfo = wx.getSystemInfoSync();
var dpr = sysInfo.pixelRatio;
canvas.width = sysInfo.windowWidth * dpr;
canvas.height = sysInfo.windowHeight * dpr;
ctx.scale(dpr, dpr);

var W = sysInfo.windowWidth;
var H = sysInfo.windowHeight;

// Safe area for notch screens (iPhone X+, etc.)
var safeArea = sysInfo.safeArea || { top: 0, left: 0, bottom: H, right: W, width: W, height: H };
var safe = {
  top: safeArea.top || 0,
  bottom: H - (safeArea.bottom || H),
  left: safeArea.left || 0,
  right: W - (safeArea.right || W),
};

// Menu button rect (capsule button top-right)
var menuBtn = { top: 0, bottom: 0, left: W, right: W, width: 0, height: 0 };
try {
  var rect = wx.getMenuButtonBoundingClientRect();
  if (rect) menuBtn = rect;
} catch (e) {}

// Set 30fps (enough for a puzzle game)
wx.setPreferredFramesPerSecond(30);

// Read launch options for share deep-linking
var launchQuery = {};
try {
  var launchOpts = wx.getLaunchOptionsSync();
  if (launchOpts && launchOpts.query) launchQuery = launchOpts.query;
} catch (e) {}

// Initialize
main.init(canvas, ctx, W, H, safe, menuBtn, launchQuery);

// Game loop
function loop() {
  main.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Touch events
wx.onTouchStart(function (res) {
  if (res.touches.length > 0) {
    main.onTouchStart(res.touches[0].clientX, res.touches[0].clientY);
  }
});

wx.onTouchMove(function (res) {
  if (res.touches.length > 0) {
    main.onTouchMove(res.touches[0].clientX, res.touches[0].clientY);
  }
});

wx.onTouchEnd(function (res) {
  if (res.changedTouches.length > 0) {
    main.onTouchEnd(res.changedTouches[0].clientX, res.changedTouches[0].clientY);
  }
});

// Mouse wheel (DevTools / PC clients). Mini-game runtime may not expose it.
if (typeof wx.onWheel === 'function') {
  wx.onWheel(function (res) {
    var dy = (res && (res.deltaY || res.dy)) || 0;
    if (dy) main.onWheel(dy);
  });
}

// Share
wx.showShareMenu({
  withShareTicket: true,
  menus: ['shareAppMessage', 'shareTimeline'],
});

wx.onShareAppMessage(function () {
  return shareState.buildShareData();
});

// Moments (朋友圈) share — only fires when the user taps the capsule menu's
// "分享到朋友圈" (mini-games have no programmatic wx.shareTimeline). Without
// this callback the snapshot share carries no query, so receivers land on the
// home page instead of the specific puzzle.
if (typeof wx.onShareTimeline === 'function') {
  wx.onShareTimeline(function () {
    return shareState.buildShareData();
  });
}
