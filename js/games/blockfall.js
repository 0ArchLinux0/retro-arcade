// ============================================================
// Game 7 — BLOCK FALL (Tetris-style falling blocks)
// Tap zones: left/right = move, upper = rotate, swipe down = hard drop
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.blockfall = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  // 10 wide x 18 tall board fits the 360x640 stage with room for HUD info
  const COLS = 10, ROWS = 18, CELL = 26;
  const BW = COLS * CELL;                 // 260
  const BX = (VW - BW) / 2;               // board left
  const BY = 96;                          // board top

  const SHAPES = {
    I: [[0,1],[1,1],[2,1],[3,1]],
    O: [[1,0],[2,0],[1,1],[2,1]],
    T: [[1,0],[0,1],[1,1],[2,1]],
    S: [[1,0],[2,0],[0,1],[1,1]],
    Z: [[0,0],[1,0],[1,1],[2,1]],
    J: [[0,0],[0,1],[1,1],[2,1]],
    L: [[2,0],[0,1],[1,1],[2,1]]
  };
  const COLORS = {
    I: '#00eaff', O: '#ffe066', T: '#b967ff', S: '#7dff8a',
    Z: '#ff3355', J: '#4d79ff', L: '#ff8844'
  };

  let grid, cur, nextType, bag, score, lines, level, dropTimer, dropInterval;
  let started, over, flashRows, flashTimer, softDropping;
  let lastTapT, tapCount;

  function makeBag() {
    const b = ['I','O','T','S','Z','J','L'];
    for (let i = b.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }
  function drawFromBag() {
    if (bag.length === 0) bag = makeBag();
    return bag.pop();
  }

  function spawn(type) {
    const t = type || nextType; nextType = drawFromBag();
    const cells = SHAPES[t].map(c => [c[0], c[1]]);
    // bounding box for spawn centering
    let minX = 9, maxX = -1;
    for (const c of cells) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); }
    const offX = Math.floor((COLS - (maxX - minX + 1)) / 2) - minX;
    return { type: t, cells, x: offX, y: -1 };
  }

  function collides(piece, dx = 0, dy = 0, cells = null) {
    for (const c of (cells || piece.cells)) {
      const x = piece.x + c[0] + dx, y = piece.y + c[1] + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  function rotateCells(piece) {
    // rotate around the piece's cell-space center, 90° CW
    let minX = 9, minY = 9, maxX = -1, maxY = -1;
    for (const c of piece.cells) {
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    }
    const w = maxX - minX, h = maxY - minY;
    return piece.cells.map(([x, y]) => [minX + (y - minY), minY + (w - (x - minX))]);
  }

  function tryRotate() {
    const cells = rotateCells(cur);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(cur, kick, 0, cells)) {
        cur.cells = cells;
        cur.x += kick;
        sfx.select();
        return;
      }
    }
  }

  function lock() {
    let topOut = false;
    for (const c of cur.cells) {
      const x = cur.x + c[0], y = cur.y + c[1];
      if (y < 0) { topOut = true; continue; }
      grid[y][x] = cur.type;
    }
    burst(BX + (cur.x + 1.5) * CELL, BY + (cur.y + 1) * CELL,
      { n: 8, colors: [COLORS[cur.type], '#fff'], speed: 90, size: 3 });
    if (topOut) { die(); return; }
    cur = spawn();

    // find full rows
    flashRows = [];
    for (let y = 0; y < ROWS; y++) {
      if (grid[y].every(v => v)) flashRows.push(y);
    }
    if (flashRows.length > 0) {
      flashTimer = 0.28;
      sfx.powerup();
      if (flashRows.length >= 4) { shake(7, 0.4); floatText(VW / 2, VH / 2, 'TETRIS!', '#ff66d9'); }
      else floatText(VW / 2, BY + flashRows[0] * CELL, '+' + flashRows.length, '#ffe066');
    } else {
      sfx.hit();
    }
  }

  function clearRows() {
    for (const y of flashRows) {
      grid.splice(y, 1);
      grid.unshift(new Array(COLS).fill(null));
    }
    const n = flashRows.length;
    lines += n;
    const base = [0, 100, 300, 500, 800][n];
    score += base * level;
    level = 1 + Math.floor(lines / 10);
    dropInterval = Math.max(0.08, 0.62 - (level - 1) * 0.055);
    flashRows = [];
  }

  function hardDrop() {
    let dist = 0;
    while (!collides(cur, 0, 1)) { cur.y++; dist++; }
    score += dist * 2;
    sfx.laser();
    lock();
  }

  function update(dt) {
    if (!started || over) return;

    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) clearRows();
      return;
    }

    // --- input: tap zones on the board area ---
    const taps = input.consumeTaps();
    for (const t of taps) {
      if (RA.isOverlayOpen()) continue;
      if (t.y > BY - 40 && t.y < VH) {
        if (t.x < BX + BW * 0.33) move(-1);
        else if (t.x > BX + BW * 0.67) move(1);
        else tryRotate();
      } else {
        tryRotate();
      }
    }
    // keyboard fallback
    if (input.keys['ArrowLeft']) { move(-1); input.keys['ArrowLeft'] = false; }
    if (input.keys['ArrowRight']) { move(1); input.keys['ArrowRight'] = false; }
    if (input.keys['ArrowUp']) { tryRotate(); input.keys['ArrowUp'] = false; }
    if (input.keys['Space']) { hardDrop(); input.keys['Space'] = false; }

    // hold-to-slide: pressing and holding a side zone keeps moving
    if (input.isDown && input.y > BY && input.y < VH) {
      if (input.x < BX + BW * 0.33) move(-1, true);
      else if (input.x > BX + BW * 0.67) move(1, true);
    }

    // gravity
    dropTimer += dt;
    const interval = softDropping ? Math.min(dropInterval, 0.05) : dropInterval;
    if (dropTimer >= interval) {
      dropTimer = 0;
      if (!collides(cur, 0, 1)) cur.y++;
      else lock();
    }
    softDropping = false;
  }

  function move(dir, held = false) {
    if (!collides(cur, dir, 0)) {
      cur.x += dir;
      if (!held) sfx.select();
    }
  }

  function die() {
    over = true;
    sfx.gameover();
    shake(8, 0.5);
    RA.submitScore('blockfall', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   LINES ${lines}   BEST ${RA.best('blockfall')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 600);
  }

  function reset() {
    grid = [];
    for (let y = 0; y < ROWS; y++) grid.push(new Array(COLS).fill(null));
    bag = [];
    nextType = drawFromBag();
    cur = spawn();
    score = 0; lines = 0; level = 1;
    dropTimer = 0; dropInterval = 0.62;
    started = false; over = false;
    flashRows = []; flashTimer = 0;
    softDropping = false;
  }

  function init() {
    RA.setHUD('BLOCK FALL', 'blockfall');
    reset();
    RA.showOverlay({
      title: 'BLOCK FALL',
      sub: 'CLASSIC BLOCK PUZZLE',
      lines: ['탭: 좌/우 이동 · 가운데 탭 = 회전', '아래로 쓸어내리기 = 하드드롭', '줄을 지워 레벨업!'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    RA.audio.playBGM('blockfall');
  }

  // ---------- draw ----------
  function cellXY(cx, cy) { return [BX + cx * CELL, BY + cy * CELL]; }

  function drawCell(g, cx, cy, color, alpha = 1) {
    const [px, py] = cellXY(cx, cy);
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    // bevel
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(px + 1, py + 1, CELL - 2, 4);
    g.fillRect(px + 1, py + 1, 4, CELL - 2);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(px + 1, py + CELL - 5, CELL - 2, 4);
    g.fillRect(px + CELL - 5, py + 1, 4, CELL - 2);
    g.globalAlpha = 1;
  }

  function draw(g) {
    g.fillStyle = '#05010f';
    g.fillRect(0, 0, VW, VH);

    // board bg
    g.fillStyle = '#0a0a1e';
    g.fillRect(BX - 3, BY - 3, BW + 6, ROWS * CELL + 6);
    g.strokeStyle = '#2a2a5e';
    g.lineWidth = 2;
    g.strokeRect(BX - 3, BY - 3, BW + 6, ROWS * CELL + 6);

    // grid lines
    g.strokeStyle = 'rgba(80,80,160,0.15)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 1; x < COLS; x++) { g.moveTo(BX + x * CELL, BY); g.lineTo(BX + x * CELL, BY + ROWS * CELL); }
    for (let y = 1; y < ROWS; y++) { g.moveTo(BX, BY + y * CELL); g.lineTo(BX + BW, BY + y * CELL); }
    g.stroke();

    // locked cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) {
          const flashing = flashRows.includes(y);
          drawCell(g, x, y, flashing ? '#ffffff' : COLORS[grid[y][x]], flashing ? 0.5 + Math.sin(performance.now() / 40) * 0.5 : 1);
        }
      }
    }

    // ghost piece
    if (!over && started) {
      let gy = 0;
      while (!collides(cur, 0, gy + 1)) gy++;
      for (const c of cur.cells) {
        const x = cur.x + c[0], y = cur.y + c[1] + gy;
        if (y >= 0) {
          const [px, py] = cellXY(x, y);
          g.strokeStyle = COLORS[cur.type];
          g.globalAlpha = 0.35;
          g.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
          g.globalAlpha = 1;
        }
      }
      // active piece
      for (const c of cur.cells) {
        const y = cur.y + c[1];
        if (y >= 0) drawCell(g, cur.x + c[0], y, COLORS[cur.type]);
      }
    }

    // side panel: NEXT + stats
    const panelX = BX + BW + 14;
    g.fillStyle = '#fff';
    g.font = 'bold 9px monospace';
    g.fillText('NEXT', panelX, BY + 14);
    if (nextType) {
      const cells = SHAPES[nextType];
      let minX = 9, minY = 9;
      for (const c of cells) { minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); }
      for (const c of cells) {
        const [px, py] = cellXY(0, 0);
        g.fillStyle = COLORS[nextType];
        g.fillRect(panelX + (c[0] - minX) * 14, BY + 24 + (c[1] - minY) * 14, 12, 12);
      }
    }
    g.fillStyle = '#9df';
    g.fillText('LINES', panelX, BY + 96);
    g.fillStyle = '#fff';
    g.font = 'bold 13px monospace';
    g.fillText(String(lines), panelX, BY + 112);
    g.fillStyle = '#9df';
    g.font = 'bold 9px monospace';
    g.fillText('LEVEL', panelX, BY + 136);
    g.fillStyle = '#fff';
    g.font = 'bold 13px monospace';
    g.fillText(String(level), panelX, BY + 152);

    // touch zone hint (first seconds)
    if (started && !over && performance.now() % 6000 < 3000) {
      g.globalAlpha = 0.25;
      g.fillStyle = '#fff';
      g.font = '9px monospace';
      g.textAlign = 'center';
      g.fillText('◀ 이동', BX + BW * 0.16, BY + ROWS * CELL + 18);
      g.fillText('회전', VW / 2, BY + ROWS * CELL + 18);
      g.fillText('이동 ▶', BX + BW * 0.84, BY + ROWS * CELL + 18);
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
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!over) RA.audio.playBGM(started ? 'blockfall' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause };
})();
