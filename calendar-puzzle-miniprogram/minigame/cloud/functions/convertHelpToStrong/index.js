// Atomically (best-effort) converts 2 unused (medium, source='help') vouchers
// into 1 strong/help voucher for the caller. Only source='help' vouchers are
// eligible — regular medium/share or stamina-bought medium cannot be burned.
// Returns { ok:false, err:'insufficient-help-credits' } if the caller has fewer
// than 2 unused help vouchers.
// Non-atomic: between marking the 2 source rows used and inserting the new
// strong row, a crash could leave the player short. Acceptable per the same
// best-effort pattern as helpInvite + shareGroup.

var _app;
function _getApp() {
  if (!_app) {
    var tcb = require('@cloudbase/node-sdk');
    _app = tcb.init({ env: tcb.SYMBOL_DEFAULT_ENV });
  }
  return _app;
}

function _extractGrantId(addRes) {
  if (!addRes) return '';
  return addRes._id || addRes.id ||
    (addRes.result && (addRes.result._id || addRes.result.id)) || '';
}

async function _impl(event, cloud) {
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var unused = await db.collection('hintGrants').where({
    openid: openid, type: 'medium', source: 'help', usedAt: null,
  }).limit(2).get();
  if (!unused.data || unused.data.length < 2) {
    return { ok: false, err: 'insufficient-help-credits' };
  }

  // Mark the 2 source rows used with a synthetic 'usedInPuzzle' marker so
  // they don't get re-selected and they're auditable as conversions.
  // @cloudbase/node-sdk update/add take fields at top-level (no `data:` wrapper).
  for (var i = 0; i < 2; i++) {
    await db.collection('hintGrants').where({ _id: unused.data[i]._id }).update({
      usedAt: db.serverDate(),
      usedInPuzzle: '__converted_to_strong',
    });
  }

  var inserted = await db.collection('hintGrants').add({
    openid: openid,
    type: 'strong',
    source: 'help',
    grantedAt: db.serverDate(),
    usedAt: null,
    usedInPuzzle: null,
  });

  return {
    ok: true,
    grantId: _extractGrantId(inserted),
    granted: { type: 'strong', source: 'help' },
  };
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
exports._extractGrantId = _extractGrantId;
