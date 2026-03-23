// Main game controller — scene management and game loop
var createSelectScene = require('./selectScene');
var createGameScene = require('./gameScene');
var PG = require('./puzzleGenerator');

var ctx, W, H, safeInsets, menuRect;
var currentScene = null;
var staminaRefreshInterval = null;

function init(canvas, context, width, height, safe, menuBtn) {
  ctx = context;
  W = width;
  H = height;
  safeInsets = safe || { top: 0, bottom: 0, left: 0, right: 0 };
  menuRect = menuBtn || { top: 0, bottom: 0, left: W, right: W, width: 0, height: 0 };

  // Start stamina refresh (for the select screen timer)
  staminaRefreshInterval = setInterval(function () {
    if (currentScene) currentScene.dirty = true;
  }, 1000);

  goToSelect();
}

function goToSelect() {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = createSelectScene(safeInsets, menuRect, function (difficulty) {
    startGame(difficulty);
  });
  currentScene.dirty = true;
}

function startGame(difficulty) {
  if (currentScene && currentScene.destroy) currentScene.destroy();
  currentScene = null; // clear while generating

  // Show loading
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u6B63\u5728\u751F\u6210\u8C1C\u9898...', W / 2, H / 2);

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

module.exports = {
  init: init,
  render: render,
  onTouchStart: onTouchStart,
  onTouchMove: onTouchMove,
  onTouchEnd: onTouchEnd,
};
