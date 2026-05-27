// Thin wrapper over wx.cloud.callFunction. Caches openid + helpToken after login.
// helpToken can be null if HELP_TOKEN_SECRET is not configured on the login cloud
// function — callers building invite links MUST guard against null and surface
// "invites unavailable" to the user (do NOT include t=null in a share query).

var CLOUD_ENV = 'cloudbase-2g5wjm7448ddc7bf';
var _initialized = false;
var _openid = null;
var _helpToken = null;

function init() {
  if (_initialized) return;
  if (typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('wx.cloud not available — are you running outside WeChat?');
  }
  wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
  _initialized = true;
}

function _call(name, data) {
  init();
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: function (res) {
        if (res && res.result) resolve(res.result);
        else reject(new Error('empty result from ' + name));
      },
      fail: function (err) {
        reject(err);
      },
    });
  });
}

function login(extra) {
  return _call('login', extra || {}).then(function (r) {
    if (r && r.ok) {
      _openid = r.openid;
      _helpToken = r.helpToken || null;
    }
    return r;
  });
}

function getOpenid() { return _openid; }
function getHelpToken() { return _helpToken; }

function grantHint(type, source) {
  return _call('grantHint', { type: type, source: source });
}

function useHint(type, puzzleId, attemptId) {
  return _call('useHint', { type: type, puzzleId: puzzleId, attemptId: attemptId });
}

function listGrants(puzzleId) {
  return _call('listGrants', { puzzleId: puzzleId });
}

function shareGroup(encryptedData, iv) {
  return _call('shareGroup', { encryptedData: encryptedData, iv: iv });
}

function helpInvite(inviter, t) {
  return _call('helpInvite', { inviter: inviter, t: t });
}

function convertHelpToStrong() {
  return _call('convertHelpToStrong', {});
}

function syncSlots(slots) {
  return _call('syncSlots', { slots: slots || [] });
}

module.exports = {
  init: init,
  login: login,
  getOpenid: getOpenid,
  getHelpToken: getHelpToken,
  grantHint: grantHint,
  useHint: useHint,
  listGrants: listGrants,
  shareGroup: shareGroup,
  helpInvite: helpInvite,
  convertHelpToStrong: convertHelpToStrong,
  syncSlots: syncSlots,
  CLOUD_ENV: CLOUD_ENV,
};
