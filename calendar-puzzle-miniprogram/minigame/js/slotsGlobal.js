// Shared singletons for the save-slots feature. Each scene imports from here
// so they all read/write the same storage-backed instance.

var slotStore = require('./slotStore');
var tempSlot = require('./tempSlot');
var slotBinding = require('./slotBinding');

var _storage = {
  getItem: function (k) {
    try { return wx.getStorageSync(k) || null; } catch (e) { return null; }
  },
  setItem: function (k, v) {
    try { wx.setStorageSync(k, v); } catch (e) { /* swallow */ }
  },
  removeItem: function (k) {
    try { wx.removeStorageSync(k); } catch (e) { /* swallow */ }
  },
};

var _slotStore = slotStore.create({ storage: _storage });
var _slotBinding = slotBinding.create();
var _tempSlot = tempSlot.create({ store: _slotStore, binding: _slotBinding });

module.exports = {
  slotStore: _slotStore,
  tempSlot: _tempSlot,
  slotBinding: _slotBinding,
};
