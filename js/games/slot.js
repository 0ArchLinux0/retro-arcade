// ============================================================
// Game 23 — SLOT SPINNER (3-reel match-3)
// Tap to spin; match 3 icons horizontally to win.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.slot = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const ICONS = ['🍒', '⭐', '🔔', '💎', '7️⃣', '🍋'];
  const REEL_W = 80, REEL_H = 200;
  const REEL_GAP = 12;
  const REEL_Y = 160;
  const TOTAL_W = REEL_W * 3 + REEL_GAP * 2;
  const RX0 = (VW - TOTAL_W) / 2;

  const PAYOUT = {
    '7️⃣': 200,
    '💎': 80,
    '⭐': 30,
    '🔔': 18,
    '🍒': 12,
    '🍋': 8,
  };

  let reels, stopAt, spinning, results, score, started, over;
  let reelStopT, spinT, hudT, lastWin;

  function randIcon() { return ICONS[(Math.random() * ICONS.length) | 0]; }

  function reset() {
    reels = [
      { y: 0, vy: 0, stop: -1, displayed: randIcon() },
      { y: 0, vy: 0, stop: -1, displayed: randIcon() },
      { y: 0, vy: 0, stop: -1, displayed: randIcon() },
    ];
    stopAt = [0, 0, 0];
    spinning = [false, false, false];
    results = [null, null, null];
    score = 0;
    started = false; over = false;
    reelStopT = [0, 0, 0];
    spinT = 0; hudT = 0; lastWin = 0;
    RA.setScore(0);
  }

  function readInput() {
    const taps = input.consumeTaps();
    if (taps.length === 0) return;
    if (!started && !over) { started = true; spin(); return; }
    if (over) return;
    // stop the leftmost still-spinning reel
    for (let i = 0; i < 3; i++) {
      if (spinning[i]) { spinning[i] = false; return; }
    }
    // all stopped: spin again
    spin();
  }

  function spin() {
    // Each reel has its own stop target and the icon sequence to display
    // through.
    for (let i = 0; i < 3; i++) {
      spinning[i] = true;
      reelStopT[i] = 0.45 + i * 0.45;  // left reel stops first
      stopAt[i] = (Math.random() * 200) | 0;
      reels[i].y = 0;
      reels[i].vy = 0;
      results[i] = null;
    }
    spinT = 0;
  }

  function step(dt) {
    if (over) return;
    if (!started) return;
    spinT += dt; hudT += dt;
    for (let i = 0; i < 3; i++) {
      if (spinning[i]) {
        reelStopT[i] -= dt;
        if (reelStopT[i] <= 0) {
          spinning[i] = false;
          results[i] = ICONS[stopAt[i] % ICONS.length];
          reels[i].displayed = results[i];
          sfx.hit();
          if (i === 2) evaluatePayout();
        } else {
          // cycle through icons while spinning
          if (Math.random() < dt * 30) {
            reels[i].displayed = randIcon();
          }
        }
      }
    }
  }

  function evaluatePayout() {
    // 3 of a kind? 2 of a kind? Or just play on
    const [a, b, c] = results;
    if (a === b && b === c) {
      const win = PAYOUT[a] || 0;
      score += win;
      lastWin = win;
      burst(RX0 + REEL_W * 1.5 + REEL_GAP, REEL_Y + REEL_H / 2, 32, '#39ff14');
      floatText(VW / 2, REEL_Y + REEL_H + 40, 'JACKPOT! +' + win, '#39ff14');
      sfx.confirm();
      shake(4, 0.3);
    } else if (a === b || b === c || a === c) {
      const win = Math.floor((PAYOUT[a] || PAYOUT[b] || PAYOUT[c] || 5) / 3);
      score += win;
      lastWin = win;
      floatText(VW / 2, REEL_Y + REEL_H + 40, 'PAIR! +' + win, '#f9f002');
      sfx.hit();
    } else {
      lastWin = 0;
    }
    RA.setScore(score);
  }

  function drawImpl(ctx) {
  const g = ctx;
    g.fillStyle = '#0d0420';
    g.fillRect(0, 0, VW, VH);
    // frame
    g.fillStyle = '#222';
    g.fillRect(RX0 - 8, REEL_Y - 8, TOTAL_W + 16, REEL_H + 16);
    g.strokeStyle = '#f9f002';
    g.lineWidth = 2;
    g.strokeRect(RX0 - 8, REEL_Y - 8, TOTAL_W + 16, REEL_H + 16);
    // reels
    for (let i = 0; i < 3; i++) {
      const rx = RX0 + i * (REEL_W + REEL_GAP);
      g.fillStyle = '#000';
      g.fillRect(rx, REEL_Y, REEL_W, REEL_H);
      g.fillStyle = '#fff';
      g.font = 'bold 36px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(reels[i].displayed, rx + REEL_W / 2, REEL_Y + REEL_H / 2);
      g.textBaseline = 'alphabetic';
    }
    // payout table
    g.fillStyle = '#f9f002';
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    g.fillText('7️⃣×3 = 200  💎×3 = 80  ⭐×3 = 30  🔔×3 = 18  🍒×3 = 12  🍋×3 = 8', VW / 2, REEL_Y + REEL_H + 22);
    g.textAlign = 'left';
    if (!started && !over) {
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = 'bold 12px monospace';
      g.fillText('탭으로 스핀', VW / 2, VH / 2);
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
      get score() { return score; },
      get spinning() { return spinning.slice(); },
      get results() { return results.slice(); },
      get over() { return over; },
      get started() { return started; },
      get lastWin() { return lastWin; },
      spin() { spin(); },
    };
  }

  return { init, update, draw: draw, onStart, onPause, debug };
})();
