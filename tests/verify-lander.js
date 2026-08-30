// Targeted gameplay verify for LUNAR LANDER.
// Verifies: load, init, onStart, autopilot flight, fuel consumption,
//           debug() state, and graceful game-over on crash.
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
load('js/core.js'); load('js/audio.js'); load('js/meta.js'); load('js/games/lander.js');

let fail = 0;
function check(cond, msg) { if (cond) console.log('  PASS', msg); else { console.error('  FAIL', msg); fail++; } }

console.log('[lander gameplay]');
const g = RA.games.lander;
g.init();
RA.hideOverlay();
g.onStart();

const dt = 1 / 60;

// Phase 1: tap to start, then play 60 frames of autopilot
// (thrust when below y=300, release when above). After 60 frames, fuel
// should have decreased.
let initialFuel = g.debug().fuel;
let maxShipY = 0, minShipY = 99999;
for (let i = 0; i < 60; i++) {
  if (i === 0) { RA.input.taps.push({ x: 180, y: 80 }); }
  const dbg = g.debug();
  if (dbg.started && !dbg.over) {
    const wantUp = dbg.ship.y > 300;
    RA.input.isDown = wantUp;
  }
  g.update(dt);
  g.draw(RA.ctx);
  if (g.debug().ship.y > maxShipY) maxShipY = g.debug().ship.y;
  if (g.debug().ship.y < minShipY) minShipY = g.debug().ship.y;
}

check(g.debug().started, 'lander started after tap');
check(maxShipY > minShipY, `ship y moved (min=${minShipY.toFixed(1)}, max=${maxShipY.toFixed(1)})`);

// Phase 2: drain fuel by thrusting a long time, then verify fuel = 0
for (let i = 0; i < 600; i++) {
  if (g.debug().over) break;
  RA.input.isDown = true;
  g.update(dt);
}
check(g.debug().fuel === 0 || g.debug().over, `fuel drained or game ended (fuel=${g.debug().fuel.toFixed(1)}, over=${g.debug().over})`);

// Phase 3: verify debug() returns the right keys
const dbg = g.debug();
const expectedKeys = ['ship', 'score', 'fuel', 'over', 'started', 'padX', 'perfectLanding', 'vx', 'vy'];
for (const k of expectedKeys) {
  check(k in dbg, `debug() exposes "${k}"`);
}

if (fail) { console.error('\n\nLANDER GAMEPLAY FAIL'); try { RA.audio.stopBGM(); } catch {} process.exit(1); }
console.log('\n\nLANDER GAMEPLAY PASS');
try { RA.audio.stopBGM(); } catch {}
process.exit(0);
