// ============================================================
// Game 27 — CHESS PUZZLE (simple AI; tap to select, tap to move)
// 8x8 board, 6 piece types, basic check/checkmate detection.
// Play vs a simple 1-ply AI.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.chess = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const COLS = 8, ROWS = 8;
  const BOARD_SIZE = Math.min(VW - 24, VH - 200);
  const CELL = Math.floor(BOARD_SIZE / 8);
  const BX = (VW - CELL * 8) / 2, BY = 100;

  // Pieces: K Q R B N P (white) lowercase (black)
  // board[row][col] = piece or ''
  let board, sel, score, started, over, turn, aiT, aiThinking;
  // Material values
  const VAL = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1, '': 0 };

  function initBoard() {
    const empty = () => Array(8).fill('');
    const b = Array.from({ length: 8 }, empty);
    // Black (top, uppercase)
    b[0] = ['R','N','B','Q','K','B','N','R'];
    b[1] = Array(8).fill('P');
    // White (bottom, lowercase)
    b[6] = Array(8).fill('p');
    b[7] = ['r','n','b','q','k','b','n','r'];
    return b;
  }

  function pieceColor(p) {
    if (!p) return '';
    return (p === p.toUpperCase()) ? 'b' : 'w';
  }

  function inBounds(c, r) { return c >= 0 && c < 8 && r >= 0 && r < 8; }

  // Generate pseudo-legal moves (no check detection)
  function genMoves(b, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p || pieceColor(p) !== color) continue;
        const t = p.toLowerCase();
        if (t === 'p') {
          const dir = (color === 'w') ? -1 : 1;
          const startRow = (color === 'w') ? 6 : 1;
          // forward
          if (inBounds(c, r + dir) && !b[r + dir][c]) {
            moves.push([c, r, c, r + dir]);
            if (r === startRow && !b[r + 2 * dir][c]) moves.push([c, r, c, r + 2 * dir]);
          }
          // captures
          for (const dc of [-1, 1]) {
            if (inBounds(c + dc, r + dir) && b[r + dir][c + dc] && pieceColor(b[r + dir][c + dc]) !== color) {
              moves.push([c, r, c + dc, r + dir]);
            }
          }
        } else if (t === 'n') {
          for (const [dc, dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const nc = c + dc, nr = r + dr;
            if (inBounds(nc, nr) && (!b[nr][nc] || pieceColor(b[nr][nc]) !== color)) moves.push([c, r, nc, nr]);
          }
        } else if (t === 'b' || t === 'r' || t === 'q') {
          const dirs = [];
          if (t === 'b' || t === 'q') dirs.push([-1,-1],[1,-1],[-1,1],[1,1]);
          if (t === 'r' || t === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
          for (const [dc, dr] of dirs) {
            for (let k = 1; k < 8; k++) {
              const nc = c + dc * k, nr = r + dr * k;
              if (!inBounds(nc, nr)) break;
              if (!b[nr][nc]) moves.push([c, r, nc, nr]);
              else {
                if (pieceColor(b[nr][nc]) !== color) moves.push([c, r, nc, nr]);
                break;
              }
            }
          }
        } else if (t === 'k') {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = c + dc, nr = r + dr;
            if (inBounds(nc, nr) && (!b[nr][nc] || pieceColor(b[nr][nc]) !== color)) moves.push([c, r, nc, nr]);
          }
        }
      }
    }
    return moves;
  }

  function applyMove(b, m) {
    const [c, r, nc, nr] = m;
    const piece = b[r][c];
    b[r][c] = '';
    // pawn promotion
    if (piece.toLowerCase() === 'p' && (nr === 0 || nr === 7)) {
      b[nr][nc] = (piece === 'P') ? 'Q' : 'q';
    } else {
      b[nr][nc] = piece;
    }
  }

  function inCheck(b, color) {
    const king = color === 'w' ? 'k' : 'K';
    let kc, kr;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === king) { kc = c; kr = r; }
    if (kc === undefined) return true;  // king captured
    const moves = genMoves(b, color === 'w' ? 'b' : 'w');
    return moves.some(m => m[2] === kc && m[3] === kr);
  }

  // Filter pseudo-legal moves by check detection
  function legalMoves(b, color) {
    return genMoves(b, color).filter(m => {
      const copy = b.map(row => row.slice());
      applyMove(copy, m);
      return !inCheck(copy, color);
    });
  }

  function evaluate(b) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      s += VAL[p.toUpperCase()] * (p === p.toUpperCase() ? -1 : 1);  // black positive, white negative
    }
    return s;
  }

  function aiMove() {
    const moves = legalMoves(board, 'b');
    if (moves.length === 0) { end('w'); return; }
    // 1-ply: pick the move with the best (highest) eval after the move
    let best = moves[0], bestVal = -Infinity;
    for (const m of moves) {
      const copy = board.map(row => row.slice());
      applyMove(copy, m);
      const v = evaluate(copy);
      if (v > bestVal) { bestVal = v; best = m; }
    }
    applyMove(board, best);
    sfx.tick();
    burst(BX + best[2] * CELL + CELL / 2, BY + best[3] * CELL + CELL / 2, 8, '#ff3355');
    turn = 'w';
    if (legalMoves(board, 'w').length === 0) {
      if (inCheck(board, 'w')) end('b');
      else end('d');
    }
  }

  function reset() {
    board = initBoard();
    sel = null; score = 0; started = false; over = false; turn = 'w';
    aiT = 0; aiThinking = false;
    RA.setScore(0);
  }

  function readInput() {
    const taps = input.consumeTaps();
    if (!started && !over && taps.length > 0) { started = true; return; }
    if (over || turn !== 'w' || aiThinking) return;
    for (const t of taps) {
      const c = Math.floor((t.x - BX) / CELL);
      const r = Math.floor((t.y - BY) / CELL);
      if (!inBounds(c, r)) continue;
      const p = board[r][c];
      if (sel) {
        // try move
        const moves = legalMoves(board, 'w');
        const m = moves.find(mv => mv[0] === sel.c && mv[1] === sel.r && mv[2] === c && mv[3] === r);
        if (m) {
          applyMove(board, m);
          sfx.tick();
          burst(BX + c * CELL + CELL / 2, BY + r * CELL + CELL / 2, 8, '#00eaff');
          sel = null;
          // check for promotion
          // check for game end
          turn = 'b';
          if (legalMoves(board, 'b').length === 0) {
            if (inCheck(board, 'b')) { end('w'); return; }
            else { end('d'); return; }
          }
          // AI moves after a delay
          aiT = 0.5;
          aiThinking = true;
        } else if (p && pieceColor(p) === 'w') {
          sel = { c, r };
        } else {
          sel = null;
        }
      } else {
        if (p && pieceColor(p) === 'w') sel = { c, r };
      }
    }
  }

  function step(dt) {
    if (over) return;
    if (aiThinking) {
      aiT -= dt;
      if (aiT <= 0) {
        aiThinking = false;
        aiMove();
      }
    }
  }

  function end(winner) {
    over = true;
    let title, sub;
    if (winner === 'd') { title = 'DRAW'; sub = 'STALEMATE'; }
    else if (winner === 'w') { title = 'CHECKMATE'; sub = 'YOU WIN!'; score = 500; }
    else { title = 'CHECKMATE'; sub = 'AI WINS'; }
    RA.submitScore('chess', score);
    sfx.confirm();
    setTimeout(() => {
      RA.showOverlay({
        title,
        sub: `${sub}   SCORE ${score}   BEST ${RA.best('chess')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 200);
    RA.setScore(score);
  }

  function drawImpl(ctx) {
  const g = ctx;
    g.fillStyle = '#0a0420';
    g.fillRect(0, 0, VW, VH);
    // board
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        g.fillStyle = (r + c) % 2 ? '#3a2c5c' : '#f0e6d2';
        g.fillRect(BX + c * CELL, BY + r * CELL, CELL, CELL);
        if (sel && sel.c === c && sel.r === r) {
          g.strokeStyle = '#39ff14';
          g.lineWidth = 3;
          g.strokeRect(BX + c * CELL, BY + r * CELL, CELL, CELL);
        }
      }
    }
    // pieces
    const SYM = { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙', k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
    g.font = `bold ${CELL - 4}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        g.fillStyle = p === p.toUpperCase() ? '#000' : '#fff';
        g.strokeStyle = p === p.toUpperCase() ? '#fff' : '#000';
        g.lineWidth = 1;
        const sym = SYM[p];
        g.fillText(sym, BX + c * CELL + CELL / 2, BY + r * CELL + CELL / 2);
        g.strokeText(sym, BX + c * CELL + CELL / 2, BY + r * CELL + CELL / 2);
      }
    }
    // HUD
    g.font = 'bold 12px monospace';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff';
    g.textAlign = 'left';
    g.fillText('TURN ' + (turn === 'w' ? 'YOU' : 'AI'), 12, 18);
    g.textAlign = 'right';
    g.fillText('SCORE ' + score, VW - 12, 18);
    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('탭으로 시작 · 탭-탭으로 이동', VW / 2, VH / 2);
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
      get board() { return board.map(r => r.slice()); },
      get sel() { return sel ? { ...sel } : null; },
      get turn() { return turn; },
      get score() { return score; },
      get over() { return over; },
      get started() { return started; },
      get inCheck() { return inCheck(board, turn); },
      setTurn(t) { turn = t; },
    };
  }

  return { init, update, draw: draw, onStart, onPause, debug };
})();
