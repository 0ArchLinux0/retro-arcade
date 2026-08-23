// ============================================================
// Retro Arcade — shared engine (canvas, input, particles, UI)
// ============================================================
'use strict';

const RA = (() => {

  // ---------- Canvas ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Virtual resolution: all games draw on a 360x640 stage.
  const VW = 360, VH = 640;
  let scale = 1, offX = 0, offY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    const cssW = Math.floor(VW * scale), cssH = Math.floor(VH * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    offX = canvas.offsetLeft; offY = canvas.offsetTop;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);

  function toVirtual(clientX, clientY) {
    return { x: (clientX - offX) / scale, y: (clientY - offY) / scale };
  }

  // ---------- Input ----------
  const input = {
    x: VW / 2, y: VH / 2,
    isDown: false,
    justPressed: false,
    taps: [],           // [{x,y}] recent taps this frame
    keys: {},           // keyboard fallback for desktop
    consumeTaps() { const t = this.taps.slice(); this.taps.length = 0; return t; }
  };

  function pointerPos(e) {
    const src = e.changedTouches ? e.changedTouches[0] : e;
    return toVirtual(src.clientX, src.clientY);
  }

  function onDown(e) {
    e.preventDefault();
    const p = pointerPos(e);
    input.x = p.x; input.y = p.y;
    input.isDown = true;
    input.justPressed = true;
    input.taps.push(p);
    RA.audio.unlock();
  }
  function onMove(e) {
    const p = pointerPos(e);
    input.x = p.x; input.y = p.y;
  }
  function onUp() {
    input.isDown = false;
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('mouseup', onUp, { passive: true });
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp, { passive: false });
  canvas.addEventListener('touchcancel', onUp, { passive: false });

  window.addEventListener('keydown', e => {
    if (!input.keys[e.code]) input.taps.push({ x: input.x, y: input.y, key: e.code });
    input.keys[e.code] = true;
    input.justPressed = true;
    RA.audio.unlock();
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { input.keys[e.code] = false; });

  // ---------- Particles ----------
  const particles = [];
  function burst(x, y, opts = {}) {
    const n = opts.n ?? 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 120) * (0.3 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
        life: 1, decay: opts.decay ?? (1.8 + Math.random()),
        size: opts.size ?? 4,
        color: opts.colors ? opts.colors[(Math.random() * opts.colors.length) | 0] : '#fff',
        grav: opts.grav ?? 260,
        square: opts.square !== false
      });
    }
  }
  function floatText(x, y, text, color = '#ffe066') {
    particles.push({ x, y, vx: 0, vy: -46, life: 1, decay: 1.4, size: 10, color, text });
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.text) { p.vy *= (1 - 2 * dt); continue; }
      p.vy += p.grav * dt;
      p.vx *= (1 - 1.2 * dt);
    }
  }
  function drawParticles(g) {
    for (const p of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      g.fillStyle = p.color;
      if (p.text) {
        g.font = `bold ${p.size}px monospace`;
        g.textAlign = 'center';
        g.fillText(p.text, p.x, p.y);
        g.textAlign = 'left';
      } else if (p.square) {
        g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        g.beginPath(); g.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  function clearParticles() { particles.length = 0; }

  // ---------- Screen shake ----------
  let shakeT = 0, shakeMag = 0;
  function shake(mag = 5, time = 0.25) { shakeMag = mag; shakeT = time; }
  function applyShake(dt) {
    shakeT -= dt;
    if (shakeT > 0) {
      ctx.save();
      ctx.translate((Math.random() - .5) * shakeMag, (Math.random() - .5) * shakeMag);
      return true;
    }
    return false;
  }
  function endShake(shaking) { if (shaking) ctx.restore(); }

  // ---------- Game loop / state ----------
  let game = null;
  let rafId = null;
  let lastT = 0;

  function start(mod) {
    stop();
    game = mod;
    clearParticles();
    showGameUI(true);
    try { mod.init && mod.init(); } catch (err) { console.error(err); }
    lastT = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    game = null;
    ctx.clearRect(0, 0, VW, VH);
  }

  function loop(t) {
    if (!game) return;
    let dt = (t - lastT) / 1000;
    lastT = t;
    dt = Math.min(dt, 0.05);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VW, VH);
    const shaking = applyShake(dt);
    try {
      game.update(dt);
      game.draw(ctx);
    } catch (err) {
      console.error(err);
    }
    updateParticles(dt);
    drawParticles(ctx);
    endShake(shaking);

    rafId = requestAnimationFrame(loop);
  }

  // ---------- High scores ----------
  const KEY = 'ra_scores_v1';
  function getScores() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function best(id) {
    const s = getScores();
    return s[id] ? s[id].best : 0;
  }
  function submitScore(id, score) {
    const s = getScores();
    if (!(id in s) || score > s[id].best) s[id] = { best: score };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }

  // ---------- HUD / overlay ----------
  const hud = document.getElementById('hud');
  const hudTitle = document.getElementById('hud-title');
  const hudScore = document.getElementById('hud-score');
  const hudBest = document.getElementById('hud-best');
  const overlay = document.getElementById('overlay');
  let overlayOpen = false;
  let tapHandler = null;

  function fmt(n) { return String(Math.floor(n)).padStart(6, '0'); }

  function setHUD(title, id) {
    hudTitle.textContent = title;
    hudScore.textContent = fmt(0);
    hudBest.textContent = 'BEST ' + fmt(best(id));
    hud.dataset.id = id;
  }
  function setScore(score) { hudScore.textContent = fmt(score); }
  function refreshBest() {
    const id = hud.dataset.id;
    if (id) hudBest.textContent = 'BEST ' + fmt(best(id));
  }

  function showGameUI(show) {
    document.getElementById('screen-game').classList.toggle('active', show);
    document.getElementById('screen-lobby').classList.toggle('active', !show);
  }

  document.getElementById('btn-pause').addEventListener('click', () => {
    if (game && game.onPause) game.onPause();
  });
  document.getElementById('btn-exit').addEventListener('click', () => {
    RA.audio.stopBGM();
    stop();
    hideOverlay();
    showGameUI(false);
    refreshLobby();
  });

  function showOverlay(opts) {
    overlayOpen = true;
    overlay.innerHTML = '';
    const t = document.createElement('div');
    t.className = 'ov-title';
    t.textContent = opts.title || '';
    overlay.appendChild(t);
    if (opts.sub) {
      const s = document.createElement('div');
      s.className = 'ov-sub';
      s.textContent = opts.sub;
      overlay.appendChild(s);
    }
    if (opts.lines) {
      for (const ln of opts.lines) {
        const d = document.createElement('div');
        d.className = 'ov-line';
        d.textContent = ln;
        overlay.appendChild(d);
      }
    }
    const btns = opts.buttons || [];
    for (const b of btns) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label;
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        hideOverlay();
        b.onClick && b.onClick();
      });
      overlay.appendChild(el);
    }
    if (opts.tapStart) {
      tapHandler = () => { hideOverlay(); game && game.onStart && game.onStart(); };
      overlay.addEventListener('pointerdown', tapHandler);
    }
    overlay.classList.add('show');
  }
  function hideOverlay() {
    overlayOpen = false;
    overlay.classList.remove('show');
    overlay.innerHTML = '';
    if (tapHandler) {
      overlay.removeEventListener('pointerdown', tapHandler);
      tapHandler = null;
    }
  }
  function isOverlayOpen() { return overlayOpen; }

  return {
    canvas, ctx, VW, VH, resize, input,
    start, stop,
    burst, floatText, clearParticles, shake,
    best, submitScore, refreshBest,
    setHUD, setScore, refreshLobbyRef: null,
    showOverlay, hideOverlay, isOverlayOpen, fmt
  };

})();
