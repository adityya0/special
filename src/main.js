import './style.css';
import { drawHamster, drawFoodSprite, drawHeart, drawAccessory } from './sprites.js';
import { sfx } from './sound.js';
import { CoopRealtime } from './realtime.js';

const canvas = document.getElementById('cage-canvas');
const ctx = canvas.getContext('2d');
const W = 320;
const H = 200;
const FLOOR_Y = 172;

// Persistent browser-only cage state (no database!)
const DEFAULT_STATE = {
  name: localStorage.getItem('hammy_player') || 'MOCHI',
  fur: localStorage.getItem('hammy_fur') || 'golden',
  acc: localStorage.getItem('hammy_acc') || 'none',
  hunger: 82,
  happy: 88,
  energy: 90,
  hygiene: 85,
  night: false,
  scene: 'cage', // cage | garden | explore
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

function createHamster(id, name, fur, startX = 160, acc = 'none') {
  return {
    id,
    name: name || 'MOCHI',
    fur: fur || 'golden',
    acc: acc || 'none',
    x: startX,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    targetX: startX,
    flip: false,
    mode: 'wander', // wander | zoomies | wheel | tunnel | sand | eat | happy | sleep
    modeTimer: 1.2 + Math.random(),
    animTick: Math.random() * 5,
    inTunnel: false,
  };
}

// Map<clientId, Hamster> - every visitor in the room gets their own hamster!
const hamsters = new Map();
// Track mutual effort per visitor (need >= REQUIRED_EFFORT from both sides to hug!)
const REQUIRED_EFFORT = 3;
const efforts = new Map(); // Map<clientId, number>

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
let lastMeetHeart = 0;

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
  const myHammy = hamsters.get(coop.clientId);
  elTitle.textContent = myHammy ? myHammy.name : state.name;
  bars.hunger.style.width = `${clamp(state.hunger)}%`;
  bars.happy.style.width = `${clamp(state.happy)}%`;
  bars.energy.style.width = `${clamp(state.energy)}%`;
  bars.hygiene.style.width = `${clamp(state.hygiene)}%`;
  document.getElementById('btn-sound').textContent = sfx.muted ? '🔇' : '🔊';
  document.getElementById('btn-sleep').textContent = state.night ? '☀️ Lampu' : '🌙 Lampu';
  document.querySelectorAll('.scene-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.scene === state.scene);
  });
  document.querySelectorAll('#inline-acc-picker .acc-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.acc === state.acc);
  });
  updateHugButton();
}

function getEffort(id) {
  return Math.min(REQUIRED_EFFORT, efforts.get(id) || 0);
}

function addEffort(id) {
  if (!id) return;
  efforts.set(id, Math.min(REQUIRED_EFFORT, (efforts.get(id) || 0) + 1));
}

function getPartnerHammy() {
  for (const [id, h] of hamsters.entries()) {
    if (id !== coop.clientId) return h;
  }
  return null;
}

