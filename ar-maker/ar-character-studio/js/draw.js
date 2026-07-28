// draw.js — the coloring canvas. Two stacked canvases:
//   #canvas-guide -> the line art (never touched by the student, always on top)
//   #canvas-draw  -> transparent layer the student actually paints on
// Flood fill reads the guide's pixel data too, so fills stop at the
// printed lines even though painting happens on a separate layer.

const AR_COLORS = [
  '#ff3b3b', '#ff6f59', '#ffc93c', '#4caf7d', '#37c6c0',
  '#4fa8e0', '#8c6ff0', '#ff8fc7', '#a2673a', '#2b2a4c',
  '#7a7a7a', '#ffdbac'
];

const AR_SIZES = { small: 6, medium: 16, large: 30 };

const ArDraw = (() => {
  // logical resolution matches the guide art's own aspect ratio (square)
  // so nothing gets stretched or padded with empty space
  const RES_W = 720, RES_H = 720;
  let guideCanvas, drawCanvas, gctx, dctx;
  let guideWallMask = null; // Uint8Array, 1 = solid line (blocks fill), computed once per guide
  let tool = 'marker';
  let color = AR_COLORS[0];
  let sizeKey = 'medium';
  let drawing = false;
  let lastX = 0, lastY = 0;
  let undoStack = [];
  let onStrokeEnd = null;
  let pointerTracker = null;

  function init({ guideSrc, onStrokeEndCb }) {
    guideCanvas = document.getElementById('canvas-guide');
    drawCanvas = document.getElementById('canvas-draw');
    guideCanvas.width = drawCanvas.width = RES_W;
    guideCanvas.height = drawCanvas.height = RES_H;
    gctx = guideCanvas.getContext('2d', { willReadFrequently: true });
    dctx = drawCanvas.getContext('2d', { willReadFrequently: true });
    onStrokeEnd = onStrokeEndCb || null;
    undoStack = [];

    gctx.clearRect(0, 0, RES_W, RES_H);
    dctx.clearRect(0, 0, RES_W, RES_H);
    guideWallMask = null;

    const img = new Image();
    img.onload = () => {
      // contain-fit so the guide's real proportions aren't stretched/cropped
      const scale = Math.min(RES_W / img.width, RES_H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (RES_W - dw) / 2, dy = (RES_H - dh) / 2;
      // crisp (nearest-neighbor) resize — smoothing blurs line edges into a
      // gray halo, which was another source of the fill fragmentation bug
      gctx.imageSmoothingEnabled = false;
      gctx.drawImage(img, dx, dy, dw, dh);

      // The guide is a JPG with a white background and black lines (no
      // transparency of its own). Turn "how white" a pixel is into "how
      // transparent" it is, so the white background becomes see-through and
      // dark linework stays opaque — same as a real transparent-background
      // asset, which is what the AR export relies on.
      //
      // Separately, build a STRICT wall mask for the flood fill using only
      // genuinely dark pixels. Using the same soft alpha for fill-blocking
      // used to make JPEG anti-aliasing / faint gray decorative lines act
      // as walls too, which split single white regions into unreachable
      // fragments. The wall mask only cares about real black linework.
      const guideImgData = gctx.getImageData(0, 0, RES_W, RES_H);
      const gd = guideImgData.data;
      const wallMask = new Uint8Array(RES_W * RES_H);
      const WALL_DARKNESS = 110; // pixels darker than this (0-255 avg) are a real line
      for (let i = 0, p = 0; i < gd.length; i += 4, p++) {
        const avg = (gd[i] + gd[i + 1] + gd[i + 2]) / 3;
        gd[i + 3] = 255 - avg;
        wallMask[p] = avg < WALL_DARKNESS ? 1 : 0;
      }
      gctx.putImageData(guideImgData, 0, 0);
      guideWallMask = wallMask;
    };
    img.src = guideSrc;

    attachPointerEvents();
  }

  function loadDrawingFromDataURL(dataURL) {
    if (!dataURL) return;
    const img = new Image();
    img.onload = () => dctx.drawImage(img, 0, 0, RES_W, RES_H);
    img.src = dataURL;
  }

  function setTool(t) { tool = t; }
  function setColor(c) { color = c; }
  function setSize(key) { sizeKey = key; }

  function pushUndo() {
    try {
      undoStack.push(dctx.getImageData(0, 0, RES_W, RES_H));
      if (undoStack.length > 15) undoStack.shift();
    } catch (e) { /* ignore */ }
  }

  function undo() {
    if (!undoStack.length) return;
    const prev = undoStack.pop();
    dctx.putImageData(prev, 0, 0);
    if (onStrokeEnd) onStrokeEnd();
  }

  // Called when a second finger touches down (pinch-zoom starting) so the
  // single-pointer drawing tracker doesn't mistake the pinch for a stroke.
  function cancelStroke() {
    if (pointerTracker) pointerTracker.reset();
    drawing = false;
  }

  function strokeAt(x, y) {
    const size = AR_SIZES[sizeKey];
    if (tool === 'eraser') {
      dctx.globalCompositeOperation = 'destination-out';
      dctx.beginPath();
      dctx.arc(x, y, size, 0, Math.PI * 2);
      dctx.fill();
      dctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (tool === 'airbrush') {
      dctx.globalCompositeOperation = 'source-over';
      dctx.fillStyle = color;
      const dots = 10;
      for (let i = 0; i < dots; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * size * 1.6;
        const dx = x + Math.cos(angle) * radius;
        const dy = y + Math.sin(angle) * radius;
        dctx.globalAlpha = 0.12;
        dctx.beginPath();
        dctx.arc(dx, dy, size * 0.35, 0, Math.PI * 2);
        dctx.fill();
      }
      dctx.globalAlpha = 1;
      return;
    }
    // marker / pencil share the same line-draw logic, different weight/alpha
    dctx.globalCompositeOperation = 'source-over';
    dctx.lineCap = 'round';
    dctx.lineJoin = 'round';
    dctx.strokeStyle = color;
    dctx.globalAlpha = tool === 'pencil' ? 0.55 : 1;
    dctx.lineWidth = tool === 'pencil' ? size * 0.5 : size;
    dctx.beginPath();
    dctx.moveTo(lastX, lastY);
    dctx.lineTo(x, y);
    dctx.stroke();
    dctx.globalAlpha = 1;
  }

  // Flood fill on the draw layer. Two rules:
  //  - a real guide line (per the strict wall mask) always blocks the fill
  //  - otherwise, it spreads through pixels that match whatever was at the
  //    click point (empty, or a specific painted color) and repaints them —
  //    so tapping an already-colored area with a new color re-fills it
  //    instead of doing nothing.
  function floodFill(startX, startY) {
    const sx = Math.floor(startX), sy = Math.floor(startY);
    if (sx < 0 || sy < 0 || sx >= RES_W || sy >= RES_H) return;
    if (!guideWallMask) return; // guide hasn't finished loading yet

    const idx = (x, y) => (y * RES_W + x) * 4;
    const startPixel = sy * RES_W + sx;
    if (guideWallMask[startPixel]) return; // tapped directly on a line

    const drawImgData = dctx.getImageData(0, 0, RES_W, RES_H);
    const data = drawImgData.data;
    const startIdx = idx(sx, sy);

    const isTargetEmpty = data[startIdx + 3] < 40;
    const tR = data[startIdx], tG = data[startIdx + 1], tB = data[startIdx + 2];
    const fillColor = hexToRgb(color);

    // already exactly this color — nothing to do
    if (!isTargetEmpty && tR === fillColor.r && tG === fillColor.g && tB === fillColor.b) return;

    function matchesTarget(i) {
      if (isTargetEmpty) return data[i + 3] < 40;
      return data[i + 3] >= 40 &&
        Math.abs(data[i] - tR) <= 8 && Math.abs(data[i + 1] - tG) <= 8 && Math.abs(data[i + 2] - tB) <= 8;
    }

    const stack = [[sx, sy]];
    const visited = new Uint8Array(RES_W * RES_H);
    visited[startPixel] = 1;
    let guard = 0;
    const maxSteps = RES_W * RES_H; // now a true upper bound — each pixel is pushed at most once

    while (stack.length && guard < maxSteps) {
      guard++;
      const [x, y] = stack.pop();
      const i = idx(x, y);

      data[i] = fillColor.r;
      data[i + 1] = fillColor.g;
      data[i + 2] = fillColor.b;
      data[i + 3] = 255;

      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= RES_W || ny >= RES_H) continue;
        const nv = ny * RES_W + nx;
        if (visited[nv]) continue;
        if (guideWallMask[nv]) continue;
        const ni = idx(nx, ny);
        if (!matchesTarget(ni)) continue;
        visited[nv] = 1; // mark on push, not on pop — this is the key fix
        stack.push([nx, ny]);
      }
    }
    dctx.putImageData(drawImgData, 0, 0);
  }

  function hexToRgb(hex) {
    const m = hex.replace('#', '');
    return {
      r: parseInt(m.substring(0, 2), 16),
      g: parseInt(m.substring(2, 4), 16),
      b: parseInt(m.substring(4, 6), 16)
    };
  }

  function attachPointerEvents() {
    if (pointerTracker) {
      pointerTracker.destroy();
      pointerTracker = null;
    }
    pointerTracker = ClassroomGuard.singlePointer.attach(drawCanvas, {
      onStart(pos) {
        pushUndo();
        lastX = pos.x; lastY = pos.y;
        if (tool === 'fill') {
          floodFill(pos.x, pos.y);
          if (onStrokeEnd) onStrokeEnd();
          return;
        }
        drawing = true;
        strokeAt(pos.x, pos.y);
      },
      onMove(pos) {
        if (!drawing) return;
        strokeAt(pos.x, pos.y);
        lastX = pos.x; lastY = pos.y;
      },
      onEnd() {
        if (!drawing) return;
        drawing = false;
        if (onStrokeEnd) onStrokeEnd();
      }
    });
  }

  function getDataURL() {
    // Composite guide (line art) over the paint so the exported character
    // keeps its outline, on a transparent background.
    const out = document.createElement('canvas');
    out.width = RES_W; out.height = RES_H;
    const octx = out.getContext('2d');
    octx.drawImage(drawCanvas, 0, 0);
    octx.drawImage(guideCanvas, 0, 0);
    return out.toDataURL('image/png');
  }

  function getRawDrawDataURL() {
    return drawCanvas.toDataURL('image/png');
  }

  return { init, setTool, setColor, setSize, undo, cancelStroke, getDataURL, getRawDrawDataURL, loadDrawingFromDataURL };
})();
