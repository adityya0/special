import './style.css';
import { drawHamster, drawFoodSprite, drawHeart } from './sprites.js';
import { sfx } from './sound.js';
import { CoopRealtime } from './realtime.js';

const canvas = document.getElementById('cage-canvas');
const ctx = canvas.getContext('2d');
const W = 320;
const H = 200;
const FLOOR_Y = 172;

// Persistent browser-only state (no database!)
const DEFAULT_STATE = {
  name: 'MOCHI',
  fur: 'golden',
  hunger: 82,
  happy: 88,
  energy: 90,
  hygiene: 85,
  night: false,
};

function loadState() {
  try {
    const raw = localStorage.getItem('hammy_state_v1');
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const state = loadState();
function saveState() {
  localStorage.setItem('hammy_state_v1', JSON.stringify(state));
}

// Hyperactive ("ga bisa diem") hamster entity
const hammy = {
  x: 160,
  y: FLOOR_Y,
  vx: 0,
  vy: 0,
  targetX: 160,
  flip: false,
  mode: 'wander', // wander | zoomies | wheel | tunnel | sand | eat | happy | sleep
  modeTimer: 1.5,
  animTick: 0,
  inTunnel: false,
  tunnelDir: 1,
};

const toys = {
  wheelAngle: 0,
  wheelSpeed: 0,
  ballX: 212,
  ballY: FLOOR_Y - 6,
  ballVx: 0,
  ballVy: 0,
};

const foods = []; // { type, x, y, vy }
const messes = []; // { x, y }
const particles = []; // { kind, x, y, vx, vy, life, text, color }
let remoteCursor = null; // { x, y, name, expiresAt }

// UI Elements
const elTitle = document.getElementById('pet-title');
const elPresencePill = document.getElementById('presence-pill');
const elPresenceText = document.getElementById('presence-text');
const elLog = document.getElementById('activity-log');
const elToast = document.getElementById('bubble-toast');
const bars = {
  hunger: document.getElementById('bar-hunger'),
  happy: document.getElementById('bar-happy'),
  energy: document.getElementById('bar-energy'),
  hygiene: document.getElementById('bar-hygiene'),
};

let toastTimeout = null;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elToast.classList.add('hidden'), 2600);
}

function addLog(text) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  li.textContent = `[${time}] ${text}`;
  elLog.prepend(li);
  while (elLog.children.length > 20) elLog.lastChild.remove();
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function updateUI() {
  elTitle.textContent = state.name;
  bars.hunger.style.width = `${clamp(state.hunger)}%`;
  bars.happy.style.width = `${clamp(state.happy)}%`;
  bars.energy.style.width = `${clamp(state.energy)}%`;
  bars.hygiene.style.width = `${clamp(state.hygiene)}%`;
  document.getElementById('btn-sound').textContent = sfx.muted ? '🔇' : '🔊';
  document.getElementById('btn-sleep').textContent = state.night ? '☀️ Lampu' : '🌙 Lampu';
}

function spawnParticles(kind, x, y, count = 4, extra = {}) {
  for (let i = 0; i < count; i++) {
    particles.push({
      kind,
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 28,
      vy: -20 - Math.random() * 24,
      life: 1.0 + Math.random() * 0.5,
      ...extra,
    });
  }
}

// Realtime Co-op Setup
const coop = new CoopRealtime({
  onStatusChange: ({ connected, onlineCount, peers, reason }) => {
    if (!connected) {
      elPresencePill.className = 'presence-pill offline';
      elPresenceText.textContent = reason === 'no-keys' ? 'Solo (Browser)' : 'Offline';
      return;
    }
    elPresencePill.className = 'presence-pill online';
    const peerNames = peers.map((p) => p.name).filter(Boolean);
    elPresenceText.textContent =
      onlineCount > 1
        ? `2+ Online (${peerNames.join(', ') || 'Teman'}) 💕`
        : `Room ${coop.roomCode} (1/2)`;

    if (onlineCount > 1) {
      coop.send('sync_state', { state });
    }
  },
  onRemoteAction: (payload) => {
    applyAction(payload.action, payload.data, payload.senderName, false);
  },
  onRemoteCursor: ({ x, y, senderName }) => {
    remoteCursor = { x, y, name: senderName || 'Teman', expiresAt: performance.now() + 2500 };
  },
  onRemoteEmote: ({ emote, senderName }) => {
    sfx.heart();
    spawnParticles('text', 160, 88, 1, { text: `${senderName}: ${emote}`, color: '#ff4d79' });
    spawnParticles('heart', hammy.x, hammy.y - 26, 4);
    showToast(`${senderName}: ${emote}`);
    addLog(`${senderName} kirim "${emote}"`);
  },
  onSyncState: ({ state: incoming }) => {
    if (!incoming) return;
    Object.assign(state, incoming);
    saveState();
    updateUI();
  },
});

