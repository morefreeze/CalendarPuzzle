var DLX = require('./dlx').DLX;
var boardMod = require('./board');
var initialBlockTypes = boardMod.initialBlockTypes;
var boardLayoutData = boardMod.boardLayoutData;

var ROWS = 8, COLS = 7;
var BOARD_BLK = '#', DATE_BLK = '*', EMPTY = ' ';

var DIFFICULTY_CONFIG = {
  easy:   { label: '\u9ED1\u94C1', digCount: 3 },
  medium: { label: '\u767D\u94F6', digCount: 5 },
  hard:   { label: '\u9EC4\u91D1', digCount: 7 },
  expert: { label: '\u94BB\u77F3', digCount: 9 },
};

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

function digFloor(sb, cnt) {
  var letters = SHAPES.map(function(s){return s.n;}), lp = {};
  for(var y=0;y<sb.length;y++) for(var x=0;x<sb[y].length;x++) {
    var ch=sb[y][x]; if(letters.indexOf(ch)>=0) { if(!lp[ch]) lp[ch]=[]; lp[ch].push([x,y]); }
  }
  var avail=Object.keys(lp); if(!avail.length) return [];
  var rem=[], dirs=[[-1,0],[0,-1],[0,1],[1,0]];
  var sc=avail[Math.floor(Math.random()*avail.length)];
  while(rem.length<cnt) {
    rem.push(sc);
    var nxt=[], pos=lp[sc]||[];
    for(var p=0;p<pos.length;p++) for(var d=0;d<4;d++) {
      var nx=pos[p][0]+dirs[d][0], ny=pos[p][1]+dirs[d][1];
      if(ny>=0&&ny<sb.length&&nx>=0&&nx<sb[ny].length) {
        var nc=sb[ny][nx]; if(letters.indexOf(nc)>=0&&rem.indexOf(nc)<0) nxt.push(nc);
      }
    }
    delete lp[sc];
    if(nxt.length) sc=nxt[Math.floor(Math.random()*nxt.length)];
    else { var r2=Object.keys(lp).filter(function(k){return rem.indexOf(k)<0;}); if(!r2.length)break; sc=r2[Math.floor(Math.random()*r2.length)]; }
  }
  return rem;
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

function generatePuzzle(diff, date) {
  var sb = solveBoard(date || new Date());
  if (!sb) return null;
  var digCount = DIFFICULTY_CONFIG[diff].digCount;
  var allCombos = enumAllDigCombinations(sb, digCount);
  if (!allCombos.length) return null;
  var idx = Math.floor(Math.random() * allCombos.length);
  var combo = allCombos[idx];
  var parts = puzzleFromCombo(sb, combo);
  return {
    prePlacedBlocks: parts.prePlacedBlocks,
    remainingBlocks: parts.remainingBlocks,
    difficulty: diff,
    solvedBoard: sb,
    allCombinations: allCombos,
    currentComboIndex: idx,
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
  getHintShape: getHintShape,
  puzzleFromCombo: puzzleFromCombo,
  countSolutionsForCombo: countSolutionsForCombo,
  DIFFICULTY_CONFIG: DIFFICULTY_CONFIG,
};
