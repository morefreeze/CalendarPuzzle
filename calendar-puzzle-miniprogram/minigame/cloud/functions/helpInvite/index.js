// Validates an inviter→helper invite using an HMAC token tied to (inviter, today, SECRET).
// Inserts a helpLog row (unique by inviter+helper+dateStr) → grants helper a weak
// 'helperGift' voucher → grants the inviter one medium 'help' voucher per help.
// Inviters convert 2x medium/help into 1x strong via convertHelpToStrong cloud fn
// (regular medium vouchers from other sources are NOT convertible).
// SECRET comes from env HELP_TOKEN_SECRET (configured in cloudbase console per cloud function).
// Best-effort partial-failure: helpLog → hintGrants writes are non-atomic; if a
// hintGrants insert fails after helpLog has been written, the dedup will still
// hold (helper permanently loses one voucher). Same pattern as shareGroup.

var crypto = require('crypto');
var _app;
function _getApp() {
  if (!_app) {
    var tcb = require('@cloudbase/node-sdk');
    _app = tcb.init({ env: tcb.SYMBOL_DEFAULT_ENV });
  }
  return _app;
}

// MUST match login/index.js::todayStr — load-bearing for HMAC parity.
// Local timezone, YYYY-MM-DD.
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function expectedToken(openid, dateStr, secret) {
  return crypto.createHmac('sha256', secret).update(openid + dateStr).digest('hex');
}

function timingSafeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function _impl(event, cloud) {
  var inviter = event && event.inviter;
  var t = event && event.t;
  if (!inviter || !t) return { ok: false, err: 'invalid-input' };

  var helper = cloud.getWXContext().OPENID;
  if (inviter === helper) return { ok: false, err: 'self-help' };

  var secret = process.env.HELP_TOKEN_SECRET;
  if (!secret) return { ok: false, err: 'server-misconfigured' };

  var dateStr = todayStr();
  if (!timingSafeEq(t, expectedToken(inviter, dateStr, secret))) {
    return { ok: false, err: 'bad-token' };
  }

  var db = cloud.database();

  try {
    // @cloudbase/node-sdk add() takes fields at top-level (no `data:` wrapper).
    await db.collection('helpLog').add({
      inviter: inviter,
      helper: helper,
      dateStr: dateStr,
      createdAt: db.serverDate(),
    });
  } catch (e) {
    if (e && (e.errCode === -502002 || /duplicate/.test(e.errMsg || e.message || ''))) {
      return { ok: false, err: 'duplicate' };
    }
    return { ok: false, err: 'log-failed' };
  }

  // Helper gets a one-shot弱 voucher (鼓励他玩一把).
  await db.collection('hintGrants').add({
    openid: helper,
    type: 'weak',
    source: 'helperGift',
    grantedAt: db.serverDate(),
    usedAt: null,
    usedInPuzzle: null,
  });

  // Inviter gets +1 中 (source='help') per help. To换 strong, they must
  // explicitly burn 2 of these via convertHelpToStrong cloud fn — regular
  // medium vouchers (source='share' / 'stamina' / etc) cannot be converted.
  await db.collection('hintGrants').add({
    openid: inviter,
    type: 'medium',
    source: 'help',
    grantedAt: db.serverDate(),
    usedAt: null,
    usedInPuzzle: null,
  });

  var userRes = await db.collection('users').where({ openid: inviter }).limit(1).get();
  var nickname = (userRes.data && userRes.data[0] && userRes.data[0].nickname) || 'Ta';

  return {
    ok: true,
    inviterNickname: nickname,
    granted: { type: 'weak', source: 'helperGift' },
  };
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
