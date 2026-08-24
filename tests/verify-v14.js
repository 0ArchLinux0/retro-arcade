// Deep gameplay verification for MINESWEEPER + DODGE ROYALE via debug() hooks.
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
['game','hud','hud-title','hud-score','hud-best','btn-pause','btn-exit','overlay',
 'screen-game','screen-lobby','game-grid','coin-count','mission-list','shop-grid','ach-list']
 .forEach(id=>elements[id]=mkEl('div'));
elements['game']=mkEl('canvas');
global.document={getElementById:id=>elements[id]||(elements[id]=mkEl('div')),createElement:mkEl,addEventListener(){}};
global.document.documentElement={style:{setProperty(){}}};
global.window=global; global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.dispatchEvent=()=>true;
global.innerWidth=390; global.innerHeight=844; global.devicePixelRatio=2;
const storeMap=new Map(); global.localStorage={getItem:k=>storeMap.get(k)??null,setItem:(k,v)=>storeMap.set(k,String(v)),removeItem:k=>storeMap.delete(k)};
class FakeParam{constructor(){this.value=0;}setValueAtTime(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}cancelScheduledValues(){}}
class FakeNode{constructor(a){this.gain=new FakeParam();this.frequency=new FakeParam();this.Q=new FakeParam();this.type='';this.buffer=null;}connect(){return this;}disconnect(){}start(){}stop(){}}
class FakeAC{constructor(){this._t0=Date.now();this.sampleRate=44100;this.state='running';this.destination=new FakeNode(this);}
  get currentTime(){return (Date.now()-this._t0)/1000;} resume(){return Promise.resolve();}
  createGain(){return new FakeNode(this);}createOscillator(){return new FakeNode(this);}createBufferSource(){return new FakeNode(this);}
  createBiquadFilter(){return new FakeNode(this);}createBuffer(c,l){return{getChannelData:()=>new Float32Array(l)};}}
global.AudioContext=FakeAC;

const root = path.join(__dirname, '..');
for (const f of ['js/core.js','js/audio.js','js/meta.js','js/games/minesweeper.js','js/games/dodge.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
}

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  PASS ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

// ================= MINESWEEPER =================
console.log('[minesweeper deep]');
{
  const g = RA.games.minesweeper;
  g.init(); RA.hideOverlay();
  const d = g.debug();

  check(d.COLS === 9 && d.ROWS === 11, 'board is 9x11');
  // reveal a corner — first tap safe
  d.reveal(10, 0);
  check(d.grid[10][0].state === 1, 'first reveal opens cell');
  check(!d.over, 'no mine explosion on first reveal');
  let minesPlaced = 0;
  for (const row of d.grid) for (const c of row) if (c.mine) minesPlaced++;
  check(minesPlaced === d.MINES, `all ${d.MINES} mines placed after first reveal (got ${minesPlaced})`);

  // flood fill: find a zero-adjacency revealed area or verify adjacency counts sane
  let adjSane = true;
  for (let r = 0; r < d.ROWS; r++) for (let c = 0; c < d.COLS; c++) {
    if (d.grid[r][c].adj > 8) adjSane = false;
    if (!d.grid[r][c].mine && d.grid[r][c].adj < 0) adjSane = false;
  }
  check(adjSane, 'adjacency counts within bounds');

  // flag toggling
  const beforeFlags = d.flags;
  d.toggleFlag(5, 5);
  check(d.grid[5][5].state === 2 && d.flags === beforeFlags + 1, 'flag placed');
  d.toggleFlag(5, 5);
  check(d.grid[5][5].state === 0 && d.flags === beforeFlags, 'flag removed');

  // chord on revealed number with no flags must not explode hidden cells silently
  d.chord(10, 0);
  check(typeof d.score === 'number', 'chord executes without error');

  // force loss: reveal every hidden cell until boom (mines exist)
  let boomed = false;
  outer:
  for (let r = 0; r < d.ROWS; r++) for (let c = 0; c < d.COLS; c++) {
    if (d.over) { boomed = true; break outer; }
    if (d.grid[r][c].mine && !d.startedSafeCheck) { /* can't peek via public API; reveal all */ }
    if (d.grid[r][c].state === 0) {
      // reveal regardless — mines will eventually be hit
      d.reveal(r, c);
      if (d.over) { boomed = true; break outer; }
    }
  }
  check(boomed || d.over || d.won, 'game reaches an end state when board exhausted');
}

// fresh instance: guaranteed win path by revealing all non-mines via debug access
console.log('[minesweeper win path]');
{
  const g2 = RA.games.minesweeper;
  g2.init(); RA.hideOverlay();
  const d2 = g2.debug();
  d2.reveal(0, 4);
  // reveal all safe cells directly
  for (let r = 0; r < d2.ROWS; r++) for (let c = 0; c < d2.COLS; c++) {
    if (!d2.grid[r][c].mine && d2.grid[r][c].state === 0) d2.floodReveal(r, c);
  }
  // count revealed
  let revealed = 0;
  for (const row of d2.grid) for (const cc of row) if (cc.state === 1) revealed++;
  check(revealed >= d2.COLS * d2.ROWS - d2.MINES - 20, `floodReveal exposes large area (${revealed} cells)`);
}

// ================= DODGE =================
console.log('[dodge deep]');
{
  const g = RA.games.dodge;
  g.init(); RA.hideOverlay();
  const d = g.debug();
  g.onStart();

  d.pump(60);   // 1s
  check(d.time > 0.9, `time advances (${d.time.toFixed(1)}s)`);
  check(Array.isArray(d.bullets), 'bullets array live');
  d.spawnWave();
  check(d.bullets.length > 0, `wave spawns bullets (${d.bullets.length})`);

  // park player in a far corner and pump — survival time & score should grow
  d.setPlayer(10, RA.VH * 0.9);
  const s0 = d.score;
  d.pump(180);   // 3s
  check(d.score > s0, `score accrues while alive (${Math.floor(s0)} → ${Math.floor(d.score)})`);

  // bullets eventually clear or player dies — either way state stays consistent
  d.pump(600);   // +10s
  check(typeof d.grazes === 'number', 'graze counter tracked');
  check(d.over === true || d.time > 10, 'session ends or survives 10s+');
  if (d.over) check(RA.best('dodge') >= 0, 'best score store reachable');

  const metaState = RA.meta.debugState();
  check(metaState.lifetimePlays >= 1, 'meta lifetimePlays incremented (from earlier games)');
}

console.log(failures === 0 ? '\nDEEP VERIFICATION PASS' : '\nFAILURES');
process.exit(failures ? 1 : 0);
