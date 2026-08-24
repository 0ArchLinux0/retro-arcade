// ============================================================
// Game 10 — STACK UP (Stack-style tower builder)
// Sliding block, tap to drop. Perfect stacks regain width.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.stackup = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const BLOCK_H = 26;
  const BASE_W = 180;
  const SLIDE_SPEED_BASE = 170;

  let stack, cur, dir, score, best_, started, over;
  let camOffset, flashT, hueIdx;
  let lastTapGuard;

  const HUES = ['#00eaff', '#7dff8a', '#ffe066', '#ff8844', '#ff66d9', '#b967ff', '#4d79ff'];

  function topColor(i) { return HUES[i % HUES.length]; }

  function reset() {
    stack = [];
    stack.push({ x: (VW - BASE_W) / 2, w: BASE_W, color: HUES[0], y: VH - 120 });
    cur = null; dir = 1;
    score = 0; started = false; over = false;
    camOffset = 0; flashT = 0; hueIdx = 1;
    spawnBlock();
  }

  function curWidth() { return stack[stack.length - 1].w; }
  function curCenter() { return stack[stack.length - 1].x + curWidth() / 2; }

  function spawnBlock() {
    const w = curWidth();
    const speed = SLIDE_SPEED_BASE + Math.min(150, score * 5);
    cur = {
      x: dir === 1 ? -w : VW,
      y: VH - 120 - stack.length * BLOCK_H,
      w,
      color: topColor(hueIdx++),
      speed
    };
    // alternate direction each layer relative to previous center
    dir *= -1;
    void curCenter;
  }

  function dropBlock() {
    if (!cur || over) return;
    const top = stack[stack.length - 1];
    const overlapL = Math.max(cur.x, top.x);
    const overlapR = Math.min(cur.x + cur.w, top.x + top.w);
    const overlap = overlapR - overlapL;

    if (overlap <= 2) { // total miss
      sfx.explode();
      shake(6, 0.3);
      burst(cur.x + cur.w / 2, cur.y + BLOCK_H / 2, { n: 18, colors: [cur.color, '#fff'], speed: 160 });
      die();
      return;
    }

    const perfect = Math.abs(cur.x - top.x) < 4 && Math.abs((cur.x + cur.w) - (top.x + top.w)) < 4;
    if (perfect) {
      // keep same width, combo bonus
      score += 2;
      flashT = 0.25;
      sfx.levelup();
      floatText(VW / 2, cur.y, 'PERFECT! +2', '#7dff8a');
      burst(VW / 2, cur.y + BLOCK_H / 2, { n: 12, colors: ['#fff', '#7dff8a'], speed: 110 });
      // regrow width slightly up to base as a reward every 3 perfects
      if (score % 6 === 0 && top.w < BASE_W) {
        const grow = Math.min(14, BASE_W - top.w);
        stack[stack.length - 1] = { ...top, x: top.x - grow / 2, w: top.w + grow };
      }
      stack.push({ x: stack[stack.length - 1].x, w: stack[stack.length - 1].w, color: cur.color, y: cur.y });
    } else {
      score += 1;
      const trimmed = { x: overlapL, w: overlap, color: cur.color, y: cur.y };
      // falling scrap piece
      const scrapX = cur.x < top.x ? cur.x : overlapR;
      const scrapW = cur.w - overlap;
      stack.push(trimmed);
      sfx.eat();
      floatText(overlapL + overlap / 2, cur.y, '+1', '#ffe066');
      burst(scrapX + scrapW / 2, cur.y + BLOCK_H / 2, { n: 8, colors: [cur.color], speed: 90, size: 4 });
    }
    RA.setScore(score);
    cur = null;
    // camera eases up handled in update via camOffset target
    setTimeout(() => { if (!over) spawnBlock(); }, 90);
  }

  function die() {
    over = true;
    RA.submitScore('stackup', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'GAME OVER',
        sub: `HEIGHT ${score}   BEST ${RA.best('stackup')}`,
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function update(dt) {
    if (flashT > 0) flashT -= dt;

    if (!started) return;

    if (input.justPressed) { dropBlock(); input.justPressed = false; }
    else {
      const taps = input.consumeTaps();
      if (taps.length > 0) dropBlock();
      if (input.keys['Space']) { dropBlock(); input.keys['Space'] = false; }
    }

    // slide current block
    if (cur) {
      cur.x += dir * cur.speed * dt;
      const margin = 30;
      if (dir === 1 && cur.x + cur.w > VW + margin) { dir = -1; cur.x = VW + margin - cur.w; }
      if (dir === -1 && cur.x < -margin) { dir = 1; cur.x = -margin; }
    }

    // camera: keep the tower top around 45% height — ease offset
    const targetTopY = VH - 120 - stack.length * BLOCK_H;
    const desired = Math.max(0, VH * 0.42 - targetTopY);
    camOffset += (desired - camOffset) * Math.min(1, 4 * dt);
  }

  function init() {
    RA.setHUD('STACK UP', 'stackup');
    reset();
    RA.showOverlay({
      title: 'STACK UP',
      sub: 'TAP TO DROP',
      lines: ['흔들리는 블록을 탭으로 적재!', '완벽하게 쌓으면 PERFECT +2 보너스'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    RA.audio.playBGM('stackup');
  }

  function draw(g) {
    g.fillStyle = '#0a0620';
    g.fillRect(0, 0, VW, VH);

    g.save();
    g.translate(0, camOffset);

    const baseIndex = Math.max(0, Math.floor(camOffset / BLOCK_H) - 2);
    // draw tower from bottom-most visible to top
    for (let i = baseIndex; i < stack.length; i++) {
      const b = stack[i];
      if (b.y + camOffset < -BLOCK_H * 2) continue;
      drawBlock(g, b.x, b.y, b.w, b.color, i === stack.length - 1 ? 1 : 0.85);
    }

    if (cur) {
      const wob = flashT > 0 ? '#ffffff' : cur.color;
      drawBlock(g, cur.x, cur.y, cur.w, wob, 1);
      // guide line under the moving block
      g.globalAlpha = 0.18;
      g.fillStyle = '#fff';
      g.fillRect(cur.x, cur.y + BLOCK_H, cur.w, 2);
      g.globalAlpha = 1;
    }
    g.restore();

    // height meter on right
    g.fillStyle = '#9df';
    g.font = 'bold 9px monospace';
    g.fillText('HEIGHT', VW - 62, VH - 60);
    g.fillStyle = '#fff';
    g.font = 'bold 15px monospace';
    g.fillText(String(score), VW - 62, VH - 42);

    if (!started && !over) {
      g.globalAlpha = 0.55 + Math.sin(performance.now() / 260) * 0.3;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 13px monospace';
      g.fillText('탭하여 시작!', VW / 2, VH * 0.36);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }
  }

  function drawBlock(g, x, y, w, color, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(x, y, w, BLOCK_H - 2);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(x, y, w, 4);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(x, y + BLOCK_H - 6, w, 4);
    g.globalAlpha = 1;
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
