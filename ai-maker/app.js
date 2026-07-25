/* =========================================================
   AI 캐릭터 메이커 MVP
   STEP1 스케치 → STEP2 AI 선화(+TF.js 로컬 폴백) → STEP3 채색
   → STEP4 캐릭터 시트 → STEP5 저장/제출
   ========================================================= */

const state = {
  step: 1,
  subject: '',
  style: '',
  sketchDataURL: null,
  lineArtDataURL: null,
  usedFallback: false,
  coloredDataURL: null,
  character: { author: '', name: '', personality: '', strength: '', weakness: '' },
  bubbles: []
};

let selectedColor = '#FF6B6B';
let colorHistory = [];
let sketchTool = 'pen';
let sketchDrawing = false;
let sketchLastPos = null;

const PALETTE_COLORS = ['#FF6B6B', '#FFD93D', '#4D96FF', '#4CAF7D', '#9D65C9', '#FF9F45', '#8D6E63', '#111111', '#FFFFFF'];

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
function initSketchStep() {
  const canvas = document.getElementById('sketchCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const penBtn = document.getElementById('tool-pen');
  const eraserBtn = document.getElementById('tool-eraser');

  function setTool(t) {
    sketchTool = t;
    penBtn.classList.toggle('active', t === 'pen');
    eraserBtn.classList.toggle('active', t === 'eraser');
  }
  penBtn.addEventListener('click', () => setTool('pen'));
  eraserBtn.addEventListener('click', () => setTool('eraser'));
  setTool('pen');

  function strokeTo(pos) {
    ctx.strokeStyle = sketchTool === 'eraser' ? '#ffffff' : '#141414';
    ctx.lineWidth = sketchTool === 'eraser' ? 30 : 7;
    ctx.beginPath();
    ctx.moveTo(sketchLastPos.x, sketchLastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    sketchLastPos = pos;
  }

  canvas.addEventListener('pointerdown', e => {
    sketchDrawing = true;
    canvas.setPointerCapture(e.pointerId);
    sketchLastPos = getPos(canvas, e);
    strokeTo(sketchLastPos);
  });
  canvas.addEventListener('pointermove', e => {
    if (!sketchDrawing) return;
    strokeTo(getPos(canvas, e));
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
    canvas.addEventListener(evt, () => { sketchDrawing = false; })
  );

  document.getElementById('btn-clear-sketch').addEventListener('click', () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  document.getElementById('subjectInput').addEventListener('input', updateStep1Validity);
  document.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.style = chip.dataset.style;
      updateStep1Validity();
    });
  });

  document.getElementById('btn-to-lineart').addEventListener('click', () => {
    state.sketchDataURL = canvas.toDataURL('image/png');
    goToStep(2);
    runLineArtGeneration();
  });
}

function updateStep1Validity() {
  state.subject = document.getElementById('subjectInput').value.trim();
  document.getElementById('btn-to-lineart').disabled = !(state.subject && state.style);
}

/* ===========================================================
   STEP 2: AI 선화 생성 (+ 실패 시 TF.js 로컬 폴백)
   =========================================================== */
function buildPrompt(subject, style) {
  const styleDesc = {
    '사실적': 'realistic proportions and natural anatomy',
    '캐릭터': 'cute stylized character-design proportions, like a friendly mascot',
    '이모티콘': 'very simple flat sticker/emoji style with minimal detail'
  }[style] || '';
  return [
    `Turn this child's rough sketch into a clean black-and-white line-art drawing of a ${subject}.`,
    `Style: ${style} (${styleDesc}).`,
    'Keep the overall shape, pose, and proportions of the original sketch as closely as possible.',
    'Output pure black outlines on a plain white background only. No shading, no gray, no color fill.',
    'Use bold, thick, fully closed outlines so a child can easily color inside them later.',
    'Do not add any complex background, scenery, or extra objects - only the single subject, centered.',
    'The result should look like a page from a coloring book.'
  ].join(' ');
}