function updateHugButton() {
  const btn = document.getElementById('btn-hug');
  if (!btn) return;
  const myEff = getEffort(coop.clientId);
  const partner = getPartnerHammy();
  if (!partner) {
    btn.textContent = `🤗 Peluk (${myEff}/${REQUIRED_EFFORT} • Belum ada dia)`;
    btn.classList.remove('ready');
    return;
  }
  const partnerEff = getEffort(partner.id);
  const ready = myEff >= REQUIRED_EFFORT && partnerEff >= REQUIRED_EFFORT;
  btn.textContent = ready
    ? '🤗 Peluk Bareng! ✨'
    : `🤗 Peluk (${myEff}/${REQUIRED_EFFORT} • ${partnerEff}/${REQUIRED_EFFORT})`;
  btn.classList.toggle('ready', ready);
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

    // Sync hamsters for all peers currently in the room
    const activeIds = new Set([coop.clientId]);
    for (const p of peers) {
      if (!p.clientId) continue;
      activeIds.add(p.clientId);
      const existing = hamsters.get(p.clientId);
      if (!existing) {
        const spawnX = 80 + Math.random() * 160;
        const nh = createHamster(p.clientId, p.name || 'Teman', p.fur || 'snow', spawnX, p.acc || 'none');
        nh.vy = -50;
        hamsters.set(p.clientId, nh);
        sfx.heart();
        spawnParticles('heart', spawnX, FLOOR_Y - 24, 5);
        showToast(`✨ ${nh.name} bergabung ke kandang!`);
        addLog(`${nh.name} masuk kandang 🐹`);
      } else {
        existing.name = p.name || existing.name;
        existing.fur = p.fur || existing.fur;
        existing.acc = p.acc || 'none';
      }
    }

    // Remove hamsters of visitors who left
    for (const [id, h] of hamsters.entries()) {
      if (!activeIds.has(id)) {
        hamsters.delete(id);
        addLog(`${h.name} keluar dari kandang`);
      }
    }

    elPresencePill.className = 'presence-pill online';
    const peerNames = peers.map((p) => p.name).filter(Boolean);
    elPresenceText.textContent =
      onlineCount > 1
        ? `${onlineCount} Hamster Online (${peerNames.join(', ')}) 💕`
        : `Room ${coop.roomCode} (1 Online)`;

    if (onlineCount > 1) {
      coop.send('sync_state', {
        state: {
          hunger: state.hunger,
          happy: state.happy,
          energy: state.energy,
          hygiene: state.hygiene,
          night: state.night,
          scene: state.scene,
        },
      });
    }
  },
  onRemoteAction: (payload) => {
    applyAction(payload.action, payload.data, payload.senderName, false, payload.senderId);
  },
  onRemoteCursor: ({ x, y, senderName }) => {
    remoteCursor = { x, y, name: senderName || 'Teman', expiresAt: performance.now() + 2500 };
  },
  onRemoteEmote: ({ emote, senderName, senderId }) => {
    addEffort(senderId);
    sfx.heart();
    spawnParticles('text', 140, 88, 1, { text: `${senderName}: ${emote}`, color: '#ff4d79' });
    const myHammy = hamsters.get(coop.clientId);
    if (myHammy) spawnParticles('heart', myHammy.x, myHammy.y - 26, 4);
    showToast(`${senderName}: ${emote}`);
    addLog(`${senderName} kirim "${emote}"`);
    updateUI();
  },
  onSyncState: ({ state: incoming }) => {
    if (!incoming) return;
    state.hunger = incoming.hunger ?? state.hunger;
    state.happy = incoming.happy ?? state.happy;
    state.energy = incoming.energy ?? state.energy;
    state.hygiene = incoming.hygiene ?? state.hygiene;
    if (typeof incoming.night === 'boolean') state.night = incoming.night;
    if (incoming.scene) state.scene = incoming.scene;
    saveState();
    updateUI();
  },
});

// Spawn local visitor's hamster
hamsters.set(coop.clientId, createHamster(coop.clientId, state.name, state.fur, 140, state.acc));

