// Board layout data, block definitions, and utility functions

var boardLayoutData = [
  [{t:'month',v:'Jan'},{t:'month',v:'Feb'},{t:'month',v:'Mar'},{t:'month',v:'Apr'},{t:'month',v:'May'},{t:'month',v:'Jun'},{t:'empty',v:null}],
  [{t:'month',v:'Jul'},{t:'month',v:'Aug'},{t:'month',v:'Sep'},{t:'month',v:'Oct'},{t:'month',v:'Nov'},{t:'month',v:'Dec'},{t:'empty',v:null}],
  [{t:'day',v:1},{t:'day',v:2},{t:'day',v:3},{t:'day',v:4},{t:'day',v:5},{t:'day',v:6},{t:'day',v:7}],
  [{t:'day',v:8},{t:'day',v:9},{t:'day',v:10},{t:'day',v:11},{t:'day',v:12},{t:'day',v:13},{t:'day',v:14}],
  [{t:'day',v:15},{t:'day',v:16},{t:'day',v:17},{t:'day',v:18},{t:'day',v:19},{t:'day',v:20},{t:'day',v:21}],
  [{t:'day',v:22},{t:'day',v:23},{t:'day',v:24},{t:'day',v:25},{t:'day',v:26},{t:'day',v:27},{t:'day',v:28}],
  [{t:'day',v:29},{t:'day',v:30},{t:'day',v:31},{t:'weekday',v:'Sun'},{t:'weekday',v:'Mon'},{t:'weekday',v:'Tue'},{t:'weekday',v:'Wed'}],
  [{t:'empty',v:null},{t:'empty',v:null},{t:'empty',v:null},{t:'empty',v:null},{t:'weekday',v:'Thu'},{t:'weekday',v:'Fri'},{t:'weekday',v:'Sat'}]
];

var initialBlockTypes = [
  {id:'I-block',label:'I',color:'#00CCCC',shape:[[1,1,1,1]],key:'i'},
  {id:'T-block',label:'T',color:'#9933CC',shape:[[0,1,0],[0,1,0],[1,1,1]],key:'t'},
  {id:'L-block',label:'L',color:'#FF8800',shape:[[1,0],[1,0],[1,0],[1,1]],key:'l'},
  {id:'S-block',label:'S',color:'#33CC33',shape:[[0,1,1],[1,1,0]],key:'s'},
  {id:'Z-block',label:'Z',color:'#3366FF',shape:[[1,1,0],[0,1,0],[0,1,1]],key:'z'},
  {id:'N-block',label:'N',color:'#996633',shape:[[1,1,1,0],[0,0,1,1]],key:'n'},
  {id:'Q-block',label:'Q',color:'#FF99AA',shape:[[1,1,0],[1,1,1]],key:'q'},
  {id:'V-block',label:'V',color:'#9966CC',shape:[[1,0,0],[1,0,0],[1,1,1]],key:'v'},
  {id:'U-block',label:'U',color:'#FF5533',shape:[[1,0,1],[1,1,1]],key:'u'},
  {id:'J-block',label:'J',color:'#339933',shape:[[1,0],[1,0],[1,1]],key:'j'},
];

// Cell type colors
var CELL_COLORS = {
  month: '#FFB6C1',
  day: '#AAEEBB',
  weekday: '#87CEFA',
  empty: '#FFFFFF',
  uncoverable: '#F0E68C',
};

function formatTime(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}

function getUncoverableCells() {
  var today = new Date();
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var cm = months[today.getMonth()];
  var cd = today.getDate();
  var cw = weekdays[today.getDay()];
  var coords = [];
  for (var y = 0; y < boardLayoutData.length; y++) {
    for (var x = 0; x < boardLayoutData[y].length; x++) {
      var c = boardLayoutData[y][x];
      if ((c.t === 'month' && c.v === cm) || (c.t === 'day' && c.v === cd) || (c.t === 'weekday' && c.v === cw)) {
        coords.push({x: x, y: y});
      }
    }
  }
  return coords;
}