function applyAction(action, data = {}, actor = 'Kamu', broadcast = true) {
  if (broadcast) {
    coop.send('action', { action, data });
  }

  switch (action) {
    case 'feed': {
      const type = data.type || 'seed';
      const fx = data.x ?? 70 + Math.random() * 180;
      foods.push({ type, x: fx, y: 40, vy: 40 });
      sfx.munch();
      state.hunger = clamp(state.hunger + 16);
      state.happy = clamp(state.happy + 6);
      addLog(`${actor} kasih makan ${type}`);
      break;
    }
    case 'water': {
      sfx.splash();
      state.hunger = clamp(state.hunger + 6);
      state.energy = clamp(state.energy + 6);
      hammy.mode = 'wander';
      hammy.targetX = 32;
      spawnParticles('sparkle', 30, 128, 5, { color: '#54a0ff' });
      addLog(`${actor} kasih minum`);
      break;
    }
    case 'pet': {
      sfx.squeak();
      sfx.heart();
      state.happy = clamp(state.happy + 14);
      hammy.mode = 'happy';
      hammy.modeTimer = 1.4;
      hammy.vy = -55;
      spawnParticles('heart', hammy.x, hammy.y - 26, 5);
      addLog(`${actor} elus ${state.name} ❤️`);
      break;
    }
    case 'wheel': {
      sfx.squeak();
      hammy.mode = 'wheel';
      hammy.modeTimer = 4.2;
      toys.wheelSpeed = 11;
      state.happy = clamp(state.happy + 12);
      state.energy = clamp(state.energy - 5);
      addLog(`${actor} putar roda lari!`);
      break;
    }
    case 'tunnel': {
      sfx.squeak();
      hammy.mode = 'tunnel';
      hammy.modeTimer = 2.6;
      hammy.inTunnel = false;
      state.happy = clamp(state.happy + 10);
      addLog(`${actor} ajak main terowongan`);
      break;
    }
    case 'sand': {
      sfx.splash();
      hammy.mode = 'sand';
      hammy.modeTimer = 3.0;
      state.hygiene = clamp(state.hygiene + 24);
      state.happy = clamp(state.happy + 8);
      addLog(`${actor} mandikan pasir ✨`);
      break;
    }
    case 'ball': {
      sfx.squeak();
      toys.ballVx = (Math.random() > 0.5 ? 1 : -1) * 110;
      toys.ballVy = -95;
      hammy.mode = 'zoomies';
      hammy.modeTimer = 2.5;
      hammy.targetX = toys.ballX;
      state.happy = clamp(state.happy + 10);
      addLog(`${actor} lempar bola mainan`);
      break;
    }
    case 'clean': {
      sfx.sweep();
      messes.length = 0;
      state.hygiene = clamp(state.hygiene + 22);
      spawnParticles('sparkle', 160, FLOOR_Y - 12, 8, { color: '#2ed573' });
      addLog(`${actor} bersihkan kandang 🧹`);
      break;
    }
    case 'sleep': {
      sfx.sleep();
      state.night = typeof data.night === 'boolean' ? data.night : !state.night;
      hammy.mode = state.night ? 'sleep' : 'zoomies';
      hammy.modeTimer = state.night ? 6 : 2;
      addLog(`${actor} ${state.night ? 'matikan lampu 🌙' : 'nyalakan lampu ☀️'}`);
      break;
    }
    case 'goto': {
      hammy.mode = 'zoomies';
      hammy.targetX = clamp(data.x ?? 160, 26, W - 26);
      hammy.modeTimer = 1.6;
      break;
    }
    case 'profile': {
      if (data.name) state.name = data.name;
      if (data.fur) state.fur = data.fur;
      addLog(`${actor} ubah profil ${state.name}`);
      break;
    }
  }

  saveState();
  updateUI();
}