function applyAction(action, data = {}, actor = state.name, broadcast = true, actorId = coop.clientId) {
  if (broadcast) {
    coop.send('action', { action, data });
  }

  // Count mutual effort for caring/playing actions (not passive goto/scene/hug)
  if (['feed', 'water', 'pet', 'wheel', 'tunnel', 'sand', 'ball', 'clean'].includes(action)) {
    addEffort(actorId);
  }

  const targetHammy =
    (data.targetId && hamsters.get(data.targetId)) ||
    hamsters.get(actorId) ||
    hamsters.get(coop.clientId);

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
      if (targetHammy) {
        targetHammy.mode = 'wander';
        targetHammy.targetX = 32;
      }
      spawnParticles('sparkle', 30, 128, 5, { color: '#54a0ff' });
      addLog(`${actor} kasih minum`);
      break;
    }
    case 'pet': {
      sfx.squeak();
      sfx.heart();
      state.happy = clamp(state.happy + 14);
      if (targetHammy) {
        targetHammy.mode = 'happy';
        targetHammy.modeTimer = 1.4;
        targetHammy.vy = -55;
        spawnParticles('heart', targetHammy.x, targetHammy.y - 26, 5);
        addLog(`${actor} elus ${targetHammy.name} ❤️`);
      }
      break;
    }
    case 'wheel': {
      sfx.squeak();
      if (targetHammy) {
        targetHammy.mode = 'wheel';
        targetHammy.modeTimer = 4.2;
      }
      toys.wheelSpeed = 11;
      state.happy = clamp(state.happy + 12);
      state.energy = clamp(state.energy - 5);
      addLog(`${actor} putar roda lari!`);
      break;
    }
    case 'tunnel': {
      sfx.squeak();
      if (targetHammy) {
        targetHammy.mode = 'tunnel';
        targetHammy.modeTimer = 2.6;
        targetHammy.inTunnel = false;
      }
      state.happy = clamp(state.happy + 10);
      addLog(`${actor} ajak main terowongan`);
      break;
    }
    case 'sand': {
      sfx.splash();
      if (targetHammy) {
        targetHammy.mode = 'sand';
        targetHammy.modeTimer = 3.0;
      }
      state.hygiene = clamp(state.hygiene + 24);
      state.happy = clamp(state.happy + 8);
      addLog(`${actor} mandikan pasir ✨`);
      break;
    }
    case 'ball': {
      sfx.squeak();
      toys.ballVx = (Math.random() > 0.5 ? 1 : -1) * 110;
      toys.ballVy = -95;
      if (targetHammy) {
        targetHammy.mode = 'zoomies';
        targetHammy.modeTimer = 2.5;
        targetHammy.targetX = toys.ballX;
      }
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
      for (const h of hamsters.values()) {
        h.mode = state.night ? 'sleep' : 'zoomies';
        h.modeTimer = state.night ? 6 : 2;
      }
      addLog(`${actor} ${state.night ? 'matikan lampu 🌙' : 'nyalakan lampu ☀️'}`);
      break;
    }
    case 'goto': {
      if (targetHammy) {
        targetHammy.mode = 'zoomies';
        targetHammy.targetX = clamp(data.x ?? 160, 26, W - 26);
        targetHammy.modeTimer = 1.6;
      }
      break;
    }
    case 'drag': {
      if (targetHammy) {
        targetHammy.inTunnel = false;
        targetHammy.mode = 'drag';
        targetHammy.x = clamp(data.x ?? targetHammy.x, 18, W - 18);
        targetHammy.y = clamp(data.y ?? targetHammy.y, 34, FLOOR_Y);
        targetHammy.vy = 0;
        targetHammy.modeTimer = 1.0;
      }
      break;
    }
    case 'drop': {
      if (targetHammy) {
        targetHammy.x = clamp(data.x ?? targetHammy.x, 18, W - 18);
        targetHammy.y = clamp(data.y ?? targetHammy.y, 34, FLOOR_Y);
        targetHammy.vy = 20;
        targetHammy.mode = 'zoomies';
        targetHammy.targetX = clamp(
          targetHammy.x + (Math.random() > 0.5 ? 60 : -60),
          26,
          W - 26
        );
        targetHammy.modeTimer = 1.6;
      }
      break;
    }
    case 'scene': {
      const nextScene = data.scene || 'cage';
      state.scene = nextScene;
      const labels = { cage: '🏠 Kandang', garden: '🌿 Taman Rumput', explore: '⛺ Explore Bukit' };
      for (const h of hamsters.values()) {
        h.inTunnel = false;
        h.mode = 'zoomies';
        h.targetX = 50 + Math.random() * 220;
        h.modeTimer = 1.5;
      }
      showToast(`Pindah ke ${labels[nextScene] || nextScene}!`);
      addLog(`${actor} ajak pindah ke ${labels[nextScene] || nextScene}`);
      break;
    }
    case 'hug': {
      const list = [...hamsters.values()];
      if (list.length < 2) break;
      const a = list[0];
      const b = list[1];
      const meetX = 160;
      a.inTunnel = false;
      b.inTunnel = false;
      a.mode = 'hug';
      b.mode = 'hug';
      a.modeTimer = 3.2;
      b.modeTimer = 3.2;
      a.targetX = meetX - 10;
      b.targetX = meetX + 10;
      state.happy = clamp(state.happy + 25);
      efforts.set(a.id, 0);
      efforts.set(b.id, 0);
      sfx.heart();
      spawnParticles('heart', meetX, FLOOR_Y - 34, 9);
      showToast(`🥰 ${a.name} & ${b.name} berpelukan!`);
      addLog(`💞 ${a.name} & ${b.name} saling peluk (timbal balik tercapai!)`);
      break;
    }
  }

  saveState();
  updateUI();
}

// Autonomous "ga bisa diem" AI per hamster
function pickNextBehavior(h) {
  if (state.night || state.energy < 14) {
    h.mode = 'sleep';
    h.modeTimer = 4 + Math.random() * 4;
    return;
  }

  if (foods.length > 0) {
    h.mode = 'eat';
    h.modeTimer = 2.5;
    return;
  }

  const roll = Math.random();
  if (state.scene !== 'cage') {
    if (roll < 0.5) {
      h.mode = 'wander';
      h.targetX = 28 + Math.random() * (W - 56);
      h.modeTimer = 1.4 + Math.random() * 1.4;
    } else {
      h.mode = 'zoomies';
      h.targetX = 28 + Math.random() * (W - 56);
      h.modeTimer = 1.2 + Math.random() * 1.0;
    }
    return;
  }

  if (roll < 0.34) {
    h.mode = 'wander';
    h.targetX = 28 + Math.random() * (W - 56);
    h.modeTimer = 1.4 + Math.random() * 1.4;
  } else if (roll < 0.58) {
    h.mode = 'zoomies';
    h.targetX = 28 + Math.random() * (W - 56);
    h.modeTimer = 1.2 + Math.random() * 1.0;
  } else if (roll < 0.74) {
    h.mode = 'wheel';
    h.modeTimer = 3.2 + Math.random() * 2.0;
    toys.wheelSpeed = 8;
  } else if (roll < 0.88) {
    h.mode = 'tunnel';
    h.modeTimer = 2.4;
    h.inTunnel = false;
  } else {
    h.mode = 'sand';
    h.modeTimer = 2.4;
  }
}

