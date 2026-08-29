// Targeted gameplay verify for NEON CAVE — hold-thrust through cavern.
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
    getContext: () => ctxStub,
    offsetLeft: 0, offsetTop: 0
  };
  el.style.setProperty = () => {};
  return el;
}
const ctxStub = new Proxy(function () {}, {
  get(t, p) {
    if (p === Symbol.toPrimitive) return () => 0;
    if (p === 'canvas') return { width: 720, height: 1280 };
    return ctxStub;
  },
  apply() { return ctxStub; },
  set() { return true; }
});
const elements = {};
['game', 'hud', 'hud-title', 'hud-score', 'hud-best', 'btn-pause', 'btn-exit',
 'overlay', 'screen-game', 'screen-lobby', 'game-grid', 'coin-count',
 'mission-list', 'shop-grid', 'ach-list', 'boost-list', 'records-grid'].forEach(id => elements[id] = mkEl('div'));
elements.game = mkEl('canvas');
global.document = {
  getElementById: id => elements[id] || (elements[id] = mkEl('div')),
  createElement: tag => mkEl(tag),
  addEventListener() {}
};
global.document.documentElement = { style: { setProperty() {} } };
global.window = global;
global.innerWidth = 390; global.innerHeight = 844; global.devicePixelRatio = 2;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.dispatchEvent = () => true;
if (!global.requestAnimationFrame) global.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
const storeMap = new Map();
global.localStorage = {
  getItem: k => storeMap.has(k) ? storeMap.get(k) : null,
  setItem: (k, v) => storeMap.set(k, String(v)),
  removeItem: k => storeMap.delete(k)
};
class FakeParam { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode {
  constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.Q = new FakeParam(); }
  connect() { return this; } disconnect() {} start() {} stop() {}
}
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = new FakeNode(); this.state = 'running'; }
  createOscillator() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
  resume() { return Promise.resolve(); }
}
global.AudioContext = FakeAudioContext;
global.webkitAudioContext = FakeAudioContext;
global.performance = { now: () => Date.now() };

const root = path.join(__dirname, '..');
function load(rel) { vm.runInThisContext(fs.readFileSync(path.join(root, rel), 'utf8'), { filename: rel }); }
load('js/core.js');
load('js/audio.js');
load('js/meta.js');
load('js/games/cave.js');

let fail = 0;
function check(cond, msg) {
  if (cond) console.log('  PASS', msg);
  else { console.error('  FAIL', msg); fail++; }
}

console.log('[cave gameplay]');
const g = RA.games.cave;
g.init();
RA.hideOverlay();
g.onStart();

// Centered, alternating thrust to stay in the gap for ~8s
const dt = 1 / 60;
let maxScore = 0;
for (let i = 0; i < 480; i++) {
  const dbg = g.debug();
  // simple autopilot: thrust when below center of gap
  const ship = dbg.ship;
  const wantUp = ship.y > RA.VH * 0.5;
  RA.input.isDown = wantUp;
  RA.input.keys.Space = wantUp;
  g.update(dt);
  g.draw(RA.ctx);
  maxScore = Math.max(maxScore, g.debug().score);
}

check(maxScore > 0, `distance score progressed (max=${maxScore})`);
check(!g.debug().over || maxScore > 5, 'autopilot survived long enough to score');

// crash path should not throw
g.debug().setShip(0, 800);
g.update(dt);
check(g.debug().over === true, 'wall collision ends the run');

if (fail) {
  console.error('\nCAVE GAMEPLAY FAIL');
  try { RA.audio.stopBGM(); } catch {}
  process.exit(1);
}
console.log('\nCAVE GAMEPLAY PASS');
try { RA.audio.stopBGM(); } catch {}
process.exit(0);
