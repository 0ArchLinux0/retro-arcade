// ============================================================
// Game 4 — TURBO RUSH (top-down retro racing, time attack)
// Drag/hold left-right to steer, auto accelerate. 3 laps.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.racing = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  // Track: centerline waypoints (closed loop), road half-width
  const ROAD_W = 62;
  const WPTS = (() => {
    const pts = [];
    // rounded rectangle-ish loop with an S-curve
    const defs = [
      [70, 90], [180, 70], [290, 90], [320, 170],
      [270, 230], [180, 250], [120, 300], [130, 380],
      [220, 420], [300, 470], [260, 560], [150, 580],
      [70, 520], [50, 420], [80, 330], [50, 220], [50, 140]
    ];
    // smooth via catmull-rom sampling
    const n = defs.length;
    for (let i = 0; i < n; i++) {
      const p0 = defs[(i - 1 + n) % n], p1 = defs[i], p2 = defs[(i + 1) % n], p3 = defs[(i + 2) % n];
      for (let t = 0; t < 1; t += 0.2) {
        const t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        pts.push({ x, y });
      }
    }
    return pts;
  })();

  function nearestWaypoint(x, y, hint = 0) {
    // search near hint first for speed, fallback full scan
    let best = Infinity, bi = hint;
    const n = WPTS.length;
    for (let k = -14; k <= 14; k++) {
      const i = ((hint + k) % n + n) % n;
      const d = (WPTS[i].x - x) ** 2 + (WPTS[i].y - y) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    if (best > 90 * 90) {  // lost — full scan
      for (let i = 0; i < n; i++) {
        const d = (WPTS[i].x - x) ** 2 + (WPTS[i].y - y) ** 2;
        if (d < best) { best = d; bi = i; }
      }
    }
    return { i: bi, d: Math.sqrt(best) };
  }

  function onRoad(x, y) {
    return nearestWaypoint(x, y).d < ROAD_W + 6;
  }

  let car, aiCars, lap, lapTime, totalTime, bestLap, raceDone, started;
  let camX, camY, checkpoints, countdown, skidTimer, pos;

  function init() {
    RA.setHUD('TURBO RUSH', 'racing');
    reset();
    RA.showOverlay({
      title: 'TURBO RUSH',
      sub: 'HOLD & DRAG TO STEER',
      lines: ['자동 가속! 좌우로 조향', '3랩 완주 — 최고 기록에 도전'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }

  function onStart() {
    started = true;
    countdown = 3.2;
    RA.audio.playBGM('racing');
  }

  function makeCar(x, y, ang, color, isAI) {
    return { x, y, ang, speed: 0, vx: 0, vy: 0, color, isAI, wp: 0, nextCp: 1, cpHits: 0, steer: 0, wobble: Math.random() * 10 };
  }

  function reset() {
    car = makeCar(70, 90, 0, '#ff3355', false);
    aiCars = [
      makeCar(70, 120, 0, '#ffd166', true),
      makeCar(70, 60, 0, '#7dff8a', true),
      makeCar(100, 90, 0, '#b967ff', true)
    ];
    lap = 1; lapTime = 0; totalTime = 0; bestLap = 0; raceDone = false; started = false;
    camX = 0; camY = 0;
    countdown = 0; skidTimer = 0;
    // checkpoints: quarter waypoints
    checkpoints = [0, Math.floor(WPTS.length / 4), Math.floor(WPTS.length / 2), Math.floor(WPTS.length * 3 / 4)];
    pos = 1;
  }

  function stepCar(c, dt, steerInput, throttle) {
    const MAXS = 340;
    // off-road drag
    const road = onRoad(c.x, c.y);
    const topSpeed = c.isAI ? MAXS * 0.86 : MAXS;   // AI slightly slower so player can win
    const maxS = road ? topSpeed : topSpeed * 0.45;

    if (throttle) c.speed += 260 * dt;
    else c.speed -= 120 * dt;
    if (c.speed > maxS) c.speed += (maxS - c.speed) * 4 * dt;
    if (c.speed < 0) c.speed = 0;

    const grip = road ? 3.4 : 2.2;
    c.ang += steerInput * grip * dt * (0.5 + Math.min(1, c.speed / 240) * 0.9);

    c.x += Math.cos(c.ang) * c.speed * dt;
    c.y += Math.sin(c.ang) * c.speed * dt;

    // keep near track (soft wall)
    const near = nearestWaypoint(c.x, c.y, c.wp);
    c.wp = near.i;
    if (near.d > ROAD_W + 14) {
      // push back toward centerline
      const w = WPTS[c.wp];
      const dx = w.x - c.x, dy = w.y - c.y;
      const dd = Math.max(1, Math.hypot(dx, dy));
      c.x += dx / dd * (near.d - ROAD_W - 14);
      c.y += dy / dd * (near.d - ROAD_W - 14);
      c.speed *= 0.965;
    }
    return road;
  }

  function updateLapProgress(c) {
    // advance through checkpoints 0->1->2->3->0...; crossing 0 completes a lap
    const near = nearestWaypoint(c.x, c.y, c.wp);
    c.wp = near.i;
    const target = checkpoints[c.nextCp];
    let d = Math.abs(near.i - target);
    d = Math.min(d, WPTS.length - d);
    if (d < 9 && near.d < ROAD_W + 30) {
      c.cpHits++;
      const crossedStart = c.nextCp === 0;
      c.nextCp = (c.nextCp + 1) % 4;
      return crossedStart ? 'lap' : 'cp';
    }
    return null;
  }

  function update(dt) {
    if (!started || raceDone) return;

    if (countdown > 0) {
      countdown -= dt;
      const prev = Math.ceil(countdown + dt);
      const cur = Math.ceil(countdown);
      if (cur !== prev && cur > 0) sfx.select();
      if (countdown <= 0) sfx.confirm();
    } else {
      lapTime += dt;
      totalTime += dt;
    }

    const racing = countdown <= 0;

    // --- player steering: hold left/right half OR drag relative ---
    let steer = 0;
    if (racing) {
      if (input.isDown) {
        // steer toward finger x relative to car screen pos
        const carScreenX = car.x - camX;
        const dx = input.x - carScreenX;
        if (Math.abs(dx) > 10) steer = Math.max(-1, Math.min(1, dx / 60));
      } else {
        steer = (input.keys['ArrowRight'] ? 1 : 0) - (input.keys['ArrowLeft'] ? 1 : 0);
      }
    }

    const wasRoad = onRoad(car.x, car.y);
    const road = stepCar(car, dt, steer, racing);
    if (racing && !road && car.speed > 120) {
      skidTimer -= dt;
      if (skidTimer <= 0) { sfx.drift(); skidTimer = 0.12; }
      if (wasRoad) burst(car.x, car.y, { n: 3, colors: ['#8a6', '#a86'], speed: 40, size: 4 });
    }

    if (racing) {
      const ev = updateLapProgress(car);
      for (const ai of aiCars) {
        // AI: steer toward lookahead waypoint with wobble
        const look = WPTS[(ai.wp + 6) % WPTS.length];
        const desired = Math.atan2(look.y - ai.y, look.x - ai.x);
        let dAng = desired - ai.ang;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        ai.wobble += dt;
        const steerIn = Math.max(-1, Math.min(1, dAng * 2.4 + Math.sin(ai.wobble * 1.3) * 0.18));
        stepCar(ai, dt, steerIn, true);
        updateLapProgress(ai);
      }

      // position calc (1st..4th): checkpoints passed + waypoint index
      const all = [car, ...aiCars].map((c, i) => ({ i, p: c.cpHits * WPTS.length + c.wp }));
      all.sort((a, b) => b.p - a.p);
      pos = all.findIndex(a => a.i === 0) + 1;

      // lap complete when crossing the start checkpoint in order
      if (ev === 'lap' && lapTime > 5) {
        if (!bestLap || lapTime < bestLap) bestLap = lapTime;
        sfx.powerup();
        floatText(car.x, car.y - 24, `LAP ${lap} DONE!`, '#ffe066');
        lap++;
        lapTime = 0;
        if (lap > 3) finishRace();
      }
    }

    // camera: follow player
    const targetX = car.x - VW / 2 + Math.cos(car.ang) * 40;
    const targetY = car.y - VH / 2 + Math.sin(car.ang) * 40;
    camX += (targetX - camX) * Math.min(1, 5 * dt);
    camY += (targetY - camY) * Math.min(1, 5 * dt);

    // car-vs-car soft collision
    const allCars = [car, ...aiCars];
    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        const a = allCars[i], b = allCars[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 22 && d > 0.01) {
          const push = (22 - d) / 2;
          a.x -= dx / d * push; a.y -= dy / d * push;
          b.x += dx / d * push; b.y += dy / d * push;
          if ((a === car || b === car) && Math.abs(car.speed) > 200) {
            sfx.hit();
            shake(4, 0.15);
          }
          a.speed *= 0.97; b.speed *= 0.97;
        }
      }
    }
  }

  function carJustLapped(c) {
    // kept for compatibility — lap detection now lives in updateLapProgress
    return false;
  }

  function finishRace() {
    raceDone = true;
    const total = Math.floor(totalTime * 100) / 100;
    RA.submitScore('racing', Math.max(1, Math.floor(10000 - totalTime * 10)));
    sfx.levelup();
    setTimeout(() => {
      RA.showOverlay({
        title: raceDone ? 'FINISH!' : 'RACE OVER',
        sub: `${pos}위   TOTAL ${total}s   BEST LAP ${bestLap ? bestLap.toFixed(2) : '-'}s`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 700);
  }

  function drawCar(g, c, camx, camy) {
    g.save();
    g.translate(c.x - camx, c.y - camy);
    g.rotate(c.ang + Math.PI / 2);
    // body
    g.fillStyle = c.color;
    g.fillRect(-9, -14, 18, 28);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(-7, -6, 14, 12);
    // wheels
    g.fillStyle = '#111';
    g.fillRect(-12, -10, 4, 8);
    g.fillRect(8, -10, 4, 8);
    g.fillRect(-12, 4, 4, 8);
    g.fillRect(8, 4, 4, 8);
    g.restore();
  }

  function draw(g) {
    g.fillStyle = '#0d3b2e';
    g.fillRect(0, 0, VW, VH);

    // grass texture dots (static pattern via modulo)
    g.fillStyle = 'rgba(255,255,255,0.04)';
    const gs = 26;
    const ox = ((-camX % gs) + gs) % gs, oy = ((-camY % gs) + gs) % gs;
    for (let x = ox - gs; x < VW + gs; x += gs) {
      for (let y = oy - gs; y < VH + gs; y += gs) {
        g.fillRect(x, y, 2, 2);
      }
    }

    // road: draw thick polyline
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // shoulder
    g.strokeStyle = '#e8e6d9';
    g.lineWidth = (ROAD_W + 10) * 2;
    drawTrackPath(g, -camX, -camY);
    g.stroke();
    // asphalt
    g.strokeStyle = '#3a3a48';
    g.lineWidth = ROAD_W * 2;
    drawTrackPath(g, -camX, -camY);
    g.stroke();
    // center dashes
    g.strokeStyle = '#ffe066';
    g.lineWidth = 3;
    g.setLineDash([12, 14]);
    g.lineDashOffset = -(performance.now() / 50) % 26 * 0; // static
    drawTrackPath(g, -camX, -camY);
    g.stroke();
    g.setLineDash([]);

    // start line
    const s0 = WPTS[0], s1 = WPTS[2];
    const ang = Math.atan2(s1.y - s0.y, s1.x - s0.x) + Math.PI / 2;
    g.save();
    g.translate(s0.x - camX, s0.y - camY);
    g.rotate(ang);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#fff' : '#111';
      g.fillRect(-ROAD_W + i * (ROAD_W * 2 / 8), -4, ROAD_W * 2 / 8, 8);
    }
    g.restore();

    // cars
    for (const ai of aiCars) drawCar(g, ai, camX, camY);
    drawCar(g, car, camX, camY);

    // countdown
    if (countdown > 0) {
      g.fillStyle = '#fff';
      g.font = 'bold 56px monospace';
      g.textAlign = 'center';
      g.globalAlpha = 0.9;
      const n = Math.ceil(countdown - 0.2);
      g.fillText(n > 0 ? String(n) : 'GO!', VW / 2, VH / 2);
      g.globalAlpha = 1;
      g.textAlign = 'left';
    }

    // HUD: lap / time / pos (canvas-drawn for retro feel)
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(VW - 108, 8, 100, 58);
    g.fillStyle = '#ffe066';
    g.font = 'bold 11px monospace';
    g.fillText(`LAP ${Math.min(lap, 3)}/3`, VW - 100, 24);
    g.fillStyle = '#fff';
    g.fillText(`TIME ${lapTime.toFixed(2)}`, VW - 100, 40);
    g.fillStyle = pos === 1 ? '#7dff8a' : '#ffd166';
    g.fillText(`${pos}th`, VW - 100, 56);
  }

  function drawTrackPath(g, ox, oy) {
    g.beginPath();
    g.moveTo(WPTS[0].x + ox, WPTS[0].y + oy);
    for (let i = 1; i < WPTS.length; i++) g.lineTo(WPTS[i].x + ox, WPTS[i].y + oy);
    g.closePath();
  }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
    const resumeHook = setInterval(() => {
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!raceDone) RA.audio.playBGM(started ? 'racing' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause, debug: () => ({ lap, lapTime: Math.round(lapTime), pos, raceDone, cpHits: car.cpHits, nextCp: car.nextCp, x: Math.round(car.x), y: Math.round(car.y), ang: car.ang, camX, camY }) };
})();
