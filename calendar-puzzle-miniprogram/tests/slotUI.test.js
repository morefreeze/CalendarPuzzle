// Unit tests for slotUI.js — covers pure helpers, layout fns, and hit-tests.
// Drawing fns (ctx-dependent) are intentionally omitted.

var test   = require('node:test');
var assert = require('node:assert');
var UI     = require('../minigame/js/slotUI');

// ─── formatSavedAt ───────────────────────────────────────────────────────────

test('slotUI.formatSavedAt: returns empty string for null', function () {
  assert.strictEqual(UI.formatSavedAt(null), '');
});

test('slotUI.formatSavedAt: returns empty string for undefined', function () {
  assert.strictEqual(UI.formatSavedAt(undefined), '');
});

test('slotUI.formatSavedAt: formats epoch to M/D HH:mm pattern', function () {
  var s = UI.formatSavedAt(1716181000000);
  // Shape must be M/D HH:mm (1–2 digit month, 1–2 digit day, 2-digit hour + minute)
  assert.match(s, /^\d{1,2}\/\d{1,2} \d{2}:\d{2}$/);
});

test('slotUI.formatSavedAt: zero epoch returns valid M/D HH:mm', function () {
  var s = UI.formatSavedAt(0);
  assert.match(s, /^\d{1,2}\/\d{1,2} \d{2}:\d{2}$/);
});

// ─── pickOldestNewest ────────────────────────────────────────────────────────

test('slotUI.pickOldestNewest: all null → both null', function () {
  assert.deepStrictEqual(
    UI.pickOldestNewest([null, null, null]),
    { oldestIdx: null, newestIdx: null }
  );
});

test('slotUI.pickOldestNewest: first slot occupied → same index for both', function () {
  assert.deepStrictEqual(
    UI.pickOldestNewest([{ savedAt: 100 }, null, null]),
    { oldestIdx: 0, newestIdx: 0 }
  );
});

test('slotUI.pickOldestNewest: middle slot occupied → same index for both', function () {
  var s = { savedAt: 100 };
  assert.deepStrictEqual(
    UI.pickOldestNewest([null, s, null]),
    { oldestIdx: 1, newestIdx: 1 }
  );
});

test('slotUI.pickOldestNewest: three occupied, distinct savedAt', function () {
  var slots = [{ savedAt: 200 }, { savedAt: 100 }, { savedAt: 300 }];
  assert.deepStrictEqual(
    UI.pickOldestNewest(slots),
    { oldestIdx: 1, newestIdx: 2 }
  );
});

test('slotUI.pickOldestNewest: ties — smaller index wins oldest, larger wins newest', function () {
  var slots = [{ savedAt: 100 }, { savedAt: 100 }, { savedAt: 100 }];
  assert.deepStrictEqual(
    UI.pickOldestNewest(slots),
    { oldestIdx: 0, newestIdx: 2 }
  );
});

test('slotUI.pickOldestNewest: two occupied, first older', function () {
  var slots = [{ savedAt: 50 }, null, { savedAt: 200 }];
  assert.deepStrictEqual(
    UI.pickOldestNewest(slots),
    { oldestIdx: 0, newestIdx: 2 }
  );
});

// ─── difficultyLabel ─────────────────────────────────────────────────────────

test('slotUI.difficultyLabel: easy → 简单', function () {
  assert.strictEqual(UI.difficultyLabel('easy'), '简单');
});

test('slotUI.difficultyLabel: medium → 中等', function () {
  assert.strictEqual(UI.difficultyLabel('medium'), '中等');
});

test('slotUI.difficultyLabel: hard → 困难', function () {
  assert.strictEqual(UI.difficultyLabel('hard'), '困难');
});

test('slotUI.difficultyLabel: insomnia → 失眠', function () {
  assert.strictEqual(UI.difficultyLabel('insomnia'), '失眠');
});

test('slotUI.difficultyLabel: unknown key returns the input unchanged', function () {
  assert.strictEqual(UI.difficultyLabel('weird'), 'weird');
  assert.strictEqual(UI.difficultyLabel(''), '');
});

// ─── saveBtnLayout ───────────────────────────────────────────────────────────

