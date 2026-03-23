// Canvas 2D drawing helpers

function clear(ctx, W, H, color) {
  ctx.fillStyle = color || '#FAFAFA';
  ctx.fillRect(0, 0, W, H);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function text(ctx, str, x, y, size, color, align, baseline) {
  ctx.font = (size || 14) + 'px sans-serif';
  ctx.fillStyle = color || '#333';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = baseline || 'top';
  ctx.fillText(str, x, y);
}

function textBold(ctx, str, x, y, size, color, align, baseline) {
  ctx.font = 'bold ' + (size || 14) + 'px sans-serif';
  ctx.fillStyle = color || '#333';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = baseline || 'top';
  ctx.fillText(str, x, y);
}

function button(ctx, x, y, w, h, label, bg, fg, r) {
  roundRect(ctx, x, y, w, h, r || 4, bg);
  textBold(ctx, label, x + w / 2, y + h / 2, 13, fg || '#fff', 'center', 'middle');
  return { x: x, y: y, w: w, h: h };
}

function hitTest(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

// Draw a block shape as a mini grid
function blockShape(ctx, shape, color, x, y, cellSize, alpha) {
  ctx.globalAlpha = alpha || 1;
  for (var ry = 0; ry < shape.length; ry++) {
    for (var cx = 0; cx < shape[ry].length; cx++) {
      var px = x + cx * cellSize;
      var py = y + ry * cellSize;
      if (shape[ry][cx] === 1) {
        ctx.fillStyle = color;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, cellSize, cellSize);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// Overlay (semi-transparent background)
function overlay(ctx, W, H) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);
}

module.exports = {
  clear: clear,
  roundRect: roundRect,
  text: text,
  textBold: textBold,
  button: button,
  hitTest: hitTest,
  blockShape: blockShape,
  overlay: overlay,
};
