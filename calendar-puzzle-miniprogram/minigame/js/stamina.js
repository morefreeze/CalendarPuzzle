var STORAGE_KEY = 'calendarPuzzleStamina';
var MAX_STAMINA = 120;
var RECOVER_MS = 8 * 60 * 1000;

function load() {
  try { var r = wx.getStorageSync(STORAGE_KEY); if (r) return JSON.parse(r); } catch(e) {}
  return { stamina: MAX_STAMINA, lastUpdateTime: Date.now() };
}

function save(d) {
  try { wx.setStorageSync(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
}

function getStamina() {
  var d = load(), now = Date.now();
  var rec = Math.floor((now - d.lastUpdateTime) / RECOVER_MS);
  var cur = Math.min(d.stamina + rec, MAX_STAMINA);
  if (rec > 0) save({ stamina: cur, lastUpdateTime: d.lastUpdateTime + rec * RECOVER_MS });
  return cur;
}

function getRecoverSeconds() {
  var cur = getStamina();
  if (cur >= MAX_STAMINA) return 0;
  var d = load();
  return Math.max(0, Math.ceil((RECOVER_MS - (Date.now() - d.lastUpdateTime)) / 1000));
}

function consumeStamina(cost) {
  var cur = getStamina();
  if (cur < cost) return false;
  var d = load();
  save({ stamina: cur - cost, lastUpdateTime: d.lastUpdateTime });
  return true;
}

module.exports = {
  getStamina: getStamina,
  getRecoverSeconds: getRecoverSeconds,
  consumeStamina: consumeStamina,
  MAX_STAMINA: MAX_STAMINA,
};
