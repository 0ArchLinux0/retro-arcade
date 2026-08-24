// ============================================================
// Game 9 — FLAPPY WING (Flappy Bird-style one-tap flyer)
// Tap to flap, thread the pipes.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.flappy = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const GRAV = 1500, FLAP_VY = -420, MAX_VY = 620;
  const PIPE_W = 62, GAP_BASE = 175, GAP_MIN = 128;
  const SPEED_BASE = 150;

  let bird, pipes, score, best_, started, over, groundX, scrollT, spawnT;
  let clouds;

  function reset() {
    bird = { x: VW * 0.32, y: VH * 0.42, vy: 0, rot: 0 };
    pipes = [];
    score = 0; started = false; over = false;
    groundX = 0; scrollT = 0; spawnT = 0;
    clouds = [];
    for (let i = 0; i < 5; i++) {
      clouds.push({ x: Math.random() * VW, y: 60 + Math.random() * 220, s: 0.4 + Math.random() * 0.7 });
    }
  }

  function flap() {
    if (over) return;
    if (!started) { started = true; }
    bird.vy = FLAP_VY;
    sfx.jump();
    burst(bird.x - 10, bird.y + 8, { n: 3, colors: ['#fff', '#ffe066'], speed: 40, size: 3, grav: 40 });
  }

  function die() {
    over = true;
    sfx.die();
    shake(8, 0.45);
    burst(bird.x, bird.y, { n: 22, colors: ['#ffe066', '#ff8844', '#fff'], speed: 190 });
    RA.submitScore('flappy', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   BEST ${RA.best('flappy')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function update(dt) {
    // background always scrolls a bit for life
    for (const c of clouds) {
      c.x -= (8 + c.s * 12) * dt;
      if (c.x < -60) { c.x = VW + 30; c.y = 50 + Math.random() * 230; }
    }

    if (!started) {
      bird.y = VH * 0.42 + Math.sin(performance.now() / 300) * 9;
      return;
    }
    if (over) {
      bird.vy = Math.min(MAX_VY, bird.vy + GRAV * dt);
      bird.y += bird.vy * dt;
      bird.rot = Math.min(Math.PI / 2, bird.rot + 3 * dt);
      if (bird.y > VH - 64) bird.y = VH - 64;
      return;
    }

    // flap on any fresh press/tap
    if (input.justPressed) { flap(); input.justPressed = false; }
    const taps = input.consumeTaps();
    if (taps.length > 0) flap();

    // physics
    bird.vy = Math.min(MAX_VY, bird.vy + GRAV * dt);
    bird.y += bird.vy * dt;
    bird.rot = Math.max(-0.5, Math.min(Math.PI / 2, bird.vy / 700));

    // difficulty ramp
    scrollT += dt;
    const speed = SPEED_BASE + Math.min(90, scrollT * 2.2);
    const gap = Math.max(GAP_MIN, GAP_BASE - score * 1.6);

    // spawn pipes
    spawnT -= dt;
    if (spawnT <= 0) {
      const margin = 70;
      const cy = margin + Math.random() * (VH - 130 - margin * 2);
      pipes.push({ x: VW + PIPE_W, cy, gap, scored: false });
      spawnT = (PIPE_W + 118) / speed;
    }

    // move pipes
    groundX = (groundX - speed * dt) % 24;
    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= speed * dt;
      if (p.x < -PIPE_W - 10) { pipes.splice(i, 1); continue; }

      // scoring
      if (!p.scored && p.x + PIPE_W < bird.x - 12) {
        p.scored = true;
        score++;
        sfx.coin();
        floatText(bird.x + 26, bird.y - 20, '+1', '#ffe066');
        RA.setScore(score);
      }

      // collide
      const bx = bird.x, by = bird.y, br = 11;
      if (bx + br > p.x && bx - br < p.x + PIPE_W) {
        if (by - br < p.cy - p.gap / 2 || by + br > p.cy + p.gap / 2) { die(); return; }
      }
    }

    // ceiling/floor
    if (bird.y < 14) { bird.y = 14; bird.vy = Math.max(bird.vy, 0); }
    if (bird.y > VH - 76) { die(); return; }
  }

  function init() {
    RA.setHUD('FLAPPY WING', 'flappy');
    reset();
    RA.showOverlay({
      title: 'FLAPPY WING',
      sub: 'TAP TO FLAP',
      lines: ['탭할 때마다 위로 힘차게!', '파이프 사이를 빠져나가 점수를 쌓아보세요'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = false;
    RA.audio.playBGM('flappy');
  }

  function draw(g) {
    // sky
    g.fillStyle = '#101a3a';
    g.fillRect(0, 0, VW, VH);
    // stars
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97) % VW, sy = (i * 61) % (VH - 120);
      g.fillRect(sx, sy, 2, 2);
    }
    // clouds
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (const c of clouds) {
      g.beginPath();
      g.arc(c.x, c.y, 22 * c.s + 10, 0, Math.PI * 2);
      g.arc(c.x + 24 * c.s, c.y + 6, 16 * c.s + 8, 0, Math.PI * 2);
      g.arc(c.x - 24 * c.s, c.y + 8, 14 * c.s + 7, 0, Math.PI * 2);
      g.fill();
    }

    // pipes — neon style
    for (const p of pipes) {
      const topH = p.cy - p.gap / 2;
      const botY = p.cy + p.gap / 2;
      g.fillStyle = '#7dff8a';
      g.fillRect(p.x, 0, PIPE_W, topH);
      g.fillRect(p.x, botY, PIPE_W, VH - botY - 56);
      g.fillStyle = '#3fae63';
      g.fillRect(p.x, topH - 14, PIPE_W, 14);
      g.fillRect(p.x, botY, PIPE_W, 14);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(p.x + 4, 0, 6, topH);
      g.fillRect(p.x + 4, botY + 14, 6, VH - botY - 74);
    }

    // ground
    g.fillStyle = '#2ecf5f';
    g.fillRect(0, VH - 56, VW, 56);
    g.fillStyle = '#1c8f3f';
    for (let x = groundX; x < VW; x += 24) {
      g.fillRect(x, VH - 56, 12, 8);
    }
    g.fillStyle = '#157032';
    g.fillRect(0, VH - 48, VW, 48);

    // bird
    g.save();
    g.translate(bird.x, bird.y);
    g.rotate(bird.rot);
    g.fillStyle = '#ffe066';
    g.fillRect(-11, -9, 22, 18);
    g.fillStyle = '#ff8844';
    g.fillRect(-13, -4, 6, 8);          // tail
    g.fillRect(6, -3, 8, 6);            // beak
    g.fillStyle = '#fff';
    g.fillRect(1, -6, 6, 6);            // eye
    g.fillStyle = '#000';
    g.fillRect(4, -5, 3, 3);
    // wing flaps with time
    const wing = Math.sin(performance.now() / 80) * 4;
    g.fillStyle = '#ffd166';
    g.fillRect(-6, wing, 12, 5);
    g.restore();

    // big center score while playing
    if (started && !over) {
      g.globalAlpha = 0.85;
      g.fillStyle = '#fff';
      g.font = 'bold 34px monospace';
      g.textAlign = 'center';
      g.fillText(String(score), VW / 2, 92);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }
  }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
    const resumeHook = setInterval(() => {
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!over) RA.audio.playBGM(started ? 'flappy' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause };
})();
