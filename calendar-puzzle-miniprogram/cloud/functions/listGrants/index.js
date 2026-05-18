// Returns per-tier balance (unused voucher count) and per-puzzle used count.
// puzzleId is optional; if omitted, used counts are all 0.

var TYPES = ['weak', 'medium', 'strong'];

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  }
  var puzzleId = event && event.puzzleId;
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var balance = { weak: 0, medium: 0, strong: 0 };
  var used = { weak: 0, medium: 0, strong: 0 };

  for (var i = 0; i < TYPES.length; i++) {
    var t = TYPES[i];
    var b = await db.collection('hintGrants').where({
      openid: openid, type: t, usedAt: null,
    }).count();
    balance[t] = b.total;

    if (puzzleId) {
      var u = await db.collection('hintGrants').where({
        openid: openid, type: t, usedInPuzzle: puzzleId,
      }).count();
      used[t] = u.total;
    }
  }

  return { ok: true, balance: balance, used: used };
};
