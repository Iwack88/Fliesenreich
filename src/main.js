import { TILES, RARITY, TICK_MS, PACKS, RESOURCES } from './config.js';
import { newState, tick, tileAt, drawCard, placeHand, placeCells, buyPack, canAfford, cardCount, buffCount } from './logic.js';

const SAVE_KEY = 'fliesenreich-save-v3';
const TILE = 96;
const BG = '#1e5aa8';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let state = load() || newState();
let cam = { x: TILE / 2, y: TILE / 2, zoom: 1 };
let selected = null;   // angetipptes Tile (nur Info)
let targets = [];      // freie Felder neben Tiles, solange eine Karte auf der Hand ist
let pending = null;    // gewähltes Zielfeld
let dpr = 1;

const images = {};
for (const id of Object.keys(TILES)) {
  const img = new Image();
  img.onload = () => { images[id] = img; };
  img.src = `assets/tiles/${id}.png`;
}

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
addEventListener('resize', resize);
resize();

const toWorld = (sx, sy) => ({
  x: (sx - innerWidth / 2) / cam.zoom + cam.x,
  y: (sy - innerHeight / 2) / cam.zoom + cam.y,
});
const toCell = (sx, sy) => {
  const w = toWorld(sx, sy);
  return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
};

// ---------- Eingabe: Drag, Pinch, Tippen ----------
const pointers = new Map();
let dragMoved = 0, pinchDist = 0;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = 0;
  if (pointers.size === 2) pinchDist = pointerDistance();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (pointers.size === 1) {
    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;
  } else if (pointers.size === 2) {
    const d = pointerDistance();
    if (pinchDist) setZoom(cam.zoom * d / pinchDist);
    pinchDist = d;
  }
});
canvas.addEventListener('pointerup', (e) => {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (wasSingle && dragMoved < 10) onTap(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  setZoom(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9));
}, { passive: false });

function pointerDistance() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function setZoom(z) { cam.zoom = Math.min(2.5, Math.max(0.4, z)); }

function onTap(sx, sy) {
  const c = toCell(sx, sy);
  if (state.hand) {
    const target = targets.find(t => t.x === c.x && t.y === c.y);
    if (target) { pending = target; updatePanel(); }
    return;
  }
  selected = tileAt(state, c.x, c.y) || null;
  updatePanel();
}

function refreshTargets() {
  targets = state.hand ? placeCells(state).map(([x, y]) => ({ x, y })) : [];
  pending = null;
  updatePanel();
}

// ---------- UI ----------
function updatePanel() {
  const panel = $('panel');
  const hand = state.hand && TILES[state.hand];
  if (!hand && !selected) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  let info;
  if (hand) {
    info = `<b>${hand.icon} ${hand.name}</b> (${RARITY[hand.rarity].name})<br>` +
      (pending ? 'Place drücken zum Platzieren' : 'Grünes Feld antippen, an dem das Tile liegen soll');
  } else {
    const def = TILES[selected.type];
    info = `<b>${def.icon} ${def.name}</b> (${RARITY[def.rarity].name})`;
    if (def.buffedBy) info += ` – Buffs: ${buffCount(state, selected)}`;
  }
  $('panel-info').innerHTML = info;
  $('btn-place').style.display = hand ? '' : 'none';
  $('btn-place').disabled = !pending;
  $('btn-cancel').textContent = hand ? 'Auswahl aufheben' : 'Schließen';
}

