// Verify the REAL game module completes laps with a proportional (smooth) driver.
// The game steers by: steer = clamp((input.x - carScreenX)/60, -1, 1), so we can
// compute the EXACT input.x each frame to produce a desired steering value:
//   carScreenX = dbg.x - camX;  input.x = carScreenX + desiredSteer*60
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
['game','hud','hud-title','hud-score','hud-best','btn-pause','btn-exit','overlay','screen-game','screen-lobby']
  .forEach(id => elements[id] = mkEl('div'));
elements['game'] = mkEl('canvas');
global.document = { getElementById: id => elements[id] || (elements[id] = mkEl('div')), createElement: mkEl, addEventListener() {} };
global.window = global;
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.innerWidth = 390; global.innerHeight = 844; global.devicePixelRatio = 2;
const storeMap = new Map();
global.localStorage = { getItem: k => storeMap.get(k) ?? null, setItem: (k, v) => storeMap.set(k, String(v)) };
class FakeParam { constructor(){this.value=0;} setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} }
class FakeNode { constructor(a){this.gain=new FakeParam();this.frequency=new FakeParam();this.type='';} connect(){return this;} start(){} stop(){} }
class FakeAC { constructor(){this.sampleRate=44100;this.state='running';this.destination=new FakeNode(this);this._t0=Date.now();}
  get currentTime(){return (Date.now()-this._t0)/1000;} resume(){return Promise.resolve();}
  createGain(){return new FakeNode(this);} createOscillator(){return new FakeNode(this);}
  createBufferSource(){return new FakeNode(this);} createBiquadFilter(){return new FakeNode(this);}
  createBuffer(c,l){return {getChannelData:()=>new Float32Array(l)};} }
global.AudioContext = FakeAC;

const root = path.join(__dirname, '..');
for (const rel of ['js/core.js','js/audio.js','js/games/racing.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, rel), 'utf8'), { filename: rel });
}

const defs = [
  [70,90],[180,70],[290,90],[320,170],
  [270,230],[180,250],[120,300],[130,380],
  [220,420],[300,470],[260,560],[150,580],
  [70,520],[50,420],[80,330],[50,220],[50,140]
];
const WPTS = (() => {
  const pts = []; const n = defs.length;
  for (let i = 0; i < n; i++) {
    const p0 = defs[(i-1+n)%n], p1 = defs[i], p2 = defs[(i+1)%n], p3 = defs[(i+2)%n];
    for (let t = 0; t < 1; t += 0.2) {
      const t2=t*t,t3=t2*t;
      pts.push({
        x: 0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        y: 0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
      });
    }
  }
  return pts;
})();

RA.games.racing.init();
RA.hideOverlay();
RA.games.racing.onStart();

const VW = RA.vw || 390;
const dt = 1/60;
let lastCpHits = 0;
const events = [];
let finished = false;

for (let i = 0; i < 60 * 240; i++) {
  const d0 = RA.games.racing.debug();

  // nearest waypoint (full scan — cheap)
  let wp = 0, bd = Infinity;
  for (let j = 0; j < WPTS.length; j++) {
    const dd = (WPTS[j].x - d0.x)**2 + (WPTS[j].y - d0.y)**2;
    if (dd < bd) { bd = dd; wp = j; }
  }
  // proportional steering toward a lookahead point
  const look = WPTS[(wp + 7) % WPTS.length];
  const desired = Math.atan2(look.y - d0.y, look.x - d0.x);
  let dAng = desired - d0.ang;
  while (dAng > Math.PI) dAng -= Math.PI * 2;
  while (dAng < -Math.PI) dAng += Math.PI * 2;
  const wantSteer = Math.max(-1, Math.min(1, dAng * 2.4));

  RA.input.isDown = true;
  RA.input.keys = {};
  const carScreenX = d0.x - d0.camX;
  RA.input.x = carScreenX + wantSteer * 60;
  RA.input.y = 500;

  RA.games.racing.update(dt);
  if (i % 10 === 0) RA.games.racing.draw(RA.ctx);

  const after = RA.games.racing.debug();
  if (after.cpHits !== lastCpHits) {
    lastCpHits = after.cpHits;
    events.push({ t: +after.lapTime.toFixed(1), cpHits: after.cpHits, lap: after.lap });
  }
  if (after.raceDone || RA.isOverlayOpen()) { finished = true; break; }
}

console.log('events:', JSON.stringify(events));
console.log('final:', JSON.stringify(RA.games.racing.debug()));
if (finished && events.length >= 12) console.log('\nPASS — full race completed');
else if (events.length >= 6) console.log('\nPARTIAL PASS — laps progressing');
else { console.log('\nFAIL'); process.exitCode = 1; }
