<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>캐릭터 시트 메이커</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="app-header">
    <a class="hub-link" href="https://miahwang2000.github.io/webtoon">← 디지털드로잉 클래스로 돌아가기</a>
    <h1 class="app-title">✏️ 캐릭터 시트 메이커</h1>
    <p class="app-subtitle">나만의 캐릭터를 만들고, 캐릭터 시트를 완성해보세요</p>
  </header>

  <main class="app-main">
    <!-- 캐릭터 미리보기 -->
    <section class="stage-section">
      <div class="stage-frame">
        <div class="binder-holes" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <canvas id="previewCanvas" width="600" height="800"></canvas>
      </div>
    </section>

    <!-- 파츠 선택 -->
    <section class="controls-section">
      <div class="part-picker">
        <div class="options-nav">
          <button type="button" class="nav-arrow nav-left" data-target="hairOptions" aria-label="이전 헤어">◀</button>
          <div class="options-row" id="hairOptions"></div>
          <button type="button" class="nav-arrow nav-right" data-target="hairOptions" aria-label="다음 헤어">▶</button>
        </div>
      </div>

      <div class="part-picker">
        <div class="options-nav">
          <button type="button" class="nav-arrow nav-left" data-target="clothesOptions" aria-label="이전 의상">◀</button>
          <div class="options-row" id="clothesOptions"></div>
          <button type="button" class="nav-arrow nav-right" data-target="clothesOptions" aria-label="다음 의상">▶</button>
        </div>
      </div>

      <div class="part-picker">
        <div class="options-nav">
          <button type="button" class="nav-arrow nav-left" data-target="faceOptions" aria-label="이전 표정">◀</button>
          <div class="options-row" id="faceOptions"></div>
          <button type="button" class="nav-arrow nav-right" data-target="faceOptions" aria-label="다음 표정">▶</button>
        </div>
      </div>

      <!-- 캐릭터 정보 -->
      <div class="info-form">
        <h2 class="section-title">색칠하기</h2>
        <div id="colorPalette" class="color-palette"></div>

        <h2 class="section-title">캐릭터 정보</h2>

        <label class="field">
          <span class="field-label">이름</span>
          <input type="text" id="charName" placeholder="캐릭터 이름을 입력하세요" maxlength="20" />
        </label>

        <div class="field">
          <span class="field-label">성격</span>
          <div class="choice-field" data-field="personality">
            <select class="choice-select"></select>
            <input type="text" class="choice-custom" placeholder="직접 입력" maxlength="20" hidden />
          </div>
        </div>

        <h2 class="section-title">능력치</h2>

        <div class="ability-row">
          <span class="ability-label">강점</span>
          <div class="choice-field ability-choice" data-field="strength">
            <select class="choice-select"></select>
            <input type="text" class="choice-custom" placeholder="직접 입력" maxlength="20" hidden />
          </div>
          <div class="gauge" data-field="strength"></div>
        </div>

        <div class="ability-row">
          <span class="ability-label">약점</span>
          <div class="choice-field ability-choice" data-field="weakness">
            <select class="choice-select"></select>
            <input type="text" class="choice-custom" placeholder="직접 입력" maxlength="20" hidden />
          </div>
          <div class="gauge" data-field="weakness"></div>
        </div>
      </div>

      <button id="exportBtn" class="export-btn" type="button">📥 PNG로 저장</button>
    </section>
  </main>

  <script src="js/assets.js"></script>
  <script src="js/character.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/paint.js"></script>
  <script src="js/export.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
