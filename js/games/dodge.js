// ============================================================
// Game 15 — DODGE ROYALE (bullet-hell survival)
// Drag to move. Survive escalating bullet waves; graze near
// misses for bonus score; shield pickup every 25s.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.dodge = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const PR = 9;          // player radius
  let px, py;
  let bullets, pickups, particles2;
  let time, score, started, over;
  let spawnT, waveT, shieldT, invT;
  let grazes, bestStreak, grazeStreak;

  function reset() {
    px = VW / 2; py = VH * 0.72;
    bullets = []; pickups = [];
    time = 0; score = 0;
    started = false; over = false;
    spawnT = 0; waveT = 0; shieldT = 0; invT = 0;
    grazes = 0; bestStreak = 0; grazeStreak = 0;
    RA.setScore(0);
  }

  function diff() { return Math.min(1, time / 120); }   // ramps over 2 min

  function spawnWave() {
    const d = diff();
    const patterns = ['rain', 'aimed', 'ring', 'spiral'];
    const p = patterns[(Math.random() * Math.min(patterns.length, 1 + Math.floor(time / 20))) | 0];
    if (p === 'rain') {
      const n = 3 + Math.floor(d * 5);
      for (let i = 0; i < n; i++) {
        bullets.push({ x: Math.random() * VW, y: -10 - Math.random() * 60,
          vx: (Math.random() - 0.5) * 40, vy: 130 + d * 150 + Math.random() * 60, r: 5 });
      }
    } else if (p === 'aimed') {
      const n = 1 + (d > 0.35 ? 1 : 0) + (d > 0.75 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const x = Math.random() * VW;
        const a = Math.atan2(py - (-10), px - x);
        const sp = 170 + d * 140;
        setTimeout(() => {}, 0); // keep sync; spawn immediately with offset
        bullets.push({ x: x + i * 30 - n * 15, y: -10,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6 });
      }
    } else if (p === 'ring') {
      const n = 8 + Math.floor(d * 10);
      const a0 = Math.random() * Math.PI * 2;
      const cx = VW / 2 + (Math.random() - 0.5) * VW * 0.4;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        const sp = 110 + d * 90;
        bullets.push({ x: cx, y: VH * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 });
      }
    } else {   // spiral
      spiralShots(3 + Math.floor(d * 4));
    }
    sfx.shoot();
  }

  let spiralPhase = 0;
  function spiralShots(arms) {
    spiralPhase += 0.7;
    const sp = 120 + diff() * 100;
    for (let k = 0; k < arms; k++) {
      const a = spiralPhase + (k / arms) * Math.PI * 2;
      bullets.push({ x: VW / 2, y: VH * 0.22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 });
    }
  }

  function gameOver() {
    over = true;
    sfx.gameover();
    shake(7, 0.45);
    burst(px, py, { n: 26, colors: ['#ff3355', '#ffe066', '#fff'], speed: 220 });
    RA.submitScore('dodge', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   BEST ${RA.best('dodge')}`,
        lines: [`SURVIVED ${Math.floor(time)}s · GRAZE ${grazes}`],
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 600);
  }

  function update(dt) {
    if (!started || over) return;

    time += dt;
    score += dt * 60 * (1 + diff());
    waveT -= dt;
    spawnT -= dt;
    if (shieldT > 0) shieldT -= dt;
    if (invT > 0) invT -= dt;

    // player follows pointer (lerped)
    const tx = input.x, ty = input.y;
    px += (tx - px) * Math.min(1, dt * 14);
    py += (ty - py) * Math.min(1, dt * 14);
    px = Math.max(PR, Math.min(VW - PR, px));
    py = Math.max(PR + 60, Math.min(VH - PR - 6, py));

    // waves
    if (spawnT <= 0) { spawnWave(); spawnT = Math.max(0.55, 1.6 - diff()); }
    if (waveT <= 0) { if (diff() > 0.3 && Math.random() < 0.5) spiralShots(2); waveT = 1.2; }

    // shield pickup every ~22s
    if (shieldT <= 0 && !pickups.length && time > 18) {
      pickups.push({ x: 30 + Math.random() * (VW - 60), y: VH * 0.2 + Math.random() * VH * 0.4, t: 0 });
      shieldT = 22;
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -30 || b.x > VW + 30 || b.y < -40 || b.y > VH + 30) { bullets.splice(i, 1); continue; }
      const dx = b.x - px, dy = b.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < b.r + PR) {
        if (invT > 0) continue;
        if (hasShield()) {
          invT = 1.2;
          bullets.splice(i, 1);
          sfx.hit();
          shake(5, 0.3);
          floatText(px, py - 16, 'SHIELD!', '#00eaff');
          burst(px, py, { n: 12, colors: ['#00eaff', '#fff'], speed: 160 });
          continue;
        }
        gameOver();
        return;
      } else if (dist < b.r + PR + 12 && !b.grazed) {
        b.grazed = true;
        grazes++;
        grazeStreak++;
        bestStreak = Math.max(bestStreak, grazeStreak);
        score += 15 + grazeStreak * 2;
        sfx.eat();
        floatText(px + dx * -0.6, py + dy * -0.6, `GRAZE +${15 + grazeStreak * 2}`, '#7dff8a');
      }
    }

    // graze streak decays when not grazing recently
    if ((time * 60 | 0) % 45 === 0) grazeStreak = Math.max(0, grazeStreak - 1);

    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.t += dt;
      if (Math.hypot(pk.x - px, pk.y - py) < 16) {
        pickups.splice(i, 1);
        invT = 3;
        sfx.powerup();
        floatText(px, py - 20, 'SHIELD UP!', '#00eaff');
        burst(pk.x, pk.y, { n: 14, colors: ['#00eaff', '#b967ff'], speed: 150 });
        RA.meta && RA.meta.event && RA.meta.event('shield_taken', 1);
      } else if (pk.t > 8) pickups.splice(i, 1);
    }

    RA.setScore(Math.floor(score));
    RA.meta && RA.meta.event && RA.meta.event('dodge_time', 0);   // no-op tick guard
  }

  function hasShield() { return false; }   // shield is invT-based only

  function draw(g) {
    g.fillStyle = '#0b0518';
    g.fillRect(0, 0, VW, VH);

    // grid backdrop
    g.strokeStyle = 'rgba(120,110,220,.08)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < VW; x += 40) { g.moveTo(x, 0); g.lineTo(x, VH); }
    for (let y = 0; y < VH; y += 40) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.stroke();

    // pickups
    for (const pk of pickups) {
      const pulse = 1 + Math.sin(pk.t * 6) * 0.15;
      g.strokeStyle = '#00eaff';
      g.lineWidth = 2;
      g.beginPath(); g.arc(pk.x, pk.y, 11 * pulse, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#00eaff';
      g.font = 'bold 9px monospace'; g.textAlign = 'center';
      g.fillText('S', pk.x, pk.y + 3);
      g.textAlign = 'left';
    }

    // bullets
    for (const b of bullets) {
      g.fillStyle = b.grazed ? '#ff8844' : '#ff66d9';
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.4, 0, Math.PI * 2); g.fill();
    }

    // player
    if (!(invT > 0 && Math.floor(performance.now() / 80) % 2)) {
      g.fillStyle = '#00eaff';
      g.beginPath(); g.arc(px, py, PR, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(px, py, PR * 0.45, 0, Math.PI * 2); g.fill();
      if (invT > 0) {
        g.strokeStyle = 'rgba(0,234,255,.6)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(px, py, PR + 6, 0, Math.PI * 2); g.stroke();
      }
    }

    // HUD extras
    g.fillStyle = '#8f86c9';
    g.font = 'bold 9px monospace';
    g.fillText(`WAVE ${Math.floor(time / 15) + 1}   GRAZE ${grazes}   STREAK ${grazeStreak}`, 10, VH - 24);
    g.fillText(`TIME ${Math.floor(time)}s`, VW - 74, VH - 24);

    if (!started && !over) {
      g.globalAlpha = 0.55 + Math.sin(performance.now() / 260) * 0.3;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 13px monospace';
      g.fillText('탭하여 시작! 드래그로 이동', VW / 2, VH * 0.32);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }
  }

  function init() {
    RA.setHUD('DODGE ROYALE', 'dodge');
    reset();
    RA.showOverlay({
      title: 'DODGE ROYALE',
      sub: 'DRAG TO MOVE · SURVIVE THE WAVES',
      lines: ['탄막을 촘촘히 피하면 GRAZE 보너스!', '연속 그레이즈로 스트릭 점수 상승', '실드 아이템으로 3초 무적'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    input.isDown = false;
    RA.audio.playBGM('dodge');
  }
  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
    const hook = setInterval(() => {
      if (!RA.isOverlayOpen()) {
        clearInterval(hook);
        if (!over) RA.audio.playBGM(started ? 'dodge' : 'menu');
      }
    }, 250);
  }

  function debug() {
    return {
      get bullets() { return bullets; },
      get time() { return time; },
      get score() { return score; },
      get over() { return over; },
      get grazes() { return grazes; },
      get playerPos() { return { x: px, y: py }; },
      setPlayer(x, y) { px = x; py = y; input.x = x; input.y = y; },
      spawnWave,
      forceGameOver() { gameOver(); },
      pump(frames) { const dt = 1 / 60; for (let i = 0; i < frames; i++) update(dt); }
    };
  }

  return { init, update, draw, onStart, onPause, debug };
})();
