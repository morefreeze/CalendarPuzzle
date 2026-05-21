// In-memory binding: which named slot is the current game saving to.
// Does NOT survive process restart — that's intentional (see spec
// "Module interfaces / slotBinding.js" for rationale).

function create() {
  var bound = null;
  return {
    getBound: function () { return bound; },
    bind: function (slotId) { bound = slotId; },
    clearActive: function () { bound = null; },
  };
}

module.exports = { create: create };
