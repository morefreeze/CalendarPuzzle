// Returns per-tier balance + per-puzzle used count + recentHelps (last 7 days)
// for the calling user.
// puzzleId is optional; if omitted, used counts are all 0.

var TYPES = ['weak', 'medium', 'strong'];
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

  var cutoff = Date.now() - SEVEN_DAYS_MS;
  var helpRes = await db.collection('helpLog').where({ inviter: openid }).get();
  var recent = (helpRes.data || []).filter(function (row) {
    var t = row.createdAt instanceof Date ? row.createdAt.getTime() : Date.parse(row.createdAt);
    return !isNaN(t) && t >= cutoff;
  });
  var nickById = {};
  if (recent.length > 0) {
    var helperIds = recent.map(function (r) { return r.helper; });
    for (var j = 0; j < helperIds.length; j++) {
      var uRes = await db.collection('users').where({ openid: helperIds[j] }).get();
      var row = uRes.data && uRes.data[0];
      nickById[helperIds[j]] = (row && row.nickname) || 'Ta';
    }
  }
  var recentHelps = recent.map(function (r) {
    return {
      helper: r.helper,
      helperNickname: nickById[r.helper] || 'Ta',
      ts: r.createdAt instanceof Date ? r.createdAt.getTime() : Date.parse(r.createdAt),
    };
  });

  return { ok: true, balance: balance, used: used, recentHelps: recentHelps };
};
