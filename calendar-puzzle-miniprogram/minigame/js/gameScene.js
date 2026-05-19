// Main game scene — board, palette, controls, hints, drag.
// v0.3.0 UX rewrite: compact top header, brand-green controls, three-state
// board cells, unified palette cards, snap feedback, top toast, wheel scroll.
var R = require('./render');
var B = require('./board');
var PG = require('./puzzleGenerator');
var stamina = require('./stamina');
var shareState = require('./shareState');
var progress = require('./progress');
var Hint = require('./hint');
var Voucher = require('./voucher');
var cloudClient = require('./cloudClient');
var initialBlockTypes = B.initialBlockTypes;

var DRAG_THRESHOLD = 8;
var BRAND = '#43A047';        // primary action green
var BRAND_DARK = '#2E7D32';   // emphasis green (selected ring, focus)
var BRAND_LIGHT = '#E8F5E9';  // selected-card bg, soft tints
var NEUTRAL = '#9E9E9E';      // secondary action grey

// Snap animation — 60ms ease-out, makes "落子有重量"
var SNAP_DUR = 60;

module.exports = function createGameScene(difficulty, puzzle, safeInsets, menuRect, callbacks) {
  var scene = {};
  scene.dirty = true;

  // ---- State ----
  var prePlaced = puzzle.prePlacedBlocks;
  var dropped = [];
  var palette = puzzle.remainingBlocks.map(function (b) { return B.cloneBlock(b); });
  // If the puzzle ships pre-misplaced blocks (tutorial mode), seed dropped
  // and pull those ids out of palette.
  if (puzzle.initialDropped && puzzle.initialDropped.length) {
    var seenInDropped = {};
    for (var idi = 0; idi < puzzle.initialDropped.length; idi++) {
      dropped.push(B.cloneBlock(puzzle.initialDropped[idi]));
      seenInDropped[puzzle.initialDropped[idi].id] = true;
    }
    palette = palette.filter(function (b) { return !seenInDropped[b.id]; });
  }
  var paletteOrder = palette.map(function (b) { return b.id; }); // stable display order

  // ---- Tutorial state machine ----
  // step 1: explain the goal — bubble at today's weekday marker, advance via "下一步"
  // step 2: drag the *placeable* palette block to the board
  // step 3: double-tap the misplaced block to remove it
  // step 4: complete the puzzle (rectangular bottom dialog, persists)
  var tutorialMode = !!puzzle.tutorial;
  var tutorialStep = tutorialMode ? 1 : 0;
  var tutorialMisplacedId = puzzle.misplacedId || null;
  var tutorialPlaceableId = puzzle.placeableId || null;
  var tutorialUnplaceableId = puzzle.unplaceableId || null;
  var selected = null;
  var timer = 0;
  var isWon = false;
  var hintMode = false;
  var hintTier = null;
  // 二级 "获取路径" submenu — opens when both stamina and social voucher fall short.
  var sourceMenuOpen = false;
  var sourceMenuTier = null;
  // When non-null, the block-selection branch consumes a voucher instead of stamina.
  // Value is the source label used for pendingUse telemetry ('share'|'help'|'helperGift').
  var usingVoucherSource = null;
  var hintState = Hint.createHintState(
    puzzle.dateStr + ':' + difficulty + ':c' + puzzle.currentComboIndex
  );
  function currentPuzzleId() {
    return puzzle.dateStr + ':' + difficulty + ':c' + puzzle.currentComboIndex;
  }

  function triggerShareGroup() {
    if (!cloudClient.getOpenid()) { showToast('需要网络'); return; }
    var share = shareState.buildShareData();
    wx.shareAppMessage({
      withShareTicket: true,
      title: share.title,
      query: share.query,
      success: function (res) {
        if (!res || !res.shareTickets || !res.shareTickets[0]) {
          showToast('请分享到群聊');
          return;
        }
        wx.getShareInfo({
          shareTicket: res.shareTickets[0],
          success: function (info) {
            cloudClient.shareGroup(info.encryptedData, info.iv).then(function (r) {
              if (r && r.ok) {
                voucher.applyGranted('medium', 'share');
                showToast('+1 张中提示');
                voucher.reconcile(cloudClient, currentPuzzleId());
                sourceMenuOpen = false; sourceMenuTier = null;
                scene.dirty = true;
              } else if (r && r.err === 'duplicate') {
                showToast('今天这个群已经分享过');
              } else {
                showToast('换券失败：' + ((r && r.err) || '未知'));
              }
            }, function () { showToast('网络异常'); });
          },
          fail: function () { showToast('分享信息获取失败'); },
        });
      },
      fail: function () { /* user cancelled */ },
    });
  }

  function triggerHelpInvite() {
    var openid = cloudClient.getOpenid();
    var token = cloudClient.getHelpToken();
    if (!openid || !token) { showToast('需要网络'); return; }
    shareState.setInviterContext({ inviter: openid, t: token });
    var share = shareState.buildShareData();
    wx.shareAppMessage({
      title: share.title,
      query: share.query,
      success: function () { /* user shared */ },
      fail: function () { /* cancelled */ },
      complete: function () {
        shareState.clearInviterContext();
        sourceMenuOpen = false; sourceMenuTier = null;
        scene.dirty = true;
      },
    });
  }
  var wxStorage = {
    getItem: function (k) { return wx.getStorageSync(k) || null; },
    setItem: function (k, v) { wx.setStorageSync(k, v); },
    removeItem: function (k) { wx.removeStorageSync(k); },
  };
  var voucher = (GameGlobal && GameGlobal.voucher) || Voucher.create({ storage: wxStorage });
  var solvedPlacements = PG.solvedPlacements(puzzle.solvedBoard);
  var uncov = B.getUncoverableCells();
  var diffCfg = PG.DIFFICULTY_CONFIG[difficulty];
  var diffLabel = diffCfg.label;
  var diffSub = diffCfg.sub || '';
  var isInsomnia = difficulty === 'insomnia';

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
  // Confetti pieces seeded on win
  var confetti = [];
  var confettiLastTick = 0;
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
  var dragFromBoard = false;    // dragged block was lifted from the board, not palette
  var dragOriginX = 0;          // original board cell of a board-lifted drag
  var dragOriginY = 0;
  var dragStart = { x: 0, y: 0 };
  var dragPos = { x: 0, y: 0 };
  // Pixel vector from finger to the dragged block's top-left (origin) cell.
  // Palette / preview grabs use a fixed (cs, cs) — finger one cell down-right of
  // origin, matching the legacy ghost layout. Board grabs capture the actual
  // grip so the cell under the finger at pickup stays under the finger.
  var dragGripOffset = { x: 0, y: 0 };
  var lastTap = { time: 0, x: -1, y: -1 };
  var gestureStart = { x: 0, y: 0, t: 0, fromEdge: false };
  // When > Date.now(), draw a pulsing arrow at the capsule menu pointing to
  // "分享到朋友圈". Set on 📤 button tap; auto-clears on timeout.
  var momentsHintUntil = 0;

  var timerInterval = setInterval(function () {
    if (!isWon) { timer++; scene.dirty = true; }
  }, 1000);

  // Animation tick — kicks render while any animation is active. Without this,
  // scene.dirty set inside scene.render() is immediately cleared by
  // main.render's post-render `dirty = false`, so the next rAF tick would skip
  // drawing entirely — animations would freeze after a single frame.
  var animTimer = setInterval(function () {
    var now = Date.now();
    var alive = false;
    snapAnims = snapAnims.filter(function (a) {
      if (now - a.start < SNAP_DUR) { alive = true; return true; }
      return false;
    });
    // Confetti must also keep the render loop alive while any piece is still
    // in view (or waiting to be born). Otherwise the win-burst stalls to a
    // crawl, advancing only when some unrelated event marks the scene dirty.
    if (!alive && confetti.length > 0) {
      for (var ci = 0; ci < confetti.length; ci++) {
        var pc = confetti[ci];
        if (now < pc.born || pc.y <= 1.1) { alive = true; break; }
      }
    }
    // Keep ticking while the moments-share arrow is pulsing.
    if (!alive && momentsHintUntil > now) alive = true;
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
        // Velocities below are in canvas-units / second — frame-rate independent.
        // Combined with gravity in the render step, a piece traverses the full
        // viewport in ~0.7–0.85s and the whole burst clears in ~1s.
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.6 + Math.random() * 0.4,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 8,   // radians / sec
        size: 7 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        born: Date.now() + Math.random() * 200, // all spawned within 200ms
      });
    }
    confettiLastTick = Date.now();
    scene.dirty = true;
  }

  // Canonical 56-char board key. Each cell is the block letter covering it,
  // '*' for uncoverable (date markers), '#' for board boundary. Same physical
  // placement → identical key regardless of placement order.
  function buildBoardKey() {
    var ab = allBlocks();
    var grid = new Array(56);
    for (var i = 0; i < 56; i++) grid[i] = ' ';
    for (var yy = 0; yy < 8; yy++) {
      for (var xx = 0; xx < 7; xx++) {
        if (B.boardLayoutData[yy][xx].t === 'empty') grid[yy * 7 + xx] = '#';
      }
    }
    for (var ui = 0; ui < uncov.length; ui++) {
      grid[uncov[ui].y * 7 + uncov[ui].x] = '*';
    }
    for (var b = 0; b < ab.length; b++) {
      var bl = ab[b];
      for (var ry = 0; ry < bl.shape.length; ry++) {
        for (var cx = 0; cx < bl.shape[ry].length; cx++) {
          if (bl.shape[ry][cx] === 1) {
            grid[(bl.y + ry) * 7 + (bl.x + cx)] = bl.label;
          }
        }
      }
    }
    return grid.join('');
  }

  function checkWin() {
    if (isWon) return;
    if (dropped.length === puzzle.remainingBlocks.length) {
      if (B.checkGameWin(allBlocks(), uncov)) {
        isWon = true;
        if (tutorialMode) tutorialStep = 4;
        wonCombos[puzzle.currentComboIndex] = true;
        if (!tutorialMode) {
          progress.markWonCombo(puzzle.dateStr, difficulty, puzzle.currentComboIndex);
        }
        var pb = progress.recordTime(puzzle.dateStr, difficulty, timer);
        var insomniaUnique = null;
        if (isInsomnia) {
          insomniaUnique = progress.markUniqueInsomnia(puzzle.dateStr, buildBoardKey());
        }
        winStats = {
          time: timer,
          isNewPB: pb.isNew,
          prevPB: pb.prev,
          todayDone: progress.countCompletedForDate(puzzle.dateStr),
          insomniaUnique: insomniaUnique,
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
    // Tutorial advance: step 2 (drag a piece) clears as soon as the player
    // places anything via drag.
    if (tutorialMode && tutorialStep === 2) tutorialStep = 3;
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
    // Tutorial advance: step 3 clears when the player double-taps off the
    // pre-misplaced block specifically.
    if (tutorialMode && tutorialStep === 3 && id === tutorialMisplacedId) {
      tutorialStep = 4;
    }
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

    // Begin main content below the title row. Tutorial mode hides the
    // title / sub / timer / stamina elements but reserves the same vertical
    // space so the board stays at the regular gameplay Y position.
    var y = L.diffSubY + 22;

    // No room reserved for a banner — tutorial bubble overlays whatever
    // it needs to point at. Skip button is placed inside the bubble (laid
    // out at render time, not here).

    // Control row: 提示 / 重开 / 🎲 / 🎯  — single line, 4 icons (2 in insomnia
    // mode, where switching puzzle is conceptually nonexistent).
    // Hidden during tutorial mode to keep the focus on the banner step.
    L.hintBtn = null;
    L.resetBtn = null;
    L.switchRandomBtn = null;
    L.switchManualBtn = null;
    if (!tutorialMode) {
      var btnH = 36, btnGap = 8;
      var nCtrl = isInsomnia ? 2 : 4;
      var ctrlBtnW = Math.floor((W - 2 * pad - (nCtrl - 1) * btnGap) / nCtrl);
      L.ctrlY = y;
      L.hintBtn  = { x: pad,                                   y: y, w: ctrlBtnW, h: btnH };
      L.resetBtn = { x: pad + (ctrlBtnW + btnGap) * 1,         y: y, w: ctrlBtnW, h: btnH };
      if (!isInsomnia) {
        L.switchRandomBtn = { x: pad + (ctrlBtnW + btnGap) * 2,  y: y, w: ctrlBtnW, h: btnH };
        L.switchManualBtn = { x: pad + (ctrlBtnW + btnGap) * 3,  y: y, w: ctrlBtnW, h: btnH };
      }
      y += btnH + 10;
    }

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
    L.winMomentsBtn = null;
    L.winFinishTutorialBtn = null;
    L.tutorialBanner = null;
    L.tutorialSkipBtn = null;
    L.tutorialNextBtn = null;
    L.tutorialStep4Dialog = null;
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
      var popW = W * 0.78;
      var popH = 290;
      L.hintPopup = { x: (W - popW) / 2, y: (H - popH) / 2, w: popW, h: popH };

      if (!hintTier) {
        L.hintTierBtns = [];
        var rowH = 50, rowGap = 8;
        var rowY = L.hintPopup.y + 50;
        var tiers = ['weak', 'medium', 'strong'];
        for (var ti = 0; ti < tiers.length; ti++) {
          L.hintTierBtns.push({
            x: L.hintPopup.x + 20, y: rowY + ti * (rowH + rowGap),
            w: popW - 40, h: rowH, tier: tiers[ti],
          });
        }
        L.hintItems = [];
      } else {
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
        L.hintTierBtns = [];
      }
      L.hintCloseBtn = { x: L.hintPopup.x + (popW - 90) / 2, y: L.hintPopup.y + popH - 46, w: 90, h: 34 };
    }

    // 二级 "获取路径" submenu (medium → 群分享 / strong → 邀请助力)
    if (sourceMenuOpen) {
      var smW = 300, smH = 210;
      L.sourceMenu = { x: (W - smW) / 2, y: (H - smH) / 2, w: smW, h: smH };
      L.sourceMenuBtns = [];
      var sbx = L.sourceMenu.x + 20;
      var sby = L.sourceMenu.y + 70;
      var sbw = smW - 40;
      var sbh = 38;
      if (sourceMenuTier === 'medium') {
        L.sourceMenuBtns.push({ kind: 'share', x: sbx, y: sby, w: sbw, h: sbh });
        sby += sbh + 10;
      } else if (sourceMenuTier === 'strong') {
        L.sourceMenuBtns.push({ kind: 'help', x: sbx, y: sby, w: sbw, h: sbh });
        sby += sbh + 10;
      }
      L.sourceMenuCancelBtn = { x: L.sourceMenu.x + (smW - 90) / 2, y: L.sourceMenu.y + smH - 46, w: 90, h: 34 };
    } else {
      L.sourceMenu = null;
      L.sourceMenuBtns = [];
      L.sourceMenuCancelBtn = null;
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

    // Tutorial mode hides difficulty / sub / timer / stamina so the focus
    // is purely on the puzzle and the guidance bubble.
    if (!tutorialMode) {
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
    }

    // (Tutorial bubble is rendered later, after palette + board, so it
    //  can compute targets from their freshly-laid-out rects.)

    // --- Control row: 提示 / 重开 / 🎲 / 🎯 (hidden during tutorial) ---
    if (L.hintBtn) {
      R.button(ctx, L.hintBtn.x, L.hintBtn.y, L.hintBtn.w, L.hintBtn.h, '💡 提示', BRAND, '#fff', 8);
      R.button(ctx, L.resetBtn.x, L.resetBtn.y, L.resetBtn.w, L.resetBtn.h, '↺ 重开', dropped.length ? NEUTRAL : '#cfcfcf', '#fff', 8);
      if (L.switchRandomBtn) {
        var randomBg = switchMode === 'random' ? BRAND : '#E0E0E0';
        var randomFg = switchMode === 'random' ? '#fff' : '#666';
        R.button(ctx, L.switchRandomBtn.x, L.switchRandomBtn.y, L.switchRandomBtn.w, L.switchRandomBtn.h, '🎲 随机', randomBg, randomFg, 8);
        var manualBg = switchMode === 'manual' ? BRAND : '#E0E0E0';
        var manualFg = switchMode === 'manual' ? '#fff' : '#666';
        R.button(ctx, L.switchManualBtn.x, L.switchManualBtn.y, L.switchManualBtn.w, L.switchManualBtn.h, '🎯 选题', manualBg, manualFg, 8);
      }
    }

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

        // Medium-hint cell overlay (shows where a block should go, no orientation)
        for (var ml in hintState.mediumLocked) {
          var cells = hintState.mediumLocked[ml] || [];
          for (var ci = 0; ci < cells.length; ci++) {
            var mlc = cells[ci];
            if (mlc.x === bx && mlc.y === by) {
              // Find block color from palette/dropped (each block has a `color` field
              // from initialBlockTypes; see board.js:15-24)
              var blkColor = '#888';
              for (var pp = 0; pp < palette.length; pp++) if (palette[pp].id === ml) blkColor = palette[pp].color || blkColor;
              for (var dp = 0; dp < dropped.length; dp++) if (dropped[dp].id === ml) blkColor = dropped[dp].color || blkColor;
              ctx.save();
              ctx.strokeStyle = blkColor;
              ctx.lineWidth = 4;
              ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
              ctx.fillStyle = blkColor;
              var d = Math.max(6, Math.floor(cs * 0.18));
              ctx.fillRect(px + cs / 2 - d / 2, py + cs / 2 - d / 2, d, d);
              ctx.restore();
            }
          }
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

    // --- Palette (unified cards, no letters) ---
    if (palette.length > 0) {
      for (var pi2 = 0; pi2 < L.palItems.length; pi2++) {
        var item = L.palItems[pi2];
        var isSel = selected && selected.id === item.block.id;
        var isDragOrigin = dragging && dragging.id === item.block.id;
        var isHinted = Hint.isOrientationLocked(hintState, item.block.id);
        var bg = isSel ? BRAND_LIGHT : (isHinted ? BRAND_LIGHT : '#fff');
        var border = (isSel || isHinted) ? BRAND : 'rgba(0,0,0,0.12)';
        var scale = isSel ? 1.06 : 1;

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

      if (!hintTier) {
        R.textBold(ctx, '选择提示等级', L.hintPopup.x + L.hintPopup.w / 2, L.hintPopup.y + 18, 17, '#333', 'center');
        var tierLabels = {
          weak:   '弱：揭示方向（旋转+镜像）',
          medium: '中：揭示落点格子（不告诉方向）',
          strong: '强：直接放置（自动腾位）',
        };
        var costLabels = {
          weak:   Hint.COSTS.weak + ' 体力',
          medium: Hint.COSTS.medium + ' 体力',
          strong: Hint.COSTS.strong + ' 体力',
        };
        for (var ti2 = 0; ti2 < L.hintTierBtns.length; ti2++) {
          var btn = L.hintTierBtns[ti2];
          var used = Hint.countUsed(hintState, btn.tier);
          var cap = Hint.CAPS[btn.tier];
          var disabled = (cap !== undefined) && used >= cap;
          var fill = disabled ? '#eee' : (btn.tier === 'strong' ? '#E53935' : btn.tier === 'medium' ? '#FB8C00' : BRAND);
          R.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8, fill);
          R.text(ctx, tierLabels[btn.tier], btn.x + 12, btn.y + 8, 14, disabled ? '#999' : '#fff', 'left');
          var capStr;
          if (cap !== undefined) capStr = '本关 ' + used + '/' + cap;
          else capStr = '已用 ' + used;
          if (disabled) capStr += ' · 下关重置';
          var voucherBal = voucher.displayBalance(btn.tier);
          var bottomLine = costLabels[btn.tier] + ' · 剩余 ' + voucherBal + ' · ' + capStr;
          R.text(ctx, bottomLine, btn.x + 12, btn.y + 28, 11, disabled ? '#999' : 'rgba(255,255,255,0.85)', 'left');
        }
      } else {
        R.textBold(ctx, '选择要提示的方块', L.hintPopup.x + L.hintPopup.w / 2, L.hintPopup.y + 18, 17, '#333', 'center');
        for (var hi2 = 0; hi2 < L.hintItems.length; hi2++) {
          var ht = L.hintItems[hi2];
          var alreadyLocked = (hintTier === 'weak' && Hint.isOrientationLocked(hintState, ht.block.id))
                           || (hintTier === 'medium' && Hint.isMediumExhausted(hintState, ht.block.id, solvedPlacements))
                           || (hintTier === 'strong' && Hint.isFullyLocked(hintState, ht.block.id));
          ctx.globalAlpha = alreadyLocked ? 0.4 : 0.95;
          R.roundRect(ctx, ht.x, ht.y, ht.w, ht.h, 10, ht.block.color);
          if (alreadyLocked) {
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
      }

      R.button(ctx, L.hintCloseBtn.x, L.hintCloseBtn.y, L.hintCloseBtn.w, L.hintCloseBtn.h, hintTier ? '返回' : '取消', '#eee', '#333', 8);
    }

    // --- 获取路径 二级 menu ---
    if (sourceMenuOpen && L.sourceMenu) {
      R.overlay(ctx, W, H);
      var sm = L.sourceMenu;
      R.roundRect(ctx, sm.x, sm.y, sm.w, sm.h, 14, '#fff');
      var tierName = sourceMenuTier === 'strong' ? '强提示' : (sourceMenuTier === 'medium' ? '中提示' : '提示');
      R.textBold(ctx, '怎么拿到 ' + tierName + '？', sm.x + sm.w / 2, sm.y + 22, 16, '#333', 'center');
      R.text(ctx, '体力不足，可以换一种方式：', sm.x + 20, sm.y + 48, 12, '#666', 'left');
      for (var sbi = 0; sbi < L.sourceMenuBtns.length; sbi++) {
        var smbtn = L.sourceMenuBtns[sbi];
        var lbl;
        if (smbtn.kind === 'share') lbl = '群分享换 1 张中提示';
        else if (smbtn.kind === 'help') lbl = '邀请好友助力（每 2 位 +1 强提示）';
        else lbl = '';
        R.button(ctx, smbtn.x, smbtn.y, smbtn.w, smbtn.h, lbl, BRAND, '#fff', 8);
      }
      if (L.sourceMenuCancelBtn) {
        R.button(ctx, L.sourceMenuCancelBtn.x, L.sourceMenuCancelBtn.y, L.sourceMenuCancelBtn.w, L.sourceMenuCancelBtn.h, '取消', '#eee', '#333', 8);
      }
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

    // --- Tutorial guidance ---
    if (tutorialMode && tutorialStep <= 4) {
      var bpad = 12;

      // Step 4 has a unique form: a persistent rectangular dialog at the
      // bottom of the screen — no arrow, no target, stays until win/skip.
      if (tutorialStep === 4) {
        var dialogH = 76;
        var dialogY = H - (safeInsets.bottom || 0) - dialogH - 8;
        L.tutorialStep4Dialog = { x: bpad, y: dialogY, w: W - 2 * bpad, h: dialogH };
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        R.roundRect(ctx, L.tutorialStep4Dialog.x, L.tutorialStep4Dialog.y,
          L.tutorialStep4Dialog.w, L.tutorialStep4Dialog.h, 12, '#FFFFFF', '#FFB300');
        ctx.restore();
        R.textBold(ctx, '步骤 4 / 4 · 完成挑战', L.tutorialStep4Dialog.x + 14,
          L.tutorialStep4Dialog.y + 10, 12, '#E65100');
        R.text(ctx, '把剩下的方块都放到合适位置，完成今天的拼图！',
          L.tutorialStep4Dialog.x + 14, L.tutorialStep4Dialog.y + 36, 13, '#5D4037');
        var skipW4 = 60, skipH4 = 24;
        L.tutorialSkipBtn = {
          x: L.tutorialStep4Dialog.x + L.tutorialStep4Dialog.w - skipW4 - 10,
          y: L.tutorialStep4Dialog.y + 10,
          w: skipW4, h: skipH4,
        };
        R.roundRect(ctx, L.tutorialSkipBtn.x, L.tutorialSkipBtn.y,
          L.tutorialSkipBtn.w, L.tutorialSkipBtn.h, 4, '#fff', '#BDBDBD');
        R.text(ctx, '跳过',
          L.tutorialSkipBtn.x + L.tutorialSkipBtn.w / 2,
          L.tutorialSkipBtn.y + L.tutorialSkipBtn.h / 2 - 1,
          12, '#666', 'center', 'middle');
      } else {
        // Steps 1-3 are bubbles with an arrow pointing at a target.
        var target = null;
        var stepLabel = '';
        var stepLines = [];      // wrapped text lines
        var forcedDir = null;    // 'up' or 'down' to override auto positioning
        if (tutorialStep === 1) {
          stepLabel = '步骤 1 / 4 · 游戏目标';
          stepLines = ['把所有方块拼到棋盘上，', '让今日的标记格（金色）露出来'];
          var wd = null;
          for (var ui = 0; ui < uncov.length; ui++) {
            if (B.boardLayoutData[uncov[ui].y][uncov[ui].x].t === 'weekday') {
              wd = uncov[ui]; break;
            }
          }
          if (wd && L.cellSize) {
            target = {
              x: L.boardX + wd.x * L.cellSize, y: L.boardY + wd.y * L.cellSize,
              w: L.cellSize, h: L.cellSize,
            };
          }
        } else if (tutorialStep === 2) {
          stepLabel = '步骤 2 / 4 · 选中并放置';
          stepLines = [
            '点击选中方块，可旋转 / 翻转',
            '然后拖到棋盘的空格里',
          ];
          for (var pi3 = 0; pi3 < L.palItems.length; pi3++) {
            if (L.palItems[pi3].block.id === tutorialPlaceableId) {
              var pp = L.palItems[pi3];
              target = { x: pp.x, y: pp.y, w: pp.w, h: pp.h };
              break;
            }
          }
          if (!target && L.palItems.length > 0) {
            var pp0 = L.palItems[0];
            target = { x: pp0.x, y: pp0.y, w: pp0.w, h: pp0.h };
          }
          // Bubble goes BELOW the target (below palette) so it doesn't cover
          // the board or the other palette cards.
          forcedDir = 'down';
        } else if (tutorialStep === 3) {
          stepLabel = '步骤 3 / 4 · 双击移除';
          stepLines = ['这块放错了 —— 双击它取回 palette'];
          var mp = null;
          for (var di2 = 0; di2 < dropped.length; di2++) {
            if (dropped[di2].id === tutorialMisplacedId) { mp = dropped[di2]; break; }
          }
          if (mp && L.cellSize) {
            target = {
              x: L.boardX + mp.x * L.cellSize, y: L.boardY + mp.y * L.cellSize,
              w: mp.shape[0].length * L.cellSize, h: mp.shape.length * L.cellSize,
              shape: mp.shape,          // <-- enables silhouette outline
              cellSize: L.cellSize,
            };
          }
        }

        // Target highlight — silhouette outline for shaped targets, otherwise
        // a rectangular dashed ring.
        if (target) {
          ctx.save();
          ctx.shadowColor = 'rgba(255,179,0,0.9)';
          ctx.shadowBlur = 14;
          if (target.shape) {
            R.shapeOutline(ctx, target.shape, target.x, target.y, target.cellSize,
              '#FFB300', [6, 4], 3);
          } else {
            ctx.strokeStyle = '#FFB300';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(target.x - 2, target.y - 2, target.w + 4, target.h + 4);
          }
          ctx.restore();
        }

        // Compute bubble height from line count.
        var lineCount = stepLines.length;
        var bubbleW = Math.min(W - 2 * bpad, 320);
        var bubbleH = 16 /*top pad*/ + 14 /*label*/ + 8 + lineCount * 20 + 12 /*bottom pad*/;
        if (tutorialStep === 1) bubbleH += 40; // room for 下一步 button
        var bubbleX, bubbleY, tailDir;
        if (target) {
          bubbleX = Math.max(bpad, Math.min(
            target.x + target.w / 2 - bubbleW / 2, W - bubbleW - bpad));
          if (forcedDir === 'down') {
            // Place bubble below target (tail points up at the target above).
            bubbleY = target.y + target.h + 14;
            tailDir = 'up';
          } else if (forcedDir === 'up') {
            bubbleY = target.y - bubbleH - 14;
            tailDir = 'down';
          } else if (target.y > H / 2) {
            bubbleY = target.y - bubbleH - 14;
            tailDir = 'down';
          } else {
            bubbleY = target.y + target.h + 14;
            tailDir = 'up';
          }
          if (bubbleY + bubbleH > H - 8) bubbleY = H - bubbleH - 8;
          if (bubbleY < 8) bubbleY = 8;
        } else {
          bubbleX = (W - bubbleW) / 2;
          bubbleY = L.headerY + 8;
          tailDir = null;
        }

        // Bubble
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 3;
        R.roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 12, '#FFFFFF', '#FFB300');
        ctx.restore();
        ctx.strokeStyle = '#FFB300';
        ctx.lineWidth = 2;
        ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);

        // Tail
        if (tailDir && target) {
          var tx = Math.max(bubbleX + 22, Math.min(target.x + target.w / 2, bubbleX + bubbleW - 22));
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#FFB300';
          ctx.lineWidth = 2;
          if (tailDir === 'up') {
            ctx.beginPath();
            ctx.moveTo(tx - 10, bubbleY + 1);
            ctx.lineTo(tx, bubbleY - 10);
            ctx.lineTo(tx + 10, bubbleY + 1);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(tx - 10, bubbleY);
            ctx.lineTo(tx, bubbleY - 10);
            ctx.lineTo(tx + 10, bubbleY);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(tx - 10, bubbleY + bubbleH - 1);
            ctx.lineTo(tx, bubbleY + bubbleH + 10);
            ctx.lineTo(tx + 10, bubbleY + bubbleH - 1);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(tx - 10, bubbleY + bubbleH);
            ctx.lineTo(tx, bubbleY + bubbleH + 10);
            ctx.lineTo(tx + 10, bubbleY + bubbleH);
            ctx.stroke();
          }
        }

        // Body: label + wrapped text lines
        R.textBold(ctx, stepLabel, bubbleX + 14, bubbleY + 12, 11, '#E65100');
        for (var ln = 0; ln < stepLines.length; ln++) {
          R.text(ctx, stepLines[ln], bubbleX + 14, bubbleY + 36 + ln * 20, 13, '#5D4037');
        }

        // Skip button (top-right of bubble)
        var skipW = 50, skipH = 20;
        L.tutorialSkipBtn = {
          x: bubbleX + bubbleW - skipW - 10,
          y: bubbleY + 8,
          w: skipW, h: skipH,
        };
        R.roundRect(ctx, L.tutorialSkipBtn.x, L.tutorialSkipBtn.y,
          L.tutorialSkipBtn.w, L.tutorialSkipBtn.h, 4, '#fff', '#BDBDBD');
        R.text(ctx, '跳过',
          L.tutorialSkipBtn.x + L.tutorialSkipBtn.w / 2,
          L.tutorialSkipBtn.y + L.tutorialSkipBtn.h / 2 - 1,
          11, '#666', 'center', 'middle');

        // Step 1 has a "下一步" button to advance.
        if (tutorialStep === 1) {
          var nbW = 96, nbH = 32;
          L.tutorialNextBtn = {
            x: bubbleX + bubbleW - nbW - 14,
            y: bubbleY + bubbleH - nbH - 10,
            w: nbW, h: nbH,
          };
          R.button(ctx, L.tutorialNextBtn.x, L.tutorialNextBtn.y,
            L.tutorialNextBtn.w, L.tutorialNextBtn.h, '下一步 →', '#FFB300', '#fff', 8);
        }
      }
    } else {
      L.tutorialSkipBtn = null;
      L.tutorialNextBtn = null;
      L.tutorialStep4Dialog = null;
    }

    // --- Snap landing preview while dragging ---
    if (dragging && dragHasMoved) {
      var gx = dragPos.x - dragGripOffset.x;
      var gy = dragPos.y - dragGripOffset.y;
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
      R.blockShape(ctx, dragging.shape, dragging.color,
        dragPos.x - dragGripOffset.x, dragPos.y - dragGripOffset.y, cs, 0.7);
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
      // Tutorial stacks 2 (finish + invite). Regular win stacks 3
      // (restart / moments-hint / invite), so grow the card to match.
      var cardH = tutorialMode ? 250 : 310;
      var cardX = (W - cardW) / 2;
      var cardY = Math.max(L.boardY + L.boardH / 2 - cardH / 2, L.headerY + 80);
      // Clamp against the bottom safe area so the taller 3-button card
      // doesn't slide below the home indicator on small phones.
      var maxCardY = H - (safeInsets.bottom || 0) - cardH - 12;
      if (cardY > maxCardY) cardY = maxCardY;
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
      if (isInsomnia && winStats.insomniaUnique) {
        var iu = winStats.insomniaUnique;
        var iuTxt = iu.isNew
          ? '✨ 新摆法 · 今日已发现 ' + iu.count + ' 种'
          : '🌙 这种摆法见过了 · 今日 ' + iu.count + ' 种';
        R.text(ctx, iuTxt, cardX + cardW / 2, cardY + 110, 12,
          iu.isNew ? '#FF8F00' : '#888', 'center');
      } else {
        R.text(ctx, '今日已通关 ' + winStats.todayDone + ' 题',
          cardX + cardW / 2, cardY + 110, 12, '#666', 'center');
      }

      // Stacked CTAs. Tutorial: [finish, invite]. Normal win:
      // [restart, moments-hint, invite].
      var sbtnW = cardW - 32, sbtnH = 40, sbtnGap = 10;
      var btnCount = tutorialMode ? 2 : 3;
      var primaryY = cardY + cardH - btnCount * sbtnH - (btnCount - 1) * sbtnGap - 14;
      var btnX = cardX + (cardW - sbtnW) / 2;
      var slotY = function (i) { return primaryY + i * (sbtnH + sbtnGap); };

      if (tutorialMode) {
        L.winFinishTutorialBtn = { x: btnX, y: slotY(0), w: sbtnW, h: sbtnH };
        R.button(ctx, L.winFinishTutorialBtn.x, L.winFinishTutorialBtn.y,
          L.winFinishTutorialBtn.w, L.winFinishTutorialBtn.h,
          '🎓 完成新手教程', BRAND, '#fff', 10);
      } else {
        L.winNextBtn = { x: btnX, y: slotY(0), w: sbtnW, h: sbtnH };
        R.button(ctx, L.winNextBtn.x, L.winNextBtn.y, L.winNextBtn.w, L.winNextBtn.h,
          isInsomnia ? '↺ 重开' : '🎲 随机下一题', BRAND, '#fff', 10);
        L.winMomentsBtn = { x: btnX, y: slotY(1), w: sbtnW, h: sbtnH };
        R.button(ctx, L.winMomentsBtn.x, L.winMomentsBtn.y,
          L.winMomentsBtn.w, L.winMomentsBtn.h,
          '📤 分享朋友圈', '#1976D2', '#fff', 10);
      }
      L.shareBtn = { x: btnX, y: slotY(btnCount - 1), w: sbtnW, h: sbtnH };
      R.button(ctx, L.shareBtn.x, L.shareBtn.y, L.shareBtn.w, L.shareBtn.h,
        '🎯 邀请朋友挑战这一题', '#FF7043', '#fff', 10);

      // Confetti — time-stepped so the fall feels right regardless of fps.
      var nowC = Date.now();
      // Cap dt at 50ms so a backgrounded tab doesn't fling every piece
      // off-screen in a single resume frame.
      var cdt = Math.min(0.05, Math.max(0, (nowC - confettiLastTick) / 1000));
      confettiLastTick = nowC;
      var gravity = 2.2; // canvas-units / sec^2
      for (var k = 0; k < confetti.length; k++) {
        var c = confetti[k];
        if (nowC < c.born) continue;
        c.vy += gravity * cdt;
        c.x += c.vx * cdt;
        c.y += c.vy * cdt;
        c.rot += c.rotV * cdt;
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

      // --- Moments-share hint: pulsing arrow + label pointing at the capsule
      //     menu (the only place mini-games can trigger 朋友圈 share). ---
      if (momentsHintUntil > nowC && menuRect && menuRect.bottom > 0) {
        var capCx = (menuRect.left + menuRect.right) / 2;
        var capBottom = menuRect.bottom;
        // 1s period sine, normalized 0..1.
        var phase = ((nowC % 1000) / 1000) * Math.PI * 2;
        var pulseR = 26 + Math.sin(phase) * 5;
        var arrowBob = Math.sin(phase) * 6;
        var hintColor = '#FFD700';

        ctx.save();
        // Halo around the capsule (sits behind the system capsule visually).
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(capCx, (menuRect.top + menuRect.bottom) / 2, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        // Vertical arrow shaft below the capsule, tip pointing up.
        var tipY = capBottom + 12 + arrowBob;
        var tailY = tipY + 42;
        ctx.strokeStyle = hintColor;
        ctx.fillStyle = hintColor;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(capCx, tailY);
        ctx.lineTo(capCx, tipY);
        ctx.stroke();
        // Arrowhead triangle.
        ctx.beginPath();
        ctx.moveTo(capCx, tipY - 2);
        ctx.lineTo(capCx - 9, tipY + 12);
        ctx.lineTo(capCx + 9, tipY + 12);
        ctx.closePath();
        ctx.fill();

        // Label below the arrow.
        var lbl = '点这里 → 分享到朋友圈';
        ctx.font = 'bold 13px sans-serif';
        var lblPad = 12;
        var lblW = ctx.measureText(lbl).width + lblPad * 2;
        var lblH = 28;
        var lblX = Math.max(8, Math.min(W - lblW - 8, capCx - lblW / 2));
        var lblY = tailY + 8;
        R.roundRect(ctx, lblX, lblY, lblW, lblH, lblH / 2, 'rgba(33,33,33,0.92)');
        R.textBold(ctx, lbl, lblX + lblW / 2, lblY + lblH / 2, 13,
          hintColor, 'center', 'middle');
        ctx.restore();
      }
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

    // Tutorial step 1 is an explainer — only the "下一步" / "跳过" buttons
    // react. Block drag-starts on palette / board.
    if (tutorialMode && tutorialStep === 1) return;

    if (selectPanelOpen) {
      dragStart = { x: x, y: y };
      selectScrolled = false;
      return;
    }
    if (helpOpen) return;
    if (hintMode) return;

    // Grab a placed (non-locked) block from the board, if the touch lands on
    // one. The block is lifted into `dragging` and removed from dropped; on
    // touchEnd we either re-place at the new cell, restore to origin, or
    // (for a quick double-tap) remove to palette.
    // Disabled in tutorial step 2 so the player can only interact with the
    // designated placeable palette card.
    if (tutorialMode && tutorialStep === 2) {
      // skip board pickup
    } else if (L.cellSize && !isWon) {
      var bcs = L.cellSize;
      var btx = Math.floor((x - L.boardX) / bcs);
      var bty = Math.floor((y - L.boardY) / bcs);
      if (btx >= 0 && btx < 7 && bty >= 0 && bty < 8 && x >= L.boardX && y >= L.boardY) {
        var blkAt = B.getBlockAtCell(allBlocks(), btx, bty);
        if (blkAt && Hint.isFullyLocked(hintState, blkAt.id)) {
          showToast('该方块由强提示锁定');
          return;
        }
        if (blkAt && !isPrePlaced(blkAt.id)) {
          // Lift a board block — but DON'T remove it from `dropped` yet.
          // Removal happens on the first onTouchMove past the drag threshold,
          // so a single tap (no movement) leaves the block visually untouched
          // and avoids a one-frame disappear/reappear flicker.
          dragging = B.cloneBlock(blkAt);
          dragHasMoved = false;
          dragEnteredBoard = true;
          dragFromBoard = true;
          dragOriginX = blkAt.x;
          dragOriginY = blkAt.y;
          selected = null;
          dragStart = { x: x, y: y };
          dragPos = { x: x, y: y };
          // Capture pixel offset from finger to the block's top-left cell so
          // the same point of the block tracks the finger during drag.
          dragGripOffset = {
            x: x - (L.boardX + blkAt.x * bcs),
            y: y - (L.boardY + blkAt.y * bcs),
          };
          try { wx.vibrateShort && wx.vibrateShort({ type: 'light' }); } catch (e) {}
          return;
        }
      }
    }

    for (var i = 0; i < L.palItems.length; i++) {
      if (R.hitTest(x, y, L.palItems[i])) {
        // Tutorial step 2 locks all palette cards except the placeable one.
        if (tutorialMode && tutorialStep === 2 && tutorialPlaceableId
          && L.palItems[i].block.id !== tutorialPlaceableId) {
          return;
        }
        dragging = L.palItems[i].block;
        dragHasMoved = false;
        dragEnteredBoard = false;
        dragFromBoard = false;
        dragStart = { x: x, y: y };
        dragPos = { x: x, y: y };
        dragGripOffset = { x: L.cellSize, y: L.cellSize };
        try { wx.vibrateShort && wx.vibrateShort({ type: 'light' }); } catch (e) {}
        return;
      }
    }

    if (selected && !dragging && L.previewShape) {
      if (R.hitTest(x, y, L.previewShape)) {
        dragging = selected;
        dragHasMoved = false;
        dragEnteredBoard = false;
        dragFromBoard = false;
        dragStart = { x: x, y: y };
        dragPos = { x: x, y: y };
        dragGripOffset = { x: L.cellSize, y: L.cellSize };
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
      // For a board-origin drag we only commit the "lift" (remove from
      // `dropped`) once the user has actually moved past the threshold.
      // A tap that never crosses the threshold won't disturb the board.
      if (dragFromBoard) {
        if (Hint.isFullyLocked(hintState, dragging.id)) {
          showToast('该方块由强提示锁定');
          dragging = null;
          dragFromBoard = false;
          dragHasMoved = false;
          return;
        }
        dropped = dropped.filter(function (b) { return b.id !== dragging.id; });
      }
    }
    // Track whether the drag has snapped to a real grid cell at any point.
    if (!dragEnteredBoard && L.cellSize) {
      var ccs = L.cellSize;
      var scx = Math.round((dragPos.x - dragGripOffset.x - L.boardX) / ccs);
      var scy = Math.round((dragPos.y - dragGripOffset.y - L.boardY) / ccs);
      if (scx >= 0 && scx < 7 && scy >= 0 && scy < 8) dragEnteredBoard = true;
    }
    scene.dirty = true;
  };

  scene.onTouchEnd = function (x, y) {
    // ── Win modal: × dismisses; 随机下一题 / 完成新手教程 advances; share
    //    shares; tap outside dismisses; tap inside (not a button) is swallowed.
    if (isWon && !winCardDismissed && L.winCard) {
      if (L.winCloseBtn && R.hitTest(x, y, L.winCloseBtn)) {
        winCardDismissed = true; scene.dirty = true; return;
      }
      if (L.winFinishTutorialBtn && R.hitTest(x, y, L.winFinishTutorialBtn)) {
        progress.markTutorialDone();
        clearInterval(timerInterval);
        callbacks.onBack();
        return;
      }
      if (L.winNextBtn && R.hitTest(x, y, L.winNextBtn)) {
        executeRandomSwitch();
        return;
      }
      if (L.winMomentsBtn && R.hitTest(x, y, L.winMomentsBtn)) {
        // Mini-games have no programmatic wx.shareTimeline — only the user
        // can trigger Moments share via the capsule menu. Flash a pulsing
        // arrow at the capsule for 6s. wx.onShareTimeline in game.js makes
        // the resulting share carry our deep-link query.
        momentsHintUntil = Date.now() + 6000;
        scene.dirty = true;
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

    // Tutorial skip — works on every step.
    if (L.tutorialSkipBtn && R.hitTest(x, y, L.tutorialSkipBtn)) {
      progress.markTutorialDone();
      clearInterval(timerInterval);
      callbacks.onBack();
      return;
    }
    // Tutorial step 1 "下一步" — advance to step 2.
    if (L.tutorialNextBtn && R.hitTest(x, y, L.tutorialNextBtn)) {
      tutorialStep = 2;
      scene.dirty = true;
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
      // 获取路径 二级 menu click handling (when stamina & voucher both fall short)
      if (sourceMenuOpen) {
        for (var sbk = 0; sbk < (L.sourceMenuBtns || []).length; sbk++) {
          var sbtn = L.sourceMenuBtns[sbk];
          if (R.hitTest(x, y, sbtn)) {
            if (sbtn.kind === 'share') triggerShareGroup();
            else if (sbtn.kind === 'help') triggerHelpInvite();
            return;
          }
        }
        if (L.sourceMenuCancelBtn && R.hitTest(x, y, L.sourceMenuCancelBtn)) {
          sourceMenuOpen = false; sourceMenuTier = null;
          scene.dirty = true; return;
        }
        return; // swallow other clicks while submenu is open
      }
      // Tier selection
      if (!hintTier && L.hintTierBtns) {
        for (var tb = 0; tb < L.hintTierBtns.length; tb++) {
          if (R.hitTest(x, y, L.hintTierBtns[tb])) {
            var pickedTier = L.hintTierBtns[tb].tier;
            if (Hint.countUsed(hintState, pickedTier) >= Hint.CAPS[pickedTier]) {
              showToast('本关该提示已用完（下关重置）');
              return;
            }
            var cost = Hint.COSTS[pickedTier];
            if (pickedTier === 'weak' && Hint.FIRST_WEAK_FREE && Hint.countUsed(hintState, 'weak') === 0) {
              cost = 0;
            }
            var have = stamina.getStamina();
            if (have >= cost) {
              // stamina path (default)
              usingVoucherSource = null;
              hintTier = pickedTier;
              scene.dirty = true;
              return;
            }
            if (voucher.canUseSocial(pickedTier)) {
              // voucher path — block selection consumes a voucher instead of stamina
              usingVoucherSource = pickedTier === 'medium' ? 'share'
                : pickedTier === 'strong' ? 'help'
                : 'helperGift';
              hintTier = pickedTier;
              scene.dirty = true;
              return;
            }
            // Neither stamina nor voucher → 获取路径 二级 menu
            // weak tier has no social path yet — fall back to old toast
            if (pickedTier === 'weak') {
              showToast('体力不足！需要 ' + cost + ' 点，当前 ' + have);
              return;
            }
            sourceMenuTier = pickedTier;
            sourceMenuOpen = true;
            scene.dirty = true;
            return;
          }
        }
      }
      // Block selection
      if (hintTier) {
        for (var hi3 = 0; hi3 < L.hintItems.length; hi3++) {
          if (R.hitTest(x, y, L.hintItems[hi3])) {
            var hBlock = L.hintItems[hi3].block;
            // Per-tier lock check FIRST — don't charge for re-hints
            if (hintTier === 'weak' && Hint.isOrientationLocked(hintState, hBlock.id)) {
              showToast('该方块方向已提示过'); return;
            }
            if (hintTier === 'medium' && Hint.isMediumExhausted(hintState, hBlock.id, solvedPlacements)) {
              showToast('该方块所有位置已提示完');
              return;
            }
            if (hintTier === 'strong' && Hint.isFullyLocked(hintState, hBlock.id)) {
              showToast('该方块已强提示'); return;
            }
            // Charge — either stamina (default) or a social voucher (when usingVoucherSource set)
            if (usingVoucherSource) {
              var pidUse = currentPuzzleId();
              voucher.applyUsed(hintTier, usingVoucherSource, pidUse);
              cloudClient.useHint(hintTier, pidUse).then(function (r) {
                if (!r || !r.ok) voucher.reconcile(cloudClient, pidUse);
              }, function () { /* network: pendingUse retains entry */ });
            } else {
              var blockCost = Hint.COSTS[hintTier];
              if (hintTier === 'weak' && Hint.FIRST_WEAK_FREE && Hint.countUsed(hintState, 'weak') === 0) {
                blockCost = 0;
              }
              if (blockCost > 0 && !stamina.consumeStamina(blockCost)) {
                showToast('体力扣减失败');
                return;
              }
            }
            var res;
            if (hintTier === 'weak') {
              res = Hint.applyWeak(hintState, hBlock.id, palette, dropped, solvedPlacements);
              showToast('已提示 ' + hBlock.label + ' 的正确方向');
            } else if (hintTier === 'medium') {
              res = Hint.applyMedium(hintState, hBlock.id, palette, dropped, solvedPlacements);
              showToast('已提示 ' + hBlock.label + ' 的落点');
            } else {
              res = Hint.applyStrong(hintState, hBlock.id, palette, dropped, solvedPlacements);
              showToast('已为 ' + hBlock.label + ' 落子');
            }
            hintState = res.newState;
            palette = res.updatedPalette;
            dropped = res.updatedDropped;
            if (selected) {
              for (var sp3 = 0; sp3 < palette.length; sp3++) {
                if (palette[sp3].id === selected.id) selected.shape = palette[sp3].shape;
              }
            }
            hintMode = false;
            hintTier = null;
            usingVoucherSource = null;
            scene.dirty = true;
            return;
          }
        }
      }
      if (L.hintCloseBtn && R.hitTest(x, y, L.hintCloseBtn)) {
        if (hintTier) {
          hintTier = null;
          usingVoucherSource = null;
        } else {
          hintMode = false;
        }
        scene.dirty = true; return;
      }
      if (L.hintPopup && !R.hitTest(x, y, L.hintPopup)) {
        hintMode = false; hintTier = null; usingVoucherSource = null;
        sourceMenuOpen = false; sourceMenuTier = null;
        scene.dirty = true; return;
      }
      return;
    }

    // Drag end
    if (dragging) {
      // Tap (no move) handling differs by drag origin.
      if (!dragHasMoved) {
        if (dragFromBoard) {
          // The block was never lifted (still in `dropped`). A single tap
          // is a no-op; a double-tap removes the block to the palette.
          var tcs = L.cellSize;
          var tx = Math.floor((x - L.boardX) / tcs);
          var ty = Math.floor((y - L.boardY) / tcs);
          var now = Date.now();
          var dbl = (now - lastTap.time < 350) && lastTap.x === tx && lastTap.y === ty;
          lastTap = { time: now, x: tx, y: ty };
          if (dbl) {
            if (Hint.isFullyLocked(hintState, dragging.id)) {
              wx.showModal({
                title: '强提示锁定',
                content: '这是强提示锁定的方块，不能移除。',
                showCancel: false,
              });
            } else {
              removeDropped(dragging.id);
            }
          }
          // single tap: leave the board untouched
        } else {
          // Tap on palette card / preview shape → select.
          selected = dragging;
        }
        dragging = null;
        dragFromBoard = false;
        scene.dirty = true;
        return;
      }
      var cs = L.cellSize;
      var gx = dragPos.x - dragGripOffset.x;
      var gy = dragPos.y - dragGripOffset.y;
      var cx = Math.round((gx - L.boardX) / cs);
      var cy = Math.round((gy - L.boardY) / cs);
      var onBoard = cx >= 0 && cx < 7 && cy >= 0 && cy < 8;
      var placed = false;
      if (onBoard && B.isValidPlacement(dragging, { x: cx, y: cy }, allBlocks(), uncov, dragging.id)) {
        placeBlock(dragging, cx, cy, gx, gy);
        placed = true;
      } else if (onBoard) {
        showToast('无法放置！');
      } else if (dragEnteredBoard) {
        showToast('超出棋盘范围');
      }
      // Block came from the board and didn't land → put it back where it was.
      if (!placed && dragFromBoard) {
        var rb2 = B.cloneBlock(dragging);
        rb2.x = dragOriginX; rb2.y = dragOriginY;
        dropped.push(rb2);
      }
      dragging = null;
      dragHasMoved = false;
      dragFromBoard = false;
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
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('该方块方向已锁定'); return; }
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
        if (Hint.isOrientationLocked(hintState, selected.id)) { showToast('该方块方向已锁定'); return; }
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
      hintMode = true; hintTier = null; scene.dirty = true; return;
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
        if (blockAt && Hint.isFullyLocked(hintState, blockAt.id)) {
          wx.showModal({
            title: '强提示锁定',
            content: '这是强提示锁定的方块，不能移除。',
            showCancel: false,
          });
        } else if (blockAt && !isPrePlaced(blockAt.id)) {
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
