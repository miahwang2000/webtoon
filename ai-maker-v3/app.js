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
let sketchPanCtl = null;
let colorPanCtl = null;
let finalCanvasReady = null; // composeFinalCanvas()의 Promise. 제출 전 이 작업이 끝났는지 기다리는 데 쓴다.
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

/* ---------------------------------------------------------
   커스텀 확인창 - window.confirm() 대체
   브라우저 기본 confirm()/alert()은 호출되는 순간 전체화면을
   강제로 해제시키는 브라우저가 많다. 전체화면을 유지하기 위해
   같은 페이지 안의 오버레이로 직접 확인창을 구현한다.
   --------------------------------------------------------- */
function showConfirmModal(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirmModalOverlay');
    const msgEl = document.getElementById('confirmModalMessage');
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');

    msgEl.textContent = message;
    overlay.classList.add('show');

    function cleanup(result) {
      overlay.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

/* ---------------------------------------------------------
   줌 기능 (STEP1, STEP2 공용)
   뷰포트(overflow:auto, 정사각형 고정 크기) 안에서 실제 그림 영역의
   CSS 너비를 %로 늘려 확대하고, 뷰포트가 스크롤 가능해지도록 한다.
   --------------------------------------------------------- */
function setupZoom(zoomTargetEl, { zoomInBtn, zoomOutBtn, zoomResetBtn, min = 100, max = 220, step = 20 }) {
  let zoom = 100;
  function apply() {
    zoomTargetEl.style.width = zoom + '%';
  }
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
    zoom = Math.min(max, zoom + step);
    apply();
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    zoom = Math.max(min, zoom - step);
    apply();
  });
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => {
    zoom = 100;
    apply();
  });
  return {
    reset() { zoom = 100; apply(); }
  };
}

/* ---------------------------------------------------------
   더블탭(빠르게 두 번 터치/클릭) 감지 공용 헬퍼.
   펜 아이콘을 두 번 빠르게 누르면 줌을 원래 크기로 되돌리는 데 쓴다.
   'click' 이벤트 기준으로 판단하므로 마우스/터치 모두에서 동일하게 동작한다.
   --------------------------------------------------------- */
function addDoubleTapAction(el, onDoubleTap, windowMs = 400) {
  let lastTap = 0;
  el.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTap < windowMs) {
      lastTap = 0;
      onDoubleTap();
    } else {
      lastTap = now;
    }
  });
}

/* ---------------------------------------------------------
   팬(이동) 기능: 확대(줌)된 상태에서 손바닥 아이콘 버튼을 눌러
   이동 모드로 바꾸면, 캔버스를 드래그해서 화면을 밀어 볼 수 있다.
   캔버스에는 touch-action:none이 걸려있어 네이티브 터치 스크롤이
   안 먹기 때문에, 뷰포트의 scrollLeft/scrollTop을 직접 옮겨서 구현한다.
   --------------------------------------------------------- */
