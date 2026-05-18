// 3-tier hint state machine. Pure JS — no wx.* calls. Tested with node --test.

var CAPS = { weak: 5, medium: 3, strong: 1 };
var COSTS = { weak: 1, medium: 3, strong: 6 };
var FIRST_WEAK_FREE = true;

function createHintState(puzzleId) {
  return {
    puzzleId: puzzleId,
    weakLocked: {},
    mediumLocked: {},
    strongLocked: {},
    usedWeak: 0,
    usedMedium: 0,
    usedStrong: 0,
  };
}

function countUsed(state, type) {
  if (type === 'weak') return state.usedWeak;
  if (type === 'medium') return state.usedMedium;
  if (type === 'strong') return state.usedStrong;
  return 0;
}

function isOrientationLocked(state, blockId) {
  return !!state.weakLocked[blockId] || !!state.strongLocked[blockId];
}

function isCellLocked(state, blockId) {
  if (state.strongLocked[blockId]) return state.strongLocked[blockId]; // {x,y} stored
  return state.mediumLocked[blockId] || null;
}

function isFullyLocked(state, blockId) {
  return !!state.strongLocked[blockId];
}

module.exports = {
  CAPS: CAPS,
  COSTS: COSTS,
  FIRST_WEAK_FREE: FIRST_WEAK_FREE,
  createHintState: createHintState,
  countUsed: countUsed,
  isOrientationLocked: isOrientationLocked,
  isCellLocked: isCellLocked,
  isFullyLocked: isFullyLocked,
};
