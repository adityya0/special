import { drawHamster, drawAccessory, drawHeart } from './sprites.js';
import { sfx } from './sound.js';

// Top-Down Full-Screen Hamster Arena (2-3 players, 3 HP, Rocks, 1-shot Weapon & Health pickups, Analog Stick)
export class HamsterArena {
  constructor({ coop, hamsters, onExit }) {
    this.coop = coop;
    this.hamsters = hamsters;
    this.onExit = onExit;

    this.overlay = document.getElementById('arena-overlay');
    this.canvas = document.getElementById('arena-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hudEl = document.getElementById('arena-hud');
    this.lobbyEl = document.getElementById('arena-lobby');
    this.lobbyListEl = document.getElementById('arena-ready-list');
    this.btnReady = document.getElementById('btn-arena-ready');
    this.btnStart = document.getElementById('btn-arena-start');
    this.btnExit = document.getElementById('btn-arena-exit');
    this.aimHint = document.getElementById('arena-aim-hint');
    this.joyBase = document.getElementById('arena-joy-base');
    this.joyKnob = document.getElementById('arena-joy-knob');

    this.W = 480;
    this.H = 300;
    this.active = false;
    this.started = false;
    this.winnerText = '';

    this.players = new Map(); // id -> { id, name, fur, acc, x, y, dx, dy, hp, ammo, ready, anim }
    this.rocks = []; // { x, y, r }
    this.pickups = []; // { id, kind: 'weapon'|'heart', x, y }
    this.bullets = []; // { ownerId, x, y, vx, vy, life }

    this.keys = new Set();
    this.joyVec = { x: 0, y: 0 };
    this.joyPointerId = null;
    this.lastMoveSync = 0;
    this.itemTimer = 2.0;
    this.rafId = null;
    this.lastTime = 0;

    this.bindEvents();
  }

  bindEvents() {
    this.btnExit.addEventListener('click', () => this.close());
    this.btnReady.addEventListener('click', () => {
      const me = this.players.get(this.coop.clientId);
      if (!me) return;
      me.ready = !me.ready;
      this.coop.send('action', { action: 'arena_ready', data: { ready: me.ready } });
      this.renderLobby();
    });

    this.btnStart.addEventListener('click', () => {
      const rocks = this.generateRocks();
      this.startMatch(rocks, true);
    });

    // Virtual Analog Joystick (lepas analog saat punya senjata = langsung tembak!)
    this.joyBase.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.joyPointerId = e.pointerId;
      this.joyBase.setPointerCapture(e.pointerId);
      this.updateJoystick(e);
    });
    this.joyBase.addEventListener('pointermove', (e) => {
      if (this.joyPointerId === e.pointerId) this.updateJoystick(e);
    });
    const resetJoy = (e) => {
      if (this.joyPointerId !== e.pointerId) return;
      const hadAim = Math.hypot(this.joyVec.x, this.joyVec.y) > 0.25;
      this.joyPointerId = null;
      this.joyVec = { x: 0, y: 0 };
      this.joyKnob.style.transform = 'translate(0px, 0px)';
      if (hadAim) {
        this.tryShoot();
      }
    };
    this.joyBase.addEventListener('pointerup', resetJoy);
    this.joyBase.addEventListener('pointercancel', resetJoy);

