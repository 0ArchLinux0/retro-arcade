// ============================================================
// Retro Arcade — chiptune audio engine (WebAudio, zero assets)
// ============================================================
'use strict';

RA.audio = (() => {
  let actx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;

  // --- sequencer state ---
  let seqTimer = null;
  let curSong = null;
  let step = 0;
  let nextTime = 0;
  let TEMPO_CUR = 140;

  function ensure() {
    if (actx) return true;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = 0.55;
      master.connect(actx.destination);
      musicGain = actx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      sfxGain = actx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(master);
      return true;
    } catch { return false; }
  }

  // iOS/Safari: resume on first user gesture
  function unlock() {
    if (!ensure()) return;
    if (actx.state === 'suspended') actx.resume();
    if (curSong && !seqTimer) startSequencer();
  }

  // ---------- SFX ----------
  function tone({ freq = 440, endFreq = null, dur = 0.1, type = 'square', vol = 0.5, delay = 0, slideType = 'exp' }) {
    if (!ensure() || actx.state !== 'running') return;
    const t0 = actx.currentTime + delay;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) {
      if (slideType === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    }
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise({ dur = 0.15, vol = 0.4, delay = 0, lowpass = 1200 }) {
    if (!ensure() || actx.state !== 'running') return;
    const t0 = actx.currentTime + delay;
    const len = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource();
    src.buffer = buf;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const f = actx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  const sfx = {
    jump()      { tone({ freq: 300, endFreq: 700, dur: 0.14, type: 'square', vol: 0.35 }); },
    coin()      { tone({ freq: 988, dur: 0.07, type: 'square', vol: 0.3 }); tone({ freq: 1319, dur: 0.18, type: 'square', vol: 0.3, delay: 0.07 }); },
    hit()       { noise({ dur: 0.25, vol: 0.5, lowpass: 900 }); tone({ freq: 200, endFreq: 60, dur: 0.3, type: 'sawtooth', vol: 0.4 }); },
    explode()   { noise({ dur: 0.45, vol: 0.6, lowpass: 600 }); tone({ freq: 120, endFreq: 40, dur: 0.4, type: 'sawtooth', vol: 0.35 }); },
    shoot()     { tone({ freq: 880, endFreq: 220, dur: 0.08, type: 'square', vol: 0.22 }); },
    laser()     { tone({ freq: 1400, endFreq: 300, dur: 0.12, type: 'sawtooth', vol: 0.2 }); },
    powerup()   { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.09, type: 'square', vol: 0.28, delay: i * 0.06 })); },
    select()    { tone({ freq: 660, dur: 0.05, type: 'square', vol: 0.25 }); },
    confirm()   { tone({ freq: 523, dur: 0.06, type: 'square', vol: 0.3 }); tone({ freq: 1047, dur: 0.12, type: 'square', vol: 0.3, delay: 0.06 }); },
    gameover()  { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.35, delay: i * 0.18 })); },
    levelup()   { [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'square', vol: 0.3, delay: i * 0.09 })); },
    engineTick(){ tone({ freq: 90 + Math.random()*30, dur: 0.04, type: 'sawtooth', vol: 0.05 }); },
    drift()     { noise({ dur: 0.12, vol: 0.12, lowpass: 2400 }); },
    eat()       { tone({ freq: 500, endFreq: 900, dur: 0.07, type: 'square', vol: 0.25 }); },
    die()       { [440, 350, 260, 180, 120].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'sawtooth', vol: 0.3, delay: i * 0.08 })); },
    sword()     { noise({ dur: 0.12, vol: 0.3, lowpass: 4000 }); tone({ freq: 700, endFreq: 250, dur: 0.1, type: 'sawtooth', vol: 0.18 }); },
    heal()      { tone({ freq: 659, dur: 0.1, type: 'triangle', vol: 0.35 }); tone({ freq: 988, dur: 0.16, type: 'triangle', vol: 0.35, delay: 0.1 }); }
  };

  // ---------- Music ----------
  // Note helper: name -> frequency
  const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nf(name) {
    const m = NOTE_RE.exec(name);
    if (!m) return 0;
    let s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const oct = parseInt(m[3], 10);
    return 440 * Math.pow(2, (s - 9) / 12 + (oct - 4));
  }

  // Song format: { loop:[lead[], bass[], drums[]], wave:'square' }
  // Each track is an array of 16th-note tokens per bar-group; token:
  //   'C4' play note | '--' rest | 'xx' hold(no retrig)
  const SONGS = {
    menu: {
      tempo: 112,
      bars: 2,
      lead: [
        'E5 -- G5 -- A5 -- B5 -- A5 -- G5 -- E5 -- D5 -- E5 ----',
        'E5 -- G5 -- A5 -- C6 -- B5 -- A5 -- G5 -- E5 -- D5 ----'
      ],
      bass: [
        'C3 ---- C3 ---- G2 ---- G2 ---- A2 ---- A2 ---- B2 ---- B2 ----',
        'C3 ---- C3 ---- G2 ---- G2 ---- F2 ---- F2 ---- G2 ---- G2 ----'
      ],
      drums: [
        'K h K h S h K h K h S h K h S h',
        'K h K h S h K h K h S h K S K S'
      ]
    },
    runner: {
      tempo: 150,
      bars: 2,
      lead: [
        'A4 C5 E5 A5 G5 E5 C5 E5 A4 C5 E5 A5 B5 A5 G5 E5',
        'F4 A4 C5 F5 E5 C5 A4 C5 G4 B4 D5 G5 F5 D5 B4 G4'
      ],
      bass: [
        'A2 A2 A3 A2 A2 A3 A2 A3 F2 F2 F3 F2 F2 F3 F2 F3',
        'F2 F2 F3 F2 F2 F3 F2 F3 G2 G2 G3 G2 G2 G3 G2 G3'
      ],
      drums: [
        'K h S h K h S hh K h S h K hh S h',
        'K h S h K h S hh K h S h K S K S'
      ]
    },
    jumper: {
      tempo: 132,
      bars: 2,
      lead: [
        'G4 -- B4 D5 G5 -- D5 B4 C5 -- E5 G5 C6 -- G5 E5',
        'D5 -- B4 G4 D5 -- G4 B4 C5 -- A4 E4 C5 -- E4 A4'
      ],
      bass: [
        'G2 -- G3 -- G2 -- G3 -- C3 -- C4 -- C3 -- C4 --',
        'D3 -- D4 -- D3 -- D4 -- G2 -- G3 -- G2 B2 D3 F3'
      ],
      drums: [
        'K h K h S h K h K h K h S h K h',
        'K h K h S h K h K h S h S hh S h'
      ]
    },
    shooter: {
      tempo: 160,
      bars: 2,
      lead: [
        'A4 A4 -- E5 A5 -- G5 E5 D5 -- E5 -- C5 -- A4 --',
        'A4 A4 -- E5 A5 -- C6 B5 A5 -- G5 -- E5 -- D5 --'
      ],
      bass: [
        'A2 A2 A2 A2 A2 A2 A2 A2 F2 F2 F2 F2 F2 F2 F2 F2',
        'G2 G2 G2 G2 G2 G2 G2 G2 E2 E2 E2 E2 E2 E2 E2 E2'
      ],
      drums: [
        'KhhShhKhhShhKhKh',
        'KhhShhKhhSShSKhS'
      ]
    },
    racing: {
      tempo: 148,
      bars: 2,
      lead: [
        'E5 D5 E5 G5 E5 D5 B4 D5 E5 D5 E5 A5 G5 E5 D5 B4',
        'C5 B4 C5 E5 C5 B4 G4 B4 D5 C5 D5 F5 E5 D5 B4 G4'
      ],
      bass: [
        'E2 E3 E2 E3 E2 E3 E2 E3 C3 C4 C3 C4 C3 C4 C3 C4',
        'A2 A3 A2 A3 A2 A3 A2 A3 B2 B3 B2 B3 B2 B3 B2 B3'
      ],
      drums: [
        'KhhSKhhSKhhSKhhS',
        'KhhSKhhSKhhSShKS'
      ]
    },
    rpg: {
      tempo: 100,
      bars: 2,
      lead: [
        'D4 -- F4 -- A4 -- G4 F4 E4 -- G4 -- C5 -- A4 --',
        'D4 -- F4 -- A4 -- D5 C5 A4 -- G4 -- F4 -- E4 --'
      ],
      bass: [
        'D2 D3 A2 D3 C3 C4 G2 C3 B2 B3 F2 B2 A2 A3 E2 A2',
        'D2 D3 A2 D3 C3 C4 G2 C3 F2 F3 C3 F2 A2 A3 E2 A2'
      ],
      drums: [
        'K h h h S h h h K h h h S h h h',
        'K h h h S h K h K h h h S h S h'
      ]
    },
    worm: {
      tempo: 128,
      bars: 2,
      lead: [
        'C5 D#5 F5 G5 F5 D#5 C5 -- A#4 C5 D#5 F5 D#5 C5 A#4 --',
        'C5 D#5 G5 A#5 G5 D#5 C5 -- D#5 F5 G5 F5 D#5 C5 D#5 --'
      ],
      bass: [
        'C2 C3 C2 C3 G#1 G#2 G#1 G#2 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2',
        'C2 C3 C2 C3 G#1 G#2 G#1 G#2 G#1 G#2 G#1 G#2 A#1 A#2 A#1 A#2'
      ],
      drums: [
        'KhKhhhKhShhhKhSh',
        'KhKhhhKhShhhShKS'
      ]
    },
    blockfall: {
      tempo: 120,
      bars: 2,
      lead: [
        'E5 -- B4 -- C5 -- A4 -- E4 -- A4 B4 C5 -- D5 -- E5 --',
        'E5 -- B4 -- C5 -- A4 -- C4 -- E4 G4 B4 -- A4 -- G#4 --'
      ],
      bass: [
        'A2 -- A2 A2 E2 -- E2 E2 F2 -- F2 F2 G2 -- G2 G2',
        'A2 -- A2 A2 E2 -- E2 E2 D2 -- D2 D2 E2 -- E2 E2'
      ],
      drums: [
        'K h K h S h K h K h K h S h K h',
        'K h K h S h K h K h S h S hh S h'
      ]
    },
    brickbreak: {
      tempo: 138,
      bars: 2,
      lead: [
        'C5 E5 G5 E5 C5 E5 G5 E5 D5 F5 A5 F5 D5 F5 A5 F5',
        'B4 D5 G5 D5 B4 D5 G5 D5 C5 E5 G5 C6 B5 G5 D5 B4'
      ],
      bass: [
        'C3 C3 G2 G2 C3 C3 G2 G2 A2 A2 E2 E2 F2 F2 G2 G2',
        'G2 G2 D3 D3 G2 G2 D3 D3 C3 C3 G2 G2 G2 G2 G2 G2'
      ],
      drums: [
        'KhhSKhhKKhhSKhKS',
        'KhhSKhhKKhhSShKS'
      ]
    },
    stackup: {
      tempo: 134,
      bars: 2,
      lead: [
        'C5 -- C5 D5 E5 -- G5 -- E5 -- C5 -- D5 E5 D5 --',
        'E5 -- E5 F5 G5 -- C6 -- G5 -- E5 -- F5 G5 F5 --'
      ],
      bass: [
        'C3 -- C3 -- G2 -- G2 -- A2 -- A2 -- F2 -- G2 --',
        'A2 -- A2 -- E2 -- E2 -- F2 -- F2 -- G2 -- G2 --'
      ],
      drums: [
        'KhShKhhSKhShKhhS',
        'KhShKhhSKhSSKhKS'
      ]
    },
    snake: {
      tempo: 118,
      bars: 2,
      lead: [
        'E4 G4 A4 -- C5 -- A4 G4 E4 G4 A4 -- B4 -- A4 G4',
        'D4 F4 G4 -- B4 -- G4 F4 D4 F4 G4 -- A4 -- G4 F4'
      ],
      bass: [
        'A2 A2 E3 E3 F2 F2 C3 C3 G2 G2 D3 D3 E2 E2 B2 B2',
        'F2 F2 C3 C3 G2 G2 D3 D3 A2 A2 E3 E3 B2 B2 E2 E2'
      ],
      drums: [
        'K h K h S h K h K h S h K h S h',
        'K h K h S h K h S h S h K h S h'
      ]
    },
    pong: {
      tempo: 128,
      bars: 2,
      lead: [
        'A4 -- E5 -- A4 C5 E5 -- D5 -- F5 -- D5 F5 A5 --',
        'G4 -- D5 -- G4 B4 D5 -- C5 -- E5 -- C5 E5 G5 --'
      ],
      bass: [
        'A2 A2 A3 A2 F2 F2 F3 F2 G2 G2 G3 G2 E2 E2 E3 E2',
        'C3 C3 C4 C3 G2 G2 G3 G2 D3 D3 D4 D3 E2 E2 E3 E2'
      ],
      drums: [
        'KhSKhhhSKhSKhhhS',
        'KhSKhhhSKhSShKKS'
      ]
    },
    flappy: {
      tempo: 126,
      bars: 2,
      lead: [
        'G5 -- E5 -- C5 -- E5 -- G5 -- A5 -- G5 E5 D5 -- C5 --',
        'E5 -- C5 -- G4 -- C5 -- F5 -- G5 -- F5 D5 E5 -- C5 --'
      ],
      bass: [
        'C3 -- C3 C3 G2 -- G2 G2 A2 -- A2 A2 F2 -- G2 G2',
        'A2 -- A2 A2 E2 -- E2 E2 F2 -- F2 F2 G2 -- G2 G2'
      ],
      drums: [
        'KhShhKhSKhShhKhS',
        'KhShhKhSKhSShSKS'
      ]
    }
  };

  function parseTrack(arr, bars, isDrum) {
    // flatten to array of tokens length = bars*16
    const out = [];
    for (const line of arr) {
      if (isDrum && !line.includes(' ')) {
        // drum lines may be written without spaces ('KhShSKh...'); one char = one step
        out.push(...line.trim().replace(/hh/g, 'h h').split(''));
      } else {
        out.push(...line.trim().split(/\s+/));
      }
    }
    while (out.length < bars * 16) out.push(isDrum ? '.' : '--');
    return out.slice(0, bars * 16);
  }

  function scheduleNote(token, time, wave, isDrum) {
    if (isDrum) {
      if (token === 'K') {
        tone({ freq: 150, endFreq: 40, dur: 0.12, type: 'sine', vol: 0.5 });
        // route via music gain: quick hack — use dedicated fn
      } else if (token === 'S') {
        noiseM(time, 0.09, 0.25, 1800);
      } else if (token === 'h') {
        noiseM(time, 0.03, 0.08, 6000);
      }
      return;
    }
    if (token === '--' || token === 'xx') return;
    const f = nf(token);
    if (!f) return;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = wave || 'square';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.16, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + STEP_DUR() * 0.92);
    osc.connect(g); g.connect(musicGain);
    osc.start(time); osc.stop(time + STEP_DUR());
  }
  function noiseM(time, dur, vol, lp) {
    const len = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource();
    src.buffer = buf;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    const f = actx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lp;
    src.connect(f); f.connect(g); g.connect(musicGain);
    src.start(time);
  }
  function kickM(time) {
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    g.gain.setValueAtTime(0.55, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    osc.connect(g); g.connect(musicGain);
    osc.start(time); osc.stop(time + 0.14);
  }

  function startSequencer() {
    stopSequencer();
    nextTime = actx.currentTime + 0.05;
    step = 0;
    seqTimer = setInterval(() => {
      while (nextTime < actx.currentTime + 0.12) {
        const total = curSong.bars * 16;
        const s = step % total;
        const bar = Math.floor(s / 16);
        const idx = s % 16;
        const lt = parseCache.lead[s];
        const bt = parseCache.bass[s];
        const dt = parseCache.drums[s];
        if (lt) scheduleNote(lt, nextTime, 'square', false);
        if (bt) scheduleNote(bt, nextTime, 'triangle', false);
        if (dt === 'K') kickM(nextTime);
        else if (dt === 'S') noiseM(nextTime, 0.09, 0.22, 1800);
        else if (dt === 'h') noiseM(nextTime, 0.03, 0.07, 6500);
        void bar; void idx;
        nextTime += STEP_DUR();
        step++;
      }
    }, 40);
  }
  function stopSequencer() {
    if (seqTimer) clearInterval(seqTimer);
    seqTimer = null;
  }

  let parseCache = null;
  function playBGM(name) {
    if (!ensure()) return;
    const song = SONGS[name];
    if (!song) return;
    if (curSong === song && seqTimer) return;   // already playing
    stopBGM();
    TEMPO_CUR = song.tempo || 140;
    parseCache = {
      lead: parseTrack(song.lead, song.bars, false),
      bass: parseTrack(song.bass, song.bars, false),
      drums: parseTrack(song.drums, song.bars, true)
    };
    curSong = song;
    if (actx.state === 'running') startSequencer();
  }
  function stopBGM() {
    stopSequencer();
    curSong = null;
    parseCache = null;
  }

  function STEP_DUR() { return 60 / TEMPO_CUR / 4; }

  function setMusicVol(v) { if (musicGain) musicGain.gain.value = v; }
  function setSfxVol(v) { if (sfxGain) sfxGain.gain.value = v; }

  return { unlock, sfx, playBGM, stopBGM, setMusicVol, setSfxVol };
})();
