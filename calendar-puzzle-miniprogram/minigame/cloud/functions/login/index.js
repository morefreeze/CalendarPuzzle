// Resolves user's openid + upserts a row in the `users` collection.
// Idempotent: second call for same openid returns isNewUser: false.

exports.main = async function (event, context, _cloudOverride) {
  // TEMP debug wrapper — captures the real error so the端 can see it
  try {
    var cloud = _cloudOverride;
    var stage = 'init';
    if (!cloud) {
      cloud = require('wx-server-sdk');
      cloud.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
    }
    stage = 'database';
    var db = cloud.database();
    stage = 'getWXContext';
    var ctx = cloud.getWXContext();
    var openid = ctx.OPENID;
    if (!openid) {
      return { ok: false, debug: { stage: 'no-openid', ctxKeys: Object.keys(ctx || {}) } };
    }
    stage = 'query';
    var existing = await db.collection('users').where({ openid: openid }).get();
    if (existing.data && existing.data.length > 0) {
      return { ok: true, openid: openid, isNewUser: false };
    }
    stage = 'insert';
    await db.collection('users').add({
      data: { openid: openid, createdAt: db.serverDate() },
    });
    return { ok: true, openid: openid, isNewUser: true };
  } catch (e) {
    return {
      ok: false,
      debug: {
        stage: stage,
        errMsg: (e && e.message) || String(e),
        errCode: e && e.errCode,
        stack: e && e.stack && String(e.stack).split('\n').slice(0, 3).join(' | '),
      },
    };
  }
};
