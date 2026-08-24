// ============================================================
// Retro Arcade — lobby (game select + meta panels)
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
  { id: 'pong',     title: 'PONG DUEL',    desc: 'AI 패들 대전 · 7점 선승',      mod: 'pong',     hue: '#00eaff', icon: '◉' },
  { id: 'mergedrop', title: 'MERGE DROP',  desc: '숫자 드롭 머지 · 연쇄 콤보',   mod: 'mergedrop', hue: '#39ff14', icon: '⬢' },
  { id: 'minesweeper', title: 'MINESWEEPER', desc: '지뢰찾기 · 안전 칸 개봉',    mod: 'minesweeper', hue: '#9aa7ff', icon: '💣' },
  { id: 'dodge',    title: 'DODGE ROYALE', desc: '탄막 생존 · 그레이즈 보너스',  mod: 'dodge',    hue: '#ff66d9', icon: '✺' }
];

function coinBadge() {
  return document.getElementById('coin-count');
}

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

  if (RA.meta) {
    if (coinBadge()) coinBadge().textContent = RA.meta.coins() + '¢';
    renderMissions();
    renderShop();
    renderAchievements();
  }
}

// ---------- daily missions panel ----------
function renderMissions() {
  const wrap = document.getElementById('mission-list');
  if (!wrap) return;
  wrap.innerHTML = '';
  const missions = RA.meta.missionsToday();
  missions.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'mission-row' + (m.progress >= m.goal ? ' done' : '');
    const label = document.createElement('div');
    label.className = 'mission-label';
    label.textContent = m.desc;
    const barWrap = document.createElement('div');
    barWrap.className = 'mission-bar';
    const fill = document.createElement('div');
    fill.className = 'mission-fill';
    fill.style.width = Math.min(100, (m.progress / m.goal) * 100) + '%';
    barWrap.appendChild(fill);
    const right = document.createElement('div');
    right.className = 'mission-right';
    if (m.claimed) {
      right.textContent = '✔ ' + m.reward + '¢';
      right.classList.add('claimed');
    } else if (m.progress >= m.goal) {
      const btn = document.createElement('button');
      btn.className = 'claim-btn';
      btn.textContent = `+${m.reward}¢`;
      btn.addEventListener('click', () => {
        RA.meta.claimMission(i);
        refreshLobby();
      });
      right.appendChild(btn);
    } else {
      right.textContent = `${m.progress}/${m.goal}`;
    }
    row.append(label, barWrap, right);
    wrap.appendChild(row);
  });
}

// ---------- skin shop panel ----------
function renderShop() {
  const wrap = document.getElementById('shop-grid');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const sk of RA.meta.skinList()) {
    const owned = RA.meta.isOwned(sk.id);
    const active = RA.meta.currentSkin().id === sk.id;
    const item = document.createElement('button');
    item.className = 'skin-item' + (active ? ' active' : '');
    item.style.setProperty('--sk-neon', sk.neon);
    item.style.setProperty('--sk-bg', sk.bg);
    const swatch = document.createElement('div');
    swatch.className = 'skin-swatch';
    const name = document.createElement('div');
    name.className = 'skin-name';
    name.textContent = sk.name;
    const price = document.createElement('div');
    price.className = 'skin-price';
    price.textContent = active ? 'EQUIPPED' : owned ? 'TAP TO EQUIP' : `${sk.cost}¢`;
    item.append(swatch, name, price);
    item.addEventListener('click', () => {
      if (active) return;
      if (owned) RA.meta.selectSkin(sk.id);
      else if (!RA.meta.buySkin(sk.id)) RA.audio.sfx.hit();
      refreshLobby();
    });
    wrap.appendChild(item);
  }
}

// ---------- achievements panel ----------
function renderAchievements() {
  const wrap = document.getElementById('ach-list');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const a of RA.meta.achievementList()) {
    const unlocked = RA.meta.isUnlocked(a.id);
    const row = document.createElement('div');
    row.className = 'ach-row' + (unlocked ? ' done' : '');
    const trophy = document.createElement('div');
    trophy.className = 'ach-trophy';
    trophy.textContent = unlocked ? '🏆' : '🔒';
    const mid = document.createElement('div');
    mid.className = 'ach-mid';
    const name = document.createElement('div');
    name.className = 'ach-name';
    name.textContent = a.name;
    const desc = document.createElement('div');
    desc.className = 'ach-desc';
    desc.textContent = a.desc;
    mid.append(name, desc);
    const right = document.createElement('div');
    right.className = 'ach-right';
    right.textContent = unlocked ? '+' + a.reward + '¢' : a.reward + '¢';
    row.append(trophy, mid, right);
    wrap.appendChild(row);
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
  if (RA.meta && RA.meta.applySkinCSS) RA.meta.applySkinCSS();
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
