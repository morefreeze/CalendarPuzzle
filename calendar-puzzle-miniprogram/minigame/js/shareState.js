// Module-level mutable share state. wx.onShareAppMessage and the
// in-canvas invite button both read from this so the share content
// always reflects the puzzle the player is currently looking at.

var current = null;

function setCurrent(s) {
  current = s;
}

function getCurrent() {
  return current;
}

function buildShareData() {
  if (!current) {
    return {
      title: '日历方块挑战 — 用方块拼出今天',
      query: '',
      imageUrl: '',
    };
  }
  var label = current.difficultyLabel || '';
  return {
    title: '日历方块「' + label + '」挑战 — 来比比谁快！',
    query: 'd=' + current.difficulty + '&c=' + current.comboIndex + '&date=' + current.dateStr,
    imageUrl: '',
  };
}

module.exports = {
  setCurrent: setCurrent,
  getCurrent: getCurrent,
  buildShareData: buildShareData,
};
