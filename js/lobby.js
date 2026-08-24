// ============================================================
// Retro Arcade — lobby (game select screen)
// ============================================================
'use strict';

const GAMES = [
  { id: 'runner',  title: 'NEON RUNNER',   desc: '원탭 질주 · 가시 피하기',      mod: 'runner',  hue: '#00eaff', icon: '▶' },
  { id: 'jumper',  title: 'SKY HOPPER',    desc: '구름 밟고 무한 상승',          mod: 'jumper',  hue: '#ffd166', icon: '▲' },
  { id: 'shooter', title: 'GALAXY RAIDERS', desc: '침입자 격파 · 웨이브 슈팅',   mod: 'shooter', hue: '#7dff8a', icon: '✦' },
  { id: 'racing',  title: 'TURBO RUSH',    desc: '3랩 타임 어택 레이스',         mod: 'racing',  hue: '#ff8844', icon: '◈' },
  { id: 'rpg',     title: 'DUNGEON DEPTHS', desc: '5층 던전 액션 RPG',           mod: 'rpg',     hue: '#b967ff', icon: '⚔' },
  { id: 'worm',    title: 'WORM.IO',       desc: '지렁이 키우기 · 봇전',         mod: 'worm',    hue: '#ff66d9', icon: '~' },
  { id: 'blockfall', title: 'BLOCK FALL',  desc: '고전 블록 퍼즐 · 줄 지우기',   mod: 'blockfall', hue: '#4d79ff', icon: '▦' },
  { id: 'brickbreak', title: 'BRICK BREAK', desc: '벽돌깨기 · 아이템 콤보',      mod: 'brickbreak', hue: '#ff3355', icon: '▬' },
  { id: 'flappy',   title: 'FLAPPY WING',  desc: '원탭 플래피 · 파이프 통과',    mod: 'flappy',   hue: '#ffe066', icon: '🐦' },
  { id: 'stackup',  title: 'STACK UP',     desc: '타워 쌓기 · PERFECT 콤보',     mod: 'stackup',  hue: '#b967ff', icon: '▤' },
  { id: 'snake',    title: 'SNAKE CLASSIC', desc: '그리드 스네이크 · 성장',      mod: 'snake',    hue: '#7dff8a', icon: '⌗' },
  { id: 'pong',     title: 'PONG DUEL',    desc: 'AI 패들 대전 · 7점 선승',      mod: 'pong',     hue: '#00eaff', icon: '◉' }
];

function refreshLobby() {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = '';
  const scores = (() => {
    try { return JSON.parse(localStorage.getItem('ra_scores_v1')) || {}; } catch { return {}; }
  })();
  for (const gdef of GAMES) {
    const card = document.createElement('button');
    card.className = 'card';
    card.style.setProperty('--hue', gdef.hue);
    const bestScore = scores[gdef.id] ? scores[gdef.id].best : 0;

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    icon.textContent = gdef.icon;

    const info = document.createElement('div');
    info.className = 'card-info';
    const t = document.createElement('div');
    t.className = 'card-title';
    t.textContent = gdef.title;
    const d = document.createElement('div');
    d.className = 'card-desc';
    d.textContent = gdef.desc;
    const b = document.createElement('div');
    b.className = 'card-best';
    b.textContent = 'BEST ' + RA.fmt(bestScore);
    info.append(t, d, b);

    card.append(icon, info);
    card.addEventListener('click', () => {
      RA.audio.sfx.confirm();
      launch(gdef);
    });
    grid.appendChild(card);
  }
}

function launch(gdef) {
  const mod = RA.games[gdef.mod];
  if (!mod) {
    console.error('missing game module', gdef.mod);
    return;
  }
  RA.start(mod);
}

// boot
document.addEventListener('DOMContentLoaded', () => {
  refreshLobby();

  // ?auto=<gameId> — launch straight into gameplay (recording/demo mode)
  const autoId = new URLSearchParams(location.search).get('auto');
  if (autoId) {
    const def = GAMES.find(g => g.id === autoId || g.mod === autoId);
    if (def) {
      setTimeout(() => {
        launch(def);
        RA.hideOverlay();
        const mod = RA.games[def.mod];
        mod.onStart && mod.onStart();
      }, 350);
    }
  }
});
