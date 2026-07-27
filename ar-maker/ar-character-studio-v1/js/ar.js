// ar.js — no WebXR, no markers: just the camera feed as a background and
// the drawn character as a positioned element the student can tap, double
// tap, long-press, and feed. This keeps AR working the same way on every
// tablet, including iPad Safari, since it never needs plane detection.
//
// To sell the "augmented reality" feeling without real tracking, we fake
// three cheap depth cues:
//   1. a spawn-in animation (grow from nothing + a light flash) when the
//      character first appears, ending in a jump-and-land
//   2. a ground shadow that moves with the character and shrinks/fades
//      while it's airborne
//   3. a simple perspective rule: the higher up the screen (further away)
//      the character stands, the smaller it's drawn; lower (closer to the
//      "camera") is bigger
//
// Gestures:
//   single tap/click  -> character walks to that spot
//   double tap/click  -> jump in place
//   long press        -> dance in place
//   feed button       -> throws food at the character immediately (repeatable)

const ArStage = (() => {
  const stage = document.getElementById('screen-ar');
  const video = document.getElementById('ar-video');
  const wrap = document.getElementById('character-wrap');   // position + depth
  const character = document.getElementById('character');    // gesture animations
  const characterImg = document.getElementById('character-img');
  const shadow = document.getElementById('char-shadow');
  const flash = document.getElementById('spawn-flash');
  const hint = document.getElementById('ar-hint');
  const feedBtn = document.getElementById('btn-feed');

  let stream = null;
  let currentFacingMode = 'environment';
  let tapTimer = null;
  let pressTimer = null;
  let longPressFired = false;
  let danceTimeout = null;
  let charX = 50, charY = 46; // current character position, in % of stage

  // Perspective: y=22% (near the top / "far") -> smaller, y=88% ("near") -> bigger.
  const DEPTH_Y_MIN = 22, DEPTH_Y_MAX = 88;
  const DEPTH_SCALE_MIN = 0.55, DEPTH_SCALE_MAX = 1.15;

  function depthForY(yPercent) {
    const t = (yPercent - DEPTH_Y_MIN) / (DEPTH_Y_MAX - DEPTH_Y_MIN);
    const clamped = Math.max(0, Math.min(1, t));
    return DEPTH_SCALE_MIN + clamped * (DEPTH_SCALE_MAX - DEPTH_SCALE_MIN);
  }

  function applyPosition() {
    wrap.style.left = charX + '%';
    wrap.style.top = charY + '%';
    wrap.style.setProperty('--depth', depthForY(charY).toFixed(3));
  }

  async function start(characterDataURL) {
    characterImg.src = characterDataURL;
    currentFacingMode = 'environment';
    charX = 50; charY = 46;
    wrap.style.transition = 'none'; // snap to start position, no slide-in from old spot
    applyPosition();
    void wrap.offsetWidth;
    wrap.style.transition = '';

    playSpawn();

    hint.style.display = 'block';
    setTimeout(() => { hint.style.display = 'none'; }, 4200);

    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacingMode },
          audio: false
        });
        video.srcObject = stream;
      } catch (err) {
        console.warn('카메라를 사용할 수 없어요', err);
        stage.style.background = 'linear-gradient(160deg,#bdeeff,#8fd9f4)';
      }
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  async function switchCamera() {
    const nextFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacingMode },
        audio: false
      });
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = newStream;
      currentFacingMode = nextFacingMode;
      video.srcObject = stream;
    } catch (err) {
      console.warn('카메라 전환에 실패했어요 (기기에 해당 카메라가 없을 수 있어요)', err);
      // keep the previous stream running — don't leave the student with no camera at all
    }
  }

  function clearGestureState() {
    character.classList.remove('jump', 'dance', 'spawn-in');
  }

  // grow from nothing + light burst, then settle with a jump-landing
  function playSpawn() {
    clearGestureState();
    shadow.style.opacity = '0';
    character.classList.add('spawn-in');
    flash.classList.remove('burst');
    void flash.offsetWidth;
    flash.classList.add('burst');

    setTimeout(() => {
      shadow.style.opacity = '';
      character.classList.remove('spawn-in');
      playJump();
    }, 480);
  }

  function playJump() {
    character.classList.remove('jump', 'dance');
    shadow.classList.remove('jump');
    void character.offsetWidth; // restart animation
    character.classList.add('jump');
    shadow.classList.add('jump');
    setTimeout(() => {
      character.classList.remove('jump');
      shadow.classList.remove('jump');
    }, 650);
  }

  function playDance() {
    character.classList.remove('jump', 'dance');
    character.classList.add('dance');
    clearTimeout(danceTimeout);
    danceTimeout = setTimeout(() => character.classList.remove('dance'), 3000);
  }

  function playEat() {
    character.classList.add('eat');
    setTimeout(() => character.classList.remove('eat'), 900);
  }

  function walkTo(xPercent, yPercent) {
    character.classList.remove('jump', 'dance');
    charX = xPercent; charY = yPercent;
    applyPosition();
  }

  function stageXY(evt) {
    const rect = stage.getBoundingClientRect();
    const point = evt.changedTouches ? evt.changedTouches[0] : evt;
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  // ---- feeding: tapping the button immediately throws food at the
  // character. Tapping it again (even mid-flight) throws another one. ----
  function throwFood() {
    const btnRect = feedBtn.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const x = ((btnRect.left + btnRect.width / 2) - stageRect.left) / stageRect.width * 100;
    const y = ((btnRect.top + btnRect.height / 2) - stageRect.top) / stageRect.height * 100;
    dropFood(x, y);

    feedBtn.classList.add('feeding-on');
    setTimeout(() => feedBtn.classList.remove('feeding-on'), 300);
  }

  function dropFood(x, y) {
    const food = document.createElement('div');
    food.className = 'food';
    food.style.left = x + '%';
    food.style.top = y + '%';
    food.textContent = '🍖';
    stage.appendChild(food);

    // kick off the CSS transition toward the character's current position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        food.style.left = charX + '%';
        food.style.top = charY + '%';
      });
    });

    setTimeout(() => {
      playEat();
      food.remove();
    }, 820);
  }

  function isOnCharacter(e) {
    return !!(e.target.closest && e.target.closest('#character-wrap'));
  }

  // ---- unified tap / double-tap / long-press handling ----
  // Jump and dance only fire when the gesture starts on the character
  // itself; taps anywhere else always just walk the character there.
  function onStageDown(e) {
    if (e.target.closest('.ar-controls') || e.target.closest('.ar-topbar')) return;
    longPressFired = false;
    if (isOnCharacter(e)) {
      pressTimer = setTimeout(() => {
        longPressFired = true;
        playDance();
      }, 550);
    }
  }

  function onStageUp(e) {
    if (e.target.closest('.ar-controls') || e.target.closest('.ar-topbar')) return;
    clearTimeout(pressTimer);
    if (longPressFired) return;

    const { x, y } = stageXY(e);

    if (isOnCharacter(e)) {
      if (tapTimer) {
        clearTimeout(tapTimer);
        tapTimer = null;
        playJump(); // second tap on the character within the window = jump
        return;
      }
      tapTimer = setTimeout(() => {
        tapTimer = null;
        walkTo(x, y);
      }, 260);
    } else {
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
      walkTo(x, y);
    }
  }

  function capturePhoto() {
    const canvas = document.getElementById('capture-canvas');
    const videoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    const vw = videoReady ? video.videoWidth : 720;
    const vh = videoReady ? video.videoHeight : 720;
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext('2d');

    if (videoReady) {
      try {
        ctx.drawImage(video, 0, 0, vw, vh);
      } catch (err) {
        console.warn('카메라 프레임을 그리지 못했어요, 배경으로 대체합니다', err);
        drawFallbackBackground(ctx, vw, vh);
      }
    } else {
      // camera never started (permission denied / still loading) — still
      // give the student a photo instead of failing silently
      drawFallbackBackground(ctx, vw, vh);
    }

    // The video is shown with object-fit:cover, which crops it to fill the
    // stage while keeping its own aspect ratio, using ONE uniform scale
    // factor. We must use that same single scale factor when placing the
    // character, or its width/height end up stretched unevenly.
    const stageRect = stage.getBoundingClientRect();
    const cw = stageRect.width, ch = stageRect.height;
    const scale = Math.max(cw / vw, ch / vh);
    const dispW = vw * scale, dispH = vh * scale;
    const offsetX = (dispW - cw) / 2;
    const offsetY = (dispH - ch) / 2;

    const charRect = character.getBoundingClientRect();
    const sx = charRect.left - stageRect.left;
    const sy = charRect.top - stageRect.top;

    const nativeX = (sx + offsetX) / scale;
    const nativeY = (sy + offsetY) / scale;
    const nativeW = charRect.width / scale;
    const nativeH = charRect.height / scale;

    try {
      ctx.drawImage(characterImg, nativeX, nativeY, nativeW, nativeH);
    } catch (err) {
      console.warn('캐릭터를 사진에 합성하지 못했어요', err);
    }
    return canvas.toDataURL('image/png');
  }

  function drawFallbackBackground(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#bdeeff');
    grad.addColorStop(1, '#8fd9f4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function init() {
    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('pointerup', onStageUp);
    stage.addEventListener('pointercancel', onStageUp);

    feedBtn.addEventListener('click', (e) => { e.stopPropagation(); throwFood(); });

    const switchBtn = document.getElementById('btn-switch-camera');
    switchBtn.addEventListener('click', (e) => { e.stopPropagation(); switchCamera(); });
  }

  return { init, start, stop, capturePhoto };
})();
