// Diagnose pong: run a few seconds with tracking driver and dump state.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
function mkEl(tag) {
  const el = { tagName: tag||'DIV', children: [], dataset: {}, style: {}, _classes: new Set(),
    classList: { add:(...c)=>c.forEach(x=>el._classes.add(x)), remove:(...c)=>c.forEach(x=>el._classes.delete(x)),
      toggle:(c,f)=>{const on=f===undefined?!el._classes.has(c):!!f; on?el._classes.add(c):el._classes.delete(c); return on;}, contains:c=>el._classes.has(c) },
    textContent:'', innerHTML:'', appendChild(ch){el.children.push(ch);return ch;}, append(...ch){el.children.push(...ch);return el;},
    addEventListener(){}, removeEventListener(){}, getContext:()=>ctxStub, offsetLeft:0, offsetTop:0 };
  el.style.setProperty=()=>{}; return el;
}
const ctxProxyTarget=function(){}; const ctxStub=new Proxy(ctxProxyTarget,{get(t,p){if(p===Symbol.toPrimitive)return()=>0;if(p==='canvas')return{width:720,height:1280};return ctxStub;},apply(){return ctxStub;},set(){return true;}});
const elements={}; ['game','hud','hud-title','hud-score','hud-best','btn-pause','btn-exit','overlay','screen-game','screen-lobby','game-grid'].forEach(id=>elements[id]=mkEl('div'));
elements['game']=mkEl('canvas');
global.document={getElementById:id=>elements[id]||(elements[id]=mkEl('div')),createElement:mkEl,addEventListener(){}};
global.window=global; global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.dispatchEvent=()=>true;
global.innerWidth=390; global.innerHeight=844; global.devicePixelRatio=2;
const storeMap=new Map(); global.localStorage={getItem:k=>storeMap.get(k)??null,setItem:(k,v)=>storeMap.set(k,String(v))};
class FakeParam{constructor(){this.value=0;}setValueAtTime(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}cancelScheduledValues(){}}
class FakeNode{constructor(a){this.gain=new FakeParam();this.frequency=new FakeParam();this.Q=new FakeParam();this.type='';this.buffer=null;}connect(){return this;}disconnect(){}start(){}stop(){}}
class FakeAC{constructor(){this.sampleRate=44100;this.state='running';this.destination=new FakeNode(this);this._t0=Date.now();}
  get currentTime(){return (Date.now()-this._t0)/1000;} resume(){return Promise.resolve();}
  createGain(){return new FakeNode(this);}createOscillator(){return new FakeNode(this);}createBufferSource(){return new FakeNode(this);}
  createBiquadFilter(){return new FakeNode(this);}createBuffer(c,l){return{getChannelData:()=>new Float32Array(l)};}}
global.AudioContext=FakeAC;
for (const rel of ['js/core.js','js/audio.js','js/games/pong.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname,'..',rel),'utf8'),{filename:rel});
}
const g = RA.games.pong;
g.init();
console.log('after init overlay:', RA.isOverlayOpen());
RA.hideOverlay();
g.onStart();
const dt = 1/60;
let last = {};
for (let i = 0; i < 60 * 60; i++) {
  last = g.debug();
  RA.input.isDown = true;
  RA.input.x = last.ballX;
  RA.input.y = RA.VH - 64;
  g.update(dt);
  if (i % 120 === 0) console.log((i/60).toFixed(1)+'s', JSON.stringify(last));
}
console.log('final:', JSON.stringify(last), 'overlay:', RA.isOverlayOpen());
process.exit(0);   // audio sequencer setInterval would otherwise keep us alive
