// ============================================================
// Game 14 — MINESWEEPER (grid logic puzzle, tap = reveal,
// long-press / second tap on revealed-adjacent = flag)
// First tap is always safe (mines placed after first reveal).
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.minesweeper = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const COLS = 9, ROWS = 11, MINES = 14;
  const CELL = Math.floor(Math.min((VW - 24) / COLS, (VH - 210) / ROWS));
  const BW = COLS * CELL, BH = ROWS * CELL;
  const BX = (VW - BW) / 2, BY = VH - BH - 78;

  const NUM_COLORS = ['', '#4d79ff', '#2e8b57', '#ff3355', '#b967ff',
    '#ff8844', '#00eaff', '#fff', '#9aa'];

  let grid;            // {mine, adj, state:0 hidden|1 revealed|2 flagged}
  let started, over, won, flags, revealedCount, firstTap;
  let timerT, score, boomCell, boomT, flagMode;

  function reset() {
    grid = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ mine: false, adj: 0, state: 0 })));
    started = false; over = false; won = false;
    flags = 0; revealedCount = 0; firstTap = true;
    timerT = 0; score = 0; boomCell = null; boomT = 0;
    flagMode = false;
    RA.setScore(0);
  }

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push([nr, nc]);
    }
    return out;
  }

  function placeMines(sr, sc) {
    // safe zone: first tapped cell + its neighbors
    const safe = new Set([`${sr},${sc}`, ...neighbors(sr, sc).map(([r, c]) => `${r},${c}`)]);
    let placed = 0, guard = 0;
    while (placed < MINES && guard++ < 2000) {
      const r = (Math.random() * ROWS) | 0, c = (Math.random() * COLS) | 0;
      if (grid[r][c].mine || safe.has(`${r},${c}`)) continue;
      grid[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        grid[r][c].adj = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
  }

  function cellAt(px, py) {
    const c = Math.floor((px - BX) / CELL), r = Math.floor((py - BY) / CELL);
    return (r >= 0 && r < ROWS && c >= 0 && c < COLS) ? [r, c] : null;
  }

  function floodReveal(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cell = grid[cr][cc];
      if (cell.state !== 0 || cell.state === 2) continue;
      if (cell.state === 1) continue;
      cell.state = 1;
      revealedCount++;
      score += 10;
      if (cell.adj === 0 && !cell.mine) {
        for (const [nr, nc] of neighbors(cr, cc)) {
          if (grid[nr][nc].state === 0) stack.push([nr, nc]);
        }
      }
    }
  }

  function toggleFlag(r, c) {
    const cell = grid[r][c];
    if (cell.state === 1) return false;
    cell.state = cell.state === 2 ? 0 : 2;
    flags += cell.state === 2 ? 1 : -1;
    sfx.select();
    return true;
  }

  function chord(r, c) {
    const cell = grid[r][c];
    let flagged = 0;
    for (const [nr, nc] of neighbors(r, c)) if (grid[nr][nc].state === 2) flagged++;
    if (flagged !== cell.adj) return;
    for (const [nr, nc] of neighbors(r, c)) {
      const n = grid[nr][nc];
      if (n.state === 0) {
        if (n.mine) { explode(nr, nc); return; }
        floodReveal(nr, nc);
        sfx.eat();
      }
    }
    checkWin();
  }

  function reveal(r, c) {
    if (!started) { started = true; placeMines(r, c); RA.audio.playBGM('minesweeper'); }
    const cell = grid[r][c];
    if (cell.state === 2 || cell.state === 1) return;
    if (cell.mine) { explode(r, c); return; }
    floodReveal(r, c);
    sfx.eat();
    checkWin();
  }

  function explode(r, c) {
    over = true;
    boomCell = [r, c]; boomT = 0.5;
    shake(7, 0.45);
    sfx.explode();
    for (let rr = 0; rr < ROWS; rr++)
      for (let cc = 0; cc < COLS; cc++)
        if (grid[rr][cc].mine) grid[rr][cc].state = 1;
    finish(false);
  }

  function checkWin() {
    if (revealedCount === COLS * ROWS - MINES) {
      over = true; won = true;
      score += 500 + Math.max(0, Math.floor(600 - timerT * 4));
      finish(true);
    }
  }

  function finish(w) {
    RA.setScore(score);
    RA.submitScore('minesweeper', score);
    setTimeout(() => {
      RA.showOverlay({
        title: w ? 'CLEARED!' : 'BOOM!',
        sub: `SCORE ${score}   BEST ${RA.best('minesweeper')}`,
        lines: w ? [`TIME ${Math.floor(timerT)}s · FLAG BONUS INCLUDED`] : [`MINES LEFT ${MINES - flags}`],
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 600);
  }

  // ---------- input ----------
  let pressT = 0, pressCell = null, longFired = false;
  function handleTap(px, py) {
    const rc = cellAt(px, py);
    if (!rc || over) return;
    const [r, c] = rc;
    if (flagMode) { toggleFlag(r, c); return; }
    const cell = grid[r][c];
    if (cell.state === 1 && cell.adj > 0) chord(r, c);
    else reveal(r, c);
  }

  function update(dt) {
    if (started && !over) {
      timerT += dt;
      score = Math.max(score, Math.floor(revealedCount * 10 + Math.max(0, 300 - timerT)));
    }
    if (boomT > 0) boomT -= dt;
    if (!over && started) RA.setScore(score);

    if (input.isDown && !over) {
      pressT += dt;
      if (pressT > 0.42 && !longFired) {
        longFired = true;
        const rc = cellAt(input.x, input.y);
        if (rc && grid[rc[0]][rc[1]].state !== 1) toggleFlag(rc[0], rc[1]);
      }
    }

    if (!started && !over) {
      gAlpha = 0.55 + Math.sin(performance.now() / 260) * 0.3;
    }

    if (input.justPressed) { input.justPressed = false; }
    const taps = input.consumeTaps();
    for (const t of taps) {
      if (!over) handleTap(t.x, t.y);
    }
    if (input.keys['Space']) { input.keys['Space'] = false; flagMode = !flagMode; sfx.select(); }
  }
  let gAlpha = 0.6;

  // ---------- draw ----------
  function draw(g) {
    g.fillStyle = '#0b0518';
    g.fillRect(0, 0, VW, VH);

    // top bar: mines left / time / flag mode
    g.font = 'bold 12px monospace';
    g.fillStyle = '#ff66d9';
    g.fillText(`💣 ${MINES - flags}`, BX, BY - 34);
    g.fillStyle = '#ffe066';
    g.fillText(`⏱ ${Math.floor(timerT)}s`, BX + 90, BY - 34);
    g.fillStyle = flagMode ? '#39ff14' : '#555';
    g.fillText(flagMode ? '🚩 FLAG MODE' : 'HOLD=FLAG', BX + 160, BY - 34);

    // board
    g.fillStyle = '#0e0a24';
    g.fillRect(BX - 4, BY - 4, BW + 8, BH + 8);
    g.strokeStyle = 'rgba(0,234,255,.35)';
    g.lineWidth = 2;
    g.strokeRect(BX - 4, BY - 4, BW + 8, BH + 8);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = BX + c * CELL, y = BY + r * CELL;
        const cell = grid[r][c];
        const isBoom = boomCell && boomCell[0] === r && boomCell[1] === c && boomT > 0;
        if (cell.state === 1) {
          g.fillStyle = isBoom ? '#ff3355' : 'rgba(255,255,255,.04)';
          g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          if (cell.mine) {
            g.fillStyle = '#fff';
            g.beginPath(); g.arc(x + CELL / 2, y + CELL / 2, CELL * 0.22, 0, Math.PI * 2); g.fill();
          } else if (cell.adj > 0) {
            g.fillStyle = NUM_COLORS[cell.adj];
            g.font = `bold ${CELL * 0.52}px monospace`;
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(String(cell.adj), x + CELL / 2, y + CELL / 2 + 1);
            g.textAlign = 'left'; g.textBaseline = 'alphabetic';
          }
        } else {
          g.fillStyle = cell.state === 2 ? 'rgba(255,102,217,.18)' : 'rgba(120,110,220,.13)';
          g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          g.strokeStyle = 'rgba(0,234,255,.10)';
          g.lineWidth = 1;
          g.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
          if (cell.state === 2) {
            g.font = `${CELL * 0.44}px monospace`;
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText('🚩', x + CELL / 2, y + CELL / 2 + 1);
            g.textAlign = 'left'; g.textBaseline = 'alphabetic';
          }
        }
      }
    }

    if (!started && !over) {
      g.globalAlpha = gAlpha;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 13px monospace';
      g.fillText('탭하여 시작! (첫 탭은 항상 안전)', VW / 2, VH * 0.28);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }
  }

  function init() {
    RA.setHUD('MINESWEEPER', 'minesweeper');
    reset();
    RA.showOverlay({
      title: 'MINESWEEPER',
      sub: 'TAP REVEAL · HOLD FLAG · TAP NUMBER CHORD',
      lines: ['지뢰 14개를 피해 모든 안전 칸을 여세요', '첫 탭은 절대 지뢰가 아닙니다', '숫자 탭으로 주변 한 번에 열기(Chord)'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = started && !over ? started : started;
    if (!started) { /* mines placed on first reveal */ }
    RA.audio.playBGM(started ? 'minesweeper' : 'menu');
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
        if (!over) RA.audio.playBGM(started ? 'minesweeper' : 'menu');
      }
    }, 250);
  }

  function debug() {
    return {
      get grid() { return grid; },
      get COLS() { return COLS; },
      get ROWS() { return ROWS; },
      get MINES() { return MINES; },
      get over() { return over; },
      get won() { return won; },
      get score() { return score; },
      get flags() { return flags; },
      get revealedCount() { return revealedCount; },
      placeMines, reveal, toggleFlag, chord, floodReveal,
      pump(frames) { const dt = 1 / 60; for (let i = 0; i < frames; i++) update(dt); }
    };
  }

  return { init, update, draw, onStart, onPause, debug };
})();