function rotateShape(shape) {
  var rows = shape.length, cols = shape[0].length;
  var n = [];
  for (var c = 0; c < cols; c++) {
    var row = [];
    for (var r = rows - 1; r >= 0; r--) row.push(shape[r][c]);
    n.push(row);
  }
  return n;
}

function flipShape(shape) {
  return shape.map(function(r) { return r.slice().reverse(); });
}

function isValidPlacement(block, pos, allBlocks, uncoverableCells, excludeId) {
  if (!block || !block.shape) return false;
  var cells = [];
  for (var ry = 0; ry < block.shape.length; ry++) {
    for (var cx = 0; cx < block.shape[ry].length; cx++) {
      if (block.shape[ry][cx] === 1) cells.push({x: pos.x + cx, y: pos.y + ry});
    }
  }
  // Bounds + empty check
  for (var i = 0; i < cells.length; i++) {
    var cl = cells[i];
    if (cl.y < 0 || cl.y >= 8 || cl.x < 0 || cl.x >= 7) return false;
    if (boardLayoutData[cl.y][cl.x].t === 'empty') return false;
  }
  // Overlap check
  for (var b = 0; b < allBlocks.length; b++) {
    var bl = allBlocks[b];
    if (excludeId != null && bl.id === excludeId) continue;
    for (var sy = 0; sy < bl.shape.length; sy++) {
      for (var sx = 0; sx < bl.shape[sy].length; sx++) {
        if (bl.shape[sy][sx] !== 1) continue;
        var bx = bl.x + sx, by = bl.y + sy;
        for (var k = 0; k < cells.length; k++) {
          if (cells[k].x === bx && cells[k].y === by) return false;
        }
      }
    }
  }
  // Uncoverable check
  for (var u = 0; u < uncoverableCells.length; u++) {
    for (var j = 0; j < cells.length; j++) {
      if (cells[j].x === uncoverableCells[u].x && cells[j].y === uncoverableCells[u].y) return false;
    }
  }
  return true;
}

function checkGameWin(allBlocks, uncoverableCells) {
  if (allBlocks.length !== initialBlockTypes.length) return false;
  var covered = {};
  for (var b = 0; b < allBlocks.length; b++) {
    var bl = allBlocks[b];
    for (var ry = 0; ry < bl.shape.length; ry++) {
      for (var cx = 0; cx < bl.shape[ry].length; cx++) {
        if (bl.shape[ry][cx] === 1) covered[(bl.y + ry) + ',' + (bl.x + cx)] = true;
      }
    }
  }
  for (var y = 0; y < boardLayoutData.length; y++) {
    for (var x = 0; x < boardLayoutData[y].length; x++) {
      if (boardLayoutData[y][x].t === 'empty') continue;
      var isUncov = false;
      for (var u = 0; u < uncoverableCells.length; u++) {
        if (uncoverableCells[u].x === x && uncoverableCells[u].y === y) { isUncov = true; break; }
      }
      if (isUncov) continue;
      if (!covered[y + ',' + x]) return false;
    }
  }
  return true;
}

function getBlockAtCell(allBlocks, x, y) {
  for (var b = 0; b < allBlocks.length; b++) {
    var bl = allBlocks[b];
    for (var dy = 0; dy < bl.shape.length; dy++) {
      for (var dx = 0; dx < bl.shape[dy].length; dx++) {
        if (bl.shape[dy][dx] === 1 && bl.x + dx === x && bl.y + dy === y) return bl;
      }
    }
  }
  return null;
}

function cloneBlock(b) {
  var n = {};
  for (var k in b) {
    if (k === 'shape') n.shape = b.shape.map(function(r) { return r.slice(); });
    else n[k] = b[k];
  }
  return n;
}

module.exports = {
  boardLayoutData: boardLayoutData,
  initialBlockTypes: initialBlockTypes,
  CELL_COLORS: CELL_COLORS,
  formatTime: formatTime,
  getUncoverableCells: getUncoverableCells,
  rotateShape: rotateShape,
  flipShape: flipShape,
  isValidPlacement: isValidPlacement,
  checkGameWin: checkGameWin,
  getBlockAtCell: getBlockAtCell,
  cloneBlock: cloneBlock,
};
