// ============================================================
// Game 20 — WHACK MOLE (grid moles: tap fast, avoid bombs)
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.mole = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const COLS = 3, ROWS = 3;
  const GAME_TIME = 45;

  let holes, score, over, started, spawnT, timeLeft, combo;
  let gx0, gy0, cell;

  function reset() {
    holes = [];
    for (let i = 0; i < COLS * ROWS; i++) holes.push({ mole: false, bomb: false, t: 0, life: 0 });
    score = 0; over = false; started = false;
    spawnT = 0.5; timeLeft = GAME_TIME; combo = 0;
    const gw = VW - 60, gh = VH - 240;
    cell = Math.min(gw / COLS, gh / ROWS);
    gx0 = (VW - cell * COLS) / 2;
    gy0 = 130 + (VH - 190 - gh) / 2 + 10;
  }

  function end() {
    over = true;
    sfx.die();
    shake(6, 0.3);
    RA.submitScore('mole', score);
    setTimeout(() => {
      RA.showOverlay({
        title: "TIME'S UP",
        sub: `SCORE ${score}   BEST ${RA.best('mole')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function update(dt) {
    if (!started || over) return;

    timeLeft -= dt;
    if (timeLeft <= 0) { end(); return; }

    spawnT -= dt;
    if (spawnT <= 0) {
      const hidden = holes.map((h, i) => (!h.mole && !h.bomb) ? i : -1).filter(i => i >= 0);
      if (hidden.length) {
        const idx = hidden[Math.floor(Math.random() * hidden.length)];
        const bomb = Math.random() < 0.16 + (1 - timeLeft / GAME_TIME) * 0.12;
        holes[idx] = { mole: !bomb, bomb, t: 0, life: bomb ? 1.4 : Math.max(0.7, 1.35 - (GAME_TIME - timeLeft) * 0.014) };
      }
      spawnT = Math.max(0.32, 0.85 - (GAME_TIME - timeLeft) * 0.012);
    }

    for (const h of holes) {
      if (h.mole || h.bomb) {
        h.t += dt;
        if (h.t > h.life) { h.mole = h.bomb = false; combo = 0; }
      }
    }

    for (const t of input.consumeTaps()) {
      const cx = Math.floor((t.x - gx0) / cell), cy = Math.floor((t.y - gy0) / cell);
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
      const h = holes[cy * COLS + cx];
      if (!h.mole && !h.bomb) continue;
      const px = gx0 + cx * cell + cell / 2, py = gy0 + cy * cell + cell / 2;
      if (h.bomb) {
        h.mole = h.bomb = false;
        score -= 60; combo = 0;
        sfx.die();
        shake(7, 0.3);
        burst(px, py, { n: 18, colors: ['#ff5555', '#ffaa33'], speed: 150 });
        floatText(px, py - 20, '-60');
        score = Math.max(0, score);
      } else {
        h.mole = false;
        combo++;
        const pts = 25 + Math.min(75, (combo - 1) * 12);
        score += pts;
        sfx.coin();
        burst(px, py, { n: 9, colors: ['#b967ff', '#ffe066'], speed: 110 });
        floatText(px, py - 22, `+${pts}${combo > 2 ? ` x${combo}` : ''}`);
      }
      RA.setScore(score);
    }
  }

  function init() {
    RA.setHUD('WHACK MOLE', 'mole');
    reset();
    RA.showOverlay({
      title: 'WHACK MOLE',
      sub: 'TAP THE MOLES',
      lines: ['두더지를 두드려 점수!', '폭탄은 절대 금지 · 연속 타격 시 콤보'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    RA.audio.playBGM('mole');
  }

  function draw(g) {
    g.fillStyle = '#1c1208';
    g.fillRect(0, 0, VW, VH);

    g.fillStyle = '#9d8fd1';
    g.font = '11px "Press Start 2P", monospace';
    g.fillText(`TIME ${Math.ceil(Math.max(0, timeLeft))}s`, 16, 56);
    g.textAlign = 'right';
    g.fillText(`${score} PTS`, VW - 16, 56);
    g.textAlign = 'left';

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = gx0 + c * cell, y = gy0 + r * cell;
        // dirt hole
        g.fillStyle = '#4a3018';
        g.beginPath(); g.ellipse(x + cell / 2, y + cell * 0.72, cell * 0.36, cell * 0.16, 0, 0, 7); g.fill();
        const h = holes[r * COLS + c];
        if (h.mole || h.bomb) {
          const rise = Math.sin(Math.min(1, h.t / 0.18) * Math.PI / 2);
          const my = y + cell * 0.72 - rise * cell * 0.42;
          if (h.bomb) {
            g.fillStyle = '#222';
            g.beginPath(); g.arc(x + cell / 2, my, cell * 0.24, 0, 7); g.fill();
            g.strokeStyle = '#ff5555'; g.lineWidth = 2;
            g.beginPath(); g.arc(x + cell / 2, my, cell * 0.24, 0, 7); g.stroke();
            g.fillStyle = '#ffcc00';
            g.fillRect(x + cell / 2 - 2, my - cell * 0.34, 4, 6);
          } else {
            g.fillStyle = '#8a5a2a';
            g.beginPath(); g.arc(x + cell / 2, my, cell * 0.26, 0, 7); g.fill();
            g.fillStyle = '#e8b87a';
            g.beginPath(); g.arc(x + cell / 2, my + cell * 0.05, cell * 0.17, 0, 7); g.fill();
            g.fillStyle = '#000';
            g.fillRect(x + cell / 2 - cell * 0.11, my - cell * 0.04, 4, 5);
            g.fillRect(x + cell / 2 + cell * 0.06, my - cell * 0.04, 4, 5);
            g.fillStyle = '#ff8899';
            g.fillRect(x + cell / 2 - 5, my + 5, 10, 4);
          }
        }
      }
    }
  }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
  }

  function debug() {
    return {
      get holes() { return holes; },
      get score() { return score; },
      get timeLeft() { return timeLeft; },
      get dead() { return over; },
      setTime(s) { timeLeft = s; },
      pop(idx, bomb) { holes[idx] = { mole: !bomb, bomb, t: 0, life: 1 }; }
    };
  }

  return { init, update, draw, onStart, onPause, debug };
})();
