// Main game scene — board, palette, controls, hints, drag
var R = require('./render');
var B = require('./board');
var PG = require('./puzzleGenerator');
var stamina = require('./stamina');
var shareState = require('./shareState');
var progress = require('./progress');
var initialBlockTypes = B.initialBlockTypes;

var DRAG_THRESHOLD = 8;

module.exports = function createGameScene(difficulty, puzzle, safeInsets, menuRect, callbacks) {
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

  var switchMode = 'random'; // 'random' or 'manual'; toggled by the caret
  var selectPanelOpen = false;
  var selectScrollY = 0;
  var solutionCount = -1;
  var solutionCountText = '\u89E3\u6CD5: \u8BA1\u7B97\u4E2D...';
  var playedCombos = puzzle._playedCombos || {};
  playedCombos[puzzle.currentComboIndex] = true;
  puzzle._playedCombos = playedCombos;
  var wonCombos = puzzle._wonCombos || progress.getWonCombos(puzzle.dateStr, difficulty);
  puzzle._wonCombos = wonCombos;

  // Async solution count
  var solutionCountTimer = setTimeout(function () {
    var combo = puzzle.allCombinations[puzzle.currentComboIndex];
    solutionCount = PG.countSolutionsForCombo(puzzle.solvedBoard, combo);
    solutionCountText = '\u89E3\u6CD5: ' + solutionCount;
    scene.dirty = true;
  }, 50);

  // Drag state (not in data, just local)
  var dragging = null;
  var dragHasMoved = false;
  var dragStart = { x: 0, y: 0 };
  var dragPos = { x: 0, y: 0 };
  var lastTap = { time: 0, x: -1, y: -1 };
  var gestureStart = { x: 0, y: 0, t: 0, fromEdge: false };

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
        wonCombos[puzzle.currentComboIndex] = true;
        progress.markWonCombo(puzzle.dateStr, difficulty, puzzle.currentComboIndex);
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
  }

  // ---- Switch puzzle (stamina-aware) ----
  function switchCost() { return PG.DIFFICULTY_CONFIG[difficulty].digCount; }

  function executeRandomSwitch() {
    var combos = puzzle.allCombinations;
    var available = [];
    for (var ai = 0; ai < combos.length; ai++) {
      if (!playedCombos[ai]) available.push(ai);
    }
    if (available.length === 0) {
      playedCombos = {};
      for (var ai2 = 0; ai2 < combos.length; ai2++) available.push(ai2);
    }
    var newIdx = available[Math.floor(Math.random() * available.length)];
    playedCombos[newIdx] = true;
    var parts = PG.puzzleFromCombo(puzzle.solvedBoard, combos[newIdx]);
    callbacks.onSwitchPuzzle({
      prePlacedBlocks: parts.prePlacedBlocks,
      remainingBlocks: parts.remainingBlocks,
      difficulty: difficulty,
      solvedBoard: puzzle.solvedBoard,
      allCombinations: combos,
      currentComboIndex: newIdx,
      dateStr: puzzle.dateStr,
      _playedCombos: playedCombos,
      _wonCombos: wonCombos,
    });
  }

  function executeManualSwitch(newIdx) {
    playedCombos[newIdx] = true;
    var parts = PG.puzzleFromCombo(puzzle.solvedBoard, puzzle.allCombinations[newIdx]);
    selectPanelOpen = false;
    callbacks.onSwitchPuzzle({
      prePlacedBlocks: parts.prePlacedBlocks,
      remainingBlocks: parts.remainingBlocks,
      difficulty: difficulty,
      solvedBoard: puzzle.solvedBoard,
      allCombinations: puzzle.allCombinations,
      currentComboIndex: newIdx,
      dateStr: puzzle.dateStr,
      _playedCombos: playedCombos,
      _wonCombos: wonCombos,
    });
  }

  // Wrap a switch action with stamina check + confirm modal when current puzzle is incomplete.
  function confirmAndSwitch(doSwitch) {
    if (isWon) { doSwitch(); return; }
    var cost = switchCost();
    var have = stamina.getStamina();
    if (have < cost) {
      showMsg('\u4F53\u529B\u4E0D\u8DB3\uFF01\u9700\u8981 ' + cost + ' \u70B9\uFF0C\u5F53\u524D ' + have + ' \u70B9');
      return;
    }
    wx.showModal({
      title: '\u6362\u9898\u6D88\u8017\u4F53\u529B',
      content: '\u5F53\u524D\u9898\u76EE\u672A\u5B8C\u6210\uFF0C\u6362\u9898\u5C06\u6D88\u8017 ' + cost + ' \u70B9\u4F53\u529B\uFF08\u5F53\u524D ' + have + ' \u70B9\uFF09\u3002\u662F\u5426\u7EE7\u7EED\uFF1F',
      confirmText: '\u7EE7\u7EED',
      cancelText: '\u53D6\u6D88',
      success: function (res) {
        if (!res.confirm) return;
        if (!stamina.consumeStamina(cost)) {
          showMsg('\u4F53\u529B\u4E0D\u8DB3\uFF01\u9700\u8981 ' + cost + ' \u70B9\uFF0C\u5F53\u524D ' + stamina.getStamina() + ' \u70B9');
          scene.dirty = true;
          return;
        }
        doSwitch();
      },
    });
  }

  // ---- LAYOUT COMPUTATION ----
  function computeLayout(W, H) {
    var padTop = safeInsets.top || 0;
    var padBottom = safeInsets.bottom || 0;
    var menuBottom = menuRect.bottom || 0;
    var pad = 10;

    // Back arrow button at the very top-left (above the timer).
    var backSize = 28;
    L.backBtn = { x: pad, y: padTop + 6, w: backSize, h: backSize };

    // Start content below the back arrow (and below the menu capsule on the right).
    var y = Math.max(L.backBtn.y + L.backBtn.h + 4, menuBottom + 6);

    // Header
    L.headerY = y;
    y += 28 + 4;

    // Count
    L.countY = y;
    y += 16 + 4;

    // Message
    L.msgY = y;
    if (message) y += 18 + 4;

    // Invite-friends button (only when game is won)
    L.inviteBtn = null;
    if (isWon) {
      var ibtnH = 36;
      L.inviteBtn = { x: pad, y: y, w: W - 2 * pad, h: ibtnH };
      y += ibtnH + 8;
    }

    // Controls — row 1: action buttons + switch area
    var btnGap = 6;
    var btnH = 28;
    L.ctrlY = y;
    L.ctrlBtns = [];

    // Left: hint button only (rotate/flip moved to preview row).
    var leftBtnW = Math.floor((W * 0.45 - pad - 2 * btnGap) / 3);
    L.ctrlBtns.push({
      x: pad, y: y, w: leftBtnW, h: btnH,
      label: '\u63D0\u793A', color: '#FF9800', action: 'hint',
    });

    // Right: split-button. Main part executes current switchMode; caret toggles the dropdown.
    var rightX = W * 0.5;
    var modeW = 40;
    var switchW = W - rightX - modeW - btnGap - pad;
    var switchBtnX = rightX + modeW + btnGap;
    var totalCombos = puzzle.allCombinations.length;
    var caretW = 26;
    L.switchMainBtn = { x: switchBtnX, y: y, w: switchW - caretW, h: btnH };
    L.switchCaretBtn = { x: switchBtnX + switchW - caretW, y: y, w: caretW, h: btnH };
    L.switchTotalCombos = totalCombos;

    y += btnH + 8;

    // Board
    var safeH = H - padTop - padBottom;
    var maxBoardH = safeH * 0.42;
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

    // Preview row: [rotate 0.191][shape 0.618][flip 0.191] horizontal split.
    L.previewY = y;
    L.previewH = 0;
    L.previewRotateBtn = null;
    L.previewFlipBtn = null;
    L.previewShape = null;
    if (selected && !dragging) {
      var prevCS = Math.floor(cellSize * 0.6);
      // Fixed to 4-cell height so the row doesn't resize when the player rotates the block.
      var rowH = 4 * prevCS + 12;
      var totalW = W - 2 * pad;
      var gapW = Math.floor(totalW * 0.05);
      var shapeAreaW = Math.floor(totalW * 0.618 * 0.9);
      var sideW = Math.floor((totalW - shapeAreaW - 2 * gapW) / 2);
      L.previewFlipBtn = { x: pad, y: y, w: sideW, h: rowH };
      L.previewShape = { x: pad + sideW + gapW, y: y, w: shapeAreaW, h: rowH };
      L.previewRotateBtn = { x: pad + sideW + gapW + shapeAreaW + gapW, y: y, w: sideW, h: rowH };
      L.previewH = rowH;
      y += L.previewH + 8;
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

    // Select panel popup
    if (selectPanelOpen) {
      var spW = W * 0.9, spH = H * 0.75;
      L.selectPanel = { x: (W - spW) / 2, y: (H - spH) / 2, w: spW, h: spH };
      L.selectCloseBtn = { x: L.selectPanel.x + (spW - 80) / 2, y: L.selectPanel.y + spH - 45, w: 80, h: 30 };

      var combos = puzzle.allCombinations;
      var thumbCS = 6;
      var thumbW = thumbCS * 7 + 8;
      var thumbH = thumbCS * 8 + 20;
      var thumbGap = 8;
      var cols = Math.floor((spW - 30) / (thumbW + thumbGap));
      if (cols < 1) cols = 1;

      L.selectItems = [];
      var sx = L.selectPanel.x + 15, sy = L.selectPanel.y + 45;
      var col = 0;
      for (var si = 0; si < combos.length; si++) {
        var ix = sx + col * (thumbW + thumbGap);
        var iy = sy + Math.floor(si / cols) * (thumbH + thumbGap);
        L.selectItems.push({ x: ix, y: iy, w: thumbW, h: thumbH, comboIndex: si });
        col = (col + 1) % cols;
      }

      L.selectContentH = Math.ceil(combos.length / cols) * (thumbH + thumbGap);
      L.selectVisibleH = spH - 90;
    }
  }

  // ---- RENDER ----
  scene.render = function (ctx, W, H) {
    computeLayout(W, H);
    R.clear(ctx, W, H);

    var pad = 10;
    var cs = L.cellSize;

    // Back arrow (top-left). Drawn as a chevron pointing left.
    if (L.backBtn) {
      var bb = L.backBtn;
      var bcx = bb.x + bb.w / 2, bcy = bb.y + bb.h / 2;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bcx + bb.w * 0.18, bcy - bb.h * 0.28);
      ctx.lineTo(bcx - bb.w * 0.18, bcy);
      ctx.lineTo(bcx + bb.w * 0.18, bcy + bb.h * 0.28);
      ctx.stroke();
    }

    // Header
    R.textBold(ctx, B.formatTime(timer), pad, L.headerY, 22, '#333');
    R.textBold(ctx, diffLabel, W / 2, L.headerY + 2, 16, '#4CAF50', 'center');
    // Stamina: place left of capsule button to avoid overlap
    var staText = '\u4F53\u529B ' + stamina.getStamina();
    var staW = 60, staH = 22;
    var staX = (menuRect.left || W) - staW - 6;
    R.roundRect(ctx, staX, L.headerY, staW, staH, 4, '#FFF3E0', '#FFB74D');
    R.text(ctx, staText, staX + staW / 2, L.headerY + 4, 11, '#E65100', 'center');

    // Count
    R.text(ctx, '\u5DF2\u653E\u7F6E: ' + dropped.length + ' / ' + puzzle.remainingBlocks.length, W / 2, L.countY, 12, '#888', 'center');

    // Solution count (async)
    R.text(ctx, solutionCountText, W - pad, L.countY, 12, '#999', 'right');

    // Message
    if (message) {
      R.textBold(ctx, message, W / 2, L.msgY, 14, msgIsWin ? '#FF4500' : '#2196F3', 'center');
    }

    // Invite friends button (on win)
    if (L.inviteBtn) {
      R.button(ctx, L.inviteBtn.x, L.inviteBtn.y, L.inviteBtn.w, L.inviteBtn.h, '🎯 邀请朋友挑战这一题', '#FF5722', '#fff', 8);
    }

    // Controls — hint + other future ctrl buttons in L.ctrlBtns
    for (var ci = 0; ci < L.ctrlBtns.length; ci++) {
      var cb = L.ctrlBtns[ci];
      R.button(ctx, cb.x, cb.y, cb.w, cb.h, cb.label, cb.color, '#fff', 4);
    }

    // 换题 split-button: solid red background spans both halves; main label on
    // the left, separator, caret on the right.
    if (L.switchMainBtn && L.switchCaretBtn) {
      var mB = L.switchMainBtn, cB = L.switchCaretBtn;
      var swColor = switchMode === 'manual' ? '#009688' : '#9C27B0';
      R.roundRect(ctx, mB.x, mB.y, mB.w + cB.w, mB.h, 4, swColor);
      var swLabel = (switchMode === 'manual' ? '手动换题' : '随机换题') + '(' + L.switchTotalCombos + ')';
      R.textBold(ctx, swLabel, mB.x + mB.w / 2, mB.y + mB.h / 2, 12, '#fff', 'center', 'middle');
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cB.x, cB.y + 4);
      ctx.lineTo(cB.x, cB.y + cB.h - 4);
      ctx.stroke();
      R.textBold(ctx, '▾', cB.x + cB.w / 2, cB.y + cB.h / 2, 14, '#fff', 'center', 'middle');
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

    // Preview row: [rotate button][shape area][flip button] with 0.191/0.618/0.191 split.
    if (selected && !dragging && L.previewShape) {
      var prevCS = Math.floor(cs * 0.6);
      var rB = L.previewRotateBtn, fB = L.previewFlipBtn, sB = L.previewShape;
      R.button(ctx, rB.x, rB.y, rB.w, rB.h, '\u65CB\u8F6C', '#4CAF50', '#fff', 6);
      R.button(ctx, fB.x, fB.y, fB.w, fB.h, '\u7FFB\u8F6C', '#2196F3', '#fff', 6);
      R.roundRect(ctx, sB.x, sB.y, sB.w, sB.h, 6, '#f7f7f7', '#4CAF50');
      var shapeBlockW = selected.shape[0].length * prevCS;
      var shapeBlockH = selected.shape.length * prevCS;
      var shapeBlockX = sB.x + (sB.w - shapeBlockW) / 2;
      var shapeBlockY = sB.y + (sB.h - shapeBlockH) / 2;
      R.blockShape(ctx, selected.shape, selected.color, shapeBlockX, shapeBlockY, prevCS);
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

    // Select panel popup
    if (selectPanelOpen && L.selectPanel) {
      R.overlay(ctx, W, H);
      var sp = L.selectPanel;
      R.roundRect(ctx, sp.x, sp.y, sp.w, sp.h, 16, '#fff');
      var totalCombos2 = puzzle.allCombinations.length;
      R.textBold(ctx, '\u9009\u62E9\u9898\u76EE (\u5171 ' + totalCombos2 + ' \u9898)', sp.x + sp.w / 2, sp.y + 18, 16, '#333', 'center');

      ctx.save();
      ctx.beginPath();
      ctx.rect(sp.x, sp.y + 40, sp.w, L.selectVisibleH);
      ctx.clip();

      var combos2 = puzzle.allCombinations;
      var sb = puzzle.solvedBoard;
      var tCS = 6;
      for (var si2 = 0; si2 < L.selectItems.length; si2++) {
        var item = L.selectItems[si2];
        var iy2 = item.y - selectScrollY;
        if (iy2 + item.h < sp.y + 40 || iy2 > sp.y + 40 + L.selectVisibleH) continue;

        var isCurrent = item.comboIndex === puzzle.currentComboIndex;
        var borderColor = isCurrent ? '#4CAF50' : '#ddd';
        var bgColor = isCurrent ? '#E8F5E9' : '#fafafa';
        R.roundRect(ctx, item.x, iy2, item.w, item.h, 4, bgColor, borderColor);
        if (isCurrent) {
          ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 2;
          ctx.strokeRect(item.x, iy2, item.w, item.h);
        }

        var combo = combos2[item.comboIndex];
        var bx0 = item.x + 4, by0 = iy2 + 2;
        for (var ty = 0; ty < 8; ty++) {
          for (var tx = 0; tx < 7; tx++) {
            var ch = sb[ty][tx];
            var px2 = bx0 + tx * tCS, py2 = by0 + ty * tCS;
            if (ch === '#' || ch === '*') {
              ctx.fillStyle = ch === '*' ? '#F0E68C' : '#eee';
            } else if (combo.indexOf(ch) >= 0) {
              ctx.fillStyle = '#fff';
            } else {
              var bc = '#ccc';
              for (var bi = 0; bi < initialBlockTypes.length; bi++) {
                if (initialBlockTypes[bi].label === ch) { bc = initialBlockTypes[bi].color; break; }
              }
              ctx.fillStyle = bc;
              ctx.globalAlpha = 0.6;
            }
            ctx.fillRect(px2, py2, tCS, tCS);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 0.3;
            ctx.strokeRect(px2, py2, tCS, tCS);
          }
        }

        R.text(ctx, '#' + (item.comboIndex + 1), item.x + item.w / 2, iy2 + item.h - 14, 9, '#999', 'center');

        if (wonCombos[item.comboIndex]) {
          var badgeR = 8;
          var bcx = item.x + item.w - badgeR - 2;
          var bcy2 = iy2 + badgeR + 2;
          ctx.beginPath();
          ctx.arc(bcx, bcy2, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = '#4CAF50';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(bcx - badgeR * 0.45, bcy2 + badgeR * 0.05);
          ctx.lineTo(bcx - badgeR * 0.10, bcy2 + badgeR * 0.40);
          ctx.lineTo(bcx + badgeR * 0.50, bcy2 - badgeR * 0.35);
          ctx.stroke();
        }
      }

      ctx.restore();
      R.button(ctx, L.selectCloseBtn.x, L.selectCloseBtn.y, L.selectCloseBtn.w, L.selectCloseBtn.h, '\u53D6\u6D88', '#eee', '#333', 6);
    }

    // Drag ghost
    if (dragging && dragHasMoved) {
      R.blockShape(ctx, dragging.shape, dragging.color, dragPos.x - cs, dragPos.y - cs, cs, 0.7);
    }
  };

  // ---- TOUCH HANDLING ----
  scene.onTouchStart = function (x, y) {
    // Record every touch start for swipe-back / tap-vs-drag detection.
    gestureStart = { x: x, y: y, t: Date.now(), fromEdge: x < 24 };

    if (selectPanelOpen) {
      dragStart = { x: x, y: y };
      return;
    }
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

    // Only the preview *shape area* initiates a drag — the side rotate/flip
    // buttons stay as taps.
    if (selected && !dragging && L.previewShape) {
      if (R.hitTest(x, y, L.previewShape)) {
        dragging = selected;
        dragHasMoved = false;
        dragStart = { x: x, y: y };
        dragPos = { x: x, y: y };
        return;
      }
    }
  };

  scene.onTouchMove = function (x, y) {
    // Panel scroll
    if (selectPanelOpen && L.selectPanel) {
      if (!dragging) {
        var scrollDelta = dragStart.y - y;
        selectScrollY = Math.max(0, Math.min(selectScrollY + scrollDelta * 0.5, Math.max(0, L.selectContentH - L.selectVisibleH)));
        dragStart = { x: x, y: y };
        scene.dirty = true;
        return;
      }
    }
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
    // Select panel
    if (selectPanelOpen) {
      if (L.selectCloseBtn && R.hitTest(x, y, L.selectCloseBtn)) {
        selectPanelOpen = false; scene.dirty = true; return;
      }
      if (L.selectPanel && !R.hitTest(x, y, L.selectPanel)) {
        selectPanelOpen = false; scene.dirty = true; return;
      }
      if (L.selectItems) {
        for (var si3 = 0; si3 < L.selectItems.length; si3++) {
          var sItem = L.selectItems[si3];
          var adjY = sItem.y - selectScrollY;
          var adjRect = { x: sItem.x, y: adjY, w: sItem.w, h: sItem.h };
          if (R.hitTest(x, y, adjRect)) {
            var newIdx2 = sItem.comboIndex;
            if (newIdx2 === puzzle.currentComboIndex) {
              selectPanelOpen = false; scene.dirty = true; return;
            }
            confirmAndSwitch(function () { executeManualSwitch(newIdx2); });
            return;
          }
        }
      }
      return;
    }

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
        // Tap: select block (no message — the preview row already shows it)
        selected = dragging;
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

    // Invite friends button (visible on win). Must call wx.shareAppMessage
    // synchronously inside the touch handler — WeChat rejects async calls.
    if (L.inviteBtn && R.hitTest(x, y, L.inviteBtn)) {
      try {
        wx.shareAppMessage(shareState.buildShareData());
      } catch (e) {}
      return;
    }

    // Back arrow (top-left)
    if (L.backBtn && R.hitTest(x, y, L.backBtn)) {
      clearInterval(timerInterval);
      callbacks.onBack();
      return;
    }

    // Preview rotate button (left side of the preview shape)
    if (L.previewRotateBtn && R.hitTest(x, y, L.previewRotateBtn)) {
      if (selected) {
        if (hintedIds.indexOf(selected.id) >= 0) {
          showMsg('\u8BE5\u65B9\u5757\u65B9\u5411\u5DF2\u9501\u5B9A');
          return;
        }
        selected.shape = B.rotateShape(selected.shape);
        for (var rp = 0; rp < palette.length; rp++) {
          if (palette[rp].id === selected.id) palette[rp].shape = selected.shape;
        }
        scene.dirty = true;
      }
      return;
    }

    // Preview flip button (right side of the preview shape)
    if (L.previewFlipBtn && R.hitTest(x, y, L.previewFlipBtn)) {
      if (selected) {
        if (hintedIds.indexOf(selected.id) >= 0) {
          showMsg('\u8BE5\u65B9\u5757\u65B9\u5411\u5DF2\u9501\u5B9A');
          return;
        }
        selected.shape = B.flipShape(selected.shape);
        for (var fp = 0; fp < palette.length; fp++) {
          if (palette[fp].id === selected.id) palette[fp].shape = selected.shape;
        }
        scene.dirty = true;
      }
      return;
    }

    // 换题 split-button: caret toggles mode directly; main body executes current mode.
    if (L.switchCaretBtn && R.hitTest(x, y, L.switchCaretBtn)) {
      switchMode = switchMode === 'random' ? 'manual' : 'random';
      scene.dirty = true;
      return;
    }
    if (L.switchMainBtn && R.hitTest(x, y, L.switchMainBtn)) {
      if (switchMode === 'manual') {
        // Manual mode: open the combo panel; stamina check happens when a
        // combo is actually picked (so cancelling the panel costs nothing).
        selectPanelOpen = true;
        selectScrollY = 0;
        scene.dirty = true;
      } else {
        confirmAndSwitch(executeRandomSwitch);
      }
      return;
    }

    // Other control buttons (hint, etc.) still go through L.ctrlBtns.
    for (var ci = 0; ci < L.ctrlBtns.length; ci++) {
      if (R.hitTest(x, y, L.ctrlBtns[ci])) {
        var action = L.ctrlBtns[ci].action;
        if (action === 'hint') {
          hintMode = true; scene.dirty = true;
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

    // Edge-swipe back: touch started within the left edge and moved right
    // far enough horizontally, with limited vertical drift.
    if (gestureStart.fromEdge && !dragging) {
      var sdx = x - gestureStart.x;
      var sdy = Math.abs(y - gestureStart.y);
      if (sdx > 60 && sdy < sdx) {
        clearInterval(timerInterval);
        callbacks.onBack();
        return;
      }
    }
  };

  scene.update = function () {};

  scene.destroy = function () {
    clearInterval(timerInterval);
    if (msgTimer) clearTimeout(msgTimer);
    if (solutionCountTimer) clearTimeout(solutionCountTimer);
  };

  return scene;
};
