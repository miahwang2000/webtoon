// ar.js — no WebXR, no markers: just the camera feed as a background and
// the drawn character as a positioned <img> the student can tap, double
// tap, long-press, and feed. This keeps AR working the same way on every
// tablet, including iPad Safari, since it never needs plane detection.
//
// Gestures:
//   single tap/click   -> character walks to that spot
//   double tap/click   -> jump in place
//   long press         -> dance in place
//   feeding mode + tap -> food flies from the tap point to the character

const ArStage = (() => {
  const stage = document.getElementById('screen-ar');
  const video = document.getElementById('ar-video');
  const character = document.getElementById('character');
  const characterImg = document.getElementById('character-img');
  const hint = document.getElementById('ar-hint');
  const feedBtn = document.getElementById('btn-feed');

  let stream = null;
  let feedingMode = false;
  let tapTimer = null;
  let pressTimer = null;
  let longPressFired = false;
  let danceTimeout = null;
  let charX = 50, charY = 48; // current character position, in % of stage

  async function start(characterDataURL) {
    characterImg.src = characterDataURL;
    resetPosition();
    hint.style.display = 'block';
    setTimeout(() => { hint.style.display = 'none'; }, 4000);

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
    charX = 50; charY = 48;
    character.style.left = charX + '%';
    character.style.top = charY + '%';
  }

  function clearGestureState() {
    character.classList.remove('jump', 'dance');
  }

  function playJump() {
    clearGestureState();
    void character.offsetWidth; // restart animation
    character.classList.add('jump');
    setTimeout(() => character.classList.remove('jump'), 650);
  }

  function playDance() {
    clearGestureState();
    character.classList.add('dance');
    clearTimeout(danceTimeout);
    danceTimeout = setTimeout(() => character.classList.remove('dance'), 3000);
  }

  function playEat() {
    character.classList.add('eat');
    setTimeout(() => character.classList.remove('eat'), 900);
  }

  function walkTo(xPercent, yPercent) {
    clearGestureState();
    charX = xPercent; charY = yPercent;
    character.style.left = charX + '%';
    character.style.top = charY + '%';
  }

  function stageXY(evt) {
    const rect = stage.getBoundingClientRect();
    const point = evt.changedTouches ? evt.changedTouches[0] : evt;
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  // ---- feeding: food travels FROM the tap point TO the character ----
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

    feedingMode = false;
    feedBtn.classList.remove('feeding-on');
  }

  // ---- unified tap / double-tap / long-press handling on the whole stage ----
  function onStageDown(e) {
    if (e.target.closest('.ar-controls') || e.target.closest('.ar-topbar')) return;
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      playDance();
    }, 550);
  }

  function onStageUp(e) {
    if (e.target.closest('.ar-controls') || e.target.closest('.ar-topbar')) return;
    clearTimeout(pressTimer);
    if (longPressFired) return;

    const { x, y } = stageXY(e);

    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
      playJump(); // second tap within window = double tap = jump
      return;
    }
    tapTimer = setTimeout(() => {
      tapTimer = null;
      if (feedingMode) {
        dropFood(x, y);
      } else {
        walkTo(x, y);
      }
    }, 260);
  }

  function capturePhoto() {
    const canvas = document.getElementById('capture-canvas');
    const vw = video.videoWidth || 720, vh = video.videoHeight || 720;
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);

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

    ctx.drawImage(characterImg, nativeX, nativeY, nativeW, nativeH);
    return canvas.toDataURL('image/png');
  }

  function init() {
    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('pointerup', onStageUp);
    stage.addEventListener('touchstart', onStageDown, { passive: true });
    stage.addEventListener('touchend', onStageUp);

    feedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFeeding(); });
  }

  return { init, start, stop, capturePhoto };
})();
