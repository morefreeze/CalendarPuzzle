// Local storage CRUD for save slots. Pure JS, no wx.* — production injects
// a wx.setStorageSync wrapper, tests inject in-memory fakeStorage().
//
// One slot per storage key (corruption isolation): 'cps:slot:<slotId>'.
// slotId is 'named-1' | 'named-2' | 'named-3' | 'temp'.

var STORAGE_KEY_PREFIX = 'cps:slot:';
var DEV_MAX_SLOTS_KEY = 'cps:devMaxSlots';
var SCHEMA_VERSION = 1;
var NAMED_SLOT_IDS = ['named-1', 'named-2', 'named-3'];
var TEMP_SLOT_ID = 'temp';

function _key(slotId) { return STORAGE_KEY_PREFIX + slotId; }

function create(opts) {
  opts = opts || {};
  var storage = opts.storage;
  if (!storage) throw new Error('slotStore.create: storage required');
  var now = opts.now || function () { return Date.now(); };

  function migrateIfNeeded(rawSlot) {
    if (!rawSlot || typeof rawSlot !== 'object') return null;
    if (typeof rawSlot.schemaVersion !== 'number') return null;
    if (rawSlot.schemaVersion > SCHEMA_VERSION) return null;
    if (rawSlot.schemaVersion < SCHEMA_VERSION) {
      // v1 is current — no older schemas to upgrade from yet.
      // Future schema bumps add a branch per old version here.
      return null;
    }
    return rawSlot;
  }

  function readSlot(slotId) {
    try {
      var raw = storage.getItem(_key(slotId));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return migrateIfNeeded(parsed);
    } catch (e) {
      return null;
    }
  }

  function writeSlot(slotId, payload) {
    if (!payload) return;
    var record = {};
    for (var k in payload) record[k] = payload[k];
    record.schemaVersion = SCHEMA_VERSION;
    record.slotId = slotId;
    record.savedAt = now();
    try { storage.setItem(_key(slotId), JSON.stringify(record)); } catch (e) { /* swallow */ }
  }

  function readAllNamed() {
    var out = [];
    for (var i = 0; i < NAMED_SLOT_IDS.length; i++) {
      out.push(readSlot(NAMED_SLOT_IDS[i]));
    }
    return out;
  }

  function deleteSlot(slotId) {
    try { storage.removeItem(_key(slotId)); } catch (e) { /* swallow */ }
  }

  function getMaxNamedSlots() {
    try {
      var raw = storage.getItem(DEV_MAX_SLOTS_KEY);
      if (raw) {
        var n = parseInt(raw, 10);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (e) { /* swallow */ }
    return 3;
  }

  return {
    readSlot: readSlot,
    readAllNamed: readAllNamed,
    writeSlot: writeSlot,
    deleteSlot: deleteSlot,
    getMaxNamedSlots: getMaxNamedSlots,
    migrateIfNeeded: migrateIfNeeded,
  };
}

module.exports = {
  create: create,
  STORAGE_KEY_PREFIX: STORAGE_KEY_PREFIX,
  DEV_MAX_SLOTS_KEY: DEV_MAX_SLOTS_KEY,
  SCHEMA_VERSION: SCHEMA_VERSION,
  NAMED_SLOT_IDS: NAMED_SLOT_IDS,
  TEMP_SLOT_ID: TEMP_SLOT_ID,
};