async function callGeminiLineArt(base64PNG, subject, style) {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.GEMINI_API_KEY) throw new Error('NO_API_KEY');
  const model = cfg.GEMINI_MODEL || 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.GEMINI_API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: buildPrompt(subject, style) },
            { inline_data: { mime_type: 'image/png', data: base64PNG } }
          ]
        }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API_HTTP_${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  const inline = imgPart && (imgPart.inlineData || imgPart.inline_data);
  if (!inline || !inline.data) throw new Error('NO_IMAGE_IN_RESPONSE');
  return 'data:image/png;base64,' + inline.data;
}

/** 오프라인/에러 시 로컬 폴백: TensorFlow.js로 스케치 선을 굵고 또렷하게 정리해서
 *  '추천 모드' 선화로 사용한다. 수업이 끊기지 않는 것이 최우선이다. */
async function localFallbackLineArt(sketchCanvas) {
  const size = sketchCanvas.width;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = size;
  outCanvas.height = size;

  if (typeof tf === 'undefined') {
    // TF.js 자체를 못 불러온 경우 최후의 수단: 원본 스케치를 그대로 사용
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(sketchCanvas, 0, 0);
    return outCanvas;
  }

  const resultTensor = tf.tidy(() => {
    const img = tf.browser.fromPixels(sketchCanvas, 3).toFloat();
    const gray = img.mean(2, true);              // 흑백 변환
    const inkMask = gray.less(200).toFloat();     // 어두운 픽셀 = 잉크
    const expanded = tf.maxPool(
      inkMask.reshape([1, size, size, 1]), 3, 1, 'same'
    ).reshape([size, size, 1]);                   // 선 두껍게(팽창)
    const whiteBg = expanded.mul(-255).add(255);  // 잉크=검정, 배경=흰색
    return whiteBg.tile([1, 1, 3]).clipByValue(0, 255).cast('int32');
  });

  await tf.browser.toPixels(resultTensor, outCanvas);
  resultTensor.dispose();
  return outCanvas;
}

async function runLineArtGeneration() {
  const loadingEl = document.getElementById('lineartLoading');
  const resultEl = document.getElementById('lineartResult');
  const actionsEl = document.getElementById('lineartActions');
  const statusText = document.getElementById('lineartStatusText');
  const fallbackBadge = document.getElementById('fallbackBadge');

  loadingEl.style.display = '';
  resultEl.style.display = 'none';
  actionsEl.style.display = 'none';
  statusText.textContent = '잠시만 기다려주세요...';

  const sketchCanvas = document.getElementById('sketchCanvas');

  try {
    const base64 = state.sketchDataURL.split(',')[1];
    const url = await callGeminiLineArt(base64, state.subject, state.style);
    state.lineArtDataURL = url;
    state.usedFallback = false;
  } catch (err) {
    console.warn('[선화 생성] Gemini API 실패 → 로컬 추천 모드로 전환:', err);
    try {
      const outCanvas = await localFallbackLineArt(sketchCanvas);
      state.lineArtDataURL = outCanvas.toDataURL('image/png');
    } catch (err2) {
      console.error('[선화 생성] 로컬 폴백도 실패, 원본 스케치를 사용:', err2);
      state.lineArtDataURL = state.sketchDataURL;
    }
    state.usedFallback = true;
  }

  document.getElementById('lineartImage').src = state.lineArtDataURL;
  fallbackBadge.style.display = state.usedFallback ? '' : 'none';
  loadingEl.style.display = 'none';
  resultEl.style.display = '';
  actionsEl.style.display = '';
}

function initLineArtStep() {
  document.getElementById('btn-restart-from-lineart').addEventListener('click', () => {
    if (confirm('처음부터 다시 시작할까요? 지금까지 작업이 사라져요.')) location.reload();
  });
  document.getElementById('btn-to-color').addEventListener('click', () => {
    setupColorStep();
    goToStep(3);
  });
}

/* ===========================================================
   STEP 3: 채색 (Flood Fill)
   =========================================================== */
