// Inserts a hintGrants row. The voucher is unused (usedAt=null) until useHint consumes it.
// Source-specific gating (e.g. "only grant 'share' after server-verified group share")
// happens UPSTREAM in the calling cloud function (shareGroup, helpInvite, etc.).
// This function trusts its caller — only validates type/source enum.

var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };
var VALID_SOURCES = { free: 1, stamina: 1, share: 1, help: 1, ad: 1, helperGift: 1 };

exports.main = async function (event, context, _cloudOverride) {
  var cloud = _cloudOverride;
  if (!cloud) {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  }
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