function updateSimulation(dt) {
  // Gradual stat decay
  state.hunger = clamp(state.hunger - dt * 0.45);
  state.hygiene = clamp(state.hygiene - dt * 0.25);
  const allSleeping = [...hamsters.values()].every((h) => h.mode === 'sleep');
  if (allSleeping) {
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
    toys.ballVy = Math.abs(toys.ballVy) > 25 ? -toys.ballVy * 0.55 : 0;
  }
  if (toys.ballX < 20 || toys.ballX > W - 20) {
    toys.ballVx *= -0.8;
    toys.ballX = clamp(toys.ballX, 20, W - 20);
  }
  toys.ballVx *= 0.985;

  // Wheel friction
  const someoneOnWheel = [...hamsters.values()].some((h) => h.mode === 'wheel');
  if (someoneOnWheel) {
    toys.wheelSpeed = Math.max(toys.wheelSpeed, 9);
  } else {
    toys.wheelSpeed *= 0.96;
  }
  toys.wheelAngle += toys.wheelSpeed * dt;

  // Update each hamster
  for (const h of hamsters.values()) {
    h.animTick += dt;

    if (h.mode === 'drag') {
      continue;
    }

    h.modeTimer -= dt;

    if (h.y < FLOOR_Y || h.vy < 0) {
      h.vy += 320 * dt;
      h.y = Math.min(FLOOR_Y, h.y + h.vy * dt);
      if (h.y >= FLOOR_Y) {
        // Cute tiny bounce when landing from a drop!
        if (h.vy > 110) {
          h.vy = -h.vy * 0.25;
          spawnParticles('dust', h.x, FLOOR_Y - 2, 3, { color: '#e6ccb2' });
        } else {
          h.vy = 0;
        }
      }
    }

    if (foods.length > 0 && h.mode !== 'sleep') {
      h.mode = 'eat';
    }

    switch (h.mode) {
      case 'wander':
      case 'zoomies': {
        const speed = h.mode === 'zoomies' ? 92 : 42;
        const dx = h.targetX - h.x;
        if (Math.abs(dx) > 3) {
          h.flip = dx < 0;
          h.x += Math.sign(dx) * speed * dt;
          if (h.mode === 'zoomies' && Math.random() < dt * 8) {
            spawnParticles('dust', h.x, FLOOR_Y - 2, 1, { color: '#e6ccb2' });
          }
        } else if (h.modeTimer <= 0) {
          pickNextBehavior(h);
        }
        break;
      }
      case 'eat': {
        if (foods.length === 0) {
          pickNextBehavior(h);
          break;
        }
        const target = foods[0];
        const dx = target.x - h.x;
        if (Math.abs(dx) > 6) {
          h.flip = dx < 0;
          h.x += Math.sign(dx) * 85 * dt;
        } else if (target.y >= FLOOR_Y - 6) {
          foods.shift();
          sfx.munch();
          spawnParticles('heart', h.x, h.y - 24, 2);
          h.mode = 'happy';
          h.modeTimer = 0.8;
        }
        break;
      }
      case 'wheel': {
        const wx = 268;
        const dx = wx - h.x;
        if (Math.abs(dx) > 3) {
          h.flip = dx < 0;
          h.x += Math.sign(dx) * 75 * dt;
        } else {
          h.flip = false;
          h.y = FLOOR_Y - 12;
        }
        break;
      }
      case 'tunnel': {
        const entryX = 128;
        const exitX = 192;
        if (!h.inTunnel) {
          const dx = entryX - h.x;
          if (Math.abs(dx) > 3) {
            h.flip = dx < 0;
            h.x += Math.sign(dx) * 80 * dt;
          } else {
            h.inTunnel = true;
            h.modeTimer = 1.0;
          }
        } else if (h.modeTimer <= 0.35) {
          h.x = exitX;
          h.flip = false;
          h.inTunnel = false;
          h.vy = -40;
          h.mode = 'wander';
          h.targetX = exitX + 24;
          h.modeTimer = 1.0;
        }
        break;
      }
      case 'sand': {
        const sx = 62;
        const dx = sx - h.x;
        if (Math.abs(dx) > 3) {
          h.flip = dx < 0;
          h.x += Math.sign(dx) * 70 * dt;
        } else if (Math.random() < dt * 7) {
          spawnParticles('sparkle', sx, FLOOR_Y - 10, 1, { color: '#fff3b0' });
        }
        break;
      }
      case 'sleep': {
        if (Math.random() < dt * 1.4) {
          spawnParticles('text', h.x + 10, h.y - 24, 1, { text: 'Z', color: '#a0c4ff' });
        }
        break;
      }
      case 'hug': {
        const dx = h.targetX - h.x;
        if (Math.abs(dx) > 2) {
          h.flip = dx < 0;
          h.x += Math.sign(dx) * 95 * dt;
        } else {
          h.flip = h.targetX > 160;
          if (Math.random() < dt * 4) {
            spawnParticles('heart', 160, FLOOR_Y - 30, 1);
          }
        }
        break;
      }
    }

    if (h.modeTimer <= 0 && h.mode !== 'eat') {
      pickNextBehavior(h);
    }
  }

  // Cute interaction when 2 hamsters meet in the cage!
  const list = [...hamsters.values()];
  if (list.length >= 2 && performance.now() - lastMeetHeart > 4500) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.inTunnel && !b.inTunnel && Math.abs(a.x - b.x) < 22 && Math.abs(a.y - b.y) < 12) {
          lastMeetHeart = performance.now();
          spawnParticles('heart', (a.x + b.x) / 2, Math.min(a.y, b.y) - 28, 3);
          break;
        }
      }
    }
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

