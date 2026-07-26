/* =========================================================
   AI 캐릭터 메이커 MVP (4단계)
   STEP1 가이드 따라 그리기 → STEP2 채색(선 잇기 펜 포함)
   → STEP3 캐릭터 시트 → STEP4 제출
   ========================================================= */

const state = {
  step: 1,
  studentClass: '',
  lineArtDataURL: null,
  coloredDataURL: null,
  character: { author: '', name: '', personality: '', strength: '', weakness: '' },
  bubbles: []
};

let selectedColor = '#FF6B6B';
let colorHistory = [];

const PALETTE_COLORS = ['#FF6B6B', '#FFD93D', '#4D96FF', '#4CAF7D', '#9D65C9', '#FF9F45', '#8D6E63', '#111111', '#FFDBAC'];

/* ---------------------------------------------------------
   공통 유틸
   --------------------------------------------------------- */
function getPos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.substring(0, 2), 16), parseInt(v.substring(2, 4), 16), parseInt(v.substring(4, 6), 16)];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------------------------------------------------
   화면 전환
   --------------------------------------------------------- */
function goToStep(n) {
  state.step = n;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + n).classList.add('active');
  document.querySelectorAll('.stamp').forEach(st => {
    const sn = parseInt(st.dataset.step, 10);
    st.classList.toggle('active', sn === n);
    st.classList.toggle('done', sn < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===========================================================
   STEP 1: 스케치
   =========================================================== */
/* ===========================================================
   공용 드로잉 컨트롤러 (STEP1 스케치, STEP2 채색준비에서 재사용)
   손떨림 방지: 아주 약한 저역통과 필터 + 중점 2차 곡선.
   프레임을 모아서 지연시키는 방식이 아니라 매 pointermove마다 즉시 그리므로
   그림이 손가락/마우스를 느리게 뒤쫓는 느낌이 없다. 아주 잔손떨림만 줄여준다.
   =========================================================== */
function createDrawingController({ canvas, penBtn, eraserBtn, clearBtn, transparentBg }) {
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function clearCanvas() {
    if (transparentBg) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  let tool = 'pen';
  let drawing = false;
  const STABILIZE = 0.18; // 0에 가까울수록 원본 그대로, 값이 작아 '약하게'만 보정됨
  let smoothPos = null;
  let strokePts = [];

  function setTool(t) {
    tool = t;
    if (penBtn) penBtn.classList.toggle('active', t === 'pen');
    if (eraserBtn) eraserBtn.classList.toggle('active', t === 'eraser');
  }
  if (penBtn) penBtn.addEventListener('click', () => setTool('pen'));
  if (eraserBtn) eraserBtn.addEventListener('click', () => setTool('eraser'));
  setTool('pen');

  function nextSmoothedPos(rawPos) {
    if (!smoothPos) { smoothPos = { x: rawPos.x, y: rawPos.y }; return smoothPos; }
    smoothPos = {
      x: smoothPos.x + (rawPos.x - smoothPos.x) * (1 - STABILIZE),
      y: smoothPos.y + (rawPos.y - smoothPos.y) * (1 - STABILIZE)
    };
    return smoothPos;
  }

  function applyStrokeStyle() {
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#141414';
    ctx.lineWidth = tool === 'eraser' ? 30 : 4;
  }

  function strokeTo(rawPos) {
    const sp = { ...nextSmoothedPos(rawPos) };
    strokePts.push(sp);
    if (strokePts.length > 3) strokePts.shift();
    applyStrokeStyle();

    if (strokePts.length < 3) {
      const prev = strokePts[strokePts.length - 2] || sp;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
    } else {
      const [p0, p1, p2] = strokePts;
      const midA = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const midB = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(midA.x, midA.y);
      ctx.quadraticCurveTo(p1.x, p1.y, midB.x, midB.y);
      ctx.stroke();
    }
  }

  function handleStart(pos) {
    drawing = true;
    smoothPos = null;
    strokePts = [];
    const sp = nextSmoothedPos(pos);
    strokePts.push({ ...sp });
    applyStrokeStyle();
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }
  function handleMove(pos) {
    if (!drawing) return;
    strokeTo(pos);
  }
  function handleEnd() {
    drawing = false;
  }

  if (window.ClassroomGuard && window.ClassroomGuard.singlePointer) {
    // 손바닥 오탐 방지: 여러 손가락/손바닥이 동시에 닿아도 실제로 움직인
    // 첫 번째 포인터만 활성으로 인정한다 (classroom-input-guard.js)
    window.ClassroomGuard.singlePointer.attach(canvas, {
      onStart: handleStart,
      onMove: handleMove,
      onEnd: handleEnd
    });
  } else {
    // classroom-input-guard.js가 로드되지 않았을 때를 위한 대체 동작
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      handleStart(getPos(canvas, e));
    });
    canvas.addEventListener('pointermove', e => handleMove(getPos(canvas, e)));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
      canvas.addEventListener(evt, handleEnd)
    );
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearCanvas);
  }

  return {
    setTool,
    clear: clearCanvas
  };
}

