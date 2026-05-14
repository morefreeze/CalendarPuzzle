var DLX = require('./dlx').DLX;
var boardMod = require('./board');
var packData = require('./pack_free');
var tutorialFallback = require('./tutorialFallback');
var initialBlockTypes = boardMod.initialBlockTypes;
var boardLayoutData = boardMod.boardLayoutData;

// Tutorial generator gives up after this many (base, combo) attempts and
// falls back to the pre-baked fallback puzzle.
var MAX_TUTORIAL_ATTEMPTS = 10;

var ROWS = 8, COLS = 7;
var BOARD_BLK = '#', DATE_BLK = '*', EMPTY = ' ';

// Pack keys are (month, day, python_weekday) with python weekday = 0..6 (Mon..Sun).
function packKey(date) {
  var jsDay = date.getDay(); // 0=Sun..6=Sat
  var pyWd = jsDay === 0 ? 6 : jsDay - 1;
  return (date.getMonth() + 1) + '-' + date.getDate() + '-' + pyWd;
}

// 56-char board string -> 8x7 2D array (same shape as solveBoard's output).
function parseBoardStr(s) {
  var b = [];
  for (var y = 0; y < ROWS; y++) {
    var row = [];
    for (var x = 0; x < COLS; x++) row.push(s[y * COLS + x]);
    b.push(row);
  }
  return b;
}

function getBasesFromPack(date) {
  var arr = packData[packKey(date)];
  if (!arr || !arr.length) return null;
  return arr.map(parseBoardStr);
}

// Difficulty labels map block-count K to a slice-of-life waiting time.
// The sub-label anchors duration expectation; the label itself is the brand.
var DIFFICULTY_CONFIG = {
  easy:   { label: '接水',         sub: '约 30 秒',  digCount: 3 },
  medium: { label: '泡咖啡',       sub: '约 3 分钟', digCount: 5 },
  hard:   { label: '开个会',       sub: '约 10 分钟', digCount: 7 },
  expert: { label: '加班赶报告',   sub: '约 20 分钟', digCount: 9 },
};

function formatDateStr(d) {
  var y = d.getFullYear();
  var mo = d.getMonth() + 1;
  var da = d.getDate();
  return y + '-' + (mo < 10 ? '0' + mo : mo) + '-' + (da < 10 ? '0' + da : da);
}