function setupPan(viewportEl, panBtn, { onToggle } = {}) {
  let panMode = false;
  let dragging = false;
  let lastX = 0, lastY = 0;

  function setPanMode(on) {
    panMode = on;
    panBtn.classList.toggle('active', on);
    viewportEl.classList.toggle('pan-mode', on);
    if (typeof onToggle === 'function') onToggle(on);
  }
  panBtn.addEventListener('click', () => setPanMode(!panMode));

  viewportEl.addEventListener('pointerdown', e => {
    if (!panMode) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    viewportEl.classList.add('panning');
    if (viewportEl.setPointerCapture) {
      try { viewportEl.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    }
  });
  viewportEl.addEventListener('pointermove', e => {
    if (!panMode || !dragging) return;
    viewportEl.scrollLeft -= (e.clientX - lastX);
    viewportEl.scrollTop -= (e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
    viewportEl.addEventListener(evt, () => {
      dragging = false;
      viewportEl.classList.remove('panning');
    });
  });

  return {
    isPanMode: () => panMode,
    reset() { setPanMode(false); }
  };
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
function createDrawingController({ canvas, penBtn, eraserBtn, clearBtn, undoBtn, transparentBg, isPanActive }) {
  const panActive = typeof isPanActive === 'function' ? isPanActive : () => false;
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
  // 손떨림 보정은 화면(클라이언트) 좌표계에서 계산한다. 캔버스 내부 좌표계에서
  // 계산하면 확대(줌) 상태일 때 같은 마우스 이동량이라도 내부 좌표 변화량이
  // 작아져서(캔버스가 화면에 더 크게 그려지므로) 보정이 과하게 걸려 커서와
  // 실제로 그려지는 위치가 어긋나 보이는 문제가 있었다.
  let smoothClientPos = null;
  let strokePts = [];
  let history = [];

  function setTool(t) {
    tool = t;
    if (penBtn) penBtn.classList.toggle('active', t === 'pen');
    if (eraserBtn) eraserBtn.classList.toggle('active', t === 'eraser');
  }
  if (penBtn) penBtn.addEventListener('click', () => setTool('pen'));
  if (eraserBtn) eraserBtn.addEventListener('click', () => setTool('eraser'));
  setTool('pen');

  function nextSmoothedClientPos(rawClient) {
    if (!smoothClientPos) { smoothClientPos = { x: rawClient.x, y: rawClient.y }; return smoothClientPos; }
    smoothClientPos = {
      x: smoothClientPos.x + (rawClient.x - smoothClientPos.x) * (1 - STABILIZE),
      y: smoothClientPos.y + (rawClient.y - smoothClientPos.y) * (1 - STABILIZE)
    };
    return smoothClientPos;
  }

  // 화면(클라이언트) 좌표를 그 순간의 캔버스 확대/스크롤 상태를 반영해
  // 캔버스 내부 좌표로 바꾼다 (getPos와 동일한 계산이지만 clientX/Y를 직접 받는다)
  function clientToCanvasPos(clientPos) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientPos.x - rect.left) * scaleX,
      y: (clientPos.y - rect.top) * scaleY
    };
  }

  function applyStrokeStyle() {
    if (transparentBg && tool === 'eraser') {
      // 투명 배경(가이드 위에 겹쳐진 스케치 레이어)에서는 흰색을 칠하면
      // 오히려 아래 가이드를 하얗게 덮어버린다. destination-out으로 실제
      // 픽셀을 지워서(다시 투명하게) 가이드가 그대로 비쳐 보이게 한다.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#141414';
    }
    ctx.lineWidth = tool === 'eraser' ? 30 : 4;
  }

  function pushHistory() {
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.length > 15) history.shift();
  }

  function undo() {
    const prev = history.pop();
    if (prev) ctx.putImageData(prev, 0, 0);
  }
  if (undoBtn) undoBtn.addEventListener('click', undo);

  function strokeTo(clientPos) {
    const sp = clientToCanvasPos(nextSmoothedClientPos(clientPos));
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

  function handleStart(pos, evt) {
    if (panActive()) return;
    drawing = true;
    pushHistory();
    smoothClientPos = null;
    strokePts = [];
    const clientPos = evt ? { x: evt.clientX, y: evt.clientY } : pos;
    const sp = clientToCanvasPos(nextSmoothedClientPos(clientPos));
    strokePts.push(sp);
    applyStrokeStyle();
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    if (ctx.globalCompositeOperation === 'destination-out') {
      ctx.fill();
    } else {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  }
  function handleMove(pos, evt) {
    if (!drawing || panActive()) return;
    strokeTo(evt ? { x: evt.clientX, y: evt.clientY } : pos);
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
      handleStart(getPos(canvas, e), e);
    });
    canvas.addEventListener('pointermove', e => handleMove(getPos(canvas, e), e));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
      canvas.addEventListener(evt, handleEnd)
    );
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      pushHistory();
      clearCanvas();
    });
  }

  return {
    setTool,
    clear: clearCanvas,
    undo,
    clearHistory() { history = []; }
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

  const container = document.getElementById('viewport-sketch');

  const panCtl = setupPan(container, document.getElementById('btn-pan-sketch'), {});
  sketchPanCtl = panCtl;

  const drawingCtl = createDrawingController({
    canvas,
    penBtn: document.getElementById('tool-pen'),
    eraserBtn: document.getElementById('tool-eraser'),
    clearBtn: document.getElementById('btn-clear-sketch'),
    undoBtn: document.getElementById('btn-undo-sketch'),
    transparentBg: true,
    isPanActive: panCtl.isPanMode
  });

  const zoomCtl = setupZoom(document.getElementById('zoomTarget-sketch'), {
    zoomInBtn: document.getElementById('zoom-in-sketch'),
    zoomOutBtn: document.getElementById('zoom-out-sketch')
  });

  // 펜 아이콘을 두 번 빠르게 누르면 줌을 원래 크기(100%)로 되돌린다
  addDoubleTapAction(document.getElementById('tool-pen'), () => zoomCtl.reset());

  /* --- 가이드 캐릭터 선택 (이미지만 표시, 글자 라벨 없음) --- */
  const guides = (window.APP_CONFIG && window.APP_CONFIG.GUIDE_IMAGES) || [];
  const pickerEl = document.getElementById('guidePicker');
  if (guides.length) {
    guides.forEach((g, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'guide-thumb' + (i === 0 ? ' selected' : '');
      btn.setAttribute('aria-label', g.label);
      btn.title = g.label;
      btn.innerHTML = `<img src="${g.url}" alt="${g.label}">`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.guide-thumb').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        loadGuideImage(g.url);
        drawingCtl.clear(); // 캐릭터를 바꾸면 이전에 그리던 선은 지운다
        drawingCtl.clearHistory();
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
    toggleBtn.textContent = guideVisible ? '👁️' : '🙈';
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
  const swatchEls = [];
  let currentFillEl = null;

  function selectSwatch(el) {
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
    if (el) el.classList.add('selected');
  }

  PALETTE_COLORS.forEach((c, i) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'palette-swatch';
    sw.style.background = c;
    sw.dataset.color = c;
    sw.setAttribute('aria-label', c);
    sw.addEventListener('click', () => {
      selectedColor = c;
      currentFillEl = sw;
      selectSwatch(sw);
    });
    wrap.appendChild(sw);
    swatchEls.push(sw);
    if (i === 0) currentFillEl = sw;
  });
  selectSwatch(currentFillEl);

  // 무지개 버튼: 누르면 작은 색상 선택 창(브라우저 기본 컬러피커)이 열려서
  // 원하는 색을 직접 조합해 고를 수 있다 ("다른 색" 메뉴를 대신한다)
  const rainbowBtn = document.createElement('button');
  rainbowBtn.type = 'button';
  rainbowBtn.className = 'palette-swatch rainbow-swatch';
  rainbowBtn.setAttribute('aria-label', '무지개 - 눌러서 색 조합 창 열기');
  rainbowBtn.title = '눌러서 원하는 색을 직접 만들어보세요!';
  rainbowBtn.addEventListener('click', () => {
    // PC에서 색상 선택 창이 무지개 버튼 바로 위에 뜨도록, 숨겨진 color input을
    // 버튼과 같은 자리로 옮겨둔 다음 클릭한다.
    const btnRect = rainbowBtn.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    customColorInput.style.left = (btnRect.left - wrapRect.left) + 'px';
    customColorInput.style.top = (btnRect.top - wrapRect.top - 50) + 'px';
    customColorInput.click();
  });
  wrap.appendChild(rainbowBtn);

  customColorInput.addEventListener('input', e => {
    selectedColor = e.target.value;
    currentFillEl = rainbowBtn;
    selectSwatch(rainbowBtn);
  });

  const blackSwatchEl = swatchEls.find(s => s.dataset.color.toLowerCase() === '#111111');

  return {
    // STEP2 "펜"(선 잇기) 모드는 항상 검정으로 그리므로, 팔레트에서도
    // 검정이 선택된 것처럼 보이게 한다. 채우기 모드로 돌아가면 원래
    // 선택했던 색(또는 무지개로 고른 색)으로 되돌린다.
    highlightBlackForPen() { selectSwatch(blackSwatchEl); },
    restoreFillHighlight() { selectSwatch(currentFillEl); }
  };
}

/* ---------------------------------------------------------
   채우기용 "가상 벽" 마스크
   선이 아주 조금(몇 픽셀) 끊어져 있어도 닫혀있는 것처럼 채우기가
   새어나가지 않게 만든다.

   1번째 시도: 잉크 마스크에 모폴로지 닫힘(팽창 후 침식)을 걸었는데,
   눈동자처럼 원래 폭이 좁은 작은 영역까지 통째로 "벽"으로 먹혀버리는
   부작용이 있었다.

   2번째 시도: "바깥에서 도달 가능한 영역"을 원본/부풀린 잉크 기준으로
   비교하는 방식을 썼는데, 틈이 있으면 그 틈으로 이어지는 "내부 전체"가
   전부 벽으로 잡혀버려서, 그 안을 클릭하면 시작 지점 딱 한 칸만
   칠해지고 더 못 퍼져나가 "작은 점"처럼 보이는 문제가 있었다.

   3번째 시도: 서로 다른 선 성분 2개를 잇는 픽셀만 다리로 인정하는
   방식을 썼는데, 사각형처럼 하나로 이어진 선 하나에 틈이 하나만 있는
   (가장 흔한) 경우엔 틈의 양쪽이 결국 같은 선 성분이라 다리로 인식되지
   않아 여전히 새는 문제가 있었다.

   지금 방식: "원본 기준 바깥에서 도달 가능한 영역"과 "잉크를 살짝
   부풀렸을 때 바깥에서 도달 가능한 영역"을 비교해 새는 부분(leak)을
   찾되, 그 중에서도 "원본 잉크 바로 근처(반경 R 이내)"에 해당하는
   부분만 벽으로 삼는다. 이렇게 하면:
   - 진짜 틈 주변(잉크에서 가까운 곳)만 막혀서 새는 것을 막고
   - 도형 안쪽 깊숙한 곳(잉크에서 먼 곳)은 leak 여부와 상관없이 항상
     그대로 열려있어서, 틈이 있어도 안쪽 대부분은 정상적으로 채워진다
   --------------------------------------------------------- */
function dilateMaskSeparable(mask, w, h, r) {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      const lo = Math.max(0, x - r), hi = Math.min(w - 1, x + r);
      for (let xx = lo; xx <= hi; xx++) { if (mask[y * w + xx]) { v = 1; break; } }
      tmp[y * w + x] = v;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      const lo = Math.max(0, y - r), hi = Math.min(h - 1, y + r);
      for (let yy = lo; yy <= hi; yy++) { if (tmp[yy * w + x]) { v = 1; break; } }
      out[y * w + x] = v;
    }
  }
  return out;
}

