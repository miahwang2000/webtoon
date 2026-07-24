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
    this.setupOptionsNav();

    this.bindNameInput();
    this.setupChoiceFields();
    this.renderGauges();

    this.renderPreview();
  },

  // 파츠 선택 줄이 한 줄로 유지되는 대신, 좌우 화살표로 스크롤 이동
  setupOptionsNav() {
    document.querySelectorAll(".nav-arrow").forEach((btn) => {
      const target = document.getElementById(btn.dataset.target);
      const dir = btn.classList.contains("nav-left") ? -1 : 1;
      btn.addEventListener("click", () => {
        target.scrollBy({ left: dir * 180, behavior: "smooth" });
      });
    });
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
      btn.title = part.label; // 라벨은 텍스트로 안 보여주는 대신 툴팁/스크린리더용으로 유지
      btn.setAttribute("aria-label", part.label);
      if (Character.selection[category] === part.id) {
        btn.classList.add("selected");
      }

      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 160;
      thumbCanvas.height = 160;
      thumbCanvas.className = "part-thumb";
      btn.appendChild(thumbCanvas);

      const check = document.createElement("span");
      check.className = "selected-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      btn.appendChild(check);

      container.appendChild(btn);

      // 썸네일 그리기 (비동기 로드 후)
      try {
        const img = await Character.loadImage(part.src);
        const bbox = this.computeBBox(img);
        const tctx = thumbCanvas.getContext("2d");
        const pad = 12;
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
      
      // 색칠 레이어를 위에 합성
      if (Character.paintData.canvas) {
        ctx.drawImage(Character.paintData.canvas, 0, 0);
      }
    } catch (e) {
      console.error(e);
    }
  },

  bindNameInput() {
    const el = document.getElementById("charName");
    el.addEventListener("input", (e) => {
      Character.setInfo("name", e.target.value);
    });
  },

  // 성격/강점/약점: 프리셋 선택 또는 직접입력 가능한 필드 구성
  setupChoiceFields() {
    document.querySelectorAll(".choice-field").forEach((wrapper) => {
      const field = wrapper.dataset.field;
      const select = wrapper.querySelector(".choice-select");
      const custom = wrapper.querySelector(".choice-custom");
      const presets = PRESET_OPTIONS[field] || [];

      select.innerHTML = "";
      presets.forEach((label) => {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        select.appendChild(opt);
      });
      const customOpt = document.createElement("option");
      customOpt.value = CUSTOM_VALUE;
      customOpt.textContent = "직접입력";
      select.appendChild(customOpt);

      // 초기값을 Character.info에 동기화 (기본 선택 = 첫 번째 프리셋)
      Character.setInfo(field, select.value);

      select.addEventListener("change", () => {
        if (select.value === CUSTOM_VALUE) {
          custom.hidden = false;
          custom.focus();
          Character.setInfo(field, custom.value);
        } else {
          custom.hidden = true;
          Character.setInfo(field, select.value);
        }
      });

      custom.addEventListener("input", () => {
        Character.setInfo(field, custom.value);
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
