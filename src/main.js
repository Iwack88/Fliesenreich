import { TILES, RARITY, PACKS, GOLD_ICON, SHUFFLE_COST, SOCKETS, DEFAULT_SOCKETS } from './config.js?v=3';
import { newState, tileAt, drawCard, placeHand, placeCells, buyPack, canAfford, cardCount, shuffleDeck, partnersOf } from './logic.js?v=3';

const SAVE_KEY = 'fliesenreich-save-v7';
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
const flashes = [];     // kurze Aufleucht-Effekte für Bonus-Quellen
const FLASH_MS = 900;
let dragButton = null;

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
  dragButton = e.button;
  canvas.style.cursor = e.button === 2 || e.button === 1 ? 'grabbing' : 'grab';
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
  if (wasSingle && dragMoved < 10 && e.button === 0) onTap(e.clientX, e.clientY);
  canvas.style.cursor = 'grab';
});
canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const before = toWorld(e.clientX, e.clientY);
  setZoom(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9));
  const after = toWorld(e.clientX, e.clientY);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('auxclick', (e) => e.preventDefault());
canvas.style.cursor = 'grab';

window.addEventListener('keydown', (e) => {
  if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
  const pan = 48 / cam.zoom;
  if (e.key === 'ArrowLeft') cam.x -= pan;
  else if (e.key === 'ArrowRight') cam.x += pan;
  else if (e.key === 'ArrowUp') cam.y -= pan;
  else if (e.key === 'ArrowDown') cam.y += pan;
  else if (e.key === '+' || e.key === '=') setZoom(cam.zoom * 1.1);
  else if (e.key === '-') setZoom(cam.zoom / 1.1);
  else if (e.key.toLowerCase() === 'n') $('btn-next').click();
  else if (e.key.toLowerCase() === 'd') showInventory();
  else if (e.key.toLowerCase() === 'a') showArchive();
  else if (e.key.toLowerCase() === 's') showShop();
  else if (e.key === 'Escape') {
    closeOverlay();
    if (selected) { selected = null; updatePanel(); }
  } else return;
  e.preventDefault();
});

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
      const res = placeHand(state, target.x, target.y);
      if (!res) { toast('Dieser Sockel passt nicht'); return; }
      if (res && res.gold) {
        toast(`+${res.gold} ${GOLD_ICON}`);
        const now = performance.now();
        for (const p of res.pairs) flashes.push({ x: p.tile.x, y: p.tile.y, value: p.value, start: now });
      }
      selected = res?.tile || null;
      refreshTargets();
      save();
    } else toast('Wähle ein grünes Feld mit passendem Sockel');
    return;
  }
  selected = tileAt(state, c.x, c.y) || null;
  refreshTargets();
  updatePanel();
}

function refreshTargets() {
  targets = state.hand ? placeCells(state, state.hand).map(([x, y]) => ({ x, y })) : [];
  updatePanel();
}

// ---------- UI ----------
const fmt = (n) => String(Math.round(n * 100) / 100);
const givesText = (def) => Object.entries(def.gives || {}).map(([id, n]) => `${TILES[id].name} +${n}`).join(', ');

function updatePanel() {
  const panel = $('panel');
  const hand = state.hand && TILES[state.hand];
  if (hand) {
    panel.classList.remove('hidden');
    const category = SOCKETS[hand.category];
    $('panel-info').innerHTML = `<b>${hand.icon} ${hand.name}</b> · ${category.name} (${category.symbol})<br>${targets.length ? 'Grünes Feld antippen zum Platzieren' : 'Kein passender Sockel frei'}`;
  } else {
    panel.classList.add('hidden');
  }
  updateTilePopup();
}

