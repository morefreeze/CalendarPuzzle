// Inserts a hintGrants row. The voucher is unused (usedAt=null) until useHint consumes it.
// Source-specific gating (e.g. "only grant 'share' after server-verified group share")
// happens UPSTREAM in the calling cloud function (shareGroup, helpInvite, etc.).
// This function trusts its caller — only validates type/source enum.

var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };
var VALID_SOURCES = { free: 1, stamina: 1, share: 1, help: 1, ad: 1, helperGift: 1 };

function makeCloud(event) {
  // 用 @cloudbase/node-sdk 替代 wx-server-sdk (新 runtime 下 wx-server-sdk 的
  // database/getWXContext 桩坏了). openid 从 event.userInfo 拿 —— 微信云函数
  // runtime 在 wx.cloud.callFunction 时会自动注入 userInfo.openId/appId.
  var tcb = require('@cloudbase/node-sdk');
  var app;
  try {
    app = tcb.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  } catch (e) {
    try { app = tcb.init(); } catch (e2) {}
  }
  if (!app || typeof app.database !== 'function') {
    throw new Error('@cloudbase/node-sdk init failed: ' + (app ? Object.keys(app).join(',') : 'null app'));
  }
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
  var source = event && event.source;
  if (!type || !VALID_TYPES[type]) return { ok: false, reason: 'invalid-type' };
  if (!source || !VALID_SOURCES[source]) return { ok: false, reason: 'invalid-source' };

  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;
  var insert = await db.collection('hintGrants').add({
    data: {
      openid: openid,
      type: type,
      source: source,
      grantedAt: db.serverDate(),
      usedAt: null,
      usedInPuzzle: null,
    },
  });
  return { ok: true, grantId: insert._id };
};
