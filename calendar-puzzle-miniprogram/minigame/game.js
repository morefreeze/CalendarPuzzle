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

// Set 30fps (enough for a puzzle game)
wx.setPreferredFramesPerSecond(30);

// Initialize
main.init(canvas, ctx, W, H);

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