// Autonomous "ga bisa diem" AI
function pickNextBehavior() {
  if (state.night || state.energy < 14) {
    hammy.mode = 'sleep';
    hammy.modeTimer = 4 + Math.random() * 4;
    return;
  }

  if (foods.length > 0) {
    hammy.mode = 'eat';
    hammy.modeTimer = 2.5;
    return;
  }

  const roll = Math.random();
  if (roll < 0.34) {
    hammy.mode = 'wander';
    hammy.targetX = 28 + Math.random() * (W - 56);
    hammy.modeTimer = 1.4 + Math.random() * 1.4;
  } else if (roll < 0.58) {
    hammy.mode = 'zoomies';
    hammy.targetX = 28 + Math.random() * (W - 56);
    hammy.modeTimer = 1.2 + Math.random() * 1.0;
  } else if (roll < 0.74) {
    hammy.mode = 'wheel';
    hammy.modeTimer = 3.2 + Math.random() * 2.0;
    toys.wheelSpeed = 8;
  } else if (roll < 0.88) {
    hammy.mode = 'tunnel';
    hammy.modeTimer = 2.4;
    hammy.inTunnel = false;
  } else {
    hammy.mode = 'sand';
    hammy.modeTimer = 2.4;
  }
}

function updateSimulation(dt) {
  hammy.animTick += dt;

  // Gradual stat decay
  state.hunger = clamp(state.hunger - dt * 0.45);
  state.hygiene = clamp(state.hygiene - dt * 0.25);
  if (hammy.mode === 'sleep') {
    state.energy = clamp(state.energy + dt * 2.6);
  } else {
    state.energy = clamp(state.energy - dt * 0.3);
  }

  // Occasional mess
  if (Math.random() < dt * 0.035 && messes.length < 4) {
    messes.push({ x: 35 + Math.random() * (W - 70), y: FLOOR_Y - 2 });
  }

  // Foods falling
  for (const f of foods) {
    if (f.y < FLOOR_Y - 2) {
      f.vy += 180 * dt;
      f.y = Math.min(FLOOR_Y - 2, f.y + f.vy * dt);
    }
  }

  // Toy ball physics
  toys.ballX += toys.ballVx * dt;
  toys.ballY += toys.ballVy * dt;
  if (toys.ballY < FLOOR_Y - 6) {
    toys.ballVy += 260 * dt;
  } else {
    toys.ballY = FLOOR_Y - 6;
    if (Math.abs(toys.ballVy) > 25) {
      toys.ballVy = -toys.ballVy * 0.55;
    } else {
      toys.ballVy = 0;
    }
  }
  if (toys.ballX < 20 || toys.ballX > W - 20) {
    toys.ballVx *= -0.8;
    toys.ballX = clamp(toys.ballX, 20, W - 20);
  }
  toys.ballVx *= 0.985;

  // Wheel friction
  if (hammy.mode === 'wheel') {
    toys.wheelSpeed = Math.max(toys.wheelSpeed, 9);
  } else {
    toys.wheelSpeed *= 0.96;
  }
  toys.wheelAngle += toys.wheelSpeed * dt;

  // Hamster movement & behavior
  hammy.modeTimer -= dt;
  if (hammy.y < FLOOR_Y || hammy.vy < 0) {
    hammy.vy += 220 * dt;
    hammy.y = Math.min(FLOOR_Y, hammy.y + hammy.vy * dt);
    if (hammy.y >= FLOOR_Y) hammy.vy = 0;
  }

  if (foods.length > 0 && hammy.mode !== 'sleep') {
    hammy.mode = 'eat';
  }

  switch (hammy.mode) {
    case 'wander':
    case 'zoomies': {
      const speed = hammy.mode === 'zoomies' ? 92 : 42;
      const dx = hammy.targetX - hammy.x;
      if (Math.abs(dx) > 3) {
        hammy.flip = dx < 0;
        hammy.x += Math.sign(dx) * speed * dt;
        if (hammy.mode === 'zoomies' && Math.random() < dt * 8) {
          spawnParticles('dust', hammy.x, FLOOR_Y - 2, 1, { color: '#e6ccb2' });
        }
      } else if (hammy.modeTimer <= 0) {
        pickNextBehavior();
      }
      break;
    }
    case 'eat': {
      if (foods.length === 0) {
        pickNextBehavior();
        break;
      }
      const target = foods[0];
      const dx = target.x - hammy.x;
      if (Math.abs(dx) > 6) {
        hammy.flip = dx < 0;
        hammy.x += Math.sign(dx) * 85 * dt;
      } else if (target.y >= FLOOR_Y - 6) {
        foods.shift();
        sfx.munch();
        spawnParticles('heart', hammy.x, hammy.y - 24, 2);
        hammy.mode = 'happy';
        hammy.modeTimer = 0.8;
      }
      break;
    }
    case 'wheel': {
      const wx = 268;
      const dx = wx - hammy.x;
      if (Math.abs(dx) > 3) {
        hammy.flip = dx < 0;
        hammy.x += Math.sign(dx) * 75 * dt;
      } else {
        hammy.flip = false;
        hammy.y = FLOOR_Y - 12;
      }
      break;
    }
    case 'tunnel': {
      const entryX = 128;
      const exitX = 192;
      if (!hammy.inTunnel) {
        const dx = entryX - hammy.x;
        if (Math.abs(dx) > 3) {
          hammy.flip = dx < 0;
          hammy.x += Math.sign(dx) * 80 * dt;
        } else {
          hammy.inTunnel = true;
          hammy.modeTimer = 1.0;
        }
      } else if (hammy.modeTimer <= 0.35) {
        hammy.x = exitX;
        hammy.flip = false;
        hammy.inTunnel = false;
        hammy.vy = -40;
        hammy.mode = 'wander';
        hammy.targetX = exitX + 24;
        hammy.modeTimer = 1.0;
      }
      break;
    }
    case 'sand': {
      const sx = 62;
      const dx = sx - hammy.x;
      if (Math.abs(dx) > 3) {
        hammy.flip = dx < 0;
        hammy.x += Math.sign(dx) * 70 * dt;
      } else {
        if (Math.random() < dt * 7) {
          spawnParticles('sparkle', sx, FLOOR_Y - 10, 1, { color: '#fff3b0' });
        }
      }
      break;
    }
    case 'sleep': {
      if (Math.random() < dt * 1.4) {
        spawnParticles('text', hammy.x + 10, hammy.y - 24, 1, { text: 'Z', color: '#a0c4ff' });
      }
      break;
    }
  }

  if (hammy.modeTimer <= 0 && hammy.mode !== 'eat') {
    pickNextBehavior();
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawCage() {
  // Background wall
  ctx.fillStyle = state.night ? '#1f1a2e' : '#ffe8d6';
  ctx.fillRect(0, 0, W, FLOOR_Y);

  // Window
  ctx.fillStyle = state.night ? '#2e2b4f' : '#bde0fe';
  ctx.fillRect(130, 26, 60, 44);
  ctx.strokeStyle = '#6f4e37';
  ctx.lineWidth = 2;
  ctx.strokeRect(130, 26, 60, 44);
  ctx.beginPath();
  ctx.moveTo(160, 26);
  ctx.lineTo(160, 70);
  ctx.moveTo(130, 48);
  ctx.lineTo(190, 48);
  ctx.stroke();

  if (state.night) {
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(172, 34, 8, 8); // pixel moon
  }

  // Fairy lights
  for (let x = 20; x < W; x += 28) {
    ctx.fillStyle = '#4a3525';
    ctx.fillRect(x, 8, 28, 1);
    const glow = Math.sin(hammy.animTick * 3 + x) > 0;
    ctx.fillStyle = state.night ? (glow ? '#ffd166' : '#ff7b9c') : '#ffd166';
    ctx.fillRect(x + 12, 9, 4, 4);
  }

  // Bedding floor
  ctx.fillStyle = state.night ? '#6b4f35' : '#e6ccb2';
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.fillStyle = state.night ? '#523b26' : '#ddb892';
  for (let x = 4; x < W; x += 14) {
    ctx.fillRect(x, FLOOR_Y + 4 + ((x * 7) % 14), 6, 2);
  }

  // Water bottle (left wall)
  ctx.fillStyle = '#a2d2ff';
  ctx.fillRect(14, 92, 12, 26);
  ctx.fillStyle = '#3b2416';
  ctx.strokeRect(14, 92, 12, 26);
  ctx.fillStyle = '#adb5bd';
  ctx.fillRect(18, 118, 4, 10);

  // Sand bath (left-ish)
  ctx.fillStyle = '#ffcad4';
  ctx.fillRect(42, FLOOR_Y - 10, 40, 10);
  ctx.fillStyle = '#f4e1c1';
  ctx.fillRect(45, FLOOR_Y - 8, 34, 4);

  // Pixel Tunnel (center)
  ctx.fillStyle = '#8ecae6';
  ctx.fillRect(134, FLOOR_Y - 20, 52, 20);
  ctx.fillStyle = '#219ebc';
  ctx.fillRect(134, FLOOR_Y - 20, 52, 4);
  ctx.fillStyle = '#023047';
  ctx.fillRect(130, FLOOR_Y - 16, 6, 16);
  ctx.fillRect(184, FLOOR_Y - 16, 6, 16);

  // Hamster Wheel (right)
  const wx = 268;
  const wy = FLOOR_Y - 24;
  ctx.strokeStyle = '#ff7b9c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(wx, wy, 22, 0, Math.PI * 2);
  ctx.stroke();
  // Spokes
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = toys.wheelAngle + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(a) * 21, wy + Math.sin(a) * 21);
    ctx.stroke();
  }
  // Stand
  ctx.fillStyle = '#6f4e37';
  ctx.fillRect(wx - 3, wy, 6, FLOOR_Y - wy);

  // Bouncy Toy Ball
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(Math.round(toys.ballX - 5), Math.round(toys.ballY - 5), 10, 10);
  ctx.fillStyle = '#ff7b9c';
  ctx.fillRect(Math.round(toys.ballX - 2), Math.round(toys.ballY - 5), 4, 10);

  // Messes
  for (const m of messes) {
    ctx.fillStyle = '#6f4e37';
    ctx.fillRect(Math.round(m.x - 3), Math.round(m.y - 3), 6, 4);
  }

  // Foods
  for (const f of foods) {
    drawFoodSprite(ctx, f.type, f.x, f.y, 2);
  }

  // Hamster
  if (!hammy.inTunnel) {
    let frame = 'idle1';
    if (hammy.mode === 'sleep') frame = 'sleep';
    else if (hammy.mode === 'happy') frame = 'happy';
    else if (hammy.mode === 'eat') frame = Math.floor(hammy.animTick * 8) % 2 ? 'eat1' : 'idle1';
    else if (hammy.mode === 'wheel' || hammy.mode === 'zoomies' || hammy.mode === 'wander') {
      const rate = hammy.mode === 'wander' ? 7 : 13;
      frame = Math.floor(hammy.animTick * rate) % 2 ? 'walk1' : 'walk2';
    } else {
      frame = Math.floor(hammy.animTick * 3) % 2 ? 'idle1' : 'idle2';
    }
    drawHamster(ctx, hammy.x, hammy.y, frame, state.fur, hammy.flip, 2);
  }

  // Particles
  for (const p of particles) {
    if (p.kind === 'heart') {
      drawHeart(ctx, p.x, p.y, 1.5);
    } else if (p.kind === 'text') {
      ctx.fillStyle = p.color || '#fff';
      ctx.font = 'bold 9px Silkscreen, monospace';
      ctx.fillText(p.text, Math.round(p.x), Math.round(p.y));
    } else {
      ctx.fillStyle = p.color || '#fff';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
  }

  // Remote Co-op Cursor
  if (remoteCursor && performance.now() < remoteCursor.expiresAt) {
    const cx = Math.round(remoteCursor.x);
    const cy = Math.round(remoteCursor.y);
    drawHeart(ctx, cx, cy, 1.5, '#ff4d79');
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(cx + 6, cy - 10, remoteCursor.name.length * 6 + 6, 11);
    ctx.fillStyle = '#fff';
    ctx.font = '8px Silkscreen, monospace';
    ctx.fillText(remoteCursor.name, cx + 9, cy - 2);
  }
}

// Canvas interactions
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

canvas.addEventListener('click', (e) => {
  const { x, y } = getCanvasCoords(e);
  if (Math.hypot(x - hammy.x, y - (hammy.y - 14)) < 24) {
    applyAction('pet');
    return;
  }
  for (const m of messes) {
    if (Math.hypot(x - m.x, y - m.y) < 16) {
      applyAction('clean');
      return;
    }
  }
  if (Math.hypot(x - 268, y - (FLOOR_Y - 24)) < 28) {
    applyAction('wheel');
    return;
  }
  if (x >= 126 && x <= 194 && y >= FLOOR_Y - 26) {
    applyAction('tunnel');
    return;
  }
  if (x >= 40 && x <= 84 && y >= FLOOR_Y - 18) {
    applyAction('sand');
    return;
  }
  applyAction('goto', { x });
});

let lastCursorSent = 0;
canvas.addEventListener('mousemove', (e) => {
  const now = performance.now();
  if (now - lastCursorSent < 90) return;
  lastCursorSent = now;
  const { x, y } = getCanvasCoords(e);
  coop.send('cursor', { x, y });
});

// Button bindings
document.querySelectorAll('.food-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyAction('feed', { type: btn.dataset.food }));
});
document.getElementById('btn-water').addEventListener('click', () => applyAction('water'));
document.getElementById('btn-pet').addEventListener('click', () => applyAction('pet'));
document.getElementById('btn-wheel').addEventListener('click', () => applyAction('wheel'));
document.getElementById('btn-tunnel').addEventListener('click', () => applyAction('tunnel'));
document.getElementById('btn-sand').addEventListener('click', () => applyAction('sand'));
document.getElementById('btn-ball').addEventListener('click', () => applyAction('ball'));
document.getElementById('btn-clean').addEventListener('click', () => applyAction('clean'));
document.getElementById('btn-sleep').addEventListener('click', () =>
  applyAction('sleep', { night: !state.night })
);
document.getElementById('btn-sound').addEventListener('click', () => {
  sfx.toggleMute();
  updateUI();
});