// Tile-Daten als Popup: Seltenheit, Produktion (Basis + Buffs), buffende Nachbarn.
function updateTilePopup() {
  const el = $('tile-popup');
  if (!selected) { el.classList.add('hidden'); return; }
  const def = TILES[selected.type];
  const partners = partnersOf(state, selected);
  let html = `<div class="head"><b>${def.icon} ${def.name}</b><button id="tile-close">✕</button></div>`;
  html += `<div class="dim">${RARITY[def.rarity].name} · Position ${selected.x}, ${selected.y}</div>`;
  html += `<div>Typ: ${SOCKETS[def.category].name} (${SOCKETS[def.category].symbol})</div>`;
  const directions = ['oben', 'rechts', 'unten', 'links'];
  const sockets = def.sockets ?? DEFAULT_SOCKETS;
  html += `<div class="dim">Sockel: ${sockets.map((id, i) => `${directions[i]} ${SOCKETS[id].name}`).join(', ')}</div>`;
  html += `<div>Bisher eingebracht: <b>${selected.earned || 0} ${GOLD_ICON}</b></div>`;
  if (def.gives) {
    html += `<div>Gold-Bonus je Nachbar: <b>${givesText(def)}</b></div>`;
    html += '<div class="dim">Einmalig, sobald das Paar entsteht</div>';
  } else {
    html += '<div class="dim">Gibt keinen Gold-Bonus</div>';
  }
  html += `<div>Aktive Paare: <b>${partners.length}</b> <span class="dim">(orange markiert)</span></div>`;
  el.innerHTML = html;
  el.classList.remove('hidden');
  $('tile-close').onclick = () => { selected = null; updatePanel(); };
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
  $('r-gold').textContent = state.gold;
  $('btn-next').disabled = !!state.hand || cardCount(state) < 1;
  $('btn-next').textContent = `Next (${cardCount(state)})`;
  $('btn-shuffle').textContent = `🔀 ${SHUFFLE_COST}🪙`;
  $('btn-shuffle').disabled = state.gold < SHUFFLE_COST || state.deck.length < 2;
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

const costText = (cost) => `${cost} ${GOLD_ICON}`;

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

let archiveFilter = 'all';

function jumpTo(tile) {
  cam.x = (tile.x + 0.5) * TILE; cam.y = (tile.y + 0.5) * TILE;
  selected = tile;
  closeOverlay();
  updatePanel();
}

function showArchive() {
  const body = openOverlay('Tile-Archiv');
  body.innerHTML = '';
  const tiles = Object.values(state.tiles);
  const counts = {};
  for (const t of tiles) counts[t.type] = (counts[t.type] || 0) + 1;
  if (archiveFilter !== 'all' && !counts[archiveFilter]) archiveFilter = 'all';

  const filters = document.createElement('div');
  filters.className = 'filters';
  const addFilter = (id, label, color) => {
    const f = document.createElement('span');
    f.className = 'chip' + (archiveFilter === id ? ' active' : '');
    f.style.background = color;
    f.textContent = label;
    f.onclick = () => { archiveFilter = id; showArchive(); };
    filters.appendChild(f);
  };
  addFilter('all', `Alle (${tiles.length})`, '#ddd');
  for (const id of Object.keys(TILES)) if (counts[id]) addFilter(id, `${TILES[id].icon} ${TILES[id].name} (${counts[id]})`, TILES[id].color);
  body.appendChild(filters);

  for (const t of tiles.filter(t => archiveFilter === 'all' || t.type === archiveFilter)) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `${chip(t.type)}<span>${t.x}, ${t.y}</span><span>${t.earned || 0} ${GOLD_ICON}</span>`;
    row.onclick = () => jumpTo(t);
    body.appendChild(row);
  }
}

$('btn-archive').onclick = showArchive;
$('btn-cards').onclick = showInventory;
$('btn-shop').onclick = () => showShop();
$('btn-shuffle').onclick = () => {
  if (shuffleDeck(state)) { toast('Deck gemischt'); save(); } else toast(`Shuffle kostet ${SHUFFLE_COST} 🪙`);
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
  const sockets = def.sockets ?? DEFAULT_SOCKETS;
  const positions = [[TILE / 2, 8], [TILE - 8, TILE / 2], [TILE / 2, TILE - 8], [8, TILE / 2]];
  sockets.forEach((id, i) => {
    const [dx, dy] = positions[i];
    const socket = SOCKETS[id];
    ctx.fillStyle = socket.color;
    ctx.fillRect(x + dx - 10, y + dy - 7, 20, 14);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + dx - 10, y + dy - 7, 20, 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(socket.symbol, x + dx, y + dy);
  });
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
    const partners = partnersOf(state, t).length;
    if (partners) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold ${TILE * 0.22}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`×${partners}`, t.x * TILE + 6, t.y * TILE + 4);
    }
  }

  for (const g of targets) {
    ctx.fillStyle = 'rgba(60,220,90,.45)';
    ctx.fillRect(g.x * TILE, g.y * TILE, TILE, TILE);
    ctx.strokeStyle = '#3cdc5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x * TILE + 2, g.y * TILE + 2, TILE - 4, TILE - 4);
  }


  const now = performance.now();
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i], p = (now - f.start) / FLASH_MS;
    if (p >= 1) { flashes.splice(i, 1); continue; }
    const pulse = Math.sin(p * Math.PI * 3) ** 2 * (1 - p);
    ctx.fillStyle = `rgba(255,255,200,${0.85 * pulse})`;
    ctx.fillRect(f.x * TILE, f.y * TILE, TILE, TILE);
    ctx.strokeStyle = `rgba(255,235,59,${1 - p})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(f.x * TILE + 3, f.y * TILE + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = `rgba(255,255,255,${1 - p})`;
    ctx.font = `bold ${TILE * 0.3}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`+${f.value}`, (f.x + 0.5) * TILE, (f.y + 0.5) * TILE - p * TILE * 0.4);
  }

  if (selected && !state.hand) {
    for (const b of partnersOf(state, selected)) {
      ctx.fillStyle = 'rgba(255,152,0,.35)';
      ctx.fillRect(b.x * TILE, b.y * TILE, TILE, TILE);
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x * TILE + 2, b.y * TILE + 2, TILE - 4, TILE - 4);
    }
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

refreshTargets();
frame();

$('btn-full').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => toast('Vollbild nicht verfügbar'));
};
