// ============================================================
// Game 8 — BRICK BREAK (Breakout/Arkanoid-style)
// Drag to move paddle, ball physics, power-ups, 5 stages.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.brickbreak = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const PW = 64, PH = 10;          // paddle
  const BR = 6;                     // ball radius
  const COLS = 8, BW_ = 38, BH = 16, GAP = 4;
  const GRID_W = COLS * (BW_ + GAP) - GAP;
  const GX = (VW - GRID_W) / 2, GY = 90;

  const ROW_COLORS = ['#ff3355', '#ff8844', '#ffe066', '#7dff8a', '#00eaff', '#b967ff'];

  let paddle, balls, bricks, drops, particlesFx;
  let stage, score, lives, started, over, stateTimer, state, comboTimer, combo;

  function makeStage(n) {
    const rows = Math.min(6, 3 + Math.floor((n - 1) / 2));
    const bricksArr = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        // pattern variation by stage
        if (n >= 3 && (r + c) % 7 === 0 && n % 2 === 0) continue;
        if (n >= 4 && c === 0 && r % 2 === 1) continue;
        bricksArr.push({
          x: GX + c * (BW_ + GAP), y: GY + r * (BH + GAP),
          w: BW_, h: BH,
          hp: (n >= 2 && r < 2) ? 2 : 1,
          color: ROW_COLORS[r % ROW_COLORS.length]
        });
      }
    }
    return bricksArr;
  }

  function resetPaddleBall() {
    paddle.x = VW / 2;
    balls = [{ x: VW / 2, y: VH - 120, vx: 0, vy: 0, stuck: true }];
    drops = [];
  }

  function launch() {
    for (const b of balls) {
      if (b.stuck) {
        b.stuck = false;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        const sp = 300 + stage * 12;
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      }
    }
    sfx.shoot();
  }

  function spawnDrop(x, y) {
    if (Math.random() > 0.18) return;
    const kinds = ['wide', 'multi', 'slow'];
    drops.push({ x, y, kind: kinds[(Math.random() * kinds.length) | 0] });
  }

  function applyDrop(d) {
    sfx.powerup();
    floatText(d.x, d.y, d.kind === 'wide' ? 'WIDE!' : d.kind === 'multi' ? 'MULTI!' : 'SLOW!', '#7dff8a');
    if (d.kind === 'wide') { paddle.w = Math.min(PW * 1.5, paddle.w + 20); }
    else if (d.kind === 'multi') {
      const src = balls[0];
      if (src) {
        for (const da of [-0.5, 0.5]) {
          const sp = Math.hypot(src.vx, src.vy) || 300;
          const a = Math.atan2(src.vy, src.vx) + da;
          balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, stuck: false });
        }
      }
    } else { // slow
      for (const b of balls) { b.vx *= 0.75; b.vy *= 0.75; }
    }
  }

  function loseBall(b, i) {
    balls.splice(i, 1);
    burst(b.x, b.y, { n: 16, colors: ['#ff3355', '#fff'], speed: 160 });
    if (balls.length === 0) {
      lives--;
      paddle.w = PW;
      sfx.hit();
      shake(7, 0.35);
      if (lives <= 0) die();
      else resetPaddleBall();
    } else {
      sfx.explode();
    }
  }

  function update(dt) {
    if (!started || over) return;

    if (state === 'clear') {
      stateTimer -= dt;
      if (stateTimer <= 0) {
        stage++;
        if (stage > 5) { // win!
          RA.submitScore('brickbreak', score);
          over = true;
          sfx.levelup();
          setTimeout(() => {
            RA.showOverlay({
              title: 'ALL CLEAR!',
              sub: `SCORE ${score}   BEST ${RA.best('brickbreak')}`,
              buttons: [
                { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
                { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
              ]
            });
          }, 500);
          return;
        }
        bricks = makeStage(stage);
        resetPaddleBall();
        state = 'play';
        floatText(VW / 2, VH / 2, `STAGE ${stage}`, '#ffe066');
      }
      return;
    }

    // --- paddle control: follow finger ---
    if (input.isDown) {
      paddle.x += (input.x - paddle.x) * Math.min(1, 14 * dt);
      if (!balls.some(b => !b.stuck)) launch();
    } else if (input.keys['ArrowLeft'] || input.keys['ArrowRight']) {
      paddle.x += ((input.keys['ArrowRight'] ? 1 : 0) - (input.keys['ArrowLeft'] ? 1 : 0)) * 420 * dt;
    }
    paddle.x = Math.max(paddle.w / 2, Math.min(VW - paddle.w / 2, paddle.x));
    paddle.w += (PW - paddle.w) * dt * 0.4;   // slowly return to normal width

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.stuck) { b.x = paddle.x; b.y = paddle.y - BR - 2; continue; }

      b.x += b.vx * dt; b.y += b.vy * dt;

      // walls
      if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); sfx.select(); }
      if (b.x > VW - BR) { b.x = VW - BR; b.vx = -Math.abs(b.vx); sfx.select(); }
      if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); sfx.select(); }

      // paddle bounce — angle depends on hit position
      if (b.vy > 0 && b.y + BR >= paddle.y - PH / 2 && b.y - BR <= paddle.y + PH / 2 &&
          b.x >= paddle.x - paddle.w / 2 - BR && b.x <= paddle.x + paddle.w / 2 + BR) {
        const rel = Math.max(-1, Math.min(1, (b.x - paddle.x) / (paddle.w / 2)));
        const sp = Math.min(520, Math.hypot(b.vx, b.vy) * 1.02);
        const ang = -Math.PI / 2 + rel * 1.05;
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
        b.y = paddle.y - PH / 2 - BR;
        combo = 0;
        sfx.eat();
      }

      // floor
      if (b.y > VH + BR) { loseBall(b, i); continue; }

      // bricks
      for (let j = bricks.length - 1; j >= 0; j--) {
        const k = bricks[j];
        if (b.x + BR < k.x || b.x - BR > k.x + k.w || b.y + BR < k.y || b.y - BR > k.y + k.h) continue;

        // resolve on the axis of least penetration
        const px = Math.min(b.x + BR - k.x, k.x + k.w - (b.x - BR));
        const py = Math.min(b.y + BR - k.y, k.y + k.h - (b.y - BR));
        if (px < py) { b.vx = b.x < k.x + k.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); }
        else { b.vy = b.y < k.y + k.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); }

        k.hp--;
        if (k.hp <= 0) {
          bricks.splice(j, 1);
          combo++;
          comboTimer = 1.2;
          const pts = 50 * stage + combo * 10;
          score += pts;
          burst(k.x + k.w / 2, k.y + k.h / 2, { n: 10, colors: [k.color, '#fff'], speed: 130 });
          if (combo > 1) floatText(k.x + k.w / 2, k.y, `${combo} COMBO`, '#ffe066');
          spawnDrop(k.x + k.w / 2, k.y + k.h / 2);
          sfx.coin();
        } else {
          sfx.hit();
          burst(b.x, b.y, { n: 4, colors: ['#fff'], speed: 70, size: 3 });
        }
        break;
      }
    }

    // combo decay
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }

    // drops fall
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += 140 * dt;
      if (d.y > VH + 12) { drops.splice(i, 1); continue; }
      if (Math.abs(d.x - paddle.x) < paddle.w / 2 + 10 && Math.abs(d.y - paddle.y) < PH) {
        applyDrop(d);
        drops.splice(i, 1);
      }
    }

    // stage clear?
    if (bricks.length === 0 && state === 'play') {
      score += 500 * stage;
      state = 'clear';
      stateTimer = 1.4;
      sfx.powerup();
      floatText(VW / 2, VH / 2, `STAGE CLEAR! +${500 * stage}`, '#7dff8a');
    }

    RA.setScore(score);
  }

  function die() {
    over = true;
    sfx.gameover();
    shake(8, 0.5);
    RA.submitScore('brickbreak', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `SCORE ${score}   STAGE ${stage}   BEST ${RA.best('brickbreak')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 600);
  }

  function reset() {
    paddle = { x: VW / 2, y: VH - 56, w: PW };
    balls = []; drops = [];
    stage = 1; score = 0; lives = 3;
    started = false; over = false;
    state = 'play'; stateTimer = 0;
    combo = 0; comboTimer = 0;
    bricks = makeStage(stage);
    resetPaddleBall();
  }

  function init() {
    RA.setHUD('BRICK BREAK', 'brickbreak');
    reset();
    RA.showOverlay({
      title: 'BRICK BREAK',
      sub: 'DRAG TO MOVE PADDLE',
      lines: ['드래그로 패들 이동 — 자동 발사!', '아이템을 먹고 5스테이지 클리어'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    RA.audio.playBGM('brickbreak');
  }

  function draw(g) {
    g.fillStyle = '#05010f';
    g.fillRect(0, 0, VW, VH);

    // subtle grid backdrop
    g.strokeStyle = 'rgba(80,80,160,0.08)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < VW; x += 40) { g.moveTo(x, 0); g.lineTo(x, VH); }
    for (let y = 0; y < VH; y += 40) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.stroke();

    // bricks
    for (const k of bricks) {
      g.fillStyle = k.color;
      g.globalAlpha = k.hp > 1 ? 1 : 0.85;
      g.fillRect(k.x, k.y, k.w, k.h);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(k.x, k.y, k.w, 3);
      if (k.hp > 1) {
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fillRect(k.x + 2, k.y + 2, 5, 5);
        g.fillRect(k.x + k.w - 7, k.y + 2, 5, 5);
      }
      g.globalAlpha = 1;
    }

    // drops
    for (const d of drops) {
      g.fillStyle = d.kind === 'wide' ? '#ffe066' : d.kind === 'multi' ? '#ff66d9' : '#7dff8a';
      g.fillRect(d.x - 8, d.y - 5, 16, 10);
      g.fillStyle = '#000';
      g.font = 'bold 8px monospace';
      g.textAlign = 'center';
      g.fillText(d.kind[0].toUpperCase(), d.x, d.y + 3);
      g.textAlign = 'left';
    }

    // balls
    for (const b of balls) {
      g.fillStyle = '#fff';
      g.fillRect(b.x - BR, b.y - BR, BR * 2, BR * 2);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(b.x - BR - 2, b.y - BR - 2, BR * 2 + 4, BR * 2 + 4);
    }

    // paddle
    g.fillStyle = '#00eaff';
    g.fillRect(paddle.x - paddle.w / 2, paddle.y - PH / 2, paddle.w, PH);
    g.fillStyle = '#fff';
    g.fillRect(paddle.x - paddle.w / 2, paddle.y - PH / 2, paddle.w, 3);

    // lives
    g.fillStyle = '#00eaff';
    for (let i = 0; i < lives; i++) g.fillRect(10 + i * 16, VH - 22, 11, 7);

    // stage indicator
    g.fillStyle = '#9df';
    g.font = 'bold 9px monospace';
    g.fillText(`STAGE ${stage}/5`, VW - 74, VH - 15);

    // ready hint
    if (started && !over && balls.every(b => b.stuck)) {
      g.globalAlpha = 0.6 + Math.sin(performance.now() / 250) * 0.3;
      g.fillStyle = '#fff';
      g.font = 'bold 12px monospace';
      g.textAlign = 'center';
      g.fillText('화면을 눌러 발사!', VW / 2, VH - 100);
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
