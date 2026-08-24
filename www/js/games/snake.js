// ============================================================
// Game 11 — SNAKE CLASSIC (grid snake with progressive speed)
// Swipe/drag to steer, eat food, don't bite yourself.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.snake = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const COLS = 17, ROWS = 22;
  const CELL = Math.floor(Math.min((VW - 24) / COLS, (VH - 150) / ROWS));
  const BW = COLS * CELL, BH = ROWS * CELL;
  const BX = (VW - BW) / 2, BY = 92;

  let snake, dir, nextDir, food, bonus, bonusT, score, started, over;
  let moveT, moveInterval, growPend;

  function placeFood() {
    let x, y, clash;
    do {
      x = (Math.random() * COLS) | 0;
      y = (Math.random() * ROWS) | 0;
      clash = snake.some(s => s.x === x && s.y === y);
    } while (clash);
    return { x, y };
  }

  function reset() {
    snake = [{ x: (COLS / 2) | 0, y: (ROWS / 2) | 0 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0; started = false; over = false;
    moveT = 0; moveInterval = 0.16; growPend = 2;
    food = placeFood();
    bonus = null; bonusT = 0;
    RA.setScore(0);
  }

  function steer(nx, ny) {
    // no instant reversal
    if (dir.x === -nx && dir.y === -ny) return;
    nextDir = { x: nx, y: ny };
    if (!started && !over) { started = true; }
  }

  function readInput() {
    // swipe detection from tap positions relative to drag
    if (input.isDown) {
      if (input._lastX === undefined) { input._lastX = input.x; input._lastY = input.y; }
      const dx = input.x - input._lastX, dy = input.y - input._lastY;
      if (Math.hypot(dx, dy) > 18) {
        if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
        else steer(0, dy > 0 ? 1 : -1);
        input._lastX = input.x; input._lastY = input.y;
      }
    } else {
      input._lastX = undefined;
    }
    const taps = input.consumeTaps();
    for (const t of taps) {
      // tap quadrants around board center also steer (tap-to-turn)
      const cx = BX + BW / 2, cy = BY + BH / 2;
      const dx = t.x - cx, dy = t.y - cy;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) continue;   // center tap ignored
      if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
      else steer(0, dy > 0 ? 1 : -1);
    }
    // keyboard
    if (input.keys['ArrowLeft']) { steer(-1, 0); input.keys['ArrowLeft'] = false; }
    if (input.keys['ArrowRight']) { steer(1, 0); input.keys['ArrowRight'] = false; }
    if (input.keys['ArrowUp']) { steer(0, -1); input.keys['ArrowUp'] = false; }
    if (input.keys['ArrowDown']) { steer(0, 1); input.keys['ArrowDown'] = false; }
  }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // wall collision = death (classic)
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { die(); return; }
    // self collision (allow moving into the tail tip that's about to vacate)
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) { die(); return; }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 10;
      growPend += 1;
      sfx.eat();
      burst(BX + head.x * CELL + CELL / 2, BY + head.y * CELL + CELL / 2,
        { n: 8, colors: ['#ff3355', '#fff'], speed: 90 });
      floatText(BX + head.x * CELL, BY + head.y * CELL, '+10', '#ffe066');
      food = placeFood();
      // speed up as you grow
      moveInterval = Math.max(0.075, 0.16 - score / 1000);
      RA.setScore(score);
      // spawn bonus every 5 foods
      if (score % 50 === 0 && !bonus) {
        bonus = placeFood();
        bonusT = 6;
        sfx.powerup();
      }
    } else if (bonus && head.x === bonus.x && head.y === bonus.y) {
      score += 50;
      burst(BX + head.x * CELL + CELL / 2, BY + head.y * CELL + CELL / 2,
        { n: 14, colors: ['#ffe066', '#7dff8a'], speed: 130 });
      floatText(BX + head.x * CELL, BY + head.y * CELL, '+50!', '#7dff8a');
      sfx.coin();
      bonus = null;
      RA.setScore(score);
    }

    if (growPend > 0) growPend--;
    else snake.pop();
  }

  function die() {
    over = true;
    sfx.die();
    shake(8, 0.45);
    const h = snake[0];
    burst(BX + h.x * CELL + CELL / 2, BY + h.y * CELL + CELL / 2,
      { n: 20, colors: ['#7dff8a', '#ff3355', '#fff'], speed: 170 });
    RA.submitScore('snake', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   LENGTH ${snake.length}   BEST ${RA.best('snake')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function update(dt) {
    if (!started || over) return;

    readInput();

    if (bonus) {
      bonusT -= dt;
      if (bonusT <= 0) bonus = null;
    }

    moveT += dt;
    while (moveT >= moveInterval) {
      moveT -= moveInterval;
      step();
      if (over) break;
    }
  }

  function init() {
    RA.setHUD('SNAKE CLASSIC', 'snake');
    reset();
    RA.showOverlay({
      title: 'SNAKE CLASSIC',
      sub: 'SWIPE OR TAP TO STEER',
      lines: ['밥을 먹고 길게 성장 — 벽과 몸통 주의!', '노란 보너스는 먹기 전에 사라집니다'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    RA.audio.playBGM('snake');
  }

  function draw(g) {
    g.fillStyle = '#04120a';
    g.fillRect(0, 0, VW, VH);

    // board
    g.fillStyle = '#081c10';
    g.fillRect(BX - 3, BY - 3, BW + 6, BH + 6);
    g.strokeStyle = '#1d5c34';
    g.lineWidth = 2;
    g.strokeRect(BX - 3, BY - 3, BW + 6, BH + 6);
    g.strokeStyle = 'rgba(60,160,100,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 1; x < COLS; x++) { g.moveTo(BX + x * CELL, BY); g.lineTo(BX + x * CELL, BY + BH); }
    for (let y = 1; y < ROWS; y++) { g.moveTo(BX, BY + y * CELL); g.lineTo(BX + BW, BY + y * CELL); }
    g.stroke();

    // food
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;
    g.fillStyle = '#ff3355';
    g.beginPath();
    g.arc(BX + food.x * CELL + CELL / 2, BY + food.y * CELL + CELL / 2, (CELL / 2 - 3) * pulse, 0, Math.PI * 2);
    g.fill();

    // bonus
    if (bonus) {
      g.globalAlpha = bonusT < 2 ? (Math.sin(performance.now() / 90) > 0 ? 1 : 0.25) : 1;
      g.fillStyle = '#ffe066';
      g.fillRect(BX + bonus.x * CELL + 3, BY + bonus.y * CELL + 3, CELL - 6, CELL - 6);
      g.fillStyle = '#000';
      g.font = `bold ${CELL - 10}px monospace`;
      g.textAlign = 'center';
      g.fillText('★', BX + bonus.x * CELL + CELL / 2, BY + bonus.y * CELL + CELL - 6);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }

    // snake body gradient-ish
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const t = i / Math.max(1, snake.length - 1);
      g.globalAlpha = i === 0 ? 1 : 0.55 + t * 0.45;
      g.fillStyle = i === 0 ? '#b6ffcb' : '#4fd97a';
      g.fillRect(BX + s.x * CELL + 1, BY + s.y * CELL + 1, CELL - 2, CELL - 2);
      if (i === 0) {
        // eyes based on direction
        g.fillStyle = '#05240f';
        const ex = BX + s.x * CELL + CELL / 2 + dir.x * 4;
        const ey = BY + s.y * CELL + CELL / 2 + dir.y * 4;
        const px = dir.x !== 0 ? 0 : 3, py = dir.y !== 0 ? 0 : 3;
        g.fillRect(ex - px - 1, ey - py - 1, 3, 3);
        g.fillRect(ex + px - 2, ey + py - 2, 3, 3);
      }
    }
    g.globalAlpha = 1;

    // length meter
    g.fillStyle = '#9df';
    g.font = 'bold 9px monospace';
    g.fillText(`LENGTH ${snake.length}`, BX, VH - 28);
    if (bonus) {
      g.fillStyle = '#ffe066';
      g.fillText(`BONUS ${bonusT.toFixed(1)}s`, BX + BW - 70, VH - 28);
    }

    if (!started && !over) {
      g.globalAlpha = 0.6 + Math.sin(performance.now() / 260) * 0.3;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('스와이프 또는 탭으로 방향 전환', VW / 2, BY + BH / 2);
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
      if (!RA.isOverlayOpen()) { clearInterval(resumeHook); if (!over) RA.audio.playBGM(started ? 'flappy' : 'menu'); }
    }, 250);
  }

  return { init, update, draw, onStart, onPause };
})();