test('slotUI.saveBtnLayout: correct size', function () {
  var stamina = { x: 200, y: 30, w: 92, h: 22 };
  var r = UI.saveBtnLayout(stamina);
  assert.strictEqual(r.w, UI.SAVE_BTN_SIZE.w);
  assert.strictEqual(r.h, UI.SAVE_BTN_SIZE.h);
});

test('slotUI.saveBtnLayout: 4 px gap to the left of stamina capsule', function () {
  var stamina = { x: 200, y: 30, w: 92, h: 22 };
  var r = UI.saveBtnLayout(stamina);
  assert.strictEqual(r.x, stamina.x - UI.SAVE_BTN_SIZE.w - 4);
});

test('slotUI.saveBtnLayout: vertically centred to stamina capsule', function () {
  var stamina = { x: 200, y: 30, w: 92, h: 22 };
  var r = UI.saveBtnLayout(stamina);
  assert.strictEqual(r.y, stamina.y + (stamina.h - UI.SAVE_BTN_SIZE.h) / 2);
});

// ─── savePickerLayout ────────────────────────────────────────────────────────

test('slotUI.savePickerLayout: returns 3 slot rects', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.strictEqual(L.slotRects.length, 3);
});

test('slotUI.savePickerLayout: panel horizontally centered', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.ok(Math.abs(L.panel.x - (375 - L.panel.w) / 2) < 1);
});

test('slotUI.savePickerLayout: confirmBtn is absent (tap-to-act model), cancelBtn is present', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.strictEqual(L.confirmBtn, undefined);
  assert.ok(L.cancelBtn  && typeof L.cancelBtn.x  === 'number');
});

test('slotUI.savePickerLayout: slot rects stack vertically', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.ok(L.slotRects[1].y > L.slotRects[0].y);
  assert.ok(L.slotRects[2].y > L.slotRects[1].y);
});

// ─── overwriteWarningLayout ──────────────────────────────────────────────────

test('slotUI.overwriteWarningLayout: same structure as savePickerLayout', function () {
  var L = UI.overwriteWarningLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.strictEqual(L.slotRects.length, 3);
  assert.ok(L.panel  && typeof L.panel.x === 'number');
  assert.ok(L.confirmBtn && L.cancelBtn);
});

test('slotUI.overwriteWarningLayout: panel at least as tall as savePickerLayout', function () {
  var wo = UI.overwriteWarningLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  var sp = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.ok(wo.panel.h >= sp.panel.h);
});

// ─── continueDiscardLayout ───────────────────────────────────────────────────

test('slotUI.continueDiscardLayout: continueBtn and discardBtn have distinct x positions', function () {
  var L = UI.continueDiscardLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.notStrictEqual(L.continueBtn.x, L.discardBtn.x);
});

test('slotUI.continueDiscardLayout: previewRect has positive dimensions', function () {
  var L = UI.continueDiscardLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.ok(L.previewRect && L.previewRect.w > 0 && L.previewRect.h > 0);
});

test('slotUI.continueDiscardLayout: panel is centered horizontally', function () {
  var L = UI.continueDiscardLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.ok(Math.abs(L.panel.x - (375 - L.panel.w) / 2) < 1);
});

// ─── slotGridLayout ──────────────────────────────────────────────────────────

test('slotUI.slotGridLayout: 3 slotRects for free tier', function () {
  var L = UI.slotGridLayout(375, 667, { top: 20, bottom: 20, left: 0, right: 0 }, 3);
  assert.strictEqual(L.slotRects.length, 3);
});

test('slotUI.slotGridLayout: backBtn respects top safe inset', function () {
  var L = UI.slotGridLayout(375, 667, { top: 20, bottom: 0, left: 0, right: 0 }, 3);
  assert.ok(L.backBtn.y >= 20);
});

test('slotUI.slotGridLayout: dev override — 5 slotRects', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 5);
  assert.strictEqual(L.slotRects.length, 5);
});

test('slotUI.slotGridLayout: cards centered horizontally', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 3);
  var cardW = L.slotRects[0].w;
  var expectedX = (375 - cardW) / 2;
  assert.ok(Math.abs(L.slotRects[0].x - expectedX) < 1);
});

test('slotUI.slotGridLayout: emptyHintY is below the last card', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 3);
  var lastCard = L.slotRects[L.slotRects.length - 1];
  assert.ok(L.emptyHintY > lastCard.y + lastCard.h);
});

