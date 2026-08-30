// ============================================================
// Game 19 — MEMORY MATCH (card pairs: find all matches fast)
// Tap to flip; match pairs before moves run out.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.memory = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;

  const ICONS = ['◆', '★', '●', '▲', '■', '✚'];
  const COLS = 4, ROWS = 3;
  const START_MOVES = 24;

  let cards, flipped, matched, moves, score, over, started;
  let lockTimer;

  function reset() {
    const deck = [];
    for (let i = 0; i < (COLS * ROWS) / 2; i++) { deck.push(i); deck.push(i); }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    cards = deck.map((v, idx) => ({
      v,
      x: 26 + (idx % COLS) * ((VW - 52) / COLS),
      y: 120 + Math.floor(idx / COLS) * ((VH - 220) / ROWS),
      w: (VW - 52) / COLS - 10,
      h: (VH - 220) / ROWS - 12,
      up: false, done: false, flip: 0
    }));
    flipped = []; matched = 0;
    moves = START_MOVES;
    score = 0; over = false; started = false; lockTimer = 0;
  }

  function win() {
    over = true;
    sfx.powerup();
    shake(5, 0.25);
    for (const c of cards) burst(c.x + c.w / 2, c.y + c.h / 2, { n: 6, colors: ['#ffe066', '#7dff8a'], speed: 90 });
    RA.submitScore('memory', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'CLEARED!',
        sub: `SCORE ${score}   BEST ${RA.best('memory')}`,
        lines: [`남은 이동 ${moves}`],
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 600);
  }

  function lose() {
    over = true;
    sfx.die();
    RA.submitScore('memory', score);
    setTimeout(() => {
      RA.showOverlay({
        title: 'OUT OF MOVES',
        sub: `SCORE ${score}   BEST ${RA.best('memory')}`,
        lines: [`짝 ${matched}/${(COLS * ROWS) / 2}`],
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { reset(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 550);
  }

  function update(dt) {
    if (!started || over) return;

    if (lockTimer > 0) {
      lockTimer -= dt;
      if (lockTimer <= 0) {
        // resolve pair
        const [a, b] = flipped;
        if (a && b && a.v === b.v) {
          a.done = b.done = true;
          matched++;
          score += 100 + moves * 4;
          sfx.coin();
          floatText(a.x + a.w / 2, a.y, 'MATCH!');
          flipped = [];
          if (matched === (COLS * ROWS) / 2) { win(); return; }
        } else {
          if (a) a.up = false;
          if (b) b.up = false;
          flipped = [];
        }
      }
    }

    for (const t of input.consumeTaps()) {
      if (lockTimer > 0 || flipped.length >= 2) break;
      for (const c of cards) {
        if (c.done || c.up) continue;
        if (t.x > c.x && t.x < c.x + c.w && t.y > c.y && t.y < c.y + c.h) {
          c.up = true;
          flipped.push(c);
          sfx.jump();
          if (flipped.length === 2) {
            moves--;
            lockTimer = 0.65;
            if (moves <= 0 && flipped[0].v !== flipped[1].v) { /* resolve then lose */ }
            if (moves <= 0) setTimeout(() => {}, 0);
          }
          break;
        }
      }
      RA.setScore(score);
      if (moves <= 0 && lockTimer <= 0 && flipped.length < 2) { lose(); return; }
    }
  }

  function init() {
    RA.setHUD('MEMORY MATCH', 'memory');
    reset();
    RA.showOverlay({
      title: 'MEMORY MATCH',
      sub: 'FIND THE PAIRS',
      lines: ['같은 그림 두 장을 찾아 매치!', '이동 수 안에 전부 찾으면 클리어'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }
  function onStart() {
    started = true;
    RA.audio.playBGM('memory');
  }

  function draw(g) {
    g.fillStyle = '#140a2e';
    g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#9d8fd1';
    g.font = '11px "Press Start 2P", monospace';
    g.fillText(`MOVES ${Math.max(0, moves)}   PAIRS ${matched}/${(COLS * ROWS) / 2}`, 16, 60);

    for (const c of cards) {
      if (c.done) {
        g.fillStyle = 'rgba(125,255,138,.14)';
      } else if (c.up) {
        g.fillStyle = '#2c2160';
      } else {
        g.fillStyle = '#191243';
      }
      g.strokeStyle = c.done ? '#7dff8a' : '#5a4bbf';
      g.lineWidth = 2;
      g.fillRect(c.x, c.y, c.w, c.h);
      g.strokeRect(c.x, c.y, c.w, c.h);
      if (c.up || c.done) {
        g.fillStyle = c.done ? '#7dff8a' : '#ffe066';
        g.font = `${Math.floor(c.h * 0.42)}px monospace`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(ICONS[c.v], c.x + c.w / 2, c.y + c.h / 2);
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      } else {
        g.fillStyle = '#39307a';
        g.font = '13px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', c.x + c.w / 2, c.y + c.h / 2);
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }
    }
  }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
  }

  function debug() {
    return {
      get cards() { return cards; },
      get matched() { return matched; },
      get moves() { return moves; },
      get score() { return score; },
      get started() { return started; },
      get dead() { return over; },
      get over() { return over; },
      revealAll() { for (const c of cards) c.up = true; }
    };
  }

  return { init, update, draw, onStart, onPause, debug };
})();
