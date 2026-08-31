(function () {
  'use strict';

  console.log('[sea-draw] app.js build', '2026-08-07-v2 (step-guide fix + snap)');

  /* ============ 설정 ============ */
  const CLOUDINARY_CLOUD_NAME = 'qmbonapf';
  const CLOUDINARY_UPLOAD_PRESET = 'stickman';
  const CLOUDINARY_FOLDER = 'sea-draw-test';
  const CANVAS_RES = 900; // 내부 드로잉 해상도 (정사각형)
  const SMOOTHING_ALPHA = 0.6; // 손떨림 보정 강도 (1에 가까울수록 원본에 가깝고 지연 없음, 낮출수록 부드럽지만 지연 커짐)

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
        },
        {
          id: 'fish',
          name: '물고기',
          thumb: 'assets/fish/guide4.png',
          steps: [
            'assets/fish/delta1.png',
            'assets/fish/delta2.png',
            'assets/fish/delta3.png',
            'assets/fish/delta4.png'
          ]
        },
        {
          id: 'gaori',
          name: '가오리',
          thumb: 'assets/gaori/guide4.png',
          steps: [
            'assets/gaori/delta1.png',
            'assets/gaori/delta2.png',
            'assets/gaori/delta3.png',
            'assets/gaori/delta4.png'
          ]
        },
        {
          id: 'crab',
          name: '꽃게',
          thumb: 'assets/crab/guide4.png',
          steps: [
            'assets/crab/delta1.png',
            'assets/crab/delta2.png',
            'assets/crab/delta3.png',
            'assets/crab/delta4.png'
          ]
        },
        {
          id: 'seahorse',
          name: '해마',
          thumb: 'assets/seahorse/guide4.png',
          steps: [
            'assets/seahorse/delta1.png',
            'assets/seahorse/delta2.png',
            'assets/seahorse/delta3.png',
            'assets/seahorse/delta4.png'
          ]
        },
        {
          id: 'shrimp',
          name: '새우',
          thumb: 'assets/shrimp/guide4.png',
          steps: [
            'assets/shrimp/delta1.png',
            'assets/shrimp/delta2.png',
            'assets/shrimp/delta3.png',
            'assets/shrimp/delta4.png'
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

  /* ============ 퀴즈 데이터 (주제별, 10살 미만 눈높이) ============ */
  const QUIZ_DATA = {
    sea: [
      { type: 'ox', q: '물고기는 아가미로 숨을 쉬어요.', answer: true },
      { type: 'mc', q: '다음 중 바다에 사는 동물이 아닌 것은 무엇일까요?', options: ['문어', '가오리', '사자', '펭귄'], answerIndex: 2 },
      { type: 'ox', q: '가오리는 다리가 8개 달려있어요.', answer: false },
      { type: 'mc', q: '물고기가 헤엄칠 때 가장 많이 쓰는 몸의 부분은 무엇일까요?', options: ['지느러미', '손', '날개', '부리'], answerIndex: 0 },
      { type: 'ox', q: '펭귄은 하늘을 날 수 있는 새예요.', answer: false }
    ],
    ramen: [
      { type: 'ox', q: '라면 면은 밀가루로 만들어요.', answer: true },
      { type: 'mc', q: '다음 중 라면 토핑이 아닌 것은 무엇일까요?', options: ['삶은 계란', '대파', '양말', '단무지'], answerIndex: 2 },
      { type: 'ox', q: '라면은 끓는 물 없이도 바로 익힐 수 있어요.', answer: false },
      { type: 'mc', q: '라면을 끓일 때 가장 먼저 필요한 것은 무엇일까요?', options: ['물', '얼음', '우유', '주스'], answerIndex: 0 },
      { type: 'ox', q: '김치는 배추로 만드는 음식이에요.', answer: true }
    ],
    bingsu: [
      { type: 'ox', q: '빙수는 얼음을 갈아서 만들어요.', answer: true },
      { type: 'mc', q: '다음 중 빙수 토핑이 아닌 것은 무엇일까요?', options: ['팥', '딸기', '아이스크림', '브로콜리'], answerIndex: 3 },
      { type: 'ox', q: '빙수는 뜨거울 때 먹는 음식이에요.', answer: false },
      { type: 'mc', q: '팥빙수에서 "팥"은 무엇으로 만들까요?', options: ['콩', '쌀', '감자', '옥수수'], answerIndex: 0 },
      { type: 'ox', q: '연유는 우유로 만든 달콤한 재료예요.', answer: true }
    ],
    misc: []
  };

  /* ============ 상태 ============ */
  const state = {
    studentName: '',
    school: '',
    classCode: '',
    theme: 'sea',
    toppingProduct: null,       // 라면/빙수 만들기: 선택한 제품 {id, name}
    toppingGameStage: null,  // null | 'topping' | 'bowl'
    toppingSlots: [], // 2단계 프레임에 배정된 토핑들
    toppingResults: [], // 슬롯별로 완성된 토핑 이미지 (배경 투명)
    toppingCurrentSlotIndex: 0, // 지금 그리고 있는 토핑의 슬롯 번호
    toppingBowlImage: null,    // 3단계 완성본 (배경 투명, 제출/합치기/게임 공용)
    character: null,
    stepIndex: 0,
    stepStrokeStart: [0], // 각 단계가 시작될 때 strokes.length가 몇이었는지 기록 (되돌리기가 이전 단계로 넘어가야 할 때 사용)
    strokes: [],       // {size, points:[{x,y}], erase}
    decoStrokes: [],   // 색칠 단계에서 추가로 그린 선 {points:[{x,y}], color}
    brushSize: 10,
    fillColor: PALETTE[4],
    fillHistory: [],    // undo용 ImageData 스냅샷
    submittedCount: 0,  // 지금까지 제출한 그림 수
    playCredits: 0,     // 두더지 잡기 남은 연속 플레이 기회
    artworkGallery: []  // 제출한 완성작 이미지 URL 목록 (두더지로 등장)
  };

  let workMode = 'draw'; // 'draw' | 'color'
  let drawingEnabled = false;
  let eraserOn = false;
  let colorTool = 'fill'; // 'fill' | 'pen'
  let fillTolerance = 0; // 채우기 오차: 클수록 선을 살짝 넘어가며 더 넓게 채워짐
  let snapEnabled = true;
  let currentSnapGrid = null;
  const SNAP_CELL = 24;   // 스냅 인덱스 버킷 크기 (캔버스 좌표 기준)
  const SNAP_RADIUS = 62; // 서로 다른 부위 최소 간격(약 9px)을 감안해도 안전한 최댓값으로 데이터 기반 조정 (세면 38로 되돌릴 것)

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

    try {
      localStorage.setItem('sd_studentName', state.studentName);
      localStorage.setItem('sd_classFolder', state.school + state.classCode);
    } catch (err) {
      console.warn('[sea-draw] localStorage 저장 실패 (무시하고 계속 진행):', err);
    }

    enterWorkspace($('themeSelect').value);
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

  /* ============ 1-b. 퀴즈 ============ */
  let quizQuestions = [];
  let quizIndex = 0;
  let quizScore = 0;

  $('quizBtn').addEventListener('click', () => {
    const theme = $('themeSelect').value;
    const questions = QUIZ_DATA[theme] || [];
    if (!questions.length) {
      ClassroomGuard.showModal('이 주제는 아직 퀴즈가 준비되지 않았어요!', [{ label: '확인', primary: true }]);
      return;
    }
    quizQuestions = questions;
    quizIndex = 0;
    quizScore = 0;
    showScreen('screen-quiz');
    renderQuizQuestion();
  });

  function renderQuizExitButton(container) {
    const exitBtn = document.createElement('button');
    exitBtn.className = 'btn ghost full';
    exitBtn.textContent = '그만하고 나가기';
    exitBtn.addEventListener('click', () => showScreen('screen-entry'));
    container.appendChild(exitBtn);
  }

  function renderQuizQuestion() {
    const q = quizQuestions[quizIndex];
    $('quizProgress').textContent = `${quizIndex + 1} / ${quizQuestions.length} 문제`;

    const body = $('quizBody');
    body.innerHTML = '';
    const qEl = document.createElement('p');
    qEl.className = 'quiz-question';
    qEl.textContent = q.q;
    body.appendChild(qEl);

    const actions = $('quizActions');
    actions.innerHTML = '';
    renderQuizExitButton(actions);

    let answered = false;

    function handleAnswer(selectedBtn, isCorrect, correctBtn) {
      if (answered) return;
      answered = true;
      Array.from(optsWrap.children).forEach((b) => { b.disabled = true; });
      if (isCorrect) {
        selectedBtn.classList.add('correct');
        quizScore++;
      } else {
        selectedBtn.classList.add('wrong');
        if (correctBtn) correctBtn.classList.add('correct');
      }
      const fb = document.createElement('p');
      fb.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'wrong');
      fb.textContent = isCorrect ? '정답이에요! 참 잘했어요 🎉' : '아쉬워요! 다음엔 맞힐 수 있을 거예요 💪';
      body.appendChild(fb);

      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn coral full';
      nextBtn.textContent = (quizIndex < quizQuestions.length - 1) ? '다음 문제' : '결과 보기';
      nextBtn.addEventListener('click', () => {
        if (quizIndex < quizQuestions.length - 1) {
          quizIndex++;
          renderQuizQuestion();
        } else {
          renderQuizResult();
        }
      });
      actions.innerHTML = '';
      actions.appendChild(nextBtn);
      renderQuizExitButton(actions);
    }

    const optsWrap = document.createElement('div');

    if (q.type === 'ox') {
      optsWrap.className = 'quiz-options-ox';
      const oBtn = document.createElement('button');
      oBtn.className = 'quiz-option-btn ox';
      oBtn.textContent = '⭕';
      const xBtn = document.createElement('button');
      xBtn.className = 'quiz-option-btn ox';
      xBtn.textContent = '❌';
      const correctBtn = q.answer ? oBtn : xBtn;
      oBtn.addEventListener('click', () => handleAnswer(oBtn, q.answer === true, correctBtn));
      xBtn.addEventListener('click', () => handleAnswer(xBtn, q.answer === false, correctBtn));
      optsWrap.appendChild(oBtn);
      optsWrap.appendChild(xBtn);
    } else {
      optsWrap.className = 'quiz-options-mc';
      const buttons = q.options.map((optText, i) => {
        const b = document.createElement('button');
        b.className = 'quiz-option-btn';
        b.textContent = optText;
        optsWrap.appendChild(b);
        return b;
      });
      const correctBtn = buttons[q.answerIndex];
      buttons.forEach((b, i) => {
        b.addEventListener('click', () => handleAnswer(b, i === q.answerIndex, correctBtn));
      });
    }

    body.appendChild(optsWrap);
  }

  function renderQuizResult() {
    const body = $('quizBody');
    body.innerHTML = '';
    const total = quizQuestions.length;
    let emoji, msg;
    if (quizScore === total) { emoji = '🏆'; msg = '최고예요! 다 맞혔어요!'; }
    else if (quizScore >= Math.ceil(total / 2)) { emoji = '🎉'; msg = '잘했어요!'; }
    else { emoji = '💪'; msg = '좋아요, 다음에 더 잘할 수 있어요!'; }

    const e1 = document.createElement('div');
    e1.className = 'quiz-result-emoji';
    e1.textContent = emoji;
    const e2 = document.createElement('div');
    e2.className = 'quiz-result-score';
    e2.textContent = `${total}문제 중 ${quizScore}개 정답!`;
    const e3 = document.createElement('p');
    e3.className = 'quiz-feedback';
    e3.style.color = 'var(--sea-deep)';
    e3.textContent = msg;
    body.appendChild(e1);
    body.appendChild(e2);
    body.appendChild(e3);
    $('quizProgress').textContent = '결과';

    const actions = $('quizActions');
    actions.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn coral full';
    closeBtn.textContent = '처음으로 돌아가기';
    closeBtn.addEventListener('click', () => showScreen('screen-entry'));
    actions.appendChild(closeBtn);
  }

  /* ============ 2. 작업 화면 진입 (주제 -> 캐릭터) ============ */
  /* 바다생물 캐릭터 스냅 데이터는 용량이 있고 라면/빙수/기타 주제에서는 전혀 안 쓰이므로,
     '바다생물' 주제를 실제로 선택했을 때만 필요한 스크립트를 불러옴 (저사양 기기 최적화) */
  let seaSnapDataLoaded = false;
  function ensureSeaSnapDataLoaded(callback) {
    if (seaSnapDataLoaded || (window.SNAP_DATA && Object.keys(window.SNAP_DATA).length)) {
      seaSnapDataLoaded = true;
      callback();
      return;
    }
    const ids = ['penguin', 'fish', 'gaori', 'crab', 'seahorse', 'shrimp'];
    let remaining = ids.length;
    ids.forEach((id) => {
      const script = document.createElement('script');
      script.src = `assets/${id}/snap-data.js`;
      script.onload = script.onerror = () => {
        remaining--;
        if (remaining === 0) { seaSnapDataLoaded = true; callback(); }
      };
      document.head.appendChild(script);
    });
  }

  function enterWorkspace(themeKey) {
    state.theme = themeKey;

    if (TOPPING_THEMES[themeKey]) {
      enterToppingProductSelect();
      return;
    }

    if (themeKey === 'sea') {
      ClassroomGuard.showLoading('준비 중이에요...');
      ensureSeaSnapDataLoaded(() => {
        ClassroomGuard.hideLoading();
        enterCharacterWorkspace(themeKey);
      });
      return;
    }

    enterCharacterWorkspace(themeKey);
  }

  function enterCharacterWorkspace(themeKey) {
    const theme = THEMES[themeKey];
    renderPanelCharList(theme.characters);

    if (theme.characters.length) {
      $('emptyThemeMsg').style.display = 'none';
      $('canvasStage').style.display = 'block';
      startDrawing(theme.characters[0]);
    } else {
      $('emptyThemeMsg').style.display = 'block';
      $('canvasStage').style.display = 'none';
      drawToolbarEl.style.display = 'none';
      colorToolbarEl.style.display = 'none';
      $('stepIndicator').textContent = theme.label;
      workMode = 'draw';
      drawingEnabled = false;
    }
    showScreen('screen-work');
    requestAnimationFrame(sizeStageToViewport);
  }

  /* ============ 라면/빙수 만들기 (토핑+그릇+게임 공용 구조) ============
     테마별로 다른 데이터(제품 목록, 토핑 목록, 그릇 가이드 등)만 TOPPING_THEMES에 넣어두면
     나머지 화면·로직은 전부 공용으로 동작함. 새 주제를 추가할 때는 이 객체에 항목만 추가하면 됨. */
  const TOPPING_THEMES = {
    ramen: {
      label: '라면',
      selectTitle: '🍜 어떤 라면을 좋아하나요?',
      selectSub: '좋아하는 라면을 하나 골라주세요',
      gameEmoji: '🍜',
      products: [
        { id: 'shin', name: '신라면', photo: 'assets/ramen/photos/shin.jpg' },
        { id: 'chapagetti', name: '짜파게티', photo: 'assets/ramen/photos/chapagetti.jpg' },
        { id: 'snackmyun', name: '스낵면', photo: 'assets/ramen/photos/snackmyun.jpg' },
        { id: 'buldak', name: '불닭볶음면', photo: 'assets/ramen/photos/buldak.jpg' },
        { id: 'tuigim-udon', name: '튀김우동', photo: 'assets/ramen/photos/tuigim-udon.jpg' },
        { id: 'chamkke', name: '참깨라면', photo: 'assets/ramen/photos/chamkke.jpg' },
        { id: 'paldo-bibim', name: '팔도비빔면', photo: 'assets/ramen/photos/paldo-bibim.jpg' },
        { id: 'neoguri', name: '너구리', photo: 'assets/ramen/photos/neoguri.jpg' },
        { id: 'anseong', name: '안성탕면', photo: 'assets/ramen/photos/anseong.jpg' },
        { id: 'jin', name: '진라면', photo: 'assets/ramen/photos/jin.jpg' }
      ],
      toppings: [
        { id: 'mandu', name: '만두', guide: 'assets/ramen/topping-mandu.png' },
        { id: 'cheese', name: '슬라이스 치즈', guide: 'assets/ramen/topping-cheese.png' },
        { id: 'tteok', name: '떡', guide: 'assets/ramen/topping-tteok.png' },
        { id: 'egg', name: '삶은 계란', guide: 'assets/ramen/topping-egg.png' },
        { id: 'daepa', name: '대파', guide: 'assets/ramen/topping-daepa.png' },
        { id: 'danmuji', name: '단무지', guide: 'assets/ramen/topping-danmuji.png' },
        { id: 'bacon', name: '베이컨', guide: 'assets/ramen/topping-bacon.png' },
        { id: 'kimchi', name: '김치', guide: 'assets/ramen/topping-kimchi.png' }
      ],
      bowlGuide: 'assets/ramen/bowl.png',
      // 토핑이 그릇 속 면발 위에 자연스럽게 놓이도록, bowl.png에서 눈으로 잡아둔 "그릇 안쪽" 기준 사각형 (0~1 비율)
      bowlOpening: { left: 0.08, top: 0.24, right: 0.86, bottom: 0.61 },
      decoyItems: [
        { emoji: '🧦', name: '양말' },
        { emoji: '🥦', name: '브로콜리' },
        { emoji: '🫚', name: '인삼' }
      ]
    },
    bingsu: {
      label: '빙수',
      selectTitle: '🍧 어떤 빙수를 좋아하나요?',
      selectSub: '좋아하는 빙수를 하나 골라주세요',
      gameEmoji: '🍧',
      products: [
        { id: 'patbingsu', name: '팥빙수', photo: null },
        { id: 'fruitbingsu', name: '과일빙수', photo: null }
      ],
      toppings: [
        { id: 'pat', name: '팥', guide: null },
        { id: 'injeolmi', name: '인절미', guide: null },
        { id: 'strawberry', name: '딸기', guide: null },
        { id: 'icecream', name: '아이스크림', guide: null },
        { id: 'condensedmilk', name: '연유', guide: null },
        { id: 'pocky', name: '막대과자', guide: null },
        { id: 'chocolate', name: '초콜릿', guide: null },
        { id: 'chocosyrup', name: '초코시럽', guide: null }
      ],
      bowlGuide: null, // 아직 가이드 이미지 도착 전
      bowlOpening: { left: 0.08, top: 0.24, right: 0.86, bottom: 0.61 }, // 실제 그릇 이미지 받으면 다시 조정
      decoyItems: [
        { emoji: '🧦', name: '양말' },
        { emoji: '🥦', name: '브로콜리' },
        { emoji: '🍎', name: '사과' }
      ]
    }
  };

  function currentToppingTheme() { return TOPPING_THEMES[state.theme]; }

  const TOPPING_FRAME_COUNT = 4;

  /* ---- 1단계: 제품(라면/빙수) 고르기 ---- */
  function enterToppingProductSelect() {
    const theme = currentToppingTheme();
    $('toppingProductTitle').textContent = theme.selectTitle;
    $('toppingProductSub').textContent = theme.selectSub;
    const grid = $('toppingProductGrid');
    grid.innerHTML = '';
    theme.products.forEach((product) => {
      const card = document.createElement('div');
      card.className = 'topping-product-card';
      card.innerHTML = product.photo
        ? `<img src="${product.photo}" alt=""><span>${product.name}</span>`
        : `<span class="emoji">${theme.gameEmoji}</span><span>${product.name}</span>`;
      card.addEventListener('click', () => selectToppingProduct(product));
      grid.appendChild(card);
    });
    showScreen('screen-topping-product');
  }

  function selectToppingProduct(product) {
    state.toppingProduct = product;
    state.toppingSlots = new Array(TOPPING_FRAME_COUNT).fill(null);
    state.toppingGameStage = null;
    enterToppingFrames();
  }

  $('toppingProductBackBtn').addEventListener('click', () => showScreen('screen-entry'));

  /* ---- 2단계: 토핑 프레임 고르기 ---- */
  function enterToppingFrames() {
    $('toppingFramesTitle').textContent = `${currentToppingTheme().gameEmoji} 토핑을 골라 그려요`;
    renderToppingFrameGrid();
    showScreen('screen-topping-frames');
  }

  function renderToppingFrameGrid() {
    const grid = $('toppingFrameGrid');
    grid.innerHTML = '';
    state.toppingSlots.forEach((slot, i) => {
      const cell = document.createElement('div');
      cell.className = 'topping-frame-slot' + (slot ? ' filled' : '');
      cell.innerHTML = slot
        ? `<img src="${slot.guide}" alt=""><span class="slot-label">${slot.name}</span>`
        : `<span class="plus">+</span>`;
      cell.addEventListener('click', () => openToppingPicker(i));
      grid.appendChild(cell);
    });
  }

  function openToppingPicker(slotIndex) {
    const overlay = $('toppingPickerOverlay');
    const optGrid = $('toppingOptionGrid');
    optGrid.innerHTML = '';
    currentToppingTheme().toppings.forEach((t) => {
      const opt = document.createElement('div');
      const ready = !!t.guide;
      opt.className = 'topping-option' + (ready ? '' : ' pending');
      opt.innerHTML = ready
        ? `<img src="${t.guide}" alt=""><span>${t.name}</span>`
        : `<span class="pending-badge">준비중</span><span>${t.name}</span>`;
      if (ready) {
        opt.addEventListener('click', () => {
          state.toppingSlots[slotIndex] = t;
          overlay.classList.remove('show');
          renderToppingFrameGrid();
        });
      }
      optGrid.appendChild(opt);
    });
    const clearOpt = document.createElement('div');
    clearOpt.className = 'topping-option clear';
    clearOpt.innerHTML = `<span style="font-size:26px;">✕</span><span>비우기</span>`;
    clearOpt.addEventListener('click', () => {
      state.toppingSlots[slotIndex] = null;
      overlay.classList.remove('show');
      renderToppingFrameGrid();
    });
    optGrid.appendChild(clearOpt);
    overlay.classList.add('show');
  }

  $('toppingPickerOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'toppingPickerOverlay') e.currentTarget.classList.remove('show');
  });

  $('toppingFramesBackBtn').addEventListener('click', () => showScreen('screen-topping-product'));

  $('toppingFramesNextBtn').addEventListener('click', () => {
    const filledIndexes = state.toppingSlots
      .map((s, i) => (s ? i : -1))
      .filter((i) => i !== -1);
    if (!filledIndexes.length) {
      ClassroomGuard.showModal('토핑을 하나 이상 골라주세요!', [{ label: '확인', primary: true }]);
      return;
    }
    state.toppingResults = new Array(state.toppingSlots.length).fill(null);
    startToppingDrawing(filledIndexes[0]);
  });

  // 토핑 하나를 캔버스 전체에 꽉 채운 가이드로 만듦 (한 번에 하나씩 그리기)
  function composeSingleToppingGuide(topping) {
    const off = document.createElement('canvas');
    off.width = CANVAS_RES; off.height = CANVAS_RES;
    const ctx = off.getContext('2d');
    const pad = CANVAS_RES * 0.1;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const avail = CANVAS_RES - pad * 2;
        const scale = Math.min(avail / img.width, avail / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        const dx = (CANVAS_RES - dw) / 2, dy = (CANVAS_RES - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        resolve(off.toDataURL('image/png'));
      };
      img.src = topping.guide;
    });
  }

  function toppingFilledIndexes() {
    return state.toppingSlots.map((s, i) => (s ? i : -1)).filter((i) => i !== -1);
  }

  async function startToppingDrawing(slotIndex) {
    state.toppingCurrentSlotIndex = slotIndex;
    const topping = state.toppingSlots[slotIndex];
    ClassroomGuard.showLoading('토핑 준비 중이에요...');
    const guideDataURL = await composeSingleToppingGuide(topping);
    ClassroomGuard.hideLoading();
    const syntheticChar = { id: 'topping-' + state.theme + '-' + topping.id, name: topping.name, steps: [guideDataURL] };
    state.toppingGameStage = 'topping';
    startDrawing(syntheticChar);
    const filled = toppingFilledIndexes();
    const order = filled.indexOf(slotIndex) + 1;
    $('stepIndicator').textContent = `🍜 토핑 그리기 (${order}/${filled.length}) · ${topping.name}`;
    showScreen('screen-work');
  }

  /* ---- 3단계: 그릇 채색하기 (제공된 라인드로잉을 바로 채색, 따라그리기 단계 없음) ---- */
  function enterToppingBowlColoring() {
    const theme = currentToppingTheme();
    if (!theme.bowlGuide) {
      ClassroomGuard.showModal(`${theme.label} 그릇 이미지가 아직 준비되지 않았어요. 선생님께 말씀드려 주세요!`, [
        { label: '확인', primary: true, onClick: () => showScreen('screen-entry') }
      ]);
      return;
    }
    state.toppingGameStage = 'bowl';
    workMode = 'color';
    drawingEnabled = false;
    closeAllPopovers();
    resetStageZoom();
    fillTolerance = 0;
    $('fillToleranceSlider').value = '0';
    $('fillToleranceValue').textContent = '0';

    const img = new Image();
    img.onload = () => {
      lineArtCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
      lineArtCtx.drawImage(img, 0, 0, CANVAS_RES, CANVAS_RES);
      rebuildWallMask();
    };
    img.src = theme.bowlGuide;

    fillCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    state.fillHistory = [];
    state.decoStrokes = [];
    decoCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    setColorTool('fill');

    guideImg.style.display = 'none';
    drawCanvas.style.display = 'none';
    lineArtCanvas.style.display = 'block';
    fillCanvas.style.display = 'block';
    decoCanvas.style.display = 'block';
    $('colorClickLayer').style.display = 'block';
    drawToolbarEl.style.display = 'none';
    colorToolbarEl.style.display = 'flex';
    $('backToDrawBtn').style.display = 'none'; // 그릇은 따라그리기 단계가 없어서 "돌아가기"가 의미 없음

    $('stepIndicator').textContent = '🍜 그릇 채색하기';
    renderPalette();
    showScreen('screen-work');
  }

  /* ---- 2·3단계 완성 처리 ---- */
  function finishToppingGameStage() {
    if (state.toppingGameStage === 'topping') {
      const out = document.createElement('canvas');
      out.width = CANVAS_RES; out.height = CANVAS_RES;
      const octx = out.getContext('2d');
      octx.drawImage(fillCanvas, 0, 0);
      octx.drawImage(lineArtCanvas, 0, 0);
      octx.drawImage(decoCanvas, 0, 0);
      out.toBlob((blob) => {
        state.toppingResults[state.toppingCurrentSlotIndex] = URL.createObjectURL(blob);
        const filled = toppingFilledIndexes();
        const pos = filled.indexOf(state.toppingCurrentSlotIndex);
        if (pos < filled.length - 1) {
          startToppingDrawing(filled[pos + 1]); // 다음 토핑으로
        } else {
          enterToppingBowlColoring(); // 토핑 다 그렸으면 그릇 채색으로
        }
      }, 'image/png');
    } else if (state.toppingGameStage === 'bowl') {
      // 배경 투명 버전 하나만 만들어서 제출용/게임용 둘 다 같이 사용
      const out = document.createElement('canvas');
      out.width = CANVAS_RES; out.height = CANVAS_RES;
      const octx = out.getContext('2d');
      octx.drawImage(fillCanvas, 0, 0);
      octx.drawImage(lineArtCanvas, 0, 0);

      out.toBlob((blob) => {
        state.toppingBowlImage = URL.createObjectURL(blob);
        showToppingCombineScreen();
      }, 'image/png');
    }
  }

  /* ---- 4단계: 합치기 & 제출 ----
     각 토핑의 완성본을 프레임 슬롯 위치(2x2)에 맞춰 그릇 안쪽 사각형에 배치함 */
  function showToppingCombineScreen() {
    const theme = currentToppingTheme();
    $('toppingCombineTitle').textContent = `${theme.gameEmoji} ${theme.label} 완성!`;
    const bowlOpening = theme.bowlOpening;
    const canvas = $('toppingCombineCanvas');
    canvas.width = CANVAS_RES; canvas.height = CANVAS_RES;
    const ctx = canvas.getContext('2d');
    const rect = {
      left: bowlOpening.left * CANVAS_RES,
      top: bowlOpening.top * CANVAS_RES,
      right: bowlOpening.right * CANVAS_RES,
      bottom: bowlOpening.bottom * CANVAS_RES
    };
    const cellW = (rect.right - rect.left) / 2, cellH = (rect.bottom - rect.top) / 2;

    const bowlImg = new Image();
    bowlImg.onload = () => {
      ctx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
      ctx.drawImage(bowlImg, 0, 0, CANVAS_RES, CANVAS_RES);

      const toppingResults = state.toppingResults
        .map((url, i) => (url ? { url, i } : null))
        .filter((x) => x);
      let loaded = 0;
      if (!toppingResults.length) return;
      toppingResults.forEach(({ url, i }) => {
        const img = new Image();
        img.onload = () => {
          const col = i % 2, row = Math.floor(i / 2);
          const cx = rect.left + col * cellW, cy = rect.top + row * cellH;
          ctx.drawImage(img, cx, cy, cellW, cellH);
          loaded++;
        };
        img.src = url;
      });
    };
    bowlImg.src = state.toppingBowlImage;
    $('toppingSubmitStatus').textContent = '';
    showScreen('screen-topping-combine');
  }

  $('toppingSubmitBtn').addEventListener('click', () => {
    ClassroomGuard.showModal('작품을 제출할까요?', [
      { label: '더 그릴래요', primary: false },
      { label: '제출하기', primary: true, onClick: submitToppingArtwork }
    ]);
  });

  function submitToppingArtwork() {
    $('toppingCombineCanvas').toBlob((blob) => {
      $('toppingSubmitStatus').textContent = '제출 중이에요...';
      const publicId = `${sanitize(state.studentName)}_${state.school}${state.classCode}_${sanitize(state.toppingProduct.name)}_${timestampTag()}`;
      const form = new FormData();
      form.append('file', blob, publicId + '.png');
      form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      form.append('folder', CLOUDINARY_FOLDER);
      form.append('public_id', publicId);
      fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form })
        .then((res) => { if (!res.ok) throw new Error('upload failed: ' + res.status); return res.json(); })
        .then(() => { $('toppingSubmitStatus').textContent = '✅ 제출 완료! 선생님께 잘 전달됐어요.'; })
        .catch((err) => {
          console.error(err);
          $('toppingSubmitStatus').textContent = '⚠️ 제출에 실패했어요. 선생님께 알려주세요.';
        });
    }, 'image/png');
  }

  $('toppingRedoBtn').addEventListener('click', () => {
    state.toppingSlots = new Array(TOPPING_FRAME_COUNT).fill(null);
    state.toppingGameStage = null;
    enterToppingFrames();
  });

  /* ============ 5단계: 미니게임 - 토핑 받기 ============ */
  const TOPPING_GAME_SECONDS = 30;
  const TOPPING_SPAWN_START_MS = 1300; // 라운드 시작 시 등장 간격
  const TOPPING_SPAWN_END_MS = 700;    // 라운드 막바지 (점점 빨라짐)
  const TOPPING_FALL_SPEED_START = 130; // px/초, 라운드 시작
  const TOPPING_FALL_SPEED_END = 260;   // px/초, 라운드 막바지 (점점 빨라짐)
  const TOPPING_GAME_CATCH_RANGE = 13;  // 그릇 중심 기준 허용 범위 (% 단위)
  const TOPPING_CORRECT_SCORE = 30;
  const TOPPING_WRONG_PENALTY = 20;

  const toppingGameFieldEl = $('toppingGameField');
  const toppingGameBowlWrapEl = $('toppingGameBowlWrap');
  const toppingGameBowlEl = $('toppingGameBowl');
  const toppingGameBowlToppingsEl = $('toppingGameBowlToppings');
  let toppingGameActive = false;
  let toppingGameScore = 0;
  let toppingGameTimeLeft = TOPPING_GAME_SECONDS;
  let toppingGameSpawnTimer = null;
  let toppingGameCountdownTimer = null;
  let toppingGameRafId = null;
  let toppingGameLastFrameTime = null;
  let toppingGameFallingItems = [];
  let toppingGameBowlX = 50; // 필드 폭 기준 % 위치
  let toppingGameDragging = false;
  let toppingBowlCounts = new Map(); // url -> { wrapEl, countEl, count } (받은 토핑별 개수 표시용)
  let toppingGameCredits = 2; // 연속 플레이 남은 기회

  function toppingGameRoundProgress() { return Math.min(1, Math.max(0, 1 - toppingGameTimeLeft / TOPPING_GAME_SECONDS)); }
  function toppingGameCurrentSpawnMs() { return lerp(TOPPING_SPAWN_START_MS, TOPPING_SPAWN_END_MS, toppingGameRoundProgress()); }
  function toppingGameCurrentFallSpeed() { return lerp(TOPPING_FALL_SPEED_START, TOPPING_FALL_SPEED_END, toppingGameRoundProgress()); }

  function toppingGameSetBowlX(percent) {
    toppingGameBowlX = Math.min(92, Math.max(8, percent));
    toppingGameBowlWrapEl.style.left = toppingGameBowlX + '%';
  }
  function toppingGameFieldPointerToPercent(e) {
    const rect = toppingGameFieldEl.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * 100;
  }
  toppingGameFieldEl.addEventListener('pointerdown', (e) => {
    toppingGameDragging = true;
    toppingGameSetBowlX(toppingGameFieldPointerToPercent(e));
  });
  toppingGameFieldEl.addEventListener('pointermove', (e) => {
    if (!toppingGameDragging) return;
    toppingGameSetBowlX(toppingGameFieldPointerToPercent(e));
  });
  window.addEventListener('pointerup', () => { toppingGameDragging = false; });
  window.addEventListener('pointercancel', () => { toppingGameDragging = false; });

  function spawnToppingGameItem() {
    const drawnToppings = state.toppingResults.filter((r) => r);
    // 그린 토핑이 없으면 전부 오답 아이템으로 대체 (게임이 진행은 되도록)
    const useDecoy = !drawnToppings.length || Math.random() < 0.28;
    const el = document.createElement('div');
    el.className = 'topping-falling-item';
    let isCorrect, correctUrl = null;
    if (useDecoy) {
      const decoyItems = currentToppingTheme().decoyItems;
      const decoy = decoyItems[Math.floor(Math.random() * decoyItems.length)];
      el.textContent = decoy.emoji;
      isCorrect = false;
    } else {
      const url = drawnToppings[Math.floor(Math.random() * drawnToppings.length)];
      el.innerHTML = `<img src="${url}" alt="">`;
      isCorrect = true;
      correctUrl = url;
    }
    const xPercent = 10 + Math.random() * 80;
    el.style.left = xPercent + '%';
    el.style.top = '-70px';
    toppingGameFieldEl.appendChild(el);
    toppingGameFallingItems.push({ el, x: xPercent, y: -70, correct: isCorrect, url: correctUrl, done: false });
  }

  function addCaughtToppingToBowl(url) {
    if (toppingBowlCounts.has(url)) {
      const entry = toppingBowlCounts.get(url);
      entry.count++;
      entry.countEl.textContent = '×' + entry.count;
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'topping-bowl-item';
      const img = document.createElement('img');
      img.src = url;
      const countEl = document.createElement('span');
      countEl.className = 'topping-bowl-count';
      countEl.textContent = '×1';
      wrap.appendChild(img);
      wrap.appendChild(countEl);
      toppingGameBowlToppingsEl.appendChild(wrap);
      toppingBowlCounts.set(url, { wrapEl: wrap, countEl, count: 1 });
    }
  }

  function showToppingScorePopup(text, positive) {
    const popup = document.createElement('div');
    popup.className = 'topping-score-popup' + (positive ? '' : ' negative');
    popup.textContent = text;
    toppingGameBowlWrapEl.appendChild(popup);
    setTimeout(() => popup.remove(), 700);
  }

  function toppingGameLoop(ts) {
    if (!toppingGameActive) return;
    if (toppingGameLastFrameTime === null) toppingGameLastFrameTime = ts;
    const dt = (ts - toppingGameLastFrameTime) / 1000;
    toppingGameLastFrameTime = ts;

    const fieldRect = toppingGameFieldEl.getBoundingClientRect();
    const bowlRect = toppingGameBowlWrapEl.getBoundingClientRect();
    // 그릇 이미지 위쪽에서 살짝 아래(테두리/입구 부근)를 "그릇 중심"으로 잡음
    const bowlRimY = (bowlRect.top - fieldRect.top) + bowlRect.height * 0.22;
    const catchWindowTop = bowlRimY - 16;
    const catchWindowBottom = bowlRimY + 34;
    const fallSpeed = toppingGameCurrentFallSpeed();

    toppingGameFallingItems.forEach((item) => {
      if (item.done) return;
      item.y += fallSpeed * dt;
      item.el.style.top = item.y + 'px';

      if (item.y >= catchWindowTop && !item.done) {
        const dx = Math.abs(item.x - toppingGameBowlX);
        if (item.y <= catchWindowBottom && dx < TOPPING_GAME_CATCH_RANGE) {
          item.done = true;
          if (item.correct) {
            toppingGameScore += TOPPING_CORRECT_SCORE;
            item.el.classList.add('caught');
            addCaughtToppingToBowl(item.url);
            showToppingScorePopup('+' + TOPPING_CORRECT_SCORE, true);
          } else {
            toppingGameScore = Math.max(0, toppingGameScore - TOPPING_WRONG_PENALTY);
            item.el.classList.add('caught', 'wrong');
            showToppingScorePopup('-' + TOPPING_WRONG_PENALTY, false);
          }
          $('toppingGameScore').textContent = String(toppingGameScore);
          setTimeout(() => item.el.remove(), 220);
        } else if (item.y > catchWindowBottom + 20) {
          // 그릇 중심 범위를 그냥 지나쳐버림 (놓침) - 바닥까지 갈 필요 없이 바로 처리
          item.done = true;
          item.el.remove();
        }
      }
    });
    toppingGameFallingItems = toppingGameFallingItems.filter((item) => !item.done || item.el.isConnected);

    toppingGameRafId = requestAnimationFrame(toppingGameLoop);
  }

  function scheduleNextToppingSpawn() {
    toppingGameSpawnTimer = setTimeout(() => {
      spawnToppingGameItem();
      if (toppingGameActive) scheduleNextToppingSpawn();
    }, toppingGameCurrentSpawnMs());
  }

  function stopToppingGameTimers() {
    toppingGameActive = false;
    if (toppingGameSpawnTimer) clearTimeout(toppingGameSpawnTimer);
    if (toppingGameCountdownTimer) clearInterval(toppingGameCountdownTimer);
    if (toppingGameRafId) cancelAnimationFrame(toppingGameRafId);
    toppingGameSpawnTimer = null;
    toppingGameCountdownTimer = null;
    toppingGameRafId = null;
    toppingGameLastFrameTime = null;
    toppingGameFallingItems.forEach((item) => item.el.remove());
    toppingGameFallingItems = [];
  }

  function startToppingGameRound() {
    toppingGameScore = 0;
    toppingGameTimeLeft = TOPPING_GAME_SECONDS;
    toppingGameCredits = Math.max(0, toppingGameCredits - 1); // 시작하는 즉시 이번 판을 차감
    toppingBowlCounts = new Map();
    toppingGameBowlToppingsEl.innerHTML = '';
    $('toppingGameScore').textContent = '0';
    $('toppingGameTimer').textContent = String(toppingGameTimeLeft);
    $('toppingGameCredits').textContent = String(toppingGameCredits);
    $('toppingGameOverlay').classList.add('hidden');
    toppingGameSetBowlX(50);
    toppingGameActive = true;

    scheduleNextToppingSpawn();
    toppingGameCountdownTimer = setInterval(() => {
      toppingGameTimeLeft--;
      $('toppingGameTimer').textContent = String(toppingGameTimeLeft);
      if (toppingGameTimeLeft <= 0) endToppingGameRound();
    }, 1000);
    toppingGameRafId = requestAnimationFrame(toppingGameLoop);
  }

  function endToppingGameRound() {
    stopToppingGameTimers();
    $('toppingGameOverlay').classList.remove('hidden');
    $('toppingGameOverlayTitle').textContent = '게임 끝! 🎉';
    $('toppingGameOverlayDesc').textContent = `${toppingGameScore}점을 획득했어요!`;
    const actions = $('toppingGameOverlayActions');
    actions.innerHTML = '';
    if (toppingGameCredits > 0) {
      const again = document.createElement('button');
      again.className = 'btn coral full';
      again.textContent = `다시 하기 (남은 기회 ${toppingGameCredits})`;
      again.addEventListener('click', startToppingGameRound);
      actions.appendChild(again);
    } else {
      const done = document.createElement('button');
      done.className = 'btn coral full';
      done.textContent = '✏️ 그림 그리러 가기';
      done.addEventListener('click', () => {
        stopToppingGameTimers();
        enterToppingFrames();
      });
      actions.appendChild(done);
    }
  }

  $('toppingGameEntryBtn').addEventListener('click', () => {
    if (!state.toppingBowlImage) {
      ClassroomGuard.showModal('먼저 그릇을 완성해주세요!', [{ label: '확인', primary: true }]);
      return;
    }
    toppingGameBowlEl.src = state.toppingBowlImage;
    toppingGameCredits = 2; // 게임에 새로 들어올 때마다 연속 2번 기회로 초기화
    showScreen('screen-topping-game');

    $('toppingGameOverlay').classList.remove('hidden');
    $('toppingGameOverlayTitle').textContent = '토핑 받기';
    const decoyNames = currentToppingTheme().decoyItems.map((d) => d.name).join('·');
    $('toppingGameOverlayDesc').textContent = `그릇을 손가락으로 움직여서 내가 그린 토핑을 받아요! ${decoyNames}이 떨어지면 피하세요.`;
    const actions = $('toppingGameOverlayActions');
    actions.innerHTML = '';
    const startBtn = document.createElement('button');
    startBtn.className = 'btn coral full';
    startBtn.textContent = '시작하기';
    startBtn.addEventListener('click', startToppingGameRound);
    actions.appendChild(startBtn);
  });

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

  /* ============ 3. 상단 툴바 (선 그리기 / 색칠 단계별로 전환) ============ */
  const drawToolbarEl = $('drawToolbar');
  const colorToolbarEl = $('colorToolbar');

  /* ---- 상단 툴바 팝오버 (동물 고르기 / 펜 굵기 / 채우기 색 고르기) ---- */
  function closeAllPopovers() {
    document.querySelectorAll('.icon-popover.show').forEach((p) => p.classList.remove('show'));
  }
  function togglePopover(popoverEl) {
    const wasOpen = popoverEl.classList.contains('show');
    closeAllPopovers();
    if (!wasOpen) popoverEl.classList.add('show');
  }
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.icon-btn-wrap')) closeAllPopovers();
  });

  $('charPickerBtn').addEventListener('click', () => togglePopover($('charPickerPopover')));

  let penSizeLongPressTimer = null;
  const penSizeBtn = $('penSizeBtn');
  penSizeBtn.addEventListener('pointerdown', () => {
    penSizeLongPressTimer = setTimeout(() => togglePopover($('penSizePopover')), 420);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
    penSizeBtn.addEventListener(evt, () => { if (penSizeLongPressTimer) clearTimeout(penSizeLongPressTimer); });
  });

  function syncPenDotIcon() {
    const d = Math.max(8, Math.min(20, state.brushSize));
    const dot = $('penDotIcon');
    dot.style.width = d + 'px';
    dot.style.height = d + 'px';
  }

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

  /* ---- 가이드 스냅: 빌드 타임에 미리 계산해둔 좌표(snap-data.js)를
         버킷 그리드로 인덱싱해서 가까이 그릴 때 살짝 끌어당기는 방식
         (런타임에 이미지를 다시 읽지 않으므로 캔버스/타이밍 이슈에서 자유로움) ---- */
  function buildSnapIndexFromPoints(flatPoints) {
    const grid = new Map();
    if (!flatPoints || !flatPoints.length) return grid;
    for (let i = 0; i < flatPoints.length; i += 2) {
      const x = flatPoints[i], y = flatPoints[i + 1];
      const key = Math.floor(x / SNAP_CELL) + ',' + Math.floor(y / SNAP_CELL);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ x, y });
    }
    return grid;
  }

  function loadSnapGridForStep(character, stepIndex) {
    const charData = window.SNAP_DATA && window.SNAP_DATA[character.id];
    const flat = charData ? charData[stepIndex + 1] : null; // 데이터는 1-based 단계 번호로 저장됨
    currentSnapGrid = buildSnapIndexFromPoints(flat);
    console.log('[sea-draw] snap grid for step', stepIndex + 1, '=', currentSnapGrid.size, 'buckets');
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
      const pull = (1 - dist / SNAP_RADIUS) * 0.97; // 가까울수록 강하게, 최대 97%까지 끌어당김 (세면 0.8로 되돌릴 것)
      return { x: p.x + (best.x - p.x) * pull, y: p.y + (best.y - p.y) * pull };
    }
    return p;
  }

  $('snapBtn').addEventListener('click', () => {
    snapEnabled = !snapEnabled;
    $('snapBtn').classList.toggle('on', snapEnabled);
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
      syncPenDotIcon();
      closeAllPopovers();
    });
  });

  /* ---- 그리기 / 지우개 (서로 배타적으로 선택) ---- */
  const drawToolButtons = { pen: $('penDrawBtn'), erase: $('eraserBtn') };
  function setDrawTool(tool) {
    eraserOn = (tool === 'erase');
    Object.keys(drawToolButtons).forEach((key) => drawToolButtons[key].classList.toggle('on', key === tool));
  }
  drawToolButtons.pen.addEventListener('click', () => setDrawTool('pen'));
  drawToolButtons.erase.addEventListener('click', () => setDrawTool('erase'));

  /* ---- 선 그리기 단계 되돌리기: 되돌리다가 이전 단계 영역까지 넘어가면 가이드도 그 단계로 같이 되돌림 ---- */
  $('drawUndoBtn').addEventListener('click', () => {
    if (workMode !== 'draw' || !state.strokes.length) return;
    state.strokes.pop();
    while (state.stepIndex > 0 && state.strokes.length < state.stepStrokeStart[state.stepIndex]) {
      state.stepIndex--;
    }
    redrawStrokes();
    loadStepGuide();
  });

  /* ---- 다시그리기 ---- */
  /* ---- 색칠 단계 전용 되돌리기 (사이드 패널에만 있어서 선 그리기 단계와는 무관함) ---- */
  $('colorUndoBtn').addEventListener('click', () => {
    if (workMode !== 'color') return;
    if (colorTool === 'pen') {
      state.decoStrokes.pop();
      redrawDeco();
      rebuildWallMask();
    } else {
      const last = state.fillHistory.pop();
      restoreFillSnapshot(last);
    }
  });
  $('resetBtn').addEventListener('click', () => {
    ClassroomGuard.showModal('처음부터 다시 그릴까요? 지금까지 그린 내용이 지워져요.', [
      { label: '취소', primary: false },
      { label: '다시 그리기', primary: true, onClick: () => {
        if (workMode === 'draw') {
          state.strokes = [];
          state.stepIndex = 0; // 전체 지우기는 1단계로 완전히 되돌아감
          state.stepStrokeStart = [0];
          redrawStrokes();
          loadStepGuide();
        } else if (workMode === 'color') {
          fillCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
          state.fillHistory = [];
          state.decoStrokes = [];
          redrawDeco();
          rebuildWallMask();
        }
      }}
    ]);
  });

  /* ============ 5. 단계별 따라그리기 ============ */
  function startDrawing(character) {
    state.character = character;
    state.stepIndex = 0;
    state.strokes = [];
    state.stepStrokeStart = [0];
    state.fillHistory = [];
    setDrawTool('pen');
    snapEnabled = true;
    $('snapBtn').classList.add('on');
    workMode = 'draw';
    closeAllPopovers();
    syncPenDotIcon();
    resetStageZoom();
    // 라면 토핑 그리기는 동물 고르기 버튼이 필요 없음
    $('charPickerBtn').closest('.icon-btn-wrap').style.display = TOPPING_THEMES[state.theme] ? 'none' : '';

    colorToolbarEl.style.display = 'none';
    drawToolbarEl.style.display = 'flex';
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
    const basePath = state.character.steps[state.stepIndex];
    const stepIndexAtCall = state.stepIndex;
    const characterAtCall = state.character;
    let attempts = 0;

    function tryLoadGuide() {
      attempts++;
      guideImg.onerror = () => {
        console.warn('[sea-draw] 가이드 이미지 로드 실패 (시도 ' + attempts + '):', basePath);
        // 그 사이에 사용자가 다른 단계/캐릭터로 넘어갔다면 이 재시도는 무시
        if (state.character !== characterAtCall || state.stepIndex !== stepIndexAtCall) return;
        if (attempts < 3) {
          setTimeout(tryLoadGuide, 350);
        } else {
          ClassroomGuard.showModal('가이드 이미지를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.', [{ label: '확인', primary: true }]);
        }
      };
      // 캐시 때문에 이전 단계 이미지가 그대로 남는 문제를 막기 위해 매번 새 요청을 강제함
      // data: URI(라면 토핑처럼 그때그때 합성한 가이드)는 쿼리스트링을 붙이면 깨지므로 그대로 사용
      guideImg.src = basePath.startsWith('data:') ? basePath : basePath + '?v=' + Date.now();
    }
    tryLoadGuide();

    loadSnapGridForStep(state.character, state.stepIndex);
    renderStepDots(total);
    $('nextStepBtn').textContent = (state.stepIndex === total - 1) ? '🎨' : '➡️';
    $('nextStepBtn').title = '다음 단계 (길게 누르면 이전 단계)';
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

  function goToPrevStep() {
    if (workMode !== 'draw' || !state.character) return;
    if (state.stepIndex > 0) {
      state.stepIndex--;
      loadStepGuide();
    }
  }

  let nextStepLongPressTimer = null;
  let nextStepLongPressFired = false;
  const nextStepBtnEl = $('nextStepBtn');
  nextStepBtnEl.addEventListener('pointerdown', () => {
    nextStepLongPressFired = false;
    nextStepLongPressTimer = setTimeout(() => {
      if (workMode !== 'draw') return; // 색칠 단계(완성 버튼 역할)에서는 길게 눌러도 아무 동작 안 함
      nextStepLongPressFired = true;
      goToPrevStep();
    }, 420);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
    nextStepBtnEl.addEventListener(evt, () => { if (nextStepLongPressTimer) clearTimeout(nextStepLongPressTimer); });
  });
  nextStepBtnEl.addEventListener('click', () => {
    if (nextStepLongPressFired) return; // 길게 눌러 이전 단계로 이미 이동했으면, 뒤이은 클릭(다음 단계)은 무시
    if (workMode === 'color') {
      if (TOPPING_THEMES[state.theme]) { finishToppingGameStage(); return; }
      confirmSubmit();
      return;
    }
    if (workMode !== 'draw' || !state.character) return;
    const total = state.character.steps.length;
    if (state.stepIndex < total - 1) {
      state.stepIndex++;
      state.stepStrokeStart[state.stepIndex] = state.strokes.length; // 이 단계가 시작된 시점의 선 개수를 기록
      loadStepGuide(); // 이전 단계 가이드는 사라지고 새 가이드만 표시, 그린 선은 유지
    } else {
      enterColoringStage();
    }
  });

  /* ============ 6. 색칠 단계 (플러드필) ============ */
  let wallMask = null; // Uint8Array, 1 = 경계선(벽)

  // 라인아트 + (그리기 도구로 추가한) 데코 선까지 합쳐서 벽 지도를 다시 계산
  let lineAlphaArr = null;      // 라인아트+데코 레이어의 원본 알파값 (매 색칠단계 진입 시 1회 계산)
  let lineBrightnessArr = null; // 같은 픽셀의 밝기값 (0~255)

  // 되돌리기 스냅샷: getImageData(원본 픽셀, 900x900 기준 장당 약 3MB)는 저사양 기기에서
  // 메모리 부담이 커서, 압축되는 PNG data URL로 저장함 (채우기 위주 그림은 용량이 훨씬 작아짐).
  // 대신 복원 시 이미지 디코딩이 필요해서 undo가 약간 비동기적으로 동작함.
  const FILL_HISTORY_MAX = 10; // 스냅샷 개수도 20 -> 10으로 줄여 메모리 사용을 추가로 절반 절감
  function pushFillSnapshot() {
    state.fillHistory.push(fillCtx.canvas.toDataURL('image/png'));
    if (state.fillHistory.length > FILL_HISTORY_MAX) state.fillHistory.shift();
  }
  function restoreFillSnapshot(dataURL) {
    if (!dataURL) return;
    const img = new Image();
    img.onload = () => {
      fillCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
      fillCtx.drawImage(img, 0, 0);
    };
    img.src = dataURL;
  }

  function rebuildWallMask() {
    const tmp = document.createElement('canvas');
    tmp.width = CANVAS_RES; tmp.height = CANVAS_RES;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(lineArtCanvas, 0, 0);
    tctx.drawImage(decoCanvas, 0, 0);
    const data = tctx.getImageData(0, 0, CANVAS_RES, CANVAS_RES).data;
    lineAlphaArr = new Uint8Array(CANVAS_RES * CANVAS_RES);
    lineBrightnessArr = new Uint8Array(CANVAS_RES * CANVAS_RES);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      lineAlphaArr[p] = data[i + 3];
      lineBrightnessArr[p] = (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    applyFillTolerance();
  }

  // 포토샵 마술봉의 "허용치"와 같은 개념: 오차가 클수록 연하고 흐릿한 선(반투명 가장자리 등)까지
  // "선이 아님"으로 인정해서 그 안쪽으로 채우기가 넓게 퍼짐. 곡선 형태로 증가시켜서 낮은 단계에서는
  // 변화가 작고 높은 단계로 갈수록 확 넓어지도록 함. 오차=10이면 기준이 0이 되어 캔버스 전체(진한
  // 선 포함)가 한 덩어리로 채워짐 (max 10, 최대치에서 완전히 다 채워지도록 요청받음)
  const FILL_TOLERANCE_MAX = 10;
  function applyFillTolerance() {
    if (!lineAlphaArr) return;
    const t = Math.min(1, fillTolerance / FILL_TOLERANCE_MAX);
    const threshold = 200 * (1 - Math.pow(t, 1.5));
    wallMask = new Uint8Array(CANVAS_RES * CANVAS_RES);
    for (let p = 0; p < lineAlphaArr.length; p++) {
      wallMask[p] = (lineAlphaArr[p] > 60 && lineBrightnessArr[p] < threshold) ? 1 : 0;
    }
  }

  function enterColoringStage() {
    workMode = 'color';
    drawingEnabled = false;
    closeAllPopovers();
    resetStageZoom();
    fillTolerance = 0;
    $('fillToleranceSlider').value = '0';
    $('fillToleranceValue').textContent = '0';

    lineArtCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    lineArtCtx.drawImage(drawCanvas, 0, 0);
    rebuildWallMask();

    fillCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    state.fillHistory = [];
    state.decoStrokes = [];
    decoCtx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    setColorTool('fill');

    guideImg.style.display = 'none';
    drawCanvas.style.display = 'none';
    lineArtCanvas.style.display = 'block';
    fillCanvas.style.display = 'block';
    decoCanvas.style.display = 'block';
    $('colorClickLayer').style.display = 'block';
    drawToolbarEl.style.display = 'none';
    colorToolbarEl.style.display = 'flex';
    $('backToDrawBtn').style.display = ''; // 라면 그릇 채색 단계에서 숨겼을 수 있으니 기본값으로 복원

    $('stepIndicator').textContent = '🎨 색칠하기';
    $('nextStepBtn').textContent = '➡️';
    $('nextStepBtn').title = '완성하기';
    renderPalette();
  }

  function backToDrawingStage() {
    workMode = 'draw';
    drawingEnabled = true;
    closeAllPopovers();
    resetStageZoom();
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
    colorToolbarEl.style.display = 'none';
    drawToolbarEl.style.display = 'flex';

    loadStepGuide();
  }

  $('backToDrawBtn').addEventListener('click', () => {
    ClassroomGuard.showModal('선 그리기로 돌아가면 지금까지 색칠한 내용이 사라져요. 계속할까요?', [
      { label: '취소', primary: false },
      { label: '돌아가기', primary: true, onClick: backToDrawingStage }
    ]);
  });

  /* ---- 색칠 단계 도구 선택: 채우기(+색 고르기 팝오버) / 그리기(검정 고정) / 지우개 ---- */
  const colorToolButtons = { fill: $('fillToolBtn'), pen: $('penToolBtn'), erase: $('eraseToolBtn') };
  function setColorTool(tool) {
    colorTool = tool;
    Object.keys(colorToolButtons).forEach((key) => colorToolButtons[key].classList.toggle('on', key === tool));
  }
  colorToolButtons.fill.addEventListener('click', () => {
    setColorTool('fill');
    togglePopover($('fillColorPopover'));
  });
  colorToolButtons.pen.addEventListener('click', () => { setColorTool('pen'); closeAllPopovers(); });
  colorToolButtons.erase.addEventListener('click', () => { setColorTool('erase'); closeAllPopovers(); });

  function renderPalette() {
    const grid = $('paletteGrid');
    grid.innerHTML = '';
    $('customColorPicker').classList.remove('show'); // 새 색칠 단계 시작할 때는 피커 접어둔 상태로

    // 무지개 버튼: 기본 색상 외에 원하는 색을 직접 골라 넣을 수 있음 (커스텀 색상 피커 토글)
    const rainbowWrap = document.createElement('div');
    rainbowWrap.className = 'swatch swatch-rainbow';
    rainbowWrap.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('on'));
      rainbowWrap.classList.add('on');
      setColorTool('fill');
      $('customColorPicker').classList.toggle('show');
    });
    grid.appendChild(rainbowWrap);

    PALETTE.forEach((color) => {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (color === state.fillColor ? ' on' : '');
      sw.style.background = color;
      sw.addEventListener('click', () => {
        state.fillColor = color;
        document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('on'));
        sw.classList.add('on');
        setColorTool('fill');
        closeAllPopovers();
      });
      grid.appendChild(sw);
    });
  }

  $('fillToleranceSlider').addEventListener('input', (e) => {
    fillTolerance = Number(e.target.value);
    $('fillToleranceValue').textContent = String(fillTolerance);
    applyFillTolerance(); // 슬라이더를 움직이는 즉시 벽 판정 기준을 다시 계산해둠
  });

  // 스캔라인 방식 플러드필 (마스크 기반, 반복문 스택 사용 - 재귀 X)
  function floodFillAt(cx, cy) {
    const w = CANVAS_RES, h = CANVAS_RES;
    const sx = Math.floor(cx), sy = Math.floor(cy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    if (wallMask[sy * w + sx]) return;

    const visited = new Uint8Array(w * h);
    const stack = [[sx, sy]];
    let filledPixels = [];

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

    pushFillSnapshot();

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

  /* ---- 커스텀 색상 피커 (모바일에서도 PC 네이티브 컬러피커처럼 직관적으로 고를 수 있도록 자체 제작)
         네이티브 <input type="color">는 모바일 브라우저마다 UI가 부실하거나 색을 세밀하게
         고르기 어려운 경우가 많아서, HSV 방식의 채도/명도 박스 + 색상(Hue) 슬라이더로 대체함 ---- */
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  }
  function hsvToRgb(h, s, v) {
    h = h / 360;
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q; break;
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }

  const colorSVBoxEl = $('colorSVBox');
  const colorSVCursorEl = $('colorSVCursor');
  const colorHueSliderEl = $('colorHueSlider');
  const colorPreviewSwatchEl = $('colorPreviewSwatch');
  const colorPreviewHexEl = $('colorPreviewHex');
  let pickerHue = 320, pickerSat = 0.6, pickerVal = 1;

  function applyPickerColor() {
    const { r, g, b } = hsvToRgb(pickerHue, pickerSat, pickerVal);
    const hex = rgbToHex(r, g, b);
    state.fillColor = hex;
    colorPreviewSwatchEl.style.background = hex;
    colorPreviewHexEl.textContent = hex.toUpperCase();
    document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('on'));
    document.querySelector('.swatch-rainbow').classList.add('on');
    setColorTool('fill');
  }
  function updatePickerUI() {
    colorSVBoxEl.style.backgroundColor = `hsl(${pickerHue}, 100%, 50%)`;
    colorSVCursorEl.style.left = (pickerSat * 100) + '%';
    colorSVCursorEl.style.top = ((1 - pickerVal) * 100) + '%';
    colorHueSliderEl.value = String(pickerHue);
  }

  let svDragging = false;
  function updateSVFromEvent(e) {
    const rect = colorSVBoxEl.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top));
    pickerSat = x / rect.width;
    pickerVal = 1 - y / rect.height;
    colorSVCursorEl.style.left = (pickerSat * 100) + '%';
    colorSVCursorEl.style.top = ((1 - pickerVal) * 100) + '%';
    applyPickerColor();
  }
  colorSVBoxEl.addEventListener('pointerdown', (e) => {
    svDragging = true;
    try { colorSVBoxEl.setPointerCapture(e.pointerId); } catch (err) {}
    updateSVFromEvent(e);
  });
  colorSVBoxEl.addEventListener('pointermove', (e) => { if (svDragging) updateSVFromEvent(e); });
  colorSVBoxEl.addEventListener('pointerup', () => { svDragging = false; });
  colorSVBoxEl.addEventListener('pointercancel', () => { svDragging = false; });

  colorHueSliderEl.addEventListener('input', (e) => {
    pickerHue = Number(e.target.value);
    colorSVBoxEl.style.backgroundColor = `hsl(${pickerHue}, 100%, 50%)`;
    applyPickerColor();
  });

  updatePickerUI();
  (function initPickerPreview() {
    const { r, g, b } = hsvToRgb(pickerHue, pickerSat, pickerVal);
    const hex = rgbToHex(r, g, b);
    colorPreviewSwatchEl.style.background = hex;
    colorPreviewHexEl.textContent = hex.toUpperCase();
  })();

  let currentDecoStroke = null;
  let eraseLastPoint = null;
  const COLOR_ERASE_RADIUS = 26;

  function eraseFillAt(p) {
    fillCtx.save();
    fillCtx.globalCompositeOperation = 'destination-out';
    fillCtx.beginPath();
    fillCtx.arc(p.x, p.y, COLOR_ERASE_RADIUS, 0, Math.PI * 2);
    fillCtx.fill();
    fillCtx.restore();
  }
  function eraseFillSegment(p1, p2) {
    fillCtx.save();
    fillCtx.globalCompositeOperation = 'destination-out';
    fillCtx.lineCap = 'round';
    fillCtx.lineWidth = COLOR_ERASE_RADIUS * 2;
    fillCtx.beginPath();
    fillCtx.moveTo(p1.x, p1.y);
    fillCtx.lineTo(p2.x, p2.y);
    fillCtx.stroke();
    fillCtx.restore();
  }

  ClassroomGuard.attachPalmRejection($('colorClickLayer'), {
    onStart(e) {
      if (workMode !== 'color') return;
      const p = stagePointToCanvas(e);
      if (colorTool === 'fill') {
        floodFillAt(p.x, p.y);
      } else if (colorTool === 'erase') {
        pushFillSnapshot();
        eraseLastPoint = p;
        eraseFillAt(p);
      } else {
        currentDecoStroke = { points: [p], _last: p, color: '#1c1c1c' };
        state.decoStrokes.push(currentDecoStroke);
        redrawDeco();
      }
    },
    onMove(e) {
      if (workMode !== 'color') return;
      if (colorTool === 'pen' && currentDecoStroke) {
        const raw = stagePointToCanvas(e);
        const last = currentDecoStroke._last;
        const smoothed = {
          x: last.x + (raw.x - last.x) * SMOOTHING_ALPHA,
          y: last.y + (raw.y - last.y) * SMOOTHING_ALPHA
        };
        currentDecoStroke._last = smoothed;
        currentDecoStroke.points.push(smoothed);
        redrawDeco();
      } else if (colorTool === 'erase' && eraseLastPoint) {
        const raw = stagePointToCanvas(e);
        eraseFillSegment(eraseLastPoint, raw);
        eraseLastPoint = raw;
      }
    },
    onEnd() {
      if (currentDecoStroke) rebuildWallMask(); // 방금 그은 선을 벽 지도에 반영해서, 이후 채우기가 이 선을 경계로 인식하게 함
      currentDecoStroke = null;
      eraseLastPoint = null;
    }
  });

  /* ============ 캔버스 전용 핀치줌 + 팬 ============
     네이티브 브라우저 확대는 전부 막아뒀고(touch-action:none), 대신 캔버스 영역
     안에서 두 손가락이 감지되면 캔버스(#canvasStage)만 CSS transform으로 확대/이동합니다.
     stagePointToCanvas()는 stage.getBoundingClientRect() 기준 비율로 좌표를 계산하기
     때문에, 이렇게 확대·이동해도 그리기 좌표 매핑은 자동으로 맞습니다.

     기준점 계산: transform-origin을 항상 좌상단(0,0)에 고정해두고, 손가락으로 잡은
     지점이 화면 위 같은 자리에 계속 붙어있도록 매 순간 pan 값을 다시 풀어서 구합니다.
     (이전 버전은 원점이 캔버스 정중앙에 고정돼 있어서 손가락 위치와 무관하게 확대되어
     "미끄러지는" 느낌이 났던 것을 수정한 버전) */
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 2.5;
  let stageZoom = 1;
  let panX = 0;
  let panY = 0;
  const activeTouches = new Map(); // pointerId -> {x,y}
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let pinchAnchor = { x: 0.5, y: 0.5 }; // 이번 제스처 동안 손가락에 고정할 콘텐츠상의 지점 (0~1 비율)
  let pinchLayoutRect = null; // 이번 제스처 시작 시점의, transform이 적용되지 않은 원본 레이아웃 위치/크기

  function pinchDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function pinchMid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // transform을 잠깐 껐다 켜서, 실제 레이아웃 상 크기/위치(변형 적용 전)를 정확히 읽음
  function getStageLayoutRect() {
    const prevTransform = stage.style.transform;
    stage.style.transform = 'none';
    const rect = stage.getBoundingClientRect();
    stage.style.transform = prevTransform;
    return rect;
  }

  function cancelActiveStroke() {
    // 핀치가 시작되면 그 순간 진행 중이던 선/지우개 동작은 취소함 (두 번째 손가락은 확대용)
    if (currentStroke) {
      const idx = state.strokes.indexOf(currentStroke);
      if (idx > -1) state.strokes.splice(idx, 1);
      currentStroke = null;
      redrawStrokes();
    }
    if (currentDecoStroke) {
      const idx = state.decoStrokes.indexOf(currentDecoStroke);
      if (idx > -1) state.decoStrokes.splice(idx, 1);
      currentDecoStroke = null;
      redrawDeco();
    }
    eraseLastPoint = null;
  }

  function clampPan() {
    // 확대된 캔버스 가장자리가 원래 영역 밖으로 너무 멀리 밀려나 화면에서 사라지지 않도록 제한
    if (!pinchLayoutRect) return;
    const w = pinchLayoutRect.width, h = pinchLayoutRect.height;
    const minX = Math.min(0, w - stageZoom * w);
    const minY = Math.min(0, h - stageZoom * h);
    panX = Math.min(0, Math.max(minX, panX));
    panY = Math.min(0, Math.max(minY, panY));
  }

  function applyStageZoom() {
    clampPan();
    stage.style.transformOrigin = '0 0';
    stage.style.transform = (stageZoom === 1 && panX === 0 && panY === 0)
      ? ''
      : `translate(${panX}px, ${panY}px) scale(${stageZoom})`;
  }

  function resetStageZoom() {
    stageZoom = 1;
    panX = 0;
    panY = 0;
    activeTouches.clear();
    pinchStartDist = 0;
    pinchLayoutRect = null;
    stage.style.transformOrigin = '';
    stage.style.transform = '';
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeTouches.size === 2) {
      cancelActiveStroke();
      const pts = Array.from(activeTouches.values());
      pinchStartDist = pinchDist(pts[0], pts[1]);
      pinchStartZoom = stageZoom;
      const mid = pinchMid(pts[0], pts[1]);
      pinchLayoutRect = getStageLayoutRect();
      // 지금 손가락이 짚은 지점이, 변형 없는 원본 레이아웃 기준으로 어느 비율(0~1) 위치인지 계산
      pinchAnchor = {
        x: (mid.x - pinchLayoutRect.left - panX) / (stageZoom * pinchLayoutRect.width),
        y: (mid.y - pinchLayoutRect.top - panY) / (stageZoom * pinchLayoutRect.height)
      };
    }
  }, { passive: true });

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !activeTouches.has(e.pointerId)) return;
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeTouches.size === 2 && pinchStartDist > 0 && pinchLayoutRect) {
      const pts = Array.from(activeTouches.values());
      const d = pinchDist(pts[0], pts[1]);
      stageZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartZoom * (d / pinchStartDist)));
      const mid = pinchMid(pts[0], pts[1]);
      // 손가락으로 처음 짚었던 그 지점(pinchAnchor)이 지금의 손가락 중간점 위치에 그대로 오도록 pan을 역산
      panX = mid.x - pinchLayoutRect.left - stageZoom * pinchAnchor.x * pinchLayoutRect.width;
      panY = mid.y - pinchLayoutRect.top - stageZoom * pinchAnchor.y * pinchLayoutRect.height;
      applyStageZoom();
    }
  }, { passive: true });

  function releaseTouchPoint(e) {
    if (e.pointerType !== 'touch') return;
    activeTouches.delete(e.pointerId);
    if (activeTouches.size < 2) pinchStartDist = 0;
  }
  stage.addEventListener('pointerup', releaseTouchPoint, { passive: true });
  stage.addEventListener('pointercancel', releaseTouchPoint, { passive: true });
  stage.addEventListener('pointerleave', releaseTouchPoint, { passive: true });

  /* ============ 7. 완성 & 제출 ============ */
  function confirmSubmit() {
    ClassroomGuard.showModal('작품을 제출할까요?', [
      { label: '더 그릴래요', primary: false },
      { label: '제출하기', primary: true, onClick: submitArtwork }
    ]);
  }

  function submitArtwork() {
    // 업로드/완료 화면용 (흰 배경)
    const out = document.createElement('canvas');
    out.width = CANVAS_RES; out.height = CANVAS_RES;
    const octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, CANVAS_RES, CANVAS_RES);
    octx.drawImage(fillCanvas, 0, 0);
    octx.drawImage(lineArtCanvas, 0, 0);
    octx.drawImage(decoCanvas, 0, 0);

    // 두더지 게임용 (배경 투명)
    const transOut = document.createElement('canvas');
    transOut.width = CANVAS_RES; transOut.height = CANVAS_RES;
    const tctx = transOut.getContext('2d');
    tctx.drawImage(fillCanvas, 0, 0);
    tctx.drawImage(lineArtCanvas, 0, 0);
    tctx.drawImage(decoCanvas, 0, 0);

    out.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      showScreen('screen-done');
      $('doneThumb').src = url;
      $('doneStatus').textContent = '제출 중이에요...';

      // 제출 실행 자체를 기준으로 미니게임 갤러리/기회를 갱신 (업로드 성공 여부와 무관)
      transOut.toBlob((transBlob) => {
        state.artworkGallery.push(URL.createObjectURL(transBlob));
        updateMiniGameButton();
      }, 'image/png');
      state.submittedCount++;
      if (state.submittedCount >= 2) state.playCredits = 2;
      updateMiniGameButton();

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

  /* ============ 8. 미니게임: 두더지 잡기 ============ */
  const MOLE_COUNT = 9;
  const ROUND_SECONDS = 30;
  const SPAWN_INTERVAL_START_MS = 1200; // 라운드 시작 시 두더지 등장 간격
  const SPAWN_INTERVAL_END_MS = 600;    // 라운드 막바지 등장 간격 (점점 빨라짐)
  const MOLE_UP_START_MS = 2300;        // 라운드 시작 시 두더지가 멈춰있는 시간
  const MOLE_UP_END_MS = 1500;          // 라운드 막바지 (점점 짧아짐)
  const EXIT_ANIM_MS = 240;             // 놓쳤을 때 내려가는 애니메이션 여유 시간
  const CATCH_ANIM_MS = 350;            // 맞았을 때 사라지는 애니메이션 여유 시간
  const QUICK_MOLE_CHANCE = 0.25;       // 정해진 리듬과 별개로, 이 확률로 "빠른 두더지"가 등장
  const QUICK_MOLE_UP_MS = 1000;        // 빠른 두더지가 멈춰있는 시간 (고정 1초)

  let moleGridBuilt = false;
  let moleHoles = [];
  let gameScore = 0;
  let gameSpawnedCount = 0;
  let gameTimeLeft = ROUND_SECONDS;
  let gameSpawnTimer = null;
  let gameCountdownTimer = null;
  let gameRoundActive = false;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function roundProgress() { return Math.min(1, Math.max(0, 1 - gameTimeLeft / ROUND_SECONDS)); }
  function currentSpawnIntervalMs() { return lerp(SPAWN_INTERVAL_START_MS, SPAWN_INTERVAL_END_MS, roundProgress()); }
  function currentMoleUpMs() { return lerp(MOLE_UP_START_MS, MOLE_UP_END_MS, roundProgress()); }

  function updateMiniGameButton() {
    const btn = $('miniGameBtn');
    const unlocked = state.submittedCount >= 2 && state.artworkGallery.length > 0;
    btn.disabled = !unlocked || state.playCredits <= 0;
    btn.textContent = '🎮 두더지 잡기';
  }

  function buildMoleGrid() {
    if (moleGridBuilt) return;
    const grid = $('moleGrid');
    grid.innerHTML = '';
    moleHoles = [];
    for (let i = 0; i < MOLE_COUNT; i++) {
      const hole = document.createElement('div');
      hole.className = 'mole-hole';
      const img = document.createElement('img');
      img.className = 'mole-img';
      img.alt = '';
      hole.appendChild(img);
      grid.appendChild(hole);

      const holeObj = { imgEl: img, timeoutId: null, up: false, busyUntil: 0 };
      img.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!gameRoundActive || !holeObj.up) return;
        catchMole(holeObj);
      });
      moleHoles.push(holeObj);
    }
    moleGridBuilt = true;
  }

  function randomArtwork() {
    const gallery = state.artworkGallery;
    if (!gallery.length) return '';
    return gallery[Math.floor(Math.random() * gallery.length)];
  }

  // 한 구멍에 두 캐릭터가 겹쳐 보이는 것을 막기 위해, 사라지는 애니메이션이
  // 완전히 끝날 때까지(busyUntil) 그 구멍은 다시 스폰 대상에서 제외함
  function spawnMole() {
    const now = Date.now();
    const idle = moleHoles.filter((h) => !h.up && now >= h.busyUntil);
    if (!idle.length) return;
    const hole = idle[Math.floor(Math.random() * idle.length)];
    hole.imgEl.src = randomArtwork();
    hole.imgEl.classList.remove('caught');
    hole.up = true;
    gameSpawnedCount++;
    requestAnimationFrame(() => hole.imgEl.classList.add('up'));
    // 정해진 난이도 리듬과 별개로, 일정 확률로 1초짜리 "빠른 두더지"를 섞어 등장시킴
    const upMs = Math.random() < QUICK_MOLE_CHANCE ? QUICK_MOLE_UP_MS : currentMoleUpMs();
    hole.timeoutId = setTimeout(() => hideMole(hole), upMs);
  }

  function hideMole(hole) {
    hole.up = false;
    hole.imgEl.classList.remove('up');
    if (hole.timeoutId) clearTimeout(hole.timeoutId);
    hole.timeoutId = null;
    hole.busyUntil = Date.now() + EXIT_ANIM_MS;
  }

  function catchMole(hole) {
    gameScore++;
    $('gameScore').textContent = String(gameScore);
    hole.imgEl.classList.add('caught');
    if (hole.timeoutId) clearTimeout(hole.timeoutId);
    hole.up = false;
    hole.busyUntil = Date.now() + CATCH_ANIM_MS;
    setTimeout(() => hole.imgEl.classList.remove('up', 'caught'), CATCH_ANIM_MS);
  }

  function scheduleNextSpawn() {
    gameSpawnTimer = setTimeout(() => {
      spawnMole();
      if (gameRoundActive) scheduleNextSpawn();
    }, currentSpawnIntervalMs());
  }

  function startRound() {
    buildMoleGrid();
    gameScore = 0;
    gameSpawnedCount = 0;
    gameTimeLeft = ROUND_SECONDS;
    state.playCredits = Math.max(0, state.playCredits - 1); // 시작하는 즉시 이번 판을 차감해서 "남은 기회"에 반영
    updateMiniGameButton();
    $('gameScore').textContent = '0';
    $('gameTimer').textContent = String(gameTimeLeft);
    $('gameCredits').textContent = String(state.playCredits);
    $('gameOverlay').classList.add('hidden');
    $('countdownPopup').classList.remove('show');
    gameRoundActive = true;
    gameScreenEl.classList.add('hammer-mode'); // 게임이 실제로 시작된 뒤에만 커서를 망치로 바꿈

    scheduleNextSpawn();
    gameCountdownTimer = setInterval(() => {
      gameTimeLeft--;
      $('gameTimer').textContent = String(gameTimeLeft);
      if (gameTimeLeft <= 10 && gameTimeLeft > 0) {
        $('countdownPopup').classList.add('show');
        $('countdownNum').textContent = String(gameTimeLeft);
      } else {
        $('countdownPopup').classList.remove('show');
      }
      if (gameTimeLeft <= 0) endRound();
    }, 1000);
  }

  function stopGameTimers() {
    gameRoundActive = false;
    if (gameSpawnTimer) clearTimeout(gameSpawnTimer);
    if (gameCountdownTimer) clearInterval(gameCountdownTimer);
    gameSpawnTimer = null;
    gameCountdownTimer = null;
    moleHoles.forEach(hideMole);
    $('countdownPopup').classList.remove('show');
  }

  function endRound() {
    stopGameTimers();
    gameScreenEl.classList.remove('hammer-mode'); // 라운드 사이 결과창에서는 다시 일반 커서로
    hideHammer();
    updateMiniGameButton();

    const perfect = gameSpawnedCount > 0 && gameScore === gameSpawnedCount;

    $('gameOverlay').classList.remove('hidden');
    $('gameOverlayTitle').textContent = perfect ? '🏆 완벽해요!' : '이번 판 끝! 🎉';
    $('gameOverlayDesc').textContent = perfect
      ? `나온 두더지 ${gameSpawnedCount}마리를 전부 다 잡았어요! 최고예요!`
      : `${gameSpawnedCount}마리 중 ${gameScore}마리를 잡았어요!`;

    const actions = $('gameOverlayActions');
    actions.innerHTML = '';
    if (state.playCredits > 0) {
      const again = document.createElement('button');
      again.className = 'btn coral full';
      again.textContent = `다시 하기 (남은 기회 ${state.playCredits})`;
      again.addEventListener('click', startRound);
      actions.appendChild(again);

      const stop = document.createElement('button');
      stop.className = 'btn ghost full';
      stop.textContent = '그만하고 그리러 가기';
      stop.addEventListener('click', exitGameToDrawing);
      actions.appendChild(stop);
    } else {
      const goDraw = document.createElement('button');
      goDraw.className = 'btn coral full';
      goDraw.textContent = '✏️ 다시 그림 그리러 가기';
      goDraw.addEventListener('click', exitGameToDrawing);
      actions.appendChild(goDraw);
    }
  }

  function exitGameToDrawing() {
    stopGameTimers();
    stopBubbles();
    hideHammer();
    gameScreenEl.classList.remove('hammer-mode');
    showScreen('screen-work');
    enterWorkspace(state.theme);
  }

  /* ---- 뽕망치 커서 ---- */
  const hammerEl = $('hammerCursor');
  const hammerGlowEl = $('hammerGlow');
  let hammerHideTimeout = null;

  function positionHammer(x, y) {
    hammerEl.style.left = x + 'px';
    hammerEl.style.top = y + 'px';
    hammerGlowEl.style.left = x + 'px';
    hammerGlowEl.style.top = y + 'px';
  }

  function showHammerAt(x, y, doSwing) {
    positionHammer(x, y);
    hammerEl.classList.add('visible');
    if (doSwing) {
      hammerEl.classList.remove('swing');
      void hammerEl.offsetWidth; // 강제 리플로우로 애니메이션 재시작
      hammerEl.classList.add('swing');

      hammerGlowEl.classList.remove('flash');
      void hammerGlowEl.offsetWidth;
      hammerGlowEl.classList.add('flash');
    }
  }

  function hideHammer() {
    hammerEl.classList.remove('visible', 'swing');
    hammerGlowEl.classList.remove('flash');
  }

  const gameScreenEl = $('screen-game');
  gameScreenEl.addEventListener('pointermove', (e) => {
    if (!gameRoundActive || e.pointerType !== 'mouse') return; // 라운드가 진행 중일 때만, 마우스에서만 커서를 따라다님
    if (hammerHideTimeout) { clearTimeout(hammerHideTimeout); hammerHideTimeout = null; }
    showHammerAt(e.clientX, e.clientY, false);
  });
  gameScreenEl.addEventListener('pointerdown', (e) => {
    if (!gameRoundActive) return; // 시작하기 전(안내 화면 등)에는 망치를 보여주지 않음
    showHammerAt(e.clientX, e.clientY, true);
    if (e.pointerType !== 'mouse') {
      // 터치: 순간적으로 내려치는 모션만 보여주고 곧 사라짐 (계속 떠있는 커서가 아니므로)
      if (hammerHideTimeout) clearTimeout(hammerHideTimeout);
      hammerHideTimeout = setTimeout(hideHammer, 260);
    }
  });
  gameScreenEl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hideHammer();
  });

  /* ---- 좌우에서 천천히 떠오르는 물방울 (장식용, 두더지 구멍 영역은 피해서 배치) ---- */
  let bubbleSpawnTimer = null;

  function spawnBubble() {
    const layer = $('bubbleLayer');
    const layerRect = layer.getBoundingClientRect();
    const gridEl = $('moleGrid');
    const gridRect = gridEl.getBoundingClientRect();
    const SAFE_GAP = 14; // 중앙 구멍 영역과의 최소 간격
    const MAX_SIZE = 34; // 두더지 구멍보다 확실히 작게

    const leftZoneWidth = Math.max(0, (gridRect.left - layerRect.left) - SAFE_GAP);
    const rightZoneStart = (gridRect.right - layerRect.left) + SAFE_GAP;
    const rightZoneWidth = Math.max(0, layerRect.width - rightZoneStart);

    const useLeft = Math.random() < 0.5;
    const zoneWidth = useLeft ? leftZoneWidth : rightZoneWidth;
    if (zoneWidth < 12) return; // 배치할 공간이 없으면 건너뜀

    const size = Math.min(MAX_SIZE, 10 + Math.random() * 24); // 랜덤 크기, 최대 34px
    const maxX = Math.max(0, zoneWidth - size);
    const x = useLeft ? Math.random() * maxX : rightZoneStart + Math.random() * maxX;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = x + 'px';
    const duration = 5.5 + Math.random() * 4; // 5.5~9.5초에 걸쳐 천천히 상승
    bubble.style.animationDuration = duration + 's';
    layer.appendChild(bubble);
    setTimeout(() => bubble.remove(), duration * 1000 + 300);
  }

  function startBubbles() {
    stopBubbles();
    bubbleSpawnTimer = setInterval(spawnBubble, 450);
  }

  function stopBubbles() {
    if (bubbleSpawnTimer) clearInterval(bubbleSpawnTimer);
    bubbleSpawnTimer = null;
    $('bubbleLayer').innerHTML = '';
  }

  $('miniGameBtn').addEventListener('click', () => {
    if (state.submittedCount < 2 || state.playCredits <= 0 || state.artworkGallery.length === 0) {
      ClassroomGuard.showModal('먼저 캐릭터를 2개 이상 그려서 제출해야 게임을 할 수 있어요!', [{ label: '확인', primary: true }]);
      return;
    }
    buildMoleGrid();
    showScreen('screen-game');
    requestAnimationFrame(startBubbles);

    $('gameOverlay').classList.remove('hidden');
    $('gameOverlayTitle').textContent = '두더지 잡기';
    $('gameOverlayDesc').textContent = '내가 그린 캐릭터가 두더지로 나와요! 손가락으로 톡톡 잡아보세요.';
    const actions = $('gameOverlayActions');
    actions.innerHTML = '';
    const startBtn = document.createElement('button');
    startBtn.className = 'btn coral full';
    startBtn.textContent = '시작하기';
    startBtn.addEventListener('click', startRound);
    actions.appendChild(startBtn);
  });

})();