function floodOutsideMask(inkMask, w, h) {
  const outside = new Uint8Array(w * h);
  const stack = [];
  function tryPush(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (outside[idx] || inkMask[idx]) return;
    outside[idx] = 1;
    stack.push(x, y);
  }
  for (let x = 0; x < w; x++) { tryPush(x, 0); tryPush(x, h - 1); }
  for (let y = 0; y < h; y++) { tryPush(0, y); tryPush(w - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    tryPush(x + 1, y); tryPush(x - 1, y); tryPush(x, y + 1); tryPush(x, y - 1);
  }
  return outside;
}

// 채우기가 뚫고 지나가면 안 되는 틈의 최대 크기(px). 키우면 더 큰 틈도
// 이어붙이지만, 너무 크게 잡으면 원래 떨어져 있어야 할 선끼리도 이어질 수 있다.
const FILL_GAP_BRIDGE_RADIUS = 2;

/** 캔버스의 현재 상태에서 "끊어진 틈 바로 근처"만 찾아 막은 가상 벽
 *  마스크를 만든다. 색칠을 시작하기 전, 선화 상태 그대로일 때 한 번만
 *  계산해서 캐시해두고 재사용한다(색칠 중간에 다시 계산할 필요 없음). */
function buildFillWallMask(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data;
  const inkMask = new Uint8Array(w * h);
  const INK_THRESHOLD = 130; // 이보다 어두우면 '선(잉크)'으로 간주
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    inkMask[i] = gray < INK_THRESHOLD ? 1 : 0;
  }

  const outsideRaw = floodOutsideMask(inkMask, w, h);
  const dilatedInk = dilateMaskSeparable(inkMask, w, h, FILL_GAP_BRIDGE_RADIUS);
  const outsideDilated = floodOutsideMask(dilatedInk, w, h);

  const wall = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (inkMask[i]) { wall[i] = 1; continue; }
    const isLeak = outsideRaw[i] && !outsideDilated[i];
    // leak이면서 동시에 원본 잉크 바로 근처(dilatedInk)인 픽셀만 벽으로
    // 삼는다 - 도형 안쪽 깊은 곳은 leak이어도 잉크에서 멀리 떨어져 있어
    // 이 조건에 걸리지 않으므로 항상 채우기가 가능하다.
    wall[i] = (isLeak && dilatedInk[i]) ? 1 : 0;
  }
  return wall;
}

