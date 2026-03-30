// WeChat Mini Game entry point
var main = require('./js/main');

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

// Initialize
main.init(canvas, ctx, W, H, safe, menuBtn);

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
