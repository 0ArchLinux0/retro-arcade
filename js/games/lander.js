// ============================================================
// Game 20 — LUNAR LANDER (thrust + fuel + landing pad)
// Hold to fire thruster; land softly on the pad. Bonus for perfect
// landing (vx,vy < threshold) and remaining fuel.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.lander = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const GRAV = 60;                 // px/s^2
  const THRUST = 130;              // px/s^2 (when firing)
  const FUEL_START = 120;
  const LAND_VY_MAX = 38;
  const LAND_VX_MAX = 22;
  const PAD_Y = VH - 80;
  const PAD_W = 70;
  const SHIP_R = 9;

  let ship, terrain, padX, score, fuel, started, over, scroll;
  let flames, lastVx, lastVy, perfectLanding;

  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    const a = Math.sin(i * 127.1) * 43758.5453;
    const b = Math.sin((i + 1) * 127.1) * 43758.5453;
    const u = f * f * (3 - 2 * f);
    return ((a - Math.floor(a)) * (1 - u) + (b - Math.floor(b)) * u) * 2 - 1;
  }

  function buildTerrain() {
    const pts = [];
    for (let x = 0; x <= VW; x += 14) {
      const y = PAD_Y - 30 + noise1(x * 0.03) * 80 + Math.sin(x * 0.07) * 18;
      pts.push({ x, y: Math.max(60, y) });
    }
    return pts;
  }

  function reset() {
    // pick a pad location on flat terrain
    const seed = (Math.random() * 1000) | 0;
    padX = 60 + (seed % 8) * 30;
    terrain = buildTerrain();
    ship = { x: VW * 0.5, y: 80, vx: 0, vy: 0, ang: 0 };
    fuel = FUEL_START;
    score = 0;
    started = false; over = false; scroll = 0;
    flames = []; lastVx = 0; lastVy = 0; perfectLanding = false;
    RA.setScore(0);
  }

  function readInput() {
    const taps = input.consumeTaps();
    for (const t of taps) {
      // Tap to start if not started yet
      if (!started && !over) { started = true; break; }
    }
  }

  function step(dt) {
    if (over) return;
    if (!started) { flames.length = 0; return; }

    const thrusting = input.isDown && fuel > 0;
    if (thrusting) {
      ship.vy -= THRUST * dt;
      fuel = Math.max(0, fuel - dt * 14);
      if (Math.random() < 0.5) {
        flames.push({ x: ship.x, y: ship.y + SHIP_R, vx: (Math.random() - 0.5) * 12, vy: 60 + Math.random() * 30, life: 0.4 });
      }
    }
    ship.vy += GRAV * dt;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    // Update flames
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i];
      f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
      if (f.life <= 0) flames.splice(i, 1);
    }
    lastVx = ship.vx; lastVy = ship.vy;

    // Wall bounds
    if (ship.x < SHIP_R) { ship.x = SHIP_R; ship.vx = 0; }
    if (ship.x > VW - SHIP_R) { ship.x = VW - SHIP_R; ship.vx = 0; }

    // Ceiling
    if (ship.y < SHIP_R) { ship.y = SHIP_R; ship.vy = Math.max(0, ship.vy); }

    // Crash into terrain?
    for (const p of terrain) {
      const dx = ship.x - p.x, dy = ship.y - p.y;
      if (dx * dx + dy * dy < SHIP_R * SHIP_R) {
        end(false);
        return;
      }
    }

    // Landing on the pad?
    if (ship.y >= PAD_Y - SHIP_R &&
        ship.x > padX - PAD_W / 2 && ship.x < padX + PAD_W / 2) {
      if (Math.abs(ship.vy) < LAND_VY_MAX && Math.abs(ship.vx) < LAND_VX_MAX) {
        // soft landing
        ship.y = PAD_Y - SHIP_R;
        ship.vx = 0; ship.vy = 0;
        perfectLanding = Math.abs(ship.vy) < 10 && Math.abs(ship.vx) < 8;
        const fuelBonus = Math.floor(fuel * 4);
        const landingBonus = perfectLanding ? 800 : 300;
        const speedBonus = Math.floor(50 - Math.abs(ship.vy) - Math.abs(ship.vx));
        score = landingBonus + fuelBonus + Math.max(0, speedBonus) * 5;
        RA.setScore(score);
        end(true);
        if (perfectLanding) { burst(ship.x, ship.y, 30, '#39ff14'); floatText(ship.x, ship.y - 30, 'PERFECT!', '#39ff14'); }
        else { burst(ship.x, ship.y, 16, '#00eaff'); floatText(ship.x, ship.y - 30, 'TOUCHDOWN', '#00eaff'); }
        sfx.confirm();
      } else {
        end(false);
      }
    } else if (ship.y > VH + 50) {
      end(false);
    }

    RA.setScore(score);
  }

  function end(success) {
    over = true;
    if (success) {
      sfx.confirm();
    } else {
      sfx.die();
      shake(8, 0.4);
      burst(ship.x, ship.y, 24, '#ff3355');
    }
    RA.submitScore('lander', score);
    setTimeout(() => {
      RA.showOverlay({
        title: success ? (perfectLanding ? 'PERFECT LANDING' : 'LANDED') : 'CRASHED',
        sub: `SCORE ${score}   FUEL ${Math.floor(fuel)}   BEST ${RA.best('lander')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 200);
  }

  function drawTerrain(g) {
    g.fillStyle = '#241a4d';
    g.beginPath();
    g.moveTo(0, VH);
    for (const p of terrain) g.lineTo(p.x, p.y);
    g.lineTo(VW, VH);
    g.closePath();
    g.fill();
    g.strokeStyle = '#7dff8a';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < terrain.length; i++) {
      const p = terrain[i];
      if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    g.stroke();
  }

  function drawPad(g) {
    g.fillStyle = perfectLanding ? '#39ff14' : '#f9f002';
    g.fillRect(padX - PAD_W / 2, PAD_Y - 2, PAD_W, 4);
    g.fillStyle = '#fff';
    g.fillRect(padX - 2, PAD_Y - 10, 4, 10);
    g.fillRect(padX - 2, PAD_Y - 10, 14, 4);
  }

  function drawShip(g) {
    if (over) return;
    g.save();
    g.translate(ship.x, ship.y);
    g.rotate(ship.ang);
    g.fillStyle = '#00eaff';
    g.beginPath();
    g.moveTo(0, -SHIP_R);
    g.lineTo(-SHIP_R * 0.7, SHIP_R);
    g.lineTo(SHIP_R * 0.7, SHIP_R);
    g.closePath();
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.stroke();
    // legs
    g.strokeStyle = '#7dff8a';
    g.beginPath();
    g.moveTo(-SHIP_R * 0.6, SHIP_R);
    g.lineTo(-SHIP_R * 0.9, SHIP_R + 4);
    g.moveTo(SHIP_R * 0.6, SHIP_R);
    g.lineTo(SHIP_R * 0.9, SHIP_R + 4);
    g.stroke();
    g.restore();
  }

  function drawFlames(g) {
    for (const f of flames) {
      g.fillStyle = f.life > 0.25 ? '#f9f002' : '#ff8844';
      g.beginPath();
      g.arc(f.x, f.y, 3 + f.life * 4, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawHud(g) {
    g.fillStyle = '#fff';
    g.font = 'bold 11px monospace';
    g.textAlign = 'left';
    g.fillText('FUEL', 12, 18);
    const fuelW = 100;
    g.fillStyle = '#241a4d';
    g.fillRect(12, 22, fuelW, 8);
    g.fillStyle = fuel > FUEL_START * 0.4 ? '#39ff14' : (fuel > FUEL_START * 0.2 ? '#f9f002' : '#ff3355');
    g.fillRect(12, 22, (fuel / FUEL_START) * fuelW, 8);
    g.fillStyle = '#fff';
    g.textAlign = 'right';
    g.fillText('vy ' + (ship.vy | 0) + '  vx ' + (ship.vx | 0), VW - 12, 18);
    g.textAlign = 'left';
  }

  function init() {
    reset();
  }

  function update(dt) {
    readInput();
    step(dt);
  }

  function draw(ctx) {
    const g = ctx;
    // Stars
    g.fillStyle = '#0d0930';
    g.fillRect(0, 0, VW, VH);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 30; i++) {
      const x = (i * 53 + (scroll * 0.3)) % VW;
      const y = (i * 89) % (VH * 0.7);
      g.fillRect(x, y, 1, 1);
    }
    drawTerrain(g);
    drawPad(g);
    drawShip(g);
    drawFlames(g);
    drawHud(g);
    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('꾹 눌러 추력 · 탭으로 시작', VW / 2, VH / 2);
    }
  }

  function onStart() {
    RA.audio.playBGM('flappy');  // reuse a steady loop; BGM could be custom
    RA.hideOverlay();
  }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
    const resumeHook = setInterval(() => {
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!over) RA.audio.playBGM('flappy'); }
    }, 250);
  }

  function debug() {
    return {
      get ship() { return ship; },
      get score() { return score; },
      get fuel() { return fuel; },
      get over() { return over; },
      get started() { return started; },
      get padX() { return padX; },
      get perfectLanding() { return perfectLanding; },
      get vx() { return ship ? ship.vx : 0; },
      get vy() { return ship ? ship.vy : 0; },
      thrust(secs) { input.isDown = true; for (let i = 0; i < secs * 60; i++) update(1/60); input.isDown = false; },
      setPos(x, y) { ship.x = x; ship.y = y; },
    };
  }

  return { init, update, draw, onStart, onPause, debug };
})();
