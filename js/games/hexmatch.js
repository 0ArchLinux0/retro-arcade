// ============================================================
// Game 26 — HEX MATCH (hexagonal 3-in-a-row puzzle)
// Tap two adjacent hexes to swap. Match 3+ in a row to clear.
// Drag-drop also supported.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.hexmatch = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const COLS = 7, ROWS = 8;
  const HEX_R = 22;
  const HEX_H = HEX_R * Math.sqrt(3);
  const COLORS = ['#ff3355', '#f9f002', '#7dff8a', '#00eaff', '#b967ff', '#ff8844'];

  let board, sel, score, started, over, hintT, anim;
  // anim: {type:'swap', a:{x,y}, b:{x,y}, t:0}

  function hexCenter(c, r) {
    const x = (VW - (COLS + 0.5) * HEX_R * 1.5) / 2 + c * HEX_R * 1.5 + HEX_R;
    const y = 110 + r * HEX_H + (c % 2 ? HEX_H / 2 : 0);
    return { x, y };
  }

  function hexAt(px, py) {
    // Approximate: pick the nearest hex center
    let best = null, bd = 9999;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ct = hexCenter(c, r);
        const d = Math.hypot(px - ct.x, py - ct.y);
        if (d < best || best === null) { best = { c, r, d }; bd = d; }
      }
    }
    return best && best.d < HEX_R ? best : null;
  }

  function reset() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(COLORS[(Math.random() * COLORS.length) | 0]);
      board.push(row);
    }
    sel = null; score = 0; started = false; over = false; hintT = 0; anim = null;
    RA.setScore(0);
  }

  function neighbours(c, r) {
    // pointy-top hex neighbors
    const odd = c % 2;
    const dirs = odd
      ? [[-1,-1],[1,-1],[-1,0],[1,0],[0,1],[0,-1]].map(d => [d[1], d[0]])
      : [[-1,0],[1,0],[-1,1],[1,1],[0,1],[0,-1]].map(d => [d[1], d[0]]);
    // simpler: 6 directions
    return [
      [c - 1, r - (odd ? 1 : 0)],
      [c + 1, r - (odd ? 1 : 0)],
      [c - 1, r + (odd ? 0 : 1)],
      [c + 1, r + (odd ? 0 : 1)],
      [c, r - 1],
      [c, r + 1],
    ];
  }

  function matches() {
    const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const groups = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (seen[r][c] || !board[r][c]) continue;
        const color = board[r][c];
        const group = [];
        const stack = [[c, r]];
        while (stack.length) {
          const [cc, rr] = stack.pop();
          if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
          if (seen[rr][cc] || board[rr][cc] !== color) continue;
          seen[rr][cc] = true;
          group.push([cc, rr]);
          for (const [nc, nr] of neighbours(cc, rr)) stack.push([nc, nr]);
        }
        if (group.length >= 3) groups.push(group);
      }
    }
    return groups;
  }

  function collapse() {
    const ms = matches();
    if (ms.length === 0) return 0;
    let total = 0;
    for (const g of ms) {
      for (const [c, r] of g) {
        if (board[r][c]) { board[r][c] = null; total++; }
      }
      score += g.length * 10;
    }
    // drop
    for (let c = 0; c < COLS; c++) {
      const stack = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][c] !== null) stack.push(board[r][c]);
      }
      for (let r = ROWS - 1; r >= 0; r--) {
        board[r][c] = stack.shift() || COLORS[(Math.random() * COLORS.length) | 0];
      }
    }
    return total;
  }

  function trySwap(a, b) {
    if (anim) return;
    if (a.c === b.c && a.r === b.r) { sel = null; return; }
    const dist = Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
    if (dist > 1.5) { sel = null; return; }
    // swap
    const t = board[a.r][a.c];
    board[a.r][a.c] = board[b.r][b.c];
    board[b.r][b.c] = t;
    const cleared = collapse();
    if (cleared === 0) {
      // undo
      board[b.r][b.c] = board[a.r][a.c];
      board[a.r][a.c] = t;
    } else {
      // chain
      let chain = 1;
      let more = collapse();
      while (more > 0) { chain++; score += chain * 5; more = collapse(); }
      sfx.confirm();
    }
    sel = null;
    RA.setScore(score);
    if (board.every(row => row.every(c => c !== null))) {
      // no more moves possible? not really, since we always refill
    }
  }

  function readInput() {
    const taps = input.consumeTaps();
    if (!started && !over && taps.length > 0) { started = true; return; }
    if (over) return;
    for (const t of taps) {
      const h = hexAt(t.x, t.y);
      if (!h) continue;
      if (!sel) sel = h;
      else trySwap(sel, h);
    }
  }

  function step(dt) {
    if (over || !started) return;
    hintT += dt;
  }

  function drawHex(cx, cy, color, g) {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const x = cx + Math.cos(a) * HEX_R;
      const y = cy + Math.sin(a) * HEX_R;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.stroke();
  }

  function drawImpl(ctx) {
  const g = ctx;
    g.fillStyle = '#0a0420';
    g.fillRect(0, 0, VW, VH);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c]) continue;
        const ct = hexCenter(c, r);
        if (sel && sel.c === c && sel.r === r) {
          g.save();
          g.translate(ct.x, ct.y - 3);
          drawHex(0, 0, board[r][c], g);
          g.restore();
        } else {
          drawHex(ct.x, ct.y, board[r][c], g);
        }
      }
    }
    g.fillStyle = '#fff';
    g.font = 'bold 12px monospace';
    g.textAlign = 'right';
    g.fillText('SCORE ' + score, VW - 12, 18);
    g.textAlign = 'left';
    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('탭 두 번으로 스왑 · 3+ 매치', VW / 2, VH / 2);
    }
  }

  function init() { reset(); }
  function update(dt) { readInput(); step(dt); }
  function draw(ctx) { drawImpl(ctx); }
  function onStart() { RA.audio.playBGM('menu'); RA.hideOverlay(); }
  function onPause() {
    RA.showOverlay({ title: 'PAUSED', tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }] });
    RA.audio.stopBGM();
    const h = setInterval(() => { if (!RA.isOverlayOpen()) { clearInterval(h); if (!over) RA.audio.playBGM('menu'); } }, 250);
  }

  function debug() {
    return {
      get board() { return board; },
      get score() { return score; },
      get sel() { return sel; },
      get over() { return over; },
      get started() { return started; },
      swap(a, b) { trySwap(a, b); },
    };
  }

  return { init, update, draw: draw, onStart, onPause, debug };
})();