/* ===========================================================
   STEP 1: 가이드 따라 그리기
   =========================================================== */
function loadGuideImage(url) {
  const guideCanvas = document.getElementById('guideCanvas');
  const gctx = guideCanvas.getContext('2d');
  gctx.fillStyle = '#fff';
  gctx.fillRect(0, 0, guideCanvas.width, guideCanvas.height);
  if (!url) return;

  const cfg = window.APP_CONFIG || {};
  const opacity = cfg.GUIDE_OPACITY != null ? cfg.GUIDE_OPACITY : 0.32;

  const img = new Image();
  img.onload = () => {
    // 캔버스 비율을 유지하며 가운데 정렬해서 그린다 (contain)
    const scale = Math.min(guideCanvas.width / img.width, guideCanvas.height / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    const dx = (guideCanvas.width - dw) / 2, dy = (guideCanvas.height - dh) / 2;
    gctx.globalAlpha = opacity;
    gctx.drawImage(img, dx, dy, dw, dh);
    gctx.globalAlpha = 1;
  };
  img.onerror = () => {
    console.warn('[가이드] 가이드 이미지를 불러오지 못했어요:', url, '- 가이드 없이 진행합니다.');
  };
  img.src = url;
}

function initSketchStep() {
  const canvas = document.getElementById('sketchCanvas');
  // 가이드가 비쳐 보이도록 스케치 레이어는 투명 배경으로 시작한다
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  const drawingCtl = createDrawingController({
    canvas,
    penBtn: document.getElementById('tool-pen'),
    eraserBtn: document.getElementById('tool-eraser'),
    clearBtn: document.getElementById('btn-clear-sketch'),
    transparentBg: true
  });

  /* --- 가이드 캐릭터 선택 --- */
  const guides = (window.APP_CONFIG && window.APP_CONFIG.GUIDE_IMAGES) || [];
  const pickerEl = document.getElementById('guidePicker');
  if (guides.length) {
    guides.forEach((g, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'guide-thumb' + (i === 0 ? ' selected' : '');
      btn.innerHTML = `<img src="${g.url}" alt="${g.label}"><span>${g.label}</span>`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.guide-thumb').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        loadGuideImage(g.url);
        drawingCtl.clear(); // 캐릭터를 바꾸면 이전에 그리던 선은 지운다
      });
      pickerEl.appendChild(btn);
    });
    loadGuideImage(guides[0].url);
  }

  let guideVisible = true;
  const toggleBtn = document.getElementById('btn-toggle-guide');
  const guideCanvas = document.getElementById('guideCanvas');
  toggleBtn.addEventListener('click', () => {
    guideVisible = !guideVisible;
    guideCanvas.style.visibility = guideVisible ? 'visible' : 'hidden';
    toggleBtn.textContent = guideVisible ? '👁️ 가이드 숨기기' : '🙈 가이드 보기';
  });

  document.getElementById('btn-to-color').addEventListener('click', () => {
    // 가이드는 제외하고, 학생이 그린 잉크만 흰 배경 위에 합쳐서 다음 단계로 넘긴다
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const fctx = flat.getContext('2d');
    fctx.fillStyle = '#fff';
    fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(canvas, 0, 0);
    state.lineArtDataURL = flat.toDataURL('image/png');
    setupColorStep();
    goToStep(2);
  });
}

