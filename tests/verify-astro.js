// Targeted gameplay verify for ASTRO DODGE.
// Verifies: load, init, onStart, autopilot gameplay, debug() state.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mkEl(tag) {
  const el = { tagName: tag || 'DIV', children: [], dataset: {}, style: {},
    _classes: new Set(),
    classList: { add: (...cs) => cs.forEach(c => el._classes.add(c)),
      remove: (...cs) => cs.forEach(c => el._classes.delete(c)),
      toggle: (c, f) => { const on = f === undefined ? !el._classes.has(c) : !!f; on ? el._classes.add(c) : el._classes.delete(c); return on; },
      contains: c => el._classes.has(c) },
    textContent: '', innerHTML: '',
    appendChild(ch) { el.children.push(ch); return ch; },
    append(...ch) { el.children.push(...ch); return ch; },
    addEventListener() {}, removeEventListener() {},
    getContext: () => ctxStub, offsetLeft: 0, offsetTop: 0 };
  el.style.setProperty = () => {};
  return el;
}
const ctxStub = new Proxy(function () {}, {
  get(t, p) { if (p === Symbol.toPrimitive) return () => 0; if (p === 'canvas') return { width: 720, height: 1280 }; return ctxStub; },
  apply() { return ctxStub; }, set() { return true; }
});
const elements = {};
['game','hud','hud-title','hud-score','hud-best','btn-pause','btn-exit',
 'overlay','screen-game','screen-lobby','game-grid','coin-count',
 'mission-list','shop-grid','ach-list','boost-list','records-grid'].forEach(id => elements[id] = mkEl('div'));
elements.game = mkEl('canvas');
global.document = { getElementById: id => elements[id] || (elements[id] = mkEl('div')),
  createElement: tag => mkEl(tag), addEventListener() {} };
global.document.documentElement = { style: { setProperty() {} } };
global.window = global;
global.innerWidth = 390; global.innerHeight = 844; global.devicePixelRatio = 2;
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.dispatchEvent = () => true;
if (!global.requestAnimationFrame) global.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
const storeMap = new Map();
global.localStorage = { getItem: k => storeMap.has(k) ? storeMap.get(k) : null, setItem: (k, v) => storeMap.set(k, String(v)), removeItem: k => storeMap.delete(k) };
class FakeParam { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} cancelScheduledValues() {} }
class FakeNode { constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.Q = new FakeParam(); this.type=''; this.buffer=null; this.detune=new FakeParam(); } connect() { return this; } disconnect() {} start() {} stop() {} }
class FakeAudioContext { constructor() { this._t0 = Date.now(); this.sampleRate = 44100; this.state = 'running'; this.destination = new FakeNode(); this.currentTime = 0; }
  createGain() { return new FakeNode(); } createOscillator() { return new FakeNode(); } createBufferSource() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); } createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
  resume() { this.state = 'running'; return Promise.resolve(); } }
global.AudioContext = FakeAudioContext; global.webkitAudioContext = FakeAudioContext;
global.performance = { now: () => Date.now() };

const root = path.join(__dirname, '..');
function load(rel) { vm.runInThisContext(fs.readFileSync(path.join(root, rel), 'utf8'), { filename: rel }); }
load('js/core.js'); load('js/audio.js'); load('js/meta.js'); load('js/games/astro.js');

let fail = 0;
function check(cond, msg) { if (cond) console.log('  PASS', msg); else { console.error('  FAIL', msg); fail++; } }

console.log('[astro gameplay]');
const g = RA.games.astro;
g.init();
RA.hideOverlay();
g.onStart();

const dt = 1 / 60;

// Phase 1: tap to start (most games need this), then play 30 frames
// with a wiggling input (simulates a human)
// Astro: thrust when not moving, fire periodically
for (let i = 0; i < 30; i++) {
  if (i === 0) { RA.input.taps.push({ x: 180, y: 200 }); }
  if (g.debug().started && !g.debug().over) {
    RA.input.isDown = true;  // always thrust
    if (i % 10 === 0) RA.input.taps.push({ x: 180, y: 200 });  // fire
  }
  g.update(dt);
  g.draw(RA.ctx);
}

check(typeof g.debug === 'function', 'game exposes debug()');
const dbg = g.debug();
check(dbg !== null && typeof dbg === 'object', 'debug() returns an object');

// Phase 2: verify debug() exposes common keys
check('ship' in dbg, 'debug() exposes "ship"');
check('asteroids' in dbg, 'debug() exposes "asteroids"');
check('bullets' in dbg, 'debug() exposes "bullets"');
check('score' in dbg, 'debug() exposes "score"');
check('over' in dbg, 'debug() exposes "over"');
check('started' in dbg, 'debug() exposes "started"');

// Phase 3: verify game handles a 600-frame autopilot run without crashing
let crashed = false;
for (let i = 0; i < 600; i++) {
  try {
    g.update(dt);
    g.draw(RA.ctx);
  } catch (e) {
    crashed = true;
    console.error('  CRASH at frame', i, ':', e.message);
    break;
  }
}
check(!crashed, '600-frame autopilot run did not throw');

if (fail) { console.error('\n\nASTRO GAMEPLAY FAIL'); try { RA.audio.stopBGM(); } catch {} process.exit(1); }
console.log('\n\nASTRO GAMEPLAY PASS');
try { RA.audio.stopBGM(); } catch {}
process.exit(0);
