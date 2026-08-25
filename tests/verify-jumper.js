// Headless regression: SKY HOPPER camera must keep the player on-screen.
// Reproduces the v1.5 bug where player screen-Y drifted upward 2x per frame
// (player pinned to CAM_Y *and* camY moved the wrong way), plus the latent
// world-coords fall-death that never fired once the camera had risen.
// Driver steers toward the nearest platform below, mimicking a human thumb.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mkEl(tag) {
  const el = {
    tagName: tag || 'DIV', children: [], dataset: {}, style: {},
    _classes: new Set(),
    classList: {
      add: (...cs) => cs.forEach(c => el._classes.add(c)),
      remove: (...cs) => cs.forEach(c => el._classes.delete(c)),
      toggle: (c, f) => { const on = f === undefined ? !el._classes.has(c) : !!f; on ? el._classes.add(c) : el._classes.delete(c); return on; },
      contains: c => el._classes.has(c)
    },
    textContent: '', innerHTML: '',
    appendChild(ch) { el.children.push(ch); return ch; },
    append(...ch) { el.children.push(...ch); return el; },
    addEventListener() {}, removeEventListener() {},
    getContext: () => ctxStub, offsetLeft: 0, offsetTop: 0
  };
  el.style.setProperty = () => {};
  return el;
}
const ctxProxyTarget = function () {};
const ctxStub = new Proxy(ctxProxyTarget, {
  get(t, p) { if (p === Symbol.toPrimitive) return () => 0; if (p === 'canvas') return { width: 720, height: 1280 }; return ctxStub; },
  apply() { return ctxStub; }, set() { return true; }
});
const elements = {};
['game', 'hud', 'hud-title', 'hud-score', 'hud-best', 'btn-pause', 'btn-exit',
 'overlay', 'screen-game', 'screen-lobby', 'game-grid', 'coin-count',
 'mission-list', 'shop-grid', 'ach-list', 'boost-list', 'records-grid']
  .forEach(id => elements[id] = mkEl('div'));
elements['game'] = mkEl('canvas');
global.document = { getElementById: id => elements[id] || (elements[id] = mkEl('div')), createElement: mkEl, addEventListener() {}, documentElement: { style: { setProperty() {} } } };
global.window = global;
global.addEventListener = () => {}; global.removeEventListener = () => {}; global.dispatchEvent = () => true;
global.innerWidth = 390; global.innerHeight = 844; global.devicePixelRatio = 2;
global.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
global.cancelAnimationFrame = id => clearTimeout(id);
const storeMap = new Map();
global.localStorage = { getItem: k => storeMap.get(k) ?? null, setItem: (k, v) => storeMap.set(k, String(v)) };
class FakeParam { constructor(){this.value=0;} setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} cancelScheduledValues(){} }
class FakeNode { constructor(a){this.gain=new FakeParam();this.frequency=new FakeParam();this.Q=new FakeParam();this.type='';this.buffer=null;} connect(){return this;} disconnect(){} start(){} stop(){} }
class FakeAC { constructor(){this.sampleRate=44100;this.state='running';this.destination=new FakeNode(this);this._t0=Date.now();}
  get currentTime(){return (Date.now()-this._t0)/1000;} resume(){return Promise.resolve();}
  createGain(){return new FakeNode(this);} createOscillator(){return new FakeNode(this);}
  createBufferSource(){return new FakeNode(this);} createBiquadFilter(){return new FakeNode(this);}
  createBuffer(c,l){return {getChannelData:()=>new Float32Array(l)};} }
global.AudioContext = FakeAC;

const root = path.join(__dirname, '..');
for (const rel of ['js/core.js', 'js/audio.js', 'js/games/jumper.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, rel), 'utf8'), { filename: rel });
}

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  PASS ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

console.log('[skyhopper camera]');

{
  const g = RA.games.jumper;
  g.init();
  RA.hideOverlay();
  g.onStart();

  const d = g.debug();
  const VW = RA.VW, VH = RA.VH, dt = 1 / 60;

  // human-like driver: aim the drag pointer at the closest platform below,
  // with a small reaction delay (re-target every 6 frames) so it's not perfect
  let target = VW / 2;
  function steer() {
    if (f % 6 === 0) {
      const pl = d.player;
      let best = null;
      for (const p of d.plats) {
        const below = p.y >= pl.y + pl.h - 4;
        const onScreen = p.y + d.camY > -40 && p.y + d.camY < VH + 40;
        if (below && onScreen && (!best || p.y < best.y)) best = p;
      }
      target = best ? best.x + best.w / 2 : VW / 2;
    }
    RA.input.isDown = true;
    RA.input.x = target;
  }

  let ended = false, f = 0, sampled = 0, minScreenY = Infinity, maxScreenY = -Infinity;
  let deathScreenY = null;
  for (; f < 60 * 30 && !ended; f++) {
    steer();
    g.update(dt);
    const syNow = d.player.y + d.camY;
    if (d.dead) { ended = true; deathScreenY = syNow; break; }
    if (f % 15 === 0) {
      sampled++;
      minScreenY = Math.min(minScreenY, syNow);
      maxScreenY = Math.max(maxScreenY, syNow);
    }
  }

  check(sampled > 20 || deathScreenY !== null,
    `run simulated (${sampled} samples, ${(f / 60).toFixed(1)}s)`);
  check(minScreenY > -80,
    `player never drifted above view (minScreenY=${Math.floor(minScreenY)})`);
  if (deathScreenY === null) {
    check(maxScreenY < VH + 80,
      `player never sank below view while alive (maxScreenY=${Math.floor(maxScreenY)})`);
  } else {
    check(deathScreenY > VH,
      `fall-death fired off-screen-bottom as intended (screenY=${Math.floor(deathScreenY)})`);
  }
  // screenY = worldY + camY here, so camY grows POSITIVE as we climb
  check(d.camY > 0, `camera rose during climb (camY=${Math.floor(d.camY)})`);
  check(d.height > 300,
    `run climbs meaningfully (height=${Math.floor(d.height)}m, dead=${d.dead})`);
}

console.log(failures === 0 ? '\nSKY HOPPER CAMERA PASS' : '\nFAILURES');
process.exit(failures ? 1 : 0);
