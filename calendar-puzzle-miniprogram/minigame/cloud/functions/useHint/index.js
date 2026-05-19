// Claims an unused hint voucher of given type for the current puzzle.
// Single-action (NOT transactional): under concurrent calls (e.g. double-tap),
// two requests can both pass the cap check and both claim — accepted risk for
// mini-game scale per Plan 2a §race-condition self-review note.
// Enforces per-puzzle cap before claiming. Returns the consumed grant's _id.

var CAPS = { weak: 3, medium: 3, strong: 1 };
var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };

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
  var type = event && event.type;
  var puzzleId = event && event.puzzleId;
  if (!type || !VALID_TYPES[type]) return { ok: false, reason: 'invalid-type' };
  if (!puzzleId) return { ok: false, reason: 'invalid-puzzleId' };

  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var usedCount = await db.collection('hintGrants').where({
    openid: openid, type: type, usedInPuzzle: puzzleId,
  }).count();
  if (usedCount.total >= CAPS[type]) {
    return { ok: false, reason: 'cap-reached' };
  }

  var unused = await db.collection('hintGrants').where({
    openid: openid, type: type, usedAt: null,
  }).limit(1).get();
  if (!unused.data || unused.data.length === 0) {
    return { ok: false, reason: 'no-grant' };
  }

  var grantId = unused.data[0]._id;
  await db.collection('hintGrants').where({ _id: grantId }).update({
    data: { usedAt: db.serverDate(), usedInPuzzle: puzzleId },
  });
  return { ok: true, grantId: grantId };
};
