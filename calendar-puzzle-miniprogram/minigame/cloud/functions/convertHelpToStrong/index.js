// Atomically (best-effort) converts 2 unused (medium, source='help') vouchers
// into 1 strong/help voucher for the caller. Only source='help' vouchers are
// eligible — regular medium/share or stamina-bought medium cannot be burned.
// Returns { ok:false, err:'insufficient-help-credits' } if the caller has fewer
// than 2 unused help vouchers.
// Non-atomic: between marking the 2 source rows used and inserting the new
// strong row, a crash could leave the player short. Acceptable per the same
// best-effort pattern as helpInvite + shareGroup.

function makeHybridCloud() {
  var wxSdk = require('wx-server-sdk');
  var tcb = require('@cloudbase/node-sdk');
  wxSdk.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  var app = tcb.init({ env: tcb.SYMBOL_DEFAULT_ENV });
  return {
    database: function () { return app.database(); },
    serverDate: function () { return app.database().serverDate(); },
    getWXContext: function () { return wxSdk.getWXContext(); },
    getOpenData: function (opts) { return wxSdk.getOpenData(opts); },
  };
}

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride || makeHybridCloud();
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
  for (var i = 0; i < 2; i++) {
    await db.collection('hintGrants').where({ _id: unused.data[i]._id }).update({
      data: { usedAt: db.serverDate(), usedInPuzzle: '__converted_to_strong' },
    });
  }

  var inserted = await db.collection('hintGrants').add({
    data: {
      openid: openid,
      type: 'strong',
      source: 'help',
      grantedAt: db.serverDate(),
      usedAt: null,
      usedInPuzzle: null,
    },
  });

  return { ok: true, grantId: inserted._id, granted: { type: 'strong', source: 'help' } };
};