function parseDateStr(s) {
  if (!s) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

function parseGrid(rows, n) {
  var ml = 0;
  for (var i = 0; i < rows.length; i++) if (rows[i].length > ml) ml = rows[i].length;
  return rows.map(function(r) {
    var p = r; while (p.length < ml) p += ' ';
    return p.split('').map(function(c) { return c === n ? n : ' '; });
  });
}

var SHAPES = [
  {n:'U', g:parseGrid(['UU','U','UU'],'U')},
  {n:'V', g:parseGrid(['VVV','V','V'],'V')},
  {n:'I', g:parseGrid(['IIII'],'I')},
  {n:'L', g:parseGrid(['LLLL','L'],'L')},
  {n:'J', g:parseGrid(['JJJ','J'],'J')},
  {n:'Q', g:parseGrid(['Q','QQ','QQ'],'Q')},
  {n:'S', g:parseGrid([' SS','SS'],'S')},
  {n:'N', g:parseGrid(['  NN','NNN'],'N')},
  {n:'T', g:parseGrid(['TTT',' T',' T'],'T')},
  {n:'Z', g:parseGrid([' ZZ',' Z','ZZ'],'Z')},
];

var L2ID = {}, ID2L = {};
for (var i = 0; i < initialBlockTypes.length; i++) {
  L2ID[initialBlockTypes[i].label] = initialBlockTypes[i].id;
  ID2L[initialBlockTypes[i].id] = initialBlockTypes[i].label;
}

function rotG(g) {
  var nr = g.length, nc = g[0].length, r = [];
  for (var j = 0; j < nc; j++) { var row = []; for (var ii = nr-1; ii >= 0; ii--) row.push(g[ii][j]); r.push(row); }
  return r;
}
function mirG(g) { return g.map(function(r) { return r.slice().reverse(); }); }
function gStr(g) { return g.map(function(r) { return r.join(''); }).join('\n'); }

function allOri(g) {
  var vis = {}, res = [];
  function add(gg) { var k = gStr(gg); if (!vis[k]) { vis[k] = 1; res.push(gg); } }
  var c = g; for (var i = 0; i < 4; i++) { add(c); c = rotG(c); }
  c = mirG(g); for (var j = 0; j < 4; j++) { add(c); c = rotG(c); }
  return res;
}

function createBoard() {
  var b = [];
  for (var i = 0; i < ROWS; i++) { var r = []; for (var j = 0; j < COLS; j++) r.push(EMPTY); b.push(r); }
  return b;
}

function markDate(b, d) {
  b[0][6]=BOARD_BLK; b[1][6]=BOARD_BLK;
  b[7][0]=BOARD_BLK; b[7][1]=BOARD_BLK; b[7][2]=BOARD_BLK; b[7][3]=BOARD_BLK;
  var mo = d.getMonth()+1, day = d.getDate(), jsD = d.getDay(), wd = jsD===0?6:jsD-1;
  b[Math.floor((mo-1)/6)][(mo-1)%6] = DATE_BLK;
  b[2+Math.floor((day-1)/7)][(day-1)%7] = DATE_BLK;
  if (wd===6) b[6][3]=DATE_BLK;
  else if (wd<=2) b[6][4+wd]=DATE_BLK;
  else b[7][1+wd]=DATE_BLK;
}

function fitPut(b, x, y, sg, sn) {
  var nr = sg.length, nc = sg[0].length;
  var nb = b.map(function(r){return r.slice();});
  for (var ii = 0; ii < nr; ii++) for (var jj = 0; jj < nc; jj++) {
    if (sg[ii][jj]===' ') continue;
    var bx=x+ii, by=y+jj;
    if (bx<0||bx>=ROWS||by<0||by>=COLS) return null;
    if (nb[bx][by]!==EMPTY) return null;
    nb[bx][by]=sn;
  }
  return nb;
}

function solveBoard(date) {
  var b = createBoard(); markDate(b, date);
  var sc = SHAPES.length, ep = [];
  for (var i=0;i<ROWS;i++) for(var j=0;j<COLS;j++) if(b[i][j]===EMPTY) ep.push([i,j]);
  var mx=[], rn=['head'], vis={};
  for(var ii=0;ii<ROWS;ii++) for(var jj=0;jj<COLS;jj++) for(var k=0;k<sc;k++) {
    var oris = allOri(SHAPES[k].g);
    for(var o=0;o<oris.length;o++) {
      var nb = fitPut(b,ii,jj,oris[o],SHAPES[k].n);
      if(!nb) continue;
      var tc=sc+ep.length, row=[]; for(var fi=0;fi<tc;fi++) row.push(0);
      row[k]=1;
      for(var p=0;p<ep.length;p++) if(nb[ep[p][0]][ep[p][1]]===SHAPES[k].n) row[sc+p]=1;
      var key=row.join('');
      if(!vis[key]) { vis[key]=1; mx.push(row); rn.push(nb.map(function(r){return r.join('');}).join('\n')); }
    }
  }
  if(!mx.length) return null;
  var dlx = new DLX(mx, rn), sols = dlx.search();
  if(!sols.length) return null;
  var sol=sols[0], res=b.map(function(r){return r.slice();});
  for(var s=0;s<sol.length;s++) {
    var lines=rn[sol[s].coordinate[0]].split('\n');
    for(var li=0;li<lines.length;li++) for(var lj=0;lj<lines[li].length;lj++)
      if(res[li][lj]===EMPTY && lines[li][lj]!==EMPTY) res[li][lj]=lines[li][lj];
  }
  return res;
}

function buildBlockAdjacency(sb) {
  var letters = SHAPES.map(function(s) { return s.n; });
  var adj = {};
  for (var i = 0; i < letters.length; i++) adj[letters[i]] = {};
  var dirs = [[-1,0],[0,-1],[0,1],[1,0]];
  for (var y = 0; y < sb.length; y++) {
    for (var x = 0; x < sb[y].length; x++) {
      var ch = sb[y][x];
      if (letters.indexOf(ch) < 0) continue;
      for (var d = 0; d < dirs.length; d++) {
        var ny = y + dirs[d][0], nx = x + dirs[d][1];
        if (ny >= 0 && ny < sb.length && nx >= 0 && nx < sb[ny].length) {
          var nc = sb[ny][nx];
          if (nc !== ch && letters.indexOf(nc) >= 0) adj[ch][nc] = true;
        }
      }
    }
  }
  return adj;
}

function isConnected(subset, adj) {
  if (subset.length <= 1) return true;
  var visited = {};
  var queue = [subset[0]];
  visited[subset[0]] = true;
  while (queue.length > 0) {
    var cur = queue.shift();
    var neighbors = adj[cur] || {};
    for (var k in neighbors) {
      if (!visited[k] && subset.indexOf(k) >= 0) {
        visited[k] = true;
        queue.push(k);
      }
    }
  }
  for (var i = 0; i < subset.length; i++) {
    if (!visited[subset[i]]) return false;
  }
  return true;
}

function enumAllDigCombinations(sb, digCount) {
  var letters = SHAPES.map(function(s) { return s.n; });
  var adj = buildBlockAdjacency(sb);
  var results = [];

  function combine(start, current) {
    if (current.length === digCount) {
      if (isConnected(current, adj)) results.push(current.slice());
      return;
    }
    if (start >= letters.length) return;
    var remaining = letters.length - start;
    if (current.length + remaining < digCount) return;
    for (var i = start; i < letters.length; i++) {
      current.push(letters[i]);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return results;
}

function puzzleFromCombo(sb, combo) {
  var all = boardToPlaced(sb);
  var pre = all.filter(function(b) { return combo.indexOf(b.label) < 0; });
  var rem = all.filter(function(b) { return combo.indexOf(b.label) >= 0; }).map(function(b) {
    var orig = null;
    for (var i = 0; i < initialBlockTypes.length; i++) {
      if (initialBlockTypes[i].id === b.id) { orig = initialBlockTypes[i]; break; }
    }
    return { id: orig.id, label: orig.label, color: orig.color, shape: orig.shape.map(function(r) { return r.slice(); }), key: orig.key };
  });
  return { prePlacedBlocks: pre, remainingBlocks: rem };
}

function solveBoardForCombo(sb, combo) {
  var b = [];
  for (var y = 0; y < sb.length; y++) {
    var row = [];
    for (var x = 0; x < sb[y].length; x++) {
      if (combo.indexOf(sb[y][x]) >= 0) row.push(EMPTY);
      else row.push(sb[y][x]);
    }
    b.push(row);
  }
  var comboShapes = SHAPES.filter(function(s) { return combo.indexOf(s.n) >= 0; });
  var sc = comboShapes.length;
  var ep = [];
  for (var i = 0; i < ROWS; i++) {
    for (var j = 0; j < COLS; j++) {
      if (b[i][j] === EMPTY) ep.push([i, j]);
    }
  }
  if (ep.length === 0) return 0;
  var mx = [], rn = ['head'], vis = {};
  for (var ii = 0; ii < ROWS; ii++) {
    for (var jj = 0; jj < COLS; jj++) {
      for (var k = 0; k < sc; k++) {
        var oris = allOri(comboShapes[k].g);
        for (var o = 0; o < oris.length; o++) {
          var nb = fitPut(b, ii, jj, oris[o], comboShapes[k].n);
          if (!nb) continue;
          var tc = sc + ep.length, row2 = [];
          for (var fi = 0; fi < tc; fi++) row2.push(0);
          row2[k] = 1;
          for (var p = 0; p < ep.length; p++) {
            if (nb[ep[p][0]][ep[p][1]] === comboShapes[k].n) row2[sc + p] = 1;
          }
          var key = row2.join('');
          if (!vis[key]) {
            vis[key] = 1;
            mx.push(row2);
            rn.push(nb.map(function(r) { return r.join(''); }).join('\n'));
          }
        }
      }
    }
  }
  if (!mx.length) return 0;
  var dlx = new DLX(mx, rn);
  return dlx.countAll();
}

function countSolutionsForCombo(sb, combo) {
  return solveBoardForCombo(sb, combo);
}

function boardToPlaced(sb) {
  var letters=SHAPES.map(function(s){return s.n;}), res=[];
  for(var l=0;l<letters.length;l++) {
    var ch=letters[l], minR=99,minC=99,maxR=-1,maxC=-1;
    for(var r=0;r<sb.length;r++) for(var c=0;c<sb[r].length;c++) if(sb[r][c]===ch) {
      if(r<minR)minR=r; if(c<minC)minC=c; if(r>maxR)maxR=r; if(c>maxC)maxC=c;
    }
    if(maxR<0) continue;
    var shape=[];
    for(var sr=minR;sr<=maxR;sr++) { var row=[]; for(var sc2=minC;sc2<=maxC;sc2++) row.push(sb[sr][sc2]===ch?1:0); shape.push(row); }
    var bid=L2ID[ch], def=null;
    for(var bi=0;bi<initialBlockTypes.length;bi++) if(initialBlockTypes[bi].id===bid){def=initialBlockTypes[bi];break;}
    if(!def) continue;
    res.push({id:def.id,label:def.label,color:def.color,shape:shape,key:def.key,x:minC,y:minR});
  }
  return res;
}

function generatePuzzle(diff, opts) {
  // Backwards compat: callers used to pass a Date as the second arg.
  if (opts instanceof Date) opts = { date: opts };
  opts = opts || {};
  var date = opts.date || new Date();

  // Try the pre-baked solution pack first; fall back to live DLX if the date
  // isn't in the pack (e.g. game design has changed and the pack is stale).
  var bases = getBasesFromPack(date);
  if (!bases) {
    var sb = solveBoard(date);
    if (!sb) return null;
    bases = [sb];
  }

  var digCount = DIFFICULTY_CONFIG[diff].digCount;
  // Enumerate {baseIdx, letters} pairs across every base in the pack.
  var allCombos = [];
  for (var bi = 0; bi < bases.length; bi++) {
    var letters = enumAllDigCombinations(bases[bi], digCount);
    for (var li = 0; li < letters.length; li++) {
      allCombos.push({ baseIdx: bi, letters: letters[li] });
    }
  }
  if (!allCombos.length) return null;

  var idx;
  var ci = opts.comboIndex;
  if (typeof ci === 'number' && ci >= 0 && ci < allCombos.length) {
    idx = ci;
  } else {
    idx = Math.floor(Math.random() * allCombos.length);
  }
  var combo = allCombos[idx];
  var solvedBoard = bases[combo.baseIdx];
  var parts = puzzleFromCombo(solvedBoard, combo.letters);
  return {
    prePlacedBlocks: parts.prePlacedBlocks,
    remainingBlocks: parts.remainingBlocks,
    difficulty: diff,
    solvedBoard: solvedBoard,
    bases: bases,
    allCombinations: allCombos,
    currentComboIndex: idx,
    dateStr: formatDateStr(date),
  };
}

// Enumerate up to 8 unique orientations of a shape (4 rotations × 2 mirrors).
function _orientations(shape) {
  var out = [];
  var seen = {};
  function key(s) { return s.map(function (r) { return r.join(''); }).join('|'); }
  function add(s) { var k = key(s); if (!seen[k]) { seen[k] = true; out.push(s); } }
  var cur = shape;
  for (var i = 0; i < 4; i++) { add(cur); cur = boardMod.rotateShape(cur); }
  cur = boardMod.flipShape(shape);
  for (var j = 0; j < 4; j++) { add(cur); cur = boardMod.rotateShape(cur); }
  return out;
}

// Does this block have any legal placement (any orientation × cell) given
// the current set of placed blocks + uncoverable cells?
function _hasLegalPlacement(block, allBlocks, uncov) {
  var oris = _orientations(block.shape);
  for (var oi = 0; oi < oris.length; oi++) {
    var probe = {
      id: block.id, label: block.label, color: block.color,
      key: block.key, shape: oris[oi],
    };
    for (var yy = 0; yy < 8; yy++) {
      for (var xx = 0; xx < 7; xx++) {
        if (boardMod.isValidPlacement(probe, { x: xx, y: yy }, allBlocks, uncov)) {
          return true;
        }
      }
    }
  }
  return false;
}

function _sameShape(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
  }
  return true;
}

// Try every orientation × cell for `block`. Return the first legal placement
// that is NOT the solved (x, y, shape). Fall back to any legal placement
// (including solved) if no distinct one exists.
function _findLegalPlacement(block, prePlaced, uncov, solvedPlacement) {
  var oris = _orientations(block.shape);
  var fallback = null;
  for (var oi = 0; oi < oris.length; oi++) {
    var probe = {
      id: block.id, label: block.label, color: block.color,
      key: block.key, shape: oris[oi],
    };
    for (var yy = 0; yy < 8; yy++) {
      for (var xx = 0; xx < 7; xx++) {
        if (boardMod.isValidPlacement(probe, { x: xx, y: yy }, prePlaced, uncov)) {
          var isSolved = solvedPlacement
            && xx === solvedPlacement.x
            && yy === solvedPlacement.y
            && _sameShape(oris[oi], solvedPlacement.shape);
          if (!isSolved) return { x: xx, y: yy, shape: oris[oi] };
          if (!fallback) fallback = { x: xx, y: yy, shape: oris[oi] };
        }
      }
    }
  }
  return fallback;
}

// Build solved placements lookup (block id → {x, y, shape}) from a solved board.
function _solvedPlacements(sb) {
  var map = {};
  var all = boardToPlaced(sb);
  for (var i = 0; i < all.length; i++) {
    map[all[i].id] = { x: all[i].x, y: all[i].y, shape: all[i].shape };
  }
  return map;
}

// Strict search for a single (base, combo)'s parts: find (misplaced block,
// orientation, position) such that placement is legal & non-solved AND
// exactly one other palette block is placeable / the other unplaceable.
// Returns { misplaced, placeable, unplaceable } or null.
function _findStrictTriple(parts, solvedPlacements, uncov) {
  for (var ri = 0; ri < parts.remainingBlocks.length; ri++) {
    var cand = parts.remainingBlocks[ri];
    var oris = _orientations(cand.shape);
    var sp = solvedPlacements[cand.id];
    for (var oi = 0; oi < oris.length; oi++) {
      var probe = {
        id: cand.id, label: cand.label, color: cand.color,
        key: cand.key, shape: oris[oi],
      };
      for (var yy = 0; yy < 8; yy++) {
        for (var xx = 0; xx < 7; xx++) {
          if (!boardMod.isValidPlacement(probe, { x: xx, y: yy },
            parts.prePlacedBlocks, uncov)) continue;
          if (sp && xx === sp.x && yy === sp.y
            && _sameShape(oris[oi], sp.shape)) continue;
          var droppedTmp = {
            id: cand.id, label: cand.label, color: cand.color,
            key: cand.key, shape: oris[oi], x: xx, y: yy,
          };
          var state = parts.prePlacedBlocks.concat([droppedTmp]);
          var others = parts.remainingBlocks.filter(function (b) {
            return b.id !== cand.id;
          });
          var placeable = null, unplaceable = null;
          for (var oj = 0; oj < others.length; oj++) {
            if (_hasLegalPlacement(others[oj], state, uncov)) placeable = others[oj];
            else unplaceable = others[oj];
          }
          if (placeable && unplaceable) {
            return { misplaced: droppedTmp, placeable: placeable, unplaceable: unplaceable };
          }
        }
      }
    }
  }
  return null;
}

// Build an "easy" puzzle and pre-misplace one of its remaining blocks at a
// legal cell that satisfies a strict three-block property:
//   * misplaced: legal but not the solved (x, y, orientation)
//   * placeable: another palette block has ≥1 legal placement now
//   * unplaceable: the third palette block has 0 legal placements now
// We search across every base × every combo until one satisfies it. If
// none do, fall back to any-legal-non-solved.
function generateTutorialPuzzle(date) {
  date = date || new Date();
  var bases = getBasesFromPack(date);
  if (!bases) {
    var sb = solveBoard(date);
    if (!sb) return null;
    bases = [sb];
  }
  var digCount = DIFFICULTY_CONFIG.easy.digCount; // 3
  var uncov = boardMod.getUncoverableCells();

  // ── Strict search: iterate (base, combo) pairs up to MAX_TUTORIAL_ATTEMPTS,
  //    stop at the first triple. If none in the budget, fall back to the
  //    pre-baked tutorial below.
  var winningBase = null, winningCombo = null, winningParts = null, winningTriple = null;
  var attempts = 0;
  for (var bi = 0; bi < bases.length && !winningTriple && attempts < MAX_TUTORIAL_ATTEMPTS; bi++) {
    var sb2 = bases[bi];
    var letterSets = enumAllDigCombinations(sb2, digCount);
    if (!letterSets.length) continue;
    var sps = _solvedPlacements(sb2);
    for (var li = 0; li < letterSets.length && !winningTriple && attempts < MAX_TUTORIAL_ATTEMPTS; li++) {
      attempts++;
      var pts = puzzleFromCombo(sb2, letterSets[li]);
      var triple = _findStrictTriple(pts, sps, uncov);
      if (triple) {
        winningBase = sb2;
        winningCombo = letterSets[li];
        winningParts = pts;
        winningTriple = triple;
      }
    }
  }

  // Default puzzle fields — overwritten by either strict or fallback below.
  var solvedBoard, combo, parts;
  var misplacedBlock, misplacedPlacement;
  var placeableId = null, unplaceableId = null;

  if (winningTriple) {
    solvedBoard = winningBase;
    combo = winningCombo;
    parts = winningParts;
    misplacedBlock = parts.remainingBlocks.filter(function (b) {
      return b.id === winningTriple.misplaced.id;
    })[0];
    misplacedPlacement = {
      x: winningTriple.misplaced.x,
      y: winningTriple.misplaced.y,
      shape: winningTriple.misplaced.shape,
    };
    placeableId = winningTriple.placeable.id;
    unplaceableId = winningTriple.unplaceable.id;
  } else {
    // No strict triple found within MAX_TUTORIAL_ATTEMPTS — use the
    // hand-curated fallback puzzle (the 2026-05-14 layout).
    solvedBoard = tutorialFallback.solvedBoardRows.map(function (r) { return r.split(''); });
    combo = tutorialFallback.combo;
    parts = puzzleFromCombo(solvedBoard, combo);
    misplacedBlock = parts.remainingBlocks.filter(function (b) {
      return b.id === tutorialFallback.misplaced.id;
    })[0] || parts.remainingBlocks[0];
    misplacedPlacement = {
      x: tutorialFallback.misplaced.x,
      y: tutorialFallback.misplaced.y,
      shape: tutorialFallback.misplaced.shape.map(function (r) { return r.slice(); }),
    };
    placeableId = tutorialFallback.placeableId;
    unplaceableId = tutorialFallback.unplaceableId;
    bases = [solvedBoard]; // ensure bases is consistent for downstream consumers
  }

  var initialDropped = [{
    id: misplacedBlock.id,
    label: misplacedBlock.label,
    color: misplacedBlock.color,
    key: misplacedBlock.key,
    shape: misplacedPlacement.shape,
    x: misplacedPlacement.x,
    y: misplacedPlacement.y,
  }];

  return {
    prePlacedBlocks: parts.prePlacedBlocks,
    remainingBlocks: parts.remainingBlocks,
    initialDropped: initialDropped,
    misplacedId: misplacedBlock.id,
    placeableId: placeableId,
    unplaceableId: unplaceableId,
    difficulty: 'easy',
    solvedBoard: solvedBoard,
    bases: bases,
    allCombinations: [{ baseIdx: 0, letters: combo }],
    currentComboIndex: 0,
    dateStr: formatDateStr(date),
    tutorial: true,
  };
}

function getHintShape(sb, label) {
  var minR=99,minC=99,maxR=-1,maxC=-1;
  for(var r=0;r<sb.length;r++) for(var c=0;c<sb[r].length;c++) if(sb[r][c]===label) {
    if(r<minR)minR=r; if(c<minC)minC=c; if(r>maxR)maxR=r; if(c>maxC)maxC=c;
  }
  if(maxR<0) return null;
  var shape=[];
  for(var sr=minR;sr<=maxR;sr++){var row=[];for(var sc2=minC;sc2<=maxC;sc2++) row.push(sb[sr][sc2]===label?1:0); shape.push(row);}
  return shape;
}

module.exports = {
  generatePuzzle: generatePuzzle,
  generateTutorialPuzzle: generateTutorialPuzzle,
  getHintShape: getHintShape,
  puzzleFromCombo: puzzleFromCombo,
  countSolutionsForCombo: countSolutionsForCombo,
  DIFFICULTY_CONFIG: DIFFICULTY_CONFIG,
  formatDateStr: formatDateStr,
  parseDateStr: parseDateStr,
};
