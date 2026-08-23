// Diagnose why checkpoints never trigger: track player position vs checkpoint targets.
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

// Extract WPTS by evaluating the module-level IIFE — easier: re-run the same math here.
const defs = [
  [70,90],[180,70],[290,90],[320,170],
  [270,230],[180,250],[120,300],[130,380],
  [220,420],[300,470],[260,560],[150,580],
  [70,520],[50,420],[80,330],[50,220],[50,140]
];
function buildWpts() {
  const pts = [];
  const n = defs.length;
  for (let i = 0; i < n; i++) {
    const p0 = defs[(i-1+n)%n], p1 = defs[i], p2 = defs[(i+1)%n], p3 = defs[(i+2)%n];
    for (let t = 0; t < 1; t += 0.2) {
      const t2=t*t,t3=t2*t;
      const x = 0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
      const y = 0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
      pts.push({x,y});
    }
  }
  return pts;
}
const WPTS = buildWpts();
console.log('WPTS count:', WPTS.length);

RA.games.racing.init();
RA.hideOverlay();
RA.games.racing.onStart();

// Track-following driver using the same waypoint data:
// find nearest waypoint to car, aim at wp+8, convert to steering via screen-space dx.
// We can read the car's position indirectly through the debug hook? It doesn't expose x/y.
// Instead: simulate the same physics here in parallel (mirror of stepCar) — no.
// Better approach: expose debug with x/y. For now, patch the game module at runtime is not possible;
// so we replicate updateLapProgress conditions and check what's happening with the real car
// by reading positions from the draw call... not available either.

// Simplest robust fix path: instrument via console.log inside a copied physics sim that mirrors
// stepCar + our own driver, then check whether ANY driver following this scheme passes checkpoints.
// But first — quick sanity: distance between consecutive waypoints and checkpoint spacing.
let minGap = Infinity, maxGap = 0;
for (let i = 0; i < WPTS.length; i++) {
  const j = (i+1) % WPTS.length;
  const d = Math.hypot(WPTS[j].x - WPTS[i].x, WPTS[j].y - WPTS[i].y);
  minGap = Math.min(minGap, d); maxGap = Math.max(maxGap, d);
}
console.log('waypoint gap min/max:', minGap.toFixed(1), maxGap.toFixed(1));
const cps = [0, Math.floor(WPTS.length/4), Math.floor(WPTS.length/2), Math.floor(WPTS.length*3/4)];
console.log('checkpoint indices:', cps);
// arc distance between consecutive checkpoints:
for (let k = 0; k < 4; k++) {
  const a = cps[k], b = cps[(k+1)%4];
  let d = Math.abs(a-b); d = Math.min(d, WPTS.length-d);
  console.log(`cp${k}->cp${(k+1)%4}: ${d} waypoints (~${(d*minGap).toFixed(0)}-${(d*maxGap).toFixed(0)}px)`);
}

// The trigger window: d < 6 waypoints AND near.d < ROAD_W+24 (=86px).
// At speed 340px/s and dt=1/60, per-frame movement = 5.7px. A 6-waypoint window spans
// roughly 6*gap px along the track — should be hittable IF the car drives near centerline.
// The likely failure: our test driver is bad (car stuck against wall / spinning), OR near.d
// at checkpoint pass is >86px because car rides the outside edge.

// Let's mirror the exact player physics with an ideal driver here to see if checkpoints are passable.
function mirrorSim() {
  const car = { x: 70, y: 90, ang: 0, speed: 0, wp: 0, nextCp: 1, cpHits: 0 };
  const ROAD_W_ = 62;
  const checkpoints_ = [0, Math.floor(WPTS.length/4), Math.floor(WPTS.length/2), Math.floor(WPTS.length*3/4)];
  const events = [];
  function nearest(x, y, hint) {
    let best = Infinity, bi = hint;
    for (let k = -14; k <= 14; k++) {
      const i = ((hint+k)%WPTS.length+WPTS.length)%WPTS.length;
      const d = (WPTS[i].x-x)**2+(WPTS[i].y-y)**2;
      if (d<best){best=d;bi=i;}
    }
    if (best > 90*90) { for (let i=0;i<WPTS.length;i++){const d=(WPTS[i].x-x)**2+(WPTS[i].y-y)**2; if(d<best){best=d;bi=i;}} }
    return { i: bi, d: Math.sqrt(best) };
  }
  const dt = 1/60;
  for (let frame = 0; frame < 60*240; frame++) {
    // throttle always on after countdown
    const racing = frame > 60*3.2;
    // ideal steer: toward lookahead point
    const look = WPTS[(car.wp + 8) % WPTS.length];
    const desired = Math.atan2(look.y - car.y, look.x - car.x);
    let dAng = desired - car.ang;
    while (dAng > Math.PI) dAng -= Math.PI*2;
    while (dAng < -Math.PI) dAng += Math.PI*2;
    const steer = Math.max(-1, Math.min(1, dAng * 2.4));

    const road = nearest(car.x, car.y, car.wp).d < ROAD_W_ + 6;
    const maxS = road ? 340 : 340*0.45;
    if (racing) car.speed += 260*dt; else car.speed -= 120*dt;
    if (car.speed > maxS) car.speed += (maxS-car.speed)*4*dt;
    if (car.speed < 0) car.speed = 0;
    const grip = road ? 3.4 : 2.2;
    car.ang += steer * grip * dt * (0.5 + Math.min(1, car.speed/240)*0.9);
    car.x += Math.cos(car.ang)*car.speed*dt;
    car.y += Math.sin(car.ang)*car.speed*dt;

    const near = nearest(car.x, car.y, car.wp);
    car.wp = near.i;
    if (near.d > ROAD_W_+14) {
      const w = WPTS[car.wp];
      const dx = w.x-car.x, dy = w.y-car.y;
      const dd = Math.max(1, Math.hypot(dx,dy));
      car.x += dx/dd*(near.d-ROAD_W_-14);
      car.y += dy/dd*(near.d-ROAD_W_-14);
      car.speed *= 0.965;
    }

    if (racing) {
      const target = checkpoints_[car.nextCp];
      let dcp = Math.abs(near.i - target); dcp = Math.min(dcp, WPTS.length - dcp);
      if (dcp < 6 && near.d < ROAD_W_+24) {
        events.push({frame, cp: car.nextCp});
        car.nextCp = (car.nextCp+1)%4;
        car.cpHits++;
        if (car.cpHits >= 12) break;
      }
    }
  }
  return events;
}

const evts = mirrorSim();
console.log('ideal-driver checkpoint events:', evts.length, JSON.stringify(evts.slice(0,10)));
console.log(evts.length >= 12 ? 'PASS: full race possible with proper driving' : 'FAIL: even ideal driving cannot complete checkpoints — logic/window too tight');
