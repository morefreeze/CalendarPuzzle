// Voucher cache + pending-use queue. Local-first; reconciled with cloud listGrants.
// Pure JS, no wx.* — production injects wx.getStorageSync wrapper, tests inject in-memory.

var STORAGE_KEY = 'voucherCache';
var TYPES = ['weak', 'medium', 'strong'];

function emptyState() {
  return {
    openid: null,
    fetchedAt: 0,
    balance: { weak: 0, medium: 0, strong: 0 },
    // Subset of unused medium vouchers that came from 助力 — convertible to
    // strong via convertHelpToStrong. Always ≤ balance.medium.
    helpMediumBalance: 0,
    // Last-7-day helpLog entries where I am inviter. Used to show "好友已助力 N 位".
    recentHelps: [],
    pendingUse: [],
    // pendingGrant reserved for offline grant retry (plan 2b ads path) — not used yet.
    pendingGrant: [],
  };
}

function _read(storage) {
  try {
    var raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    var parsed = JSON.parse(raw);
    var base = emptyState();
    for (var k in parsed) base[k] = parsed[k];
    // Deep-defend balance: parsed may be from an older schema missing keys.
    if (parsed.balance) {
      base.balance = {
        weak: parsed.balance.weak || 0,
        medium: parsed.balance.medium || 0,
        strong: parsed.balance.strong || 0,
      };
    }
    return base;
  } catch (e) {
    return emptyState();
  }
}

function _write(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function create(opts) {
  opts = opts || {};
  var storage = opts.storage;
  if (!storage) throw new Error('voucher.create: storage required');
  var state = _read(storage);

  function getBalance() {
    return { weak: state.balance.weak, medium: state.balance.medium, strong: state.balance.strong };
  }

  function getPendingUse() {
    return state.pendingUse.slice();
  }

  function _pendingCount(type) {
    var n = 0;
    for (var i = 0; i < state.pendingUse.length; i++) {
      if (state.pendingUse[i].type === type) n++;
    }
    return n;
  }

  function displayBalance(type) {
    return state.balance[type] - _pendingCount(type);
  }

  function canUseSocial(type) {
    return displayBalance(type) > 0;
  }

  function applyGranted(type, source) {
    state.balance[type] = state.balance[type] + 1;
    _write(storage, state);
  }

  function applyUsed(type, source, puzzleId) {
    state.pendingUse.push({ type: type, source: source, puzzleId: puzzleId, ts: Date.now() });
    _write(storage, state);
  }

  function setBalance(b) {
    state.balance = { weak: b.weak || 0, medium: b.medium || 0, strong: b.strong || 0 };
    state.fetchedAt = Date.now();
    _write(storage, state);
  }

  function setHelpMediumBalance(n) {
    state.helpMediumBalance = n || 0;
    _write(storage, state);
  }

  function getHelpMediumBalance() {
    return state.helpMediumBalance || 0;
  }

  function setRecentHelps(arr) {
    state.recentHelps = Array.isArray(arr) ? arr.slice() : [];
    _write(storage, state);
  }

  function getRecentHelps() {
    return (state.recentHelps || []).slice();
  }

  // Count of helps where I am inviter, today (local calendar date).
  function getHelpsTodayCount() {
    var d = new Date();
    var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    var startOfDay = new Date(y, m, day).getTime();
    var endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    var n = 0;
    var arr = state.recentHelps || [];
    for (var i = 0; i < arr.length; i++) {
      if (typeof arr[i].ts === 'number' && arr[i].ts >= startOfDay && arr[i].ts < endOfDay) n++;
    }
    return n;
  }

  function _removeFromQueue(item) {
    for (var i = 0; i < state.pendingUse.length; i++) {
      var p = state.pendingUse[i];
      if (p.type === item.type && p.puzzleId === item.puzzleId && p.ts === item.ts) {
        state.pendingUse.splice(i, 1);
        _write(storage, state);
        return;
      }
    }
  }

  function flushPendingUse(client) {
    if (!client || !client.useHint) return Promise.resolve();
    var queue = state.pendingUse.slice();
    if (queue.length === 0) return Promise.resolve();
    var idx = 0;
    function step() {
      if (idx >= queue.length) return Promise.resolve();
      var item = queue[idx++];
      return client.useHint(item.type, item.puzzleId).then(function (r) {
        if (r && r.ok) {
          _removeFromQueue(item);
        } else {
          // business error — remove from queue, do NOT touch balance
          _removeFromQueue(item);
        }
        return step();
      }, function () {
        // network error — leave in queue, stop iterating (avoid retry storm)
        return Promise.resolve();
      });
    }
    return step();
  }

  function reconcile(client, puzzleId) {
    if (!client || !client.listGrants) return Promise.resolve();
    return client.listGrants(puzzleId).then(function (r) {
      if (!r || !r.ok) return;
      if (r.balance) setBalance(r.balance);
      if (typeof r.helpMediumBalance === 'number') setHelpMediumBalance(r.helpMediumBalance);
      if (Array.isArray(r.recentHelps)) setRecentHelps(r.recentHelps);
    }, function () { /* ignore */ });
  }

  function getOpenid() { return state.openid; }
  function setOpenid(oid) { state.openid = oid; _write(storage, state); }

  return {
    getBalance: getBalance,
    getPendingUse: getPendingUse,
    displayBalance: displayBalance,
    canUseSocial: canUseSocial,
    applyGranted: applyGranted,
    applyUsed: applyUsed,
    setBalance: setBalance,
    setHelpMediumBalance: setHelpMediumBalance,
    getHelpMediumBalance: getHelpMediumBalance,
    setRecentHelps: setRecentHelps,
    getRecentHelps: getRecentHelps,
    getHelpsTodayCount: getHelpsTodayCount,
    flushPendingUse: flushPendingUse,
    reconcile: reconcile,
    getOpenid: getOpenid,
    setOpenid: setOpenid,
  };
}

module.exports = { create: create, STORAGE_KEY: STORAGE_KEY };
