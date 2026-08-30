// ============================================================
// Retro Arcade — meta layer v1.3
// coins (score → currency) · daily missions · skin shop
// All state in localStorage, zero dependencies.
// ============================================================
'use strict';

RA.meta = (() => {
  const SKEY = 'ra_meta_v1';
  const DAY_MS = 24 * 60 * 60 * 1000;

  // coin rate: score → coins. Different games award at different rates so
  // long-session games don't dominate.
  const COIN_RATE = {
    runner: 0.05, jumper: 0.05, shooter: 0.04, racing: 0.06,
    rpg: 0.08, worm: 0.03, blockfall: 0.10, brickbreak: 0.08,
    flappy: 0.15, stackup: 0.12, snake: 0.08, pong: 0.20, mergedrop: 0.10,
    minesweeper: 0.10, dodge: 0.06,
    cave: 0.08, lander: 0.12, astro: 0.05,
    memory: 0.15, mole: 0.20, ghostmaze: 0.08,
    slot: 0.05, arrowrain: 0.10, bounce: 0.08,
    hexmatch: 0.12, chess: 0.06
  };
  // minimum score worth converting (anti-farm: exit on title screen = 0)
  const MIN_SCORE = 50;

  const SKINS = [
    { id: 'classic', name: 'CLASSIC NEON', cost: 0, bg: '#0a0018', neon: '#00eaff', pink: '#ff66d9', grid: 'rgba(120,110,220,.14)' },
    { id: 'sunset', name: 'SUNSET DRIVE', cost: 300, bg: '#1a0620', neon: '#ff8844', pink: '#ffe066', grid: 'rgba(255,136,68,.14)' },
    { id: 'matrix', name: 'GREEN MATRIX', cost: 500, bg: '#001408', neon: '#39ff14', pink: '#00eaff', grid: 'rgba(57,255,20,.13)' },
    { id: 'bubblegum', name: 'BUBBLEGUM', cost: 800, bg: '#16041f', neon: '#ff66d9', pink: '#7dff8a', grid: 'rgba(255,102,217,.14)' },
    { id: 'gold', name: 'ARCADE GOLD', cost: 1500, bg: '#141002', neon: '#ffd166', pink: '#fff', grid: 'rgba(255,209,102,.14)' }
  ];

  // daily missions — deterministic per calendar day via seeded shuffle
  const MISSION_POOL = [
    { id: 'play3', desc: '게임 3종 플레이', goal: 3, reward: 30, stat: 'plays' },
    { id: 'merge25', desc: '머지 25회 (MERGE DROP)', goal: 25, reward: 40, stat: 'merge_count' },
    { id: 'score1000', desc: '한 판 1000점 이상', goal: 1, reward: 50, stat: 'big_score' },
    { id: 'flap10', desc: 'FLAPPY WING 10판', goal: 10, reward: 35, stat: 'game_flappy' },
    { id: 'brick5', desc: 'BRICK BREAK 5판', goal: 5, reward: 35, stat: 'game_brickbreak' },
    { id: 'coins150', desc: '코인 150 획득', goal: 150, reward: 45, stat: 'coins_earned' }
  ];

  // achievements — permanent, one-time unlocks with coin rewards
  const ACHIEVEMENTS = [
    { id: 'firstblood', name: 'FIRST BLOOD',   desc: '첫 게임 플레이',            reward: 20,  test: s => (s.lifetimePlays || 0) >= 1 },
    { id: 'veteran',    name: 'VETERAN',       desc: '누적 50판 플레이',          reward: 100, test: s => (s.lifetimePlays || 0) >= 50 },
    { id: 'allrounder', name: 'ALL-ROUNDER',   desc: '전체 게임 21종 이상 플레이', reward: 150, test: s => Object.keys(s.stats || {}).filter(k => k.startsWith('game_')).length >= 21 },
    { id: 'rich',       name: 'HIGH ROLLER',   desc: '코인 누적 1000 획득',        reward: 80,  test: s => (s.totalEarned || 0) >= 1000 },
    { id: 'fashionista',name: 'FASHIONISTA',   desc: '스킨 3종 이상 보유',         reward: 60,  test: s => (s.owned || []).length >= 3 },
    { id: 'missionary', name: 'MISSIONARY',    desc: '일일 미션 10회 달성',        reward: 90,  test: s => (s.missionsDone || 0) >= 10 },
    { id: 'bigspender', name: 'BIG SPENDER',   desc: '누적 코인 소모 800 이상',    reward: 70,  test: s => (s.spent || 0) >= 800 }
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function pickMissions(dayKey) {
    const seed = seedFrom(dayKey);
    const idx = MISSION_POOL.map((_, i) => i);
    // Fisher-Yates with seeded rng — same 3 missions for everyone all day
    let s = seed;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = idx.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, 3).map(i => ({ ...MISSION_POOL[i], progress: 0, claimed: false }));
  }

  function fresh() {
    const dayKey = todayKey();
    return {
      coins: 0,
      totalEarned: 0,
      skin: 'classic',
      owned: ['classic'],
      dayKey,
      missions: pickMissions(dayKey),
      stats: {},
      lifetimePlays: 0,
      missionsDone: 0,
      spent: 0,
      boosts: {},
      coinBoostUsed: 0,
      achievements: []
    };
  }

  let state;
  try { state = JSON.parse(localStorage.getItem(SKEY)) || fresh(); } catch { state = fresh(); }
  if (!state || state.dayKey !== todayKey()) {
    const carry = state ? { coins: state.coins, totalEarned: state.totalEarned, skin: state.skin, owned: state.owned } : null;
    state = fresh();
    if (carry) Object.assign(state, carry);
  }

  let dirty = false;
  function save() {
    if (!dirty) return;
    try { localStorage.setItem(SKEY, JSON.stringify(state)); } catch {}
    dirty = false;
  }
  scheduleSave();

  function scheduleSave() {
    if (scheduleSave._t) clearTimeout(scheduleSave._t);
    scheduleSave._t = setTimeout(() => { save(); }, 400);
  }

  // ---------- public API ----------
  function coins() { return state.coins; }
  function currentSkin() { return SKINS.find(s => s.id === state.skin) || SKINS[0]; }
  function skinList() { return SKINS; }
  function isOwned(id) { return state.owned.includes(id); }

  function buySkin(id) {
    const sk = SKINS.find(s => s.id === id);
    if (!sk || isOwned(id) || state.coins < sk.cost) return false;
    state.coins -= sk.cost;
    state.spent = (state.spent || 0) + sk.cost;
    state.owned.push(id);
    state.skin = id;
    applySkinCSS();
    dirty = true;
    scheduleSave();
    checkAchievements();
    RA.audio.sfx.confirm();
    return true;
  }
  function selectSkin(id) {
    if (!isOwned(id)) return false;
    state.skin = id;
    applySkinCSS();
    dirty = true;
    scheduleSave();
    RA.audio.sfx.select();
    return true;
  }

  function applySkinCSS() {
    const sk = currentSkin();
    const r = document.documentElement.style;
    r.setProperty('--bg', sk.bg);
    r.setProperty('--neon', sk.neon);
    r.setProperty('--pink', sk.pink);
  }

  // ---------- mission/stat tracking ----------
  // Called from games/core: event('merge_count', n), etc.
  function event(stat, n) {
    state.stats[stat] = (state.stats[stat] || 0) + n;
    for (const m of state.missions) {
      if (!m.claimed && m.stat === stat && m.progress < m.goal) {
        m.progress = Math.min(m.goal, m.progress + n);
        if (m.progress >= m.goal) {
          RA.audio.sfx.powerup();
          if (RA.floatText && RA.isOverlayOpen && !RA.isOverlayOpen()) {
            RA.floatText(RA.VW / 2, RA.VH * 0.2, `MISSION COMPLETE +${m.reward}¢`, '#7dff8a');
          }
        }
      }
    }
    dirty = true;
    scheduleSave();
  }

  function claimMission(idx) {
    const m = state.missions[idx];
    if (!m || m.claimed || m.progress < m.goal) return false;
    m.claimed = true;
    state.missionsDone = (state.missionsDone || 0) + 1;
    addCoins(m.reward);
    checkAchievements();
    RA.audio.sfx.levelup();
    dirty = true;
    scheduleSave();
    return true;
  }

  function addCoins(n) {
    state.coins += n;
    state.totalEarned += n;
    event('coins_earned', n);
  }

  // called by core.submitScore when a game session ends
  function onGameEnd(gameId, score) {
    const rate = COIN_RATE[gameId] ?? 0.05;
    let earned = 0;
    if (score >= MIN_SCORE) earned = Math.max(1, Math.floor(score * rate));
    // COIN x2 boost auto-consumes when a session earns coins
    if (earned > 0 && consumeBoost('coinx2')) {
      earned *= 2;
      state.coinBoostUsed = (state.coinBoostUsed || 0) + 1;
      event('boost_used', 1);
    }
    state.lifetimePlays++;
    event('plays', 1);
    event(`game_${gameId}`, 1);
    if (score >= 1000) event('big_score', 1);
    if (earned > 0) addCoins(earned);
    checkAchievements();
    dirty = true;
    scheduleSave();
    return earned;
  }

  // ---------- boost items (consumables, bought with coins) ----------
  const BOOSTS = [
    { id: 'coinx2',   name: 'COIN x2',     desc: '다음 게임 코인 2배',      cost: 60 },
    { id: 'shield',   name: 'SHIELD',      desc: 'DODGE 시작 시 실드 3회', cost: 80 },
    { id: 'magnet',   name: 'HEADSTART',   desc: '다음 게임 초반 부스트',   cost: 50 }
  ];

  function buyBoost(id) {
    const b = BOOSTS.find(x => x.id === id);
    if (!b || state.coins < b.cost) return false;
    state.coins -= b.cost;
    state.spent = (state.spent || 0) + b.cost;
    state.boosts = state.boosts || {};
    state.boosts[id] = (state.boosts[id] || 0) + 1;
    dirty = true;
    scheduleSave();
    checkAchievements();
    RA.audio.sfx.confirm();
    return true;
  }
  // returns & decrements count if the player owns one (used by games/core)
  function consumeBoost(id) {
    state.boosts = state.boosts || {};
    if (!state.boosts[id]) return false;
    state.boosts[id]--;
    dirty = true;
    scheduleSave();
    return true;
  }
  function boostCount(id) { return (state.boosts && state.boosts[id]) || 0; }
  function boostList() { return BOOSTS; }

  // ---------- achievements ----------
  function checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (!state.achievements.includes(a.id) && a.test(state)) {
        state.achievements.push(a.id);
        state.coins += a.reward;
        state.totalEarned += a.reward;
        RA.audio.sfx.powerup();
        if (RA.floatText && RA.isOverlayOpen && !RA.isOverlayOpen()) {
          RA.floatText(RA.VW / 2, RA.VH * 0.16, `🏆 ${a.name} +${a.reward}¢`, '#ffd166');
        }
        dirty = true;
      }
    }
    scheduleSave();
  }

  function achievementList() { return ACHIEVEMENTS; }
  function isUnlocked(id) { return state.achievements.includes(id); }

  function missionsToday() {
    if (state.dayKey !== todayKey()) {
      const carry = { coins: state.coins, totalEarned: state.totalEarned, skin: state.skin, owned: state.owned, lifetimePlays: state.lifetimePlays };
      state = fresh();
      Object.assign(state, carry);
      dirty = true;
      scheduleSave();
    }
    return state.missions;
  }

  function debugState() { return JSON.parse(JSON.stringify(state)); }

  return {
    coins, addCoins, onGameEnd, event, missionsToday, claimMission,
    skinList, currentSkin, isOwned, buySkin, selectSkin, applySkinCSS,
    achievementList, isUnlocked,
    boostList, buyBoost, consumeBoost, boostCount,
    debugState
  };
})();
