// Main game controller — scene management and game loop
var createSelectScene = require('./selectScene');
var createGameScene = require('./gameScene');
var PG = require('./puzzleGenerator');
var shareState = require('./shareState');

var ctx, W, H, safeInsets, menuRect;
var currentScene = null;
var staminaRefreshInterval = null;

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

  if (tryLaunchShared(launchQuery)) return;
  goToSelect();
}

function tryLaunchShared(q) {
  if (!q || !q.d || q.c === undefined) return false;
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
