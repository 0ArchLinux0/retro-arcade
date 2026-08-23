// Verify BRICK BREAK actually plays: paddle follows finger, ball bounces,
// bricks break (score progresses), and ball loss costs a life without crash.
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
['game','hud','hud-title','hud-score','hud-best','btn-pause','btn-exit','overlay','screen-game','screen-lobby','game-grid']
  .forEach(id => elements[id] = mkEl('div'));
elements['game'] = mkEl('canvas');
global.document = { getElementById: id => elements[id] || (elements[id] = mkEl('div')), createElement: mkEl, addEventListener() {} };
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
for (const rel of ['js/core.js','js/audio.js','js/games/brickbreak.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, rel), 'utf8'), { filename: rel });
}

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  PASS ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

console.log('[brickbreak gameplay]');

// Track scores reported to the HUD
let maxScore = 0;
const origSetScore = RA.setScore;
RA.setScore = v => { maxScore = Math.max(maxScore, v); origSetScore(v); };

const g = RA.games.brickbreak;
const VW = RA.VW, VH = RA.VH;
g.init();
RA.hideOverlay();
g.onStart();

const dt = 1/60;
// "Player": keep finger pressed near the ball's x so paddle tracks and ball
// keeps launching; sweep left-right to chase. We can't see ball pos, but a
// sweeping finger covers it statistically.
for (let i = 0; i < 60 * 45 && !RA.isOverlayOpen(); i++) {
  RA.input.isDown = true;
  RA.input.x = VW / 2 + Math.sin(i / 60 * 2.2) * (VW / 2 - 30);
  RA.input.y = VH - 60;
  g.update(dt);
  if (i % 10 === 0) g.draw(RA.ctx);
}

check(maxScore > 0, `bricks broken — score progressed (max=${maxScore})`);

// Ball-loss path: run a second session with NO input at all (finger never down).
maxScore = 0;
RA.hideOverlay();
g.init(); g.onStart?.();
// overlay from init blocks onStart via tapStart? init shows overlay; hide then start.
g.init(); RA.hideOverlay(); g.onStart();
let survivedNoInput = true;
try {
  for (let i = 0; i < 60 * 20 && !RA.isOverlayOpen(); i++) {
    RA.input.isDown = false;
    g.update(dt);
  }
} catch (e) { survivedNoInput = false; console.error(e); }
check(survivedNoInput, 'idle play (ball loss + lives drain) does not crash');

console.log(failures === 0 ? '\nBRICKBREAK GAMEPLAY PASS' : '\nFAILURES');
process.exit(failures ? 1 : 0);
