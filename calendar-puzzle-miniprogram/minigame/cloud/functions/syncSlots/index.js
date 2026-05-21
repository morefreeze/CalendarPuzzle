// Single-RPC slot sync. Newer-wins by max(savedAt, deletedAt).
// Per-user isolation via openid. Only 'named-N' slots are persisted;
// 'temp' is local-only and silently dropped from input.

var _app;
function _getApp() {
  if (!_app) {
    var tcb = require('@cloudbase/node-sdk');
    _app = tcb.init({ env: tcb.SYMBOL_DEFAULT_ENV });
  }
  return _app;
}

var NAMED_PREFIX = 'named-';

function _isNamedSlot(slotId) {
  return typeof slotId === 'string' && slotId.indexOf(NAMED_PREFIX) === 0;
}

function _effectiveTs(rec) {
  if (!rec) return 0;
  var s = (typeof rec.savedAt === 'number') ? rec.savedAt : 0;
  var d = (typeof rec.deletedAt === 'number') ? rec.deletedAt : 0;
  return Math.max(s, d);
}

async function _impl(event, cloud) {
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, error: 'no-openid' };

  var clientSlots = (event && Array.isArray(event.slots)) ? event.slots : [];
  var validClient = clientSlots.filter(function (s) { return s && _isNamedSlot(s.slotId); });

  var srvRes = await db.collection('saveSlots').where({ openid: openid }).get();
  var serverDocs = srvRes.data || [];

  var srvBySlot = {};
  for (var i = 0; i < serverDocs.length; i++) {
    srvBySlot[serverDocs[i].slotId] = serverDocs[i];
  }

  var allSlotIds = {};
  for (var j = 0; j < validClient.length; j++) allSlotIds[validClient[j].slotId] = true;
  for (var k = 0; k < serverDocs.length; k++) allSlotIds[serverDocs[k].slotId] = true;

  var clientBySlot = {};
  for (var l = 0; l < validClient.length; l++) clientBySlot[validClient[l].slotId] = validClient[l];

  var merged = [];
  var writes = [];

  for (var slotId in allSlotIds) {
    var c = clientBySlot[slotId] || null;
    var s = srvBySlot[slotId] || null;
    var cTs = _effectiveTs(c);
    var sTs = _effectiveTs(s);

    if (cTs > sTs) {
      var newDoc = {
        openid: openid,
        slotId: slotId,
        payload: c.payload || null,
        savedAt: (typeof c.savedAt === 'number') ? c.savedAt : 0,
        deletedAt: (typeof c.deletedAt === 'number') ? c.deletedAt : null,
      };
      if (s && s._id) {
        writes.push(db.collection('saveSlots').where({ _id: s._id }).update(newDoc));
      } else {
        writes.push(db.collection('saveSlots').add(newDoc));
      }
      merged.push({
        slotId: slotId,
        payload: newDoc.payload,
        savedAt: newDoc.savedAt,
        deletedAt: newDoc.deletedAt,
      });
    } else if (sTs > cTs) {
      merged.push({
        slotId: slotId,
        payload: s.payload || null,
        savedAt: s.savedAt || 0,
        deletedAt: s.deletedAt || null,
      });
    } else if (sTs === cTs && cTs > 0) {
      merged.push({
        slotId: slotId,
        payload: s ? s.payload : null,
        savedAt: s ? s.savedAt : 0,
        deletedAt: s ? s.deletedAt : null,
      });
    }
    // Both zero: nothing to merge, skip
  }

  await Promise.all(writes);
  return { ok: true, slots: merged };
}

function makeCloud(event) {
  var ui = (event && event.userInfo) || {};
  var app = _getApp();
  return {
    database: function () { return app.database(); },
    serverDate: function () { return app.database().serverDate(); },
    getWXContext: function () {
      return {
        OPENID: ui.openId || ui.OPENID || '',
        APPID: ui.appId || ui.APPID || '',
      };
    },
  };
}

exports.main = async function (event, context) {
  return _impl(event, makeCloud(event));
};
exports._impl = _impl;