let fillWallMask = null;
// 채우기 벽(fillWallMask) 계산은 항상 이 오프스크린 캔버스에서만 한다.
// 실제 colorCanvas에는 채색된 색이 섞여 있어서, 거기서 직접 계산하면
// 어두운 채색색(갈색·보라·검정 등)이 "선(잉크)"으로 잘못 인식될 수 있다.
// 이 캔버스는 선화 + STEP2 펜으로 그은 선만 그대로 반영하고, 채우기는 반영하지 않는다.
let inkTrackCanvas = null;

function floodFill(ctx, startX, startY, fillColor, tolerance, wallMask) {
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
  const startPos = startY * w + startX;

  function matches(pos, i) {
    // 시작점 자체는 벽 판정에서 제외한다 - 선 바로 옆을 눌러도 채우기가
    // 시작조차 못 하는 일이 없도록 하기 위함
    if (wallMask && pos !== startPos && wallMask[pos]) return false;
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
    if (!matches(pos, i)) continue;
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

    if (!inkTrackCanvas) {
      inkTrackCanvas = document.createElement('canvas');
      inkTrackCanvas.width = canvas.width;
      inkTrackCanvas.height = canvas.height;
    }
    const inkCtx = inkTrackCanvas.getContext('2d');
    inkCtx.fillStyle = '#fff';
    inkCtx.fillRect(0, 0, inkTrackCanvas.width, inkTrackCanvas.height);
    inkCtx.drawImage(img, 0, 0, inkTrackCanvas.width, inkTrackCanvas.height);

    // 색칠이 시작되기 전, 선화만 있는 (채색 전) 잉크 전용 캔버스에서 벽 마스크를 계산해둔다
    fillWallMask = buildFillWallMask(inkCtx, inkTrackCanvas.width, inkTrackCanvas.height);
  });
}

