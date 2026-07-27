// app.js — glues the start / draw / AR screens together and owns the
// autosave-and-reset behaviour described in the spec:
//  - drawing progress is saved to localStorage as the student works
//  - if the page reloads mid-session, we resume right where they left off
//  - pressing "수업 시작하기" for a new student wipes the old data first

const GUIDES = [
  { id: 'elephant', name: '코끼리', src: 'assets/guides/elephant.jpg' },
  { id: 'fox', name: '사막여우', src: 'assets/guides/fox.jpg' },
  { id: 'crocodile', name: '악어', src: 'assets/guides/crocodile.jpg' }
];

const App = (() => {
  let session = null; // { name, className, guideId }
  let selectedGuideId = GUIDES[0].id;
  let currentTool = 'marker';
  let currentColor = AR_COLORS[0];
  let currentSize = 'medium';

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function guideById(id) {
    return GUIDES.find(g => g.id === id) || GUIDES[0];
  }

  // ---------------- START SCREEN ----------------
  function buildGuideGrid() {
    const grid = document.getElementById('guide-grid');
    grid.innerHTML = '';
    GUIDES.forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'guide-choice' + (g.id === selectedGuideId ? ' selected' : '');
      btn.type = 'button';
      btn.innerHTML = `<img src="${g.src}" alt="${g.name}" draggable="false"><div>${g.name}</div>`;
      btn.addEventListener('click', () => {
        selectedGuideId = g.id;
        [...grid.children].forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
      });
      grid.appendChild(btn);
    });
  }

  function startNewSession() {
    // must be called synchronously inside the click handler — the
    // Fullscreen API only works within a genuine user-gesture call stack
    ClassroomGuard.fullscreen.request().catch(() => {
      /* unsupported or denied — app keeps working normally without it */
    });

    const name = document.getElementById('input-name').value.trim() || '이름없음';
    const classSelect = document.getElementById('input-class');
    const classCode = classSelect.value;
    const className = classSelect.options[classSelect.selectedIndex].text;

    ARStorage.clearAll(); // reset previous student's leftover data
    session = { name, className, classCode, guideId: selectedGuideId };
    ARStorage.saveSession(session);

    ArDraw.init({ guideSrc: guideById(session.guideId).src, onStrokeEndCb: autosaveDrawing });
    resetZoom();
    showScreen('screen-draw');
  }

  // ---------------- DRAW SCREEN ----------------
  function autosaveDrawing() {
    ARStorage.saveDrawing(ArDraw.getRawDrawDataURL());
  }

  function syncColorDots(color) {
    document.querySelectorAll('.tool-btn .color-dot').forEach(dot => {
      dot.style.background = color;
    });
  }

  function buildPalette() {
    const row = document.getElementById('palette-row');
    row.innerHTML = '';
    AR_COLORS.forEach((c, i) => {
      const sw = document.createElement('button');
      sw.className = 'swatch' + (i === 0 ? ' active' : '');
      sw.style.background = c;
      sw.addEventListener('click', () => {
        currentColor = c;
        ArDraw.setColor(c);
        [...row.children].forEach(x => x.classList.remove('active'));
        sw.classList.add('active');
        syncColorDots(c);
        document.getElementById('color-popup').classList.remove('active');
      });
      row.appendChild(sw);
    });
    syncColorDots(currentColor);
  }

  const COLOR_TOOLS = ['fill', 'marker', 'pencil', 'airbrush'];

  function wireToolbar() {
    const toolRow = document.getElementById('tool-row');
    const colorPopup = document.getElementById('color-popup');

    toolRow.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
      if (btn.dataset.tool === currentTool) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentTool = btn.dataset.tool;
        ArDraw.setTool(currentTool);
        toolRow.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (COLOR_TOOLS.includes(currentTool)) {
          colorPopup.classList.add('active');
        }
      });
    });
    document.getElementById('btn-undo').addEventListener('click', () => ArDraw.undo());

    // tap the dimmed backdrop (not the card itself) to dismiss
    colorPopup.addEventListener('click', (e) => {
      if (e.target === colorPopup) colorPopup.classList.remove('active');
    });

    const sizeRow = document.getElementById('size-row');
    sizeRow.querySelectorAll('.size-btn').forEach((btn, i) => {
      if (i === 1) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentSize = btn.dataset.size;
        ArDraw.setSize(currentSize);
        sizeRow.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function goAlive() {
    const dataURL = ArDraw.getDataURL();
    showScreen('screen-ar');
    ArStage.start(dataURL);
  }

  // ---------------- AR SCREEN ----------------
  function backToDraw() {
    ArStage.stop();
    showScreen('screen-draw');
  }

  function resetToStart() {
    ArStage.stop();
    ArGame.stop();
    ARStorage.clearAll();
    session = null;
    document.getElementById('input-name').value = '';
    showScreen('screen-start');
  }

  // ---------------- MINI GAME ----------------
  function goMinigame() {
    const dataURL = ArDraw.getDataURL();

    document.getElementById('game-ready-overlay').style.display = 'flex';
    document.getElementById('game-over-overlay').style.display = 'none';
    document.getElementById('game-score').textContent = '0';
    document.getElementById('game-best').textContent = ArGame.bestScore();
    document.getElementById('game-lives').textContent = '❤️'.repeat(ArGame.startLives);

    showScreen('screen-game');
    ArGame.init(document.getElementById('game-canvas'), dataURL, {
      onScoreChange: (s) => { document.getElementById('game-score').textContent = s; },
      onLivesChange: (lives) => {
        document.getElementById('game-lives').textContent = '❤️'.repeat(Math.max(0, lives));
      },
      onGameOver: (finalScore, best) => {
        document.getElementById('game-final-score').textContent = `점수: ${finalScore}`;
        document.getElementById('game-best').textContent = best;
        document.getElementById('game-over-overlay').style.display = 'flex';
      }
    });
  }

  function goMinigameFromAr() {
    ArStage.stop();
    goMinigame();
  }

  function wireMinigame() {
    const stage = document.getElementById('game-stage');
    const readyOverlay = document.getElementById('game-ready-overlay');
    const overOverlay = document.getElementById('game-over-overlay');

    function beginRun() {
      readyOverlay.style.display = 'none';
      overOverlay.style.display = 'none';
      ArGame.startRun();
    }

    document.getElementById('btn-game-start').addEventListener('click', (e) => {
      e.stopPropagation(); beginRun();
    });
    document.getElementById('btn-game-retry').addEventListener('click', (e) => {
      e.stopPropagation(); beginRun();
    });
    document.getElementById('btn-game-exit').addEventListener('click', (e) => {
      e.stopPropagation();
      ArGame.stop();
      showScreen('screen-draw');
    });

    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.game-panel')) return; // let overlay buttons handle their own taps
      if (readyOverlay.style.display !== 'none') { beginRun(); }
      ArGame.setHolding(true);
    });
    stage.addEventListener('pointerup', () => ArGame.setHolding(false));
    stage.addEventListener('pointercancel', () => ArGame.setHolding(false));
    stage.addEventListener('pointerleave', () => ArGame.setHolding(false));
  }

  // ---------------- CANVAS ZOOM (drawing screen) ----------------
  const ZOOM_MIN = 1, ZOOM_MAX = 4, ZOOM_STEP = 0.4;
  let zoomScale = 1, zoomPanX = 0, zoomPanY = 0;
  let panMode = false;

  function applyZoomTransform() {
    document.getElementById('canvas-zoom-layer').style.transform =
      `translate(${zoomPanX}px, ${zoomPanY}px) scale(${zoomScale})`;
  }

  function clampZoomPan(stageEl) {
    const rect = stageEl.getBoundingClientRect();
    const maxX = (rect.width * (zoomScale - 1)) / 2;
    const maxY = (rect.height * (zoomScale - 1)) / 2;
    zoomPanX = Math.max(-maxX, Math.min(maxX, zoomPanX));
    zoomPanY = Math.max(-maxY, Math.min(maxY, zoomPanY));
  }

  function setPanMode(on) {
    panMode = on;
    const panBtn = document.getElementById('btn-pan-mode');
    const drawCanvas = document.getElementById('canvas-draw');
    panBtn.classList.toggle('active', panMode);
    // while panning, hand single-finger input to the pan logic instead of
    // the drawing canvas — the guide canvas is already pointer-events:none,
    // so this lets touches fall through to the stage-level pan handler
    drawCanvas.style.pointerEvents = panMode ? 'none' : '';
    if (panMode) ArDraw.cancelStroke();
  }

  function resetZoom() {
    zoomScale = 1; zoomPanX = 0; zoomPanY = 0;
    applyZoomTransform();
    setPanMode(false);
  }

  function wireCanvasZoom() {
    const stage = document.getElementById('canvas-stage');
    const pointers = new Map();
    let pinchStartDist = 0, pinchStartScale = 1;
    let lastPanPoint = null;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    document.getElementById('btn-pan-mode').addEventListener('click', () => setPanMode(!panMode));

    stage.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        // a pinch is starting — make sure the single-finger drawing
        // tracker doesn't also think one of these fingers is a stroke
        ArDraw.cancelStroke();
        const [a, b] = [...pointers.values()];
        pinchStartDist = dist(a, b) || 1;
        pinchStartScale = zoomScale;
        lastPanPoint = null;
      } else if (pointers.size === 1 && panMode) {
        lastPanPoint = { x: e.clientX, y: e.clientY };
      }
    });

    stage.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        e.preventDefault();
        const [a, b] = [...pointers.values()];
        const ratio = dist(a, b) / pinchStartDist;
        zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartScale * ratio));
        clampZoomPan(stage);
        applyZoomTransform();
        return;
      }

      if (pointers.size === 1 && panMode && lastPanPoint) {
        e.preventDefault();
        zoomPanX += e.clientX - lastPanPoint.x;
        zoomPanY += e.clientY - lastPanPoint.y;
        lastPanPoint = { x: e.clientX, y: e.clientY };
        clampZoomPan(stage);
        applyZoomTransform();
      }
    });

    const releasePointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) lastPanPoint = null;
    };
    stage.addEventListener('pointerup', releasePointer);
    stage.addEventListener('pointercancel', releasePointer);

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      zoomScale = Math.min(ZOOM_MAX, zoomScale + ZOOM_STEP);
      clampZoomPan(stage);
      applyZoomTransform();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      zoomScale = Math.max(ZOOM_MIN, zoomScale - ZOOM_STEP);
      clampZoomPan(stage);
      applyZoomTransform();
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', resetZoom);
  }

  // ---------------- PHOTO MODAL ----------------
  function wirePhotoModal() {
    const modal = document.getElementById('photo-modal');
    const statusEl = document.getElementById('submit-status');
    const submitBtn = document.getElementById('btn-submit-photo');
    let currentDataURL = null;

    document.getElementById('btn-photo').addEventListener('click', () => {
      try {
        currentDataURL = ArStage.capturePhoto();
      } catch (err) {
        console.error('사진 촬영 실패', err);
        alert('사진을 찍는 중 문제가 생겼어요. 다시 시도해주세요.');
        return;
      }
      document.getElementById('photo-preview').src = currentDataURL;

      statusEl.textContent = '';
      statusEl.className = 'submit-status';
      submitBtn.disabled = false;
      submitBtn.textContent = '🎁 선생님께 제출하기';
      modal.classList.add('active');
    });

    document.getElementById('btn-retake').addEventListener('click', () => {
      modal.classList.remove('active');
    });

    submitBtn.addEventListener('click', async () => {
      if (!currentDataURL || !session) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '제출하는 중...';
      statusEl.className = 'submit-status pending';
      statusEl.textContent = '선생님께 보내고 있어요...';

      try {
        const blob = await (await fetch(currentDataURL)).blob();
        await ArCloudinary.uploadPhoto(blob, session);
        statusEl.className = 'submit-status ok';
        statusEl.textContent = '✅ 제출 완료! 선생님이 확인하실 수 있어요.';
        submitBtn.textContent = '🎁 선생님께 제출하기';
        submitBtn.disabled = true; // avoid duplicate submits of the same shot
      } catch (err) {
        console.warn('Cloudinary 제출 실패', err);
        statusEl.className = 'submit-status error';
        statusEl.textContent = '❌ 제출에 실패했어요. 인터넷 연결을 확인하고 다시 눌러주세요.';
        submitBtn.disabled = false;
        submitBtn.textContent = '🎁 다시 제출하기';
      }
    });
  }

  // ---------------- RESUME ON RELOAD ----------------
  function tryResume() {
    const savedSession = ARStorage.loadSession();
    const savedDrawing = ARStorage.loadDrawing();
    if (!savedSession) return false;

    session = savedSession;
    selectedGuideId = session.guideId;

    ArDraw.init({ guideSrc: guideById(session.guideId).src, onStrokeEndCb: autosaveDrawing });
    if (savedDrawing) ArDraw.loadDrawingFromDataURL(savedDrawing);
    resetZoom();
    showScreen('screen-draw');
    return true;
  }

  function init() {
    ClassroomGuard.fullscreen.enable({ autoRequestOnFirstGesture: false });

    buildGuideGrid();
    buildPalette();
    wireToolbar();
    wireCanvasZoom();
    wirePhotoModal();
    wireMinigame();
    ArStage.init();

    document.getElementById('btn-start').addEventListener('click', startNewSession);
    document.getElementById('btn-alive').addEventListener('click', goAlive);
    document.getElementById('btn-minigame-draw').addEventListener('click', goMinigame);
    document.getElementById('btn-to-minigame').addEventListener('click', goMinigameFromAr);
    document.getElementById('btn-restart-draw').addEventListener('click', resetToStart);
    document.getElementById('btn-restart-ar').addEventListener('click', resetToStart);
    document.getElementById('btn-restart-game').addEventListener('click', resetToStart);
    document.getElementById('btn-back-to-draw').addEventListener('click', backToDraw);

    if (!tryResume()) {
      showScreen('screen-start');
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
