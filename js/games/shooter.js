// ============================================================
// Game 3 — GALAXY RAIDERS (Galaga-style fixed shooter)
// Drag to move (auto-fire), waves of aliens, dive attacks.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.shooter = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  let ship, bullets, bombs, enemies, stars, particlesFx;
  let wave, score, lives, dead, started;
  let fireCooldown, enemyFireTimer, waveState, stateTimer, ufoTimer;

  function init() {
    RA.setHUD('GALAXY RAIDERS', 'shooter');
    reset();
    RA.showOverlay({
      title: 'GALAXY RAIDERS',
      sub: 'DRAG TO MOVE',
      lines: ['드래그로 이동 — 자동 발사!', '웨이브를 클리어하고 보스 격파'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }

  function onStart() {
    started = true;
    RA.audio.playBGM('shooter');
  }

  function reset() {
    ship = { x: VW / 2, y: VH - 80, w: 30, h: 26, cooldown: 0, inv: 0 };
    bullets = []; bombs = []; enemies = [];
    wave = 0; score = 0; lives = 3; dead = false; started = false;
    fireCooldown = 0; enemyFireTimer = 1.5;
    waveState = 'intro'; stateTimer = 1.2;
    stars = [];
    for (let i = 0; i < 50; i++) stars.push({ x: Math.random() * VW, y: Math.random() * VH, s: 0.5 + Math.random() * 1.8 });
  }

  function spawnWave() {
    wave++;
    enemies = [];
    const boss = wave % 4 === 0;
    if (boss) {
      enemies.push({
        type: 'boss', x: VW / 2, y: -60, ty: 90,
        w: 84, h: 48, hp: 14 + wave * 3, maxHp: 14 + wave * 3,
        vx: 70, phase: 0, t: 0
      });
      // escorts
      for (let i = 0; i < 6; i++) {
        enemies.push({
          type: 'grunt', x: 40 + i * 56, y: -140 - Math.floor(i / 3) * 40, ty: 170,
          w: 24, h: 20, hp: 1, vx: 0, t: Math.random() * 10
        });
      }
    } else {
      const rows = Math.min(4, 2 + Math.floor(wave / 2));
      const cols = 7;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const kind = r === 0 ? 'diver' : 'grunt';
          enemies.push({
            type: kind, x: 36 + c * 42, y: -40 - r * 38, ty: 80 + r * 44,
            w: kind === 'diver' ? 26 : 24, h: 20, hp: 1 + (wave > 5 && r === 0 ? 1 : 0),
            vx: 0, t: Math.random() * 10
          });
        }
      }
    }
    waveState = 'entering'; stateTimer = 0;
    sfx.levelup();
  }

  function update(dt) {
    if (!started || dead) return;

    // starfield scroll
    for (const st of stars) {
      st.y += (12 + st.s * 14) * dt;
      if (st.y > VH) { st.y = -2; st.x = Math.random() * VW; }
    }

    // --- wave flow ---
    if (waveState === 'intro') {
      stateTimer -= dt;
      if (stateTimer <= 0) spawnWave();
    } else if (waveState === 'entering') {
      let allIn = true;
      for (const e of enemies) {
        if (e.y < e.ty) { e.y += 130 * dt; allIn = false; }
      }
      if (allIn) { waveState = 'fight'; }
    } else if (waveState === 'clear') {
      stateTimer -= dt;
      if (stateTimer <= 0) { waveState = 'intro'; stateTimer = 1.4; }
    }

    // --- ship control ---
    if (input.isDown) {
      const tx = input.x;
      const dx = tx - ship.x;
      ship.x += Math.max(-520 * dt, Math.min(520 * dt, dx * 12 * dt));
    } else if (input.keys['ArrowLeft'] || input.keys['ArrowRight']) {
      ship.x += ((input.keys['ArrowRight'] ? 1 : 0) - (input.keys['ArrowLeft'] ? 1 : 0)) * 340 * dt;
    }
    ship.x = Math.max(18, Math.min(VW - 18, ship.x));
    if (ship.inv > 0) ship.inv -= dt;

    // auto-fire
    fireCooldown -= dt;
    if (fireCooldown <= 0) {
      bullets.push({ x: ship.x, y: ship.y - 16 });
      sfx.shoot();
      fireCooldown = 0.26;
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= 560 * dt;
      if (bullets[i].y < -12) bullets.splice(i, 1);
    }

    // --- enemies ---
    enemyFireTimer -= dt;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.t += dt;

      if (e.type === 'boss') {
        e.x += e.vx * dt;
        if (e.x < 50 || e.x > VW - 50) e.vx *= -1;
        e.y = e.ty + Math.sin(e.t * 1.6) * 14;
        // spread bomb
        if (enemyFireTimer <= 0 && Math.random() < 0.5) {
          for (const ang of [-0.35, 0, 0.35]) {
            bombs.push({ x: e.x, y: e.y + 24, vx: Math.sin(ang) * 120, vy: 200 + Math.random() * 60 });
          }
          enemyFireTimer = Math.max(0.7, 1.7 - wave * 0.08);
          sfx.laser();
        }
      } else if (e.type === 'diver') {
        // sinus drift + occasional dive at the player
        if (!e.diving && Math.random() < dt * 0.22 && waveState === 'fight') {
          e.diving = true;
          // capped homing velocity — uncapped (ship.x - e.x) * 0.9 let edge
          // divers slide clean off-screen where bullets can never reach them
          e.dvx = Math.max(-260, Math.min(260, (ship.x - e.x) * 0.9));
        }
        if (e.diving) {
          e.x += (e.dvx || 0) * dt;
          e.y += (240 + wave * 8) * dt;
          e.dvx *= (1 - 0.4 * dt);
          // clamp inside the playfield so divers stay hittable
          if (e.x < 16) { e.x = 16; e.dvx = Math.abs(e.dvx) * 0.5; }
          if (e.x > VW - 16) { e.x = VW - 16; e.dvx = -Math.abs(e.dvx) * 0.5; }
          if (e.y > VH + 40) { enemies.splice(i, 1); continue; }
        } else {
          e.x += Math.sin(e.t * 1.8 + i) * 26 * dt;
          e.y = e.ty + Math.sin(e.t * 2.2) * 6;
          if (enemyFireTimer <= 0 && Math.random() < 0.25) {
            bombs.push({ x: e.x, y: e.y + 14, vx: 0, vy: 190 });
            enemyFireTimer = Math.max(0.55, 1.4 - wave * 0.06);
          }
        }
      } else { // grunt
        e.x += Math.sin(e.t * 1.2 + i * 0.7) * 34 * dt;
        e.y = e.ty + Math.sin(e.t * 2.6 + i) * 5;
      }

      // bullet vs enemy
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (b.x > e.x - e.w / 2 && b.x < e.x + e.w / 2 && b.y > e.y - e.h / 2 && b.y < e.y + e.h / 2) {
          bullets.splice(j, 1);
          e.hp--;
          burst(b.x, b.y, { n: 4, colors: ['#fff', '#9df'], speed: 70, size: 3 });
          if (e.hp <= 0) {
            const pts = e.type === 'boss' ? 500 : e.type === 'diver' ? 150 : 100;
            score += pts;
            floatText(e.x, e.y, '+' + pts, e.type === 'boss' ? '#ff66d9' : '#ffe066');
            burst(e.x, e.y, { n: e.type === 'boss' ? 40 : 14, colors: ['#ff3355', '#ffb347', '#fff'], speed: e.type === 'boss' ? 260 : 150 });
            sfx.explode();
            if (e.type === 'boss') shake(8, 0.45);
            enemies.splice(i, 1);
          } else {
            sfx.hit();
          }
          break;
        }
      }
    }

    // bombs
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > VH + 16 || b.x < -16 || b.x > VW + 16) { bombs.splice(i, 1); continue; }
      // hit player?
      if (ship.inv <= 0 &&
          b.x > ship.x - 13 && b.x < ship.x + 13 &&
          b.y > ship.y - 11 && b.y < ship.y + 11) {
        bombs.splice(i, 1);
        playerHit();
        return;
      }
    }

    // enemy body vs player
    if (ship.inv <= 0) {
      for (const e of enemies) {
        if (Math.abs(e.x - ship.x) < (e.w + 26) / 2 && Math.abs(e.y - ship.y) < (e.h + 20) / 2) {
          playerHit();
          return;
        }
      }
    }

    // wave clear?
    if (waveState === 'fight' && enemies.length === 0) {
      waveState = 'clear';
      stateTimer = 1.6;
      score += 100 * wave;
      floatText(VW / 2, VH / 2, `WAVE ${wave} CLEAR! +${100 * wave}`, '#7dff8a');
      sfx.powerup();
    }

    RA.setScore(score);
  }

  function playerHit() {
    lives--;
    ship.inv = 2;
    sfx.explode();
    shake(9, 0.4);
    burst(ship.x, ship.y, { n: 24, colors: ['#00eaff', '#ff3355', '#fff'], speed: 200 });
    if (lives <= 0) {
      die();
    }
  }

  function die() {
    dead = true;
    RA.submitScore('shooter', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   WAVE ${wave}   BEST ${RA.best('shooter')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 600);
  }

  function drawAlien(g, e) {
    g.save();
    g.translate(e.x, e.y);
    if (e.type === 'boss') {
      g.fillStyle = '#b967ff';
      g.fillRect(-42, -20, 84, 40);
      g.fillStyle = '#7b2ff7';
      g.fillRect(-52, -10, 104, 12);
      g.fillStyle = '#ff3355';
      g.fillRect(-30, -8, 12, 12);
      g.fillRect(-8, -12, 16, 16);
      g.fillRect(18, -8, 12, 12);
      g.fillStyle = '#ffe066';
      g.fillRect(-42, 14, 84, 6);
    } else if (e.type === 'diver') {
      g.fillStyle = '#ff66d9';
      g.fillRect(-12, -9, 24, 18);
      g.fillStyle = '#fff';
      g.fillRect(-8, -4, 5, 5);
      g.fillRect(3, -4, 5, 5);
      g.fillStyle = '#b967ff';
      g.fillRect(-16, 4, 32, 5);
    } else {
      const wob = Math.sin(e.t * 6) * 3;
      g.fillStyle = '#7dff8a';
      g.fillRect(-11, -8 + wob * 0, 22, 16);
      g.fillStyle = '#0a3d1f';
      g.fillRect(-7, -4, 5, 5);
      g.fillRect(2, -4, 5, 5);
      g.fillStyle = '#3fae63';
      g.fillRect(-15, -2, 6, 10);
      g.fillRect(9, -2, 6, 10);
    }
    g.restore();
  }

  function draw(g) {
    g.fillStyle = '#05010f';
    g.fillRect(0, 0, VW, VH);

    // stars
    for (const st of stars) {
      g.globalAlpha = 0.3 + st.s / 2.3 * 0.7;
      g.fillStyle = '#cfd8ff';
      g.fillRect(st.x, st.y, st.s, st.s);
    }
    g.globalAlpha = 1;

    // ground line (classic)
    g.fillStyle = '#2ecf5f';
    g.fillRect(0, VH - 34, VW, 2);

    // bullets
    g.fillStyle = '#ffe066';
    for (const b of bullets) g.fillRect(b.x - 2, b.y - 8, 4, 12);

    // bombs
    for (const b of bombs) {
      g.fillStyle = '#ff3355';
      g.fillRect(b.x - 3, b.y - 3, 6, 6);
      g.fillStyle = '#ff9d9d';
      g.fillRect(b.x - 1, b.y - 6, 2, 4);
    }

    // enemies
    for (const e of enemies) drawAlien(g, e);

    // boss hp bar
    const boss = enemies.find(e => e.type === 'boss');
    if (boss) {
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.fillRect(40, 30, VW - 80, 8);
      g.fillStyle = '#ff3355';
      g.fillRect(40, 30, (VW - 80) * (boss.hp / boss.maxHp), 8);
    }

    // ship
    if (!dead && (ship.inv <= 0 || Math.floor(performance.now() / 90) % 2 === 0)) {
      g.save();
      g.translate(ship.x, ship.y);
      g.fillStyle = '#00eaff';
      g.beginPath();
      g.moveTo(0, -14);
      g.lineTo(14, 12);
      g.lineTo(0, 6);
      g.lineTo(-14, 12);
      g.closePath();
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(-3, -10, 6, 10);
      // exhaust
      g.fillStyle = '#ffd166';
      const fl = 6 + Math.random() * 8;
      g.fillRect(-3, 12, 6, fl);
      g.restore();
    }

    // lives icons
    for (let i = 0; i < lives; i++) {
      g.fillStyle = '#00eaff';
      g.fillRect(10 + i * 20, VH - 26, 14, 10);
    }

    // wave label during intro
    if (waveState === 'clear' || waveState === 'intro') {
      g.globalAlpha = 0.85;
      g.fillStyle = '#fff';
      g.font = 'bold 18px monospace';
      g.textAlign = 'center';
      g.fillText(wave === 0 ? 'READY' : `WAVE ${wave} INCOMING`, VW / 2, VH / 2);
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
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!dead) RA.audio.playBGM(started ? 'shooter' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause };
})();