function initColorStep(paletteApi) {
  const canvas = document.getElementById('colorCanvas');
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const container = document.getElementById('viewport-color');

  const panCtl = setupPan(container, document.getElementById('btn-pan-color'), {});
  colorPanCtl = panCtl;

  const zoomCtl = setupZoom(document.getElementById('zoomTarget-color'), {
    zoomInBtn: document.getElementById('zoom-in-color'),
    zoomOutBtn: document.getElementById('zoom-out-color')
  });

  /* --- 채우기 / 펜(선 잇기) 모드 --- */
  let mode = 'fill';
  const fillBtn = document.getElementById('mode-fill');
  const penBtn = document.getElementById('mode-pen');
  function setMode(m) {
    mode = m;
    fillBtn.classList.toggle('active', m === 'fill');
    penBtn.classList.toggle('active', m === 'pen');
    // 펜(선 잇기)은 항상 검정으로 그리므로, 팔레트도 검정이 선택된 것처럼 보이게 한다
    if (paletteApi) {
      if (m === 'pen') paletteApi.highlightBlackForPen();
      else paletteApi.restoreFillHighlight();
    }
  }
  fillBtn.addEventListener('click', () => setMode('fill'));
  penBtn.addEventListener('click', () => setMode('pen'));
  setMode('fill');

  // 펜 아이콘을 두 번 빠르게 누르면 줌을 원래 크기(100%)로 되돌린다
  addDoubleTapAction(penBtn, () => zoomCtl.reset());

  /* --- 선 잇기 모드용 손떨림 방지 + 중점 2차 곡선 (STEP1과 동일한 원리)
     손떨림 보정은 화면(클라이언트) 좌표계에서 계산해서, 확대(줌) 상태에서도
     커서 위치와 실제로 그려지는 위치가 어긋나지 않게 한다. --- */
  const STABILIZE = 0.18;
  let smoothClientPos = null;
  let strokePts = [];

  function nextSmoothedClientPos(rawClient) {
    if (!smoothClientPos) { smoothClientPos = { x: rawClient.x, y: rawClient.y }; return smoothClientPos; }
    smoothClientPos = {
      x: smoothClientPos.x + (rawClient.x - smoothClientPos.x) * (1 - STABILIZE),
      y: smoothClientPos.y + (rawClient.y - smoothClientPos.y) * (1 - STABILIZE)
    };
    return smoothClientPos;
  }

  function clientToCanvasPos(clientPos) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientPos.x - rect.left) * scaleX,
      y: (clientPos.y - rect.top) * scaleY
    };
  }

  function drawPenSegment(targetCtx, pts) {
    targetCtx.strokeStyle = '#141414';
    targetCtx.lineWidth = 4;
    if (pts.length < 3) {
      const sp = pts[pts.length - 1];
      const prev = pts[pts.length - 2] || sp;
      targetCtx.beginPath();
      targetCtx.moveTo(prev.x, prev.y);
      targetCtx.lineTo(sp.x, sp.y);
      targetCtx.stroke();
    } else {
      const [p0, p1, p2] = pts;
      const midA = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const midB = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      targetCtx.beginPath();
      targetCtx.moveTo(midA.x, midA.y);
      targetCtx.quadraticCurveTo(p1.x, p1.y, midB.x, midB.y);
      targetCtx.stroke();
    }
  }

  function penStrokeTo(clientPos) {
    const sp = clientToCanvasPos(nextSmoothedClientPos(clientPos));
    strokePts.push(sp);
    if (strokePts.length > 3) strokePts.shift();
    drawPenSegment(ctx, strokePts);
    // 채우기 벽 계산이 채색색에 영향받지 않도록, 잉크 전용 캔버스에도 똑같이 그려둔다
    if (inkTrackCanvas) drawPenSegment(inkTrackCanvas.getContext('2d'), strokePts);
  }

  function handleColorStart(pos, evt) {
    if (panCtl.isPanMode()) return;
    colorHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (colorHistory.length > 15) colorHistory.shift();

    if (mode === 'fill') {
      const x = Math.floor(pos.x), y = Math.floor(pos.y);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
      floodFill(ctx, x, y, hexToRgb(selectedColor), 45, fillWallMask);
    } else {
      smoothClientPos = null;
      strokePts = [];
      const clientPos = evt ? { x: evt.clientX, y: evt.clientY } : pos;
      const sp = clientToCanvasPos(nextSmoothedClientPos(clientPos));
      strokePts.push(sp);
      ctx.strokeStyle = '#141414';
      ctx.fillStyle = '#141414';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
      ctx.fill();
      // 잉크 전용 캔버스에도 같은 점을 찍어둔다
      if (inkTrackCanvas) {
        const inkCtx = inkTrackCanvas.getContext('2d');
        inkCtx.fillStyle = '#141414';
        inkCtx.beginPath();
        inkCtx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
        inkCtx.fill();
      }
    }
  }
  function handleColorMove(pos, evt) {
    if (mode !== 'pen' || panCtl.isPanMode()) return;
    penStrokeTo(evt ? { x: evt.clientX, y: evt.clientY } : pos);
  }
  function handleColorEnd() {
    // 펜(선 잇기)으로 방금 선을 그었다면, 새로 이어진 선을 반영해서
    // 벽 마스크를 다시 계산한다. 반드시 잉크 전용 캔버스에서만 계산해야
    // 한다 - 실제 colorCanvas에서 계산하면 이미 칠해진 어두운 채색색
    // (갈색·보라·검정 등)이 "선(잉크)"으로 잘못 인식될 수 있기 때문이다.
    if (mode === 'pen' && inkTrackCanvas) {
      fillWallMask = buildFillWallMask(inkTrackCanvas.getContext('2d'), inkTrackCanvas.width, inkTrackCanvas.height);
    }
  }

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
      handleColorStart(getPos(canvas, e), e);
    });
    canvas.addEventListener('pointermove', e => handleColorMove(getPos(canvas, e), e));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
      canvas.addEventListener(evt, handleColorEnd)
    );
  }

  document.getElementById('btn-undo-color').addEventListener('click', () => {
    const prev = colorHistory.pop();
    if (prev) ctx.putImageData(prev, 0, 0);
  });

  document.getElementById('btn-reset-color').addEventListener('click', async () => {
    const ok = await showConfirmModal('색칠한 내용을 모두 지울까요?');
    if (ok) setupColorStep();
  });

  document.getElementById('btn-back-to-sketch').addEventListener('click', () => goToStep(1));

  document.getElementById('btn-restart-all').addEventListener('click', async () => {
    const ok = await showConfirmModal('처음부터 다시 시작할까요? 지금까지 작업이 사라져요.');
    if (ok) resetForNewCharacter();
  });

  document.getElementById('btn-save-color').addEventListener('click', () => {
    state.coloredDataURL = canvas.toDataURL('image/png');
    const saved = saveDraftFile();
    showToast(saved ? '💾 저장되었어요' : '⚠️ 저장에 실패했어요');
    setupSheetStep();
    goToStep(3);
  });
}