function drawNameTag(x, y, label, isLocal) {
  ctx.font = 'bold 8px Silkscreen, monospace';
  const textW = ctx.measureText(label).width;
  const padX = 4;
  const boxW = Math.ceil(textW + padX * 2);
  const bx = Math.round(x - boxW / 2);
  const by = Math.round(y - 10);

  ctx.fillStyle = isLocal ? '#ff7b9c' : '#3b2416';
  ctx.fillRect(bx, by, boxW, 10);
  ctx.strokeStyle = '#3b2416';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, boxW, 10);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, bx + padX, by + 8);
}

function drawSceneEnvironment(tick) {
  if (state.scene === 'garden') {
    // Sky
    ctx.fillStyle = state.night ? '#1d2440' : '#a8e0ff';
    ctx.fillRect(0, 0, W, FLOOR_Y);

    // Sun / Moon & Stars
    if (state.night) {
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(264, 22, 12, 12);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 14; i++) {
        ctx.fillRect((i * 53 + 17) % W, (i * 29 + 10) % 90, 2, 2);
      }
    } else {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(262, 20, 16, 16);
      // Moving pixel clouds
      const c1 = ((tick * 8) % (W + 60)) - 30;
      const c2 = ((tick * 5 + 140) % (W + 60)) - 30;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(c1), 28, 28, 8);
      ctx.fillRect(Math.round(c1 + 6), 22, 16, 6);
      ctx.fillRect(Math.round(c2), 46, 24, 7);
      ctx.fillRect(Math.round(c2 + 5), 41, 14, 5);
    }

    // Distant hills
    ctx.fillStyle = state.night ? '#264639' : '#80ed99';
    ctx.fillRect(0, FLOOR_Y - 26, W, 26);

    // Grass floor
    ctx.fillStyle = state.night ? '#2d6a4f' : '#57cc99';
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.fillStyle = state.night ? '#40916c' : '#38b000';
    for (let x = 6; x < W; x += 16) {
      ctx.fillRect(x, FLOOR_Y - 3, 2, 3);
      ctx.fillRect(x + 4, FLOOR_Y - 2, 2, 2);
    }

    // Pixel Tree (left)
    ctx.fillStyle = '#6f4e37';
    ctx.fillRect(28, FLOOR_Y - 46, 12, 46);
    ctx.fillStyle = state.night ? '#1b4332' : '#38b000';
    ctx.fillRect(14, FLOOR_Y - 74, 40, 32);
    ctx.fillRect(22, FLOOR_Y - 84, 24, 12);

    // Picnic Blanket (center)
    ctx.fillStyle = '#ff7b9c';
    ctx.fillRect(118, FLOOR_Y - 2, 84, 12);
    ctx.fillStyle = '#fffaf3';
    for (let px = 122; px < 198; px += 12) {
      ctx.fillRect(px, FLOOR_Y, 6, 4);
      ctx.fillRect(px + 6, FLOOR_Y + 4, 6, 4);
    }

    // Pixel Flowers & Butterflies
    const flowerColors = ['#ff7b9c', '#ffd166', '#cdb4db'];
    for (let i = 0; i < 5; i++) {
      const fx = 72 + i * 48;
      ctx.fillStyle = '#2d6a4f';
      ctx.fillRect(fx, FLOOR_Y - 6, 2, 6);
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.fillRect(fx - 2, FLOOR_Y - 10, 6, 5);
    }
    const bx = 95 + Math.sin(tick * 2.2) * 35;
    const by = 112 + Math.cos(tick * 3.5) * 12;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(Math.round(bx), Math.round(by), 4, 3);
    ctx.fillRect(Math.round(bx + 3), Math.round(by - 2), 3, 3);
    return;
  }

  if (state.scene === 'explore') {
    // Twilight / Starry Hill Sky
    ctx.fillStyle = state.night ? '#0f1024' : '#3d348b';
    ctx.fillRect(0, 0, W, FLOOR_Y);

    // Twinkling stars & crescent moon
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(42, 22, 12, 12);
    ctx.fillStyle = state.night ? '#0f1024' : '#3d348b';
    ctx.fillRect(46, 20, 10, 10);
    for (let i = 0; i < 18; i++) {
      const blink = Math.sin(tick * 3 + i) > -0.3;
      if (blink) {
        ctx.fillStyle = '#fffaf3';
        ctx.fillRect((i * 47 + 19) % W, (i * 23 + 12) % 95, 2, 2);
      }
    }

    // Pixel Mountains
    ctx.fillStyle = '#5e548e';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(70, 88);
    ctx.lineTo(150, FLOOR_Y);
    ctx.lineTo(220, 78);
    ctx.lineTo(320, FLOOR_Y);
    ctx.fill();

    // Trail & Grass
    ctx.fillStyle = '#386641';
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.fillStyle = '#bc8a5f';
    ctx.fillRect(0, FLOOR_Y + 4, W, 12);

    // Wooden Signpost (left)
    ctx.fillStyle = '#6f4e37';
    ctx.fillRect(36, FLOOR_Y - 30, 4, 30);
    ctx.fillStyle = '#ddb892';
    ctx.fillRect(24, FLOOR_Y - 28, 28, 10);

    // Campfire (center-right)
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(210, FLOOR_Y - 4, 18, 4);
    const flicker = Math.floor(tick * 10) % 2;
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect(213, FLOOR_Y - 14 - flicker * 2, 12, 10);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(216, FLOOR_Y - 10, 6, 6);

    // Fireflies
    for (let i = 0; i < 6; i++) {
      const fx = 60 + i * 44 + Math.sin(tick * 1.5 + i) * 14;
      const fy = 120 + Math.cos(tick * 2 + i * 2) * 18;
      ctx.fillStyle = '#e9ff70';
      ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
    }
    return;
  }

  // Default: Cage
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
    ctx.fillRect(172, 34, 8, 8);
  }

  // Fairy lights
  for (let x = 20; x < W; x += 28) {
    ctx.fillStyle = '#4a3525';
    ctx.fillRect(x, 8, 28, 1);
    const glow = Math.sin(tick * 3 + x) > 0;
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

  // Water bottle
  ctx.fillStyle = '#a2d2ff';
  ctx.fillRect(14, 92, 12, 26);
  ctx.fillStyle = '#3b2416';
  ctx.strokeRect(14, 92, 12, 26);
  ctx.fillStyle = '#adb5bd';
  ctx.fillRect(18, 118, 4, 10);

  // Sand bath
  ctx.fillStyle = '#ffcad4';
  ctx.fillRect(42, FLOOR_Y - 10, 40, 10);
  ctx.fillStyle = '#f4e1c1';
  ctx.fillRect(45, FLOOR_Y - 8, 34, 4);

  // Pixel Tunnel
  ctx.fillStyle = '#8ecae6';
  ctx.fillRect(134, FLOOR_Y - 20, 52, 20);
  ctx.fillStyle = '#219ebc';
  ctx.fillRect(134, FLOOR_Y - 20, 52, 4);
  ctx.fillStyle = '#023047';
  ctx.fillRect(130, FLOOR_Y - 16, 6, 16);
  ctx.fillRect(184, FLOOR_Y - 16, 6, 16);

  // Hamster Wheel
  const wx = 268;
  const wy = FLOOR_Y - 24;
  ctx.strokeStyle = '#ff7b9c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(wx, wy, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = toys.wheelAngle + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(a) * 21, wy + Math.sin(a) * 21);
    ctx.stroke();
  }
  ctx.fillStyle = '#6f4e37';
  ctx.fillRect(wx - 3, wy, 6, FLOOR_Y - wy);
}

