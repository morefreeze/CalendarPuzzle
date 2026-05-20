// Debounced realtime mirror of in-game state. Crash protection.
// Delegates all IO to slotStore; owns only the timer + pending payload.

var DEFAULT_DEBOUNCE_MS = 1000;
var TEMP_SLOT_ID = 'temp';

function create(opts) {
  opts = opts || {};
  var store = opts.store;
  if (!store) throw new Error('tempSlot.create: store required');
  var debounceMs = (typeof opts.debounceMs === 'number') ? opts.debounceMs : DEFAULT_DEBOUNCE_MS;
  var scheduleTimeout = opts.scheduleTimeout || setTimeout;
  var cancelTimeout = opts.cancelTimeout || clearTimeout;

  var pending = null;
  var timerToken = null;

  function _writeNow(payload) {
    store.writeSlot(TEMP_SLOT_ID, payload);
  }

  function markDirty(payload) {
    pending = payload;
    if (timerToken !== null) return;
    timerToken = scheduleTimeout(function () {
      var toWrite = pending;
      pending = null;
      // Clear token BEFORE writing so a re-entrant markDirty during writeSlot
      // schedules a fresh timer rather than hitting the early-return guard.
      timerToken = null;
      if (toWrite) _writeNow(toWrite);
    }, debounceMs);
  }

  function flush() {
    if (timerToken !== null) { cancelTimeout(timerToken); timerToken = null; }
    if (pending) { _writeNow(pending); pending = null; }
  }

  function clear() {
    if (timerToken !== null) { cancelTimeout(timerToken); timerToken = null; }
    pending = null;
    store.deleteSlot(TEMP_SLOT_ID);
  }

  function hasUnsavedSession() {
    return store.readSlot(TEMP_SLOT_ID) !== null;
  }

  function peekUnsaved() {
    return store.readSlot(TEMP_SLOT_ID);
  }

  return {
    markDirty: markDirty,
    flush: flush,
    clear: clear,
    hasUnsavedSession: hasUnsavedSession,
    peekUnsaved: peekUnsaved,
  };
}

module.exports = { create: create, DEFAULT_DEBOUNCE_MS: DEFAULT_DEBOUNCE_MS, TEMP_SLOT_ID: TEMP_SLOT_ID };
