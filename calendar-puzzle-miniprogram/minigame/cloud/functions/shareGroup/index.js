// Decrypts a wx.getShareInfo blob → derives openGId → dedups via shareLog →
// issues one 'medium','share' hintGrant. Best-effort: shareLog insert + hintGrants insert
// are two non-atomic writes; if the second fails, the dedup will still hold (slight
// player loss of one voucher; cloud function logs surface this).

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
  var encryptedData = event && event.encryptedData;
  var iv = event && event.iv;
  if (!encryptedData || !iv) return { ok: false, err: 'invalid-input' };

  var openid = cloud.getWXContext().OPENID;
  var openGId;
  try {
    var decoded = await cloud.getOpenData({ openData: [{ data: encryptedData, iv: iv }] });
    openGId = decoded && decoded.list && decoded.list[0] && decoded.list[0].openGId;
    if (!openGId) return { ok: false, err: 'decrypt-failed' };
  } catch (e) {
    return { ok: false, err: 'decrypt-failed' };
  }

  var db = cloud.database();
  var d = new Date();
  var dateStr = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  try {
    await db.collection('shareLog').add({
      data: {
        openid: openid,
        openGId: openGId,
        dateStr: dateStr,
        createdAt: db.serverDate(),
      },
    });
  } catch (e) {
    if (e && (e.errCode === -502002 || /duplicate/.test(e.errMsg || e.message || ''))) {
      return { ok: false, err: 'duplicate' };
    }
    return { ok: false, err: 'log-failed' };
  }

  await db.collection('hintGrants').add({
    data: {
      openid: openid,
      type: 'medium',
      source: 'share',
      grantedAt: db.serverDate(),
      usedAt: null,
      usedInPuzzle: null,
    },
  });

  return { ok: true, granted: { type: 'medium', source: 'share' } };
};
