// Main game scene — board, palette, controls, hints, drag
var R = require('./render');
var B = require('./board');
var PG = require('./puzzleGenerator');
var stamina = require('./stamina');

var DRAG_THRESHOLD = 8;

module.exports = function createGameScene(difficulty, puzzle, callbacks) {
  var scene = {};
  scene.dirty = true;

  // State
  var prePlaced = puzzle.prePlacedBlocks;
  var dropped = [];
  var palette = puzzle.remainingBlocks.map(function (b) { return B.cloneBlock(b); });
  var selected = null; // selected block from palette
  var timer = 0;
  var isWon = false;
  var message = '';
  var msgIsWin = false;
  var msgTimer = null;
  var hintMode = false;
  var hintedIds = [];
  var uncov = B.getUncoverableCells();
  var diffLabel = PG.DIFFICULTY_CONFIG[difficulty].label;

  // Drag state (not in data, just local)
  var dragging = null;
  var dragHasMoved = false;
  var dragStart = { x: 0, y: 0 };
  var dragPos = { x: 0, y: 0 };
  var lastTap = { time: 0, x: -1, y: -1 };

  // Timer interval
  var timerInterval = setInterval(function () {
    if (!isWon) { timer++; scene.dirty = true; }
  }, 1000);

  // Layout (computed per render)
  var L = {};

  function showMsg(m, win) {
    message = m; msgIsWin = !!win; scene.dirty = true;
    if (msgTimer) clearTimeout(msgTimer);
    if (!win && m) msgTimer = setTimeout(function () { message = ''; scene.dirty = true; }, 3000);
  }

  function allBlocks() { return prePlaced.concat(dropped); }

  function isPrePlaced(id) {
    for (var i = 0; i < prePlaced.length; i++) if (prePlaced[i].id === id) return true;
    return false;
  }

  function checkWin() {
    if (isWon) return;
    if (dropped.length === puzzle.remainingBlocks.length) {
      if (B.checkGameWin(allBlocks(), uncov)) {
        isWon = true;
        clearInterval(timerInterval);
        showMsg('\u606D\u559C\u901A\u5173\uFF01', true);
      }
    }
  }

  function placeBlock(block, cx, cy) {
    var nb = B.cloneBlock(block);
    nb.x = cx; nb.y = cy;
    dropped.push(nb);
    palette = palette.filter(function (b) { return b.id !== block.id; });
    selected = null;
    scene.dirty = true;
    showMsg('\u653E\u7F6E\u6210\u529F\uFF01');
    checkWin();
  }

  function removeDropped(id) {
    var bl = null;
    for (var i = 0; i < dropped.length; i++) if (dropped[i].id === id) { bl = dropped[i]; break; }
    if (!bl) return;
    dropped = dropped.filter(function (b) { return b.id !== id; });
    var restored = B.cloneBlock(bl);
    delete restored.x; delete restored.y;
    palette.push(restored);
    selected = null;
    scene.dirty = true;
    showMsg('\u5DF2\u79FB\u9664\u65B9\u5757');
  }

  // ---- LAYOUT COMPUTATION ----
  function computeLayout(W, H) {
    var pad = 10;
    var y = pad;

    // Header
    L.headerY = y;
    y += 28 + 4;

    // Count
    L.countY = y;
    y += 16 + 4;

    // Message
    L.msgY = y;
    if (message) y += 18 + 4;

    // Controls
    var btnGap = 6;
    var btnCount = 5;
    var btnW = Math.floor((W - 2 * pad - (btnCount - 1) * btnGap) / btnCount);
    var btnH = 28;
    L.ctrlY = y;
    L.ctrlBtns = [];
    var labels = ['\u65CB\u8F6C', '\u7FFB\u8F6C', '\u63D0\u793A', '\u6362\u9898', '\u8FD4\u56DE'];
    var colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#757575'];
    for (var i = 0; i < btnCount; i++) {
      L.ctrlBtns.push({
        x: pad + i * (btnW + btnGap), y: y, w: btnW, h: btnH,
        label: labels[i], color: colors[i], action: ['rotate', 'flip', 'hint', 'restart', 'back'][i],
      });
    }
    y += btnH + 8;

    // Board
    var maxBoardH = H * 0.42;
    var cellSize = Math.min(Math.floor((W - 2 * pad) / 7), Math.floor(maxBoardH / 8));
    var boardW = cellSize * 7;
    var boardH = cellSize * 8;
    var boardX = Math.floor((W - boardW) / 2);
    L.boardX = boardX;
    L.boardY = y;
    L.cellSize = cellSize;
    L.boardW = boardW;
    L.boardH = boardH;
    y += boardH + 8;

    // Preview
    L.previewY = y;
    L.previewH = 0;
    if (selected && !dragging) {
      L.previewH = 16 + selected.shape.length * Math.floor(cellSize * 0.6) + 8;
      y += L.previewH + 4;
    }

    // Palette
    L.paletteY = y;
    var palCellSize = Math.floor(cellSize * 0.45);
    L.palCellSize = palCellSize;
    // Calculate palette item rects
    L.palItems = [];
    if (palette.length > 0) {
      y += 18; // title
      var itemPad = 6;
      var maxItemW = 0;
      // Estimate item sizes
      var items = [];
      for (var p = 0; p < palette.length; p++) {
        var bl = palette[p];
        var iw = bl.shape[0].length * palCellSize + 2 * itemPad;
        var ih = 14 + bl.shape.length * palCellSize + 2 * itemPad;
        if (iw < 40) iw = 40;
        items.push({ block: bl, w: iw, h: ih });
      }
      // Layout items in rows
      var ix = pad, iy = y;
      var maxRowH = 0;
      for (var pi = 0; pi < items.length; pi++) {
        if (ix + items[pi].w > W - pad && ix > pad) {
          ix = pad;
          iy += maxRowH + 6;
          maxRowH = 0;
        }
        L.palItems.push({ x: ix, y: iy, w: items[pi].w, h: items[pi].h, block: items[pi].block });
        ix += items[pi].w + 6;
        if (items[pi].h > maxRowH) maxRowH = items[pi].h;
      }
      y = iy + maxRowH + 6;
    }

    // Placed list
    L.placedY = y;
    L.placedBtns = [];
    if (dropped.length > 0) {
      y += 18; // title
      var px2 = pad;
      for (var di = 0; di < dropped.length; di++) {
        var db = dropped[di];
        var bw = 40, bh = 24;
        if (px2 + bw > W - pad) { px2 = pad; y += bh + 6; }
        L.placedBtns.push({ x: px2, y: y, w: bw, h: bh, block: db });
        px2 += bw + 6;
      }
    }

    // Hint popup
    if (hintMode) {
      var popW = W * 0.75, popH = H * 0.5;
      L.hintPopup = { x: (W - popW) / 2, y: (H - popH) / 2, w: popW, h: popH };
      var candidates = [];
      for (var ci = 0; ci < palette.length; ci++) candidates.push(palette[ci]);
      for (var cj = 0; cj < dropped.length; cj++) candidates.push(dropped[cj]);
      L.hintItems = [];
      var hx = L.hintPopup.x + 20, hy = L.hintPopup.y + 50;
      var hSize = 50, hGap = 10;
      for (var hi = 0; hi < candidates.length; hi++) {
        if (hx + hSize > L.hintPopup.x + L.hintPopup.w - 20) { hx = L.hintPopup.x + 20; hy += hSize + hGap; }
        L.hintItems.push({ x: hx, y: hy, w: hSize, h: hSize, block: candidates[hi] });
        hx += hSize + hGap;
      }
      L.hintCloseBtn = { x: L.hintPopup.x + (popW - 80) / 2, y: L.hintPopup.y + popH - 45, w: 80, h: 30 };
    }
  }

  // ---- RENDER ----
  scene.render = function (ctx, W, H) {
    computeLayout(W, H);
    R.clear(ctx, W, H);

    var pad = 10;
    var cs = L.cellSize;

    // Header
    R.textBold(ctx, B.formatTime(timer), pad, L.headerY, 22, '#333');
    R.textBold(ctx, diffLabel, W / 2, L.headerY + 2, 16, '#4CAF50', 'center');
    var staText = '\u4F53\u529B ' + stamina.getStamina();
    R.roundRect(ctx, W - pad - 60, L.headerY, 60, 22, 4, '#FFF3E0', '#FFB74D');
    R.text(ctx, staText, W - pad - 30, L.headerY + 4, 11, '#E65100', 'center');

    // Count
    R.text(ctx, '\u5DF2\u653E\u7F6E: ' + dropped.length + ' / ' + puzzle.remainingBlocks.length, W / 2, L.countY, 12, '#888', 'center');

    // Message
    if (message) {
      R.textBold(ctx, message, W / 2, L.msgY, 14, msgIsWin ? '#FF4500' : '#2196F3', 'center');
    }

    // Controls
    for (var ci = 0; ci < L.ctrlBtns.length; ci++) {
      var cb = L.ctrlBtns[ci];
      var disabled = !selected && (cb.action === 'rotate' || cb.action === 'flip');
      R.button(ctx, cb.x, cb.y, cb.w, cb.h, cb.label, disabled ? '#ccc' : cb.color, '#fff', 4);
    }

    // Board
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(L.boardX - 2, L.boardY - 2, L.boardW + 4, L.boardH + 4);

    var ab = allBlocks();
    for (var by = 0; by < 8; by++) {
      for (var bx = 0; bx < 7; bx++) {
        var cell = B.boardLayoutData[by][bx];
        var px = L.boardX + bx * cs;
        var py = L.boardY + by * cs;

        var blockAt = B.getBlockAtCell(ab, bx, by);
        var isUncov = false;
        for (var u = 0; u < uncov.length; u++) {
          if (uncov[u].x === bx && uncov[u].y === by) { isUncov = true; break; }
        }
        var locked = blockAt && isPrePlaced(blockAt.id);

        // Background
        if (blockAt) {
          ctx.globalAlpha = locked ? 0.6 : 0.9;
          ctx.fillStyle = blockAt.color;
          ctx.fillRect(px, py, cs, cs);
          ctx.globalAlpha = 1;
        } else if (isUncov) {
          ctx.fillStyle = B.CELL_COLORS.uncoverable;
          ctx.fillRect(px, py, cs, cs);
        } else {
          ctx.fillStyle = B.CELL_COLORS[cell.t] || '#fff';
          ctx.fillRect(px, py, cs, cs);
        }

        // Border
        ctx.strokeStyle = blockAt ? (locked ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.3)') : '#000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, cs, cs);

        // Label
        if (!blockAt && cell.t !== 'empty' && cell.v != null) {
          R.textBold(ctx, String(cell.v), px + cs / 2, py + cs / 2, Math.max(9, cs * 0.28), '#333', 'center', 'middle');
        }
      }
    }

    // Preview
    if (selected && !dragging) {
      var prevCS = Math.floor(cs * 0.6);
      R.roundRect(ctx, pad, L.previewY, W - 2 * pad, L.previewH, 8, '#f0f0f0', '#4CAF50');
      R.text(ctx, '\u5DF2\u9009\u62E9: ' + selected.label + ' (\u70B9\u51FB\u68CB\u76D8\u6216\u62D6\u52A8\u653E\u7F6E)', W / 2, L.previewY + 4, 12, '#333', 'center');
      var shapeW = selected.shape[0].length * prevCS;
      var shapeX = (W - shapeW) / 2;
      R.blockShape(ctx, selected.shape, selected.color, shapeX, L.previewY + 18, prevCS);
    }

    // Palette
    if (palette.length > 0) {
      R.text(ctx, '\u5F85\u653E\u7F6E\u65B9\u5757 (' + palette.length + ')', W / 2, L.paletteY, 14, '#666', 'center');
      for (var pi = 0; pi < L.palItems.length; pi++) {
        var item = L.palItems[pi];
        var isSel = selected && selected.id === item.block.id;
        var isHinted = hintedIds.indexOf(item.block.id) >= 0;
        var bg = isSel ? '#e8f5e9' : (isHinted ? '#E8F5E9' : '#fff');
        var border = isSel || isHinted ? '#4CAF50' : '#ddd';
        R.roundRect(ctx, item.x, item.y, item.w, item.h, 4, bg, border);
        var lbl = item.block.label + (isHinted ? ' \u2713' : '');
        R.text(ctx, lbl, item.x + item.w / 2, item.y + 3, 11, '#666', 'center');
        R.blockShape(ctx, item.block.shape, item.block.color, item.x + 6, item.y + 16, L.palCellSize);
      }
    }

    // Placed list
    if (dropped.length > 0) {
      R.text(ctx, '\u5DF2\u653E\u7F6E (\u53CC\u51FB\u68CB\u76D8\u79FB\u9664)', W / 2, L.placedY, 12, '#666', 'center');
      for (var di = 0; di < L.placedBtns.length; di++) {
        var db = L.placedBtns[di];
        R.roundRect(ctx, db.x, db.y, db.w, db.h, 4, db.block.color);
        R.textBold(ctx, db.block.label, db.x + db.w / 2, db.y + db.h / 2, 12, '#000', 'center', 'middle');
      }
    }

    // Hint popup
    if (hintMode) {
      R.overlay(ctx, W, H);
      R.roundRect(ctx, L.hintPopup.x, L.hintPopup.y, L.hintPopup.w, L.hintPopup.h, 16, '#fff');
      R.textBold(ctx, '\u9009\u62E9\u8981\u63D0\u793A\u7684\u65B9\u5757', L.hintPopup.x + L.hintPopup.w / 2, L.hintPopup.y + 18, 18, '#333', 'center');
      for (var hi = 0; hi < L.hintItems.length; hi++) {
        var ht = L.hintItems[hi];
        var alreadyHinted = hintedIds.indexOf(ht.block.id) >= 0;
        ctx.globalAlpha = alreadyHinted ? 0.4 : 0.9;
        R.roundRect(ctx, ht.x, ht.y, ht.w, ht.h, 10, ht.block.color);
        var htLbl = ht.block.label + (alreadyHinted ? ' \u2713' : '');
        R.textBold(ctx, htLbl, ht.x + ht.w / 2, ht.y + ht.h / 2, 18, '#fff', 'center', 'middle');
        ctx.globalAlpha = 1;
      }
      R.button(ctx, L.hintCloseBtn.x, L.hintCloseBtn.y, L.hintCloseBtn.w, L.hintCloseBtn.h, '\u53D6\u6D88', '#eee', '#333', 6);
    }

    // Drag ghost
    if (dragging && dragHasMoved) {
      R.blockShape(ctx, dragging.shape, dragging.color, dragPos.x - cs, dragPos.y - cs, cs, 0.7);
    }
  };

  // ---- TOUCH HANDLING ----
  scene.onTouchStart = function (x, y) {
    if (hintMode) return;

    // Check palette items
    for (var i = 0; i < L.palItems.length; i++) {
      if (R.hitTest(x, y, L.palItems[i])) {
        dragging = L.palItems[i].block;
        dragHasMoved = false;
        dragStart = { x: x, y: y };
        dragPos = { x: x, y: y };
        return;
      }
    }

    // Check preview area (drag selected block)
    if (selected && !dragging && L.previewH > 0) {
      var prevRect = { x: 10, y: L.previewY, w: 500, h: L.previewH };
      if (R.hitTest(x, y, prevRect)) {
        dragging = selected;
        dragHasMoved = false;
        dragStart = { x: x, y: y };
        dragPos = { x: x, y: y };
        return;
      }
    }
  };

  scene.onTouchMove = function (x, y) {
    if (!dragging) return;
    dragPos = { x: x, y: y };
    if (!dragHasMoved) {
      var dx = x - dragStart.x, dy = y - dragStart.y;
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragHasMoved = true;
    }
    scene.dirty = true;
  };

  scene.onTouchEnd = function (x, y) {
    // Hint popup
    if (hintMode) {
      for (var hi = 0; hi < L.hintItems.length; hi++) {
        if (R.hitTest(x, y, L.hintItems[hi])) {
          var hBlock = L.hintItems[hi].block;
          if (hintedIds.indexOf(hBlock.id) >= 0) return;
          var hs = PG.getHintShape(puzzle.solvedBoard, hBlock.label);
          if (!hs) return;
          // Update shape in palette
          for (var pi = 0; pi < palette.length; pi++) {
            if (palette[pi].id === hBlock.id) palette[pi].shape = hs;
          }
          if (selected && selected.id === hBlock.id) selected.shape = hs;
          // If placed, remove and restore
          var placed = null;
          for (var di = 0; di < dropped.length; di++) {
            if (dropped[di].id === hBlock.id) { placed = dropped[di]; break; }
          }
          if (placed) {
            dropped = dropped.filter(function (b) { return b.id !== hBlock.id; });
            var rest = B.cloneBlock(placed);
            rest.shape = hs; delete rest.x; delete rest.y;
            palette.push(rest);
          }
          hintedIds.push(hBlock.id);
          hintMode = false;
          scene.dirty = true;
          showMsg('\u5DF2\u63D0\u793A ' + hBlock.label + ' \u7684\u6B63\u786E\u65B9\u5411');
          return;
        }
      }
      if (L.hintCloseBtn && R.hitTest(x, y, L.hintCloseBtn)) {
        hintMode = false; scene.dirty = true; return;
      }
      // Click outside popup closes it
      if (L.hintPopup && !R.hitTest(x, y, L.hintPopup)) {
        hintMode = false; scene.dirty = true; return;
      }
      return;
    }

    // Handle drag end
    if (dragging) {
      if (!dragHasMoved) {
        // Tap: select block
        selected = dragging;
        showMsg('\u5DF2\u9009\u62E9: ' + dragging.label);
        dragging = null;
        scene.dirty = true;
        return;
      }
      // Drop on board
      var cs = L.cellSize;
      var gx = dragPos.x - cs;
      var gy = dragPos.y - cs;
      var cx = Math.round((gx - L.boardX) / cs);
      var cy = Math.round((gy - L.boardY) / cs);
      if (cx >= 0 && cx < 7 && cy >= 0 && cy < 8) {
        if (B.isValidPlacement(dragging, { x: cx, y: cy }, allBlocks(), uncov, dragging.id)) {
          placeBlock(dragging, cx, cy);
        } else {
          showMsg('\u65E0\u6CD5\u653E\u7F6E\uFF01');
        }
      } else {
        showMsg('\u8D85\u51FA\u68CB\u76D8\u8303\u56F4');
      }
      dragging = null;
      dragHasMoved = false;
      scene.dirty = true;
      return;
    }

    // Control buttons
    for (var ci = 0; ci < L.ctrlBtns.length; ci++) {
      if (R.hitTest(x, y, L.ctrlBtns[ci])) {
        var action = L.ctrlBtns[ci].action;
        if (action === 'rotate') {
          if (!selected) return;
          if (hintedIds.indexOf(selected.id) >= 0) { showMsg('\u8BE5\u65B9\u5757\u65B9\u5411\u5DF2\u9501\u5B9A'); return; }
          selected.shape = B.rotateShape(selected.shape);
          for (var rp = 0; rp < palette.length; rp++) if (palette[rp].id === selected.id) palette[rp].shape = selected.shape;
          scene.dirty = true;
        } else if (action === 'flip') {
          if (!selected) return;
          if (hintedIds.indexOf(selected.id) >= 0) { showMsg('\u8BE5\u65B9\u5757\u65B9\u5411\u5DF2\u9501\u5B9A'); return; }
          selected.shape = B.flipShape(selected.shape);
          for (var fp = 0; fp < palette.length; fp++) if (palette[fp].id === selected.id) palette[fp].shape = selected.shape;
          scene.dirty = true;
        } else if (action === 'hint') {
          hintMode = true; scene.dirty = true;
        } else if (action === 'restart') {
          var cost = PG.DIFFICULTY_CONFIG[difficulty].digCount;
          if (!stamina.consumeStamina(cost)) {
            showMsg('\u4F53\u529B\u4E0D\u8DB3\uFF01\u9700\u8981 ' + cost + ' \u70B9');
            return;
          }
          callbacks.onRestart(difficulty);
        } else if (action === 'back') {
          clearInterval(timerInterval);
          callbacks.onBack();
        }
        return;
      }
    }

    // Board cell tap
    var cs2 = L.cellSize;
    var tapCX = Math.floor((x - L.boardX) / cs2);
    var tapCY = Math.floor((y - L.boardY) / cs2);
    if (tapCX >= 0 && tapCX < 7 && tapCY >= 0 && tapCY < 8 && x >= L.boardX && y >= L.boardY) {
      var cellData = B.boardLayoutData[tapCY][tapCX];
      if (cellData.t === 'empty') return;

      var now = Date.now();
      var dblTap = (now - lastTap.time < 350) && lastTap.x === tapCX && lastTap.y === tapCY;
      lastTap = { time: now, x: tapCX, y: tapCY };

      if (dblTap) {
        // Double tap: remove placed block
        var blockAt = B.getBlockAtCell(allBlocks(), tapCX, tapCY);
        if (blockAt && !isPrePlaced(blockAt.id)) {
          removeDropped(blockAt.id);
        }
        return;
      }

      // Single tap: place selected
      if (!selected) return;
      if (B.isValidPlacement(selected, { x: tapCX, y: tapCY }, allBlocks(), uncov, selected.id)) {
        placeBlock(selected, tapCX, tapCY);
      } else {
        showMsg('\u65E0\u6CD5\u653E\u7F6E\uFF01');
      }
      return;
    }

    // Placed blocks tap (remove)
    for (var pi2 = 0; pi2 < L.placedBtns.length; pi2++) {
      if (R.hitTest(x, y, L.placedBtns[pi2])) {
        removeDropped(L.placedBtns[pi2].block.id);
        return;
      }
    }
  };

  scene.update = function () {};

  scene.destroy = function () {
    clearInterval(timerInterval);
    if (msgTimer) clearTimeout(msgTimer);
  };

  return scene;
};