function drawCage() {
  const tick = performance.now() / 1000;
  drawSceneEnvironment(tick);

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

  // Draw all hamsters in the cage + their name tags
  for (const h of hamsters.values()) {
    if (h.inTunnel) continue;
    let frame = 'idle1';
    if (h.mode === 'sleep') frame = 'sleep';
    else if (h.mode === 'happy' || h.mode === 'hug') frame = 'happy';
    else if (h.mode === 'drag') {
      frame = Math.floor(h.animTick * 16) % 2 ? 'walk1' : 'walk2';
    } else if (h.mode === 'eat') frame = Math.floor(h.animTick * 8) % 2 ? 'eat1' : 'idle1';
    else if (h.mode === 'wheel' || h.mode === 'zoomies' || h.mode === 'wander') {
      const rate = h.mode === 'wander' ? 7 : 13;
      frame = Math.floor(h.animTick * rate) % 2 ? 'walk1' : 'walk2';
    } else {
      frame = Math.floor(h.animTick * 3) % 2 ? 'idle1' : 'idle2';
    }
    drawHamster(ctx, h.x, h.y, frame, h.fur, h.flip, 2);
    if (h.mode !== 'sleep') {
      drawAccessory(ctx, h.x, h.y, h.acc, 2);
    }
    const tagY = h.acc && h.acc !== 'none' && h.acc !== 'glasses' ? h.y - 46 : h.y - 38;
    drawNameTag(h.x, tagY, h.name, h.id === coop.clientId);
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

// Canvas interactions (Pick & Drag + Click/Tap)
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

let dragState = null; // { id, startX, startY, moved, lastSync }
let lastCursorSent = 0;

canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = getCanvasCoords(e);
  for (const h of hamsters.values()) {
    if (!h.inTunnel && Math.hypot(x - h.x, y - (h.y - 16)) < 28) {
      canvas.setPointerCapture(e.pointerId);
      dragState = {
        id: h.id,
        startX: x,
        startY: y,
        moved: false,
        lastSync: 0,
      };
      return;
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  const { x, y } = getCanvasCoords(e);
  const now = performance.now();

  if (dragState) {
    const h = hamsters.get(dragState.id);
    if (!h) {
      dragState = null;
      return;
    }
    if (!dragState.moved && Math.hypot(x - dragState.startX, y - dragState.startY) > 4) {
      dragState.moved = true;
      sfx.squeak();
    }
    if (dragState.moved) {
      h.inTunnel = false;
      h.mode = 'drag';
      h.x = clamp(x, 18, W - 18);
      h.y = clamp(y + 14, 34, FLOOR_Y);
      h.vy = 0;
      if (now - dragState.lastSync > 75) {
        dragState.lastSync = now;
        coop.send('action', {
          action: 'drag',
          data: { targetId: h.id, x: h.x, y: h.y },
        });
      }
    }
    return;
  }

  if (now - lastCursorSent < 90) return;
  lastCursorSent = now;
  coop.send('cursor', { x, y });
});

function endDrag(e) {
  if (!dragState) return;
  const { x, y } = getCanvasCoords(e);
  const h = hamsters.get(dragState.id);
  const wasMoved = dragState.moved;
  const targetId = dragState.id;
  dragState = null;

  if (wasMoved && h) {
    applyAction('drop', { targetId, x: h.x, y: h.y });
  } else {
    applyAction('pet', { targetId });
  }
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('click', (e) => {
  const { x, y } = getCanvasCoords(e);
  for (const h of hamsters.values()) {
    if (!h.inTunnel && Math.hypot(x - h.x, y - (h.y - 16)) < 28) {
      return; // Handled by pointerdown/pointerup (pet or drag)
    }
  }
  for (const m of messes) {
    if (Math.hypot(x - m.x, y - m.y) < 16) {
      applyAction('clean');
      return;
    }
  }
  if (state.scene === 'cage') {
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
  }
  applyAction('goto', { x });
});

// Scene switcher
document.querySelectorAll('.scene-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyAction('scene', { scene: btn.dataset.scene }));
});

// Inline Dress Code switcher (langsung di dalam game!)
document.querySelectorAll('#inline-acc-picker .acc-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await saveMyProfile(state.name, state.fur, btn.dataset.acc);
    sfx.squeak();
    showToast(`Ganti dress code: ${btn.textContent}`);
  });
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
    addEffort(coop.clientId);
    const myHammy = hamsters.get(coop.clientId);
    spawnParticles('text', 140, 88, 1, { text: `${state.name}: ${emote}`, color: '#ff4d79' });
    if (myHammy) spawnParticles('heart', myHammy.x, myHammy.y - 26, 3);
    showToast(`${state.name}: ${emote}`);
    addLog(`${state.name} kirim "${emote}"`);
    coop.send('emote', { emote });
    updateUI();
  });
});

