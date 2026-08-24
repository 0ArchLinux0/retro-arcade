// ============================================================
// Game 1 — NEON RUNNER (Geometry-Dash-like one-tap runner)
// Tap/hold to jump. Avoid spikes, ride blocks, reach portals.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.runner = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;
  const GROUND_Y = VH - 110;

  const GRAVITY = 2600;
  const JUMP_V = -830;
  const BASE_SPEED = 300;

  let player, obstacles, speed, dist, score, dead, started;
  let bgHills, camX, nextSpawnX, attemptFlash;
  let holdJump;

  function init() {
    RA.setHUD('NEON RUNNER', 'runner');
    reset();
    RA.showOverlay({
      title: 'NEON RUNNER',
      sub: 'TAP = JUMP',
      lines: ['가시를 피하고 큐브를 밟아 질주!', '홀드하면 연속 점프'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }

  function onStart() {
    started = true;
    attemptFlash = 1.2;
    RA.audio.playBGM('runner');
  }

  function reset() {
    player = { x: 80, y: GROUND_Y - 24, w: 26, h: 26, vy: 0, rot: 0, onGround: true };
    obstacles = [];
    speed = BASE_SPEED;
    dist = 0;
    score = 0;
    dead = false;
    started = false;
    holdJump = false;
    bgHills = [];
    for (let i = 0; i < 14; i++) {
      bgHills.push({ x: i * 60, h: 40 + Math.random() * 90, w: 46 + Math.random() * 40 });
    }
    camX = 0;
    nextSpawnX = VW + 200;
    attemptFlash = 0;
  }

  function spawnChunk(x) {
    // difficulty scales with distance
    const diff = Math.min(1, dist / 6000);
    const roll = Math.random();

    if (roll < 0.38) {
      // single / double / triple spikes
      const n = 1 + ((Math.random() < diff * 0.9 ? 1 : 0) + (Math.random() < diff * 0.5 ? 1 : 0));
      for (let i = 0; i < n; i++) obstacles.push({ type: 'spike', x: x + i * 26, y: GROUND_Y - 20, w: 24, h: 20 });
      return 90 + n * 26;
    }
    if (roll < 0.62) {
      // block to jump on, maybe spike after
      const h = 34 + Math.random() * 40 * (0.5 + diff * 0.5);
      obstacles.push({ type: 'block', x, y: GROUND_Y - h, w: 56 + Math.random() * 50, h });
      if (Math.random() < 0.4 + diff * 0.3) {
        obstacles.push({ type: 'spike', x: x + 130, y: GROUND_Y - 20, w: 24, h: 20 });
        return 210;
      }
      return 170;
    }
    if (roll < 0.78) {
      // floating block with coin above
      const fy = GROUND_Y - 90 - Math.random() * 70;
      obstacles.push({ type: 'block', x, y: fy, w: 64, h: 22, float: true });
      obstacles.push({ type: 'coin', x: x + 32, y: fy - 34, r: 9 });
      return 150;
    }
    if (roll < 0.92) {
      // spike then block staircase
      obstacles.push({ type: 'spike', x, y: GROUND_Y - 20, w: 24, h: 20 });
      obstacles.push({ type: 'block', x: x + 90, y: GROUND_Y - 36, w: 52, h: 36 });
      obstacles.push({ type: 'block', x: x + 142, y: GROUND_Y - 72, w: 52, h: 72 });
      return 260;
    }
    // pad launch + coins arc
    obstacles.push({ type: 'pad', x, y: GROUND_Y - 12, w: 34, h: 12 });
    for (let i = 0; i < 5; i++) {
      obstacles.push({ type: 'coin', x: x + 60 + i * 42, y: GROUND_Y - 120 - Math.sin(i / 4 * Math.PI) * 60, r: 9 });
    }
    return 330;
  }

  function update(dt) {
    if (!started || dead) return;

    speed += dt * 6;                       // slow ramp
    dist += speed * dt;
    score = Math.floor(dist / 10);

    // --- input: hold to keep jumping ---
    const wantJump = input.isDown || Object.keys(input.keys).some(k => k === 'Space' && input.keys[k]);
    if (wantJump && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      sfx.jump();
      burst(player.x + 13, player.y + 26, { n: 5, colors: ['#00eaff', '#7df9ff'], speed: 70, grav: 400, size: 3 });
    }
    holdJump = wantJump;

    // --- physics ---
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (!player.onGround) player.rot += dt * 7.5;

    // ground collide
    if (player.y + player.h >= GROUND_Y) {
      if (player.vy > 200) burst(player.x + 13, GROUND_Y, { n: 4, colors: ['#555', '#888'], speed: 50, size: 3 });
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.rot = 0;
    }

    // --- scroll & spawn ---
    const dx = speed * dt;
    camX += dx;
    nextSpawnX -= dx;
    if (nextSpawnX <= VW + 40) {
      const gapNeeded = spawnChunk(nextSpawnX + 140);
      nextSpawnX += gapNeeded + 130 - diffSpeed();
    }

    for (const bg of bgHills) {
      bg.x -= dx * 0.25;
      if (bg.x < -bg.w) { bg.x = VW + Math.random() * 60; bg.h = 40 + Math.random() * 90; }
    }

    // --- obstacle collisions ---
    const px = player.x, py = player.y, pw = player.w, ph = player.h;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= dx;
      if (o.x + (o.w || o.r * 2) < -60) { obstacles.splice(i, 1); continue; }

      if (o.type === 'coin') {
        const cx = o.x, cy = o.y;
        if (px + pw > cx - o.r && px < cx + o.r && py + ph > cy - o.r && py < cy + o.r) {
          obstacles.splice(i, 1);
          score += 25;
          sfx.coin();
          floatText(cx, cy - 12, '+25', '#ffe066');
          burst(cx, cy, { n: 8, colors: ['#ffe066', '#fff'], speed: 90, size: 3, grav: 100 });
        }
        continue;
      }

      if (o.type === 'pad') {
        if (px + pw > o.x && px < o.x + o.w && py + ph >= o.y && py + ph <= o.y + o.h + 14 && player.vy >= 0) {
          player.vy = JUMP_V * 1.45;
          player.onGround = false;
          sfx.powerup();
          burst(o.x + 17, o.y, { n: 10, colors: ['#ff66d9', '#b967ff'], speed: 120 });
        }
        continue;
      }

      // AABB overlap test
      if (px + pw > o.x + 2 && px < o.x + o.w - 2 && py + ph > o.y + 2 && py < o.y + o.h - 2) {
        if (o.type === 'spike') { die(); return; }
        if (o.type === 'block') {
          // land on top?
          if (player.vy > 0 && py + ph - player.vy * dt <= o.y + 8) {
            player.y = o.y - ph;
            player.vy = 0;
            player.onGround = true;
            player.rot = 0;
          } else if (py + ph - 10 > o.y) {
            die();
            return;
          }
        }
      }
    }

    // leaving screen bottom safety (fell in a pit — not used but safe)
    if (player.y > VH + 60) { die(); return; }

    RA.setScore(score);
    if (attemptFlash > 0) attemptFlash -= dt;
  }

  function diffSpeed() { return Math.min(160, dist / 40); }

  function die() {
    dead = true;
    sfx.explode();
    shake(9, 0.4);
    burst(player.x + 13, player.y + 13, { n: 26, colors: ['#00eaff', '#ff3355', '#fff'], speed: 220 });
    RA.submitScore('runner', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   BEST ${RA.best('runner')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function draw(g) {
    // bg gradient sky
    const grd = g.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, '#12002b');
    grd.addColorStop(0.6, '#2a0a4a');
    grd.addColorStop(1, '#0d001f');
    g.fillStyle = grd;
    g.fillRect(0, 0, VW, VH);

    // grid floor perspective lines
    g.strokeStyle = 'rgba(0,234,255,0.18)';
    g.lineWidth = 1;
    const gy = GROUND_Y;
    for (let i = 0; i < 10; i++) {
      const yy = gy + i * i * 2.2;
      if (yy > VH) break;
      g.beginPath(); g.moveTo(0, yy); g.lineTo(VW, yy); g.stroke();
    }
    const gxOff = -(camX % 48);
    for (let i = 0; i < 10; i++) {
      g.beginPath(); g.moveTo(gxOff + i * 48, gy); g.lineTo(gxOff + i * 48 + 60, VH); g.stroke();
    }

    // hills silhouette
    g.fillStyle = '#1c0f3d';
    for (const h of bgHills) {
      g.fillRect(h.x, gy - h.h, h.w, h.h);
    }

    // ground line
    g.fillStyle = '#00eaff';
    g.fillRect(0, gy, VW, 3);

    // obstacles
    for (const o of obstacles) {
      if (o.type === 'spike') {
        g.fillStyle = '#ff3355';
        g.beginPath();
        g.moveTo(o.x, o.y + o.h);
        g.lineTo(o.x + o.w / 2, o.y);
        g.lineTo(o.x + o.w, o.y + o.h);
        g.closePath();
        g.fill();
      } else if (o.type === 'block') {
        g.fillStyle = o.float ? '#b967ff' : '#7b2ff7';
        g.fillRect(o.x, o.y, o.w, o.h);
        g.strokeStyle = '#d9a7ff';
        g.lineWidth = 2;
        g.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
      } else if (o.type === 'coin') {
        g.fillStyle = '#ffe066';
        const wob = Math.sin(performance.now() / 180) * 2;
        g.beginPath(); g.arc(o.x, o.y + wob, o.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c9a227';
        g.fillRect(o.x - 2, o.y + wob - 3, 4, 6);
      } else if (o.type === 'pad') {
        g.fillStyle = '#ff66d9';
        g.fillRect(o.x, o.y, o.w, o.h);
        g.fillStyle = '#ffd9f7';
        const pulse = 2 + Math.sin(performance.now() / 120) * 2;
        g.fillRect(o.x, o.y - pulse, o.w, pulse);
      }
    }

    // player cube
    g.save();
    g.translate(player.x + player.w / 2, player.y + player.h / 2);
    g.rotate(player.rot);
    g.fillStyle = '#00eaff';
    g.fillRect(-13, -13, 26, 26);
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.strokeRect(-13, -13, 26, 26);
    g.fillStyle = '#053a44';
    g.fillRect(-6, -6, 12, 12);
    g.restore();

    // attempt flash text
    if (attemptFlash > 0) {
      g.globalAlpha = Math.min(1, attemptFlash);
      g.fillStyle = '#fff';
      g.font = 'bold 16px monospace';
      g.textAlign = 'center';
      g.fillText('GO!', VW / 2, VH / 2 - 40);
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
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!dead) RA.audio.playBGM(started ? 'runner' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause };
})();
