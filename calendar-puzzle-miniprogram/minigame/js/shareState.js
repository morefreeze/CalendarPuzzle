// Module-level mutable share state. wx.onShareAppMessage and the in-canvas
// invite button both read from this so the share content always reflects
// what the player is currently looking at. inviterCtx is a one-shot overlay
// used by the "邀请好友助力" flow — caller MUST clear it after the share
// callback fires.

var current = null;
var inviterCtx = null;
// Pre-generated share-card thumbnail (gray, no win modal). gameScene writes
// this on win via wx.canvasToTempFilePath; buildShareData injects it so
// both in-modal share and capsule-menu share use the snapshot instead of
// WeChat's live canvas capture (which would leak the solution colors).
var imageUrl = '';

function setCurrent(s) {
  current = s;
  imageUrl = '';      // new game / new puzzle → stale snapshot
}
function getCurrent() { return current; }

function setImageUrl(u) { imageUrl = u || ''; }
function clearImageUrl() { imageUrl = ''; }

function setInviterContext(ctx) { inviterCtx = ctx; }
function clearInviterContext() { inviterCtx = null; }
function getInviterContext() { return inviterCtx; }

function buildShareData() {
  var base;
  if (!current) {
    base = { title: '日历方块挑战 — 用方块拼出今天', query: '' };
  } else {
    var label = current.difficultyLabel || '';
    var hcSuffix = current.hardcore ? '&hc=1' : '';
    var hcTitle = current.hardcore ? '🔥 硬核 ' : '';
    base = {
      title: hcTitle + '日历方块「' + label + '」挑战 — 来比比谁快！',
      query: 'd=' + current.difficulty + '&c=' + current.comboIndex + '&date=' + current.dateStr + hcSuffix,
    };
  }
  if (inviterCtx) {
    base.title = '帮我助力一次，我送你一张提示券';
    var prefix = base.query ? base.query + '&' : '';
    base.query = prefix + 'inviter=' + inviterCtx.inviter + '&t=' + inviterCtx.t;
  }
  base.imageUrl = imageUrl || '';
  return base;
}

module.exports = {
  setCurrent: setCurrent,
  getCurrent: getCurrent,
  setImageUrl: setImageUrl,
  clearImageUrl: clearImageUrl,
  setInviterContext: setInviterContext,
  clearInviterContext: clearInviterContext,
  getInviterContext: getInviterContext,
  buildShareData: buildShareData,
};
