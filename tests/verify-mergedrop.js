// MERGE DROP deep gameplay verification using the debug() hook:
// forced drops → neighbour merge → chain gravity → board-full game over.
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
const elements={};
['game','hud','hud-title','hud-score','hud-best','btn-pause','btn-exit','overlay','screen-game',
 'screen-lobby','game-grid','coin-count','mission-list','shop-grid'].forEach(id=>elements[id]=mkEl('div'));
elements['game']=mkEl('canvas');
global.document={getElementById:id=>elements[id]||(elements[id]=mkEl('div')),createElement:mkEl,addEventListener(){}};
global.document.documentElement={style:{setProperty(){}}};
global.window=global; global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.dispatchEvent=()=>true;
global.innerWidth=390; global.innerHeight=844; global.devicePixelRatio=2;
const storeMap=new Map(); global.localStorage={getItem:k=>storeMap.get(k)??null,setItem:(k,v)=>storeMap.set(k,String(v)),removeItem:k=>storeMap.delete(k)};
class FakeParam{constructor(){this.value=0;}setValueAtTime(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}cancelScheduledValues(){}}
class FakeNode{constructor(a){this.gain=new FakeParam();this.frequency=new FakeParam();this.Q=new FakeParam();this.type='';this.buffer=null;}connect(){return this;}disconnect(){}start(){}stop(){}}
class FakeAC{constructor(){this.sampleRate=44100;this.state='running';this.destination=new FakeNode(this);this._t0=Date.now();}
  get currentTime(){return (Date.now()-this._t0)/1000;} resume(){return Promise.resolve();}
  createGain(){return new FakeNode(this);}createOscillator(){return new FakeNode(this);}createBufferSource(){return new FakeNode(this);}
  createBiquadFilter(){return new FakeNode(this);}createBuffer(c,l){return{getChannelData:()=>new Float32Array(l)};}}
global.AudioContext=FakeAC;

const root = path.join(__dirname, '..');
for (const f of ['js/core.js','js/audio.js','js/meta.js','js/games/mergedrop.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
}

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  PASS ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

const g = RA.games.mergedrop;
const dbg = g.debug();
const dt = 1 / 60;

console.log('[merge drop gameplay]');

// start
g.init(); RA.hideOverlay(); g.onStart();

// --- scenario 1: two adjacent equal tiles merge ---
dbg.forceCur(4);
dbg.dropCol(2);
dbg.pump(20);                       // land
check(dbg.grid[7][2] === 4 || dbg.grid.some(row => row.includes(4)), 'tile landed in col 2');

dbg.forceCur(4);
dbg.dropCol(2);
dbg.pump(20);                       // land → 4+4 merges into 8
let found8 = false;
for (const row of dbg.grid) for (const v of row) if (v === 8) found8 = true;
check(found8, 'adjacent 4+4 merged into 8');
check(dbg.score >= 8, `score credited after merge (score=${dbg.score})`);

// --- scenario 2: chain — build a second 8 next to it → 16 ---
dbg.forceCur(4); dbg.dropCol(2); dbg.pump(20);
dbg.forceCur(4); dbg.dropCol(2); dbg.pump(30);
let found16 = false;
for (const row of dbg.grid) for (const v of row) if (v === 16) found16 = true;
check(found16, 'chained merges produced 16 (8+8)');
check(dbg.merges >= 3, `merge counter advanced (merges=${dbg.merges})`);
check(dbg.score > 24, `chain bonus applied (score=${dbg.score} > 24)`);

// --- scenario 3: full column rejected ---
for (let i = 0; i < 12 && !RA.games.mergedrop.debug().over; i++) {
  const d = RA.games.mergedrop.debug();
  d.forceCur(1024);                 // never matches anything
  d.dropCol(0);
  d.pump(20);
}
const after = RA.games.mergedrop.debug();
check(!after.over, 'filling one column does not end the game');

// --- scenario 4: fill entire board → game over ---
if (!after.over) {
  let guard = 0;
  while (!dbg.over && guard++ < 200) {
    // find any open column
    let col = -1;
    for (let c = 0; c < 6; c++) if (!dbg.grid[0][c]) { col = c; break; }
    if (col < 0) break;
    dbg.forceCur(2048 + guard);     // unique values → no merges
    dbg.dropCol(col);
    dbg.pump(25);
  }
}
check(dbg.over === true, 'board full triggers game over');
check(RA.best('mergedrop') > 0, 'best score submitted to leaderboard store');

const metaState = RA.meta.debugState();
check(metaState.lifetimePlays >= 1, 'meta lifetimePlays incremented');
check(metaState.coins > 0 || metaState.totalEarned > 0, `meta coins earned (${metaState.coins}¢)`);

console.log(failures === 0 ? '\nMERGE DROP GAMEPLAY PASS' : '\nFAILURES');
process.exit(failures ? 1 : 0);