/** STEP2에서 "저장하고 다음"을 누르면 그 시점까지 채색된 그림을 브라우저의
 *  보이지 않는 저장공간(localStorage)이 아니라, 실제 파일(PNG)로 다운로드해서
 *  학생 기기의 다운로드 폴더 등 눈에 보이는 곳에 남긴다. */
function saveDraftFile() {
  try {
    const canvas = document.getElementById('colorCanvas');
    const dataURL = canvas.toDataURL('image/png');
    const namePart = sanitizeForFilename(state.character.author) || 'student';
    const classPart = sanitizeForFilename(state.studentClass) || 'noclass';
    const filename = `${classPart}_${namePart}_그리는중_${Date.now()}.png`;

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link); // 일부 브라우저에서 클릭이 확실히 동작하도록 잠깐 DOM에 붙인다
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (e) {
    console.warn('파일 저장 실패:', e);
    return false;
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
    <span class="bubble-handle">⠿</span>
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

function setupTraitSelect(target) {
  const select = document.getElementById(target + 'Select');
  const customInput = document.getElementById(target + 'Custom');
  select.addEventListener('change', () => {
    if (select.value === '__custom__') {
      customInput.style.display = '';
      customInput.focus();
      state.character[target] = customInput.value.trim();
    } else {
      customInput.style.display = 'none';
      state.character[target] = select.value;
    }
  });
  customInput.addEventListener('input', () => { state.character[target] = customInput.value.trim(); });
}

function initSheetStep() {
  document.getElementById('authorInput').addEventListener('input', e => { state.character.author = e.target.value.trim(); });
  document.getElementById('charNameInput').addEventListener('input', e => { state.character.name = e.target.value.trim(); });

  ['personality', 'strength', 'weakness'].forEach(setupTraitSelect);

  document.getElementById('btn-add-bubble').addEventListener('click', () => {
    addBubble(0.12 + Math.random() * 0.35, 0.08 + Math.random() * 0.2, '대사를 입력하세요');
  });

  document.getElementById('btn-back-to-color').addEventListener('click', () => goToStep(2));

  document.getElementById('btn-to-submit').addEventListener('click', () => {
    goToStep(4);
    const statusEl = document.getElementById('submitStatus');
    const submitBtn = document.getElementById('btn-submit');
    statusEl.textContent = '🖼️ 그림을 준비하는 중이에요...';
    submitBtn.disabled = true;
    finalCanvasReady = composeFinalCanvas()
      .then(() => {
        statusEl.textContent = '';
        submitBtn.disabled = false;
      })
      .catch(e => {
        console.warn('최종 이미지 합성 실패:', e);
        statusEl.textContent = '⚠️ 그림을 불러오지 못했어요. 뒤로 갔다가 다시 시도해주세요.';
        submitBtn.disabled = false; // 그래도 버튼은 눌러볼 수 있게 둔다
      });
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
  ctx.font = '400 19px Gowun Dodum, sans-serif';
  const maxTextWidth = 150;
  const lines = wrapTextByWidth(ctx, text || ' ', maxTextWidth);
  const lineHeight = 24;
  const boxW = maxTextWidth + 20;
  const boxH = lines.length * lineHeight + 18;

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
  lines.forEach((l, i) => ctx.fillText(l, x + 10, y + 26 + i * lineHeight));
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
    const submitBtn = document.getElementById('btn-submit');

    submitBtn.disabled = true;
    statusEl.textContent = '제출 중...';

    // 그림 합성이 아직 끝나지 않았다면(빠르게 연타한 경우) 끝날 때까지 기다린다.
    // 이걸 안 기다리면 캔버스가 배경만 그려진 채로 캡처될 수 있다.
    if (finalCanvasReady) {
      try { await finalCanvasReady; } catch (e) { /* 실패 메시지는 위에서 이미 처리됨 */ }
    }

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
        if (!res.ok) {
          const bodyText = await res.text().catch(() => '');
          throw new Error(`cloudinary upload failed: ${res.status} ${bodyText.slice(0, 200)}`);
        }
        statusEl.textContent = '✅ 선생님께 제출 완료되었어요!';
        submitBtn.disabled = true; // 중복 제출 방지 - 성공하면 다시 누를 필요 없음
      } catch (e) {
        console.warn('제출 실패:', e);
        statusEl.textContent = '❌ 제출에 실패했어요. 선생님께 알려주시고 다시 시도해주세요.';
        submitBtn.disabled = false; // 실패했을 때는 다시 시도할 수 있게 풀어준다
      }
    } else {
      statusEl.textContent = '⚠️ 제출 기능이 아직 연결되지 않았어요. 선생님께 알려주세요.';
      submitBtn.disabled = false;
    }
  });

  document.getElementById('btn-new-character').addEventListener('click', async () => {
    const ok = await showConfirmModal('새 캐릭터를 만들까요? 지금 화면은 사라져요.');
    if (ok) resetForNewCharacter();
  });

  document.getElementById('btn-back-to-sheet').addEventListener('click', () => goToStep(3));

  document.getElementById('btn-make-animation').addEventListener('click', () => {
    window.open('https://sketch.metademolab.com/', '_blank');
  });
}

