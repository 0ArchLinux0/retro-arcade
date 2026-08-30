// ============================================================
// Game 21 — ASTRO DODGE (asteroids in 360°, ship rotates, fires)
// Drag finger to rotate, tap to fire. Survive the asteroid field.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.astro = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;
  const CX = VW / 2, CY = VH * 0.55;
  const SHIP_R = 9, SHIP_VMAX = 220;
  const AST_R = 14, AST_VMIN = 60, AST_VMAX = 130;
  const FIRE_COOLDOWN = 0.18;
  const INVUL = 1.0;

  let ship, asteroids, bullets, lastTap, score, started, over, t, invT;
  let driftAng, prevDriftAng;

  function spawnAsteroid() {
    // spawn from the rim of an off-screen circle
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.max(VW, VH) * 0.7;
    return {
      x: CX + Math.cos(ang) * dist,
      y: CY + Math.sin(ang) * dist,
      vx: -Math.cos(ang) * (AST_VMIN + Math.random() * (AST_VMAX - AST_VMIN)),
      vy: -Math.sin(ang) * (AST_VMIN + Math.random() * (AST_VMAX - AST_VMIN)),
      r: AST_R + Math.random() * 6,
      spin: (Math.random() - 0.5) * 2,
      ang: 0
    };
  }

  function reset() {
    ship = { x: CX, y: CY, vx: 0, vy: 0, ang: -Math.PI / 2 };
    asteroids = [];
    bullets = [];
    lastTap = 0;
    score = 0;
    started = false; over = false; t = 0; invT = 0;
    driftAng = 0; prevDriftAng = 0;
    // seed a few
    for (let i = 0; i < 4; i++) asteroids.push(spawnAsteroid());
    RA.setScore(0);
  }

  function readInput() {
    const taps = input.consumeTaps();
    if (!started && !over && taps.length > 0) { started = true; return; }
    if (!started || over) return;
    // Hold = thrust. Compute desired angle from input relative to ship.
    const dx = input.x - ship.x, dy = input.y - ship.y;
    if (input.isDown) {
      const a = Math.atan2(dy, dx);
      ship.ang = a;
      // thrust in that direction
      ship.vx += Math.cos(a) * 6;
      ship.vy += Math.sin(a) * 6;
    }
    // Fire on tap
    if (taps.length > 0 && t - lastTap > FIRE_COOLDOWN) {
      bullets.push({
        x: ship.x + Math.cos(ship.ang) * SHIP_R,
        y: ship.y + Math.sin(ship.ang) * SHIP_R,
        vx: Math.cos(ship.ang) * 360,
        vy: Math.sin(ship.ang) * 360,
        life: 1.4
      });
      lastTap = t;
      sfx.hit();
    }
  }

  function step(dt) {
    if (over) return;
    if (!started) return;
    t += dt;
    invT = Math.max(0, invT - dt);

    // Cap velocity
    const vmag = Math.hypot(ship.vx, ship.vy);
    if (vmag > SHIP_VMAX) {
      ship.vx = ship.vx / vmag * SHIP_VMAX;
      ship.vy = ship.vy / vmag * SHIP_VMAX;
    }
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    ship.vx *= 0.992;
    ship.vy *= 0.992;
    // Keep ship on screen
    if (ship.x < SHIP_R) { ship.x = SHIP_R; ship.vx = Math.abs(ship.vx); }
    if (ship.x > VW - SHIP_R) { ship.x = VW - SHIP_R; ship.vx = -Math.abs(ship.vx); }
    if (ship.y < SHIP_R + 60) { ship.y = SHIP_R + 60; ship.vy = Math.abs(ship.vy); }
    if (ship.y > VH - SHIP_R) { ship.y = VH - SHIP_R; ship.vy = -Math.abs(ship.vy); }

    // Asteroids
    for (const a of asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.ang += a.spin * dt;
      // wrap
      if (a.x < -50) a.x += VW + 100;
      if (a.x > VW + 50) a.x -= VW + 100;
      if (a.y < 50) a.y += VH;
      if (a.y > VH + 50) a.y -= VH;
    }
    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > VW || b.y < 0 || b.y > VH) {
        bullets.splice(i, 1);
      }
    }
    // Bullet-asteroid collisions
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      let hit = false;
      for (let ai = asteroids.length - 1; ai >= 0; ai--) {
        const a = asteroids[ai];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < a.r + 3) {
          asteroids.splice(ai, 1);
          score += 10;
          burst(a.x, a.y, 14, '#f9f002');
          hit = true;
          break;
        }
      }
      if (hit) bullets.splice(bi, 1);
    }
    // Ship-asteroid collision
    if (invT <= 0) {
      for (const a of asteroids) {
        const d = Math.hypot(ship.x - a.x, ship.y - a.y);
        if (d < a.r + SHIP_R - 2) {
          end();
          return;
        }
      }
    }
    // Respawn asteroids
    if (asteroids.length < 4 + Math.floor(t / 8)) asteroids.push(spawnAsteroid());
    // Score over time
    score += dt * 4;
    RA.setScore(Math.floor(score));
  }

  function end() {
    over = true;
    sfx.die();
    shake(10, 0.5);
    burst(ship.x, ship.y, 30, '#ff3355');
    RA.submitScore('astro', Math.floor(score));
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${Math.floor(score)}   BEST ${RA.best('astro')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 200);
  }

  function drawImpl(ctx) {
  const g = ctx;
    // stars background
    g.fillStyle = '#0a0420';
    g.fillRect(0, 0, VW, VH);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 73 + (t * 8)) % VW;
      const y = (i * 47) % VH;
      g.fillRect(x, y, 1, 1);
    }
    // asteroids
    for (const a of asteroids) {
      g.save();
      g.translate(a.x, a.y);
      g.rotate(a.ang);
      g.fillStyle = '#7dff8a';
      g.beginPath();
      const verts = 8;
      for (let i = 0; i < verts; i++) {
        const ang = (i / verts) * Math.PI * 2;
        const r = a.r * (0.8 + (i % 2 ? 0.2 : 0));
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = '#39ff14';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
    // bullets
    g.fillStyle = '#00eaff';
    for (const b of bullets) {
      g.beginPath();
      g.arc(b.x, b.y, 3, 0, Math.PI * 2);
      g.fill();
    }
    // ship
    if (invT <= 0 || Math.floor(t * 8) % 2 === 0) {
      g.save();
      g.translate(ship.x, ship.y);
      g.rotate(ship.ang);
      g.fillStyle = '#f9f002';
      g.beginPath();
      g.moveTo(SHIP_R, 0);
      g.lineTo(-SHIP_R, SHIP_R * 0.7);
      g.lineTo(-SHIP_R * 0.5, 0);
      g.lineTo(-SHIP_R, -SHIP_R * 0.7);
      g.closePath();
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('탭으로 시작 · 드래그로 이동 · 탭으로 발사', VW / 2, VH / 2);
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
      get ship() { return ship; },
      get asteroids() { return asteroids; },
      get bullets() { return bullets; },
      get score() { return score; },
      get over() { return over; },
      get started() { return started; },
      get t() { return t; },
      fire() { input.taps.push({ x: ship.x, y: ship.y }); },
    };
  }

  return { init, update, draw: draw, onStart, onPause, debug };
})();
