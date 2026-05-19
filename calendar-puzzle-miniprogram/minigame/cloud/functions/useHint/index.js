// Claims an unused hint voucher of given type for the current puzzle.
// Single-action (NOT transactional): under concurrent calls (e.g. double-tap),
// two requests can both pass the cap check and both claim — accepted risk for
// mini-game scale per Plan 2a §race-condition self-review note.
// Enforces per-puzzle cap before claiming. Returns the consumed grant's _id.

var CAPS = { weak: 3, medium: 3, strong: 1 };
var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };

function makeCloud(event) {
  // 用 @cloudbase/node-sdk 替代 wx-server-sdk (新 runtime 下 wx-server-sdk 的
  // database/getWXContext 桩坏了). openid 从 event.userInfo 拿 —— 微信云函数
  // runtime 在 wx.cloud.callFunction 时会自动注入 userInfo.openId/appId.
  var tcb = require('@cloudbase/node-sdk');
  var app = tcb.init({ env: tcb.SYMBOL_DEFAULT_ENV });
  var ui = (event && event.userInfo) || {};
  return {
    database: function () { return app.database(); },
    serverDate: function () { return app.database().serverDate(); },
    getWXContext: function () {
      return {
        OPENID: ui.openId || ui.OPENID || '',
        APPID: ui.appId || ui.APPID || '',
      };
    },
    getOpenData: function () {
      // wx-server-sdk 的 getOpenData 已移除. shareGroup 的 encryptedData 解密
      // 走 @cloudbase/node-sdk 的 openapi 需要另外接 (follow-up); 现在先报错.
      return Promise.reject(new Error('getOpenData not available post wx-server-sdk removal'));
    },
  };
}

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride || makeCloud(event);
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