/* ===========================================================
   STEP 2: 채색 (Flood Fill)
   =========================================================== */
function setupPalette() {
  const wrap = document.getElementById('palette');
  const customColorInput = document.getElementById('customColorInput');

  PALETTE_COLORS.forEach((c, i) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'palette-swatch' + (i === 0 ? ' selected' : '');
    sw.style.background = c;
    sw.setAttribute('aria-label', c);
    sw.addEventListener('click', () => {
      document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = c;
    });
    wrap.appendChild(sw);
  });

  // 무지개 버튼: 누르면 작은 색상 선택 창(브라우저 기본 컬러피커)이 열려서
  // 원하는 색을 직접 조합해 고를 수 있다 ("다른 색" 메뉴를 대신한다)
  const rainbowBtn = document.createElement('button');
  rainbowBtn.type = 'button';
  rainbowBtn.className = 'palette-swatch rainbow-swatch';
  rainbowBtn.setAttribute('aria-label', '무지개 - 눌러서 색 조합 창 열기');
  rainbowBtn.title = '눌러서 원하는 색을 직접 만들어보세요!';
  rainbowBtn.addEventListener('click', () => {
    customColorInput.click();
  });
  wrap.appendChild(rainbowBtn);

  customColorInput.addEventListener('input', e => {
    selectedColor = e.target.value;
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
    rainbowBtn.classList.add('selected');
  });
}

function floodFill(ctx, startX, startY, fillColor, tolerance) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const startIdx = (startY * w + startX) * 4;
  const startR = d[startIdx], startG = d[startIdx + 1], startB = d[startIdx + 2];

  // 선(잉크) 위를 직접 눌렀으면 채우지 않는다
  if (startR < 60 && startG < 60 && startB < 60) return;

  // 이미 같은 색이면 스킵
  if (Math.abs(startR - fillColor[0]) < 4 && Math.abs(startG - fillColor[1]) < 4 && Math.abs(startB - fillColor[2]) < 4) return;

  const visited = new Uint8Array(w * h);
  const stack = [startX, startY];

  function matches(i) {
    return Math.abs(d[i] - startR) <= tolerance &&
      Math.abs(d[i + 1] - startG) <= tolerance &&
      Math.abs(d[i + 2] - startB) <= tolerance;
  }

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const pos = y * w + x;
    if (visited[pos]) continue;
    const i = pos * 4;
    if (!matches(i)) continue;
    visited[pos] = 1;
    d[i] = fillColor[0]; d[i + 1] = fillColor[1]; d[i + 2] = fillColor[2]; d[i + 3] = 255;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  ctx.putImageData(imgData, 0, 0);
}

function setupColorStep() {
  const canvas = document.getElementById('colorCanvas');
  const ctx = canvas.getContext('2d');
  colorHistory = [];
  loadImage(state.lineArtDataURL).then(img => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  });
}

