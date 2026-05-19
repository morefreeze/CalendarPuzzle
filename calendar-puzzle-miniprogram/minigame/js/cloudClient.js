// Thin wrapper over wx.cloud.callFunction. Caches openid after first login.
// All RPCs return promises with normalized error handling.

var CLOUD_ENV = 'cloudbase-2g5wjm7448ddc7bf';
var _initialized = false;
var _openid = null;

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

function login() {
  return _call('login', {}).then(function (r) {
    if (r && r.ok) _openid = r.openid;
    return r;
  });
}

function getOpenid() { return _openid; }

function grantHint(type, source) {
  return _call('grantHint', { type: type, source: source });
}

function useHint(type, puzzleId) {
  return _call('useHint', { type: type, puzzleId: puzzleId });
}

function listGrants(puzzleId) {
  return _call('listGrants', { puzzleId: puzzleId });
}

module.exports = {
  init: init,
  login: login,
  getOpenid: getOpenid,
  grantHint: grantHint,
  useHint: useHint,
  listGrants: listGrants,
  CLOUD_ENV: CLOUD_ENV,
};