document.getElementById('btn-hug').addEventListener('click', () => {
  const partner = getPartnerHammy();
  if (!partner) {
    showToast('Ajak 1 orang lagi ke room untuk pelukan bareng! 👥');
    return;
  }
  const myEff = getEffort(coop.clientId);
  const partnerEff = getEffort(partner.id);
  if (myEff < REQUIRED_EFFORT) {
    showToast(`Kasih perhatian dulu yuk! (${myEff}/${REQUIRED_EFFORT}) 🌻`);
    return;
  }
  if (partnerEff < REQUIRED_EFFORT) {
    showToast(`Tunggu timbal balik dari ${partner.name} dulu ya~ (${partnerEff}/${REQUIRED_EFFORT}) 💕`);
    return;
  }
  applyAction('hug');
});

// Modals
document.querySelectorAll('.close-modal').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).classList.add('hidden');
  });
});

// Rename, Fur & Dress Code Modal
document.getElementById('btn-rename').addEventListener('click', () => {
  document.getElementById('input-pet-name').value = state.name;
  document.querySelectorAll('#fur-picker .fur-chip').forEach((c) => {
    c.classList.toggle('selected', c.dataset.fur === state.fur);
  });
  document.querySelectorAll('#acc-picker .fur-chip').forEach((c) => {
    c.classList.toggle('selected', c.dataset.acc === state.acc);
  });
  document.getElementById('modal-pet').classList.remove('hidden');
});

