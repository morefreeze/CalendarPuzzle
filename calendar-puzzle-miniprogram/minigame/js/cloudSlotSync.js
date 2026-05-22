// Cross-device cloud sync for the 3 named save slots. Local-first.
// mergeOnLogin: pull cloud → newer-wins merge → write back local.
// pushNamedSlot: fire-and-forget per-write upload + retry queue.

var NAMED_PREFIX = 'named-';
var MAX_RETRIES = 3;
var BASE_BACKOFF_MS = 1000;

function _isNamed(slotId) {
  return typeof slotId === 'string' && slotId.indexOf(NAMED_PREFIX) === 0;
}

function _effectiveTs(rec) {
  if (!rec) return 0;
  var s = (typeof rec.savedAt === 'number') ? rec.savedAt : 0;
  var d = (typeof rec.deletedAt === 'number') ? rec.deletedAt : 0;
  return Math.max(s, d);
}

function create(opts) {
  opts = opts || {};
  var store = opts.store;
  if (!store) throw new Error('cloudSlotSync.create: store required');
  var cloudClient = opts.cloudClient;
  if (!cloudClient) throw new Error('cloudSlotSync.create: cloudClient required');
  var now = opts.now || function () { return Date.now(); };
  var scheduleTimeout = opts.scheduleTimeout || setTimeout;
  var cancelTimeout = opts.cancelTimeout || clearTimeout;

  var NAMED_IDS = ['named-1', 'named-2', 'named-3'];

  function _localSlotEnvelope(slotId) {
    var rec = store.readSlot(slotId);
    if (rec) {
      return {
        slotId: slotId,
        payload: rec,
        savedAt: rec.savedAt || 0,
        deletedAt: null,
      };
    }
    return {
      slotId: slotId,
      payload: null,
      savedAt: 0,
      deletedAt: now(),
    };
  }

  function _applyMerged(serverSlot) {
    if (!serverSlot || !_isNamed(serverSlot.slotId)) return;
    var local = store.readSlot(serverSlot.slotId);
    var localTs = local ? (local.savedAt || 0) : 0;
    var srvTs = _effectiveTs(serverSlot);
    if (srvTs > localTs) {
      if (serverSlot.payload) {
        try { store.writeSlot(serverSlot.slotId, serverSlot.payload); } catch (e) {}
      } else {
        try { store.deleteSlot(serverSlot.slotId); } catch (e) {}
      }
    }
  }

  function mergeOnLogin() {
    var clientSlots = [];
    for (var i = 0; i < NAMED_IDS.length; i++) {
      var id = NAMED_IDS[i];
      var local = store.readSlot(id);
      if (local) {
        clientSlots.push({
          slotId: id,
          payload: local,
          savedAt: local.savedAt || 0,
          deletedAt: null,
        });
      }
    }
    return cloudClient.syncSlots(clientSlots).then(function (r) {
      if (r && r.ok && Array.isArray(r.slots)) {
        for (var j = 0; j < r.slots.length; j++) {
          _applyMerged(r.slots[j]);
        }
      }
    }, function () { /* swallow */ });
  }

  function _doPush(envelope, attempt) {
    return cloudClient.syncSlots([envelope]).then(function () {}, function () {
      if (attempt < MAX_RETRIES) {
        var backoff = BASE_BACKOFF_MS * Math.pow(3, attempt);
        scheduleTimeout(function () { _doPush(envelope, attempt + 1); }, backoff);
      }
    });
  }

  function pushNamedSlot(slotId) {
    if (!_isNamed(slotId)) return Promise.resolve();
    var envelope = _localSlotEnvelope(slotId);
    return _doPush(envelope, 0);
  }

  return {
    mergeOnLogin: mergeOnLogin,
    pushNamedSlot: pushNamedSlot,
  };
}

module.exports = { create: create };
