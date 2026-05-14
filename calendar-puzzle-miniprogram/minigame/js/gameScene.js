// Main game scene — board, palette, controls, hints, drag.
// v0.3.0 UX rewrite: compact top header, brand-green controls, three-state
// board cells, unified palette cards, snap feedback, top toast, wheel scroll.
var R = require('./render');
var B = require('./board');
var PG = require('./puzzleGenerator');
var stamina = require('./stamina');
var shareState = require('./shareState');
var progress = require('./progress');
var initialBlockTypes = B.initialBlockTypes;

var DRAG_THRESHOLD = 8;
var BRAND = '#43A047';        // primary action green
var BRAND_DARK = '#2E7D32';   // emphasis green (selected ring, focus)
var BRAND_LIGHT = '#E8F5E9';  // selected-card bg, soft tints
var NEUTRAL = '#9E9E9E';      // secondary action grey

// Snap animation — 60ms ease-out, makes "落子有重量"
var SNAP_DUR = 60;
// Palette breathing — first-card pulse for 1.5s on first launch
var BREATH_DUR = 1500;

module.exports = function createGameScene(difficulty, puzzle, safeInsets, menuRect, callbacks) {
  var scene = {};
  scene.dirty = true;

  // ---- State ----
  var prePlaced = puzzle.prePlacedBlocks;
  var dropped = [];
  var palette = puzzle.remainingBlocks.map(function (b) { return B.cloneBlock(b); });
  var paletteOrder = palette.map(function (b) { return b.id; }); // stable display order
  var selected = null;
  var timer = 0;
  var isWon = false;
  var hintMode = false;
  var hintedIds = [];
  var uncov = B.getUncoverableCells();
  var diffCfg = PG.DIFFICULTY_CONFIG[difficulty];
  var diffLabel = diffCfg.label;
  var diffSub = diffCfg.sub || '';

  var switchMode = 'random'; // 'random' or 'manual'
  var selectPanelOpen = false;
  var selectScrollY = 0;
  var selectScrolled = false;
  var helpOpen = false;
  var solutionCount = -1;
  var playedCombos = puzzle._playedCombos || {};
  playedCombos[puzzle.currentComboIndex] = true;
  puzzle._playedCombos = playedCombos;
  var wonCombos = puzzle._wonCombos || progress.getWonCombos(puzzle.dateStr, difficulty);
  puzzle._wonCombos = wonCombos;

  // ---- Animations ----
  // Snap: list of { id, fromX, fromY, toX, toY, start } in canvas px
  var snapAnims = [];
  var breathStart = Date.now();
  // Confetti pieces seeded on win
  var confetti = [];
  var winStats = null; // { time, isNewPB, prevPB, todayDone, difficulty }
  var winCardDismissed = false;

  // ---- Toast (top-floating, doesn't push layout) ----
  var toast = { msg: '', isWin: false, start: 0, dur: 5000 };
  function showToast(msg, win) {
    toast.msg = msg;
    toast.isWin = !!win;
    toast.start = Date.now();
    toast.dur = win ? 999999 : 5000;
    scene.dirty = true;
  }

  // Async solution count
  var solutionCountTimer = setTimeout(function () {
    var combo = puzzle.allCombinations[puzzle.currentComboIndex];
    solutionCount = PG.countSolutionsForCombo(puzzle.solvedBoard, combo.letters);
    scene.dirty = true;
  }, 50);

  // ---- Drag state ----
  var dragging = null;
  var dragHasMoved = false;
  var dragEnteredBoard = false; // snapped to a real grid cell at least once
  var dragStart = { x: 0, y: 0 };
  var dragPos = { x: 0, y: 0 };
  var lastTap = { time: 0, x: -1, y: -1 };
  var gestureStart = { x: 0, y: 0, t: 0, fromEdge: false };

  var timerInterval = setInterval(function () {
    if (!isWon) { timer++; scene.dirty = true; }
  }, 1000);

  // Animation tick — kicks render while any animation is active.
  var animTimer = setInterval(function () {
    var now = Date.now();
    var alive = false;
    snapAnims = snapAnims.filter(function (a) {
      if (now - a.start < SNAP_DUR) { alive = true; return true; }
      return false;
    });
    if (palette.length > 0 && now - breathStart < BREATH_DUR) alive = true;
    if (alive) scene.dirty = true;
  }, 16);

  var L = {};

  function allBlocks() { return prePlaced.concat(dropped); }

  function isPrePlaced(id) {
    for (var i = 0; i < prePlaced.length; i++) if (prePlaced[i].id === id) return true;
    return false;
  }

  function spawnConfetti() {
    var colors = ['#E91E63','#FFC107','#4CAF50','#03A9F4','#9C27B0','#FF5722','#FF9800','#00BCD4'];
    confetti = [];
    for (var i = 0; i < 120; i++) {
      confetti.push({
        x: Math.random(),                  // 0..1 of canvas W
        y: -Math.random() * 0.15,          // start just above viewport
        vx: (Math.random() - 0.5) * 0.024, // horizontal drift (2× faster)
        vy: 0.022 + Math.random() * 0.028, // fall rate ~3× faster than before
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.35,
        size: 7 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        born: Date.now() + Math.random() * 120, // all spawned within 120ms
      });
    }
    scene.dirty = true;
  }

  function checkWin() {
    if (isWon) return;
    if (dropped.length === puzzle.remainingBlocks.length) {
      if (B.checkGameWin(allBlocks(), uncov)) {
        isWon = true;
        wonCombos[puzzle.currentComboIndex] = true;
        progress.markWonCombo(puzzle.dateStr, difficulty, puzzle.currentComboIndex);
        var pb = progress.recordTime(puzzle.dateStr, difficulty, timer);
        winStats = {
          time: timer,
          isNewPB: pb.isNew,
          prevPB: pb.prev,
          todayDone: progress.countCompletedForDate(puzzle.dateStr),
        };
        clearInterval(timerInterval);
        spawnConfetti();
        showToast('🎉 恭喜通关！', true);
        try { wx.vibrateLong && wx.vibrateLong(); } catch (e) {}
      }
    }
  }

  function placeBlock(block, cx, cy, fromX, fromY) {
    var nb = B.cloneBlock(block);
    nb.x = cx; nb.y = cy;
    dropped.push(nb);
    palette = palette.filter(function (b) { return b.id !== block.id; });
    selected = null;
    // Kick snap animation from the drag-release position to the target cell.
    if (fromX != null && fromY != null && L.cellSize) {
      snapAnims.push({
        id: nb.id,
        fromX: fromX, fromY: fromY,
        toX: L.boardX + cx * L.cellSize,
        toY: L.boardY + cy * L.cellSize,
        start: Date.now(),
        shape: nb.shape,
        color: nb.color,
      });
    }
    try { wx.vibrateShort && wx.vibrateShort({ type: 'medium' }); } catch (e) {}
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

  function resetAllPlaced() {
    if (dropped.length === 0) return;
    for (var i = dropped.length - 1; i >= 0; i--) {
      var bl = dropped[i];
      var restored = B.cloneBlock(bl);
      delete restored.x; delete restored.y;
      palette.push(restored);
    }
    dropped = [];
    selected = null;
    scene.dirty = true;
  }

  function paletteRectFor(blockId) {
    for (var i = 0; i < L.palItems.length; i++) {
      if (L.palItems[i].block.id === blockId) return L.palItems[i];
    }
    return null;
  }


  // ---- Switch puzzle (stamina-aware) ----
  function switchCost() { return diffCfg.digCount; }

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
    var newCombo = combos[newIdx];
    var newBase = puzzle.bases ? puzzle.bases[newCombo.baseIdx] : puzzle.solvedBoard;
    var parts = PG.puzzleFromCombo(newBase, newCombo.letters);
    callbacks.onSwitchPuzzle({
      prePlacedBlocks: parts.prePlacedBlocks,
      remainingBlocks: parts.remainingBlocks,
      difficulty: difficulty,
      solvedBoard: newBase,
      bases: puzzle.bases,
      allCombinations: combos,
      currentComboIndex: newIdx,
      dateStr: puzzle.dateStr,
      _playedCombos: playedCombos,
      _wonCombos: wonCombos,
    });
  }

  function executeManualSwitch(newIdx) {
    playedCombos[newIdx] = true;
    var newCombo = puzzle.allCombinations[newIdx];
    var newBase = puzzle.bases ? puzzle.bases[newCombo.baseIdx] : puzzle.solvedBoard;
    var parts = PG.puzzleFromCombo(newBase, newCombo.letters);
    selectPanelOpen = false;
    callbacks.onSwitchPuzzle({
      prePlacedBlocks: parts.prePlacedBlocks,
      remainingBlocks: parts.remainingBlocks,
      difficulty: difficulty,
      solvedBoard: newBase,
      bases: puzzle.bases,
      allCombinations: puzzle.allCombinations,
      currentComboIndex: newIdx,
      dateStr: puzzle.dateStr,
      _playedCombos: playedCombos,
      _wonCombos: wonCombos,
    });
  }

  function confirmAndSwitch(doSwitch) {
    if (isWon) { doSwitch(); return; }
    var cost = switchCost();
    var have = stamina.getStamina();
    if (have < cost) {
      showToast('体力不足！需要 ' + cost + ' 点，当前 ' + have + ' 点');
      return;
    }
    wx.showModal({
      title: '换题消耗体力',
      content: '当前题目未完成，换题将消耗 ' + cost + ' 点体力（当前 ' + have + ' 点）。是否继续？',
      confirmText: '继续',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) return;
        if (!stamina.consumeStamina(cost)) {
          showToast('体力不足！需要 ' + cost + ' 点，当前 ' + stamina.getStamina() + ' 点');
          return;
        }
        doSwitch();
      },
    });
  }

  function formatMMSS(s) {
    var m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ---- LAYOUT ----
  function computeLayout(W, H) {
    var padTop = safeInsets.top || 0;
    var padBottom = safeInsets.bottom || 0;
    var menuBottom = menuRect.bottom || 0;
    var pad = 12;

    // Back button — circular hit area (44×44) with rendered chevron at 28.
    var backHit = 44;
    L.backBtn = { x: pad - 8, y: padTop + 4, w: backHit, h: backHit };

    // ── Menu row (back arrow + WeChat capsule) ──
    var menuTop = menuRect.top || (padTop + 6);
    L.headerY = Math.max(menuTop, padTop + 6);

    // ── Title row: difficulty centered + stamina capsule on the right ──
    var titleTop = Math.max(L.backBtn.y + L.backBtn.h + 8, menuBottom + 8);
    L.diffY = titleTop;
    L.diffSubY = L.diffY + 26;
    L.timerY = L.diffSubY;
    // Stamina capsule aligned with the title row, anchored to the right edge.
    L.staminaW = 92; L.staminaH = 22;
    L.staminaX = W - L.staminaW - pad;
    L.staminaY = L.diffY + (22 - L.staminaH) / 2 + 2;

    L.switchRandomBtn = null;
    L.switchManualBtn = null;

    // Begin main content below the title row.
    var y = L.diffSubY + 22;

    // Control row: 提示 / 重开 / 🎲 / 🎯  — single line, 4 icons
    var btnH = 36, btnGap = 8;
    var ctrlBtnW = Math.floor((W - 2 * pad - 3 * btnGap) / 4);
    L.ctrlY = y;
    L.hintBtn  = { x: pad,                                   y: y, w: ctrlBtnW, h: btnH };
    L.resetBtn = { x: pad + (ctrlBtnW + btnGap) * 1,         y: y, w: ctrlBtnW, h: btnH };
    L.switchRandomBtn = { x: pad + (ctrlBtnW + btnGap) * 2,  y: y, w: ctrlBtnW, h: btnH };
    L.switchManualBtn = { x: pad + (ctrlBtnW + btnGap) * 3,  y: y, w: ctrlBtnW, h: btnH };
    y += btnH + 10;

    // Board with breathing padding + shadow
    var safeH = H - padTop - padBottom;
    var maxBoardH = safeH * 0.46;
    var cellSize = Math.min(Math.floor((W - 2 * pad) / 7), Math.floor(maxBoardH / 8));
    var boardW = cellSize * 7;
    var boardH = cellSize * 8;
    var boardX = Math.floor((W - boardW) / 2);
    L.boardX = boardX;
    L.boardY = y;
    L.cellSize = cellSize;
    L.boardW = boardW;
    L.boardH = boardH;
    y += boardH + 10;

    // Invite (only on win) — squeezed below board
    L.inviteBtn = null;
    L.shareBtn = null;
    L.winCard = null;
    L.winCloseBtn = null;
    L.winNextBtn = null;
    if (isWon) {
      var ibtnH = 36;
      L.inviteBtn = { x: pad, y: y, w: W - 2 * pad, h: ibtnH };
      y += ibtnH + 8;
    }

    // Preview row: [flip][shape][rotate]
    L.previewY = y;
    L.previewH = 0;
    L.previewRotateBtn = null;
    L.previewFlipBtn = null;
    L.previewShape = null;
    if (selected && !dragging) {
      var prevCS = Math.floor(cellSize * 0.55);
      var rowH = 4 * prevCS + 12;
      var totalW = W - 2 * pad;
      var gapW = Math.floor(totalW * 0.05);
      var shapeAreaW = Math.floor(totalW * 0.55);
      var sideW = Math.floor((totalW - shapeAreaW - 2 * gapW) / 2);
      L.previewFlipBtn = { x: pad, y: y, w: sideW, h: rowH };
      L.previewShape = { x: pad + sideW + gapW, y: y, w: shapeAreaW, h: rowH };
      L.previewRotateBtn = { x: pad + sideW + gapW + shapeAreaW + gapW, y: y, w: sideW, h: rowH };
      L.previewH = rowH;
      y += L.previewH + 8;
    }

    // Palette — unified card size grid
    L.paletteY = y;
    L.palItems = [];
    if (palette.length > 0) {
      // Cap card height by remaining vertical room so palette never overflows.
      var palAreaH = H - y - padBottom - 30; // 30 = hint footer
      var cols = palette.length <= 5 ? palette.length : Math.ceil(palette.length / 2);
      var card = Math.min(
        Math.floor((W - 2 * pad - (cols - 1) * 8) / cols),
        Math.floor(palAreaH / (palette.length > cols ? 2 : 1)) - 8,
        72
      );
      if (card < 36) card = 36;
      L.palCardSize = card;
      L.palCellSize = Math.floor(card * 0.18);
      // Display palette in a stable order: paletteOrder first, then any new items.
      var ordered = [];
      var idSeen = {};
      for (var oi = 0; oi < paletteOrder.length; oi++) {
        for (var pj = 0; pj < palette.length; pj++) {
          if (palette[pj].id === paletteOrder[oi]) { ordered.push(palette[pj]); idSeen[palette[pj].id] = true; break; }
        }
      }
      for (var pk = 0; pk < palette.length; pk++) if (!idSeen[palette[pk].id]) { ordered.push(palette[pk]); paletteOrder.push(palette[pk].id); }

      var rows = Math.ceil(ordered.length / cols);
      var totalRowW = cols * card + (cols - 1) * 8;
      var startX = Math.floor((W - totalRowW) / 2);
      for (var pi = 0; pi < ordered.length; pi++) {
        var row = Math.floor(pi / cols);
        var col = pi % cols;
        L.palItems.push({
          x: startX + col * (card + 8),
          y: y + row * (card + 8),
          w: card, h: card,
          block: ordered[pi],
        });
      }
      y += rows * card + (rows - 1) * 8 + 6;
    }

    // Bottom hint text (double-tap to remove) — keeps visible whenever player has placed something.
    L.bottomHintY = H - padBottom - 18;

    // Hint popup
    if (hintMode) {
      var popW = W * 0.78, popH = H * 0.55;
      L.hintPopup = { x: (W - popW) / 2, y: (H - popH) / 2, w: popW, h: popH };
      var candidates = [];
      for (var ci2 = 0; ci2 < palette.length; ci2++) candidates.push(palette[ci2]);
      for (var cj = 0; cj < dropped.length; cj++) candidates.push(dropped[cj]);
      L.hintItems = [];
      var hx = L.hintPopup.x + 20, hy = L.hintPopup.y + 50;
      var hSize = 52, hGap = 10;
      for (var hi = 0; hi < candidates.length; hi++) {
        if (hx + hSize > L.hintPopup.x + L.hintPopup.w - 20) { hx = L.hintPopup.x + 20; hy += hSize + hGap; }
        L.hintItems.push({ x: hx, y: hy, w: hSize, h: hSize, block: candidates[hi] });
        hx += hSize + hGap;
      }
      L.hintCloseBtn = { x: L.hintPopup.x + (popW - 90) / 2, y: L.hintPopup.y + popH - 46, w: 90, h: 34 };
    }

    // Select panel
    if (selectPanelOpen) {
      var spW = W * 0.92, spH = H * 0.78;
      L.selectPanel = { x: (W - spW) / 2, y: (H - spH) / 2, w: spW, h: spH };
      L.selectCloseBtn = { x: L.selectPanel.x + (spW - 100) / 2, y: L.selectPanel.y + spH - 48, w: 100, h: 36 };

      var combos = puzzle.allCombinations;
      var thumbCS = 6;
      var thumbW = thumbCS * 7 + 8;
      var thumbH = thumbCS * 8 + 20;
      var thumbGap = 8;
      var cols2 = Math.floor((spW - 30) / (thumbW + thumbGap));
      if (cols2 < 1) cols2 = 1;
      L.selectItems = [];
      var sx = L.selectPanel.x + 15, sy = L.selectPanel.y + 50;
      for (var si = 0; si < combos.length; si++) {
        var ix = sx + (si % cols2) * (thumbW + thumbGap);
        var iy = sy + Math.floor(si / cols2) * (thumbH + thumbGap);
        L.selectItems.push({ x: ix, y: iy, w: thumbW, h: thumbH, comboIndex: si });
      }
      L.selectContentH = Math.ceil(combos.length / cols2) * (thumbH + thumbGap);
      L.selectVisibleH = spH - 100;
    }
  }

  // ---- Cell decoration helpers ----
  function drawCellDecoration(ctx, cellType, px, py, cs) {
    if (cellType === 'month') {
      // Tiny dot in the top-left corner.
      R.dotMarker(ctx, px + cs * 0.18, py + cs * 0.18, Math.max(1.5, cs * 0.045), 'rgba(0,0,0,0.16)');
    } else if (cellType === 'weekday') {
      // Thin underline.
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + cs * 0.32, py + cs * 0.82);
      ctx.lineTo(px + cs * 0.68, py + cs * 0.82);
      ctx.stroke();
    }
    // day cell: no decoration (clean)
  }

  // ---- RENDER ----
  scene.render = function (ctx, W, H) {
    computeLayout(W, H);
    R.clear(ctx, W, H);

    var pad = 12;
    var cs = L.cellSize;

    // --- Back button (circular hit area + chevron) ---
    if (L.backBtn) {
      var bb = L.backBtn;
      var bcx = bb.x + bb.w / 2, bcy = bb.y + bb.h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath(); ctx.arc(bcx, bcy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bcx + 5, bcy - 7);
      ctx.lineTo(bcx - 5, bcy);
      ctx.lineTo(bcx + 5, bcy + 7);
      ctx.stroke();
    }

    // --- Difficulty (centered main title) ---
    R.textBold(ctx, diffLabel, W / 2, L.diffY, 22, BRAND_DARK, 'center');
    if (diffSub) {
      R.text(ctx, diffSub + ' · 挖 ' + diffCfg.digCount + ' 块',
        W / 2, L.diffSubY, 11, '#888', 'center');
    }

    // --- Timer (small, secondary, right of title) ---
    R.text(ctx, B.formatTime(timer), W - L.staminaW - 14, L.timerY, 13, '#666', 'right');

    // --- Stamina capsule (with recovery countdown) ---
    var cur = stamina.getStamina();
    var rs = stamina.getRecoverSeconds();
    R.roundRect(ctx, L.staminaX, L.staminaY, L.staminaW, L.staminaH, 4, '#FFF8E1', '#FFB300');
    var stTxt = '体力 ' + cur;
    if (cur < stamina.MAX_STAMINA) stTxt += '  ↻' + formatMMSS(rs);
    R.text(ctx, stTxt, L.staminaX + L.staminaW / 2, L.staminaY + 4, 10, '#E65100', 'center');

    // --- Control row: 提示 / 重开 / 🎲 / 🎯 ---
    var hintActive = hintedIds.length < palette.length + dropped.length;
    R.button(ctx, L.hintBtn.x, L.hintBtn.y, L.hintBtn.w, L.hintBtn.h, '💡 提示', BRAND, '#fff', 8);
    R.button(ctx, L.resetBtn.x, L.resetBtn.y, L.resetBtn.w, L.resetBtn.h, '↺ 重开', dropped.length ? NEUTRAL : '#cfcfcf', '#fff', 8);
    // 🎲 random — active when switchMode='random'
    var randomBg = switchMode === 'random' ? BRAND : '#E0E0E0';
    var randomFg = switchMode === 'random' ? '#fff' : '#666';
    R.button(ctx, L.switchRandomBtn.x, L.switchRandomBtn.y, L.switchRandomBtn.w, L.switchRandomBtn.h, '🎲 随机', randomBg, randomFg, 8);
    var manualBg = switchMode === 'manual' ? BRAND : '#E0E0E0';
    var manualFg = switchMode === 'manual' ? '#fff' : '#666';
    R.button(ctx, L.switchManualBtn.x, L.switchManualBtn.y, L.switchManualBtn.w, L.switchManualBtn.h, '🎯 选题', manualBg, manualFg, 8);

    // --- Board card (padding + soft shadow + thin border) ---
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff';
    R.roundRect(ctx, L.boardX - 6, L.boardY - 6, L.boardW + 12, L.boardH + 12, 8, '#fff');
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L.boardX - 0.5, L.boardY - 0.5, L.boardW + 1, L.boardH + 1);

    // --- Board cells ---
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
          ctx.globalAlpha = locked ? 0.92 : 0.95;
          ctx.fillStyle = blockAt.color;
          ctx.fillRect(px, py, cs, cs);
          ctx.globalAlpha = 1;
        } else if (isUncov) {
          ctx.fillStyle = B.CELL_COLORS.uncoverable;
          ctx.fillRect(px, py, cs, cs);
          // Today emphasis: inner ring
          ctx.strokeStyle = B.CELL_COLORS.uncoverableBorder || '#FF8F00';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
        } else if (cell.t === 'empty') {
          // Non-game area — diagonal stripes
          ctx.fillStyle = '#FAFAFA';
          ctx.fillRect(px, py, cs, cs);
          R.diagonalStripes(ctx, px, py, cs, cs, 'rgba(0,0,0,0.07)', Math.max(4, cs * 0.16));
        } else {
          ctx.fillStyle = B.CELL_COLORS[cell.t] || '#fff';
          ctx.fillRect(px, py, cs, cs);
        }

        // Cell decoration (month dot / weekday underline) — only if no block on top.
        if (!blockAt && !isUncov && cell.t !== 'empty') {
          drawCellDecoration(ctx, cell.t, px, py, cs);
        }

        // Border (lightest possible)
        if (!blockAt) {
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px, py, cs, cs);
        }

        // Label (number / month / weekday) — only when not covered
        if (!blockAt && cell.t !== 'empty' && cell.v != null) {
          R.textBold(ctx, String(cell.v), px + cs / 2, py + cs / 2,
            Math.max(9, cs * 0.28), isUncov ? '#fff' : '#333', 'center', 'middle');
        }
      }
    }

    // --- Locked block badges (drawn after cells so they sit on top) ---
    for (var pp = 0; pp < prePlaced.length; pp++) {
      var pb = prePlaced[pp];
      // Find top-left covered cell of this block.
      var minBy = 99, minBx = 99;
      for (var ry = 0; ry < pb.shape.length; ry++) {
        for (var rx = 0; rx < pb.shape[ry].length; rx++) {
          if (pb.shape[ry][rx] === 1) {
            if (pb.y + ry < minBy || (pb.y + ry === minBy && pb.x + rx < minBx)) {
              minBy = pb.y + ry; minBx = pb.x + rx;
            }
          }
        }
      }
      var lpx = L.boardX + minBx * cs + 5;
      var lpy = L.boardY + minBy * cs + 6;
      R.lockBadge(ctx, lpx, lpy, Math.max(6, cs * 0.22));
    }

    // --- Preview row ---
    if (selected && !dragging && L.previewShape) {
      var prevCS = Math.floor(cs * 0.55);
      var rB = L.previewRotateBtn, fB = L.previewFlipBtn, sB = L.previewShape;
      R.button(ctx, rB.x, rB.y, rB.w, rB.h, '↻ 旋转', '#66BB6A', '#fff', 8);
      R.button(ctx, fB.x, fB.y, fB.w, fB.h, '⇋ 翻转', '#26A69A', '#fff', 8);
      R.roundRect(ctx, sB.x, sB.y, sB.w, sB.h, 8, BRAND_LIGHT, BRAND);
      var sbw = selected.shape[0].length * prevCS;
      var sbh = selected.shape.length * prevCS;
      var sbx = sB.x + (sB.w - sbw) / 2;
      var sby = sB.y + (sB.h - sbh) / 2;
      R.blockShape(ctx, selected.shape, selected.color, sbx, sby, prevCS);
    }

    // --- Palette (unified cards, no letters, breathing first card on first launch) ---
    if (palette.length > 0) {
      var nowB = Date.now();
      var breath = (nowB - breathStart < BREATH_DUR) ? 1 - (nowB - breathStart) / BREATH_DUR : 0;
      for (var pi2 = 0; pi2 < L.palItems.length; pi2++) {
        var item = L.palItems[pi2];
        var isSel = selected && selected.id === item.block.id;
        var isDragOrigin = dragging && dragging.id === item.block.id;
        var isHinted = hintedIds.indexOf(item.block.id) >= 0;
        // First-card breathing — only on the first palette card, fades over BREATH_DUR.
        var bScale = 1;
        if (pi2 === 0 && breath > 0 && !isSel && !dragging) {
          bScale = 1 + 0.06 * Math.sin((nowB - breathStart) / 90) * breath;
        }
        var bg = isSel ? BRAND_LIGHT : (isHinted ? BRAND_LIGHT : '#fff');
        var border = (isSel || isHinted) ? BRAND : 'rgba(0,0,0,0.12)';
        var scale = isSel ? 1.06 : bScale;

        ctx.save();
        var ccx = item.x + item.w / 2, ccy = item.y + item.h / 2;
        ctx.translate(ccx, ccy);
        ctx.scale(scale, scale);
        ctx.translate(-ccx, -ccy);
        if (isSel) {
          ctx.shadowColor = 'rgba(76,175,80,0.35)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 2;
        }
        R.roundRect(ctx, item.x, item.y, item.w, item.h, 8, bg, border);
        ctx.restore();
        if (isSel) {
          ctx.strokeStyle = BRAND;
          ctx.lineWidth = 2;
          ctx.strokeRect(item.x + 0.5, item.y + 0.5, item.w - 1, item.h - 1);
        }

        // Centered shape; dim if this is the drag origin.
        var sh = item.block.shape;
        var palCS = Math.min(
          Math.floor((item.w - 16) / sh[0].length),
          Math.floor((item.h - 16) / sh.length)
        );
        var sw = sh[0].length * palCS;
        var sht = sh.length * palCS;
        var spx = item.x + (item.w - sw) / 2;
        var spy = item.y + (item.h - sht) / 2;
        var palAlpha = isDragOrigin ? 0.25 : (isHinted ? 0.85 : 1);
        R.blockShape(ctx, sh, item.block.color, spx, spy, palCS, palAlpha);
      }
    }

    // --- Bottom hint about double-tap to remove ---
    if (dropped.length > 0 && !isWon) {
      R.text(ctx, '💡 双击棋盘上的方块可移除',
        W / 2, L.bottomHintY, 11, '#999', 'center');
    }

    // --- Invite button (on win) ---
    if (L.inviteBtn) {
      R.button(ctx, L.inviteBtn.x, L.inviteBtn.y, L.inviteBtn.w, L.inviteBtn.h,
        '🎯 邀请朋友挑战这一题', '#FF7043', '#fff', 8);
    }

    // --- Hint popup ---
    if (hintMode && L.hintPopup) {
      R.overlay(ctx, W, H);
      R.roundRect(ctx, L.hintPopup.x, L.hintPopup.y, L.hintPopup.w, L.hintPopup.h, 16, '#fff');
      R.textBold(ctx, '选择要提示的方块', L.hintPopup.x + L.hintPopup.w / 2, L.hintPopup.y + 18, 17, '#333', 'center');
      for (var hi2 = 0; hi2 < L.hintItems.length; hi2++) {
        var ht = L.hintItems[hi2];
        var alreadyHinted = hintedIds.indexOf(ht.block.id) >= 0;
        ctx.globalAlpha = alreadyHinted ? 0.4 : 0.95;
        R.roundRect(ctx, ht.x, ht.y, ht.w, ht.h, 10, ht.block.color);
        if (alreadyHinted) {
          R.textBold(ctx, '✓', ht.x + ht.w / 2, ht.y + ht.h / 2, 20, '#fff', 'center', 'middle');
        } else {
          var ihs = Math.min(
            Math.floor((ht.w - 12) / ht.block.shape[0].length),
            Math.floor((ht.h - 12) / ht.block.shape.length)
          );
          var ihw = ht.block.shape[0].length * ihs;
          var ihh = ht.block.shape.length * ihs;
          R.blockShape(ctx, ht.block.shape, '#fff', ht.x + (ht.w - ihw) / 2, ht.y + (ht.h - ihh) / 2, ihs, 0.9);
        }
        ctx.globalAlpha = 1;
      }
      R.button(ctx, L.hintCloseBtn.x, L.hintCloseBtn.y, L.hintCloseBtn.w, L.hintCloseBtn.h, '取消', '#eee', '#333', 8);
    }

    // --- Select panel popup ---
    if (selectPanelOpen && L.selectPanel) {
      R.overlay(ctx, W, H);
      var sp = L.selectPanel;
      R.roundRect(ctx, sp.x, sp.y, sp.w, sp.h, 16, '#fff');
      R.textBold(ctx, '选择题目', sp.x + sp.w / 2, sp.y + 18, 17, '#333', 'center');

      ctx.save();
      ctx.beginPath();
      ctx.rect(sp.x, sp.y + 44, sp.w, L.selectVisibleH);
      ctx.clip();

      var combos2 = puzzle.allCombinations;
      var tCS = 6;
      for (var si2 = 0; si2 < L.selectItems.length; si2++) {
        var item2 = L.selectItems[si2];
        var iy2 = item2.y - selectScrollY;
        if (iy2 + item2.h < sp.y + 44 || iy2 > sp.y + 44 + L.selectVisibleH) continue;
        var isCurrent = item2.comboIndex === puzzle.currentComboIndex;
        var borderColor = isCurrent ? BRAND : 'rgba(0,0,0,0.12)';
        var bgColor = isCurrent ? BRAND_LIGHT : '#fafafa';
        R.roundRect(ctx, item2.x, iy2, item2.w, item2.h, 4, bgColor, borderColor);
        if (isCurrent) {
          ctx.strokeStyle = BRAND; ctx.lineWidth = 2;
          ctx.strokeRect(item2.x, iy2, item2.w, item2.h);
        }
        var combo = combos2[item2.comboIndex];
        var sb = puzzle.bases ? puzzle.bases[combo.baseIdx] : puzzle.solvedBoard;
        var letters = combo.letters || combo;
        var bx0 = item2.x + 4, by0 = iy2 + 2;
        for (var ty = 0; ty < 8; ty++) {
          for (var tx = 0; tx < 7; tx++) {
            var ch = sb[ty][tx];
            var px2 = bx0 + tx * tCS, py2 = by0 + ty * tCS;
            if (ch === '#') {
              ctx.fillStyle = '#eee';
            } else if (ch === '*') {
              ctx.fillStyle = '#FFB300';
            } else if (letters.indexOf(ch) >= 0) {
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
          }
        }
        R.text(ctx, '#' + (item2.comboIndex + 1), item2.x + item2.w / 2, iy2 + item2.h - 14, 9, '#999', 'center');
        if (wonCombos[item2.comboIndex]) {
          var badgeR = 8;
          var bcx2 = item2.x + item2.w - badgeR - 2;
          var bcy2 = iy2 + badgeR + 2;
          ctx.beginPath();
          ctx.arc(bcx2, bcy2, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = BRAND;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(bcx2 - badgeR * 0.45, bcy2 + badgeR * 0.05);
          ctx.lineTo(bcx2 - badgeR * 0.10, bcy2 + badgeR * 0.40);
          ctx.lineTo(bcx2 + badgeR * 0.50, bcy2 - badgeR * 0.35);
          ctx.stroke();
        }
      }
      ctx.restore();
      R.button(ctx, L.selectCloseBtn.x, L.selectCloseBtn.y, L.selectCloseBtn.w, L.selectCloseBtn.h, '取消', '#eee', '#333', 8);
    }

    // --- Snap landing preview while dragging ---
    if (dragging && dragHasMoved) {
      var gx = dragPos.x - cs;
      var gy = dragPos.y - cs;
      var snapCx = Math.round((gx - L.boardX) / cs);
      var snapCy = Math.round((gy - L.boardY) / cs);
      if (snapCx >= 0 && snapCx < 7 && snapCy >= 0 && snapCy < 8) {
        var valid = B.isValidPlacement(dragging, { x: snapCx, y: snapCy }, allBlocks(), uncov, dragging.id);
        var landColor = valid ? dragging.color : '#bbbbbb';
        R.blockShape(ctx, dragging.shape, landColor,
          L.boardX + snapCx * cs, L.boardY + snapCy * cs, cs, 0.32);
      }
    }

    // --- Floating drag ghost (no snapping, follows finger) ---
    if (dragging && dragHasMoved) {
      R.blockShape(ctx, dragging.shape, dragging.color, dragPos.x - cs, dragPos.y - cs, cs, 0.7);
    }

    // --- Snap animation (placed block sliding from drop position to cell) ---
    if (snapAnims.length > 0) {
      var nowS = Date.now();
      for (var sa = 0; sa < snapAnims.length; sa++) {
        var a = snapAnims[sa];
        var t = Math.min(1, (nowS - a.start) / SNAP_DUR);
        var k = R.easeOutCubic(t);
        var ax = a.fromX + (a.toX - a.fromX) * k;
        var ay = a.fromY + (a.toY - a.fromY) * k;
        // Cover the destination cell with white briefly so the underlying static
        // block isn't double-drawn.
        // (Static cell already drawn; we just animate a moving ghost on top.)
        R.blockShape(ctx, a.shape, a.color, ax, ay, cs, 0.9);
      }
    }

    // --- Win modal (card + dim backdrop) + confetti ---
    if (isWon && winStats && !winCardDismissed) {
      // Dim backdrop — makes the card modal, click-outside dismisses.
      R.overlay(ctx, W, H);
      var cardW = Math.min(W - 32, 320);
      var cardH = 250;
      var cardX = (W - cardW) / 2;
      var cardY = Math.max(L.boardY + L.boardH / 2 - cardH / 2, L.headerY + 80);
      L.winCard = { x: cardX, y: cardY, w: cardW, h: cardH };
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.30)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      R.roundRect(ctx, cardX, cardY, cardW, cardH, 14, '#fff');
      ctx.restore();
      // Close ×
      var clz = 28;
      L.winCloseBtn = { x: cardX + cardW - clz - 6, y: cardY + 6, w: clz, h: clz };
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath();
      ctx.arc(L.winCloseBtn.x + clz / 2, L.winCloseBtn.y + clz / 2, clz / 2, 0, Math.PI * 2);
      ctx.fill();
      R.textBold(ctx, '×', L.winCloseBtn.x + clz / 2, L.winCloseBtn.y + clz / 2 - 1, 20, '#666', 'center', 'middle');

      R.textBold(ctx, '🎉 通关！', cardX + cardW / 2, cardY + 22, 20, BRAND_DARK, 'center');
      R.textBold(ctx, B.formatTime(winStats.time),
        cardX + cardW / 2, cardY + 60, 26, '#333', 'center', 'middle');
      var sub;
      if (winStats.isNewPB && winStats.prevPB != null) {
        sub = '🏆 新纪录！（前最佳 ' + B.formatTime(winStats.prevPB) + '）';
      } else if (winStats.isNewPB) {
        sub = '🏆 首次通关本题';
      } else {
        sub = '最佳 ' + B.formatTime(progress.getBestTime(puzzle.dateStr, difficulty));
      }
      R.text(ctx, sub, cardX + cardW / 2, cardY + 88, 12,
        winStats.isNewPB ? '#FF8F00' : '#888', 'center');
      R.text(ctx, '今日已通关 ' + winStats.todayDone + ' 题',
        cardX + cardW / 2, cardY + 110, 12, '#666', 'center');

      // Two stacked CTA buttons. 随机下一题 is the primary action
      // (most players want to keep playing); share is secondary.
      var sbtnW = cardW - 32, sbtnH = 40, sbtnGap = 10;
      L.winNextBtn = {
        x: cardX + (cardW - sbtnW) / 2,
        y: cardY + cardH - sbtnH * 2 - sbtnGap - 14,
        w: sbtnW, h: sbtnH,
      };
      R.button(ctx, L.winNextBtn.x, L.winNextBtn.y, L.winNextBtn.w, L.winNextBtn.h,
        '🎲 随机下一题', BRAND, '#fff', 10);
      L.shareBtn = {
        x: cardX + (cardW - sbtnW) / 2,
        y: cardY + cardH - sbtnH - 14,
        w: sbtnW, h: sbtnH,
      };
      R.button(ctx, L.shareBtn.x, L.shareBtn.y, L.shareBtn.w, L.shareBtn.h,
        '🎯 邀请朋友挑战这一题', '#FF7043', '#fff', 10);

      // Confetti
      var nowC = Date.now();
      for (var k = 0; k < confetti.length; k++) {
        var c = confetti[k];
        if (nowC < c.born) continue;
        var dt = (nowC - c.born) / 16;
        c.x += c.vx;
        c.y += c.vy;
        c.rot += c.rotV;
        if (c.y > 1.1) continue;
        var px = c.x * W, py = c.y * H;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.6);
        ctx.restore();
      }
      scene.dirty = true;
    }

    // --- Top floating toast (above everything else) ---
    if (toast.msg) {
      var elapsed = Date.now() - toast.start;
      if (toast.isWin || elapsed < toast.dur) {
        var tY = L.headerY + 56;
        var tFont = toast.isWin ? 16 : 14;
        ctx.font = 'bold ' + tFont + 'px sans-serif';
        var tw = ctx.measureText(toast.msg).width + 28;
        var tx = (W - tw) / 2;
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        R.roundRect(ctx, tx, tY, tw, 32, 16, toast.isWin ? BRAND : 'rgba(33,33,33,0.92)');
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        R.textBold(ctx, toast.msg, W / 2, tY + 16, tFont, '#fff', 'center', 'middle');
      } else {
        toast.msg = '';
      }
    }
  };

  // ---- TOUCH ----
  scene.onTouchStart = function (x, y) {
    gestureStart = { x: x, y: y, t: Date.now(), fromEdge: x < 24 };

    // Modal win card swallows palette drags etc.
    if (isWon && !winCardDismissed && L.winCard) return;

    if (selectPanelOpen) {
      dragStart = { x: x, y: y };
      selectScrolled = false;
      return;
    }
    if (helpOpen) return;
    if (hintMode) return;

    for (var i = 0; i < L.palItems.length; i++) {
      if (R.hitTest(x, y, L.palItems[i])) {
        dragging = L.palItems[i].block;
        dragHasMoved = false;
        dragEnteredBoard = false;
        dragStart = { x: x, y: y };
        dragPos = { x: x, y: y };
        try { wx.vibrateShort && wx.vibrateShort({ type: 'light' }); } catch (e) {}
        return;
      }
    }

    if (selected && !dragging && L.previewShape) {
      if (R.hitTest(x, y, L.previewShape)) {
        dragging = selected;
        dragHasMoved = false;
        dragEnteredBoard = false;
        dragStart = { x: x, y: y };
        dragPos = { x: x, y: y };
        try { wx.vibrateShort && wx.vibrateShort({ type: 'light' }); } catch (e) {}
        return;
      }
    }
  };

  scene.onTouchMove = function (x, y) {
    if (selectPanelOpen && L.selectPanel) {
      if (!dragging) {
        var scrollDelta = dragStart.y - y;
        if (Math.abs(scrollDelta) >= DRAG_THRESHOLD) selectScrolled = true;
        selectScrollY = Math.max(0, Math.min(selectScrollY + scrollDelta * 0.5,
          Math.max(0, L.selectContentH - L.selectVisibleH)));
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
    // Track whether the drag has snapped to a real grid cell at any point.
    if (!dragEnteredBoard && L.cellSize) {
      var ccs = L.cellSize;
      var scx = Math.round((dragPos.x - ccs - L.boardX) / ccs);
      var scy = Math.round((dragPos.y - ccs - L.boardY) / ccs);
      if (scx >= 0 && scx < 7 && scy >= 0 && scy < 8) dragEnteredBoard = true;
    }
    scene.dirty = true;
  };

  scene.onTouchEnd = function (x, y) {
    // ── Win modal: × dismisses; 随机下一题 jumps to a new puzzle (free,
    //    isWon → confirmAndSwitch skips stamina); share shares; tap outside
    //    dismisses; tap inside (not a button) is swallowed.
    if (isWon && !winCardDismissed && L.winCard) {
      if (L.winCloseBtn && R.hitTest(x, y, L.winCloseBtn)) {
        winCardDismissed = true; scene.dirty = true; return;
      }
      if (L.winNextBtn && R.hitTest(x, y, L.winNextBtn)) {
        executeRandomSwitch();
        return;
      }
      if (L.shareBtn && R.hitTest(x, y, L.shareBtn)) {
        try { wx.shareAppMessage(shareState.buildShareData()); } catch (e) {}
        return;
      }
      if (!R.hitTest(x, y, L.winCard)) {
        winCardDismissed = true; scene.dirty = true; return;
      }
      return;
    }

    // Help overlay click anywhere closes it.
    if (helpOpen) { helpOpen = false; scene.dirty = true; return; }

    // Select panel
    if (selectPanelOpen) {
      if (selectScrolled) { selectScrolled = false; return; }
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
          if (R.hitTest(x, y, { x: sItem.x, y: adjY, w: sItem.w, h: sItem.h })) {
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
      for (var hi3 = 0; hi3 < L.hintItems.length; hi3++) {
        if (R.hitTest(x, y, L.hintItems[hi3])) {
          var hBlock = L.hintItems[hi3].block;
          if (hintedIds.indexOf(hBlock.id) >= 0) return;
          var hs = PG.getHintShape(puzzle.solvedBoard, hBlock.label);
          if (!hs) return;
          for (var pi3 = 0; pi3 < palette.length; pi3++) {
            if (palette[pi3].id === hBlock.id) palette[pi3].shape = hs;
          }
          if (selected && selected.id === hBlock.id) selected.shape = hs;
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
          showToast('已提示 ' + hBlock.label + ' 的正确方向');
          return;
        }
      }
      if (L.hintCloseBtn && R.hitTest(x, y, L.hintCloseBtn)) {
        hintMode = false; scene.dirty = true; return;
      }
      if (L.hintPopup && !R.hitTest(x, y, L.hintPopup)) {
        hintMode = false; scene.dirty = true; return;
      }
      return;
    }

    // Drag end
    if (dragging) {
      if (!dragHasMoved) {
        selected = dragging;
        dragging = null;
        scene.dirty = true;
        return;
      }
      var cs = L.cellSize;
      var gx = dragPos.x - cs;
      var gy = dragPos.y - cs;
      var cx = Math.round((gx - L.boardX) / cs);
      var cy = Math.round((gy - L.boardY) / cs);
      var onBoard = cx >= 0 && cx < 7 && cy >= 0 && cy < 8;
      if (onBoard && B.isValidPlacement(dragging, { x: cx, y: cy }, allBlocks(), uncov, dragging.id)) {
        placeBlock(dragging, cx, cy, dragPos.x - cs, dragPos.y - cs);
      } else if (onBoard) {
        showToast('无法放置！');
      } else if (dragEnteredBoard) {
        showToast('超出棋盘范围');
      }
      // else: drag never reached the board → silent.
      dragging = null;
      dragHasMoved = false;
      scene.dirty = true;
      return;
    }

    // Share button (in-card on win) or fallback invite button (legacy slot)
    if (L.shareBtn && R.hitTest(x, y, L.shareBtn)) {
      try { wx.shareAppMessage(shareState.buildShareData()); } catch (e) {}
      return;
    }
    if (L.inviteBtn && R.hitTest(x, y, L.inviteBtn)) {
      try { wx.shareAppMessage(shareState.buildShareData()); } catch (e) {}
      return;
    }

    // Back
    if (L.backBtn && R.hitTest(x, y, L.backBtn)) {
      clearInterval(timerInterval);
      callbacks.onBack();
      return;
    }

    // Preview rotate / flip
    if (L.previewRotateBtn && R.hitTest(x, y, L.previewRotateBtn)) {
      if (selected) {
        if (hintedIds.indexOf(selected.id) >= 0) { showToast('该方块方向已锁定'); return; }
        selected.shape = B.rotateShape(selected.shape);
        for (var rp = 0; rp < palette.length; rp++) {
          if (palette[rp].id === selected.id) palette[rp].shape = selected.shape;
        }
        scene.dirty = true;
      }
      return;
    }
    if (L.previewFlipBtn && R.hitTest(x, y, L.previewFlipBtn)) {
      if (selected) {
        if (hintedIds.indexOf(selected.id) >= 0) { showToast('该方块方向已锁定'); return; }
        selected.shape = B.flipShape(selected.shape);
        for (var fp = 0; fp < palette.length; fp++) {
          if (palette[fp].id === selected.id) palette[fp].shape = selected.shape;
        }
        scene.dirty = true;
      }
      return;
    }

    // Control row
    if (L.hintBtn && R.hitTest(x, y, L.hintBtn)) {
      hintMode = true; scene.dirty = true; return;
    }
    if (L.resetBtn && R.hitTest(x, y, L.resetBtn)) {
      if (dropped.length === 0) return;
      resetAllPlaced();
      showToast('已重开当前题');
      return;
    }
    if (L.switchRandomBtn && R.hitTest(x, y, L.switchRandomBtn)) {
      if (switchMode !== 'random') { switchMode = 'random'; scene.dirty = true; return; }
      confirmAndSwitch(executeRandomSwitch);
      return;
    }
    if (L.switchManualBtn && R.hitTest(x, y, L.switchManualBtn)) {
      if (switchMode !== 'manual') { switchMode = 'manual'; scene.dirty = true; }
      selectPanelOpen = true;
      selectScrollY = 0;
      scene.dirty = true;
      return;
    }

    // Board tap (single = place selected; double = remove)
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
        var blockAt = B.getBlockAtCell(allBlocks(), tapCX, tapCY);
        if (blockAt && !isPrePlaced(blockAt.id)) {
          removeDropped(blockAt.id);
        } else if (blockAt && isPrePlaced(blockAt.id)) {
          showToast('🔒 题面方块不可移除');
        }
        return;
      }

      if (!selected) return;
      if (B.isValidPlacement(selected, { x: tapCX, y: tapCY }, allBlocks(), uncov, selected.id)) {
        // Instant placement — no snap animation on tap (the from==to ghost
        // would flicker on top of the freshly-drawn solid block).
        placeBlock(selected, tapCX, tapCY);
      } else {
        showToast('无法放置！');
      }
      return;
    }

    // Edge swipe back
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

  scene.onWheel = function (dy) {
    if (selectPanelOpen && L.selectPanel) {
      var max = Math.max(0, L.selectContentH - L.selectVisibleH);
      selectScrollY = Math.max(0, Math.min(selectScrollY + dy, max));
      scene.dirty = true;
    }
  };

  scene.destroy = function () {
    clearInterval(timerInterval);
    clearInterval(animTimer);
    if (solutionCountTimer) clearTimeout(solutionCountTimer);
  };

  return scene;
};
