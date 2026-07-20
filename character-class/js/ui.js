/**
 * ui.js
 * 파츠 선택 UI, 미리보기 캔버스, 입력 폼을 그리고 이벤트를 연결합니다.
 */

const UI = {
  previewCanvas: null,
  previewCtx: null,

  init() {
    this.previewCanvas = document.getElementById("previewCanvas");
    this.previewCanvas.width = CANVAS_WIDTH;
    this.previewCanvas.height = CANVAS_HEIGHT;
    this.previewCtx = this.previewCanvas.getContext("2d");

    this.renderPartPicker("hair", "hairOptions");
    this.renderPartPicker("clothes", "clothesOptions");
    this.renderPartPicker("face", "faceOptions");

    this.bindInfoInputs();
    this.renderGauges();

    this.renderPreview();
  },

  // 투명 PNG에서 실제 그림이 그려진 영역(bounding box)을 계산
  // -> 썸네일을 잘라서 보여줄 때 사용 (여백 없이 꽉 차 보이도록)
  computeBBox(img) {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) return { x: 0, y: 0, w: width, h: height };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  },

  async renderPartPicker(category, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    for (const part of ASSET_MANIFEST[category]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "part-option";
      btn.dataset.category = category;
      btn.dataset.id = part.id;
      if (Character.selection[category] === part.id) {
        btn.classList.add("selected");
      }

      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 96;
      thumbCanvas.height = 96;
      thumbCanvas.className = "part-thumb";
      btn.appendChild(thumbCanvas);

      const label = document.createElement("span");
      label.className = "part-label";
      label.textContent = part.label;
      btn.appendChild(label);

      container.appendChild(btn);

      // 썸네일 그리기 (비동기 로드 후)
      try {
        const img = await Character.loadImage(part.src);
        const bbox = this.computeBBox(img);
        const tctx = thumbCanvas.getContext("2d");
        const pad = 8;
        const availW = thumbCanvas.width - pad * 2;
        const availH = thumbCanvas.height - pad * 2;
        const scale = Math.min(availW / bbox.w, availH / bbox.h);
        const drawW = bbox.w * scale;
        const drawH = bbox.h * scale;
        const dx = (thumbCanvas.width - drawW) / 2;
        const dy = (thumbCanvas.height - drawH) / 2;
        tctx.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, dx, dy, drawW, drawH);
      } catch (e) {
        console.error(e);
      }

      btn.addEventListener("click", () => {
        Character.setPart(category, part.id);
        container
          .querySelectorAll(".part-option")
          .forEach((el) => el.classList.remove("selected"));
        btn.classList.add("selected");
        this.renderPreview();
      });
    }
  },

  async renderPreview() {
    const ctx = this.previewCtx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    try {
      const layers = await Character.loadCurrentLayers();
      for (const img of layers) {
        ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } catch (e) {
      console.error(e);
    }
  },

  bindInfoInputs() {
    const map = {
      charName: "name",
      charPersonality: "personality",
      strength1: "strength1",
      strength2: "strength2",
      weakness1: "weakness1",
      weakness2: "weakness2"
    };
    Object.entries(map).forEach(([elId, field]) => {
      const el = document.getElementById(elId);
      el.addEventListener("input", (e) => {
        Character.setInfo(field, e.target.value);
      });
    });
  },

  // 강점/약점 입력칸 옆에 빈 게이지(□□□□□) 5칸을 그려줍니다.
  renderGauges() {
    document.querySelectorAll(".gauge").forEach((gaugeEl) => {
      gaugeEl.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        const box = document.createElement("span");
        box.className = "gauge-box";
        gaugeEl.appendChild(box);
      }
    });
  }
};
