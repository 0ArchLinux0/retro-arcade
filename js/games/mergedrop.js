// ============================================================
// Game 13 — MERGE DROP (drop-number merge puzzle, 2048 family)
// Aim with drag, release to drop. Equal neighbours merge & chain.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.mergedrop = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const COLS = 6, ROWS = 8;
  const CELL = Math.floor(Math.min((VW - 20) / COLS, (VH - 195) / ROWS));
  const BW = COLS * CELL, BH = ROWS * CELL;
  const BX = (VW - BW) / 2, BY = VH - BH - 84;

  const SPAWN_POOL = [2, 2, 2, 4, 4, 8];
  const TIERS = ['#00eaff', '#7dff8a', '#ffe066', '#ff8844', '#ff66d9', '#b967ff', '#4d79ff', '#ff3355', '#39ff14', '#ffd166'];

  let grid, cur, next, score, started, over;
  let pending, targetCol, flashCol, flashT, comboShow, comboT;
  let merges, dropLockT;

  function emptyGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill(0)); }
  function randVal() { return SPAWN_POOL[(Math.random() * SPAWN_POOL.length) | 0]; }
  function pullTiles() { cur = next != null ? next : randVal(); next = randVal(); }
  function tierColor(v) { return TIERS[(Math.log2(v) - 1 + TIERS.length * 4) % TIERS.length]; }

  function reset() {
    grid = emptyGrid();
    cur = null; next = null;
    score = 0; started = false; over = false;
    pending = null; targetCol = (COLS / 2) | 0;
    flashCol = -1; flashT = 0; comboShow = 0; comboT = 0;
    merges = 0; dropLockT = 0;
    pullTiles();
    RA.setScore(0);
  }

  function colFromX(px) {
    return Math.max(0, Math.min(COLS - 1, Math.floor((px - BX) / CELL)));
  }
  function colFull(c) { return grid[0][c] !== 0; }
  function boardFull() { for (let c = 0; c < COLS; c++) if (!colFull(c)) return false; return true; }

  function tryDrop() {
    if (!started || over || pending || cur == null) return;
    if (dropLockT > 0) return;
    if (colFull(targetCol)) { flashCol = targetCol; flashT = 0.35; sfx.hit(); return; }
    pending = { col: targetCol, val: cur, t: 0, dur: 0.085 };
    cur = null;
    sfx.shoot();
  }

  function land() {
    const { col, val } = pending;
    pending = null;
    let r = -1;
    for (let i = ROWS - 1; i >= 0; i--) if (!grid[i][col]) { r = i; break; }
    if (r < 0) { sfx.hit(); return; }
    grid[r][col] = val;
    resolve();
    if (boardFull()) { gameOver(); return; }
    pullTiles();
    dropLockT = 0.05;
  }

  function findPair() {
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (!v) continue;
        if (c + 1 < COLS && grid[r][c + 1] === v) return { a: [r, c], b: [r, c + 1] };
        if (r > 0 && grid[r - 1][c] === v) return { a: [r, c], b: [r - 1, c] };
      }
    }
    return null;
  }

  function gravity() {
    for (let c = 0; c < COLS; c++) {
      let w = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c]) {
          const v = grid[r][c];
          grid[r][c] = 0;
          grid[w--][c] = v;
        }
      }
    }
  }

  function cellCenter(r, c) { return { x: BX + c * CELL + CELL / 2, y: BY + r * CELL + CELL / 2 }; }

  function resolve() {
    let combo = 0;
    for (let guard = 0; guard < 220; guard++) {
      const p = findPair();
      if (!p) break;
      const [ar, ac] = p.a, [br, bc] = p.b;
      const nv = grid[ar][ac] * 2;
      grid[br][bc] = 0;
      grid[ar][ac] = nv;
      score += nv * (combo + 1);
      merges++;
      RA.meta && RA.meta.event && RA.meta.event('merge_count', 1);
      const ctr = cellCenter(ar, ac);
      burst(ctr.x, ctr.y, { n: 10 + Math.min(10, combo * 3), colors: [tierColor(nv), '#fff'], speed: 130 });
      floatText(ctr.x, ctr.y - 8, `+${nv}${combo > 0 ? ` x${combo + 1}` : ''}`, combo > 0 ? '#7dff8a' : '#ffe066');
      if (combo === 0) sfx.eat();
      else if (combo === 1) sfx.coin();
      else sfx.powerup();
      if (nv >= 256) { shake(5, 0.25); sfx.levelup(); }
      combo++;
      comboShow = combo;
      comboT = 0.9;
      gravity();
    }
    if (combo > 0) RA.setScore(score);
  }

  function gameOver() {
    over = true;
    sfx.gameover();
    shake(7, 0.4);
    RA.submitScore('mergedrop', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   BEST ${RA.best('mergedrop')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function update(dt) {
    if (flashT > 0) flashT -= dt;
    if (comboT > 0) comboT -= dt;
    if (dropLockT > 0) dropLockT -= dt;

    if (!started || over) return;

    targetCol = colFromX(input.x);

    if (!pending) {
      if (input.justPressed) { input.justPressed = false; tryDrop(); }
      else if (input.consumeTaps().length) tryDrop();
      else if (input.keys['Space']) { input.keys['Space'] = false; tryDrop(); }
    } else {
      pending.t += dt;
      if (pending.t >= pending.dur) land();
    }
  }

  // ---------- draw ----------
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawTile(g, cx, cy, v, alpha, scale) {
    const s = (CELL - 4) * (scale || 1);
    const col = tierColor(v);
    g.globalAlpha = alpha;
    g.fillStyle = '#10102a';
    roundRect(g, cx - s / 2, cy - s / 2, s, s, 8);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.shadowColor = col;
    g.shadowBlur = 8;
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    const d = String(v).length;
    g.font = `bold ${d <= 2 ? 19 : d === 3 ? 15 : 11}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(v), cx, cy + 1);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.globalAlpha = 1;
  }

  function draw(g) {
    g.fillStyle = '#0b0518';
    g.fillRect(0, 0, VW, VH);

    // board
    g.fillStyle = '#0e0a24';
    g.fillRect(BX - 3, BY - 3, BW + 6, BH + 6);
    g.strokeStyle = 'rgba(0,234,255,.35)';
    g.lineWidth = 2;
    g.strokeRect(BX - 3, BY - 3, BW + 6, BH + 6);
    g.strokeStyle = 'rgba(120,110,220,.14)';
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 1; c < COLS; c++) { g.moveTo(BX + c * CELL, BY); g.lineTo(BX + c * CELL, BY + BH); }
    for (let r = 1; r < ROWS; r++) { g.moveTo(BX, BY + r * CELL); g.lineTo(BX + BW, BY + r * CELL); }
    g.stroke();

    // target column highlight
    if (started && !over) {
      g.fillStyle = flashT > 0 && flashCol === targetCol ? 'rgba(255,51,85,.28)' : 'rgba(255,255,255,.06)';
      g.fillRect(BX + targetCol * CELL, BY, CELL, BH);
    }

    // tiles
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v) { const ctr = cellCenter(r, c); drawTile(g, ctr.x, ctr.y, v, 1, 1); }
      }

    // falling tile
    if (pending) {
      const prog = Math.min(1, pending.t / pending.dur);
      const ease = prog * prog;
      const x = BX + pending.col * CELL + CELL / 2;
      const y0 = BY - CELL * 1.1;
      const y1 = BY + (lowestEmpty(pending.col)) * CELL + CELL / 2;
      drawTile(g, x, y0 + (y1 - y0) * ease, pending.val, 1, 1);
    } else if (cur != null && started && !over) {
      const bob = Math.sin(performance.now() / 180) * 3;
      drawTile(g, BX + targetCol * CELL + CELL / 2, BY - CELL * 0.72 + bob, cur, 0.95, 1);
    }

    // next preview
    g.fillStyle = '#8f86c9';
    g.font = 'bold 8px monospace';
    g.fillText('NEXT', BX + BW - 52, BY - 46);
    if (next != null) drawTile(g, BX + BW - 26, BY - 26, next, 0.9, 0.82);

    // combo banner
    if (comboT > 0 && comboShow > 1) {
      g.globalAlpha = Math.min(1, comboT / 0.4);
      g.fillStyle = '#7dff8a';
      g.font = 'bold 22px monospace';
      g.textAlign = 'center';
      g.fillText(`COMBO x${comboShow}`, VW / 2, BY + BH / 2);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }

    // merge meter
    g.fillStyle = '#9df';
    g.font = 'bold 9px monospace';
    g.fillText(`MERGES ${merges}`, BX, VH - 26);

    if (!started && !over) {
      g.globalAlpha = 0.55 + Math.sin(performance.now() / 260) * 0.3;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 13px monospace';
      g.fillText('탭하여 시작!', VW / 2, VH * 0.32);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }
  }

  function lowestEmpty(c) {
    for (let i = ROWS - 1; i >= 0; i--) if (!grid[i][c]) return i;
    return -1;
  }

  function init() {
    RA.setHUD('MERGE DROP', 'mergedrop');
    reset();
    RA.showOverlay({
      title: 'MERGE DROP',
      sub: 'DRAG TO AIM · TAP TO DROP',
      lines: ['같은 숫자가 붙으면 합쳐집니다', '연쇄 머지 콤보로 고득점!', '보드가 가득 차면 게임 오버'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    RA.audio.playBGM('mergedrop');
  }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
    const resumeHook = setInterval(() => {
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!over) RA.audio.playBGM(started ? 'mergedrop' : 'menu'); }
    }, 250);
  }

  function debug() {
    return {
      get grid() { return grid; },
      get COLS() { return COLS; },
      get ROWS() { return ROWS; },
      get score() { return score; },
      get over() { return over; },
      get merges() { return merges; },
      get pending() { return !!pending; },
      forceCur(v) { cur = v; },
      dropCol(c) { targetCol = Math.max(0, Math.min(COLS - 1, c)); tryDrop(); },
      pump(frames) { const dt = 1 / 60; for (let i = 0; i < frames; i++) update(dt); }
    };
  }

  return { init, update, draw, onStart, onPause, debug };
})();
