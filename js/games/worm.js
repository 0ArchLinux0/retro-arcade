// ============================================================
// Game 6 — WORM.IO (slither.io-style arena vs bot worms)
// Drag to steer, hold second finger / button to boost.
// Eat pellets, grow long, trap bots to kill them.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.worm = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;
  const WORLD = 1600;              // square world
  const PELLET_N = 130;

  let worms, pellets, camX, camY, score, dead, started;
  let boostBtnDown, boostTouchId, timeAlive;

  const BOT_NAMES = ['Neko', 'Pixel', 'Zzang', 'Mochi', 'Turbo', 'Bomi', 'Rex', 'Choco'];

  function makeWorm(opts) {
    const segs = [];
    const n = opts.len ?? 10;
    for (let i = 0; i < n; i++) {
      segs.push({ x: opts.x - i * 8 * Math.cos(opts.ang), y: opts.y - i * 8 * Math.sin(opts.ang) });
    }
    return {
      name: opts.name,
      x: opts.x, y: opts.y,
      ang: opts.ang,
      speed: 110,
      segs,
      radius: 7,
      color: opts.color,
      accent: opts.accent,
      boosting: false,
      dead: false,
      isBot: !!opts.isBot,
      aiTimer: 0,
      targetPellet: null
    };
  }

  function init() {
    RA.setHUD('WORM.IO', 'worm');
    reset();
    RA.showOverlay({
      title: 'WORM.IO',
      sub: 'DRAG TO STEER',
      lines: ['먹이를 먹고 길게 성장!', '상대 머리 앞을 막아 킬!', '화면 오른쪽 아래 버튼 = 부스터'],
      tapStart: true,
      buttons: []
    });
    RA.audio.playBGM('menu');
  }

  function onStart() {
    started = true;
    RA.audio.playBGM('worm');
  }

  function reset() {
    worms = [];
    pellets = [];
    const me = makeWorm({ name: 'YOU', x: WORLD / 2, y: WORLD / 2, ang: 0, color: '#00eaff', accent: '#053a44' });
    worms.push(me);
    for (let i = 0; i < 7; i++) {
      let x, y;
      do {
        x = 100 + Math.random() * (WORLD - 200);
        y = 100 + Math.random() * (WORLD - 200);
      } while (Math.hypot(x - me.x, y - me.y) < 300);
      worms.push(makeWorm({
        name: BOT_NAMES[i % BOT_NAMES.length],
        x, y, ang: Math.random() * Math.PI * 2, isBot: true,
        color: ['#ff66d9', '#ffd166', '#7dff8a', '#b967ff', '#ff8844', '#66ffe0', '#ff5d8f'][i % 7],
        accent: 'rgba(0,0,0,.4)',
        len: 8 + Math.floor(Math.random() * 14)
      }));
    }
    for (let i = 0; i < PELLET_N; i++) spawnPellet();
    camX = me.x - VW / 2; camY = me.y - VH / 2;
    score = 0; dead = false; started = false; timeAlive = 0;
    boostBtnDown = false;
  }

  function spawnPellet(nearX, nearY) {
    if (nearX !== undefined) {
      pellets.push({
        x: nearX + (Math.random() - .5) * 30,
        y: nearY + (Math.random() - .5) * 30,
        r: 3 + Math.random() * 3,
        hue: Math.random()
      });
      return;
    }
    pellets.push({
      x: 30 + Math.random() * (WORLD - 60),
      y: 30 + Math.random() * (WORLD - 60),
      r: 3 + Math.random() * 3,
      hue: Math.random()
    });
  }

  function pelletColor(hue) {
    const cols = ['#ffe066', '#7dff8a', '#66d9ff', '#ff9dc6', '#c9a7ff'];
    return cols[Math.floor(hue * cols.length) % cols.length];
  }

  // ---------- AI ----------
  function updateBot(w, dt) {
    w.aiTimer -= dt;

    // find nearest pellet
    if (!w.targetPellet || w.targetPellet.eaten) {
      let best = null, bd = Infinity;
      for (const p of pellets) {
        const d = (p.x - w.x) ** 2 + (p.y - w.y) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      w.targetPellet = best;
    }

    let desired = w.ang;
    if (w.targetPellet) {
      desired = Math.atan2(w.targetPellet.y - w.y, w.targetPellet.x - w.x);
    }

    // avoid world edge & other heads
    if (w.x < 90) desired = 0;
    if (w.x > WORLD - 90) desired = Math.PI;
    if (w.y < 90) desired = Math.PI / 2;
    if (w.y > WORLD - 90) desired = -Math.PI / 2;

    for (const o of worms) {
      if (o === w || o.dead) continue;
      const d = Math.hypot(o.x - w.x, o.y - w.y);
      if (d < 80) {
        desired = Math.atan2(w.y - o.y, w.x - o.x);
        break;
      }
    }

    // smooth turn toward desired
    let da = desired - w.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    w.ang += Math.max(-3.2 * dt, Math.min(3.2 * dt, da));
    w.boosting = false;

    // occasional random boost when chasing far pellet
    if (Math.random() < dt * 0.05 && w.segs.length > 12) w.boosting = true;
  }

  // ---------- update ----------
  function update(dt) {
    if (!started || dead) return;
    timeAlive += dt;
    const me = worms[0];

    // --- player steering ---
    if (input.isDown) {
      // don't steer from boost button zone (bottom-right circle handled via DOM)
      const dx = input.x - (me.x - camX);
      const dy = input.y - (me.y - camY);
      const d = Math.hypot(dx, dy);
      if (d > 14) {
        const desired = Math.atan2(dy, dx);
        let da = desired - me.ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        me.ang += Math.max(-4.5 * dt, Math.min(4.5 * dt, da));
      }
    } else if (input.keys['ArrowLeft'] || input.keys['ArrowRight']) {
      const dir = (input.keys['ArrowRight'] ? 1 : 0) - (input.keys['ArrowLeft'] ? 1 : 0);
      me.ang += dir * 3.6 * dt;
    }
    me.boosting = boostBtnDown || input.keys['Space'];
    if (me.boosting && me.segs.length <= 6) me.boosting = false;

    // --- move all worms ---
    for (const w of worms) {
      if (w.dead) continue;
      if (w.isBot) updateBot(w, dt);

      const baseSpeed = 105 + Math.min(40, w.segs.length * 0.35);
      let spd = baseSpeed * (w.boosting ? 1.85 : 1);
      w.speed = spd;

      // boost burns segments -> drops pellets behind tail
      if (w.boosting && w.segs.length > 6) {
        if (Math.random() < dt * 6) {
          const tail = w.segs[w.segs.length - 1];
          pellets.push({ x: tail.x, y: tail.y, r: 3.4, hue: Math.random(), fromBoost: true });
          shrinkWorm(w, 1);
        }
      }

      // head forward
      w.x += Math.cos(w.ang) * spd * dt;
      w.y += Math.sin(w.ang) * spd * dt;

      // world clamp (bounce-ish steer)
      if (w.x < 20) { w.x = 20; w.ang = 0; }
      if (w.x > WORLD - 20) { w.x = WORLD - 20; w.ang = Math.PI; }
      if (w.y < 20) { w.y = 20; w.ang = Math.PI / 2; }
      if (w.y > WORLD - 20) { w.y = WORLD - 20; w.ang = -Math.PI / 2; }

      // body follows: each segment moves toward previous with spacing
      let px = w.x, py = w.y;
      const spacing = w.radius * 0.55;
      for (const s of w.segs) {
        const dx = px - s.x, dy = py - s.y;
        const d = Math.hypot(dx, dy);
        if (d > spacing) {
          const t = (d - spacing) / d;
          s.x += dx * t;
          s.y += dy * t;
        }
        px = s.x; py = s.y;
      }
    }

    // --- eat pellets ---
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      let eatenBy = null;
      for (const w of worms) {
        if (w.dead) continue;
        if (Math.hypot(p.x - w.x, p.y - w.y) < w.radius + p.r + 4) { eatenBy = w; break; }
        // also allow body segments to absorb (slither-style magnet)
        if (Math.random() < 0.02 && Math.hypot(p.x - w.segs[Math.min(3, w.segs.length - 1)].x, p.y - w.segs[Math.min(3, w.segs.length - 1)].y) < w.radius + 6) { eatenBy = w; break; }
      }
      if (eatenBy) {
        pellets.splice(i, 1);
        growWorm(eatenBy, p.r >= 5 ? 3 : 2);
        if (eatenBy === worms[0]) {
          score += 10;
          sfx.eat();
          burst(p.x, p.y, { n: 4, colors: [pelletColor(p.hue)], speed: 50, size: 3, grav: 0 });
        }
        spawnPellet();
      }
    }

    // --- collisions: head vs other bodies ---
    for (const w of worms) {
      if (w.dead) continue;
      for (const o of worms) {
        if (o === w || o.dead) continue;
        // check head against o's segments
        for (let si = 2; si < o.segs.length; si++) {
          const s = o.segs[si];
          if (Math.hypot(s.x - w.x, s.y - w.y) < o.radius + w.radius - 1.5) {
            killWorm(w, o);
            if (w === worms[0]) { die(); return; }
            break;
          }
        }
        if (w.dead) break;
      }
    }

    // --- bots respawn to keep action going ---
    for (let i = worms.length - 1; i >= 1; i--) {
      if (worms[i].dead) {
        worms[i].deathT = (worms[i].deathT || 0) + dt;
        if (worms[i].deathT > 1.5) worms.splice(i, 1);
      }
    }
    const aliveBots = worms.filter(w => w.isBot && !w.dead).length;
    if (aliveBots < 7) {
      let x, y;
      const me2 = worms[0];
      do {
        x = 100 + Math.random() * (WORLD - 200);
        y = 100 + Math.random() * (WORLD - 200);
      } while (Math.hypot(x - me2.x, y - me2.y) < 380);
      worms.push(makeWorm({
        name: BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0],
        x, y, ang: Math.random() * Math.PI * 2, isBot: true,
        color: ['#ff66d9', '#ffd166', '#7dff8a', '#b967ff', '#ff8844'][Math.floor(Math.random() * 5)],
        accent: 'rgba(0,0,0,.4)',
        len: 8 + Math.floor(Math.random() * 10)
      }));
    }

    // --- camera ---
    camX += (me.x - VW / 2 - camX) * Math.min(1, 6 * dt);
    camY += (me.y - VH / 2 - camY) * Math.min(1, 6 * dt);

    RA.setScore(score);
  }

  function growWorm(w, n) {
    const tail = w.segs[w.segs.length - 1];
    for (let i = 0; i < n; i++) w.segs.push({ x: tail.x, y: tail.y });
    w.radius = Math.min(15, 7 + w.segs.length * 0.06);
  }
  function shrinkWorm(w, n) {
    for (let i = 0; i < n && w.segs.length > 5; i++) w.segs.pop();
    w.radius = Math.min(15, 7 + w.segs.length * 0.06);
  }

  function killWorm(victim, killer) {
    victim.dead = true;
    // scatter pellets along body
    for (const s of victim.segs) {
      if (Math.random() < 0.75) {
        pellets.push({ x: s.x + (Math.random() - .5) * 16, y: s.y + (Math.random() - .5) * 16, r: 4.5, hue: Math.random() });
      }
    }
    if (killer === worms[0] && victim.isBot) {
      score += 100 + victim.segs.length * 5;
      floatText(victim.x, victim.y, '+' + (100 + victim.segs.length * 5), '#7dff8a');
      sfx.explode();
    } else if (victim === worms[0]) {
      shake(8, 0.4);
      sfx.die();
    } else {
      sfx.eat();
    }
    void killer;
  }

  function die() {
    dead = true;
    RA.submitScore('worm', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   LENGTH ${worms[0].segs.length}   BEST ${RA.best('worm')}`,
        lines: [`생존 ${Math.floor(timeAlive)}초`],
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 600);
  }

  // ---------- draw ----------
  function draw(g) {
    g.fillStyle = '#0a0a18';
    g.fillRect(0, 0, VW, VH);

    // grid
    g.strokeStyle = 'rgba(120,120,220,0.08)';
    g.lineWidth = 1;
    const gs = 48;
    const startX = Math.floor(camX / gs) * gs, startY = Math.floor(camY / gs) * gs;
    for (let x = startX; x < camX + VW + gs; x += gs) {
      g.beginPath(); g.moveTo(x - camX, 0); g.lineTo(x - camX, VH); g.stroke();
    }
    for (let y = startY; y < camY + VH + gs; y += gs) {
      g.beginPath(); g.moveTo(0, y - camY); g.lineTo(VW, y - camY); g.stroke();
    }

    // world border
    g.strokeStyle = '#ff3355';
    g.lineWidth = 4;
    g.strokeRect(-camX, -camY, WORLD, WORLD);

    // pellets
    for (const p of pellets) {
      const sx = p.x - camX, sy = p.y - camY;
      if (sx < -10 || sx > VW + 10 || sy < -10 || sy > VH + 10) continue;
      g.fillStyle = pelletColor(p.hue);
      g.beginPath(); g.arc(sx, sy, p.r, 0, Math.PI * 2); g.fill();
    }

    // worms
    for (let wi = worms.length - 1; wi >= 0; wi--) {
      const w = worms[wi];
      if (w.dead) continue;
      const isMe = w === worms[0];

      // body segments (tail first)
      for (let si = w.segs.length - 1; si >= 1; si--) {
        const s = w.segs[si];
        const sx = s.x - camX, sy = s.y - camY;
        if (sx < -20 || sx > VW + 20 || sy < -20 || sy > VH + 20) continue;
        const shade = si % 6 < 3 ? w.color : w.accent === 'rgba(0,0,0,.4)' ? shadeColor(w.color, -25) : w.accent;
        g.fillStyle = shade;
        g.beginPath(); g.arc(sx, sy, w.radius * (0.82 - si / w.segs.length * 0.25), 0, Math.PI * 2); g.fill();
      }

      // head
      const hx = w.x - camX, hy = w.y - camY;
      g.fillStyle = w.boosting && isMe ? '#fff' : w.color;
      g.beginPath(); g.arc(hx, hy, w.radius, 0, Math.PI * 2); g.fill();

      // eyes look toward heading
      const exOff = Math.cos(w.ang) * w.radius * 0.45;
      const eyOff = Math.sin(w.ang) * w.radius * 0.45;
      const perpX = Math.cos(w.ang + Math.PI / 2), perpY = Math.sin(w.ang + Math.PI / 2);
      for (const side of [-1, 1]) {
        const ex = hx + exOff + perpX * side * w.radius * 0.42;
        const ey = hy + eyOff + perpY * side * w.radius * 0.42;
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(ex, ey, w.radius * 0.34, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111';
        g.beginPath(); g.arc(ex + Math.cos(w.ang) * 1.5, ey + Math.sin(w.ang) * 1.5, w.radius * 0.17, 0, Math.PI * 2); g.fill();
      }

      // name tag
      if (!isMe) {
        g.fillStyle = 'rgba(255,255,255,0.65)';
        g.font = '8px monospace';
        g.textAlign = 'center';
        g.fillText(w.name, hx, hy - w.radius - 6);
        g.textAlign = 'left';
      }
    }

    // leaderboard (top 5)
    const ranked = worms.filter(w => !w.dead).sort((a, b) => b.segs.length - a.segs.length);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(VW - 92, 46, 86, 14 + ranked.slice(0, 5).length * 12);
    g.font = '8px monospace';
    let ly = 58;
    ranked.slice(0, 5).forEach((w, i) => {
      g.fillStyle = w === worms[0] ? '#00eaff' : '#ccc';
      g.fillText(`${i + 1}. ${w.name} ${w.segs.length}`, VW - 86, ly);
      ly += 12;
    });

    // minimap
    const mmS = 54, mmX = 8, mmY = VH - mmS - 8;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(mmX, mmY, mmS, mmS);
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = 1;
    g.strokeRect(mmX, mmY, mmS, mmS);
    for (const w of worms) {
      if (w.dead) continue;
      g.fillStyle = w === worms[0] ? '#00eaff' : '#ff6666';
      const mx = mmX + (w.x / WORLD) * mmS;
      const my = mmY + (w.y / WORLD) * mmS;
      g.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
  }

  function shadeColor(hex, amt) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amt));
    const gg = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
    return `rgb(${r},${gg},${b})`;
  }

  // boost button wired from shell DOM
  function setBoost(on) { boostBtnDown = on; }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
    const resumeHook = setInterval(() => {
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!dead) RA.audio.playBGM(started ? 'worm' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause, setBoost };
})();
