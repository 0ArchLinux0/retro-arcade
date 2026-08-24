// ============================================================
// Game 2 — SKY HOPPER (square-jump vertical platformer)
// Drag/tilt-free: touch & drag left/right to steer, auto-bounce.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.jumper = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const GRAVITY = 1500;
  const BOUNCE_V = -640;
  const MOVE_ACC = 2600;
  const MAX_VX = 320;

  let player, plats, coins, camY, height, score, dead, started;
  let stars, springTimer, comboCount, comboTimer;
  const PLAT_W = 64, PLAT_H = 14;

  function init() {
    RA.setHUD('SKY HOPPER', 'jumper');
    reset();
    RA.showOverlay({
      title: 'SKY HOPPER',
      sub: 'DRAG TO STEER',
      lines: ['드래그로 좌우 이동', '구름을 밟으면 자동 점프!', '떨어지면 끝'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }

  function onStart() {
    started = true;
    RA.audio.playBGM('jumper');
  }

  function makePlatform(y, forceNormal) {
    const diff = Math.min(1, height / 5000);
    const roll = Math.random();
    const p = {
      x: Math.random() * (VW - PLAT_W),
      y,
      w: PLAT_W,
      h: PLAT_H,
      type: 'normal',
      vx: 0
    };
    if (!forceNormal) {
      if (roll < 0.12 + diff * 0.1) p.type = 'fragile';
      else if (roll < 0.24 + diff * 0.1) { p.type = 'moving'; p.vx = (60 + Math.random() * 80) * (Math.random() < .5 ? -1 : 1); }
      else if (roll < 0.3) p.type = 'spring';
    }
    return p;
  }

  function reset() {
    player = { x: VW / 2 - 13, y: VH - 220, w: 26, h: 26, vx: 0, vy: 0, face: 1 };
    plats = [];
    coins = [];
    // starting platform right under player
    plats.push({ x: player.x - 20, y: player.y + 30, w: PLAT_W + 40, h: PLAT_H, type: 'normal', vx: 0 });
    for (let y = VH - 140; y > -camY0(); y -= 78) {
      plats.push(makePlatform(y));
    }
    camY = 0; height = 0; score = 0; dead = false; started = false;
    stars = [];
    for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * VW, y: Math.random() * VH * 2, s: 1 + Math.random() * 2 });
    springTimer = 0;
    comboCount = 0; comboTimer = 0;
  }
  function camY0() { return 0; }

  function update(dt) {
    if (!started || dead) return;

    // --- horizontal control: drag anywhere ---
    if (input.isDown || input.keys['ArrowLeft'] || input.keys['ArrowRight']) {
      let dir = 0;
      if (input.isDown) {
        const dx = input.x - (player.x + player.w / 2);
        dir = Math.abs(dx) > 8 ? Math.sign(dx) : 0;
      } else {
        dir = (input.keys['ArrowRight'] ? 1 : 0) - (input.keys['ArrowLeft'] ? 1 : 0);
      }
      if (dir !== 0) {
        player.vx += dir * MOVE_ACC * dt;
        player.face = dir;
        if (Math.abs(player.vx) > MAX_VX) player.vx = MAX_VX * Math.sign(player.vx);
      } else {
        player.vx *= (1 - 6 * dt);
      }
    } else {
      player.vx *= (1 - 4 * dt);
    }

    // wrap around screen edges
    if (player.x + player.w < 0) player.x = VW;
    if (player.x > VW) player.x = -player.w;

    // --- physics ---
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    player.x += player.vx * dt;

    // platforms
    for (let i = plats.length - 1; i >= 0; i--) {
      const p = plats[i];
      if (p.type === 'moving') {
        p.x += p.vx * dt;
        if (p.x <= 0 || p.x + p.w >= VW) p.vx *= -1;
      }
      // landing check only when falling
      if (player.vy > 0 &&
          player.y + player.h >= p.y && player.y + player.h <= p.y + p.h + Math.max(10, player.vy * dt) &&
          player.x + player.w > p.x && player.x < p.x + p.w) {

        player.vy = BOUNCE_V;
        sfx.jump();
        burst(player.x + 13, p.y, { n: 5, colors: ['#fff', '#aef'], speed: 60, grav: 300, size: 3 });

        if (p.type === 'fragile') {
          plats.splice(i, 1);
          burst(p.x + p.w / 2, p.y, { n: 10, colors: ['#c96', '#986'], speed: 100 });
          continue;
        }
        if (p.type === 'spring') {
          player.vy = BOUNCE_V * 1.75;
          sfx.powerup();
          burst(player.x + 13, p.y, { n: 12, colors: ['#7f7', '#cfc'], speed: 130 });
        }
        comboCount++;
        score += 5 * Math.min(comboCount, 10);
        comboTimer = 1.2;
      }
      // remove far-below platforms
      const screenY = p.y - (-camY);
      if (screenY > VH + 80) plats.splice(i, 1);
    }

    // spawn new platforms above camera
    while (highestY() > -camY - 120) {
      plats.push(makePlatform(highestY() - 74 - Math.random() * 26));
      if (Math.random() < 0.35) {
        coins.push({ x: Math.random() * (VW - 30) + 15, y: highestY() - 40 });
      }
    }

    // coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.y += 0; // static in world; screen offset applied at draw
      if (player.x + player.w > c.x - 11 && player.x < c.x + 11 &&
          player.y + player.h > c.y - 11 && player.y < c.y + 11) {
        coins.splice(i, 1);
        score += 25;
        sfx.coin();
        floatText(c.x, c.y - 14, '+25');
        burst(c.x, c.y, { n: 8, colors: ['#ffe066', '#fff'], speed: 90, size: 3, grav: 60 });
      }
    }

    // camera follows when rising
    if (player.y < VH / 2 - 90) {
      const dy = (VH / 2 - 90) - player.y;
      player.y = VH / 2 - 90;
      camY -= dy;
      height += dy;
    }

    // fall death
    if (player.y > VH + 40) {
      die();
      return;
    }

    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) comboCount = 0; }
    if (springTimer > 0) springTimer -= dt;

    // score = max height + coin bonuses
    const total = Math.floor(height / 10) + score;
    RA.setScore(total);

    // star parallax
    for (const st of stars) st.sy = ((st.y - camY * 0.4) % (VH * 2) + VH * 2) % (VH * 2);
  }

  function highestY() {
    let m = Infinity;
    for (const p of plats) if (p.y < m) m = p.y;
    return m;
  }

  function die() {
    dead = true;
    sfx.die();
    shake(7, 0.3);
    RA.submitScore('jumper', Math.floor(height / 10) + score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${Math.floor(height / 10) + score}   BEST ${RA.best('jumper')}`,
        lines: [`높이 ${Math.floor(height)}m`],
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function draw(g) {
    // sky gradient
    const grd = g.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, '#0b1035');
    grd.addColorStop(1, '#3b1d5e');
    g.fillStyle = grd;
    g.fillRect(0, 0, VW, VH);

    // stars
    g.fillStyle = '#cfd8ff';
    for (const st of stars) {
      g.globalAlpha = 0.3 + (st.s / 3) * 0.7;
      g.fillRect(st.x, st.sy ?? st.y, st.s, st.s);
    }
    g.globalAlpha = 1;

    // moon
    g.fillStyle = '#f4ead5';
    g.beginPath(); g.arc(VW - 52, 84, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b1035';
    g.globalAlpha = 0.85;
    g.beginPath(); g.arc(VW - 42, 76, 22, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    const oy = -(-camY); // world -> screen offset: screenY = worldY + camY... careful:
    // We store plat.y in "world" coords where larger negative = higher.
    // Camera: screenY = p.y + offY where offY = camY (camY decreases as we climb)
    const offY = camY;

    // clouds decor
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) {
      const cy = (((i * 173 - camY * 0.55) % VH) + VH) % VH;
      g.fillRect(20 + (i * 61) % 280, cy, 70 + i * 9, 16);
    }

    // platforms
    for (const p of plats) {
      const sy = p.y + offY;
      if (sy < -30 || sy > VH + 30) continue;
      if (p.type === 'normal') g.fillStyle = '#7ee8fa';
      else if (p.type === 'moving') g.fillStyle = '#ffd166';
      else if (p.type === 'fragile') g.fillStyle = '#c98a5e';
      else g.fillStyle = '#7dff8a';
      g.fillRect(p.x, sy, p.w, p.h);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(p.x, sy, p.w, 3);
      if (p.type === 'fragile') {
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.moveTo(p.x + p.w * 0.3, sy); g.lineTo(p.x + p.w * 0.45, sy + p.h);
        g.moveTo(p.x + p.w * 0.65, sy); g.lineTo(p.x + p.w * 0.55, sy + p.h);
        g.stroke();
      }
      if (p.type === 'spring') {
        g.fillStyle = '#2ecf5f';
        g.fillRect(p.x + p.w / 2 - 10, sy - 8, 20, 8);
      }
    }

    // coins
    for (const c of coins) {
      const sy = c.y + offY;
      if (sy < -20 || sy > VH + 20) continue;
      g.fillStyle = '#ffe066';
      const wob = Math.sin(performance.now() / 160 + c.x) * 2;
      g.beginPath(); g.arc(c.x, sy + wob, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9a227';
      g.fillRect(c.x - 2, sy + wob - 4, 4, 8);
    }

    // player (square with eyes)
    const px = player.x, py = player.y + offY;
    g.fillStyle = '#ffde59';
    g.fillRect(px, py, player.w, player.h);
    g.strokeStyle = '#b8860b'; g.lineWidth = 2;
    g.strokeRect(px, py, player.w, player.h);
    // eyes
    g.fillStyle = '#222';
    const ex = px + (player.face > 0 ? 13 : 6);
    g.fillRect(ex, py + 8, 4, 6);
    g.fillRect(ex + (player.face > 0 ? 5 : -5), py + 8, 4, 6);

    // height marker line each 500
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let hy = 0; ; hy += 500) {
      const sy = -hy + offY;
      if (sy < -10) break;
      if (hy > 0) {
        g.fillRect(0, sy, VW, 1);
        g.font = '10px monospace';
        g.fillText(hy + 'm', 6, sy - 4);
      }
      if (hy > 20000) break;
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
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!dead) RA.audio.playBGM(started ? 'jumper' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause };
})();