function initColorStep() {
  const canvas = document.getElementById('colorCanvas');
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  /* --- 채우기 / 선 잇기 모드 --- */
  let mode = 'fill';
  const fillBtn = document.getElementById('mode-fill');
  const penBtn = document.getElementById('mode-pen');
  function setMode(m) {
    mode = m;
    fillBtn.classList.toggle('active', m === 'fill');
    penBtn.classList.toggle('active', m === 'pen');
    canvas.style.cursor = m === 'pen' ? 'crosshair' : 'pointer';
  }
  fillBtn.addEventListener('click', () => setMode('fill'));
  penBtn.addEventListener('click', () => setMode('pen'));
  setMode('fill');

  /* --- 선 잇기 모드용 손떨림 방지 + 중점 2차 곡선 (STEP1과 동일한 원리) --- */
  const STABILIZE = 0.18;
  let smoothPos = null;
  let strokePts = [];

  function nextSmoothedPos(rawPos) {
    if (!smoothPos) { smoothPos = { x: rawPos.x, y: rawPos.y }; return smoothPos; }
    smoothPos = {
      x: smoothPos.x + (rawPos.x - smoothPos.x) * (1 - STABILIZE),
      y: smoothPos.y + (rawPos.y - smoothPos.y) * (1 - STABILIZE)
    };
    return smoothPos;
  }

  function penStrokeTo(rawPos) {
    const sp = { ...nextSmoothedPos(rawPos) };
    strokePts.push(sp);
    if (strokePts.length > 3) strokePts.shift();
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 4;

    if (strokePts.length < 3) {
      const prev = strokePts[strokePts.length - 2] || sp;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
    } else {
      const [p0, p1, p2] = strokePts;
      const midA = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const midB = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(midA.x, midA.y);
      ctx.quadraticCurveTo(p1.x, p1.y, midB.x, midB.y);
      ctx.stroke();
    }
  }

  function handleColorStart(pos) {
    colorHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (colorHistory.length > 15) colorHistory.shift();

    if (mode === 'fill') {
      const x = Math.floor(pos.x), y = Math.floor(pos.y);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
      floodFill(ctx, x, y, hexToRgb(selectedColor), 45);
    } else {
      smoothPos = null;
      strokePts = [];
      const sp = nextSmoothedPos(pos);
      strokePts.push({ ...sp });
      ctx.strokeStyle = '#141414';
      ctx.fillStyle = '#141414';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function handleColorMove(pos) {
    if (mode !== 'pen') return;
    penStrokeTo(pos);
  }
  function handleColorEnd() { /* 별도 정리 불필요 - 트래커가 상태를 관리한다 */ }

  if (window.ClassroomGuard && window.ClassroomGuard.singlePointer) {
    // 손바닥 오탐 방지: 여러 손가락/손바닥이 동시에 닿아도 실제로 움직인
    // 첫 번째 포인터만 활성으로 인정한다 (classroom-input-guard.js)
    window.ClassroomGuard.singlePointer.attach(canvas, {
      onStart: handleColorStart,
      onMove: handleColorMove,
      onEnd: handleColorEnd
    });
  } else {
    // classroom-input-guard.js가 로드되지 않았을 때를 위한 대체 동작
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      handleColorStart(getPos(canvas, e));
    });
    canvas.addEventListener('pointermove', e => handleColorMove(getPos(canvas, e)));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
      canvas.addEventListener(evt, handleColorEnd)
    );
  }

  document.getElementById('btn-undo-color').addEventListener('click', () => {
    const prev = colorHistory.pop();
    if (prev) ctx.putImageData(prev, 0, 0);
  });

  document.getElementById('btn-reset-color').addEventListener('click', () => {
    if (confirm('색칠한 내용을 모두 지울까요?')) setupColorStep();
  });

  document.getElementById('btn-back-to-sketch').addEventListener('click', () => goToStep(1));

  document.getElementById('btn-restart-all').addEventListener('click', () => {
    if (confirm('처음부터 다시 시작할까요? 지금까지 작업이 사라져요.')) location.reload();
  });

  document.getElementById('btn-save-color').addEventListener('click', () => {
    state.coloredDataURL = canvas.toDataURL('image/png');
    saveLocalDraft();
    setupSheetStep();
    goToStep(3);
  });
}

/** STEP2에서 "저장하고 다음"을 누르면 채색까지 끝난 상태를 브라우저에
 *  임시 저장해둔다. 중간에 브라우저가 닫히거나 새로고침돼도 복구할 수 있게 하기 위함. */
function saveLocalDraft() {
  try {
    const draft = {
      timestamp: new Date().toISOString(),
      lineArtDataURL: state.lineArtDataURL,
      coloredDataURL: state.coloredDataURL
    };
    localStorage.setItem('characterMakerDraft', JSON.stringify(draft));
  } catch (e) {
    console.warn('로컬 임시 저장 실패:', e);
  }
}

/* ===========================================================
   STEP 4: 캐릭터 시트
   =========================================================== */
let sheetInitialized = false;

function setupSheetStep() {
  const canvas = document.getElementById('sheetCanvas');
  const ctx = canvas.getContext('2d');
  loadImage(state.coloredDataURL).then(img => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  });
}

