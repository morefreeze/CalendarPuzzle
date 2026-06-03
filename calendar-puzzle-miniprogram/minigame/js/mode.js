// Mode object lives on gameScene and rides save-slot payloads.
//
// Capability helpers are the single source of truth for "what does this
// mode allow"; gameScene render/hit-test branches consult them instead of
// hard-coding `mode.hardcore`. Future modes (timed, daily-challenge) extend
// this same surface.

var DEFAULT_MODE = { hardcore: false };

function createMode(opts) {
  opts = opts || {};
  return { hardcore: !!opts.hardcore };
}

function isHardcore(mode) {
  return !!(mode && mode.hardcore);
}

function canUseHint(mode)    { return !isHardcore(mode); }
function canSwapPuzzle(mode) { return !isHardcore(mode); }
function canRestart(mode)    { return !isHardcore(mode); }
function canClearBoard(mode) { return true; }

module.exports = {
  DEFAULT_MODE: DEFAULT_MODE,
  createMode: createMode,
  isHardcore: isHardcore,
  canUseHint: canUseHint,
  canSwapPuzzle: canSwapPuzzle,
  canRestart: canRestart,
  canClearBoard: canClearBoard,
};
