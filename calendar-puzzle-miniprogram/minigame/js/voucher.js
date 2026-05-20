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

  // displayBalance returns state.balance directly. balance is **eagerly** decremented
  // by applyUsed and **eagerly** incremented by applyGranted — UI sees the change
  // immediately. pendingUse is the retry queue (for offline) and a marker for
  // reconcile to know how many uses cloud hasn't seen yet (so reconcile can
  // subtract them from cloud truth without double-counting).
  function displayBalance(type) {
    return state.balance[type];
  }

  function canUseSocial(type) {
    return displayBalance(type) > 0;
  }

  function applyGranted(type, source) {
    state.balance[type] = state.balance[type] + 1;
    _write(storage, state);
  }

  function applyUsed(type, source, puzzleId) {
    // Eager local-first decrement — UI 立刻反映用券.
    state.balance[type] = state.balance[type] - 1;
    // helpMediumBalance heuristic: if non-help mediums exhausted, the consumed
    // voucher is (likely) a help-medium → decrement helpMediumBalance too.
    // Cloud may pick a different row; reconcile corrects any drift later.
    var consumedHelpMedium = false;
    if (type === 'medium') {
      var nonHelpAfter = state.balance.medium - state.helpMediumBalance;
      if (nonHelpAfter < 0) {
        state.helpMediumBalance = state.helpMediumBalance - 1;
        consumedHelpMedium = true;
      }
    }
    state.pendingUse.push({
      type: type, source: source, puzzleId: puzzleId, ts: Date.now(),
      consumedHelpMedium: consumedHelpMedium,
    });
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

  function _rollback(item) {
    // 业务错误回滚：把 applyUsed 时 eager 减掉的余额加回来。
    state.balance[item.type] = state.balance[item.type] + 1;
    if (item.consumedHelpMedium) {
      state.helpMediumBalance = state.helpMediumBalance + 1;
    }
    _write(storage, state);
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
          // 云端 confirm，balance 在 applyUsed 时已经扣过，只需要出队
          _removeFromQueue(item);
        } else {
          // 云端拒绝（业务错误，e.g. no-grant / cap-reached）→ 回滚 eager 扣减
          _rollback(item);
          _removeFromQueue(item);
        }
        return step();
      }, function () {
        // 网络错误 — 保留 pendingUse，下次 boot 再 flush
        return Promise.resolve();
      });
    }
    return step();
  }

  // Inline counterpart for the in-session useHint call: locate and finalize
  // the matching pendingUse entry. ok=true → just out-queue; ok=false → rollback.
  function confirmUseSynced(type, source, puzzleId, ok) {
    for (var i = 0; i < state.pendingUse.length; i++) {
      var p = state.pendingUse[i];
      if (p.type === type && p.source === source && p.puzzleId === puzzleId) {
        if (!ok) _rollback(p);
        state.pendingUse.splice(i, 1);
        _write(storage, state);
        return true;
      }
    }
    return false;
  }

  function reconcile(client, puzzleId) {
    if (!client || !client.listGrants) return Promise.resolve();
    return client.listGrants(puzzleId).then(function (r) {
      if (!r || !r.ok) return;
      if (r.balance) {
        // 云端返回的是 "服务器侧未用券数"。本地 pendingUse 还没让云端 ack，
        // 所以从云端值再减一次本地 pending，得到本地真实余额。
        var pw = _pendingCount('weak');
        var pm = _pendingCount('medium');
        var ps = _pendingCount('strong');
        state.balance = {
          weak: (r.balance.weak || 0) - pw,
          medium: (r.balance.medium || 0) - pm,
          strong: (r.balance.strong || 0) - ps,
        };
        state.fetchedAt = Date.now();
        _write(storage, state);
      }
      if (typeof r.helpMediumBalance === 'number') {
        // 同理：从云端值减去 pending 中标记为 consumedHelpMedium 的条目。
        var pendHelpMed = 0;
        for (var i = 0; i < state.pendingUse.length; i++) {
          if (state.pendingUse[i].consumedHelpMedium) pendHelpMed++;
        }
        setHelpMediumBalance((r.helpMediumBalance || 0) - pendHelpMed);
      }
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
    confirmUseSynced: confirmUseSynced,
    reconcile: reconcile,
    getOpenid: getOpenid,
    setOpenid: setOpenid,
  };
}

module.exports = { create: create, STORAGE_KEY: STORAGE_KEY };
