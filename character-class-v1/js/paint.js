/**
 * paint.js
 * 색칠하기 기능
 */

const Paint = {
  currentColor: null,
  
  init() {
    Character.initPaintCanvas();
    this.currentColor = COLOR_PALETTE[0];
    this.renderPalette();
    this.attachCanvasListener();
  },

  renderPalette() {
    const container = document.getElementById("colorPalette");
    if (!container) return;
    container.innerHTML = "";
    
    COLOR_PALETTE.forEach((color, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-swatch";
      btn.style.backgroundColor = color.hex;
      btn.title = color.name;
      if (idx === 0) btn.classList.add("selected");
      
      btn.addEventListener("click", () => {
        this.selectColor(idx);
      });
      
      container.appendChild(btn);
    });
  },

  selectColor(index) {
    this.currentColor = COLOR_PALETTE[index];
    document.querySelectorAll(".color-swatch").forEach((btn, i) => {
      btn.classList.toggle("selected", i === index);
    });
  },

  attachCanvasListener() {
    const canvas = document.getElementById("previewCanvas");
    if (!canvas) return;
    
    canvas.addEventListener("click", (e) => {
      if (!this.currentColor) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      
      this.paint(x, y, this.currentColor);
    });
  },

  paint(startX, startY, color) {
    const canvas = Character.paintData.canvas;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imageData.data;
    
    const previewCanvas = document.getElementById("previewCanvas");
    const previewCtx = previewCanvas.getContext("2d");
    const previewData = previewCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const previewPixels = previewData.data;
    
    const wall = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);
    for (let i = 0; i < CANVAS_WIDTH * CANVAS_HEIGHT; i++) {
      const alpha = previewPixels[i * 4 + 3];
      const r = previewPixels[i * 4 + 0];
      const g = previewPixels[i * 4 + 1];
      const b = previewPixels[i * 4 + 2];
      const brightness = (r + g + b) / 3;
      
      const fillable = alpha > 200 && brightness > 200;
      wall[i] = fillable ? 0 : 1;
    }
    
    const startIdx = startY * CANVAS_WIDTH + startX;
    if (startX < 0 || startX >= CANVAS_WIDTH || startY < 0 || startY >= CANVAS_HEIGHT || wall[startIdx]) {
      return;
    }
    
    const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);
    const queue = [startIdx];
    visited[startIdx] = 1;
    
    while (queue.length > 0) {
      const idx = queue.shift();
      const x = idx % CANVAS_WIDTH;
      const y = Math.floor(idx / CANVAS_WIDTH);
      
      const colR = parseInt(color.hex.slice(1, 3), 16);
      const colG = parseInt(color.hex.slice(3, 5), 16);
      const colB = parseInt(color.hex.slice(5, 7), 16);
      data[idx * 4 + 0] = colR;
      data[idx * 4 + 1] = colG;
      data[idx * 4 + 2] = colB;
      data[idx * 4 + 3] = 255;
      
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < CANVAS_WIDTH && ny >= 0 && ny < CANVAS_HEIGHT) {
          const nidx = ny * CANVAS_WIDTH + nx;
          if (!visited[nidx] && !wall[nidx]) {
            visited[nidx] = 1;
            queue.push(nidx);
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const isNewTone = Character.markToneDiscovered(color.tone);
    if (isNewTone) {
      this.showDiscoveryPopup(color.tone);
    }
    
    UI.renderPreview();
  },

  showDiscoveryPopup(tone) {
    let popup = document.getElementById("discoveryPopup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "discoveryPopup";
      popup.className = "discovery-popup";
      document.body.appendChild(popup);
    }
    
    popup.innerHTML = `새로운 색 발견!<br><strong>${tone}</strong>`;
    popup.classList.add("show");
    
    setTimeout(() => {
      popup.classList.remove("show");
    }, 2000);
  }
};