function updateHud() {
  for (const r of ['wood', 'grain']) $('r-' + r).textContent = Math.floor(state[r]);
  $('btn-next').disabled = !!state.hand || cardCount(state) < 1;
  $('btn-next').textContent = `Next (${cardCount(state)})`;
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

$('btn-next').onclick = () => {
  if (!drawCard(state)) { toast(state.hand ? 'Erst die Karte platzieren' : 'Keine Karten – kaufe ein Pack'); return; }
  selected = null;
  refreshTargets();
  save();
};

function openOverlay(title) {
  $('overlay-title').textContent = title;
  $('overlay').classList.remove('hidden');
  return $('overlay-body');
}
function closeOverlay() { $('overlay').classList.add('hidden'); }
$('overlay-close').onclick = closeOverlay;

const costText = (cost) => Object.entries(cost).map(([r, n]) => `${n} ${RESOURCES[r].icon}`).join(' ');

function showInventory() {
  const body = openOverlay(`Karten (${cardCount(state)})`);
  body.innerHTML = '';
  const types = Object.keys(TILES).filter(id => state.inventory[id] > 0);
  if (!types.length) body.textContent = 'Keine Karten. Kaufe ein Pack im Shop.';
  for (const id of types) {
    const d = TILES[id];
    const el = document.createElement('div');
    el.className = `card ${d.rarity}`;
    el.style.cursor = 'default';
    el.style.background = d.color;
    el.innerHTML = `<div class="ic">${d.icon}</div><b>${d.name}</b><br>×${state.inventory[id]}`;
    body.appendChild(el);
  }
}

function showShop(result) {
  const body = openOverlay('Shop');
  body.innerHTML = '';
  if (result) {
    const r = document.createElement('div');
    r.style.width = '100%';
    r.textContent = 'Gezogen: ' + result.map(id => TILES[id].icon || TILES[id].name).join(' ');
    body.appendChild(r);
  }
  for (const [id, p] of Object.entries(PACKS)) {
    const row = document.createElement('div');
    row.className = 'pack';
    row.innerHTML = `<span><b>${p.name}</b> – ${p.cards} Karten</span>`;
    const btn = document.createElement('button');
    btn.textContent = costText(p.cost);
    btn.disabled = !canAfford(state, p.cost);
    btn.onclick = () => { const drawn = buyPack(state, id); if (drawn) { save(); showShop(drawn); } };
    row.appendChild(btn);
    body.appendChild(row);
  }
}

$('btn-cards').onclick = showInventory;
$('btn-shop').onclick = () => showShop();
$('btn-place').onclick = () => {
  if (!state.hand || !pending) return;
  const t = placeHand(state, pending.x, pending.y);
  if (!t) return;
  selected = t;
  refreshTargets();
  save();
};
$('btn-cancel').onclick = () => {
  if (state.hand) { pending = null; } else { selected = null; }
  updatePanel();
};

// ---------- Zeichnen ----------
function drawTile(t, x, y, alpha = 1) {
  const def = TILES[t];
  ctx.globalAlpha = alpha;
  if (images[t]) {
    ctx.drawImage(images[t], x, y, TILE, TILE);
  } else {
    ctx.fillStyle = def.color;
    ctx.fillRect(x, y, TILE, TILE);
    if (def.icon) {
      ctx.font = `${TILE * 0.5}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(def.icon, x + TILE / 2, y + TILE / 2);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, TILE, TILE);
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  for (const t of Object.values(state.tiles)) {
    drawTile(t.type, t.x * TILE, t.y * TILE);
    const buffs = buffCount(state, t);
    if (buffs) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold ${TILE * 0.22}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`+${buffs}`, t.x * TILE + 6, t.y * TILE + 4);
    }
  }

  for (const g of targets) {
    const isPending = pending === g;
    ctx.fillStyle = isPending ? 'rgba(255,255,255,.35)' : 'rgba(60,220,90,.45)';
    ctx.fillRect(g.x * TILE, g.y * TILE, TILE, TILE);
    ctx.strokeStyle = isPending ? '#fff' : '#3cdc5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x * TILE + 2, g.y * TILE + 2, TILE - 4, TILE - 4);
  }
  if (pending) drawTile(state.hand, pending.x * TILE, pending.y * TILE, 0.8);

  if (selected && !state.hand) {
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 4;
    ctx.strokeRect(selected.x * TILE, selected.y * TILE, TILE, TILE);
  }
}

function frame() {
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

setInterval(() => { tick(state); save(); }, TICK_MS);
refreshTargets();
frame();

$('btn-full').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => toast('Vollbild nicht verfügbar'));
};
