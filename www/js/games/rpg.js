// ============================================================
// Game 5 — DUNGEON DEPTHS (lightweight action roguelite RPG)
// Drag to move, auto-attack nearest enemy. Descend floors,
// level up, choose upgrades, beat floor bosses.
// ============================================================
'use strict';

RA.games = RA.games || {};

RA.games.rpg = (() => {
  const { input, burst, floatText, shake } = RA;
  const { sfx } = RA.audio;
  const VW = RA.VW, VH = RA.VH;
  const TILE = 40;
  const MAP_W = 12, MAP_H = 15;   // world = 480x600

  let player, enemies, drops, fxTimer, camShake;
  let floorNum, kills, state, stateT; // state: play | levelup | dead | floorclear
  let upgradeChoices, dungeon, entrance;
  let atkCd = 0, hurtCd = 0;

  // ---------- dungeon gen ----------
  function genFloor() {
    // rooms: simple — carve random rectangles + connect
    const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
    const rooms = [];
    const tries = 7 + Math.floor(Math.random() * 3);
    for (let i = 0; i < tries && rooms.length < 4; i++) {
      const w = 4 + Math.floor(Math.random() * 4);
      const h = 4 + Math.floor(Math.random() * 4);
      const x = Math.floor(Math.random() * (MAP_W - w - 1)) + 1;
      const y = Math.floor(Math.random() * (MAP_H - h - 1)) + 1;
      const r = { x, y, w, h };
      if (rooms.length === 0 || true) {
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x; xx < x + w; xx++) map[yy][xx] = 0;
        if (rooms.length > 0) {
          // corridor from prev room center
          const p = rooms[rooms.length - 1];
          const cx1 = Math.floor(p.x + p.w / 2), cy1 = Math.floor(p.y + p.h / 2);
          const cx2 = Math.floor(x + w / 2), cy2 = Math.floor(y + h / 2);
          for (let xx = Math.min(cx1, cx2); xx <= Math.max(cx1, cx2); xx++) { map[cy1][xx] = 0; map[Math.min(MAP_H - 2, cy1 + 1)][xx] = 0; }
          for (let yy = Math.min(cy1, cy2); yy <= Math.max(cy1, cy2); yy++) { map[yy][cx2] = 0; }
        }
        rooms.push(r);
      }
    }
    return { map, rooms };
  }

  function roomCenter(r) { return { x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE }; }

  function isWall(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    return dungeon.map[ty][tx] === 1;
  }

  function freeSpotInRoom(r) {
    for (let t = 0; t < 40; t++) {
      const x = (r.x + 0.5 + Math.random() * (r.w - 1)) * TILE;
      const y = (r.y + 0.5 + Math.random() * (r.h - 1)) * TILE;
      if (!isWall(x, y)) return { x, y };
    }
    return roomCenter(r);
  }

  // ---------- setup ----------
  function init() {
    RA.setHUD('DUNGEON DEPTHS', 'rpg');
    resetRun();
    RA.showOverlay({
      title: 'DUNGEON DEPTHS',
      sub: 'DRAG TO MOVE · AUTO ATTACK',
      lines: ['몬스터를 처치하고 층을 내려가자', '레벨업마다 강화 선택', '5층의 보스를 잡으면 클리어!'],
      tapStart: true
    });
    RA.audio.playBGM('menu');
  }

  function onStart() {
    state = 'play';
    RA.audio.playBGM('rpg');
  }

  function resetRun() {
    player = {
      x: 0, y: 0, r: 11,
      hp: 30, maxHp: 30,
      lv: 1, xp: 0, xpNext: 8,
      atk: 5, spd: 130, atkRate: 0.9, range: 90,
      critC: 0.05, critD: 1.6, regen: 0, magnet: 60
    };
    floorNum = 1; kills = 0;
    buildFloor();
    state = 'title';
  }

  function buildFloor() {
    dungeon = genFloor();
    const first = roomCenter(dungeon.rooms[0]);
    player.x = first.x; player.y = first.y;
    entrance = first;
    enemies = []; drops = [];
    const bossFloor = floorNum % 5 === 0;
    const nEnemies = 4 + Math.min(6, floorNum) + (bossFloor ? 0 : Math.floor(Math.random() * 3));
    const rooms = dungeon.rooms.slice(1);
    for (let i = 0; i < nEnemies; i++) {
      const r = rooms[i % Math.max(1, rooms.length)] ?? dungeon.rooms[0];
      const s = freeSpotInRoom(r);
      const tier = Math.min(3, 1 + Math.floor(floorNum / 3));
      const kindRoll = Math.random();
      const kind = kindRoll < 0.45 ? 'slime' : kindRoll < 0.8 ? 'bat' : 'knight';
      enemies.push(makeEnemy(kind, s.x, s.y, tier));
    }
    if (bossFloor) {
      const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];
      const s = freeSpotInRoom(lastRoom);
      enemies.push({
        kind: 'boss', x: s.x, y: s.y, r: 20,
        hp: 40 + floorNum * 14, maxHp: 40 + floorNum * 14,
        atk: 4 + Math.floor(floorNum * 1.2), spd: 55, xp: 30 + floorNum * 10,
        hitT: 0, t: Math.random() * 9, shootCd: 1.5
      });
    }
    // heal fountain chance
    if (!bossFloor && Math.random() < 0.5) {
      const r = dungeon.rooms[dungeon.rooms.length - 1];
      const s = freeSpotInRoom(r);
      drops.push({ type: 'heart', x: s.x, y: s.y });
    }
    // stairs in farthest room center
    let far = dungeon.rooms[0], fd = -1;
    for (const r of dungeon.rooms) {
      const c = roomCenter(r);
      const d = (c.x - entrance.x) ** 2 + (c.y - entrance.y) ** 2;
      if (d > fd) { fd = d; far = r; }
    }
    const sc = roomCenter(far);
    dungeon.stairs = { x: sc.x, y: sc.y, locked: enemies.some(e => e.kind !== 'boss') };
  }

  function makeEnemy(kind, x, y, tier) {
    const base = {
      slime:  { hp: 8,  atk: 3, spd: 42, xp: 4 },
      bat:    { hp: 6,  atk: 2, spd: 95, xp: 5 },
      knight: { hp: 16, atk: 5, spd: 34, xp: 9 }
    }[kind];
    const m = 1 + (tier - 1) * 0.65 + (floorNum - 1) * 0.12;
    return {
      kind, x, y, r: kind === 'knight' ? 13 : 11,
      hp: Math.round(base.hp * m), maxHp: Math.round(base.hp * m),
      atk: Math.round(base.atk * m), spd: base.spd * (1 + (floorNum - 1) * 0.03),
      xp: Math.round(base.xp * m), hitT: 0, t: Math.random() * 9, wander: Math.random() * Math.PI * 2
    };
  }

  // ---------- combat ----------
  function attackNearest(dt) {
    atkCd -= dt;
    if (atkCd > 0) return;
    let best = null, bd = player.range * player.range;
    for (const e of enemies) {
      const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    atkCd = player.atkRate;
    const crit = Math.random() < player.critC;
    const dmg = Math.round(player.atk * (crit ? player.critD : 1));
    best.hp -= dmg;
    best.hitT = 0.18;
    const ang = Math.atan2(best.y - player.y, best.x - player.x);
    slashFx(player.x + Math.cos(ang) * 26, player.y + Math.sin(ang) * 26, ang);
    sfx.sword();
    floatText(best.x, best.y - 18, (crit ? 'CRIT!' : '') + dmg, crit ? '#ff66d9' : '#fff');
    if (crit) burst(best.x, best.y, { n: 8, colors: ['#ff66d9', '#fff'], speed: 110, size: 3 });
    if (best.hp <= 0) killEnemy(best);
  }

  function killEnemy(e) {
    const idx = enemies.indexOf(e);
    if (idx >= 0) enemies.splice(idx, 1);
    kills++;
    sfx.explode();
    burst(e.x, e.y, { n: e.kind === 'boss' ? 36 : 16, colors: ['#ff3355', '#ffb347', '#fff'], speed: e.kind === 'boss' ? 240 : 150 });
    gainXp(e.xp);
    if (e.kind === 'boss') {
      shake(10, 0.5);
      drops.push({ type: 'heart', x: e.x, y: e.y });
      floatText(e.x, e.y - 30, 'BOSS DOWN!', '#ff66d9');
      dungeon.stairs.locked = false;
    } else if (Math.random() < 0.22) {
      drops.push({ type: 'heart', x: e.x, y: e.y });
    } else if (Math.random() < 0.3) {
      drops.push({ type: 'coin', x: e.x, y: e.y });
    }
  }

  function gainXp(v) {
    player.xp += v;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.lv++;
      player.xpNext = Math.round(player.xpNext * 1.35 + 3);
      openLevelUp();
    }
  }

  const UPGRADES = [
    { id: 'atk',     name: 'POWER UP',    desc: '공격력 +3',            apply: () => player.atk += 3 },
    { id: 'rate',    name: 'SWIFT BLADE', desc: '공격 속도 +20%',       apply: () => player.atkRate = Math.max(0.25, player.atkRate * 0.8) },
    { id: 'hp',      name: 'VITALITY',    desc: '최대 체력 +12 & 회복', apply: () => { player.maxHp += 12; player.hp = Math.min(player.maxHp, player.hp + 12); } },
    { id: 'spd',     name: 'BOOTS',       desc: '이동속도 +15%',        apply: () => player.spd *= 1.15 },
    { id: 'range',   name: 'LONG ARM',    desc: '공격 범위 +22%',       apply: () => player.range *= 1.22 },
    { id: 'crit',    name: 'CRIT EDGE',   desc: '치명타 확률 +12%',     apply: () => player.critC = Math.min(0.8, player.critC + 0.12) },
    { id: 'regen',   name: 'REGEN',       desc: '초당 체력 회복 +0.6',  apply: () => player.regen += 0.6 },
    { id: 'magnet',  name: 'MAGNET',      desc: '획득 반경 +50%',       apply: () => player.magnet *= 1.5 }
  ];

  function openLevelUp() {
    state = 'levelup';
    sfx.levelup();
    const pool = UPGRADES.slice();
    upgradeChoices = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      upgradeChoices.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    }
    const btns = upgradeChoices.map(u => ({
      label: `${u.name} — ${u.desc}`,
      onClick: () => {
        u.apply();
        sfx.confirm();
        state = 'play';
      }
    }));
    setTimeout(() => {
      RA.showOverlay({ title: `LEVEL ${player.lv}!`, sub: '강화를 선택하세요', buttons: btns, tapStart: false });
    }, 350);
  }

  function descend() {
    floorNum++;
    if (floorNum > 5) {
      victory();
      return;
    }
    sfx.powerup();
    buildFloor();
    floatText(player.x, player.y - 30, `FLOOR ${floorNum}`, '#ffe066');
    RA.setScore(score());
  }

  function score() {
    return kills * 25 + (floorNum - 1) * 300 + player.lv * 50 + Math.max(0, player.hp) * 5;
  }

  function gameOver() {
    state = 'dead';
    sfx.gameover();
    RA.submitScore('rpg', score());
    RA.audio.stopBGM();
    setTimeout(() => {
      RA.showOverlay({
        title: 'YOU DIED',
        sub: `FLOOR ${floorNum}   SCORE ${score()}   BEST ${RA.best('rpg')}`,
        lines: [`LV ${player.lv} · ${kills} kills`],
        buttons: [
          { label: 'RETRY', primary: true, onClick: () => { resetRun(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 700);
  }

  function victory() {
    state = 'won';
    sfx.levelup();
    const final = score() + 1000;
    RA.submitScore('rpg', final);
    setTimeout(() => {
      RA.showOverlay({
        title: 'DUNGEON CLEARED!',
        sub: `SCORE ${final}   BEST ${RA.best('rpg')}`,
        lines: [`LV ${player.lv} · ${kills} kills`],
        buttons: [
          { label: 'AGAIN', primary: true, onClick: () => { resetRun(); onStart(); } },
          { label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }
        ]
      });
    }, 700);
  }

  // ---------- update ----------
  function update(dt) {
    if (state !== 'play') return;

    hurtCd = Math.max(0, hurtCd - dt);

    // movement: drag steering
    let mvx = 0, mvy = 0;
    if (input.isDown) {
      const dx = input.x - player.x, dy = input.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > 12) { mvx = dx / d; mvy = dy / d; }
    } else {
      mvx = (input.keys['ArrowRight'] ? 1 : 0) - (input.keys['ArrowLeft'] ? 1 : 0);
      mvy = (input.keys['ArrowDown'] ? 1 : 0) - (input.keys['ArrowUp'] ? 1 : 0);
      const d = Math.hypot(mvx, mvy);
      if (d > 0) { mvx /= d; mvy /= d; }
    }
    const nx = player.x + mvx * player.spd * dt;
    const ny = player.y + mvy * player.spd * dt;
    // axis-separated wall collision with radius
    if (!isWall(nx - player.r, player.y - player.r) && !isWall(nx + player.r, player.y - player.r) &&
        !isWall(nx - player.r, player.y + player.r) && !isWall(nx + player.r, player.y + player.r)) {
      player.x = nx;
    }
    if (!isWall(player.x - player.r, ny - player.r) && !isWall(player.x + player.r, ny - player.r) &&
        !isWall(player.x - player.r, ny + player.r) && !isWall(player.x + player.r, ny + player.r)) {
      player.y = ny;
    }

    if (player.regen > 0) player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);

    attackNearest(dt);

    // enemies AI
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.t += dt;
      e.hitT = Math.max(0, e.hitT - dt);
      const dx = player.x - e.x, dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (e.kind === 'boss') {
        if (dist < 260) {
          e.x += dx / dist * e.spd * dt;
          e.y += dy / dist * e.spd * dt;
        }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < 240) {
          e.shootCd = 2.2;
          for (let a = 0; a < 8; a++) {
            const ang = a / 8 * Math.PI * 2 + e.t;
            drops.push({ type: 'bullet', x: e.x, y: e.y, vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120, life: 3, dmg: e.atk });
          }
          sfx.laser();
        }
      } else if (e.kind === 'bat') {
        // erratic chase
        const wob = Math.sin(e.t * 5) * 0.9;
        const ang = Math.atan2(dy, dx) + (dist < 200 ? wob : Math.sin(e.t * 2) * 1.2);
        e.x += Math.cos(ang) * e.spd * dt;
        e.y += Math.sin(ang) * e.spd * dt;
      } else {
        // slime/knight: chase when close, else idle bounce
        if (dist < 190) {
          e.x += dx / dist * e.spd * dt;
          e.y += dy / dist * e.spd * dt;
        } else {
          e.wander += dt * 0.8;
          e.x += Math.cos(e.wander) * e.spd * 0.35 * dt;
          e.y += Math.sin(e.wander * 1.3) * e.spd * 0.35 * dt;
        }
      }

      // enemy-wall clamp (simple push out)
      if (isWall(e.x - e.r, e.y - e.r) || isWall(e.x + e.r, e.y - e.r) ||
          isWall(e.x - e.r, e.y + e.r) || isWall(e.x + e.r, e.y + e.r)) {
        e.t += 1.7;
        e.x += (entrance.x - e.x) * 0.02 + Math.cos(e.t * 3) * 24 * dt;
        e.y += (entrance.y - e.y) * 0.02 + Math.sin(e.t * 3) * 24 * dt;
      }

      // touch damage
      if (dist < e.r + player.r + 2 && hurtCd <= 0) {
        player.hp -= e.atk;
        hurtCd = 0.6;
        sfx.hit();
        shake(5, 0.2);
        burst(player.x, player.y, { n: 8, colors: ['#ff3355', '#fff'], speed: 100 });
        floatText(player.x, player.y - 20, '-' + e.atk, '#ff6666');
        if (player.hp <= 0) { gameOver(); return; }
      }
    }

    // hazard bullets / drops
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (d.type === 'bullet') {
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.life -= dt;
        if (d.life <= 0 || isWall(d.x, d.y)) { drops.splice(i, 1); continue; }
        if (Math.hypot(d.x - player.x, d.y - player.y) < player.r + 4) {
          drops.splice(i, 1);
          player.hp -= d.dmg;
          hurtCd = 0.4;
          sfx.hit(); shake(5, 0.2);
          floatText(player.x, player.y - 20, '-' + d.dmg, '#ff6666');
          if (player.hp <= 0) { gameOver(); return; }
          continue;
        }
      } else {
        const dist = Math.hypot(d.x - player.x, d.y - player.y);
        if (dist < player.magnet) {
          d.x += (player.x - d.x) * 6 * dt;
          d.y += (player.y - d.y) * 6 * dt;
        }
        if (dist < player.r + 8) {
          if (d.type === 'heart') {
            player.hp = Math.min(player.maxHp, player.hp + 10);
            sfx.heal();
            floatText(player.x, player.y - 20, '+10 HP', '#7dff8a');
          } else {
            gainXp(3);
            sfx.coin();
            floatText(player.x, player.y - 20, '+XP');
          }
          drops.splice(i, 1);
          continue;
        }
      }
    }

    // stairs
    const st = dungeon.stairs;
    if (!st.locked && Math.hypot(st.x - player.x, st.y - player.y) < 24) {
      descend();
      return;
    }
    if (st.locked && enemies.length === 0) {
      st.locked = false;
      sfx.select();
      floatText(st.x, st.y - 26, 'STAIRS OPEN!', '#ffe066');
    }

    RA.setScore(score());
  }

  function slashFx(x, y, ang) {
    burst(x, y, { n: 5, colors: ['#fff', '#bfefff'], speed: 80, size: 3, grav: 0, decay: 3 });
    void ang;
  }

  // ---------- draw ----------
  function draw(g) {
    // camera centered on player, clamped to map
    const camX = Math.max(0, Math.min(MAP_W * TILE - VW, player.x - VW / 2));
    const camY = Math.max(0, Math.min(MAP_H * TILE - VH, player.y - VH / 2));

    g.save();
    g.translate(-camX, -camY);

    // tiles
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const wx = tx * TILE, wy = ty * TILE;
        if (dungeon.map[ty][tx] === 1) {
          g.fillStyle = '#20283c';
          g.fillRect(wx, wy, TILE, TILE);
          g.fillStyle = '#161c2c';
          g.fillRect(wx + 3, wy + 3, TILE - 6, TILE - 6);
        } else {
          g.fillStyle = '#39415f';
          g.fillRect(wx, wy, TILE, TILE);
          g.fillStyle = '#414a6c';
          g.fillRect(wx + 2, wy + 2, TILE - 4, TILE - 4);
        }
      }
    }

    // stairs
    const st = dungeon.stairs;
    g.fillStyle = st.locked ? '#555' : '#ffe066';
    g.fillRect(st.x - 14, st.y - 10, 28, 20);
    g.fillStyle = st.locked ? '#333' : '#8a6d1d';
    g.fillRect(st.x - 14, st.y - 2, 28, 12);
    g.fillRect(st.x - 14, st.y + 6, 28, 4);
    if (st.locked) {
      g.fillStyle = '#aaa';
      g.font = '8px monospace';
      g.textAlign = 'center';
      g.fillText('LOCKED', st.x, st.y - 16);
      g.textAlign = 'left';
    }

    // drops
    for (const d of drops) {
      if (d.type === 'heart') {
        g.fillStyle = '#ff5d8f';
        g.fillRect(d.x - 5, d.y - 5, 4, 4);
        g.fillRect(d.x + 1, d.y - 5, 4, 4);
        g.fillRect(d.x - 6, d.y - 2, 12, 4);
        g.fillRect(d.x - 4, d.y + 2, 8, 3);
        g.fillRect(d.x - 2, d.y + 4, 4, 2);
      } else if (d.type === 'coin') {
        g.fillStyle = '#ffe066';
        g.beginPath(); g.arc(d.x, d.y, 5, 0, Math.PI * 2); g.fill();
      } else if (d.type === 'bullet') {
        g.fillStyle = '#ff8844';
        g.beginPath(); g.arc(d.x, d.y, 4, 0, Math.PI * 2); g.fill();
      }
    }

    // enemies
    for (const e of enemies) {
      const flash = e.hitT > 0;
      g.save();
      g.translate(e.x, e.y);
      const bob = Math.sin(e.t * 4) * 2;
      if (e.kind === 'slime') {
        g.fillStyle = flash ? '#fff' : '#7dff8a';
        g.fillRect(-10, -6 + bob * 0.3, 20, 13);
        g.fillStyle = flash ? '#eee' : '#3fae63';
        g.fillRect(-6, -2, 4, 4); g.fillRect(3, -2, 4, 4);
      } else if (e.kind === 'bat') {
        g.fillStyle = flash ? '#fff' : '#b967ff';
        const flap = Math.sin(e.t * 14) * 5;
        g.fillRect(-6, -5 + bob * 0.4, 12, 10);
        g.fillRect(-15, -3 + flap * 0.4, 8, 5);
        g.fillRect(7, -3 - flap * 0.4, 8, 5);
        g.fillStyle = '#ffe066';
        g.fillRect(-4, -2, 3, 3); g.fillRect(2, -2, 3, 3);
      } else if (e.kind === 'knight') {
        g.fillStyle = flash ? '#fff' : '#8fa3bf';
        g.fillRect(-9, -12 + bob * 0.2, 18, 24);
        g.fillStyle = '#5c6f8a';
        g.fillRect(-9, -12, 18, 7);
        g.fillStyle = '#ff3355';
        g.fillRect(-5, -3, 4, 4); g.fillRect(2, -3, 4, 4);
      } else { // boss
        g.fillStyle = flash ? '#fff' : '#ff3355';
        g.fillRect(-18, -16 + bob * 0.2, 36, 32);
        g.fillStyle = '#7a1024';
        g.fillRect(-18, -16, 36, 9);
        g.fillStyle = '#ffe066';
        g.fillRect(-10, -4, 7, 7); g.fillRect(4, -4, 7, 7);
        // hp bar above
        g.fillStyle = 'rgba(0,0,0,.5)';
        g.fillRect(-20, -30, 40, 5);
        g.fillStyle = '#ff3355';
        g.fillRect(-20, -30, 40 * (e.hp / e.maxHp), 5);
      }
      g.restore();
    }

    // player
    const inv = hurtCd > 0.3;
    if (!inv || Math.floor(performance.now() / 80) % 2 === 0) {
      g.fillStyle = '#00eaff';
      g.fillRect(player.x - 9, player.y - 12, 18, 20);
      g.fillStyle = '#0891a5';
      g.fillRect(player.x - 9, player.y + 4, 18, 4);
      g.fillStyle = '#04303a';
      g.fillRect(player.x - 5, player.y - 7, 4, 4);
      g.fillRect(player.x + 2, player.y - 7, 4, 4);
      // sword indicator: line to current target
    }

    g.restore();

    // top HUD bar
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, 0, VW, 44);
    // hp
    g.fillStyle = '#331';
    g.fillRect(10, 10, 140, 10);
    g.fillStyle = '#ff5d8f';
    g.fillRect(10, 10, 140 * Math.max(0, player.hp / player.maxHp), 10);
    g.fillStyle = '#fff';
    g.font = '9px monospace';
    g.fillText(`HP ${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, 10, 32);
    // xp
    g.fillStyle = '#123';
    g.fillRect(160, 10, 90, 10);
    g.fillStyle = '#ffe066';
    g.fillRect(160, 10, 90 * (player.xp / player.xpNext), 10);
    g.fillText(`LV ${player.lv}`, 160, 32);
    // floor
    g.fillStyle = '#7dff8a';
    g.font = 'bold 12px monospace';
    g.fillText(`F.${floorNum}${floorNum % 5 === 0 ? ' ☠BOSS' : ''}`, 262, 24);
  }

  function onPause() {
    RA.showOverlay({
      title: 'PAUSED',
      tapStart: true,
      buttons: [{ label: 'EXIT', onClick: () => document.getElementById('btn-exit').click() }]
    });
    RA.audio.stopBGM();
    const resumeHook = setInterval(() => {
      if (!RA.isOverlayOpen()) {
        clearInterval(resumeHook);
        if (state === 'play' || state === 'levelup') RA.audio.playBGM('rpg');
      }
    }, 250);
  }

  return { init, update, draw, onStart, onPause };
})();
