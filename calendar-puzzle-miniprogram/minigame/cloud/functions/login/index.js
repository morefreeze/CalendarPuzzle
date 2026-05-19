// Resolves user's openid + upserts a row in the `users` collection.
// Idempotent: second call for same openid returns isNewUser: false.

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  }
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  var existing = await db.collection('users').where({ openid: openid }).get();
  if (existing.data && existing.data.length > 0) {
    return { ok: true, openid: openid, isNewUser: false };
  }

  await db.collection('users').add({
    data: { openid: openid, createdAt: db.serverDate() },
  });
  return { ok: true, openid: openid, isNewUser: true };
};