// ─── savePickerHitTest ───────────────────────────────────────────────────────

test('slotUI.savePickerHitTest: click inside slot-1 card → "slot-1"', function () {
  var L   = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  var r   = L.slotRects[1];
  var hit = UI.savePickerHitTest(r.x + 10, r.y + 10, L);
  assert.strictEqual(hit, 'slot-1');
});

test('slotUI.savePickerHitTest: click inside slot-0 card → "slot-0"', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  var r = L.slotRects[0];
  assert.strictEqual(UI.savePickerHitTest(r.x + 5, r.y + 5, L), 'slot-0');
});

test('slotUI.savePickerHitTest: no confirm action (tap-to-act model)', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  // No part of the layout should hit-test to 'confirm' anymore
  for (var x = 0; x < 375; x += 5) {
    for (var y = 0; y < 667; y += 5) {
      var hit = UI.savePickerHitTest(x, y, L);
      assert.notStrictEqual(hit, 'confirm');
    }
  }
});

test('slotUI.savePickerHitTest: click cancel btn → "cancel"', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  var b = L.cancelBtn;
  assert.strictEqual(UI.savePickerHitTest(b.x + 5, b.y + 5, L), 'cancel');
});

test('slotUI.savePickerHitTest: click outside any rect → null', function () {
  var L = UI.savePickerLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.strictEqual(UI.savePickerHitTest(0, 0, L), null);
});

// ─── overwriteWarningHitTest ─────────────────────────────────────────────────

test('slotUI.overwriteWarningHitTest: slot + confirm + cancel + null', function () {
  var L = UI.overwriteWarningLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  var r2 = L.slotRects[2];
  assert.strictEqual(UI.overwriteWarningHitTest(r2.x + 5, r2.y + 5, L), 'slot-2');
  assert.strictEqual(UI.overwriteWarningHitTest(L.confirmBtn.x + 5, L.confirmBtn.y + 5, L), 'confirm');
  assert.strictEqual(UI.overwriteWarningHitTest(L.cancelBtn.x + 5,  L.cancelBtn.y + 5,  L), 'cancel');
  assert.strictEqual(UI.overwriteWarningHitTest(0, 0, L), null);
});

// ─── continueDiscardHitTest ──────────────────────────────────────────────────

test('slotUI.continueDiscardHitTest: continue btn hit', function () {
  var L = UI.continueDiscardLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.strictEqual(
    UI.continueDiscardHitTest(L.continueBtn.x + 5, L.continueBtn.y + 5, L), 'continue');
});

test('slotUI.continueDiscardHitTest: discard btn hit', function () {
  var L = UI.continueDiscardLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.strictEqual(
    UI.continueDiscardHitTest(L.discardBtn.x + 5, L.discardBtn.y + 5, L), 'discard');
});

test('slotUI.continueDiscardHitTest: outside → null', function () {
  var L = UI.continueDiscardLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.strictEqual(UI.continueDiscardHitTest(0, 0, L), null);
});

// ─── slotGridHitTest ─────────────────────────────────────────────────────────

test('slotUI.slotGridHitTest: back button', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 3);
  assert.strictEqual(UI.slotGridHitTest(L.backBtn.x + 5, L.backBtn.y + 5, L), 'back');
});

test('slotUI.slotGridHitTest: first slot card → "slot-0"', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 3);
  var r = L.slotRects[0];
  assert.strictEqual(UI.slotGridHitTest(r.x + 5, r.y + 5, L), 'slot-0');
});

test('slotUI.slotGridHitTest: last slot card (index 2) → "slot-2"', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 3);
  var r = L.slotRects[2];
  assert.strictEqual(UI.slotGridHitTest(r.x + 5, r.y + 5, L), 'slot-2');
});

test('slotUI.slotGridHitTest: outside all rects → null', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 3);
  assert.strictEqual(UI.slotGridHitTest(0, 0, L), null);
});

test('slotUI.slotGridHitTest: dev override 5-slot — hit slot-4', function () {
  var L = UI.slotGridLayout(375, 667, { top: 0, bottom: 0, left: 0, right: 0 }, 5);
  var r = L.slotRects[4];
  assert.strictEqual(UI.slotGridHitTest(r.x + 5, r.y + 5, L), 'slot-4');
});
