// ar.js — no WebXR, no markers: just the camera feed as a background and
// the drawn character as a positioned <img> the student can tap, double
// tap, long-press, and feed. This keeps AR working the same way on every
// tablet, including iPad Safari, since it never needs plane detection.

const ArStage = (() => {
  const stage = document.getElementById('screen-ar');
  const video = document.getElementById('ar-video');
  const character = document.getElementById('character');
  const characterImg = document.getElementById('character-img');
  const hint = document.getElementById('ar-hint');
  const feedBtn = document.getElementById('btn-feed');
  const photoBtn = document.getElementById('btn-photo');

  let stream = null;
  let feedingMode = false;
  let tapTimer = null;
  let pressTimer = null;
  let longPressFired = false;
  let danceTimeout = null;

  async function start(characterDataURL) {
    characterImg.src = characterDataURL;
    resetPosition();
    hint.style.display = 'block';
    setTimeout(() => { hint.style.display = 'none'; }, 3500);

    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
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

  function resetPosition() {
    character.style.left = '50%';
    character.style.top = '48%';
  }

  function clearGestureState() {
    character.classList.remove('jump', 'spin', 'dance');
  }

  function playJump() {
    clearGestureState();
    void character.offsetWidth; // restart animation
    character.classList.add('jump');
    setTimeout(() => character.classList.remove('jump'), 650);
  }

  function playSpin() {
    clearGestureState();
    void character.offsetWidth;
    character.classList.add('spin');
    setTimeout(() => character.classList.remove('spin'), 700);
  }

  function playDance() {
    clearGestureState();
    character.classList.add('dance');
    clearTimeout(danceTimeout);
    danceTimeout = setTimeout(() => character.classList.remove('dance'), 3000);
  }

  function moveTo(xPercent, yPercent) {
    character.style.left = xPercent + '%';
    character.style.top = yPercent + '%';
  }

  function stageXY(evt) {
    const rect = stage.getBoundingClientRect();
    const point = evt.changedTouches ? evt.changedTouches[0] : evt;
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  // ---- character gesture handling (tap / double tap / long press) ----
  function onCharacterDown(e) {
    e.stopPropagation();
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      playDance();
    }, 550);
  }
  function onCharacterUp(e) {
    e.stopPropagation();
    clearTimeout(pressTimer);
    if (longPressFired) return;

    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
      playSpin(); // second tap within window = double tap
    } else {
      tapTimer = setTimeout(() => {
        playJump(); // single tap confirmed
        tapTimer = null;
      }, 260);
    }
  }

  // ---- feeding ----
  function toggleFeeding() {
    feedingMode = !feedingMode;
    feedBtn.classList.toggle('feeding-on', feedingMode);
  }

  function dropFood(x, y) {
    const food = document.createElement('div');
    food.className = 'food';
    food.style.left = x + '%';
    food.style.top = y + '%';
    food.textContent = '🍖';
    stage.appendChild(food);

    moveTo(x, y);
    clearGestureState();

    const travel = 900;
    setTimeout(() => {
      character.classList.add('eat');
      setTimeout(() => character.classList.remove('eat'), 900);
      food.remove();
    }, travel);

    feedingMode = false;
    feedBtn.classList.remove('feeding-on');
  }

  function onStageTap(e) {
    if (e.target === character || character.contains(e.target)) return;
    if (!feedingMode) return;
    const { x, y } = stageXY(e);
    dropFood(x, y);
  }

  function capturePhoto() {
    const canvas = document.getElementById('capture-canvas');
    const vw = video.videoWidth || 720, vh = video.videoHeight || 720;
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);

    // place the character onto the still frame at its current relative spot
    const rect = character.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const relX = (rect.left - stageRect.left) / stageRect.width;
    const relY = (rect.top - stageRect.top) / stageRect.height;
    const relW = rect.width / stageRect.width;
    const relH = rect.height / stageRect.height;

    ctx.drawImage(
      characterImg,
      relX * vw, relY * vh, relW * vw, relH * vh
    );
    return canvas.toDataURL('image/png');
  }

  function init() {
    character.addEventListener('pointerdown', onCharacterDown);
    character.addEventListener('pointerup', onCharacterUp);
    character.addEventListener('touchstart', onCharacterDown, { passive: true });
    character.addEventListener('touchend', onCharacterUp);

    stage.addEventListener('pointerdown', onStageTap);
    stage.addEventListener('touchstart', onStageTap, { passive: true });

    feedBtn.addEventListener('click', toggleFeeding);
  }

  return { init, start, stop, capturePhoto, photoBtn };
})();
