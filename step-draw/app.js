(function () {
  'use strict';

  console.log('[sea-draw] app.js build', '2026-08-07-v2 (step-guide fix + snap)');

  /* ============ 설정 ============ */
  const CLOUDINARY_CLOUD_NAME = 'qmbonapf';
  const CLOUDINARY_UPLOAD_PRESET = 'stickman';
  const CLOUDINARY_FOLDER = 'sea-draw-test';
  const CANVAS_RES = 900; // 내부 드로잉 해상도 (정사각형)
  const SMOOTHING_ALPHA = 0.55; // 손떨림 보정 강도 (1에 가까울수록 원본에 가깝고 지연 없음)

  /* ============ 데이터: 주제 -> 캐릭터 ============ */
  const THEMES = {
    sea: {
      label: '바다생물 그리기',
      characters: [
        {
          id: 'penguin',
          name: '펭귄',
          thumb: 'assets/penguin/guide4.png',
          steps: [
            'assets/penguin/delta1.png',
            'assets/penguin/delta2.png',
            'assets/penguin/delta3.png',
            'assets/penguin/delta4.png'
          ]
        }
      ]
    },
    misc: {
      label: '여러가지 그리기',
      characters: []
    }
  };

  const PALETTE = [
    '#2b2b2b', '#ffffff', '#8d6e63', '#ffc1cf',
    '#ff4d6d', '#e53935', '#b71c1c', '#ff8a3d',
    '#ffc93d', '#fff176', '#9ccc65', '#43a047',
    '#1b5e20', '#4dd0e1', '#2196f3', '#1a237e',
    '#9c5fd6', '#9e9e9e'
  ];

  /* ============ 상태 ============ */
  const state = {
    studentName: '',
    school: '',
    classCode: '',
    theme: 'sea',
    character: null,
    stepIndex: 0,
    strokes: [],       // {size, points:[{x,y}], erase}
    decoStrokes: [],   // 색칠 단계에서 추가로 그린 선 {points:[{x,y}], color}
    brushSize: 10,
    fillColor: PALETTE[4],
    fillHistory: []     // undo용 ImageData 스냅샷
  };

  let workMode = 'draw'; // 'draw' | 'color'
  let drawingEnabled = false;
  let eraserOn = false;
  let colorTool = 'fill'; // 'fill' | 'pen'
  let snapEnabled = true;
  let currentSnapGrid = null;
  const SNAP_CELL = 24;   // 스냅 인덱스 버킷 크기 (캔버스 좌표 기준)
  const SNAP_RADIUS = 38; // 이 거리 안에 있을 때만 살짝 끌어당김

  /* ============ 유틸 ============ */
  const $ = (id) => document.getElementById(id);
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function sanitize(str) {
    return (str || '').trim().replace(/[^a-zA-Z0-9가-힣]/g, '') || 'noname';
  }
  function timestampTag() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  /* ============ 1. 입장 화면 ============ */
  let selectedTheme = 'sea';
  $('themeGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.theme-card');
    if (!card) return;
    document.querySelectorAll('.theme-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedTheme = card.dataset.theme;
  });

  $('startBtn').addEventListener('click', () => {
    const name = $('nameInput').value.trim();
    if (!name) {
      ClassroomGuard.showModal('이름을 입력해 주세요!', [{ label: '확인', primary: true }]);
      $('nameInput').focus();
      return;
    }
    state.studentName = name;
    state.school = $('schoolSelect').value;
    state.classCode = $('classSelect').value;

    localStorage.setItem('sd_studentName', state.studentName);
    localStorage.setItem('sd_classFolder', state.school + state.classCode);

    ClassroomGuard.enterFullscreen();
    enterWorkspace(selectedTheme);
  });

  $('backToEntryBtn').addEventListener('click', () => {
    const hasProgress = state.strokes.length > 0 || workMode === 'color';
    const goBack = () => showScreen('screen-entry');
    if (hasProgress) {
      ClassroomGuard.showModal('처음으로 돌아가면 지금 그린 그림이 사라져요. 계속할까요?', [
        { label: '취소', primary: false },
        { label: '처음으로', primary: true, onClick: goBack }
      ]);
    } else {
      goBack();
    }
  });

  /* ============ 2. 작업 화면 진입 (주제 -> 캐릭터) ============ */
  function enterWorkspace(themeKey) {
    state.theme = themeKey;
    const theme = THEMES[themeKey];
    renderPanelCharList(theme.characters);

    if (theme.characters.length) {
      $('emptyThemeMsg').style.display = 'none';
      $('canvasStage').style.display = 'block';
      $('sidePanel').style.display = 'flex';
      startDrawing(theme.characters[0]);
    } else {
      $('emptyThemeMsg').style.display = 'block';
      $('canvasStage').style.display = 'none';
      $('sidePanel').style.display = 'none';
      $('stepIndicator').textContent = theme.label;
      workMode = 'draw';
      drawingEnabled = false;
    }
    showScreen('screen-work');
    requestAnimationFrame(sizeStageToViewport);
  }

  function renderPanelCharList(characters) {
    const list = $('panelCharList');
    list.innerHTML = '';
    characters.forEach((ch) => {
      const card = document.createElement('div');
      card.className = 'panel-char-card' + (state.character && state.character.id === ch.id ? ' active' : '');
      card.dataset.charId = ch.id;
      card.innerHTML = `<img src="${ch.thumb}" alt=""><span>${ch.name}</span>`;
      card.addEventListener('click', () => switchCharacter(ch));
      list.appendChild(card);
    });
  }

  function updateCharListActive() {
    document.querySelectorAll('.panel-char-card').forEach((card) => {
      card.classList.toggle('active', state.character && card.dataset.charId === state.character.id);
    });
  }

  function switchCharacter(ch) {
    if (state.character && ch.id === state.character.id) return;
    const hasProgress = state.strokes.length > 0 || workMode === 'color';
    if (hasProgress) {
      ClassroomGuard.showModal('다른 동물을 선택하면 지금 그린 그림이 사라져요. 계속할까요?', [
        { label: '취소', primary: false },
        { label: '선택하기', primary: true, onClick: () => startDrawing(ch) }
      ]);
    } else {
      startDrawing(ch);
    }
  }

  /* ============ 3. 우측 패널 접기/펼치기 ============ */
  const sidePanelEl = $('sidePanel');
  const panelToggleEl = $('panelToggle');
  panelToggleEl.addEventListener('click', () => {
    sidePanelEl.classList.toggle('collapsed');
    const collapsed = sidePanelEl.classList.contains('collapsed');
    panelToggleEl.textContent = collapsed ? '◀' : '▶';
    sizeStageToViewport();
  });
  sidePanelEl.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'width') sizeStageToViewport();
  });

  /* ============ 4. 캔버스 공용 세팅 ============ */
  const stage = $('canvasStage');
  const drawCanvas = $('drawCanvas');
  const fillCanvas = $('fillCanvas');
  const lineArtCanvas = $('lineArtCanvas');
  const decoCanvas = $('decoCanvas');
  const guideImg = $('guideImg');
  const drawCtx = drawCanvas.getContext('2d');
  const fillCtx = fillCanvas.getContext('2d');
  const lineArtCtx = lineArtCanvas.getContext('2d');
  const decoCtx = decoCanvas.getContext('2d');

  [drawCanvas, fillCanvas, lineArtCanvas, decoCanvas].forEach((c) => {
    c.width = CANVAS_RES;
    c.height = CANVAS_RES;
  });
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  decoCtx.lineCap = 'round';
  decoCtx.lineJoin = 'round';

  function sizeStageToViewport() {
    const wrap = document.querySelector('.canvas-wrap');
    const availW = wrap.clientWidth - 16;
    const availH = wrap.clientHeight - 16;
    const size = Math.max(120, Math.min(availW, availH));
    stage.style.width = size + 'px';
    stage.style.height = size + 'px';
  }
  window.addEventListener('resize', sizeStageToViewport);
  window.addEventListener('orientationchange', () => setTimeout(sizeStageToViewport, 250));
  document.addEventListener('fullscreenchange', () => setTimeout(sizeStageToViewport, 250));

  function stagePointToCanvas(e) {
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * CANVAS_RES;
    const y = (e.clientY - rect.top) / rect.height * CANVAS_RES;
    return { x, y };
  }

  /* ---- 가이드 스냅: 가이드 이미지의 선 픽셀을 버킷 그리드로 인덱싱해서
         가까이 그릴 때 살짝 끌어당기는 방식 (실제 벡터 경로 스냅은 아님) ---- */
  function buildSnapIndex(img) {
    const off = document.createElement('canvas');
    off.width = CANVAS_RES; off.height = CANVAS_RES;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, CANVAS_RES, CANVAS_RES);
    const data = octx.getImageData(0, 0, CANVAS_RES, CANVAS_RES).data;
    const grid = new Map();
    const step = 2; // 2px 간격 샘플링 (촘촘함/성능 균형)
    for (let y = 0; y < CANVAS_RES; y += step) {
      for (let x = 0; x < CANVAS_RES; x += step) {
        const idx = (y * CANVAS_RES + x) * 4;
        if (data[idx + 3] > 60) {
          const key = Math.floor(x / SNAP_CELL) + ',' + Math.floor(y / SNAP_CELL);
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push({ x, y });
        }
      }
    }
    return grid;
  }

  function snapPoint(p) {
    if (!snapEnabled || !currentSnapGrid || eraserOn) return p;
    const gx = Math.floor(p.x / SNAP_CELL), gy = Math.floor(p.y / SNAP_CELL);
    let best = null, bestDistSq = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = currentSnapGrid.get((gx + dx) + ',' + (gy + dy));
        if (!bucket) continue;
        for (const gp of bucket) {
          const d = (gp.x - p.x) * (gp.x - p.x) + (gp.y - p.y) * (gp.y - p.y);
          if (d < bestDistSq) { bestDistSq = d; best = gp; }
        }
      }
    }
    if (best && bestDistSq <= SNAP_RADIUS * SNAP_RADIUS) {
      const dist = Math.sqrt(bestDistSq);
      const pull = (1 - dist / SNAP_RADIUS) * 0.8; // 가까울수록 강하게, 최대 80%까지 끌어당김
      return { x: p.x + (best.x - p.x) * pull, y: p.y + (best.y - p.y) * pull };
    }
    return p;
  }

  $('snapBtn').addEventListener('click', () => {
    snapEnabled = !snapEnabled;
    $('snapBtn').classList.toggle('on', snapEnabled);
    $('snapBtn').textContent = snapEnabled ? '🧲 스냅 켜짐' : '🧲 스냅 꺼짐';
  });

  /* ---- 그리기 단계: 스트로크 저장 & 렌더 ---- */
  function redrawStrokes() {
    drawCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    state.strokes.forEach((s) => {
      if (s.points.length < 1) return;
      drawCtx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      drawCtx.strokeStyle = '#1c1c1c';
      drawCtx.lineWidth = s.size;
      const pts = s.points;
      drawCtx.beginPath();
      if (pts.length === 1) {
        drawCtx.moveTo(pts[0].x, pts[0].y);
        drawCtx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
      } else {
        drawCtx.moveTo(pts[0].x, pts[0].y);
        let i = 1;
        for (; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          drawCtx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        drawCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }
      drawCtx.stroke();
    });
    drawCtx.globalCompositeOperation = 'source-over';
  }

  let currentStroke = null;
  ClassroomGuard.attachPalmRejection(drawCanvas, {
    onStart(e) {
      if (!drawingEnabled) return;
      const p = snapPoint(stagePointToCanvas(e));
      currentStroke = { size: state.brushSize, points: [p], _last: p, erase: eraserOn };
      state.strokes.push(currentStroke);
      redrawStrokes();
    },
    onMove(e) {
      if (!drawingEnabled || !currentStroke) return;
      const raw = stagePointToCanvas(e);
      const last = currentStroke._last;
      let smoothed = {
        x: last.x + (raw.x - last.x) * SMOOTHING_ALPHA,
        y: last.y + (raw.y - last.y) * SMOOTHING_ALPHA
      };
      smoothed = snapPoint(smoothed); // 손떨림 보정 이후, 최종 좌표에 스냅을 적용해야 당기는 힘이 희석되지 않음
      currentStroke._last = smoothed;
      currentStroke.points.push(smoothed);
      redrawStrokes();
    },
    onEnd() { currentStroke = null; }
  });

  function redrawDeco() {
    decoCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    state.decoStrokes.forEach((s) => {
      if (s.points.length < 1) return;
      decoCtx.strokeStyle = s.color;
      decoCtx.lineWidth = state.brushSize;
      const pts = s.points;
      decoCtx.beginPath();
      if (pts.length === 1) {
        decoCtx.moveTo(pts[0].x, pts[0].y);
        decoCtx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
      } else {
        decoCtx.moveTo(pts[0].x, pts[0].y);
        let i = 1;
        for (; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          decoCtx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        decoCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }
      decoCtx.stroke();
    });
  }

  /* ---- 펜 굵기 ---- */
  document.querySelectorAll('.brush-dot-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.brush-dot-btn').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      state.brushSize = Number(btn.dataset.size);
    });
  });

  /* ---- 지우개 ---- */
  $('eraserBtn').addEventListener('click', () => {
    eraserOn = !eraserOn;
    $('eraserBtn').classList.toggle('on', eraserOn);
    $('eraserBtn').textContent = eraserOn ? '🖊️ 지우개 끄기' : '🧹 지우개 켜기';
  });

  /* ---- 되돌리기 / 다시그리기 ---- */
  $('undoBtn').addEventListener('click', () => {
    if (workMode === 'draw') {
      state.strokes.pop();
      redrawStrokes();
    } else if (workMode === 'color') {
      if (colorTool === 'pen') {
        state.decoStrokes.pop();
        redrawDeco();
      } else {
        const last = state.fillHistory.pop();
        if (last) fillCtx.putImageData(last, 0, 0);
      }
    }
  });

  $('resetBtn').addEventListener('click', () => {
    ClassroomGuard.showModal('처음부터 다시 그릴까요? 지금까지 그린 내용이 지워져요.', [
      { label: '취소', primary: false },
      { label: '다시 그리기', primary: true, onClick: () => {
        if (workMode === 'draw') {
          state.strokes = [];
          redrawStrokes();
          loadStepGuide();
        } else if (workMode === 'color') {
          fillCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
          state.fillHistory = [];
          state.decoStrokes = [];
          redrawDeco();
        }
      }}
    ]);
  });

  /* ============ 5. 단계별 따라그리기 ============ */
  function startDrawing(character) {
    state.character = character;
    state.stepIndex = 0;
    state.strokes = [];
    state.fillHistory = [];
    eraserOn = false;
    $('eraserBtn').classList.remove('on');
    $('eraserBtn').textContent = '🧹 지우개 켜기';
    snapEnabled = true;
    $('snapBtn').classList.add('on');
    $('snapBtn').textContent = '🧲 스냅 켜짐';
    workMode = 'draw';

    $('panelDrawSection').style.display = 'flex';
    $('panelColorSection').style.display = 'none';
    guideImg.style.display = 'block';
    lineArtCanvas.style.display = 'none';
    fillCanvas.style.display = 'none';
    decoCanvas.style.display = 'none';
    $('colorClickLayer').style.display = 'none';
    drawCanvas.style.display = 'block';
    drawingEnabled = true;

    updateCharListActive();
    redrawStrokes();
    loadStepGuide();
    requestAnimationFrame(sizeStageToViewport);
  }

  function loadStepGuide() {
    const total = state.character.steps.length;
    guideImg.onload = () => { currentSnapGrid = buildSnapIndex(guideImg); };
    guideImg.onerror = () => {
      ClassroomGuard.showModal('가이드 이미지를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.', [{ label: '확인', primary: true }]);
    };
    // 캐시 때문에 이전 단계 이미지가 그대로 남는 문제를 막기 위해 매번 새 요청을 강제함
    guideImg.src = state.character.steps[state.stepIndex] + '?v=' + Date.now();
    renderStepDots(total);
    $('nextStepBtn').textContent = (state.stepIndex === total - 1) ? '색칠하기 시작' : '다음 단계';
  }

  function renderStepDots(total) {
    const el = $('stepIndicator');
    el.innerHTML = `${state.stepIndex + 1} / ${total} 단계 &nbsp;`;
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i <= state.stepIndex ? ' on' : '');
      el.appendChild(dot);
    }
  }

  $('nextStepBtn').addEventListener('click', () => {
    const total = state.character.steps.length;
    if (state.stepIndex < total - 1) {
      state.stepIndex++;
      loadStepGuide(); // 이전 단계 가이드는 사라지고 새 가이드만 표시, 그린 선은 유지
    } else {
      enterColoringStage();
    }
  });

  /* ============ 6. 색칠 단계 (플러드필) ============ */
  let wallMask = null; // Uint8Array, 1 = 경계선(벽)

  function enterColoringStage() {
    workMode = 'color';
    drawingEnabled = false;

    lineArtCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    lineArtCtx.drawImage(drawCanvas, 0, 0);

    const data = lineArtCtx.getImageData(0, 0, CANVAS_RES, CANVAS_RES).data;
    wallMask = new Uint8Array(CANVAS_RES * CANVAS_RES);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const a = data[i + 3];
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      wallMask[p] = (a > 60 && brightness < 200) ? 1 : 0;
    }

    fillCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    state.fillHistory = [];
    state.decoStrokes = [];
    decoCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    colorTool = 'fill';
    document.querySelectorAll('#colorToolToggle .tool-btn').forEach((b) => b.classList.toggle('on', b.dataset.tool === 'fill'));

    guideImg.style.display = 'none';
    drawCanvas.style.display = 'none';
    lineArtCanvas.style.display = 'block';
    fillCanvas.style.display = 'block';
    decoCanvas.style.display = 'block';
    $('colorClickLayer').style.display = 'block';
    $('panelDrawSection').style.display = 'none';
    $('panelColorSection').style.display = 'flex';

    $('stepIndicator').textContent = '🎨 색칠하기';
    renderPalette();
  }

  function backToDrawingStage() {
    workMode = 'draw';
    drawingEnabled = true;
    fillCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    state.fillHistory = [];
    state.decoStrokes = [];
    decoCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);

    guideImg.style.display = 'block';
    drawCanvas.style.display = 'block';
    lineArtCanvas.style.display = 'none';
    fillCanvas.style.display = 'none';
    decoCanvas.style.display = 'none';
    $('colorClickLayer').style.display = 'none';
    $('panelDrawSection').style.display = 'flex';
    $('panelColorSection').style.display = 'none';

    loadStepGuide();
  }

  $('backToDrawBtn').addEventListener('click', () => {
    ClassroomGuard.showModal('선 그리기로 돌아가면 지금까지 색칠한 내용이 사라져요. 계속할까요?', [
      { label: '취소', primary: false },
      { label: '돌아가기', primary: true, onClick: backToDrawingStage }
    ]);
  });

  document.querySelectorAll('#colorToolToggle .tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#colorToolToggle .tool-btn').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      colorTool = btn.dataset.tool;
    });
  });

  function renderPalette() {
    const grid = $('paletteGrid');
    grid.innerHTML = '';

    // 무지개 버튼: 기본 색상 외에 원하는 색을 직접 골라 넣을 수 있음
    const rainbowWrap = document.createElement('label');
    rainbowWrap.className = 'swatch swatch-rainbow';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = state.fillColor.length === 7 ? state.fillColor : '#ff66cc';
    colorInput.addEventListener('input', () => {
      state.fillColor = colorInput.value;
      document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('on'));
      rainbowWrap.classList.add('on');
    });
    rainbowWrap.appendChild(colorInput);
    grid.appendChild(rainbowWrap);

    PALETTE.forEach((color) => {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (color === state.fillColor ? ' on' : '');
      sw.style.background = color;
      sw.addEventListener('click', () => {
        state.fillColor = color;
        document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('on'));
        sw.classList.add('on');
      });
      grid.appendChild(sw);
    });
  }

  // 스캔라인 방식 플러드필 (마스크 기반, 반복문 스택 사용 - 재귀 X)
  function floodFillAt(cx, cy) {
    const w = CANVAS_RES, h = CANVAS_RES;
    const sx = Math.floor(cx), sy = Math.floor(cy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    if (wallMask[sy * w + sx]) return;

    const visited = new Uint8Array(w * h);
    const stack = [[sx, sy]];
    const filledPixels = [];

    while (stack.length) {
      let [x, y] = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      let idx = y * w + x;
      if (visited[idx] || wallMask[idx]) continue;

      let xl = x;
      while (xl > 0 && !wallMask[y * w + (xl - 1)] && !visited[y * w + (xl - 1)]) xl--;
      let xr = x;
      while (xr < w - 1 && !wallMask[y * w + (xr + 1)] && !visited[y * w + (xr + 1)]) xr++;

      for (let i = xl; i <= xr; i++) {
        const id = y * w + i;
        if (visited[id]) continue;
        visited[id] = 1;
        filledPixels.push(id);
      }
      if (y > 0) {
        for (let i = xl; i <= xr; i++) {
          const upIdx = (y - 1) * w + i;
          if (!wallMask[upIdx] && !visited[upIdx]) stack.push([i, y - 1]);
        }
      }
      if (y < h - 1) {
        for (let i = xl; i <= xr; i++) {
          const downIdx = (y + 1) * w + i;
          if (!wallMask[downIdx] && !visited[downIdx]) stack.push([i, y + 1]);
        }
      }
    }

    if (!filledPixels.length) return;

    state.fillHistory.push(fillCtx.getImageData(0, 0, CANVAS_RES, CANVAS_RES));
    if (state.fillHistory.length > 20) state.fillHistory.shift();

    const imgData = fillCtx.getImageData(0, 0, CANVAS_RES, CANVAS_RES);
    const rgb = hexToRgb(state.fillColor);
    for (const idx of filledPixels) {
      const p = idx * 4;
      imgData.data[p] = rgb.r;
      imgData.data[p + 1] = rgb.g;
      imgData.data[p + 2] = rgb.b;
      imgData.data[p + 3] = 255;
    }
    fillCtx.putImageData(imgData, 0, 0);
  }

  function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }

  let currentDecoStroke = null;
  ClassroomGuard.attachPalmRejection($('colorClickLayer'), {
    onStart(e) {
      if (workMode !== 'color') return;
      const p = stagePointToCanvas(e);
      if (colorTool === 'fill') {
        floodFillAt(p.x, p.y);
      } else {
        currentDecoStroke = { points: [p], _last: p, color: state.fillColor };
        state.decoStrokes.push(currentDecoStroke);
        redrawDeco();
      }
    },
    onMove(e) {
      if (workMode !== 'color' || colorTool !== 'pen' || !currentDecoStroke) return;
      const raw = stagePointToCanvas(e);
      const last = currentDecoStroke._last;
      const smoothed = {
        x: last.x + (raw.x - last.x) * SMOOTHING_ALPHA,
        y: last.y + (raw.y - last.y) * SMOOTHING_ALPHA
      };
      currentDecoStroke._last = smoothed;
      currentDecoStroke.points.push(smoothed);
      redrawDeco();
    },
    onEnd() { currentDecoStroke = null; }
  });

  /* ============ 7. 완성 & 제출 ============ */
  $('finishColorBtn').addEventListener('click', () => {
    ClassroomGuard.showModal('작품을 제출할까요?', [
      { label: '더 그릴래요', primary: false },
      { label: '제출하기', primary: true, onClick: submitArtwork }
    ]);
  });

  function submitArtwork() {
    const out = document.createElement('canvas');
    out.width = CANVAS_RES; out.height = CANVAS_RES;
    const octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, CANVAS_RES, CANVAS_RES);
    octx.drawImage(fillCanvas, 0, 0);
    octx.drawImage(lineArtCanvas, 0, 0);
    octx.drawImage(decoCanvas, 0, 0);

    out.toBlob((blob) => {
      showScreen('screen-done');
      $('doneThumb').src = URL.createObjectURL(blob);
      $('doneStatus').textContent = '제출 중이에요...';
      uploadToCloudinary(blob);
    }, 'image/png');
  }

  function uploadToCloudinary(blob) {
    const publicId = `${sanitize(state.studentName)}_${state.school}${state.classCode}_${sanitize(state.character.name)}_${timestampTag()}`;
    const form = new FormData();
    form.append('file', blob, publicId + '.png');
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    form.append('folder', CLOUDINARY_FOLDER);
    form.append('public_id', publicId);

    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form
    })
      .then((res) => {
        if (!res.ok) throw new Error('upload failed: ' + res.status);
        return res.json();
      })
      .then(() => {
        $('doneStatus').textContent = '✅ 제출 완료! 선생님께 잘 전달됐어요.';
      })
      .catch((err) => {
        console.error(err);
        $('doneStatus').textContent = '⚠️ 제출에 실패했어요. 선생님께 알려주세요.';
      });
  }

  $('redrawBtn').addEventListener('click', () => {
    showScreen('screen-work');
    startDrawing(state.character);
  });
  $('newCharBtn').addEventListener('click', () => {
    showScreen('screen-work');
    enterWorkspace(state.theme);
  });

})();