// Emotes & Notes
document.querySelectorAll('.emote-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    let emote = btn.dataset.emote;
    if (btn.dataset.note) {
      const msg = window.prompt('Tulis catatan lucu untuk kandang:');
      if (!msg) return;
      emote = msg.slice(0, 28);
    }
    sfx.heart();
    spawnParticles('text', 160, 88, 1, { text: `Kamu: ${emote}`, color: '#ff4d79' });
    spawnParticles('heart', hammy.x, hammy.y - 26, 3);
    showToast(`Kamu: ${emote}`);
    addLog(`Kamu kirim "${emote}"`);
    coop.send('emote', { emote });
  });
});

// Modals
document.querySelectorAll('.close-modal').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).classList.add('hidden');
  });
});

document.getElementById('btn-rename').addEventListener('click', () => {
  document.getElementById('input-pet-name').value = state.name;
  document.querySelectorAll('.fur-chip').forEach((c) => {
    c.classList.toggle('selected', c.dataset.fur === state.fur);
  });
  document.getElementById('modal-pet').classList.remove('hidden');
});

let selectedFur = state.fur;
document.querySelectorAll('.fur-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    selectedFur = chip.dataset.fur;
    document.querySelectorAll('.fur-chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
  });
});

document.getElementById('btn-save-pet').addEventListener('click', () => {
  const newName = document.getElementById('input-pet-name').value.trim().toUpperCase() || 'MOCHI';
  applyAction('profile', { name: newName, fur: selectedFur });
  document.getElementById('modal-pet').classList.add('hidden');
});

