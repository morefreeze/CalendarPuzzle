// Pre-baked tutorial puzzle used when the daily generator fails to find a
// (base, combo) pair that satisfies the strict three-block property within
// MAX_TUTORIAL_ATTEMPTS. Captured from the 2026-05-14 puzzle that we know
// is "narratively perfect":
//   misplaced V at (0,0) shape [[1,1,1],[1,0,0],[1,0,0]] — legal but not solved
//   placeable I-block (vertical at column 0 rows 3-6 fits)
//   unplaceable U-block (no legal placement while V is misplaced)

module.exports = {
  // Solved board as 8 row-strings (7 chars each).
  solvedBoardRows: [
    'IIII*L#',
    'UULLLL#',
    'UTTTNNN',
    'UUTNNS*',
    'VZTJJSS',
    'VZZZJQS',
    'VVVZJQQ',
    '####*QQ',
  ],
  // Letters to dig (the 3 remaining blocks).
  combo: ['U', 'V', 'I'],
  // The misplaced block's placement.
  misplaced: {
    id: 'V-block',
    shape: [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
    x: 0,
    y: 0,
  },
  placeableId: 'I-block',
  unplaceableId: 'U-block',
};