    // Keyboard fallback
    window.addEventListener('keydown', (e) => {
      if (!this.active || !this.started) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this.tryShoot();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  updateJoystick(e) {
    const rect = this.joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.joyVec = { x: dx / maxR, y: dy / maxR };
  }

  async open(broadcast = true) {
    this.active = true;
    this.started = false;
    this.winnerText = '';
    this.overlay.classList.remove('hidden');
    this.lobbyEl.classList.remove('hidden');

    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch {
      // Browser may disallow fullscreen/orientation lock without gesture or on iOS
    }

    this.players.clear();
    let idx = 0;
    for (const h of this.hamsters.values()) {
      this.players.set(h.id, {
        id: h.id,
        name: h.name,
        fur: h.fur,
        acc: h.acc,
        x: 70 + idx * 140,
        y: 150,
        dx: 1,
        dy: 0,
        hp: 3,
        ammo: 0,
        ready: false,
        anim: 0,
      });
      idx++;
    }

    if (broadcast) {
      this.coop.send('action', { action: 'arena_open', data: {} });
    }
    this.renderLobby();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  close() {
    this.active = false;
    this.started = false;
    this.overlay.classList.add('hidden');
    if (this.rafId) cancelAnimationFrame(this.rafId);
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch {
      // Ignore
    }
    this.onExit();
  }

  generateRocks() {
    const spots = [
      { x: 140, y: 90, r: 16 },
      { x: 340, y: 90, r: 16 },
      { x: 240, y: 155, r: 18 },
      { x: 130, y: 220, r: 15 },
      { x: 350, y: 220, r: 15 },
    ];
    return spots;
  }

  startMatch(rocks, broadcast = false) {
    this.started = true;
    this.winnerText = '';
    this.lobbyEl.classList.add('hidden');
    this.rocks = rocks || this.generateRocks();
    this.pickups = [];
    this.bullets = [];
    this.itemTimer = 0.8;

    const spawns = [
      { x: 52, y: 56 },
      { x: this.W - 52, y: this.H - 56 },
      { x: this.W - 52, y: 56 },
    ];
    let i = 0;
    for (const p of this.players.values()) {
      const sp = spawns[i % spawns.length];
      p.x = sp.x;
      p.y = sp.y;
      p.hp = 3;
      p.ammo = 0;
      p.dx = 1;
      p.dy = 0;
      i++;
    }

    if (broadcast) {
      this.coop.send('action', { action: 'arena_start', data: { rocks: this.rocks } });
      this.spawnRandomItem(true);
      this.spawnRandomItem(true);
    }
    this.updateHUD();
  }

  getRaritySettings() {
    const alive = [...this.players.values()].filter((p) => p.hp > 0);
    const minHp = alive.length > 0 ? Math.min(...alive.map((p) => p.hp)) : 3;
    if (minHp <= 1) {
      return { delayMin: 6.5, delayRange: 2.0, maxItems: 2, heartChance: 0.12 };
    }
    if (minHp === 2) {
      return { delayMin: 4.0, delayRange: 1.5, maxItems: 3, heartChance: 0.2 };
    }
    return { delayMin: 2.2, delayRange: 1.0, maxItems: 5, heartChance: 0.3 };
  }

  spawnRandomItem(broadcast = false) {
    const { maxItems, heartChance } = this.getRaritySettings();
    if (this.pickups.length >= maxItems) return;
    const kind = Math.random() < heartChance ? 'heart' : 'weapon';
    let x = 40 + Math.random() * (this.W - 80);
    let y = 40 + Math.random() * (this.H - 80);
    for (const rk of this.rocks) {
      if (Math.hypot(x - rk.x, y - rk.y) < rk.r + 16) {
        x = 60 + Math.random() * (this.W - 120);
      }
    }
    const item = { id: Math.random().toString(36).slice(2, 8), kind, x: Math.round(x), y: Math.round(y) };
    this.pickups.push(item);
    if (broadcast) {
      this.coop.send('action', { action: 'arena_item', data: item });
    }
  }

  tryShoot() {
    if (!this.started || this.winnerText) return;
    const me = this.players.get(this.coop.clientId);
    if (!me || me.hp <= 0 || me.ammo <= 0) return;

    me.ammo = 0;
    const len = Math.hypot(me.dx, me.dy) || 1;
    const vx = (me.dx / len) * 260;
    const vy = (me.dy / len) * 260;
    const bullet = { ownerId: me.id, x: me.x, y: me.y - 8, vx, vy, life: 1.6 };
    this.bullets.push(bullet);
    sfx.squeak();
    this.coop.send('action', { action: 'arena_shoot', data: bullet });
    this.updateHUD();
  }

  handleRemote(action, data, senderId) {
    if (action === 'arena_open' && !this.active) {
      this.open(false);
      return;
    }
    if (!this.active) return;

    switch (action) {
      case 'arena_ready': {
        const p = this.players.get(senderId);
        if (p) p.ready = !!data.ready;
        this.renderLobby();
        break;
      }
      case 'arena_start': {
        this.startMatch(data.rocks, false);
        break;
      }
      case 'arena_move': {
        const p = this.players.get(senderId);
        if (p) {
          p.x = data.x;
          p.y = data.y;
          p.dx = data.dx;
          p.dy = data.dy;
        }
        break;
      }
      case 'arena_item': {
        if (!this.pickups.some((it) => it.id === data.id)) {
          this.pickups.push(data);
        }
        break;
      }
      case 'arena_pickup': {
        this.pickups = this.pickups.filter((it) => it.id !== data.itemId);
        const p = this.players.get(senderId);
        if (p) {
          if (data.kind === 'weapon') p.ammo = 1;
          else p.hp = Math.min(3, p.hp + 1);
        }
        this.updateHUD();
        break;
      }
      case 'arena_shoot': {
        const p = this.players.get(senderId);
        if (p) p.ammo = 0;
        this.bullets.push({ ...data, ownerId: senderId });
        this.updateHUD();
        break;
      }
      case 'arena_hit': {
        const p = this.players.get(data.targetId);
        if (p) {
          p.hp = Math.max(0, data.hp);
          sfx.sleep();
          this.checkWinner();
          this.updateHUD();
        }
        break;
      }
    }
  }

  checkWinner() {
    const alive = [...this.players.values()].filter((p) => p.hp > 0);
    if (this.players.size >= 2 && alive.length <= 1) {
      this.winnerText = alive.length === 1 ? `🏆 ${alive[0].name} MENANG!` : '💀 SERI!';
      setTimeout(() => {
        if (this.active) {
          this.started = false;
          this.lobbyEl.classList.remove('hidden');
          this.renderLobby();
        }
      }, 2600);
    }
  }

  renderLobby() {
    const entries = [...this.players.values()];
    this.lobbyListEl.innerHTML = entries
      .map((p) => `<li>${p.name} — ${p.ready ? '✅ READY' : '⏳ Belum Ready'}</li>`)
      .join('');
    const me = this.players.get(this.coop.clientId);
    this.btnReady.textContent = me?.ready ? '❌ Batal Ready' : '✅ Ready!';
    const allReady = entries.length > 0 && entries.every((p) => p.ready);
    this.btnStart.textContent = allReady ? '🚀 Mulai Sekarang!' : '🚀 Paksa Mulai';
  }

  updateHUD() {
    const me = this.players.get(this.coop.clientId);
    if (!me) return;
    const hearts = '❤️'.repeat(me.hp) + '🖤'.repeat(Math.max(0, 3 - me.hp));
    const ammoText = me.ammo > 0 ? '🔫 SIAP TEMBAK (Lepas Analog!)' : '🔫 Kosong (Cari Senjata!)';
    this.hudEl.textContent = `${me.name}: ${hearts}  |  ${ammoText}`;
    if (this.aimHint) {
      this.aimHint.textContent =
        me.ammo > 0
          ? '🎯 Arahkan analog & LEPAS untuk tembak!'
          : '🔍 Cari senjata (🔫) di arena dulu!';
    }
  }

  loop(now) {
    if (!this.active) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.started) {
      this.update(dt, now);
    }
    this.draw();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt, now) {
    // Local player movement (Analog + Keyboard)
    const me = this.players.get(this.coop.clientId);
    if (me && me.hp > 0 && !this.winnerText) {
      let mx = this.joyVec.x;
      let my = this.joyVec.y;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;

      const mag = Math.hypot(mx, my);
      if (mag > 0.1) {
        const nx = mx / Math.max(1, mag);
        const ny = my / Math.max(1, mag);
        me.dx = nx;
        me.dy = ny;
        me.anim += dt;
        const nextX = Math.max(20, Math.min(this.W - 20, me.x + nx * 115 * dt));
        const nextY = Math.max(30, Math.min(this.H - 12, me.y + ny * 115 * dt));

        // Rock collision
        let blocked = false;
        for (const rk of this.rocks) {
          if (Math.hypot(nextX - rk.x, nextY - 8 - rk.y) < rk.r + 12) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          me.x = nextX;
          me.y = nextY;
        }
      }

      if (now - this.lastMoveSync > 65) {
        this.lastMoveSync = now;
        this.coop.send('action', {
          action: 'arena_move',
          data: { x: me.x, y: me.y, dx: me.dx, dy: me.dy },
        });
      }

      // Check item pickups
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const it = this.pickups[i];
        if (Math.hypot(me.x - it.x, me.y - 10 - it.y) < 20) {
          if (it.kind === 'weapon' && me.ammo === 0) {
            me.ammo = 1;
            sfx.munch();
          } else if (it.kind === 'heart' && me.hp < 3) {
            me.hp += 1;
            sfx.heart();
          } else {
            continue;
          }
          this.pickups.splice(i, 1);
          this.coop.send('action', {
            action: 'arena_pickup',
            data: { itemId: it.id, kind: it.kind },
          });
          this.updateHUD();
        }
      }
    }

    // Host spawns random weapons & health (rarer as HP gets lower!)
    const ids = [...this.players.keys()].sort();
    if (ids[0] === this.coop.clientId && !this.winnerText) {
      this.itemTimer -= dt;
      if (this.itemTimer <= 0) {
        const { delayMin, delayRange } = this.getRaritySettings();
        this.itemTimer = delayMin + Math.random() * delayRange;
        this.spawnRandomItem(true);
      }
    }

    // Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let remove = b.life <= 0 || b.x < 0 || b.x > this.W || b.y < 0 || b.y > this.H;
      for (const rk of this.rocks) {
        if (Math.hypot(b.x - rk.x, b.y - rk.y) < rk.r) {
          remove = true;
          break;
        }
      }

      if (!remove && me && me.hp > 0 && b.ownerId !== me.id) {
        if (Math.hypot(b.x - me.x, b.y - (me.y - 12)) < 16) {
          remove = true;
          me.hp = Math.max(0, me.hp - 1);
          sfx.sleep();
          this.coop.send('action', {
            action: 'arena_hit',
            data: { targetId: me.id, hp: me.hp },
          });
          this.checkWinner();
          this.updateHUD();
        }
      }

      if (remove) this.bullets.splice(i, 1);
    }
  }

