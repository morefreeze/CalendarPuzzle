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

function _shapeEq(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
  }
  return true;
}

function _cloneShape(s) {
  return s.map(function (row) { return row.slice(); });
}

function _cloneBlock(b) {
  var n = {};
  for (var k in b) {
    if (k === 'shape') n.shape = _cloneShape(b.shape);
    else n[k] = b[k];
  }
  return n;
}

function applyWeak(state, blockId, palette, dropped, solvedPlacements) {
  var target = solvedPlacements[blockId];
  if (!target) return { newState: state, updatedPalette: palette, updatedDropped: dropped };

  var newPalette = palette.map(_cloneBlock);
  var newDropped = dropped.map(_cloneBlock);

  // Find block on palette
  for (var p = 0; p < newPalette.length; p++) {
    if (newPalette[p].id === blockId) {
      newPalette[p].shape = _cloneShape(target.shape);
    }
  }

  // Find block on board; evict if shape doesn't match solved
  for (var d = newDropped.length - 1; d >= 0; d--) {
    if (newDropped[d].id === blockId) {
      if (!_shapeEq(newDropped[d].shape, target.shape)) {
        var ev = _cloneBlock(newDropped[d]);
        ev.shape = _cloneShape(target.shape);
        delete ev.x; delete ev.y;
        newPalette.push(ev);
        newDropped.splice(d, 1);
      }
      // already correctly oriented → leave it
    }
  }

  var newState = {
    puzzleId: state.puzzleId,
    weakLocked: Object.assign({}, state.weakLocked, function () { var o = {}; o[blockId] = true; return o; }()),
    mediumLocked: state.mediumLocked,
    strongLocked: state.strongLocked,
    usedWeak: state.usedWeak + 1,
    usedMedium: state.usedMedium,
    usedStrong: state.usedStrong,
  };

  return { newState: newState, updatedPalette: newPalette, updatedDropped: newDropped };
}

function applyMedium(state, blockId, palette, dropped, solvedPlacements) {
  var target = solvedPlacements[blockId];
  if (!target) return { newState: state, updatedPalette: palette, updatedDropped: dropped, hintedCell: null };

  var newPalette = palette.map(_cloneBlock);
  var newDropped = dropped.map(_cloneBlock);

  for (var d = newDropped.length - 1; d >= 0; d--) {
    if (newDropped[d].id === blockId) {
      if (newDropped[d].x !== target.x || newDropped[d].y !== target.y) {
        var ev = _cloneBlock(newDropped[d]);
        delete ev.x; delete ev.y;
        newPalette.push(ev);
        newDropped.splice(d, 1);
      }
    }
  }

  var newMed = Object.assign({}, state.mediumLocked);
  newMed[blockId] = { x: target.x, y: target.y };

  var newState = {
    puzzleId: state.puzzleId,
    weakLocked: state.weakLocked,
    mediumLocked: newMed,
    strongLocked: state.strongLocked,
    usedWeak: state.usedWeak,
    usedMedium: state.usedMedium + 1,
    usedStrong: state.usedStrong,
  };

  return { newState: newState, updatedPalette: newPalette, updatedDropped: newDropped, hintedCell: { x: target.x, y: target.y } };
}

function _cellsOf(block) {
  var cells = [];
  for (var dy = 0; dy < block.shape.length; dy++) {
    for (var dx = 0; dx < block.shape[dy].length; dx++) {
      if (block.shape[dy][dx] === 1) cells.push({ x: block.x + dx, y: block.y + dy });
    }
  }
  return cells;
}

function applyStrong(state, blockId, palette, dropped, solvedPlacements) {
  var target = solvedPlacements[blockId];
  if (!target) return { newState: state, updatedPalette: palette, updatedDropped: dropped, evictedIds: [] };

  var newPalette = palette.map(_cloneBlock);
  var newDropped = dropped.map(_cloneBlock);

  // Cells that the target placement will occupy
  var targetCells = _cellsOf({ x: target.x, y: target.y, shape: target.shape });
  var occ = {};
  for (var i = 0; i < targetCells.length; i++) occ[targetCells[i].x + ',' + targetCells[i].y] = true;

  // Evict any dropped block (other than blockId) that overlaps
  var evictedIds = [];
  for (var d = newDropped.length - 1; d >= 0; d--) {
    var b = newDropped[d];
    if (b.id === blockId) {
      newDropped.splice(d, 1); // remove old placement (will re-place)
      continue;
    }
    var bCells = _cellsOf(b);
    for (var c = 0; c < bCells.length; c++) {
      if (occ[bCells[c].x + ',' + bCells[c].y]) {
        var ev = _cloneBlock(b);
        delete ev.x; delete ev.y;
        newPalette.push(ev);
        newDropped.splice(d, 1);
        evictedIds.push(b.id);
        break;
      }
    }
  }

  // Pull blockId out of palette if present
  for (var p = newPalette.length - 1; p >= 0; p--) {
    if (newPalette[p].id === blockId) newPalette.splice(p, 1);
  }

  // Place at solved position
  newDropped.push({
    id: blockId,
    label: target.shape && target.shape.length ? blockId.charAt(0) : '',
    shape: _cloneShape(target.shape),
    x: target.x,
    y: target.y,
  });
  // Pull label/extra fields from the original block if available
  var sourceBlock = null;
  for (var sp = 0; sp < palette.length; sp++) if (palette[sp].id === blockId) sourceBlock = palette[sp];
  for (var sd = 0; sd < dropped.length; sd++) if (dropped[sd].id === blockId) sourceBlock = dropped[sd];
  if (sourceBlock) {
    var placed = newDropped[newDropped.length - 1];
    for (var k in sourceBlock) {
      if (k === 'shape' || k === 'x' || k === 'y') continue;
      placed[k] = sourceBlock[k];
    }
  }

  var newStrong = Object.assign({}, state.strongLocked);
  newStrong[blockId] = { x: target.x, y: target.y };

  var newState = {
    puzzleId: state.puzzleId,
    weakLocked: state.weakLocked,
    mediumLocked: state.mediumLocked,
    strongLocked: newStrong,
    usedWeak: state.usedWeak,
    usedMedium: state.usedMedium,
    usedStrong: state.usedStrong + 1,
  };

  return { newState: newState, updatedPalette: newPalette, updatedDropped: newDropped, evictedIds: evictedIds };
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
  applyWeak: applyWeak,
  applyMedium: applyMedium,
  applyStrong: applyStrong,
};
