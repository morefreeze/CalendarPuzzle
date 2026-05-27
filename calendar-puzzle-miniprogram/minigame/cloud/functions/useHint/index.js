// Claims an unused hint voucher of given type for the current puzzle.
// Single-action (NOT transactional): under concurrent calls (e.g. double-tap),
// two requests can both pass the cap check and both claim — accepted risk for
// mini-game scale per Plan 2a §race-condition self-review note.
// Enforces per-puzzle cap before claiming. Returns the consumed grant's _id.
//
// Idempotency (added 2026-05-24, bug #3): if the client passes attemptId, the
// (openid, attemptId) tuple is recorded in `useHintAttempts` with the resulting
// response. Repeat calls with the same (openid, attemptId) replay the cached
// response without re-claiming. Fixes the case where the in-scene useHint
// succeeded server-side but the client never saw the callback (scene destroyed
// / app backgrounded), so flushPendingUse on next boot retried — without
// dedup, that retry either consumed a second grant or returned no-grant which
// triggered a spurious local rollback. Calls without attemptId fall back to
// the legacy (non-idempotent) behavior so old client builds still work.

var _app;
function _getApp() {
  if (!_app) {
    var tcb = require('@cloudbase/node-sdk');
    _app = tcb.init({ env: tcb.SYMBOL_DEFAULT_ENV });
  }
  return _app;
}

var CAPS = { weak: 3, medium: 3, strong: 1 };
var VALID_TYPES = { weak: 1, medium: 1, strong: 1 };

async function _impl(event, cloud) {
  var type = event && event.type;
  var puzzleId = event && event.puzzleId;
  var attemptId = event && event.attemptId;
  if (!type || !VALID_TYPES[type]) return { ok: false, reason: 'invalid-type' };
  if (!puzzleId) return { ok: false, reason: 'invalid-puzzleId' };

  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;

  // Idempotency: replay cached response if this attempt was already processed.
  if (attemptId) {
    var prior = await db.collection('useHintAttempts').where({
      openid: openid, attemptId: attemptId,
    }).limit(1).get();
    if (prior.data && prior.data.length > 0) {
      return prior.data[0].response;
    }
  }

  var response;
  var usedCount = await db.collection('hintGrants').where({
    openid: openid, type: type, usedInPuzzle: puzzleId,
  }).count();
  if (usedCount.total >= CAPS[type]) {
    response = { ok: false, reason: 'cap-reached' };
  } else {
    var unused = await db.collection('hintGrants').where({
      openid: openid, type: type, usedAt: null,
    }).limit(1).get();
    if (!unused.data || unused.data.length === 0) {
      response = { ok: false, reason: 'no-grant' };
    } else {
      var grantId = unused.data[0]._id;
      // @cloudbase/node-sdk update() takes fields at top-level (no `data:` wrapper).
      await db.collection('hintGrants').where({ _id: grantId }).update({
        usedAt: db.serverDate(),
        usedInPuzzle: puzzleId,
      });
      response = { ok: true, grantId: grantId };
    }
  }

  // Record the attempt → response mapping so future replays return the same
  // result. Best-effort: a concurrent racer with the same attemptId may cause
  // a duplicate-key error here; swallow it (the prior write wins).
  if (attemptId) {
    try {
      await db.collection('useHintAttempts').add({
        openid: openid, attemptId: attemptId,
        type: type, puzzleId: puzzleId,
        response: response,
        createdAt: db.serverDate(),
      });
    } catch (e) { /* duplicate or transient — replay path will pick up the other writer's record */ }
  }

  return response;
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
