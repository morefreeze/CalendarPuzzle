// Per-share random gray palette keyed by piece id. Used by gameScene to
// repaint placed pieces in shades of gray for the one-frame win-modal
// share snapshot, so the share-card cover does not leak which piece is
// which. Reshuffled on every call — the recipient cannot reverse-map a
// shade back to a specific piece across shares.

var GRAY_RAMP = [
  '#A8A8A8', '#B0B0B0', '#B8B8B8',
  '#C0C0C0', '#C8C8C8', '#D0D0D0',
  '#D8D8D8', '#E0E0E0', '#E8E8E8',
];

function shuffled(arr) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy;
}

function makeShareGrayPalette(pieceIds) {
  var ramp = shuffled(GRAY_RAMP);
  var pal = {};
  for (var i = 0; i < pieceIds.length; i++) {
    pal[pieceIds[i]] = ramp[i % ramp.length];
  }
  return pal;
}

module.exports = {
  makeShareGrayPalette: makeShareGrayPalette,
};
