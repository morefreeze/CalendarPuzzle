// Returns per-tier balance (unused voucher count) and per-puzzle used count.
// puzzleId is optional; if omitted, used counts are all 0.

var TYPES = ['weak', 'medium', 'strong'];

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  }
  var puzzleId = event && event.puzzleId;
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var balance = { weak: 0, medium: 0, strong: 0 };
  var used = { weak: 0, medium: 0, strong: 0 };

  var promises = [];
  for (var i = 0; i < TYPES.length; i++) {
    (function (tt) {
      promises.push(
        db.collection('hintGrants').where({ openid: openid, type: tt, usedAt: null }).count()
          .then(function (r) { balance[tt] = r.total; })
      );
      if (puzzleId) {
        promises.push(
          db.collection('hintGrants').where({ openid: openid, type: tt, usedInPuzzle: puzzleId }).count()
            .then(function (r) { used[tt] = r.total; })
        );
      }
    })(TYPES[i]);
  }
  await Promise.all(promises);

  return { ok: true, balance: balance, used: used };
};
