// ============================================================
// Game 25 — BOUNCE BALL (single-paddle brick breaker)
// Drag the paddle; ball bounces and breaks bricks. Lose if the
// ball falls past the paddle.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.bounce = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const PADDLE_W = 70, PADDLE_H = 8;
  const PADDLE_Y = VH - 80;
  const BALL_R = 5;
  const BALL_V = 260;

  let paddle, balls, bricks, score, started, over;
  let combo, level, multiChance;

  function buildBricks() {
    const rows = 5, cols = 8;
    const bw = (VW - 24) / cols;
    const bh = 16;
    const by0 = 90;
    const colors = ['#ff3355', '#ff8844', '#f9f002', '#7dff8a', '#00eaff'];
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ x: 12 + c * bw, y: by0 + r * (bh + 4), w: bw - 4, h: bh, color: colors[r], alive: true, hp: 1 + (r === 0 ? 1 : 0) });
      }
    }
    return out;
  }

  function reset() {
    paddle = { x: VW / 2 - PADDLE_W / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
    balls = [{ x: VW / 2, y: PADDLE_Y - BALL_R - 1, vx: 1, vy: -1, stuck: true }];
    bricks = buildBricks();
    score = 0;
    started = false; over = false;
    combo = 0; level = 1; multiChance = 0;
    RA.setScore(0);
  }

  function readInput() {
    const taps = input.consumeTaps();
    if (!started && !over && taps.length > 0) { started = true; }
    if (over) return;
    // paddle follows finger
    paddle.x = Math.max(0, Math.min(VW - PADDLE_W, input.x - PADDLE_W / 2));
    // launch stuck balls
    for (const b of balls) {
      if (b.stuck) {
        b.x = paddle.x + PADDLE_W / 2;
        b.y = PADDLE_Y - BALL_R - 1;
        if (taps.length > 0) {
          b.stuck = false;
          // random angle upward
          const a = -Math.PI / 4 - Math.random() * Math.PI / 2;
          b.vx = Math.cos(a); b.vy = Math.sin(a);
        }
      }
    }
  }

  function step(dt) {
    if (over || !started) return;
    for (const b of balls) {
      if (b.stuck) continue;
      b.x += b.vx * BALL_V * dt;
      b.y += b.vy * BALL_V * dt;
      // walls
      if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
      if (b.x > VW - BALL_R) { b.x = VW - BALL_R; b.vx = -Math.abs(b.vx); }
      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
      // fall
      if (b.y > VH + 20) {
        b.stuck = true;
        b.x = paddle.x + PADDLE_W / 2;
        b.y = PADDLE_Y - BALL_R - 1;
        b.vx = 1; b.vy = -1;
        // remove the ball if multiple? simpler: keep it and end if all gone
      }
      // paddle
      if (b.y + BALL_R >= paddle.y && b.y - BALL_R <= paddle.y + PADDLE_H &&
          b.x >= paddle.x && b.x <= paddle.x + PADDLE_W && b.vy > 0) {
        b.y = paddle.y - BALL_R;
        // angle based on hit position
        const rel = (b.x - (paddle.x + PADDLE_W / 2)) / (PADDLE_W / 2);
        const a = -Math.PI / 2 + rel * (Math.PI / 3);
        b.vx = Math.cos(a); b.vy = Math.sin(a);
        sfx.tick();
      }
      // bricks
      for (const br of bricks) {
        if (!br.alive) continue;
        if (b.x + BALL_R > br.x && b.x - BALL_R < br.x + br.w &&
            b.y + BALL_R > br.y && b.y - BALL_R < br.y + br.h) {
          br.hp--;
          if (br.hp <= 0) {
            br.alive = false;
            score += 10;
            burst(br.x + br.w / 2, br.y + br.h / 2, 8, br.color);
          } else {
            br.color = '#fff';
            score += 3;
            burst(b.x, b.y, 4, br.color);
          }
          // reflect
          const fromLeft = b.x < br.x;
          const fromTop = b.y < br.y;
          if (fromLeft || (b.x - br.x < br.w - (b.y - br.y))) b.vx = -b.vx;
          else b.vy = -b.vy;
          sfx.hit();
          break;
        }
      }
    }
    // level cleared?
    if (bricks.every(b => !b.alive)) {
      level++;
      bricks = buildBricks();
      // re-stick balls
      for (const b of balls) { b.stuck = true; b.x = paddle.x + PADDLE_W / 2; b.y = PADDLE_Y - BALL_R - 1; }
    }
    RA.setScore(score);
  }

  function drawImpl(ctx) {
  const g = ctx;
    g.fillStyle = '#0a0420';
    g.fillRect(0, 0, VW, VH);
    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      g.fillStyle = b.color;
      g.fillRect(b.x, b.y, b.w, b.h);
    }
    // paddle
    g.fillStyle = '#00eaff';
    g.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    // balls
    g.fillStyle = '#fff';
    for (const b of balls) {
      g.beginPath();
      g.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      g.fill();
    }
    // HUD
    g.fillStyle = '#fff';
    g.font = 'bold 12px monospace';
    g.textAlign = 'left';
    g.fillText('LEVEL ' + level, 12, 18);
    g.textAlign = 'right';
    g.fillText('SCORE ' + score, VW - 12, 18);
    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('드래그로 패들 · 탭으로 발사', VW / 2, VH / 2);
    }
  }

  function init() { reset(); }
  function update(dt) { readInput(); step(dt); }
  function draw(ctx) { drawImpl(ctx); }
  function onStart() { RA.audio.playBGM('flappy'); RA.hideOverlay(); }
  function onPause() {
    RA.showOverlay({ title: 'PAUSED', tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }] });
    RA.audio.stopBGM();
    const h = setInterval(() => { if (!RA.isOverlayOpen()) { clearInterval(h); if (!over) RA.audio.playBGM('flappy'); } }, 250);
  }

  function debug() {
    return {
      get paddle() { return paddle; },
      get balls() { return balls; },
      get bricks() { return bricks; },
      get score() { return score; },
      get level() { return level; },
      get over() { return over; },
      get started() { return started; },
      get alive() { return bricks.filter(b => b.alive).length; },
      setPaddle(x) { paddle.x = Math.max(0, Math.min(VW - PADDLE_W, x)); },
    };
  }

  return { init, update, draw: draw, onStart, onPause, debug };
})();