/** "새 캐릭터 만들기": 이름/반 선택 화면(새로고침)으로 돌아가지 않고,
 *  같은 학생이 바로 STEP 1(가이드 따라 그리기)부터 다시 시작하도록 한다.
 *  이름/반/전체화면 상태는 그대로 유지하고, 그림 관련 데이터만 초기화한다.
 *  (전체화면이 풀리지 않도록 location.reload()나 window.confirm()은 쓰지 않는다) */
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
  if (toggleGuideBtn) toggleGuideBtn.textContent = '👁️';

  // 줌 배율 원래대로
  document.getElementById('zoomTarget-sketch').style.width = '100%';
  document.getElementById('zoomTarget-color').style.width = '100%';

  // 팬(이동) 모드/스크롤 위치도 원래대로 (내부 상태까지 확실히 초기화)
  if (sketchPanCtl) sketchPanCtl.reset();
  if (colorPanCtl) colorPanCtl.reset();
  ['viewport-sketch', 'viewport-color'].forEach(id => {
    const vp = document.getElementById(id);
    vp.scrollLeft = 0;
    vp.scrollTop = 0;
  });

  // STEP 3 입력값 초기화 (드롭다운 방식)
  const charNameInput = document.getElementById('charNameInput');
  if (charNameInput) charNameInput.value = '';
  ['personality', 'strength', 'weakness'].forEach(target => {
    const select = document.getElementById(target + 'Select');
    const customInput = document.getElementById(target + 'Custom');
    if (select) select.value = '';
    if (customInput) { customInput.value = ''; customInput.style.display = 'none'; }
  });
  document.getElementById('bubbleLayer').innerHTML = '';

  const submitStatus = document.getElementById('submitStatus');
  if (submitStatus) submitStatus.textContent = '';
  const submitBtn = document.getElementById('btn-submit');
  if (submitBtn) submitBtn.disabled = false;
  finalCanvasReady = null;

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
  const paletteApi = setupPalette();
  initColorStep(paletteApi);
  initSheetStep();
  initSubmitStep();
});
