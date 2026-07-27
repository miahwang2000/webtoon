// minigame.js — a small, dependency-free endless runner (Chrome-dino style):
// the student's own drawn character auto-runs, a tap makes it jump over
// obstacles, and the score is how far it gets. No camera, no game engine —
// just Canvas 2D + requestAnimationFrame, so it stays light and never runs
// at the same time as the AR camera view.

const ArGame = (() => {
  const GAME_W = 960, GAME_H = 540;
  const GROUND_Y = GAME_H - 110;
  const CEILING_Y = 20;
  const GRAVITY = 2600;
  const RISE_SPEED = -560;      // constant upward speed while the screen is held
  const RISE_SMOOTHING = 10;    // how quickly vy eases toward RISE_SPEED (higher = snappier)
  const BASE_SPEED = 340;
  const MAX_SPEED = 640;
  const SPEED_RAMP = 3.2; // px/sec added per second survived
  const BEST_SCORE_KEY = 'ar_minigame_best';
  const START_LIVES = 3;
  const INVINCIBLE_TIME = 1.6; // seconds of safety + flashing after getting hit
  const ITEM_SCORE = 30;

  let holding = false;
  let canvas, ctx;
  let charImg = null;       // trimmed character image (offscreen canvas)
  let charAspect = 1;       // width/height of the trimmed character
  let rafId = null;
  let lastTs = 0;
  let state = 'ready';      // 'ready' | 'playing' | 'gameover'
  let onScoreChange = null;
  let onGameOver = null;
  let onLivesChange = null;

  let player, obstacles, items, score, speed, distanceSinceSpawn, nextSpawnAt,
    itemDistanceSinceSpawn, itemNextSpawnAt, groundScrollX;

  function trimTransparent(img) {
    const off = document.createElement('canvas');
    off.width = img.naturalWidth || img.width;
    off.height = img.naturalHeight || img.height;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0);

    let data;
    try {
      data = octx.getImageData(0, 0, off.width, off.height).data;
    } catch (e) {
      return img; // fall back to the untrimmed image if pixel access fails
    }

    let minX = off.width, minY = off.height, maxX = 0, maxY = 0;
    for (let y = 0; y < off.height; y += 2) {
      for (let x = 0; x < off.width; x += 2) {
        const alpha = data[(y * off.width + x) * 4 + 3];
        if (alpha > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) return img; // nothing found, bail out safely

    const pad = 4;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(off.width, maxX + pad); maxY = Math.min(off.height, maxY + pad);
    const w = maxX - minX, h = maxY - minY;

    const trimmed = document.createElement('canvas');
    trimmed.width = w; trimmed.height = h;
    trimmed.getContext('2d').drawImage(off, minX, minY, w, h, 0, 0, w, h);
    return trimmed;
  }

  function loadCharacter(dataURL) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        charImg = trimTransparent(img);
        charAspect = charImg.width / charImg.height;
        resolve();
      };
      img.onerror = () => resolve(); // keep going even if something's wrong
      img.src = dataURL;
    });
  }

  function newPlayer() {
    const h = 128, w = h * charAspect;
    return {
      x: 90, y: GROUND_Y - h, w, h, vy: 0, grounded: true, runPhase: 0,
      lives: START_LIVES, invincibleTimer: 0
    };
  }

  function resetRun() {
    player = newPlayer();
    obstacles = [];
    items = [];
    score = 0;
    speed = BASE_SPEED;
    distanceSinceSpawn = 0;
    nextSpawnAt = 260 + Math.random() * 220;
    itemDistanceSinceSpawn = 0;
    itemNextSpawnAt = 320 + Math.random() * 260;
    groundScrollX = 0;
    holding = false;
  }

  function bestScore() {
    const v = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBestIfNeeded(finalScore) {
    if (finalScore > bestScore()) {
      try { localStorage.setItem(BEST_SCORE_KEY, String(finalScore)); } catch (e) { /* ignore */ }
    }
  }

  function setHolding(v) {
    holding = v;
  }

  function spawnObstacle() {
    const h = 46 + Math.random() * 34;
    const w = 32 + Math.random() * 20;
    const palette = ['#ff6f59', '#4caf7d', '#8c6ff0', '#37c6c0'];
    obstacles.push({
      x: GAME_W + 20, y: GROUND_Y - h, w, h,
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }

  function spawnItem() {
    // sometimes low (grab it while running), sometimes high (needs a jump)
    const high = Math.random() < 0.55;
    const size = 34;
    const y = high ? GROUND_Y - 190 - Math.random() * 40 : GROUND_Y - 56;
    items.push({ x: GAME_W + 20, y, w: size, h: size, bob: Math.random() * Math.PI * 2 });
  }

  function rectsOverlap(a, b, pad) {
    return a.x + pad < b.x + b.w - pad &&
      a.x + a.w - pad > b.x + pad &&
      a.y + pad < b.y + b.h - pad &&
      a.y + a.h - pad > b.y + pad;
  }

  function update(dt) {
    speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt);
    score += dt * (speed / 12);

    if (player.invincibleTimer > 0) player.invincibleTimer -= dt;

    // physics — hold to float upward (eased), release and gravity takes over
    if (holding) {
      player.vy += (RISE_SPEED - player.vy) * Math.min(1, RISE_SMOOTHING * dt);
    } else {
      player.vy += GRAVITY * dt;
    }
    player.y += player.vy * dt;

    const floorY = GROUND_Y - player.h;
    if (player.y >= floorY) {
      player.y = floorY;
      player.vy = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }
    if (player.y <= CEILING_Y) {
      player.y = CEILING_Y;
      if (player.vy < 0) player.vy = 0;
    }
    player.runPhase += dt * (player.grounded ? speed / 40 : 0);

    // obstacles
    distanceSinceSpawn += speed * dt;
    if (distanceSinceSpawn >= nextSpawnAt) {
      distanceSinceSpawn = 0;
      nextSpawnAt = 260 + Math.random() * 260;
      spawnObstacle();
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed * dt;
      if (obstacles[i].x + obstacles[i].w < -20) obstacles.splice(i, 1);
    }

    // items
    itemDistanceSinceSpawn += speed * dt;
    if (itemDistanceSinceSpawn >= itemNextSpawnAt) {
      itemDistanceSinceSpawn = 0;
      itemNextSpawnAt = 320 + Math.random() * 300;
      spawnItem();
    }
    for (let i = items.length - 1; i >= 0; i--) {
      items[i].x -= speed * dt;
      items[i].bob += dt * 4;
      if (items[i].x + items[i].w < -20) { items.splice(i, 1); continue; }
    }

    groundScrollX = (groundScrollX - speed * dt) % 60;

    // item collection (generous hitbox — these are a treat, not a challenge)
    const playerBox = { x: player.x, y: player.y, w: player.w, h: player.h };
    for (let i = items.length - 1; i >= 0; i--) {
      if (rectsOverlap(playerBox, items[i], -6)) {
        items.splice(i, 1);
        score += ITEM_SCORE;
      }
    }

    // obstacle collision — costs a life instead of ending the run outright
    if (player.invincibleTimer <= 0) {
      for (const o of obstacles) {
        if (rectsOverlap(playerBox, o, 10)) {
          handleHit();
          break;
        }
      }
    }

    if (onScoreChange) onScoreChange(Math.floor(score));
  }

  function handleHit() {
    player.lives -= 1;
    if (onLivesChange) onLivesChange(player.lives);
    if (player.lives <= 0) {
      endGame();
      return;
    }
    // brief safety window so they don't instantly lose another life,
    // and clear the immediate obstacles so it feels like a fair restart
    player.invincibleTimer = INVINCIBLE_TIME;
    obstacles = obstacles.filter(o => o.x > player.x + player.w + 260);
  }

  function drawCloud(x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, 22 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 20 * s, y + 4 * s, 16 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 18 * s, y + 5 * s, 15 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render() {
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    // sky + clouds
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_H);
    sky.addColorStop(0, '#bdeeff');
    sky.addColorStop(1, '#eaf9ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    drawCloud(140, 90, 1);
    drawCloud(560, 60, 1.3);
    drawCloud(800, 120, 0.9);

    // ground
    ctx.fillStyle = '#8bd17c';
    ctx.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);
    ctx.strokeStyle = 'rgba(43,42,76,.25)';
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 20]);
    ctx.lineDashOffset = groundScrollX;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 6);
    ctx.lineTo(GAME_W, GROUND_Y + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // items (bobbing stars)
    items.forEach(it => {
      const bobY = it.y + Math.sin(it.bob) * 8;
      ctx.save();
      ctx.font = `${it.h}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', it.x + it.w / 2, bobY + it.h / 2);
      ctx.restore();
    });

    // obstacles (rounded crayon-block look)
    obstacles.forEach(o => {
      ctx.fillStyle = o.color;
      roundRect(o.x, o.y, o.w, o.h, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(26,26,46,.35)';
      ctx.lineWidth = 3;
      roundRect(o.x, o.y, o.w, o.h, 8);
      ctx.stroke();
    });

    drawPlayer();
  }

  function drawPlayer() {
    if (!charImg) return;
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;

    ctx.save();
    ctx.translate(cx, cy);

    if (player.invincibleTimer > 0) {
      // blink while briefly invulnerable after a hit
      const blink = Math.sin(player.invincibleTimer * 24) > 0;
      ctx.globalAlpha = blink ? 1 : 0.35;
    }

    if (!player.grounded) {
      // airborne: lean back slightly + stretch, classic jump squash/stretch
      const t = Math.max(-1, Math.min(1, player.vy / 700));
      ctx.rotate(-t * 0.12);
      ctx.scale(1 - Math.abs(t) * 0.06, 1 + Math.abs(t) * 0.08);
    } else {
      // grounded: bouncy running cycle
      const bob = Math.sin(player.runPhase) * 0.05;
      const squash = 1 + Math.sin(player.runPhase * 2) * 0.035;
      ctx.translate(0, bob * player.h);
      ctx.scale(1 / squash, squash);
    }

    ctx.drawImage(charImg, -player.w / 2, -player.h / 2, player.w, player.h);
    ctx.restore();
  }

  function endGame() {
    state = 'gameover';
    saveBestIfNeeded(Math.floor(score));
    stopLoop();
    if (onGameOver) onGameOver(Math.floor(score), bestScore());
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000); // clamp to avoid big jumps on tab switch
    lastTs = ts;

    if (state === 'playing') update(dt);
    render();

    if (state === 'playing') rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = 0;
  }

  function resizeCanvas() {
    canvas.width = GAME_W;
    canvas.height = GAME_H;
  }

  async function init(canvasEl, characterDataURL, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onScoreChange = (callbacks && callbacks.onScoreChange) || null;
    onGameOver = (callbacks && callbacks.onGameOver) || null;
    onLivesChange = (callbacks && callbacks.onLivesChange) || null;
    resizeCanvas();
    await loadCharacter(characterDataURL);
    resetRun();
    state = 'ready';
    render();
  }

  function startRun() {
    resetRun();
    state = 'playing';
    lastTs = 0;
    if (onLivesChange) onLivesChange(player.lives);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    state = 'ready';
    stopLoop();
  }

  return { init, startRun, setHolding, stop, bestScore, startLives: START_LIVES };
})();
