// ============================================================
// Game 22 — GHOST MAZE (Pac-Man lite: pellets, 4 ghosts, power-up)
// Tap adjacent cells to step; avoid ghosts unless powered up.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.ghostmaze = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;
  const COLS = 13, ROWS = 15;
  const CELL = Math.floor(Math.min((VW - 12) / COLS, (VH - 180) / ROWS));
  const BW = COLS * CELL, BH = ROWS * CELL;
  const BX = (VW - BW) / 2, BY = 90;
  const GHOST_COUNT = 4;

  // 0 = open, 1 = wall
  let walls, pellets, power, ppos, ghosts, score, started, over;
  let powerT, stepT, stepInterval, dir;

  // Fixed maze layout
  const LAYOUT = [
    "1111111111111",
    "1000001000001",
    "1011101011101",
    "1000000000001",
    "1011011110101",
    "1000010000100",
    "1111010110111",
    "1000010000000",
    "1011110111110",
    "1000000000101",
    "1011101110101",
    "1000100000100",
    "1110111011011",
    "1000000000001",
    "1111111111111",
  ];

  function reset() {
    walls = [];
    pellets = [];
    for (let y = 0; y < ROWS; y++) {
      const row = LAYOUT[y] || LAYOUT[0];
      const wallRow = [];
      const pelletRow = [];
      for (let x = 0; x < COLS; x++) {
        wallRow.push(row.charCodeAt(x) === 49 ? 1 : 0);
        // skip pellet on ghost spawn (center)
        pelletRow.push(row.charCodeAt(x) === 49 || (x === 6 && y === 7) ? 0 : 1);
      }
      walls.push(wallRow);
      pellets.push(pelletRow);
    }
    ppos = { x: 6, y: 11 };
    ghosts = [];
    for (let i = 0; i < GHOST_COUNT; i++) {
      ghosts.push({
        x: 1 + i * 3,
        y: 1,
        vx: 0, vy: 0,
        frightenT: 0,
        ang: 0
      });
    }
    power = { x: 1, y: ROWS - 2, active: true };
    powerT = 0;
    score = 0;
    started = false; over = false;
    stepT = 0; stepInterval = 0.18; dir = { x: 0, y: 0 };
    RA.setScore(0);
  }

  function isWall(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return 1;
    return walls[y][x];
  }

  function canMove(x, y) { return !isWall(x, y); }

  function readInput() {
    const taps = input.consumeTaps();
    if (!started && !over && taps.length > 0) { started = true; return; }
    if (!started || over) return;
    if (taps.length === 0) return;
    // Determine direction from tap position relative to player
    const t = taps[taps.length - 1];
    const px = BX + ppos.x * CELL + CELL / 2;
    const py = BY + ppos.y * CELL + CELL / 2;
    const dx = t.x - px, dy = t.y - py;
    if (Math.abs(dx) > Math.abs(dy)) dir = { x: dx > 0 ? 1 : -1, y: 0 };
    else dir = { x: 0, y: dy > 0 ? 1 : -1 };
  }

  function step(dt) {
    if (over) return;
    if (!started) return;
    stepT += dt;
    while (stepT >= stepInterval) {
      stepT -= stepInterval;
      // player step
      if (dir.x !== 0 || dir.y !== 0) {
        const nx = ppos.x + dir.x, ny = ppos.y + dir.y;
        if (canMove(nx, ny)) ppos = { x: nx, y: ny };
      }
      // collect pellet
      if (pellets[ppos.y][ppos.x]) {
        pellets[ppos.y][ppos.x] = 0;
        score += 1;
        sfx.hit();
      }
      // collect power
      if (power.active && ppos.x === power.x && ppos.y === power.y) {
        power.active = false;
        powerT = 7;
        score += 30;
        for (const g of ghosts) g.frightenT = 7;
        burst(BX + ppos.x * CELL + CELL / 2, BY + ppos.y * CELL + CELL / 2, 20, '#39ff14');
        sfx.confirm();
      }
      // ghost step (random walk biased toward player)
      for (const g of ghosts) {
        if (g.frightenT > 0) g.frightenT -= stepInterval;
        const options = [];
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (canMove(g.x + dx, g.y + dy)) options.push([dx, dy]);
        }
        if (options.length === 0) continue;
        // pick a direction that doesn't reverse (avoid jitter)
        let chosen = null;
        for (const [dx, dy] of options) {
          if (dx === -g.vx && dy === -g.vy && options.length > 1) continue;
          chosen = [dx, dy];
          break;
        }
        if (!chosen) chosen = options[0];
        g.vx = chosen[0]; g.vy = chosen[1];
        g.x += g.vx; g.y += g.vy;
        // collision
        if (g.x === ppos.x && g.y === ppos.y) {
          if (g.frightenT > 0) {
            // eat ghost
            score += 100;
            burst(BX + g.x * CELL + CELL / 2, BY + g.y * CELL + CELL / 2, 14, '#00eaff');
            g.x = 1; g.y = 1;
            sfx.confirm();
          } else {
            end();
            return;
          }
        }
      }
      if (powerT > 0) powerT -= stepInterval;
      // win?
      if (pellets.every(row => row.every(v => v === 0)) && !power.active) {
        score += 200;
        end();
        return;
      }
      RA.setScore(score);
    }
  }

  function end() {
    over = true;
    sfx.die();
    shake(8, 0.4);
    RA.submitScore('ghostmaze', score);
    setTimeout(() => {
      RA.showOverlay({
        title: score > 200 ? 'MAZE CLEARED' : 'GAME OVER',
        sub: `SCORE ${score}   BEST ${RA.best('ghostmaze')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 200);
  }

  function drawImpl(ctx) {
  const g = ctx;
    g.fillStyle = '#000';
    g.fillRect(0, 0, VW, VH);
    // walls
    g.fillStyle = '#2222aa';
    g.strokeStyle = '#00eaff';
    g.lineWidth = 1;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (walls[y][x]) {
          g.fillRect(BX + x * CELL, BY + y * CELL, CELL, CELL);
          g.strokeRect(BX + x * CELL, BY + y * CELL, CELL, CELL);
        }
      }
    }
    // pellets
    g.fillStyle = '#f9f002';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (pellets[y][x]) {
          g.beginPath();
          g.arc(BX + x * CELL + CELL / 2, BY + y * CELL + CELL / 2, 2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // power pellet
    if (power.active) {
      g.fillStyle = '#ff66d9';
      const px = BX + power.x * CELL + CELL / 2;
      const py = BY + power.y * CELL + CELL / 2;
      const r = 5 + Math.sin(performance.now() / 200) * 2;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
    // ghosts
    for (const g2 of ghosts) {
      const gx = BX + g2.x * CELL + CELL / 2;
      const gy = BY + g2.y * CELL + CELL / 2;
      const fright = g2.frightenT > 0;
      g.fillStyle = fright ? (g2.frightenT < 2 && Math.floor(g2.frightenT * 6) % 2 ? '#fff' : '#2222aa') : '#ff3355';
      g.beginPath();
      g.arc(gx, gy, CELL / 2 - 2, Math.PI, 0);
      g.lineTo(gx + CELL / 2 - 2, gy + CELL / 2 - 2);
      g.lineTo(gx, gy + CELL / 2 - 4);
      g.lineTo(gx - CELL / 2 + 2, gy + CELL / 2 - 2);
      g.closePath();
      g.fill();
      // eyes
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(gx - 2, gy - 1, 1.5, 0, Math.PI * 2);
      g.arc(gx + 2, gy - 1, 1.5, 0, Math.PI * 2);
      g.fill();
    }
    // player
    const px = BX + ppos.x * CELL + CELL / 2;
    const py = BY + ppos.y * CELL + CELL / 2;
    g.fillStyle = '#f9f002';
    g.beginPath();
    g.arc(px, py, CELL / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#000';
    const pa = Math.atan2(dir.y, dir.x);
    g.beginPath();
    g.arc(px + Math.cos(pa) * 2, py + Math.sin(pa) * 2, 1, 0, Math.PI * 2);
    g.fill();

    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('탭으로 시작 · 탭 방향으로 이동', VW / 2, VH / 2);
    }
    if (powerT > 0 && powerT < 3) {
      g.fillStyle = '#39ff14';
      g.textAlign = 'right';
      g.font = 'bold 11px monospace';
      g.fillText('POWER ' + powerT.toFixed(1) + 's', VW - 12, 18);
    }
  }

  function init() { reset(); }
  function update(dt) { readInput(); step(dt); }
  function draw(ctx) { drawImpl(ctx); }
  function onStart() { RA.audio.playBGM('runner'); RA.hideOverlay(); }
  function onPause() {
    RA.showOverlay({ title: 'PAUSED', tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }] });
    RA.audio.stopBGM();
    const h = setInterval(() => { if (!RA.isOverlayOpen()) { clearInterval(h); if (!over) RA.audio.playBGM('runner'); } }, 250);
  }

  function debug() {
    return {
      get ppos() { return ppos; },
      get ghosts() { return ghosts; },
      get score() { return score; },
      get over() { return over; },
      get started() { return started; },
      get powerT() { return powerT; },
      get pellets() { return pellets; },
      get power() { return power; },
      moveTo(x, y) { ppos = { x, y }; },
    };
  }

  return { init, update, draw: draw, onStart, onPause, debug };
})();
