// Resolves user's openid + upserts a row in `users`.
// Optionally fills nickname/avatarUrl on first-set (does not overwrite existing).
// Returns helpToken = HMAC_SHA256(openid + todayStr, env.HELP_TOKEN_SECRET)
// so the client can include it when sharing an invite link.

var crypto = require('crypto');
var _app;
function _getApp() {
  if (!_app) {
    var tcb = require('@cloudbase/node-sdk');
    _app = tcb.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  }
  return _app;
}

// MUST match helpInvite/index.js::todayStr — load-bearing for HMAC parity.
// Local timezone, YYYY-MM-DD.
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

async function _impl(event, cloud) {
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;
  var nickname = event && event.nickname;
  var avatarUrl = event && event.avatarUrl;

  var existing = await db.collection('users').where({ openid: openid }).get();
  var isNewUser = !(existing.data && existing.data.length > 0);

  if (isNewUser) {
    var row = { openid: openid, createdAt: db.serverDate() };
    if (nickname) row.nickname = nickname;
    if (avatarUrl) row.avatarUrl = avatarUrl;
    await db.collection('users').add({ data: row });
  } else {
    var current = existing.data[0];
    var patch = {};
    if (nickname && !current.nickname) patch.nickname = nickname;
    if (avatarUrl && !current.avatarUrl) patch.avatarUrl = avatarUrl;
    if (Object.keys(patch).length > 0) {
      await db.collection('users').where({ openid: openid }).update({ data: patch });
    }
  }

  var secret = process.env.HELP_TOKEN_SECRET;
  var helpToken = secret
    ? crypto.createHmac('sha256', secret).update(openid + todayStr()).digest('hex')
    : null;

  return { ok: true, openid: openid, isNewUser: isNewUser, helpToken: helpToken };
}

function makeCloud(event) {
  var ui = (event && event.userInfo) || {};
  var app = _getApp();
  return {
    database: function () { return app.database(); },
    serverDate: function () { return app.database().serverDate(); },
    getWXContext: function () {
      return {
        OPENID: ui.openId || ui.OPENID || '',
        APPID: ui.appId || ui.APPID || '',
      };
    },
  };
}

exports.main = async function (event, context) {
  return _impl(event, makeCloud(event));
};
exports._impl = _impl;
