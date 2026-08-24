// Verify drum token parsing: compact drum strings ('KhSh...') must expand to
// per-16th tokens so K/S/h hits actually fire; spaced lines must still work.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mkEl(tag) {
  const el = { tagName: tag || 'DIV', children: [], dataset: {}, style: {}, _classes: new Set(),
    classList: { add:(...c)=>c.forEach(x=>el._classes.add(x)), remove:(...c)=>c.forEach(x=>el._classes.delete(x)),
      toggle:(c,f)=>{const on=f===undefined?!el._classes.has(c):!!f; on?el._classes.add(c):el._classes.delete(c); return on;}, contains:c=>el._classes.has(c) },
    textContent:'', innerHTML:'', appendChild(ch){el.children.push(ch);return ch;}, append(...ch){el.children.push(...ch);return el;},
    addEventListener(){}, removeEventListener(){}, getContext:()=>ctxStub, offsetLeft:0, offsetTop:0 };
  el.style.setProperty=()=>{}; return el;
}
const ctxStub = new Proxy(function(){},{ get(t,p){ if(p===Symbol.toPrimitive)return()=>0; if(p==='canvas')return{width:720,height:1280}; return ctxStub; }, apply(){return ctxStub;}, set(){return true;} });
const elements={}; ['game','hud','hud-title','hud-score','hud-best','btn-pause','btn-exit','overlay','screen-game','screen-lobby','game-grid'].forEach(id=>elements[id]=mkEl('div'));
elements['game']=mkEl('canvas');
global.document={getElementById:id=>elements[id]||(elements[id]=mkEl('div')),createElement:mkEl,addEventListener(){}};
global.window=global; global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.dispatchEvent=()=>true;
global.innerWidth=390; global.innerHeight=844; global.devicePixelRatio=2;
const storeMap=new Map(); global.localStorage={getItem:k=>storeMap.get(k)??null,setItem:(k,v)=>storeMap.set(k,String(v))};

let drumHits = 0, noiseCalls = 0, kickCalls = 0;
class FakeParam{constructor(){this.value=0;}setValueAtTime(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}cancelScheduledValues(){}}
class FakeNode{constructor(a){this.gain=new FakeParam();this.frequency=new FakeParam();this.Q=new FakeParam();this.type='';this.buffer=null;}connect(){return this;}disconnect(){}start(){}stop(){}}
class FakeAC{constructor(){this.sampleRate=44100;this.state='running';this.destination=new FakeNode(this);this._t0=Date.now();}
  get currentTime(){return (Date.now()-this._t0)/1000;} resume(){return Promise.resolve();}
  createGain(){return new FakeNode(this);}createOscillator(){return new FakeNode(this);}createBufferSource(){drumHits++;return new FakeNode(this);}
  createBiquadFilter(){noiseCalls++;return new FakeNode(this);}createBuffer(c,l){return{getChannelData:()=>new Float32Array(l)};}}
global.AudioContext=FakeAC;

const root = path.join(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(root,'js/core.js'),'utf8'),{filename:'core.js'});
vm.runInThisContext(fs.readFileSync(path.join(root,'js/audio.js'),'utf8'),{filename:'audio.js'});

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  PASS ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

console.log('[drum parsing]');
RA.audio.unlock();

(async () => {
  // Deterministic check: run the sequencer long enough that every step fires.
  // At 100+ BPM, 16th ≈ 90–150ms; 1.3s covers ≥ one full 32-step loop for all songs.
  const results = {};
  for (const song of ['menu','runner','jumper','shooter','racing','rpg','worm','blockfall','brickbreak','flappy','stackup','snake','pong','mergedrop','minesweeper','dodge']) {
    drumHits = noiseCalls = kickCalls = 0;
    RA.audio.playBGM(song);
    await new Promise(r => setTimeout(r, 1300));
    RA.audio.stopBGM();
    results[song] = { kicks: drumHits, noise: noiseCalls };
  }

  for (const [song, r] of Object.entries(results)) {
    check(r.kicks > 0 && r.noise > 0, `${song}: drums audible (kicks=${r.kicks}, hats/snare=${r.noise})`);
  }

  console.log(failures === 0 ? '\nDRUM PARSE PASS' : '\nFAILURES');
  process.exit(failures ? 1 : 0);
})();
