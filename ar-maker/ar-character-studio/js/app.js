// app.js — glues the start / draw / AR screens together and owns the
// autosave-and-reset behaviour described in the spec:
//  - drawing progress is saved to localStorage as the student works
//  - if the page reloads mid-session, we resume right where they left off
//  - pressing "수업 시작하기" for a new student wipes the old data first

const GUIDES = [
  { id: 'cat', name: '고양이', src: 'assets/guides/cat.svg' },
  { id: 'dino', name: '공룡', src: 'assets/guides/dino.svg' },
  { id: 'robot', name: '로봇', src: 'assets/guides/robot.svg' }
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
      btn.innerHTML = `<img src="${g.src}" alt="${g.name}"><div>${g.name}</div>`;
      btn.addEventListener('click', () => {
        selectedGuideId = g.id;
        [...grid.children].forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
      });
      grid.appendChild(btn);
    });
  }

  function startNewSession() {
    const name = document.getElementById('input-name').value.trim() || '이름없음';
    const className = document.getElementById('input-class').value;

    ARStorage.clearAll(); // reset previous student's leftover data
    session = { name, className, guideId: selectedGuideId };
    ARStorage.saveSession(session);

    document.getElementById('draw-who-name').textContent = session.name;
    document.getElementById('draw-who-class').textContent = session.className;

    ArDraw.init({ guideSrc: guideById(session.guideId).src, onStrokeEndCb: autosaveDrawing });
    showScreen('screen-draw');
  }

  // ---------------- DRAW SCREEN ----------------
  function autosaveDrawing() {
    ARStorage.saveDrawing(ArDraw.getRawDrawDataURL());
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
      });
      row.appendChild(sw);
    });
  }

  function wireToolbar() {
    const toolRow = document.getElementById('tool-row');
    toolRow.querySelectorAll('.tool-btn[data-tool]').forEach((btn, i) => {
      if (i === 0) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentTool = btn.dataset.tool;
        ArDraw.setTool(currentTool);
        toolRow.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    document.getElementById('btn-undo').addEventListener('click', () => ArDraw.undo());

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
    document.getElementById('ar-who').textContent = `${session.name} · ${session.className}`;
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
    ARStorage.clearAll();
    session = null;
    document.getElementById('input-name').value = '';
    showScreen('screen-start');
  }

  // ---------------- PHOTO MODAL ----------------
  function wirePhotoModal() {
    const modal = document.getElementById('photo-modal');
    document.getElementById('btn-photo').addEventListener('click', () => {
      const dataURL = ArStage.capturePhoto();
      document.getElementById('photo-preview').src = dataURL;
      const dl = document.getElementById('btn-download-photo');
      dl.href = dataURL;
      const safeName = (session ? session.name : 'ar') + '_' + (session ? session.className : '');
      dl.download = `${safeName}_사진.png`;
      modal.classList.add('active');
    });
    document.getElementById('btn-retake').addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  // ---------------- RESUME ON RELOAD ----------------
  function tryResume() {
    const savedSession = ARStorage.loadSession();
    const savedDrawing = ARStorage.loadDrawing();
    if (!savedSession) return false;

    session = savedSession;
    selectedGuideId = session.guideId;
    document.getElementById('draw-who-name').textContent = session.name;
    document.getElementById('draw-who-class').textContent = session.className;

    ArDraw.init({ guideSrc: guideById(session.guideId).src, onStrokeEndCb: autosaveDrawing });
    if (savedDrawing) ArDraw.loadDrawingFromDataURL(savedDrawing);
    showScreen('screen-draw');
    return true;
  }

  function init() {
    buildGuideGrid();
    buildPalette();
    wireToolbar();
    wirePhotoModal();
    ArStage.init();

    document.getElementById('btn-start').addEventListener('click', startNewSession);
    document.getElementById('btn-alive').addEventListener('click', goAlive);
    document.getElementById('btn-restart-draw').addEventListener('click', resetToStart);
    document.getElementById('btn-restart-ar').addEventListener('click', resetToStart);
    document.getElementById('btn-back-to-draw').addEventListener('click', backToDraw);

    if (!tryResume()) {
      showScreen('screen-start');
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
