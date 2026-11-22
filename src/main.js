import { TILES, JOKERS, CARDS, RARITY, PACKS, GOLD_ICON, SHUFFLE_COST, START_SIZE, EXPANDED_SIZE, EXPANSION_COST, PACK_MIN_SPECIAL } from './config.js?v=8';
import { newState, tileAt, drawCard, placeHand, placeCells, useJoker, expandWorld, buyPack, packChances, canAfford, cardCount, shuffleDeck, partnersOf } from './logic.js?v=8';

const SAVE_KEY = 'fliesenreich-save-v8';
const TILE = 96;
const BG = '#1e5aa8';
const BOARD_COLOR = '#355b38';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const loadedState = load();
let state = loadedState || newState();
function initialCamera() {
  return { x: 0, y: 0, zoom: Math.max(0.4, Math.min(1, (innerHeight - 130) / (START_SIZE * TILE), (innerWidth - 40) / (START_SIZE * TILE))) };
}
let cam = initialCamera();
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
if (!loadedState) save();

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
  if (!$('overlay').classList.contains('hidden') && e.key !== 'Escape') return;
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
  if (JOKERS[state.hand]) {
    const result = useJoker(state, c.x, c.y);
    if (!result) {
      toast(Object.keys(state.tiles).length <= 1 && state.hand === 'joker_loeschen'
        ? 'Das letzte Tile kann nicht gelöscht werden' : 'Wähle ein vorhandenes Tile');
      return;
    }
    selected = result.kind === 'transformed' ? result.tile : null;
    if (result.kind === 'transformed') {
      toast(`${TILES[result.oldType].name} → ${TILES[result.tile.type].name}${result.gold ? ` · +${result.gold} ${GOLD_ICON}` : ''}`);
      flashPairs(result.pairs);
    } else toast(`${TILES[result.tile.type].name} gelöscht`);
    refreshTargets();
    save();
    return;
  }
  if (state.hand) {
    const target = targets.find(t => t.x === c.x && t.y === c.y);
    if (target) {
      const res = placeHand(state, target.x, target.y);
      if (!res) { toast('Dieses Feld ist nicht frei'); return; }
      if (res && res.gold) {
        toast(`+${res.gold} ${GOLD_ICON}`);
        flashPairs(res.pairs);
      }
      selected = res?.tile || null;
      refreshTargets();
      save();
    } else toast('Wähle ein grünes Feld');
    return;
  }
  selected = tileAt(state, c.x, c.y) || null;
  refreshTargets();
  updatePanel();
}

function refreshTargets() {
  targets = TILES[state.hand] ? placeCells(state).map(([x, y]) => ({ x, y })) : [];
  updatePanel();
}

function flashPairs(pairs) {
  const now = performance.now();
  for (const p of pairs) flashes.push({ x: p.tile.x, y: p.tile.y, value: p.value, start: now });
}

// ---------- UI ----------
const fmt = (n) => String(Math.round(n * 100) / 100);
const givesText = (def) => Object.entries(def.gives || {}).map(([id, n]) => `${TILES[id].name} +${n}`).join(', ');

function updatePanel() {
  const panel = $('panel');
  const hand = state.hand && CARDS[state.hand];
  if (hand) {
    panel.classList.remove('hidden');
    const blockedDelete = state.hand === 'joker_loeschen' && Object.keys(state.tiles).length <= 1;
    $('btn-return-card').hidden = !blockedDelete;
    const message = blockedDelete ? 'Das letzte Tile kann nicht gelöscht werden.' :
      state.hand === 'joker_loeschen' ? 'Tile antippen, um es zu löschen' :
      state.hand === 'joker_verwandeln' ? 'Tile antippen, um es zufällig zu verwandeln' :
      targets.length ? 'Grünes Feld antippen zum Platzieren' :
      state.size === START_SIZE ? 'Spielfeld voll – im Shop erweitern' : 'Spielfeld voll';
    $('panel-info').innerHTML = `<b>${hand.icon} ${hand.name}</b><br>${message}`;
  } else {
    panel.classList.add('hidden');
  }
  updateTilePopup();
}

