// Inserts a hintGrants row. Diagnostic version: SDK inline (no wrapper)
// + console.log to trace where init goes wrong on cloudbase runtime.

var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };
var VALID_SOURCES = { free: 1, stamina: 1, share: 1, help: 1, ad: 1, helperGift: 1 };

exports.main = async function (event, context, _cloudOverride) {
  // Test path (cloud-mock injected as 3rd arg)
  if (_cloudOverride) {
    var c = _cloudOverride;
    var t = event && event.type;
    var s = event && event.source;
    if (!t || !VALID_TYPES[t]) return { ok: false, reason: 'invalid-type' };
    if (!s || !VALID_SOURCES[s]) return { ok: false, reason: 'invalid-source' };
    var ins = await c.database().collection('hintGrants').add({
      data: {
        openid: c.getWXContext().OPENID,
        type: t, source: s,
        grantedAt: c.database().serverDate(),
        usedAt: null, usedInPuzzle: null,
      },
    });
    return { ok: true, grantId: ins._id };
  }

  // Production path: pure @cloudbase/node-sdk, inline (no wrapper)
  console.log('[grantHint] before require');
  var tcb = require('@cloudbase/node-sdk');
  console.log('[grantHint] tcb type:', typeof tcb, 'keys:', tcb && Object.keys(tcb).slice(0, 20).join(','));
  var app = tcb.init({ env: 'cloudbase-2g5wjm7448ddc7bf' });
  console.log('[grantHint] app type:', typeof app, 'keys:', app && Object.keys(app).slice(0, 20).join(','));
  console.log('[grantHint] app.database type:', typeof (app && app.database));

  if (!app || typeof app.database !== 'function') {
    return {
      ok: false,
      reason: 'sdk-init-failed',
      diag: app ? Object.keys(app).join(',') : 'null app',
      tcbKeys: tcb ? Object.keys(tcb).join(',') : 'null tcb',
    };
  }

  var db = app.database();
  console.log('[grantHint] db type:', typeof db, 'has collection:', typeof db.collection);

  var type = event && event.type;
  var source = event && event.source;
  if (!type || !VALID_TYPES[type]) return { ok: false, reason: 'invalid-type' };
  if (!source || !VALID_SOURCES[source]) return { ok: false, reason: 'invalid-source' };

  var ui = (event && event.userInfo) || {};
  var openid = ui.openId || ui.OPENID || '';

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