function addBubble(xPct, yPct, text) {
  const id = 'bubble_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const layer = document.getElementById('bubbleLayer');
  const el = document.createElement('div');
  el.className = 'speech-bubble';
  el.style.left = (xPct * 100) + '%';
  el.style.top = (yPct * 100) + '%';
  el.innerHTML = `
    <span class="bubble-handle" style="cursor:grab;font-size:13px;user-select:none;">⠿</span>
    <div class="bubble-text" contenteditable="true" style="display:inline;">${text}</div>
    <div class="bubble-remove" role="button" aria-label="말풍선 삭제">✕</div>
  `;
  layer.appendChild(el);

  const record = { id, xPct, yPct, text };
  state.bubbles.push(record);

  el.querySelector('.bubble-remove').addEventListener('click', () => {
    el.remove();
    state.bubbles = state.bubbles.filter(b => b.id !== id);
  });
  el.querySelector('.bubble-text').addEventListener('input', e => {
    record.text = e.target.innerText;
  });

  const handle = el.querySelector('.bubble-handle');
  let dragging = false, offsetX = 0, offsetY = 0;
  handle.addEventListener('pointerdown', e => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    const elRect = el.getBoundingClientRect();
    offsetX = e.clientX - elRect.left;
    offsetY = e.clientY - elRect.top;
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const layerRect = layer.getBoundingClientRect();
    let nx = (e.clientX - layerRect.left - offsetX) / layerRect.width;
    let ny = (e.clientY - layerRect.top - offsetY) / layerRect.height;
    nx = Math.max(0, Math.min(0.8, nx));
    ny = Math.max(0, Math.min(0.85, ny));
    el.style.left = (nx * 100) + '%';
    el.style.top = (ny * 100) + '%';
    record.xPct = nx;
    record.yPct = ny;
  });
  ['pointerup', 'pointercancel'].forEach(evt => handle.addEventListener(evt, () => { dragging = false; }));
}

function setupChipRow(target) {
  const row = document.querySelector(`.chip-row[data-target="${target}"]`);
  const customInput = document.getElementById(target + 'Custom');
  row.querySelectorAll('.pick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      row.querySelectorAll('.pick-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      if (chip.dataset.value === '__custom__') {
        customInput.style.display = '';
        customInput.focus();
        state.character[target] = customInput.value.trim();
      } else {
        customInput.style.display = 'none';
        state.character[target] = chip.dataset.value;
      }
    });
  });
  customInput.addEventListener('input', () => { state.character[target] = customInput.value.trim(); });
}

function initSheetStep() {
  document.getElementById('authorInput').addEventListener('input', e => { state.character.author = e.target.value.trim(); });
  document.getElementById('charNameInput').addEventListener('input', e => { state.character.name = e.target.value.trim(); });

  ['personality', 'strength', 'weakness'].forEach(setupChipRow);

  document.getElementById('btn-add-bubble').addEventListener('click', () => {
    addBubble(0.12 + Math.random() * 0.35, 0.08 + Math.random() * 0.2, '대사를 입력하세요');
  });

  document.getElementById('btn-back-to-color').addEventListener('click', () => goToStep(2));

  document.getElementById('btn-to-submit').addEventListener('click', () => {
    goToStep(4);
    composeFinalCanvas();
  });
}

/* ===========================================================
   STEP 5: 최종 캐릭터 시트 합성 / 저장 / 제출
   =========================================================== */
function wrapTextByWidth(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of (text || '')) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCanvasBubble(ctx, x, y, text) {
  ctx.font = '400 15px Gowun Dodum, sans-serif';
  const maxTextWidth = 130;
  const lines = wrapTextByWidth(ctx, text || ' ', maxTextWidth);
  const lineHeight = 19;
  const boxW = maxTextWidth + 20;
  const boxH = lines.length * lineHeight + 16;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3E3226';
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, boxW, boxH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 18, y + boxH - 1);
  ctx.lineTo(x + 10, y + boxH + 13);
  ctx.lineTo(x + 32, y + boxH - 1);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#222222';
  lines.forEach((l, i) => ctx.fillText(l, x + 10, y + 22 + i * lineHeight));
}