let selectedFur = state.fur;
let selectedAcc = state.acc;
document.querySelectorAll('#fur-picker .fur-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    selectedFur = chip.dataset.fur;
    document.querySelectorAll('#fur-picker .fur-chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
  });
});
document.querySelectorAll('#acc-picker .fur-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    selectedAcc = chip.dataset.acc;
    document.querySelectorAll('#acc-picker .fur-chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
  });
});

async function saveMyProfile(newName, newFur, newAcc) {
  state.name = newName.trim().toUpperCase().slice(0, 12) || 'MOCHI';
  state.fur = newFur || state.fur;
  state.acc = newAcc || state.acc;
  const myHammy = hamsters.get(coop.clientId);
  if (myHammy) {
    myHammy.name = state.name;
    myHammy.fur = state.fur;
    myHammy.acc = state.acc;
  }
  saveState();
  updateUI();
  await coop.updateProfile(state.name, state.fur, state.acc);
}

document.getElementById('btn-save-pet').addEventListener('click', async () => {
  const newName = document.getElementById('input-pet-name').value;
  await saveMyProfile(newName, selectedFur, selectedAcc);
  addLog(`Profil hamstermu diubah jadi ${state.name}`);
  document.getElementById('modal-pet').classList.add('hidden');
});

// Welcome Modal for new visitors
let welcomeFur = state.fur;
let welcomeAcc = state.acc;
document.querySelectorAll('#welcome-fur-picker .fur-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    welcomeFur = chip.dataset.fur;
    document
      .querySelectorAll('#welcome-fur-picker .fur-chip')
      .forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
  });
});
document.querySelectorAll('#welcome-acc-picker .fur-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    welcomeAcc = chip.dataset.acc;
    document
      .querySelectorAll('#welcome-acc-picker .fur-chip')
      .forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
  });
});

document.getElementById('btn-welcome-go').addEventListener('click', async () => {
  const nameVal = document.getElementById('input-welcome-name').value || 'MOCHI';
  await saveMyProfile(nameVal, welcomeFur, welcomeAcc);
  sfx.heart();
  document.getElementById('modal-welcome').classList.add('hidden');
  showToast(`Halo ${state.name}! Selamat bermain 🐹`);
});

if (!localStorage.getItem('hammy_player')) {
  document.getElementById('modal-welcome').classList.remove('hidden');
}

// Room Modal
document.getElementById('btn-room').addEventListener('click', () => {
  document.getElementById('input-player-name').value = state.name;
  document.getElementById('input-room-code').value = coop.roomCode;
  const creds = coop.getCredentials();
  document.getElementById('input-sb-url').value = creds.url;
  document.getElementById('input-sb-key').value = creds.key;
  document.getElementById('modal-room').classList.remove('hidden');
});

document.getElementById('btn-join-room').addEventListener('click', async () => {
  const pName = document.getElementById('input-player-name').value;
  const rCode = document.getElementById('input-room-code').value;
  if (pName) await saveMyProfile(pName, state.fur);
  const ok = await coop.connect(rCode, state.name);
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
coop.connect(coop.roomCode, state.name);
requestAnimationFrame(loop);
