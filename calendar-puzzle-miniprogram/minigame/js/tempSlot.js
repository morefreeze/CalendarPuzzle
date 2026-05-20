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
      timerToken = null;
      if (toWrite) _writeNow(toWrite);
    }, debounceMs);
  }

  return {
    markDirty: markDirty,
  };
}

module.exports = { create: create, DEFAULT_DEBOUNCE_MS: DEFAULT_DEBOUNCE_MS, TEMP_SLOT_ID: TEMP_SLOT_ID };
