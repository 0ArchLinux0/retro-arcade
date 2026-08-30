// ============================================================
// Game 24 — ARROW RAIN (rain of falling targets; aim + fire)
// Tap-and-hold to aim a bow, release to fire an arrow. Hit as
// many targets as possible; don't let them reach the bottom.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.arrowrain = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const BOW_X = VW / 2;
  const BOW_Y = VH - 60;
  const ARROW_V = 600;
  const TARGET_V = 100;
  const SPAWN_INTERVAL_BASE = 1.1;
  const FIRE_COOLDOWN = 0.2;

  let arrows, targets, score, lives, started, over;
  let spawnT, spawnInterval, lastFireT, t;
  let bowAng;

  function reset() {
    arrows = [];
    targets = [];
    score = 0;
    lives = 5;
    started = false; over = false;
    spawnT = 0; spawnInterval = SPAWN_INTERVAL_BASE;
    lastFireT = 0; t = 0;
    bowAng = -Math.PI / 2;
    RA.setScore(0);
  }

  function readInput() {
    const taps = input.consumeTaps();
    if (!started && !over && taps.length > 0) { started = true; return; }
    if (over) return;
    if (input.isDown) {
      const dx = input.x - BOW_X, dy = input.y - BOW_Y;
      bowAng = Math.atan2(dy, dx);
    }
    if (taps.length > 0 && t - lastFireT > FIRE_COOLDOWN) {
      arrows.push({
        x: BOW_X + Math.cos(bowAng) * 18,
        y: BOW_Y + Math.sin(bowAng) * 18,
        vx: Math.cos(bowAng) * ARROW_V,
        vy: Math.sin(bowAng) * ARROW_V
      });
      lastFireT = t;
      sfx.hit();
    }
  }

  function step(dt) {
    if (over || !started) return;
    t += dt;
    spawnT += dt;
    if (spawnT >= spawnInterval) {
      spawnT = 0;
      targets.push({
        x: 20 + Math.random() * (VW - 40),
        y: 60,
        vx: 0,
        vy: TARGET_V + Math.random() * 30,
        r: 12 + Math.random() * 6
      });
    }
    spawnInterval = Math.max(0.4, SPAWN_INTERVAL_BASE - t * 0.005);
    for (const a of arrows) { a.x += a.vx * dt; a.y += a.vy * dt; }
    for (const tg of targets) { tg.y += tg.vy * dt; }
    // arrow-target collisions
    for (let ai = arrows.length - 1; ai >= 0; ai--) {
      const a = arrows[ai];
      for (let ti = targets.length - 1; ti >= 0; ti--) {
        const tg = targets[ti];
        const d = Math.hypot(a.x - tg.x, a.y - tg.y);
        if (d < tg.r + 4) {
          burst(tg.x, tg.y, 12, '#f9f002');
          arrows.splice(ai, 1);
          targets.splice(ti, 1);
          score += 10;
          sfx.confirm();
          break;
        }
      }
    }
    // target escapes
    for (let ti = targets.length - 1; ti >= 0; ti--) {
      if (targets[ti].y > VH) {
        targets.splice(ti, 1);
        lives--;
        shake(4, 0.2);
        sfx.die();
        if (lives <= 0) { end(); return; }
      }
    }
    // arrow out of bounds
    for (let i = arrows.length - 1; i >= 0; i--) {
      if (arrows[i].y < 0 || arrows[i].x < 0 || arrows[i].x > VW) arrows.splice(i, 1);
    }
    RA.setScore(score);
  }

  function end() {
    over = true;
    RA.submitScore('arrowrain', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'OUT OF LIVES',
        sub: `SCORE ${score}   BEST ${RA.best('arrowrain')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 200);
  }

  function drawImpl(ctx) {
  const g = ctx;
    g.fillStyle = '#0a0420';
    g.fillRect(0, 0, VW, VH);
    // targets
    for (const tg of targets) {
      g.fillStyle = '#ff3355';
      g.beginPath();
      g.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.stroke();
    }
    // arrows
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    for (const a of arrows) {
      const ang = Math.atan2(a.vy, a.vx);
      g.save();
      g.translate(a.x, a.y);
      g.rotate(ang);
      g.beginPath();
      g.moveTo(8, 0); g.lineTo(-6, -3); g.lineTo(-6, 3); g.closePath();
      g.stroke();
      g.restore();
    }
    // bow
    g.save();
    g.translate(BOW_X, BOW_Y);
    g.rotate(bowAng + Math.PI / 2);
    g.strokeStyle = '#f9f002';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 18, -0.7, 0.7);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -22); g.lineTo(0, 22);
    g.stroke();
    g.restore();
    // HUD
    g.fillStyle = '#fff';
    g.font = 'bold 12px monospace';
    g.textAlign = 'left';
    g.fillText('♥ ' + lives, 12, 18);
    g.textAlign = 'right';
    g.fillText('SCORE ' + score, VW - 12, 18);
    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('탭으로 시작 · 드래그로 조준 · 떼면 발사', VW / 2, VH / 2);
    }
  }

  function init() { reset(); }
  function update(dt) { readInput(); step(dt); }
  function draw(ctx) { drawImpl(ctx); }
  function onStart() { RA.audio.playBGM('shooter'); RA.hideOverlay(); }
  function onPause() {
    RA.showOverlay({ title: 'PAUSED', tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }] });
    RA.audio.stopBGM();
    const h = setInterval(() => { if (!RA.isOverlayOpen()) { clearInterval(h); if (!over) RA.audio.playBGM('shooter'); } }, 250);
  }

  function debug() {
    return {
      get arrows() { return arrows; },
      get targets() { return targets; },
      get score() { return score; },
      get lives() { return lives; },
      get over() { return over; },
      get started() { return started; },
      get bowAng() { return bowAng; },
      fire(ang) { bowAng = ang || -Math.PI/2; arrows.push({ x: BOW_X, y: BOW_Y, vx: Math.cos(bowAng)*ARROW_V, vy: Math.sin(bowAng)*ARROW_V }); },
    };
  }

  return { init, update, draw: draw, onStart, onPause, debug };
})();
