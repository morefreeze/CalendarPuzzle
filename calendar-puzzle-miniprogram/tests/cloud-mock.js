// In-memory wx-server-sdk shim for unit tests.
// Provides: init, database (with collection.add/where.get/count/update + limit), getWXContext.
// Match the subset of the SDK used by our cloud functions.

var _collections = {};
var _ctx = { OPENID: 'test-openid', APPID: 'test-appid' };
var _uniqueIndexes = {};  // collectionName -> array of field arrays
var _openDataMap = {};    // 'enc1|iv1' -> { openGId: 'group_X' }

function _matches(doc, query) {
  for (var k in query) {
    var qv = query[k];
    if (qv && typeof qv === 'object' && '$ne' in qv) {
      if (doc[k] === qv.$ne) return false;
    } else if (doc[k] !== qv) {
      return false;
    }
  }
  return true;
}

function _genId() {
  return 'mock_' + Math.random().toString(36).substr(2, 9);
}

function _query(store, query) {
  return {
    get: function () {
      return Promise.resolve({ data: store.filter(function (d) { return _matches(d, query); }) });
    },
    count: function () {
      return Promise.resolve({ total: store.filter(function (d) { return _matches(d, query); }).length });
    },
    update: function (opts) {
      var n = 0;
      store.forEach(function (d) {
        if (_matches(d, query)) {
          for (var k in opts.data) d[k] = opts.data[k];
          n++;
        }
      });
      return Promise.resolve({ stats: { updated: n } });
    },
    limit: function (max) {
      return {
        get: function () {
          var matched = store.filter(function (d) { return _matches(d, query); });
          return Promise.resolve({ data: matched.slice(0, max) });
        },
        update: function (opts) {
          var n = 0;
          for (var i = 0; i < store.length && n < max; i++) {
            if (_matches(store[i], query)) {
              for (var k in opts.data) store[i][k] = opts.data[k];
              n++;
            }
          }
          return Promise.resolve({ stats: { updated: n } });
        },
      };
    },
  };
}

function _collection(name) {
  if (!_collections[name]) _collections[name] = [];
  var store = _collections[name];
  return {
    add: function (opts) {
      var indexes = _uniqueIndexes[name] || [];
      for (var i = 0; i < indexes.length; i++) {
        var fields = indexes[i];
        var conflict = store.find(function (d) {
          for (var j = 0; j < fields.length; j++) {
            if (d[fields[j]] !== opts.data[fields[j]]) return false;
          }
          return true;
        });
        if (conflict) {
          var err = new Error('duplicate key on ' + name + ':' + fields.join(','));
          err.errCode = -502002;
          return Promise.reject(err);
        }
      }
      var doc = { _id: _genId() };
      for (var k in opts.data) doc[k] = opts.data[k];
      store.push(doc);
      return Promise.resolve({ _id: doc._id });
    },
    where: function (query) { return _query(store, query); },
    doc: function (id) {
      return {
        get: function () {
          var d = store.find(function (x) { return x._id === id; });
          return d ? Promise.resolve({ data: d }) : Promise.reject({ errCode: -1, errMsg: 'not found' });
        },
      };
    },
  };
}

module.exports = {
  init: function () {},
  database: function () {
    return {
      collection: _collection,
      serverDate: function () { return new Date(); },
    };
  },
  getWXContext: function () { return _ctx; },
  setMockContext: function (ctx) {
    for (var k in ctx) _ctx[k] = ctx[k];
  },
  reset: function () {
    _collections = {};
    _ctx = { OPENID: 'test-openid', APPID: 'test-appid' };
    _uniqueIndexes = {};
    _openDataMap = {};
  },
  setUniqueIndex: function (collectionName, fields) {
    if (!_uniqueIndexes[collectionName]) _uniqueIndexes[collectionName] = [];
    _uniqueIndexes[collectionName].push(fields);
  },
  setMockOpenData: function (encryptedData, iv, payload) {
    _openDataMap[encryptedData + '|' + iv] = payload;
  },
  getOpenData: function (opts) {
    var list = [];
    var items = (opts && opts.openData) || [];
    for (var i = 0; i < items.length; i++) {
      var key = items[i].data + '|' + items[i].iv;
      if (!(key in _openDataMap)) {
        return Promise.reject(new Error('unknown encryptedData ' + key));
      }
      list.push(_openDataMap[key]);
    }
    return Promise.resolve({ list: list });
  },
  DYNAMIC_CURRENT_ENV: 'mock-env',
};