function setupPalette() {
  const wrap = document.getElementById('palette');
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
  document.getElementById('customColorInput').addEventListener('input', e => {
    selectedColor = e.target.value;
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
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

  canvas.addEventListener('pointerdown', e => {
    const pos = getPos(canvas, e);
    const x = Math.floor(pos.x), y = Math.floor(pos.y);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    colorHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (colorHistory.length > 15) colorHistory.shift();
    floodFill(ctx, x, y, hexToRgb(selectedColor), 45);
  });

  document.getElementById('btn-undo-color').addEventListener('click', () => {
    const prev = colorHistory.pop();
    if (prev) ctx.putImageData(prev, 0, 0);
  });

  document.getElementById('btn-reset-color').addEventListener('click', () => {
    if (confirm('색칠한 내용을 모두 지울까요?')) setupColorStep();
  });

  document.getElementById('btn-back-to-lineart').addEventListener('click', () => goToStep(2));

  document.getElementById('btn-save-color').addEventListener('click', () => {
    state.coloredDataURL = canvas.toDataURL('image/png');
    setupSheetStep();
    goToStep(4);
  });
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

  document.getElementById('btn-back-to-color').addEventListener('click', () => goToStep(3));

  document.getElementById('btn-to-submit').addEventListener('click', () => {
    goToStep(5);
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
  ctx.font = '400 15px Gaegu, sans-serif';
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
      document.fonts.load('400 16px Gaegu')
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
  ctx.font = '400 17px Gaegu, sans-serif';
  const lines = [
    '작가: ' + (state.character.author || '-'),
    '성격: ' + (state.character.personality || '-'),
    '강점: ' + (state.character.strength || '-'),
    '약점: ' + (state.character.weakness || '-')
  ];
  lines.forEach(l => { ctx.fillText(l, tx, ty); ty += 36; });

  return canvas;
}

function initSubmitStep() {
  document.getElementById('btn-download').addEventListener('click', () => {
    const canvas = document.getElementById('finalCanvas');
    const link = document.createElement('a');
    const filename = (state.character.name || 'character') + '_시트.png';
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  document.getElementById('btn-submit').addEventListener('click', async () => {
    const statusEl = document.getElementById('submitStatus');
    statusEl.textContent = '제출 중...';
    const canvas = document.getElementById('finalCanvas');
    const dataURL = canvas.toDataURL('image/png');

    const record = {
      id: 'sub_' + Date.now(),
      timestamp: new Date().toISOString(),
      author: state.character.author || '',
      charName: state.character.name || '',
      dataURL
    };

    try {
      const list = JSON.parse(localStorage.getItem('characterSheetSubmissions') || '[]');
      list.push(record);
      localStorage.setItem('characterSheetSubmissions', JSON.stringify(list));
    } catch (e) {
      console.warn('로컬 저장 실패', e);
    }

    const cfg = window.APP_CONFIG || {};
    if (cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_UPLOAD_PRESET) {
      try {
        const blob = await (await fetch(dataURL)).blob();
        const fd = new FormData();
        fd.append('file', blob);
        fd.append('upload_preset', cfg.CLOUDINARY_UPLOAD_PRESET);
        fd.append('context', `author=${record.author}|name=${record.charName}`);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error('cloudinary upload failed: ' + res.status);
        statusEl.textContent = '✅ 선생님께 제출 완료되었어요!';
      } catch (e) {
        console.warn(e);
        statusEl.textContent = '✅ 이 기기에는 저장됐어요. (클라우드 전송은 실패했으니 선생님께 직접 알려주세요)';
      }
    } else {
      statusEl.textContent = '✅ 이 기기에 제출 저장 완료! 선생님 Cloudinary를 연결하면 모든 기기에서 볼 수 있어요.';
    }
  });

  document.getElementById('btn-new-character').addEventListener('click', () => {
    if (confirm('새 캐릭터를 만들까요? 지금 화면은 사라져요.')) location.reload();
  });
}

/* ===========================================================
   초기화
   =========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initSketchStep();
  initLineArtStep();
  setupPalette();
  initColorStep();
  initSheetStep();
  initSubmitStep();
  goToStep(1);
});
