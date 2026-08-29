// ============================================================
// Game 16 — NEON CAVE (helicopter / cave flyer)
// Hold to thrust up, release to fall. Thread the scrolling
// cavern; pick up crystals; survive as walls close in.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.cave = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const GRAV = 980, THRUST = 1450, MAX_VY = 520;
  const SHIP_R = 10;
  const SEG_W = 28;
  const GAP_BASE = 210, GAP_MIN = 108;
  const SPEED_BASE = 145;

  let ship, segs, crystals, score, dist;
  let started, over, scrollT, crystalT, sparkT;
  let stars;

  function noise1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const a = Math.sin(i * 127.1) * 43758.5453;
    const b = Math.sin((i + 1) * 127.1) * 43758.5453;
    const u = f * f * (3 - 2 * f);
    return ((a - Math.floor(a)) * (1 - u) + (b - Math.floor(b)) * u) * 2 - 1;
  }

  function gapAt(t) {
    return Math.max(GAP_MIN, GAP_BASE - t * 4.2);
  }

  function centerAt(t) {
    return VH * 0.5
      + noise1(t * 0.55) * 70
      + Math.sin(t * 0.35) * 55
      + Math.sin(t * 0.11) * 30;
  }

  function rebuildSegs() {
    segs = [];
    const n = Math.ceil(VW / SEG_W) + 4;
    for (let i = 0; i < n; i++) {
      const t = i * (SEG_W / SPEED_BASE);
      const gap = gapAt(0);
      const cy = centerAt(t);
      segs.push({ x: i * SEG_W, cy, gap, t });
    }
  }

  function reset() {
    ship = { x: VW * 0.28, y: VH * 0.5, vy: 0, thrust: false };
    rebuildSegs();
    crystals = [];
    score = 0; dist = 0;
    started = false; over = false;
    scrollT = 0; crystalT = 0.8; sparkT = 0;
    stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        s: 0.4 + Math.random() * 1.2,
        a: 0.25 + Math.random() * 0.55
      });
    }
    RA.setScore(0);
  }

  function segAtShip() {
    let best = segs[0], bd = 1e9;
    for (const s of segs) {
      const d = Math.abs(s.x + SEG_W * 0.5 - ship.x);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function die() {
    if (over) return;
    over = true;
    sfx.die();
    shake(9, 0.5);
    burst(ship.x, ship.y, { n: 26, colors: ['#00eaff', '#7dff8a', '#fff', '#ff66d9'], speed: 220 });
    RA.submitScore('cave', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'CAVE CRASH',
        sub: `SCORE ${score}   BEST ${RA.best('cave')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function update(dt) {
    // ambient parallax stars
    for (const st of stars) {
      st.x -= (18 + st.s * 22) * dt * (started ? 1 : 0.35);
      if (st.x < -4) { st.x = VW + 4; st.y = Math.random() * VH; }
    }

    if (!started) {
      ship.y = VH * 0.5 + Math.sin(performance.now() / 320) * 10;
      ship.vy = 0;
      return;
    }
    if (over) {
      ship.vy = Math.min(MAX_VY, ship.vy + GRAV * dt);
      ship.y += ship.vy * dt;
      return;
    }

    // thrust: hold / space / fresh tap pulse
    ship.thrust = !!(input.isDown || input.keys.Space || input.keys.ArrowUp);
    if (input.justPressed) {
      ship.thrust = true;
      input.justPressed = false;
    }
    const taps = input.consumeTaps();
    if (taps.length) ship.thrust = true;

    if (ship.thrust) {
      ship.vy = Math.max(-MAX_VY, ship.vy - THRUST * dt);
      sparkT -= dt;
      if (sparkT <= 0) {
        sparkT = 0.045;
        burst(ship.x - 12, ship.y + 4, {
          n: 1, colors: ['#00eaff', '#ffe066'], speed: 50, size: 2.5, grav: 30
        });
      }
    } else {
      ship.vy = Math.min(MAX_VY, ship.vy + GRAV * dt);
    }
    ship.y += ship.vy * dt;

    scrollT += dt;
    const speed = SPEED_BASE + Math.min(110, scrollT * 3.5);
    dist += speed * dt;
    const nextScore = Math.floor(dist / 18);
    if (nextScore > score) {
      score = nextScore;
      RA.setScore(score);
    }

    // scroll segments
    for (const s of segs) s.x -= speed * dt;
    while (segs.length && segs[0].x + SEG_W < -SEG_W) {
      segs.shift();
      const last = segs[segs.length - 1];
      const t = last.t + SEG_W / SPEED_BASE;
      segs.push({
        x: last.x + SEG_W,
        cy: centerAt(t),
        gap: gapAt(scrollT),
        t
      });
    }

    // crystals
    crystalT -= dt;
    if (crystalT <= 0) {
      crystalT = 1.1 + Math.random() * 0.9;
      const ref = segs[segs.length - 3] || segs[segs.length - 1];
      if (ref) {
        const y = ref.cy + (Math.random() - 0.5) * (ref.gap * 0.45);
        crystals.push({ x: VW + 20, y, r: 7, taken: false });
      }
    }
    for (let i = crystals.length - 1; i >= 0; i--) {
      const c = crystals[i];
      c.x -= speed * dt;
      if (c.x < -20) { crystals.splice(i, 1); continue; }
      const dx = c.x - ship.x, dy = c.y - ship.y;
      if (dx * dx + dy * dy < (SHIP_R + c.r) * (SHIP_R + c.r)) {
        crystals.splice(i, 1);
        score += 15;
        RA.setScore(score);
        sfx.coin();
        floatText(ship.x + 18, ship.y - 18, '+15', '#7dff8a');
        burst(c.x, c.y, { n: 10, colors: ['#7dff8a', '#00eaff', '#fff'], speed: 120 });
      }
    }

    // wall collision
    const s = segAtShip();
    const top = s.cy - s.gap / 2;
    const bot = s.cy + s.gap / 2;
    if (ship.y - SHIP_R < top || ship.y + SHIP_R > bot) {
      die();
    }
  }

  function init() {
    RA.setHUD('NEON CAVE', 'cave');
    reset();
    RA.showOverlay({
      title: 'NEON CAVE',
      sub: 'HOLD TO THRUST · THREAD THE CAVERN',
      lines: ['누르고 있으면 상승, 떼면 하강', '동굴 벽과 천장·바닥을 피하세요', '크리스탈 +15점'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }

  function onStart() {
    started = true;
    over = false;
    ship.vy = -80;
    input.isDown = false;
    input.justPressed = false;
    RA.audio.playBGM('cave');
  }

  function draw(g) {
    // deep void
    g.fillStyle = '#050714';
    g.fillRect(0, 0, VW, VH);

    // stars
    for (const st of stars) {
      g.globalAlpha = st.a;
      g.fillStyle = '#cfe8ff';
      g.fillRect(st.x, st.y, st.s, st.s);
    }
    g.globalAlpha = 1;

    // cave ceiling
    g.beginPath();
    g.moveTo(segs[0].x, 0);
    for (const s of segs) g.lineTo(s.x + SEG_W * 0.5, s.cy - s.gap / 2);
    g.lineTo(segs[segs.length - 1].x + SEG_W, 0);
    g.closePath();
    g.fillStyle = '#140a30';
    g.fill();

    // cave floor
    g.beginPath();
    g.moveTo(segs[0].x, VH);
    for (const s of segs) g.lineTo(s.x + SEG_W * 0.5, s.cy + s.gap / 2);
    g.lineTo(segs[segs.length - 1].x + SEG_W, VH);
    g.closePath();
    g.fillStyle = '#140a30';
    g.fill();

    // neon edges
    g.strokeStyle = '#00eaff';
    g.lineWidth = 2;
    g.shadowColor = 'rgba(0,234,255,.55)';
    g.shadowBlur = 8;
    g.beginPath();
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const x = s.x + SEG_W * 0.5;
      const y = s.cy - s.gap / 2;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.beginPath();
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const x = s.x + SEG_W * 0.5;
      const y = s.cy + s.gap / 2;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.shadowBlur = 0;

    // rock teeth
    g.fillStyle = '#3d2a7a';
    for (let i = 0; i < segs.length; i += 2) {
      const s = segs[i];
      const x = s.x + 6;
      g.fillRect(x, s.cy - s.gap / 2, 8, 10);
      g.fillRect(x + 4, s.cy + s.gap / 2 - 10, 8, 10);
    }

    // crystals
    for (const c of crystals) {
      const pulse = 1 + Math.sin(performance.now() / 140 + c.y) * 0.12;
      g.save();
      g.translate(c.x, c.y);
      g.rotate(Math.PI / 4);
      g.fillStyle = '#7dff8a';
      g.shadowColor = 'rgba(125,255,138,.7)';
      g.shadowBlur = 10;
      g.fillRect(-c.r * pulse * 0.55, -c.r * pulse * 0.55, c.r * pulse * 1.1, c.r * pulse * 1.1);
      g.restore();
      g.shadowBlur = 0;
    }

    // ship
    g.save();
    g.translate(ship.x, ship.y);
    const rot = Math.max(-0.55, Math.min(0.7, ship.vy / 700));
    g.rotate(rot);
    g.fillStyle = '#00eaff';
    g.beginPath();
    g.moveTo(14, 0);
    g.lineTo(-10, -9);
    g.lineTo(-6, 0);
    g.lineTo(-10, 9);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(-2, -3, 6, 6);
    if (ship.thrust && started && !over) {
      const flick = 6 + Math.sin(performance.now() / 40) * 4;
      g.fillStyle = '#ffe066';
      g.beginPath();
      g.moveTo(-10, -4);
      g.lineTo(-10 - flick, 0);
      g.lineTo(-10, 4);
      g.closePath();
      g.fill();
    }
    g.restore();

    if (started && !over) {
      g.globalAlpha = 0.85;
      g.fillStyle = '#fff';
      g.font = 'bold 28px monospace';
      g.textAlign = 'center';
      g.fillText(String(score), VW / 2, 86);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }

    if (!started && !over) {
      g.globalAlpha = 0.55 + Math.sin(performance.now() / 260) * 0.3;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('HOLD / TAP TO THRUST', VW / 2, VH * 0.72);
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
      if (!RA.isOverlayOpen()) {
        clearInterval(resumeHook);
        if (!over) RA.audio.playBGM(started ? 'cave' : 'menu');
      }
    }, 250);
  }

  function debug() {
    return {
      get score() { return score; },
      get dist() { return dist; },
      get over() { return over; },
      get started() { return started; },
      get ship() { return { x: ship.x, y: ship.y, vy: ship.vy }; },
      get gap() { const s = segAtShip(); return s ? s.gap : 0; },
      setShip(y, vy) { ship.y = y; if (vy !== undefined) ship.vy = vy; },
      pump(frames) { const dt = 1 / 60; for (let i = 0; i < frames; i++) update(dt); }
    };
  }

  return { init, update, draw, onStart, onPause, debug };
})();
