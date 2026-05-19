// Decrypts a wx.getShareInfo blob → derives openGId → dedups via shareLog →
// issues one 'medium','share' hintGrant. Best-effort: shareLog insert + hintGrants insert
// are two non-atomic writes; if the second fails, the dedup will still hold (slight
// player loss of one voucher; cloud function logs surface this).

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