  draw() {
    const ctx = this.ctx;
    // Top-down grassy arena floor
    ctx.fillStyle = '#386641';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#6a994e';
    for (let y = 16; y < this.H; y += 32) {
      for (let x = 16; x < this.W; x += 32) {
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.strokeStyle = '#bc4749';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, this.W - 4, this.H - 4);

    // Rocks
    for (const rk of this.rocks) {
      ctx.fillStyle = '#6c757d';
      ctx.beginPath();
      ctx.arc(rk.x, rk.y, rk.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#adb5bd';
      ctx.beginPath();
      ctx.arc(rk.x - 4, rk.y - 4, rk.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pickups
    for (const it of this.pickups) {
      if (it.kind === 'heart') {
        drawHeart(ctx, it.x, it.y, 2);
      } else {
        // Pixel Gun / Weapon pickup
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(it.x - 8, it.y - 6, 16, 12);
        ctx.fillStyle = '#2b2d42';
        ctx.fillRect(it.x - 5, it.y - 3, 10, 4);
        ctx.fillRect(it.x - 5, it.y + 1, 4, 4);
      }
    }

    // Players
    for (const p of this.players.values()) {
      if (p.hp <= 0) ctx.globalAlpha = 0.4;
      const frame = p.hp <= 0 ? 'sleep' : Math.floor(p.anim * 12) % 2 ? 'walk1' : 'walk2';
      drawHamster(ctx, p.x, p.y, frame, p.fur, p.dx < 0, 1.5);
      if (p.hp > 0) drawAccessory(ctx, p.x, p.y, p.acc, 1.5);
      ctx.globalAlpha = 1;

      ctx.font = 'bold 8px Silkscreen, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${p.name} (${p.hp}❤)`, Math.round(p.x - 22), Math.round(p.y - 34));
    }

    // Bullets
    ctx.fillStyle = '#ffd166';
    for (const b of this.bullets) {
      ctx.fillRect(Math.round(b.x - 3), Math.round(b.y - 3), 6, 6);
    }

    if (this.winnerText) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(90, 110, 300, 60);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 14px Silkscreen, monospace';
      ctx.fillText(this.winnerText, 145, 146);
    }
  }
}
