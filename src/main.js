import { TILES, RARITY, TICK_MS, PACKS, RESOURCES, SHUFFLE_COST } from './config.js';
import { newState, tick, tileAt, drawCard, placeHand, placeCells, buyPack, canAfford, cardCount, shuffleDeck, sellAll, buffCount } from './logic.js';

const SAVE_KEY = 'fliesenreich-save-v4';
const TILE = 96;
const BG = '#1e5aa8';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let state = load() || newState();
let cam = { x: TILE / 2, y: TILE / 2, zoom: 1 };
let selected = null;   // angetipptes Tile (nur Info)
let targets = [];      // freie Felder neben Tiles, solange eine Karte auf der Hand ist
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
    if (target) {
      placeHand(state, target.x, target.y);
      selected = tileAt(state, target.x, target.y);
      refreshTargets();
      save();
    }
    return;
  }
  selected = tileAt(state, c.x, c.y) || null;
  updatePanel();
}

function refreshTargets() {
  targets = state.hand ? placeCells(state).map(([x, y]) => ({ x, y })) : [];
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
    info = `<b>${hand.icon} ${hand.name}</b> (${RARITY[hand.rarity].name})<br>Grünes Feld antippen, um das Tile zu platzieren`;
  } else {
    const def = TILES[selected.type];
    info = `<b>${def.icon} ${def.name}</b> (${RARITY[def.rarity].name})`;
    if (def.buffedBy) info += ` – Buffs: ${buffCount(state, selected)}`;
  }
  $('panel-info').innerHTML = info;
  $('panel-btns').style.display = hand ? 'none' : '';
}

let queueKey = '';
function chip(id) {
  const d = TILES[id];
  return `<span class="chip" style="background:${d.color}">${d.icon} ${d.name}</span>`;
}
function renderQueue() {
  const key = `${state.hand}|${state.deck[0]}`;
  if (key === queueKey) return;
  queueKey = key;
  let html = '';
  if (state.hand) html += `Jetzt: ${chip(state.hand)}`;
  html += state.deck.length ? ` Danach: ${chip(state.deck[0])}` : ' Deck leer';
  $('queue').innerHTML = html;
}

function updateHud() {
  for (const r of ['gold', 'wood', 'grain']) $('r-' + r).textContent = Math.floor(state[r]);
  $('btn-next').disabled = !!state.hand || cardCount(state) < 1;
  $('btn-next').textContent = `Next (${cardCount(state)})`;
  $('btn-shuffle').textContent = `🔀 ${SHUFFLE_COST}🪙`;
  $('btn-shuffle').disabled = state.gold < SHUFFLE_COST || state.deck.length < 2;
  $('btn-sell').disabled = state.wood + state.grain < 1;
  renderQueue();
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
  const body = openOverlay(`Deck (${cardCount(state)}) – Reihenfolge der Ziehung`);
  body.innerHTML = '';
  if (!state.deck.length) body.textContent = 'Keine Karten. Kaufe ein Pack im Shop.';
  state.deck.forEach((id, i) => {
    const d = TILES[id];
    const el = document.createElement('div');
    el.className = `card ${d.rarity}`;
    el.style.cursor = 'default';
    el.style.background = d.color;
    el.innerHTML = `<div class="ic">${d.icon}</div><b>${d.name}</b><br>#${i + 1}`;
    body.appendChild(el);
  });
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
$('btn-cancel').onclick = () => { selected = null; updatePanel(); };
$('btn-shuffle').onclick = () => {
  if (shuffleDeck(state)) { toast('Deck gemischt'); save(); } else toast(`Shuffle kostet ${SHUFFLE_COST} 🪙`);
};
$('btn-sell').onclick = () => { toast(`+${sellAll(state)} 🪙`); save(); };

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
    ctx.fillStyle = 'rgba(60,220,90,.45)';
    ctx.fillRect(g.x * TILE, g.y * TILE, TILE, TILE);
    ctx.strokeStyle = '#3cdc5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x * TILE + 2, g.y * TILE + 2, TILE - 4, TILE - 4);
  }

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
