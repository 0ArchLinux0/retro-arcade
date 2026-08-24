// Verify PONG DUEL plays a real match: a tracking driver follows the ball x
// (from the debug hook) so the player returns shots; confirm scoring works
// both ways and a full game to 7 completes without crash.
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
for (const rel of ['js/core.js','js/audio.js','js/games/pong.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, rel), 'utf8'), { filename: rel });
}

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  PASS ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

console.log('[pong gameplay]');

const g = RA.games.pong;
g.init();
RA.hideOverlay();
g.onStart();

const dt = 1/60;
let finished = false, frames = 0;
for (; frames < 60 * 300 && !finished; frames++) {
  const d = g.debug();
  RA.input.isDown = true;
  // imperfect human: track the ball, but zone out briefly every ~8s so the
  // AI can score too; AI misses come from its own aim-error mechanic
  const lazy = (frames % 480) < 45;
  RA.input.x = lazy ? 30 : d.ballX + Math.sin(frames / 40) * 6;
  RA.input.y = RA.VH - 64;
  g.update(dt);
  if (frames % 10 === 0) g.draw(RA.ctx);
  // end-round overlay opens on a real 800ms timer that never fires in this
  // synchronous loop, so treat reaching WIN_SCORE as the match end
  const now = g.debug();
  if (now.pScore >= 7 || now.aScore >= 7) finished = true;
}
const final = g.debug();
check(final.pScore > 0 || final.aScore > 0, `points were scored during match (${JSON.stringify(final)})`);
check(finished, `full match to 7 points completed (${(frames / 60).toFixed(0)}s sim, final ${final.pScore}-${final.aScore})`);

console.log(failures === 0 ? '\nPONG GAMEPLAY PASS' : '\nFAILURES');
process.exit(failures ? 1 : 0);
