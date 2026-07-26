// draw.js — the coloring canvas. Two stacked canvases:
//   #canvas-guide -> the line art (never touched by the student, always on top)
//   #canvas-draw  -> transparent layer the student actually paints on
// Flood fill reads the guide's pixel data too, so fills stop at the
// printed lines even though painting happens on a separate layer.

const AR_COLORS = [
  '#ff3b3b', '#ff6f59', '#ffc93c', '#4caf7d', '#37c6c0',
  '#4fa8e0', '#8c6ff0', '#ff8fc7', '#a2673a', '#2b2a4c',
  '#7a7a7a', '#ffffff'
];

const AR_SIZES = { small: 6, medium: 16, large: 30 };

const ArDraw = (() => {
  // logical resolution matches the guide art's own aspect ratio (1376x768)
  // so nothing gets stretched or padded with empty space
  const RES_W = 720, RES_H = 402;
  let guideCanvas, drawCanvas, gctx, dctx;
  let tool = 'marker';
  let color = AR_COLORS[0];
  let sizeKey = 'medium';
  let drawing = false;
  let lastX = 0, lastY = 0;
  let undoStack = [];
  let onStrokeEnd = null;

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

    const img = new Image();
    img.onload = () => {
      // contain-fit so the guide's real proportions aren't stretched/cropped
      const scale = Math.min(RES_W / img.width, RES_H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (RES_W - dw) / 2, dy = (RES_H - dh) / 2;
      gctx.drawImage(img, dx, dy, dw, dh);

      // The guide is a JPG with a white background and black lines (no
      // transparency of its own). Turn "how white" a pixel is into "how
      // transparent" it is, so the white background becomes see-through and
      // dark linework stays opaque — same as a real transparent-background
      // asset, which is what the flood fill and the AR export rely on.
      const guideImgData = gctx.getImageData(0, 0, RES_W, RES_H);
      const gd = guideImgData.data;
      for (let i = 0; i < gd.length; i += 4) {
        const avg = (gd[i] + gd[i + 1] + gd[i + 2]) / 3;
        gd[i + 3] = 255 - avg;
      }
      gctx.putImageData(guideImgData, 0, 0);
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

  function getPos(evt) {
    const rect = drawCanvas.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    const x = (point.clientX - rect.left) * (RES_W / rect.width);
    const y = (point.clientY - rect.top) * (RES_H / rect.height);
    return { x, y };
  }

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

  // Flood fill on the draw layer, using the guide layer's alpha as a wall.
  function floodFill(startX, startY) {
    const sx = Math.floor(startX), sy = Math.floor(startY);
    if (sx < 0 || sy < 0 || sx >= RES_W || sy >= RES_H) return;

    const guideData = gctx.getImageData(0, 0, RES_W, RES_H).data;
    const drawImgData = dctx.getImageData(0, 0, RES_W, RES_H);
    const data = drawImgData.data;

    const idx = (x, y) => (y * RES_W + x) * 4;
    const startIdx = idx(sx, sy);
    if (guideData[startIdx + 3] > 80) return; // clicked on a line, ignore
    if (data[startIdx + 3] > 40) return; // already painted here, ignore

    const fillColor = hexToRgb(color);
    const stack = [[sx, sy]];
    const visited = new Uint8Array(RES_W * RES_H);
    let guard = 0;
    const maxSteps = RES_W * RES_H;

    while (stack.length && guard < maxSteps) {
      guard++;
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= RES_W || y >= RES_H) continue;
      const v = y * RES_W + x;
      if (visited[v]) continue;
      visited[v] = 1;

      const i = idx(x, y);
      if (guideData[i + 3] > 80) continue;   // guide line = wall
      if (data[i + 3] > 40) continue;        // already-painted pixel = wall

      data[i] = fillColor.r;
      data[i + 1] = fillColor.g;
      data[i + 2] = fillColor.b;
      data[i + 3] = 255;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
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
    const start = (e) => {
      e.preventDefault();
      pushUndo();
      const { x, y } = getPos(e);
      lastX = x; lastY = y;
      if (tool === 'fill') {
        floodFill(x, y);
        if (onStrokeEnd) onStrokeEnd();
        return;
      }
      drawing = true;
      strokeAt(x, y);
    };
    const move = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      strokeAt(x, y);
      lastX = x; lastY = y;
    };
    const end = () => {
      if (!drawing) return;
      drawing = false;
      if (onStrokeEnd) onStrokeEnd();
    };

    drawCanvas.addEventListener('pointerdown', start);
    drawCanvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    drawCanvas.addEventListener('touchstart', start, { passive: false });
    drawCanvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
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

  return { init, setTool, setColor, setSize, undo, getDataURL, getRawDrawDataURL, loadDrawingFromDataURL };
})();