function updateTilePopup() {
  const el = $('tile-popup');
  if (!selected || state.hand) { el.classList.add('hidden'); return; }
  const def = TILES[selected.type];
  const partners = partnersOf(state, selected);
  let html = `<div class="head"><b>${def.icon} ${def.name}</b><button id="tile-close">✕</button></div>`;
  html += `<div class="dim">${RARITY[def.rarity].name} · Position ${selected.x}, ${selected.y}</div>`;
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
  const d = CARDS[id];
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

$('btn-return-card').onclick = () => {
  if (state.hand !== 'joker_loeschen' || Object.keys(state.tiles).length > 1) return;
  state.deck.push(state.hand);
  state.hand = null;
  refreshTargets();
  save();
  toast('Joker ans Deckende gelegt');
};

function openOverlay(title) {
  $('overlay-title').textContent = title;
  $('overlay').classList.remove('hidden');
  return $('overlay-body');
}
function closeOverlay() { $('overlay').classList.add('hidden'); }
$('overlay-close').onclick = closeOverlay;

$('btn-new-game').onclick = () => {
  const body = openOverlay('Neues Spiel');
  body.innerHTML = '<p>Der aktuelle Spielstand wird gelöscht. Möchtest du neu anfangen?</p>';
  const cancel = document.createElement('button');
  cancel.textContent = 'Abbrechen';
  cancel.onclick = closeOverlay;
  const confirm = document.createElement('button');
  confirm.textContent = 'Neu starten';
  confirm.onclick = () => {
    const newGame = newState();
    localStorage.setItem(SAVE_KEY, JSON.stringify(newGame));
    state = newGame;
    cam = initialCamera();
    selected = null;
    flashes.length = 0;
    closeOverlay();
    refreshTargets();
    toast('Neues Spiel gestartet');
  };
  body.append(cancel, confirm);
};

const costText = (cost) => `${cost} ${GOLD_ICON}`;

function showInventory() {
  const body = openOverlay(`Deck (${cardCount(state)}) – Reihenfolge der Ziehung`);
  body.innerHTML = '';
  if (!state.deck.length) body.textContent = 'Keine Karten. Kaufe ein Pack im Shop.';
  state.deck.forEach((id, i) => {
    const d = CARDS[id];
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
    r.textContent = 'Gezogen: ' + result.map(id => `${CARDS[id].icon} ${CARDS[id].name}`.trim()).join(' · ');
    body.appendChild(r);
  }
  if (state.size === START_SIZE) {
    const row = document.createElement('div');
    row.className = 'pack';
    row.innerHTML = `<span><b>Spielfeld erweitern</b> – ${EXPANDED_SIZE}×${EXPANDED_SIZE}</span>`;
    const btn = document.createElement('button');
    btn.textContent = costText(EXPANSION_COST);
    btn.disabled = state.gold < EXPANSION_COST;
    btn.onclick = () => {
      if (!expandWorld(state)) { toast('Erweiterung nicht möglich'); return; }
      refreshTargets();
      save();
      showShop();
      toast('Spielfeld erweitert');
    };
    row.appendChild(btn);
    body.appendChild(row);
  }
  for (const [id, p] of Object.entries(PACKS)) {
    const row = document.createElement('div');
    row.className = 'pack';
    const info = document.createElement('div');
    const chances = packChances(p).map(([type, chance]) =>
      `${CARDS[type].name}: ${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(chance)} %`).join(' · ');
    info.innerHTML = `<b>${p.name}</b> – ${p.cards} Karten<div class="pack-chances">Mindestens ${PACK_MIN_SPECIAL} Karten außer Gras, Erde und Wasser.<br>Chance je zufälliger Karte: ${chances}</div>`;
    row.appendChild(info);
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
function drawTile(tile, x, y, alpha = 1) {
  const def = TILES[tile.type];
  ctx.globalAlpha = alpha;
  if (images[tile.type]) {
    ctx.drawImage(images[tile.type], x, y, TILE, TILE);
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

  const half = state.size / 2;
  ctx.fillStyle = BOARD_COLOR;
  ctx.fillRect(-half * TILE, -half * TILE, state.size * TILE, state.size * TILE);
  if (TILES[state.hand]) {
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1;
    for (let i = -half; i <= half; i++) {
      ctx.beginPath();
      ctx.moveTo(i * TILE, -half * TILE);
      ctx.lineTo(i * TILE, half * TILE);
      ctx.moveTo(-half * TILE, i * TILE);
      ctx.lineTo(half * TILE, i * TILE);
      ctx.stroke();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(-half * TILE, -half * TILE, state.size * TILE, state.size * TILE);
  }

  const tiles = Object.values(state.tiles);
  for (const t of tiles) {
    drawTile(t, t.x * TILE, t.y * TILE);
    const partners = partnersOf(state, t).length;
    if (partners) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold ${TILE * 0.22}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`×${partners}`, t.x * TILE + 6, t.y * TILE + 4);
    }
    if (JOKERS[state.hand] && (state.hand !== 'joker_loeschen' || tiles.length > 1)) {
      ctx.strokeStyle = '#d39cff';
      ctx.lineWidth = 4;
      ctx.strokeRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
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
