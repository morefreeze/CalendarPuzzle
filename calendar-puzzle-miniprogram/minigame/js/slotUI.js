// slotUI.js — pure layout / draw / hit-test helpers for save-slot UI.
// No internal state, no wx.* calls. The scene caller owns modal state
// and handles overlay drawing; slotUI draws only the panel itself.

var R = require('./render');

// ─── Constants ───────────────────────────────────────────────────────────────
var BRAND       = '#FFB300';
var BRAND_DARK  = '#E65100';
var DANGER      = '#E53935';
var TEXT_DARK   = '#5D4037';
var TEXT_LIGHT  = '#FFFFFF';
var EMPTY_GREY  = '#BDBDBD';
var PANEL_BG    = '#FFFFFF';
var PANEL_RADIUS = 14;
var BTN_RADIUS   = 8;
var SAVE_BTN_SIZE = { w: 32, h: 22 };

// ─── Block color palette for thumbnails ──────────────────────────────────────
var BLOCK_COLORS = {
  'I-block': '#42A5F5',
  'T-block': '#AB47BC',
  'L-block': '#26A69A',
  'J-block': '#EC407A',
  'S-block': '#66BB6A',
  'Z-block': '#EF5350',
  'O-block': '#FFA726',
  'U-block': '#8D6E63',
  'V-block': '#78909C',
  'W-block': '#29B6F6',
  'Y-block': '#D4E157',
  'F-block': '#FF7043',
  'N-block': '#26C6DA',
  'P-block': '#9CCC65',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Format epoch milliseconds to "M/D HH:mm" in local time.
 * Returns '' for null/undefined.
 */
function formatSavedAt(epochMs) {
  if (epochMs == null) return '';
  var d = new Date(epochMs);
  var month = d.getMonth() + 1;
  var day   = d.getDate();
  var hh    = String(d.getHours()).padStart(2, '0');
  var mm    = String(d.getMinutes()).padStart(2, '0');
  return month + '/' + day + ' ' + hh + ':' + mm;
}

/**
 * Given a 3-element array of slot objects or nulls, return
 * { oldestIdx, newestIdx } where each is the index (or null if 0 occupied).
 * If 1 occupied: both point to the same index.
 * Ties: smaller index wins for "oldest", larger wins for "newest".
 */
function pickOldestNewest(slots) {
  var oldestIdx = null;
  var newestIdx = null;
  for (var i = 0; i < slots.length; i++) {
    if (slots[i] == null) continue;
    var t = slots[i].savedAt;
    if (oldestIdx === null) {
      oldestIdx = i;
      newestIdx = i;
    } else {
      // Ties: smaller index wins for oldest (strict <)
      if (t < slots[oldestIdx].savedAt) oldestIdx = i;
      // Ties: larger index wins for newest (>=)
      if (t >= slots[newestIdx].savedAt) newestIdx = i;
    }
  }
  return { oldestIdx: oldestIdx, newestIdx: newestIdx };
}

/**
 * Map difficulty key to Chinese label. Unknown keys pass through unchanged.
 */
function difficultyLabel(diffKey) {
  var MAP = {
    easy:     '简单',
    medium:   '中等',
    hard:     '困难',
    insomnia: '失眠',
  };
  return MAP.hasOwnProperty(diffKey) ? MAP[diffKey] : diffKey;
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

/**
 * Position the 💾 save button 4 px to the left of the stamina capsule,
 * vertically centred to it.
 * Input: { x, y, w, h } of the stamina capsule.
 * Output: { x, y, w, h } for the save button.
 */
function saveBtnLayout(staminaRect) {
  var w = SAVE_BTN_SIZE.w;
  var h = SAVE_BTN_SIZE.h;
  return {
    x: staminaRect.x - w - 4,
    y: staminaRect.y + (staminaRect.h - h) / 2,
    w: w,
    h: h,
  };
}

/**
 * Compute the layout for the save-picker modal (centered panel).
 * Returns:
 *   { panel, headerY, slotRects:[r,r,r], confirmBtn, cancelBtn }
 */
function savePickerLayout(W, H, safeInsets) {
  var panelH = 320;
  var panelW = Math.min(W * 0.85, 320);
  var panelX = (W - panelW) / 2;
  var panelY = (H - panelH) / 2;

  var headerY = panelY + 18;

  var cardW  = panelW - 40;
  var cardH  = 64;
  var cardGap = 8;
  var cardX  = panelX + (panelW - cardW) / 2;
  var cardStartY = headerY + 28;

  var slotRects = [];
  for (var i = 0; i < 3; i++) {
    slotRects.push({
      x: cardX,
      y: cardStartY + i * (cardH + cardGap),
      w: cardW,
      h: cardH,
    });
  }

  var btnW = 120;
  var btnH = 36;
  var btnY  = panelY + panelH - btnH - 16;
  var totalBtnW = btnW * 2 + 12;
  var btnStartX = panelX + (panelW - totalBtnW) / 2;

  return {
    panel: { x: panelX, y: panelY, w: panelW, h: panelH },
    headerY: headerY,
    slotRects: slotRects,
    confirmBtn: { x: btnStartX,          y: btnY, w: btnW, h: btnH },
    cancelBtn:  { x: btnStartX + btnW + 12, y: btnY, w: btnW, h: btnH },
  };
}

/**
 * Layout for the overwrite-warning modal.
 * Same structure as savePickerLayout but with a taller panel
 * to accommodate the warning header.
 */
function overwriteWarningLayout(W, H, safeInsets) {
  var panelH = 340;
  var panelW = Math.min(W * 0.85, 320);
  var panelX = (W - panelW) / 2;
  var panelY = (H - panelH) / 2;

  var headerY = panelY + 18;

  var cardW  = panelW - 40;
  var cardH  = 64;
  var cardGap = 8;
  var cardX  = panelX + (panelW - cardW) / 2;
  var cardStartY = headerY + 36;

  var slotRects = [];
  for (var i = 0; i < 3; i++) {
    slotRects.push({
      x: cardX,
      y: cardStartY + i * (cardH + cardGap),
      w: cardW,
      h: cardH,
    });
  }

  var btnW = 120;
  var btnH = 36;
  var btnY  = panelY + panelH - btnH - 16;
  var totalBtnW = btnW * 2 + 12;
  var btnStartX = panelX + (panelW - totalBtnW) / 2;

  return {
    panel: { x: panelX, y: panelY, w: panelW, h: panelH },
    headerY: headerY,
    slotRects: slotRects,
    confirmBtn: { x: btnStartX,          y: btnY, w: btnW, h: btnH },
    cancelBtn:  { x: btnStartX + btnW + 12, y: btnY, w: btnW, h: btnH },
  };
}

/**
 * Layout for the "continue or discard" modal.
 * Returns: { panel, previewRect, continueBtn, discardBtn }
 */
function continueDiscardLayout(W, H, safeInsets) {
  var panelW = Math.min(W * 0.85, 300);
  var panelH = 220;
  var panelX = (W - panelW) / 2;
  var panelY = (H - panelH) / 2;

  var thumbW = 64;
  var thumbH = 56;
  var thumbX = panelX + (panelW - thumbW) / 2;
  var thumbY = panelY + 36;

  var btnW = 120;
  var btnH = 36;
  var btnY  = panelY + panelH - btnH - 16;
  var totalBtnW = btnW * 2 + 12;
  var btnStartX = panelX + (panelW - totalBtnW) / 2;

  return {
    panel:       { x: panelX, y: panelY, w: panelW, h: panelH },
    previewRect: { x: thumbX, y: thumbY, w: thumbW, h: thumbH },
    continueBtn: { x: btnStartX,           y: btnY, w: btnW, h: btnH },
    discardBtn:  { x: btnStartX + btnW + 12, y: btnY, w: btnW, h: btnH },
  };
}

/**
 * Full-screen "继续游戏" slot grid layout.
 * slotCount: typically 3 (free tier), can be higher for dev override.
 * Returns: { backBtn, titleY, slotRects, emptyHintY }
 */
function slotGridLayout(W, H, safeInsets, slotCount) {
  var topInset = (safeInsets && safeInsets.top) || 0;

  var backBtnW = 60;
  var backBtnH = 32;
  var backBtnX = (safeInsets && safeInsets.left) || 12;
  var backBtnY = topInset + 12;

  var titleY = backBtnY + backBtnH + 12;

  var cardW   = W * 0.78;
  var cardH   = 80;
  var cardGap = 12;
  var cardX   = (W - cardW) / 2;
  var cardStartY = titleY + 36;

  var slotRects = [];
  for (var i = 0; i < slotCount; i++) {
    slotRects.push({
      x: cardX,
      y: cardStartY + i * (cardH + cardGap),
      w: cardW,
      h: cardH,
    });
  }

  var lastCardBottom = slotRects.length > 0
    ? slotRects[slotRects.length - 1].y + cardH
    : cardStartY;

  return {
    backBtn:    { x: backBtnX, y: backBtnY, w: backBtnW, h: backBtnH },
    titleY:     titleY,
    slotRects:  slotRects,
    emptyHintY: lastCardBottom + 24,
  };
}

// ─── Drawing functions ────────────────────────────────────────────────────────
// These use ctx (canvas 2D context) and have side effects; not unit-tested.
// The scene caller is responsible for drawing the overlay before calling these.

/**
 * Draw the 💾 save button (BRAND-coloured rounded rect with white icon text).
 */
function drawSaveBtn(ctx, rect) {
  R.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, BTN_RADIUS, BRAND);
  R.text(ctx, '💾', rect.x + rect.w / 2, rect.y + rect.h / 2, 14,
    TEXT_LIGHT, 'center', 'middle');
}

/**
 * Draw the save-slot picker panel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layout - from savePickerLayout()
 * @param {Array}  slots  - 3-element array (Slot|null)
 * @param {number|null} selectedIdx - currently highlighted slot index
 */
function drawSavePicker(ctx, layout, slots, selectedIdx) {
  var p = layout.panel;
  // Panel shadow
  ctx.shadowColor    = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur     = 14;
  ctx.shadowOffsetY  = 4;
  R.roundRect(ctx, p.x, p.y, p.w, p.h, PANEL_RADIUS, PANEL_BG, BRAND);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetY = 0;

  // Header
  R.textBold(ctx, '保存到哪一槽？',
    p.x + p.w / 2, layout.headerY, 15, BRAND, 'center', 'top');

  // Slot cards
  for (var i = 0; i < 3; i++) {
    var r = layout.slotRects[i];
    var slot = slots[i];
    var isSelected = (i === selectedIdx);
    var borderColor = isSelected ? BRAND : '#DDDDDD';
    var borderWidth = isSelected ? 2.5 : 1;

    if (slot == null) {
      // Empty slot
      R.roundRect(ctx, r.x, r.y, r.w, r.h, 8, '#F5F5F5', EMPTY_GREY);
      R.text(ctx, '空', r.x + r.w / 2, r.y + r.h / 2, 14, EMPTY_GREY,
        'center', 'middle');
    } else {
      // Occupied slot
      ctx.lineWidth = borderWidth;
      R.roundRect(ctx, r.x, r.y, r.w, r.h, 8, PANEL_BG, borderColor);
      drawThumbnail(ctx, r.x + 6, r.y + (r.h - 48) / 2, 48, 48, slot);
      R.textBold(ctx, difficultyLabel(slot.difficulty),
        r.x + 62, r.y + 12, 12, TEXT_DARK, 'left', 'top');
      R.text(ctx, formatSavedAt(slot.savedAt),
        r.x + 62, r.y + 30, 11, '#888888', 'left', 'top');
    }
  }

  // Buttons
  R.button(ctx, layout.confirmBtn.x, layout.confirmBtn.y,
    layout.confirmBtn.w, layout.confirmBtn.h, '保存', BRAND, TEXT_LIGHT, BTN_RADIUS);
  R.button(ctx, layout.cancelBtn.x, layout.cancelBtn.y,
    layout.cancelBtn.w, layout.cancelBtn.h, '取消', '#EEEEEE', '#333333', BTN_RADIUS);
}

/**
 * Draw the overwrite-warning panel (all 3 slots occupied).
 */
function drawOverwriteWarning(ctx, layout, slots, oldestIdx, newestIdx) {
  var p = layout.panel;
  ctx.shadowColor   = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur    = 14;
  ctx.shadowOffsetY = 4;
  R.roundRect(ctx, p.x, p.y, p.w, p.h, PANEL_RADIUS, PANEL_BG, DANGER);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetY = 0;

  R.textBold(ctx, '⚠️ 槽位已满 — 覆盖哪个？',
    p.x + p.w / 2, layout.headerY, 14, DANGER, 'center', 'top');

  for (var i = 0; i < 3; i++) {
    var r = layout.slotRects[i];
    var slot = slots[i];
    R.roundRect(ctx, r.x, r.y, r.w, r.h, 8, PANEL_BG, '#DDDDDD');
    if (slot) {
      drawThumbnail(ctx, r.x + 6, r.y + (r.h - 48) / 2, 48, 48, slot);
      var label = difficultyLabel(slot.difficulty);
      if (i === oldestIdx) label += ' (最旧)';
      else if (i === newestIdx) label += ' (最近)';
      R.textBold(ctx, label, r.x + 62, r.y + 12, 12, TEXT_DARK, 'left', 'top');
      R.text(ctx, formatSavedAt(slot.savedAt),
        r.x + 62, r.y + 30, 11, '#888888', 'left', 'top');
    }
  }

  R.button(ctx, layout.confirmBtn.x, layout.confirmBtn.y,
    layout.confirmBtn.w, layout.confirmBtn.h, '覆盖', DANGER, TEXT_LIGHT, BTN_RADIUS);
  R.button(ctx, layout.cancelBtn.x, layout.cancelBtn.y,
    layout.cancelBtn.w, layout.cancelBtn.h, '取消', '#EEEEEE', '#333333', BTN_RADIUS);
}

/**
 * Draw the "continue or discard" modal for an unsaved temp slot.
 */
function drawContinueDiscard(ctx, layout, unsavedSlot) {
  var p = layout.panel;
  ctx.shadowColor   = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur    = 14;
  ctx.shadowOffsetY = 4;
  R.roundRect(ctx, p.x, p.y, p.w, p.h, PANEL_RADIUS, PANEL_BG, BRAND);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetY = 0;

  R.textBold(ctx, '还有未完成的对局',
    p.x + p.w / 2, p.y + 14, 15, TEXT_DARK, 'center', 'top');

  var pr = layout.previewRect;
  drawThumbnail(ctx, pr.x, pr.y, pr.w, pr.h, unsavedSlot);

  if (unsavedSlot) {
    var infoY = pr.y + pr.h + 8;
    R.text(ctx, difficultyLabel(unsavedSlot.difficulty) + '  ' + (unsavedSlot.date || ''),
      p.x + p.w / 2, infoY, 12, '#666666', 'center', 'top');
  }

  R.button(ctx, layout.continueBtn.x, layout.continueBtn.y,
    layout.continueBtn.w, layout.continueBtn.h, '继续未完成', BRAND, TEXT_LIGHT, BTN_RADIUS);
  R.button(ctx, layout.discardBtn.x, layout.discardBtn.y,
    layout.discardBtn.w, layout.discardBtn.h, '放弃，开新局', '#EEEEEE', '#333333', BTN_RADIUS);
}

/**
 * Draw the full-screen slot grid ("我的存档").
 */
function drawSlotGrid(ctx, layout, slots) {
  // Back button
  R.button(ctx, layout.backBtn.x, layout.backBtn.y,
    layout.backBtn.w, layout.backBtn.h, '← 返回', '#EEEEEE', '#333333', BTN_RADIUS);

  // Title
  R.textBold(ctx, '我的存档',
    layout.backBtn.x + layout.backBtn.w + 10,
    layout.titleY, 16, TEXT_DARK, 'left', 'top');

  // Slot cards
  var allEmpty = true;
  for (var i = 0; i < layout.slotRects.length; i++) {
    var r = layout.slotRects[i];
    var slot = slots ? slots[i] : null;
    if (slot == null) {
      R.roundRect(ctx, r.x, r.y, r.w, r.h, 10, '#F5F5F5', EMPTY_GREY);
      R.text(ctx, '空', r.x + r.w / 2, r.y + r.h / 2, 14, EMPTY_GREY,
        'center', 'middle');
    } else {
      allEmpty = false;
      R.roundRect(ctx, r.x, r.y, r.w, r.h, 10, PANEL_BG, '#DDDDDD');
      drawThumbnail(ctx, r.x + 8, r.y + (r.h - 56) / 2, 56, 56, slot);
      R.textBold(ctx, difficultyLabel(slot.difficulty),
        r.x + 72, r.y + 14, 13, TEXT_DARK, 'left', 'top');
      R.text(ctx, slot.date || '',
        r.x + 72, r.y + 32, 12, '#888888', 'left', 'top');
      R.text(ctx, formatSavedAt(slot.savedAt),
        r.x + 72, r.y + 48, 11, '#AAAAAA', 'left', 'top');
    }
  }

  // Empty hint
  if (allEmpty) {
    R.text(ctx, '暂无存档',
      layout.backBtn.x + 10, layout.emptyHintY, 14, EMPTY_GREY, 'left', 'top');
  }
}

/**
 * Draw a small thumbnail of the board state from slot.placedBlocks.
 * Board is 7 cols × 8 rows. Draws an outline and one coloured square per
 * placed-block cell.
 * If slot is null/undefined: just outline + light grey fill.
 */
function drawThumbnail(ctx, x, y, w, h, slot) {
  var COLS = 7;
  var ROWS = 8;
  var cell = Math.min((w - 2) / COLS, (h - 2) / ROWS);
  var ox = x + (w - cell * COLS) / 2;
  var oy = y + (h - cell * ROWS) / 2;

  // Outline + background
  ctx.fillStyle   = '#F5F5F5';
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth   = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  if (!slot || !slot.placedBlocks || !slot.placedBlocks.length) return;

  for (var b = 0; b < slot.placedBlocks.length; b++) {
    var block = slot.placedBlocks[b];
    if (!block) continue;
    var color = BLOCK_COLORS[block.type] || '#90A4AE';
    var bx = block.x;
    var by = block.y;
    // block.x / block.y are the board-coordinate origin of the block;
    // we draw a single coloured cell at that position as a lightweight proxy.
    ctx.fillStyle = color;
    ctx.fillRect(
      ox + bx * cell,
      oy + by * cell,
      Math.max(1, cell - 0.5),
      Math.max(1, cell - 0.5)
    );
  }
}

// ─── Hit-test helpers ─────────────────────────────────────────────────────────

/**
 * Returns 'slot-0' | 'slot-1' | 'slot-2' | 'confirm' | 'cancel' | null.
 */
function savePickerHitTest(x, y, layout) {
  for (var i = 0; i < layout.slotRects.length; i++) {
    if (R.hitTest(x, y, layout.slotRects[i])) return 'slot-' + i;
  }
  if (R.hitTest(x, y, layout.confirmBtn)) return 'confirm';
  if (R.hitTest(x, y, layout.cancelBtn))  return 'cancel';
  return null;
}

/**
 * Returns 'slot-0' | 'slot-1' | 'slot-2' | 'confirm' | 'cancel' | null.
 */
function overwriteWarningHitTest(x, y, layout) {
  for (var i = 0; i < layout.slotRects.length; i++) {
    if (R.hitTest(x, y, layout.slotRects[i])) return 'slot-' + i;
  }
  if (R.hitTest(x, y, layout.confirmBtn)) return 'confirm';
  if (R.hitTest(x, y, layout.cancelBtn))  return 'cancel';
  return null;
}

/**
 * Returns 'continue' | 'discard' | null.
 */
function continueDiscardHitTest(x, y, layout) {
  if (R.hitTest(x, y, layout.continueBtn)) return 'continue';
  if (R.hitTest(x, y, layout.discardBtn))  return 'discard';
  return null;
}

/**
 * Returns 'back' | 'slot-0' | 'slot-1' | ... | null.
 */
function slotGridHitTest(x, y, layout) {
  if (R.hitTest(x, y, layout.backBtn)) return 'back';
  for (var i = 0; i < layout.slotRects.length; i++) {
    if (R.hitTest(x, y, layout.slotRects[i])) return 'slot-' + i;
  }
  return null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Constants
  BRAND:         BRAND,
  BRAND_DARK:    BRAND_DARK,
  DANGER:        DANGER,
  TEXT_DARK:     TEXT_DARK,
  TEXT_LIGHT:    TEXT_LIGHT,
  EMPTY_GREY:    EMPTY_GREY,
  PANEL_BG:      PANEL_BG,
  PANEL_RADIUS:  PANEL_RADIUS,
  BTN_RADIUS:    BTN_RADIUS,
  SAVE_BTN_SIZE: SAVE_BTN_SIZE,
  // Pure helpers
  formatSavedAt:    formatSavedAt,
  pickOldestNewest: pickOldestNewest,
  difficultyLabel:  difficultyLabel,
  // Layouts
  saveBtnLayout:           saveBtnLayout,
  savePickerLayout:        savePickerLayout,
  overwriteWarningLayout:  overwriteWarningLayout,
  continueDiscardLayout:   continueDiscardLayout,
  slotGridLayout:          slotGridLayout,
  // Drawing (ctx-dependent; not unit-tested)
  drawSaveBtn:          drawSaveBtn,
  drawSavePicker:       drawSavePicker,
  drawOverwriteWarning: drawOverwriteWarning,
  drawContinueDiscard:  drawContinueDiscard,
  drawSlotGrid:         drawSlotGrid,
  drawThumbnail:        drawThumbnail,
  // Hit-tests
  savePickerHitTest:       savePickerHitTest,
  overwriteWarningHitTest: overwriteWarningHitTest,
  continueDiscardHitTest:  continueDiscardHitTest,
  slotGridHitTest:         slotGridHitTest,
};
