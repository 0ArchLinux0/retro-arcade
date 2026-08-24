// ============================================================
// Game 12 — PONG DUEL (classic pong vs AI, vertical court)
// Drag your paddle; first to 7 wins.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.pong = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const PW_ = 70, PH_ = 10, BR = 6;
  const PLAYER_Y = VH - 64;
  const AI_Y = 64;
  const WIN_SCORE = 7;

  let playerX, aiX, ball, pScore, aScore, started, over;
  let serveT, servingTo, aiSkill, rally, aiErr;

  function newBall(to) {
    ball = { x: VW / 2, y: to === 'p' ? AI_Y + 40 : PLAYER_Y - 40, vx: 0, vy: 0 };
    servingTo = to;
    serveT = 1.1;
    rally = 0;
    // AI picks a per-rally aim offset; large offsets exceed the paddle reach
    // and result in genuine misses (roughly proportional to (1 - skill))
    aiErr = (Math.random() - 0.5) * (120 + 160 * (1 - aiSkill));
  }

  function launch() {
    // aim mostly vertical with random horizontal bias; direction by receiver
    const sp = 300;
    const tilt = (Math.random() - 0.5) * 1.1;          // radians off vertical
    ball.vx = Math.sin(tilt) * sp;
    ball.vy = (servingTo === 'p' ? Math.abs(Math.cos(tilt)) : -Math.abs(Math.cos(tilt))) * sp;
    sfx.shoot();
  }

  function reset() {
    playerX = aiX = VW / 2;
    pScore = 0; aScore = 0;
    started = false; over = false;
    aiSkill = 0.5;
    newBall('a');
    RA.setScore(0);
  }

  function endRound(playerWon) {
    over = true;
    if (playerWon) { sfx.levelup(); floatText(VW / 2, VH / 2 - 40, 'YOU WIN!', '#7dff8a'); }
    else { sfx.gameover(); floatText(VW / 2, VH / 2 - 40, 'AI WINS', '#ff3355'); }
    shake(8, 0.5);
    RA.submitScore('pong', pScore * 100 + (playerWon ? 500 : 0));
    setTimeout(() => {
      RA.showOverlay({
        title: playerWon ? 'VICTORY!' : 'DEFEAT',
        sub: `${pScore} — ${aScore}   BEST ${RA.best('pong')}`,
        buttons: [
          { label: 'REMATCH', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 800);
  }

  function update(dt) {
    if (!started || over) return;

    // --- serve countdown ---
    if (serveT > 0) {
      serveT -= dt;
      if (serveT <= 0) launch();
    }

    // --- player paddle ---
    if (input.isDown) {
      playerX += (input.x - playerX) * Math.min(1, 16 * dt);
    } else if (input.keys['ArrowLeft'] || input.keys['ArrowRight']) {
      playerX += ((input.keys['ArrowRight'] ? 1 : 0) - (input.keys['ArrowLeft'] ? 1 : 0)) * 460 * dt;
    }
    playerX = Math.max(PW_ / 2, Math.min(VW - PW_ / 2, playerX));

    // --- AI paddle: tracks ball with capped speed + deliberate error ---
    const diff = Math.min(1, rally / 14);           // AI sharpens during long rallies
    const target = serveT > 0 ? VW / 2 : ball.x + aiErr + Math.sin(performance.now() / 400) * 26 * (1 - aiSkill * 0.5);
    const aiSpeed = (240 + aiSkill * 180 + diff * 60) * dt;
    aiX += Math.max(-aiSpeed, Math.min(aiSpeed, target - aiX));
    aiX = Math.max(PW_ / 2, Math.min(VW - PW_ / 2, aiX));

    // --- ball ---
    if (serveT <= 0 && !over) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // walls
      if (ball.x < BR + 4) { ball.x = BR + 4; ball.vx = Math.abs(ball.vx); sfx.select(); }
      if (ball.x > VW - BR - 4) { ball.x = VW - BR - 4; ball.vx = -Math.abs(ball.vx); sfx.select(); }

      // player paddle
      if (ball.vy > 0 && ball.y + BR >= PLAYER_Y - PH_ / 2 && ball.y - BR < PLAYER_Y + PH_ / 2 &&
          ball.x > playerX - PW_ / 2 - BR && ball.x < playerX + PW_ / 2 + BR) {
        const rel = (ball.x - playerX) / (PW_ / 2);
        const sp = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.05);
        ball.vx = rel * sp * 0.75;
        ball.vy = -Math.sqrt(Math.max(sp * sp - ball.vx * ball.vx, (sp * 0.4) ** 2));
        ball.y = PLAYER_Y - PH_ / 2 - BR;
        rally++;
        sfx.eat();
        burst(ball.x, ball.y, { n: 4, colors: ['#00eaff'], speed: 60, size: 3 });
      }

      // AI paddle
      if (ball.vy < 0 && ball.y - BR <= AI_Y + PH_ / 2 && ball.y + BR > AI_Y - PH_ / 2 &&
          ball.x > aiX - PW_ / 2 - BR && ball.x < aiX + PW_ / 2 + BR) {
        const rel = (ball.x - aiX) / (PW_ / 2);
        const sp = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.05);
        ball.vx = rel * sp * 0.7;
        ball.vy = Math.sqrt(Math.max(sp * sp - ball.vx * ball.vx, (sp * 0.4) ** 2));
        ball.y = AI_Y + PH_ / 2 + BR;
        rally++;
        sfx.laser();
      }

      // goals
      if (ball.y > VH + BR * 2) {
        aScore++;
        sfx.hit();
        shake(6, 0.3);
        burst(ball.x, VH - 20, { n: 12, colors: ['#ff3355'], speed: 140 });
        checkWin();
        if (!over) newBall('p');
      } else if (ball.y < -BR * 2) {
        pScore++;
        sfx.coin();
        burst(ball.x, 20, { n: 12, colors: ['#7dff8a'], speed: 140 });
        floatText(VW / 2, VH / 2, 'SCORE!', '#ffe066');
        checkWin();
        if (!over) newBall('a');
      }
    }
    RA.setScore(pScore * 100);
  }

  function checkWin() {
    if (pScore >= WIN_SCORE || aScore >= WIN_SCORE) endRound(pScore >= WIN_SCORE);
  }

  function init() {
    RA.setHUD('PONG DUEL', 'pong');
    reset();
    RA.showOverlay({
      title: 'PONG DUEL',
      sub: 'DRAG YOUR PADDLE',
      lines: ['드래그로 패들 조작 — 7점 선승제!', '긴 랠리일수록 공과 AI가 빨라집니다'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    RA.audio.playBGM('flappy');
  }

  function draw(g) {
    g.fillStyle = '#03030e';
    g.fillRect(0, 0, VW, VH);

    // center dashed line
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 3;
    g.setLineDash([10, 12]);
    g.beginPath();
    g.moveTo(VW / 2, 90);
    g.lineTo(VW / 2, VH - 90);
    g.stroke();
    g.setLineDash([]);

    // scores big in background
    g.globalAlpha = 0.16;
    g.fillStyle = '#fff';
    g.font = 'bold 64px monospace';
    g.textAlign = 'center';
    g.fillText(String(aScore), VW / 2 - 60, 190);
    g.fillText(String(pScore), VW / 2 + 60, VH - 130);
    g.textAlign = 'left';
    g.globalAlpha = 1;

    // paddles
    g.fillStyle = '#ff66d9';
    g.fillRect(aiX - PW_ / 2, AI_Y - PH_ / 2, PW_, PH_);
    g.fillStyle = '#00eaff';
    g.fillRect(playerX - PW_ / 2, PLAYER_Y - PH_ / 2, PW_, PH_);

    // ball
    if (serveT > 0 && !over) {
      // blink before serve
      if (Math.floor(performance.now() / 160) % 2 === 0 || serveT < 0.35) {
        g.fillStyle = '#fff';
        g.fillRect(ball.x - BR, ball.y - BR, BR * 2, BR * 2);
      }
      g.globalAlpha = 0.7;
      g.font = 'bold 11px monospace';
      g.textAlign = 'center';
      g.fillText('READY…', VW / 2, VH / 2);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    } else {
      // trail
      g.globalAlpha = 0.22;
      g.fillStyle = '#fff';
      g.fillRect(ball.x - ball.vx * 0.02 - BR, ball.y - ball.vy * 0.02 - BR, BR * 2, BR * 2);
      g.globalAlpha = 1;
      g.fillStyle = '#fff';
      g.fillRect(ball.x - BR, ball.y - BR, BR * 2, BR * 2);
    }

    // labels
    g.fillStyle = '#776ba8';
    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    g.fillText(`FIRST TO ${WIN_SCORE}`, VW / 2, VH - 24);
    g.textAlign = 'left';
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

  return { init, update, draw, onStart, onPause, debug: () => ({ pScore, aScore, over, started, ballX: Math.round(ball ? ball.x : VW / 2), ballY: Math.round(ball ? ball.y : 0), vy: ball ? Math.round(ball.vy) : 0, serving: serveT > 0 }) };
})();
