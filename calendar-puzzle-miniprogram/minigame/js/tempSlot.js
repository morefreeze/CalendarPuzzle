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
  var binding = opts.binding || null;

  var pending = null;
  var timerToken = null;

  function _writeNow(payload) {
    var slotId = (binding && binding.getBound()) || TEMP_SLOT_ID;
    store.writeSlot(slotId, payload);
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

  // flush(opts?):
  //   default — drain pending payload to bound named slot (if any) or TEMP_SLOT_ID.
  //   opts.preferEmptyNamed=true with opts.namedSlotIds — on exit, when the session
  //     is NOT already bound, promote the save (pending payload, OR an existing
  //     temp record if pending is null) into the first empty named slot from the
  //     given list, delete the temp record, and bind to that named slot so any
  //     subsequent in-session writes follow it. If every named slot is occupied,
  //     falls back to the default (write pending to temp). Returns the slotId
  //     it promoted to, or null when no promotion happened.
  function flush(opts) {
    opts = opts || {};
    if (timerToken !== null) { cancelTimeout(timerToken); timerToken = null; }

    if (opts.preferEmptyNamed && !(binding && binding.getBound())) {
      var slotIds = opts.namedSlotIds || [];
      for (var i = 0; i < slotIds.length; i++) {
        if (store.readSlot(slotIds[i]) !== null) continue;
        var payload = pending || store.readSlot(TEMP_SLOT_ID);
        if (!payload) return null;
        pending = null;
        store.writeSlot(slotIds[i], payload);
        store.deleteSlot(TEMP_SLOT_ID);
        if (binding) binding.bind(slotIds[i]);
        return slotIds[i];
      }
    }

    if (pending) { _writeNow(pending); pending = null; }
    return null;
  }

  function clear() {
    if (timerToken !== null) { cancelTimeout(timerToken); timerToken = null; }
    pending = null;
    store.deleteSlot(TEMP_SLOT_ID);
  }

  function cancelPending() {
    if (timerToken !== null) { cancelTimeout(timerToken); timerToken = null; }
    pending = null;
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
    cancelPending: cancelPending,
    hasUnsavedSession: hasUnsavedSession,
    peekUnsaved: peekUnsaved,
  };
}

module.exports = { create: create, DEFAULT_DEBOUNCE_MS: DEFAULT_DEBOUNCE_MS, TEMP_SLOT_ID: TEMP_SLOT_ID };
