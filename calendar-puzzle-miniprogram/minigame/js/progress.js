// Persistent record of cleared combos, keyed by "<dateStr>:<difficulty>".
// Storage shape: { "2026-05-14:easy": { "3": true, "7": true }, ... }
var STORAGE_KEY = 'calendarPuzzleWonCombos';

function loadAll() {
  try { var r = wx.getStorageSync(STORAGE_KEY); if (r) return JSON.parse(r); } catch (e) {}
  return {};
}

function saveAll(d) {
  try { wx.setStorageSync(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
}

function bucketKey(dateStr, difficulty) {
  return dateStr + ':' + difficulty;
}

function getWonCombos(dateStr, difficulty) {
  if (!dateStr || !difficulty) return {};
  var all = loadAll();
  return all[bucketKey(dateStr, difficulty)] || {};
}

function markWonCombo(dateStr, difficulty, comboIndex) {
  if (!dateStr || !difficulty) return;
  var all = loadAll();
  var k = bucketKey(dateStr, difficulty);
  var m = all[k] || {};
  m[comboIndex] = true;
  all[k] = m;
  saveAll(all);
}

module.exports = {
  getWonCombos: getWonCombos,
  markWonCombo: markWonCombo,
};
