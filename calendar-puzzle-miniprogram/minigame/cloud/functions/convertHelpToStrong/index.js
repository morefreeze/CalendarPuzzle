// Atomically (best-effort) converts 2 unused (medium, source='help') vouchers
// into 1 strong/help voucher for the caller. Only source='help' vouchers are
// eligible — regular medium/share or stamina-bought medium cannot be burned.
// Returns { ok:false, err:'insufficient-help-credits' } if the caller has fewer
// than 2 unused help vouchers.
// Non-atomic: between marking the 2 source rows used and inserting the new
// strong row, a crash could leave the player short. Acceptable per the same
// best-effort pattern as helpInvite + shareGroup.

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