async function composeFinalCanvas() {
  try {
    await Promise.all([
      document.fonts.load('700 30px Jua'),
      document.fonts.load('400 16px Gowun Dodum')
    ]);
  } catch (e) { /* 폰트 로드 실패해도 진행 */ }

  const canvas = document.getElementById('finalCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = '#FBF3E7';
  ctx.fillRect(0, 0, W, H);

  const imgSize = 560, imgX = 20, imgY = 20;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3E3226';
  ctx.lineWidth = 4;
  roundRect(ctx, imgX - 4, imgY - 4, imgSize + 8, imgSize + 8, 20);
  ctx.fill();
  ctx.stroke();

  const charImg = await loadImage(state.coloredDataURL);
  ctx.drawImage(charImg, imgX, imgY, imgSize, imgSize);

  state.bubbles.forEach(b => {
    const bx = imgX + b.xPct * imgSize;
    const by = imgY + b.yPct * imgSize;
    drawCanvasBubble(ctx, bx, by, b.text);
  });

  let tx = imgX + imgSize + 30;
  let ty = 56;
  ctx.fillStyle = '#3E3226';
  ctx.font = '700 30px Jua, sans-serif';
  ctx.fillText(state.character.name || '이름 없는 캐릭터', tx, ty);

  ty += 44;
  ctx.font = '400 17px Gowun Dodum, sans-serif';
  const lines = [
    '작가: ' + (state.character.author || '-'),
    '성격: ' + (state.character.personality || '-'),
    '강점: ' + (state.character.strength || '-'),
    '약점: ' + (state.character.weakness || '-')
  ];
  lines.forEach(l => { ctx.fillText(l, tx, ty); ty += 36; });

  return canvas;
}

/** Cloudinary public_id에 안전하지 않은 문자(경로 구분자 등)를 제거하고
 *  공백은 밑줄로 바꿔서 파일명으로 쓸 수 있게 정리한다 */
function sanitizeForFilename(str) {
  return (str || '')
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_');
}

function initSubmitStep() {
  document.getElementById('btn-submit').addEventListener('click', async () => {
    const statusEl = document.getElementById('submitStatus');
    statusEl.textContent = '제출 중...';
    const canvas = document.getElementById('finalCanvas');
    const dataURL = canvas.toDataURL('image/png');

    const record = {
      author: state.character.author || '',
      charName: state.character.name || '',
      studentClass: state.studentClass || ''
    };

    const cfg = window.APP_CONFIG || {};
    if (cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_UPLOAD_PRESET) {
      try {
        const namePart = sanitizeForFilename(record.author) || 'student';
        const classPart = sanitizeForFilename(record.studentClass) || 'noclass';
        const charPart = sanitizeForFilename(record.charName) || 'character';
        const publicId = `${namePart}_${classPart}_${charPart}_${Date.now()}`;

        const blob = await (await fetch(dataURL)).blob();
        const fd = new FormData();
        fd.append('file', blob);
        fd.append('upload_preset', cfg.CLOUDINARY_UPLOAD_PRESET);
        // 루트의 ch-maker 폴더 아래, "이름_반_캐릭터이름_시간" 형식 파일명으로 저장한다.
        // (unsigned upload preset에서 "Use filename or externally defined Public ID"와
        //  폴더 지정을 허용하도록 설정되어 있어야 folder/public_id가 실제로 적용됩니다.)
        fd.append('folder', 'ch-maker');
        fd.append('public_id', publicId);
        fd.append('context', `author=${record.author}|name=${record.charName}|class=${record.studentClass}`);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error('cloudinary upload failed: ' + res.status);
        statusEl.textContent = '✅ 선생님께 제출 완료되었어요!';
      } catch (e) {
        console.warn(e);
        statusEl.textContent = '❌ 제출에 실패했어요. 선생님께 알려주시고 다시 시도해주세요.';
      }
    } else {
      statusEl.textContent = '⚠️ 제출 기능이 아직 연결되지 않았어요. 선생님께 알려주세요.';
    }
  });

  document.getElementById('btn-new-character').addEventListener('click', () => {
    if (confirm('새 캐릭터를 만들까요? 지금 화면은 사라져요.')) resetForNewCharacter();
  });
}

/** "새 캐릭터 만들기": 이름/반 선택 화면(새로고침)으로 돌아가지 않고,
 *  같은 학생이 바로 STEP 1(가이드 따라 그리기)부터 다시 시작하도록 한다.
 *  이름/반/전체화면 상태는 그대로 유지하고, 그림 관련 데이터만 초기화한다. */
function resetForNewCharacter() {
  state.lineArtDataURL = null;
  state.coloredDataURL = null;
  state.character.name = '';
  state.character.personality = '';
  state.character.strength = '';
  state.character.weakness = '';
  state.bubbles = [];
  colorHistory = [];

  // STEP 1 스케치 레이어 비우기 (가이드는 그대로 둔다)
  const sketchCanvas = document.getElementById('sketchCanvas');
  sketchCanvas.getContext('2d').clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  document.getElementById('guideCanvas').style.visibility = 'visible';
  const toggleGuideBtn = document.getElementById('btn-toggle-guide');
  if (toggleGuideBtn) toggleGuideBtn.textContent = '👁️ 가이드 숨기기';

  // STEP 3 입력값 초기화
  const charNameInput = document.getElementById('charNameInput');
  if (charNameInput) charNameInput.value = '';
  document.querySelectorAll('.chip-row').forEach(row => {
    row.querySelectorAll('.pick-chip').forEach(c => c.classList.remove('selected'));
  });
  document.querySelectorAll('.custom-input').forEach(input => {
    input.value = '';
    input.style.display = 'none';
  });
  document.getElementById('bubbleLayer').innerHTML = '';

  const submitStatus = document.getElementById('submitStatus');
  if (submitStatus) submitStatus.textContent = '';

  try { localStorage.removeItem('characterMakerDraft'); } catch (e) { /* 무시 */ }

  goToStep(1);
}

/* ===========================================================
   토스트 알림 (Stickman Class와 동일한 패턴)
   =========================================================== */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 1200);
}

