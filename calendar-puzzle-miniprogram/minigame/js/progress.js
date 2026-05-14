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

// Count completed combos across all difficulties for a date.
function countCompletedForDate(dateStr) {
  if (!dateStr) return 0;
  var all = loadAll();
  var sum = 0;
  for (var k in all) {
    if (k.indexOf(dateStr + ':') === 0) {
      var bucket = all[k] || {};
      for (var ci in bucket) if (bucket[ci]) sum++;
    }
  }
  return sum;
}

// Best (lowest) completion time tracking, per (date, difficulty).
var PB_KEY = 'calendarPuzzlePB';

function loadPBs() {
  try { var r = wx.getStorageSync(PB_KEY); if (r) return JSON.parse(r); } catch (e) {}
  return {};
}

function savePBs(d) {
  try { wx.setStorageSync(PB_KEY, JSON.stringify(d)); } catch (e) {}
}

function getBestTime(dateStr, difficulty) {
  if (!dateStr || !difficulty) return null;
  var all = loadPBs();
  var v = all[bucketKey(dateStr, difficulty)];
  return typeof v === 'number' ? v : null;
}

// Returns { isNew: bool, prev: number|null, current: number } for the win-summary card.
function recordTime(dateStr, difficulty, seconds) {
  if (!dateStr || !difficulty) return { isNew: false, prev: null, current: seconds };
  var all = loadPBs();
  var k = bucketKey(dateStr, difficulty);
  var prev = typeof all[k] === 'number' ? all[k] : null;
  var isNew = prev == null || seconds < prev;
  if (isNew) {
    all[k] = seconds;
    savePBs(all);
  }
  return { isNew: isNew, prev: prev, current: seconds };
}

// First-launch onboarding completion flag.
var TUTORIAL_KEY = 'calendarPuzzleTutorialDone';

function isTutorialDone() {
  try { return wx.getStorageSync(TUTORIAL_KEY) === '1'; } catch (e) { return false; }
}

function markTutorialDone() {
  try { wx.setStorageSync(TUTORIAL_KEY, '1'); } catch (e) {}
}

module.exports = {
  getWonCombos: getWonCombos,
  markWonCombo: markWonCombo,
  countCompletedForDate: countCompletedForDate,
  getBestTime: getBestTime,
  recordTime: recordTime,
  isTutorialDone: isTutorialDone,
  markTutorialDone: markTutorialDone,
};