// Room Modal
document.getElementById('btn-room').addEventListener('click', () => {
  document.getElementById('input-player-name').value = coop.playerName;
  document.getElementById('input-room-code').value = coop.roomCode;
  const creds = coop.getCredentials();
  document.getElementById('input-sb-url').value = creds.url;
  document.getElementById('input-sb-key').value = creds.key;
  document.getElementById('modal-room').classList.remove('hidden');
});

document.getElementById('btn-join-room').addEventListener('click', async () => {
  const pName = document.getElementById('input-player-name').value;
  const rCode = document.getElementById('input-room-code').value;
  const ok = await coop.connect(rCode, pName);
  showToast(ok ? `Masuk room ${coop.roomCode}!` : 'Isi Supabase URL & Key dulu untuk online');
  document.getElementById('modal-room').classList.add('hidden');
});

document.getElementById('btn-copy-link').addEventListener('click', async () => {
  const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
    document.getElementById('input-room-code').value.trim() || coop.roomCode
  )}`;
  await navigator.clipboard.writeText(url);
  showToast('Link invite tersalin! Kirim ke dia 💌');
});

document.getElementById('btn-save-sb').addEventListener('click', async () => {
  const u = document.getElementById('input-sb-url').value;
  const k = document.getElementById('input-sb-key').value;
  coop.saveCredentials(u, k);
  const ok = await coop.connect(
    document.getElementById('input-room-code').value,
    document.getElementById('input-player-name').value
  );
  showToast(ok ? 'Terhubung ke Supabase Realtime!' : 'URL/Key belum lengkap');
});

// Main loop
let lastTime = performance.now();
let uiTimer = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  updateSimulation(dt);
  drawCage();

  uiTimer += dt;
  if (uiTimer > 0.8) {
    uiTimer = 0;
    updateUI();
    saveState();
  }

  requestAnimationFrame(loop);
}

// Init
updateUI();
addLog(`${state.name} lagi lari-larian di kandang!`);
coop.connect();
requestAnimationFrame(loop);