/* ===========================================================
   시작 화면: 이름/반 선택 → 수업 시작하기
   전체화면(키오스크) 모드는 여기, "수업 시작하기" 버튼 클릭 안에서만
   요청한다 (Fullscreen API는 실제 사용자 제스처 안에서 호출해야
   가장 안정적으로 동작하기 때문 - 임의의 첫 터치보다 훨씬 신뢰도가 높다).
   =========================================================== */
function initStartScreen() {
  document.getElementById('btn-start-class').addEventListener('click', () => {
    const nameInput = document.getElementById('studentNameInput');
    const classSelect = document.getElementById('studentClassSelect');
    const name = nameInput.value.trim();
    const cls = classSelect.value;

    if (!name) {
      showToast('이름을 입력해주세요');
      nameInput.focus();
      return;
    }
    if (!cls) {
      showToast('반을 선택해주세요');
      classSelect.focus();
      return;
    }

    state.character.author = name;
    state.studentClass = cls;
    // STEP 3 캐릭터 시트의 "작가 이름" 칸을 미리 채워둔다
    const authorField = document.getElementById('authorInput');
    if (authorField) authorField.value = name;

    if (window.ClassroomGuard && window.ClassroomGuard.fullscreen) {
      window.ClassroomGuard.fullscreen.request().catch(() => {
        /* 사용자가 거부했거나 미지원 브라우저 - 조용히 무시, 앱은 계속 정상 동작 */
      });
    }

    document.getElementById('topbar').style.display = '';
    document.getElementById('screen-start').classList.remove('active');
    goToStep(1);
  });
}

/* ===========================================================
   초기화
   =========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  if (window.ClassroomGuard && window.ClassroomGuard.fullscreen) {
    // 나가기 제스처(ESC / 왼쪽 위 구석 3번 톡톡)는 처음부터 활성화해둔다.
    // 전체화면 "진입"은 여기서 자동으로 하지 않고, initStartScreen()의
    // "수업 시작하기" 버튼 클릭 안에서만 request()로 호출한다.
    window.ClassroomGuard.fullscreen.enable({ autoRequestOnFirstGesture: false });
  }

  initStartScreen();
  initSketchStep();
  setupPalette();
  initColorStep();
  initSheetStep();
  initSubmitStep();
});
