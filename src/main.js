import { TILES, JOKERS, HAZARDS, CARDS, RARITY, RESOURCE_CHAINS, LAND_TYPES, PACKS, GOLD_ICON, SHUFFLE_COST, DELETE_CARD_REWARD, START_SIZE, EXPANDED_SIZE, EXPANSION_COST, STORAGE_BONUS, PRODUCTION_INTERVAL, BANDIT_INTERVAL, SHOP_PRICES, SHOP_DISCOUNT, SUPPLY_CHAINS, MIN_SUPPLIERS, SUPPLIER_OUTPUT, EMERGENCY_RATE, SWAP_COST, INSTANT_JOKERS, MAX_CRAFT_JOBS, TOWN_HALL_OUTPUT } from './config.js?v=28';
import { newState, migrateState, tileAt, drawCard, returnHand, placeRandomTile, useJoker, expandWorld, openPack, packChances, cardCount, shuffleDeck, canDeleteCard, deleteNextCard, partnersOf, pairValue, tileProduction, productionRates, updateProduction, storageCapacity, baseRarity, tileRarity, tileStrength, guardRadius, craftDuration, canStartPack, maxStartablePacks, startPack, canStartRecovery, startRecovery, spawnBandit, advanceBandits, isProtected, shopStatus, advanceShop, buyShopCard, matchesTileFilter, moveOptions, moveTile, swapTiles, undoMove, moveStepCost, canPayMove, upgradedRarity } from './logic.js?v=33';

const SAVE_KEY = 'fliesenreich-save-v8';
const TILE = 96;
const BG = '#1e5aa8';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const backgroundImage = new Image();
backgroundImage.src = 'assets/game-background.jpg';

const loadedState = load();
let state = loadedState || newState();
if (loadedState && migrateState(state)) save();
if (TILES[state.hand] && state.hand !== 'banditen') {
  if (!placeRandomTile(state)) returnHand(state);
  save();
}
if (updateProduction(state)) save();
function initialCamera() {
  return { x: 0, y: 0, zoom: Math.max(0.4, Math.min(1, (innerHeight - 130) / (START_SIZE * TILE), (innerWidth - 40) / (START_SIZE * TILE))) };
}
let cam = initialCamera();
let selected = null;   // angetipptes Tile (nur Info)
let moveMode = null;    // { tile, moves, swaps } während ein Tile verschoben wird
let movePreview = null; // gewähltes Ziel, zweites Antippen bestätigt
let previewBuffCache = null;
let moveAnims = [];
const UNDO_MS = 6000;
let lastMove = null;
let dpr = 1;
const flashes = [];     // kurze Aufleucht-Effekte für Bonus-Quellen
const FLASH_MS = 900;
let dragButton = null;
let activeSince = document.visibilityState === 'visible' ? performance.now() : null;
let showShields = false;
let showGrid = false;
const FOLLOW_KEY = 'fliesenreich-follow-new-tiles';
let followNewTiles = localStorage.getItem(FOLLOW_KEY) === 'true';
function focusNewTile(tile) {
  if (!followNewTiles) return;
  cam.x = (tile.x + 0.5) * TILE;
  cam.y = (tile.y + 0.5) * TILE;
}
let activeFilter = null;

const images = {};
const tileArt = {};
for (const id of Object.keys(TILES)) {
  const img = new Image();
  img.onload = () => { images[id] = img; };
  img.src = `assets/tiles/${id}.png`;
}

async function loadTileArt() {
  try {
    const response = await fetch('assets/card-art.svg?v=5');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Ungültige SVG-Grafik');
    const root = doc.documentElement;
    const defs = root.querySelector('defs');
    if (!defs) throw new Error('SVG-Definitionen fehlen');
    for (const id of Object.keys(TILES)) {
      const symbol = root.querySelector(`symbol[id="${id}"]`);
      if (!symbol) {
        console.error(`Tile-Grafik fehlt: ${id}`);
        continue;
      }
      const svg = root.cloneNode(false);
      svg.appendChild(defs.cloneNode(true));
      svg.appendChild(symbol.cloneNode(true));
      const use = doc.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `#${id}`);
      use.setAttribute('width', '100');
      use.setAttribute('height', '100');
      svg.appendChild(use);
      const img = new Image();
      img.onload = () => { tileArt[id] = img; };
      img.onerror = () => console.error(`Tile-Grafik konnte nicht geladen werden: ${id}`);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    }
  } catch (error) {
    console.error('Tile-Grafiken konnten nicht geladen werden:', error);
  }
}
loadTileArt();

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
const LONG_PRESS_MS = 500;
let longPressTimer = null, longPressFired = false;
const cancelLongPress = () => { clearTimeout(longPressTimer); longPressTimer = null; };

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = 0;
  dragButton = e.button;
  canvas.style.cursor = e.button === 2 || e.button === 1 ? 'grabbing' : 'grab';
  if (pointers.size === 2) pinchDist = pointerDistance();
  cancelLongPress();
  longPressFired = false;
  if (pointers.size === 1 && e.button === 0 && !moveMode && !state.hand) {
    const { clientX, clientY } = e;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (dragMoved >= 10 || pointers.size !== 1) return;
      const c = toCell(clientX, clientY);
      const tile = tileAt(state, c.x, c.y);
      if (!tile || tile.type === 'banditen') return;
      longPressFired = true;
      navigator.vibrate?.(30);
      startMove(tile);
    }, LONG_PRESS_MS);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (dragMoved >= 10) cancelLongPress();
  if (pointers.size === 1 && !longPressFired) {
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
  cancelLongPress();
  if (longPressFired) { longPressFired = false; canvas.style.cursor = 'grab'; return; }
  if (wasSingle && dragMoved < 10 && e.button === 0) onTap(e.clientX, e.clientY);
  canvas.style.cursor = 'grab';
});
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); cancelLongPress(); longPressFired = false; });
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
  if (overlayView === 'tile-filter' && e.key === 'Tab') {
    const buttons = [...$('overlay-box').querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    if ((e.shiftKey && index <= 0) || (!e.shiftKey && (index === -1 || index === buttons.length - 1))) {
      buttons[e.shiftKey ? buttons.length - 1 : 0].focus();
      e.preventDefault();
    }
    return;
  }
  if (!$('overlay').classList.contains('hidden') && e.key !== 'Escape') return;
  const pan = 48 / cam.zoom;
  if (e.key === 'ArrowLeft') cam.x -= pan;
  else if (e.key === 'ArrowRight') cam.x += pan;
  else if (e.key === 'ArrowUp') cam.y -= pan;
  else if (e.key === 'ArrowDown') cam.y += pan;
  else if (e.key === '+' || e.key === '=') setZoom(cam.zoom * 1.1);
  else if (e.key === '-') setZoom(cam.zoom / 1.1);
  else if (e.key.toLowerCase() === 'n') $('queue').click();
  else if (e.key.toLowerCase() === 'd') { syncProduction(); showInventory(); }
  else if (e.key.toLowerCase() === 'a') showArchive();
  else if (e.key.toLowerCase() === 's') showShop();
  else if (e.key === 'Escape') {
    if (moveMode) { cancelMove(); e.preventDefault(); return; }
    closeOverlay();
    if (selected) { selected = null; updatePanel(); }
  } else return;
  e.preventDefault();
});

let mobileMenuOpen = false;
function updateMobileMenu() {
  const collapsed = !mobileMenuOpen;
  $('primary-actions').classList.toggle('menu-collapsed', collapsed);
  $('primary-actions').inert = collapsed;
  $('primary-toggle').setAttribute('aria-expanded', String(mobileMenuOpen));
  $('primary-toggle').setAttribute('aria-label', mobileMenuOpen ? 'Menü schließen' : 'Menü öffnen');
  $('primary-toggle').title = mobileMenuOpen ? 'Menü schließen' : 'Menü öffnen';
  $('primary-toggle').textContent = mobileMenuOpen ? '❮' : '❯';
}
$('primary-toggle').onclick = () => {
  mobileMenuOpen = !mobileMenuOpen;
  updateMobileMenu();
};
updateMobileMenu();

function pointerDistance() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function setZoom(z) { cam.zoom = Math.min(2.5, Math.max(0.4, z)); }

function onTap(sx, sy) {
  syncBandits();
  syncProduction();
  const c = toCell(sx, sy);
  if (JOKERS[state.hand]) {
    const result = useJoker(state, c.x, c.y);
    if (!result) {
      const tile = tileAt(state, c.x, c.y);
      toast(tile?.type === 'banditen' ? 'Banditencamps sind gegen Joker geschützt' :
        state.hand === 'joker_schutz' ? (state.protectedFields[`${c.x},${c.y}`] ? 'Dieses Feld ist bereits dauerhaft geschützt' : 'Wähle ein Feld innerhalb des Spielfelds') :
        tile?.type === 'rathaus' ? 'Das letzte Rathaus ist geschützt' :
        Object.keys(state.tiles).length <= 1 && state.hand === 'joker_loeschen'
          ? 'Das letzte Tile kann nicht gelöscht werden' : 'Wähle ein vorhandenes Tile');
      return;
    }
    selected = result.kind === 'transformed' || result.kind === 'protected' ? result.tile || null : null;
    if (result.kind === 'transformed') {
      toast(`${TILES[result.oldType].name} → ${TILES[result.tile.type].name}${result.cleared ? ` · ${result.cleared} Camps vertrieben` : ''}${lossText(result.losses)}`);
      flashPairs(result.pairs);
    } else if (result.kind === 'protected') toast(`Feld (${result.x}, ${result.y}) dauerhaft vor Banditen geschützt`);
    else toast(`${TILES[result.tile.type].name} gelöscht${lossText(result.losses)}`);
    refreshTargets();
    save();
    return;
  }
  if (moveMode) { handleMoveTap(c); return; }
  selected = tileAt(state, c.x, c.y) || null;
  refreshTargets();
  updatePanel();
}

// Hält Verschiebe-Ziele aktuell, z. B. nach Produktion, Banditen oder Goldänderungen.
function refreshTargets() {
  if (moveMode) {
    const tile = moveMode.tile;
    if (state.hand || tileAt(state, tile.x, tile.y) !== tile || tile.type === 'banditen') {
      moveMode = null;
      movePreview = null;
    } else {
      moveMode = { tile, ...moveOptions(state, tile) };
      if (movePreview) movePreview = [...moveMode.moves, ...moveMode.swaps].find(o => o.x === movePreview.x && o.y === movePreview.y) || null;
    }
  }
  previewBuffCache = null;
  updatePanel();
}

function startMove(tile) {
  if (state.hand || !tile || tile.type === 'banditen') return;
  syncBandits();
  syncProduction();
  moveMode = { tile, ...moveOptions(state, tile) };
  movePreview = null;
  previewBuffCache = null;
  selected = null;
  if (!moveMode.moves.length && !moveMode.swaps.length) toast('Für dieses Tile gibt es gerade kein Ziel');
  updatePanel();
}

function cancelMove() {
  const tile = moveMode?.tile;
  moveMode = null;
  movePreview = null;
  previewBuffCache = null;
  selected = tile && tileAt(state, tile.x, tile.y) === tile ? tile : null;
  updatePanel();
}

function handleMoveTap(c) {
  const tile = moveMode.tile;
  const option = [...moveMode.moves, ...moveMode.swaps].find(o => o.x === c.x && o.y === c.y);
  if (!option) {
    if (c.x === tile.x && c.y === tile.y) {
      movePreview = null;
      previewBuffCache = null;
      updatePanel();
      return;
    }
    moveMode = null;
    movePreview = null;
    previewBuffCache = null;
    selected = tileAt(state, c.x, c.y) || null;
    updatePanel();
    return;
  }
  if (movePreview !== option) {
    movePreview = option;
    previewBuffCache = null;
    updatePanel();
    return;
  }
  if (!canPayMove(state, option.cost)) { toast(`Nicht genug Gold – ${option.cost} ${GOLD_ICON} nötig`); return; }
  const result = option.kind === 'swap' ? swapTiles(state, tile, option.tile) : moveTile(state, tile, option.x, option.y);
  if (!result) { toast('Dieser Zug ist nicht mehr möglich'); refreshTargets(); return; }
  startMoveAnimation(result);
  const price = result.free ? '🧭 Freizug' : `−${result.cost} ${GOLD_ICON}`;
  const upgrade = result.special ? ` · ✨ jetzt ${RARITY[tileRarity(result.tile)].name}` : '';
  const label = result.kind === 'swap' ? `${TILES[tile.type].name} 🔁 ${TILES[result.other.type].name}` : `${TILES[tile.type].name} verschoben`;
  toast(`${label} · ${price}${upgrade}${result.cleared ? ` · ${result.cleared} Camps vertrieben` : ''}`);
  flashPairs(result.pairs);
  lastMove = result.cleared ? null : { record: result, until: performance.now() + UNDO_MS };
  moveMode = null;
  movePreview = null;
  previewBuffCache = null;
  selected = tile;
  updateUndo();
  save();
  updatePanel();
}

const movePath = (from, to) => [{ x: from.x, y: from.y }, { x: to.x, y: from.y }, { x: to.x, y: to.y }];

function startMoveAnimation(result) {
  const start = performance.now();
  const steps = result.path ? result.path.length - 1 : Math.abs(result.to.x - result.from.x) + Math.abs(result.to.y - result.from.y);
  const duration = Math.min(800, 220 + steps * 90);
  moveAnims = [{ tile: result.tile, path: result.path || movePath(result.from, result.to), start, duration }];
  if (result.kind === 'swap') moveAnims.push({ tile: result.other, path: [result.to, result.from], start, duration });
}

function animatedPosition(tile, now) {
  const anim = moveAnims.find(a => a.tile === tile);
  if (!anim) return null;
  const p = (now - anim.start) / anim.duration;
  if (p >= 1) return null;
  const lengths = anim.path.slice(1).map((point, i) => Math.abs(point.x - anim.path[i].x) + Math.abs(point.y - anim.path[i].y));
  let left = (1 - (1 - p) ** 3) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const a = anim.path[i], b = anim.path[i + 1], f = lengths[i] ? Math.min(1, left / lengths[i]) : 1;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    left -= lengths[i];
  }
  return null;
}

function updateUndo() {
  const btn = $('undo-move');
  const left = lastMove ? Math.ceil((lastMove.until - performance.now()) / 1000) : 0;
  if (left <= 0) {
    lastMove = null;
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  btn.textContent = `↩ Rückgängig (${left})`;
}

$('undo-move').onclick = () => {
  if (!lastMove) return;
  syncBandits();
  syncProduction();
  const record = lastMove.record;
  lastMove = null;
  if (undoMove(state, record)) {
    startMoveAnimation({ ...record, from: record.to, to: record.from, path: record.path && [...record.path].reverse() });
    selected = tileAt(state, record.from.x, record.from.y) || null;
    toast(`Rückgängig · ${record.free ? '🧭 Freizug' : `${record.cost} ${GOLD_ICON}`} erstattet`);
    save();
    refreshTargets();
  } else toast('Rückgängig ist nicht mehr möglich');
  updateUndo();
};
$('btn-cancel-move').onclick = cancelMove;

function flashPairs(pairs) {
  const now = performance.now();
  for (const p of pairs) flashes.push({ x: p.tile.x, y: p.tile.y, value: p.value, start: now });
}

// ---------- UI ----------
const fmt = (n) => String(Math.round(n * 100) / 100);
const givesText = (def) => Object.entries(def.gives || {}).map(([id, n]) => `${TILES[id].name} +${n}`).join(', ');

function displayPartners(tile) {
  const otherType = tile.type === 'workshop' ? 'werkzeugschmiede' : tile.type === 'werkzeugschmiede' ? 'workshop' : null;
  if (!otherType) return partnersOf(state, tile);
  const neighbors = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const neighbor = tileAt(state, tile.x + dx, tile.y + dy);
    if (neighbor?.type === otherType) neighbors.push(neighbor);
  }
  return neighbors;
}

// Simuliert den gewählten Zug, um Auswirkungen vor dem Bestätigen anzuzeigen.
function previewSimulation() {
  if (!moveMode || !movePreview) return null;
  const tile = moveMode.tile;
  const tiles = { ...state.tiles };
  const cell = t => `${t.x},${t.y}`;
  if (movePreview.kind === 'swap') {
    const other = movePreview.tile;
    const moved = { ...tile, x: other.x, y: other.y }, swapped = { ...other, x: tile.x, y: tile.y };
    tiles[cell(moved)] = moved;
    tiles[cell(swapped)] = swapped;
    return { sim: { ...state, tiles }, copies: new Map([[tile, moved], [other, swapped]]) };
  }
  delete tiles[cell(tile)];
  const rarity = movePreview.special ? upgradedRarity(tileRarity(tile)) : tileRarity(tile);
  const moved = { ...tile, x: movePreview.x, y: movePreview.y, rarity };
  tiles[cell(moved)] = moved;
  return { sim: { ...state, tiles }, copies: new Map([[tile, moved]]) };
}

function previewBuffs() {
  if (previewBuffCache) return previewBuffCache;
  const simulation = previewSimulation();
  if (!simulation) return [];
  const { sim, copies } = simulation;
  const resources = { holz: '🪵', korn: '🌾', gold: '🪙', werkzeug: '🔨' };
  const total = production => Object.fromEntries(Object.keys(resources).map(id => [id, production.base[id] + production.bonus[id]]));
  const buffs = [];
  for (const tile of Object.values(state.tiles)) {
    const after = copies.get(tile) || tile;
    const before = tileProduction(state, tile), now = tileProduction(sim, after);
    const a = total(before), b = total(now);
    const parts = [];
    let gain = 0;
    for (const id of Object.keys(resources)) {
      const delta = b[id] - a[id];
      if (Math.abs(delta) < 1e-9) continue;
      gain += Math.sign(delta);
      parts.push(`${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))} ${resources[id]}/Tick`);
    }
    if (!parts.length) continue;
    const note = now.supply?.active && !before.supply?.active ? ' (aktiviert)' :
      before.supply?.active && !now.supply?.active ? ' (Notbetrieb)' : '';
    buffs.push({ tile: after, name: TILES[tile.type].name, moved: copies.has(tile), gain: gain >= 0, text: parts.join(', ') + note });
  }
  previewBuffCache = buffs;
  return buffs;
}

function previewBuffText() {
  const buffs = previewBuffs();
  if (!buffs.length) return 'Keine Änderung an der Produktion.';
  const shown = buffs.slice(0, 3).map(({ name, moved, text }) => `${name}${moved ? ' (bewegt)' : ''}: ${text}`);
  if (buffs.length > shown.length) shown.push(`und ${buffs.length - shown.length} weitere`);
  return `<span class="preview-buffs"><b>Auswirkung:</b> ${shown.join(' · ')}</span>`;
}

function updatePanel() {
  const panel = $('panel');
  const hand = state.hand && CARDS[state.hand];
  $('btn-cancel-move').hidden = !moveMode;
  if (hand) {
    panel.classList.remove('hidden');
    const blockedDelete = state.hand === 'joker_loeschen' && Object.keys(state.tiles).length <= 1;
    $('btn-return-card').hidden = !JOKERS[state.hand];
    const message = blockedDelete ? 'Das letzte Tile kann nicht gelöscht werden.' :
      state.hand === 'joker_loeschen' ? 'Tile antippen, um es zu löschen' :
      state.hand === 'joker_verwandeln' ? 'Tile antippen, um es zufällig zu verwandeln' :
      state.hand === 'joker_schutz' ? 'Freies oder belegtes Feld antippen, um es dauerhaft vor Banditen zu schützen' : '';
    $('panel-info').innerHTML = `<b>${hand.icon} ${hand.name}</b><br>${message}`;
  } else if (moveMode) {
    panel.classList.remove('hidden');
    $('btn-return-card').hidden = true;
    const tile = moveMode.tile, def = TILES[tile.type];
    const free = state.freeMoves || 0;
    const head = `<b>↔ ${def.icon} ${def.name} verschieben</b> · ${moveStepCost(tile)} ${GOLD_ICON}/Feld · Tausch ${SWAP_COST} ${GOLD_ICON}${free ? ` · 🧭 ${free} Freizüge` : ''}`;
    let message;
    if (movePreview) {
      const price = free ? '🧭 Freizug' : `${movePreview.cost} ${GOLD_ICON}`;
      const target = movePreview.kind === 'swap' ? `Tausch mit ${TILES[movePreview.tile.type].name}` : `Nach (${movePreview.x}, ${movePreview.y}) · ${movePreview.distance} ${movePreview.distance === 1 ? 'Feld' : 'Felder'}`;
      const from = tileRarity(tile), to = upgradedRarity(from);
      const special = !movePreview.special ? '' : from === to ? '<br>✨ Spezial-Bauplatz · bereits Epic' : `<br>✨ Spezial-Bauplatz: ${RARITY[from].name} → ${RARITY[to].name}`;
      message = `${target} · <b>${price}</b> · ${canPayMove(state, movePreview.cost) ? 'erneut antippen zum Bestätigen' : 'nicht genug Gold'}${special}<br>${previewBuffText()}`;
    } else {
      message = moveMode.moves.length || moveMode.swaps.length
        ? 'Ziel antippen – der Preis steht auf dem Feld · 🔁 tauscht mit dem Nachbarn · ✨ erhöht die Seltenheit'
        : 'Kein Ziel verfügbar';
    }
    $('panel-info').innerHTML = `${head}<br>${message}`;
  } else {
    panel.classList.add('hidden');
  }
  updateTilePopup();
}

function updateTilePopup() {
  const el = $('tile-popup');
  if (!selected || state.hand || moveMode) { el.classList.add('hidden'); return; }
  const def = TILES[selected.type];
  const partners = displayPartners(selected);
  let html = `<div class="head"><b>${def.icon} ${def.name}</b><button id="tile-close">✕</button></div>`;
  html += `<div class="dim">${RARITY[tileRarity(selected)].name} · Position ${selected.x}, ${selected.y}</div>`;
  if (selected.type !== 'banditen') {
    const free = state.freeMoves || 0;
    html += `<button id="tile-move" class="tile-move">↔ Verschieben · ${free ? `🧭 ${free} frei` : `${moveStepCost(selected)} ${GOLD_ICON}/Feld`}</button>`;
  }
  if (state.protectedFields[`${selected.x},${selected.y}`]) html += '<div>🛡️ Dieses Feld ist dauerhaft vor Banditen geschützt.</div>';
  const descriptions = {
    wald: 'Produziert allein nichts. Versorgt benachbarte Holzfäller; höhere Seltenheit erhöht deren Ertrag.',
    holzfaeller: `Braucht mindestens ${MIN_SUPPLIERS} benachbarte Forste (auch diagonal). Sonst Notbetrieb mit ${EMERGENCY_RATE * 100} %.`,
    feld: 'Produziert allein nichts. Versorgt benachbarte Windmühlen; höhere Seltenheit erhöht deren Ertrag.',
    windmuehle: `Braucht mindestens ${MIN_SUPPLIERS} benachbarte Felder (auch diagonal). Sonst Notbetrieb mit ${EMERGENCY_RATE * 100} %.`,
    haus: 'Erzeugt Gold durch benachbarte Häuser und Tavernen.',
    taverne: 'Erzeugt Gold mit benachbarten Häusern.',
    rathaus: `Das Start-Gebäude: erzeugt automatisch ${TOWN_HALL_OUTPUT.gold} Gold und ${TOWN_HALL_OUTPUT.werkzeug} Werkzeug pro 10 Sekunden.`,
    workshop: `Produziert Werkzeuge. Braucht mindestens ${MIN_SUPPLIERS} benachbarte Werkzeugschmieden (auch diagonal), sonst Notbetrieb mit ${EMERGENCY_RATE * 100} %.`,
    lagerhalle: `Erhöht das Holzlager um ${STORAGE_BONUS * tileStrength(selected)}.`,
    kornlager: `Erhöht das Kornlager um ${STORAGE_BONUS * tileStrength(selected)}.`,
    goldlager: `Erhöht das Goldlager um ${STORAGE_BONUS * tileStrength(selected)}.`,
    werkzeugschmiede: 'Produziert allein nichts. Versorgt benachbarte Workshops; höhere Seltenheit erhöht deren Ertrag.',
    wachturm: `Schützt einen Bereich von ${guardRadius(selected) * 2 + 1}×${guardRadius(selected) * 2 + 1} Feldern und entfernt dort Banditencamps.`,
    banditen: 'Breitet sich bei jedem Banditen-Timer auf ein ungeschütztes Nachbarfeld aus. Joker wirken nicht.',
  };
  html += `<div>${descriptions[selected.type] || 'Keine Produktion.'}</div>`;
  const { base, bonus, supply } = tileProduction(state, selected);
  const resourceNames = { holz: '🪵 Holz', korn: '🌾 Korn', gold: '🪙 Gold', werkzeug: '🔨 Werkzeuge' };
  if (supply) {
    const supplierName = TILES[supply.supplier].name;
    html += supply.active
      ? `<div>✅ Aktiv: <b>${supply.count} ${supplierName}-Nachbarn</b></div>`
      : `<div>⚠️ Notbetrieb: <b>${supply.count}/${supply.required} ${supplierName}-Nachbarn</b> · ${EMERGENCY_RATE * 100} % Leistung</div>`;
  }
  for (const id of ['holz', 'korn', 'gold', 'werkzeug']) {
    if (!base[id] && !bonus[id]) continue;
    const label = supply ? (supply.active ? `${base[id]} aus Nachbarn + ${bonus[id]} Seltenheit der Nachbarn` : 'Notbetrieb') : `${base[id]} Basis + ${bonus[id]} Nachbarschaftsbonus`;
    html += `<div>Aktueller Ertrag: <b>${fmt(base[id] + bonus[id])} ${resourceNames[id]} / 10 Sek.</b><br><span class="dim">${label}</span></div>`;
  }
  if (selected.type === 'haus' || selected.type === 'taverne') {
    if (!bonus.gold) html += '<div>Aktueller Ertrag: <b>0 Gold / 10 Sek.</b></div>';
    html += '<div class="dim">Gold zählt gemeinsam pro Paar, nicht doppelt pro Gebäude.</div>';
  }
  if (selected.type === 'workshop') {
    html += `<div class="dim">Aufträge laufen gemeinsam über alle Workshops; Packs startest du im Workshop-Menü.</div>`;
  } else if (selected.type === 'werkzeugschmiede') {
    html += `<div>Versorgte Workshops: ${partners.length}</div>`;
  } else if (def.storage) {
    html += `<div>Aktuelle Gesamtkapazität: ${storageCapacity(state)[def.storage]} ${resourceNames[def.storage]}</div>`;
  } else if (selected.type === 'banditen') {
    const target = selected.target && tileAt(state, selected.target.x, selected.target.y);
    html += selected.target ? `<div>Nächstes Ziel: <b>${target ? TILES[target.type].name : 'Freies Feld'} (${selected.target.x}, ${selected.target.y})</b></div>` :
      '<div>Kein ungeschütztes Ziel in Reichweite.</div>';
  }
  if (supply) {
    html += `<div class="dim">Je ${TILES[supply.supplier].name}: +${SUPPLIER_OUTPUT * tileStrength(selected)}, zusätzlich +1 je Seltenheitsstufe dieses Nachbarn über Common.</div>`;
  } else if (def.gives) {
    html += `<div>Basisbonus je Nachbar: <b>${givesText(def)}</b> pro 10 Sek. · höhere Seltenheit verstärkt das Paar.</div>`;
  }
  html += `<div>Aktive Paare: <b>${partners.length}</b> <span class="dim">(orange markiert)</span></div>`;
  el.innerHTML = html;
  const top = Math.max($('hud').getBoundingClientRect().bottom, $('queue-wrap').getBoundingClientRect().bottom) + 8;
  el.style.top = `${top}px`;
  el.style.maxHeight = `calc(100vh - ${top + 8}px)`;
  el.classList.remove('hidden');
  $('tile-close').onclick = () => { selected = null; updatePanel(); };
  if ($('tile-move')) $('tile-move').onclick = () => startMove(selected);
}

let queueKey = '';
function chip(id) {
  const d = CARDS[id];
  return `<span class="chip" style="background:${d.color}">${d.icon} ${d.name}</span>`;
}
function cardArt(id) {
  const card = CARDS[id];
  const theme = JOKERS[id] ? 'joker' : HAZARDS[id] ? 'gefahr' : card.category;
  return `<span class="card-art ${theme}" aria-hidden="true"><svg viewBox="0 0 100 100"><use href="assets/card-art.svg?v=5#${id}"></use></svg></span>`;
}
function renderQueue() {
  const key = `${state.deck[0] || 'empty'}:${state.deckRarities[0]}:${state.deck.length}`;
  $('queue').disabled = !!state.hand || !state.deck.length;
  $('btn-delete-card').disabled = !canDeleteCard(state);
  if (key === queueKey) return;
  queueKey = key;
  const card = CARDS[state.deck[0]];
  $('queue').setAttribute('aria-label', card ? `${card.name}${TILES[state.deck[0]] ? `, ${RARITY[state.deckRarities[0]].name}` : ''} ziehen` : 'Deck leer');
  $('queue').innerHTML = card
    ? `<span class="queue-label">Als Nächstes · ${state.deck.length} Karten · antippen</span>${cardArt(state.deck[0])}<b>${card.name}</b>${TILES[state.deck[0]] ? `<span class="rarity-label" style="color:${RARITY[state.deckRarities[0]].color}">${RARITY[state.deckRarities[0]].name}</span>` : ''}${INSTANT_JOKERS.includes(state.deck[0]) ? '<span>Wirkt sofort</span>' : TILES[state.deck[0]] ? '<span>Erscheint zufällig</span>' : ''}`
    : '<span class="queue-label">Deck leer</span>';
}

function updateHud() {
  const caps = storageCapacity(state);
  $('r-gold').textContent = `${state.gold}/${caps.gold}`;
  $('r-holz').textContent = `${state.resources.holz}/${caps.holz}`;
  $('r-korn').textContent = `${state.resources.korn}/${caps.korn}`;
  $('r-werkzeug').textContent = `${Math.floor(state.resources.werkzeug)}/${caps.werkzeug}`;
  $('r-banditen').textContent = formatTime(BANDIT_INTERVAL - state.banditElapsed);
  const readyPacks = Object.values(state.packs).reduce((sum, count) => sum + count, 0);
  $('btn-cards-label').textContent = readyPacks ? `Inventar 📦${readyPacks}` : 'Inventar';
  $('btn-cards').setAttribute('aria-label', readyPacks ? `Inventar, ${readyPacks} fertige Packs` : 'Inventar');
  $('ready-packs').hidden = !readyPacks;
  $('ready-packs-count').textContent = readyPacks;
  $('ready-packs').setAttribute('aria-label', `${readyPacks} fertige Packs öffnen`);
  $('panel').classList.toggle('has-ready-packs', readyPacks > 0);
  $('btn-shuffle-label').textContent = `${SHUFFLE_COST}🪙`;
  $('btn-shuffle').disabled = state.gold < SHUFFLE_COST || state.deck.length < 2;
  const sale = shopStatus(state);
  $('btn-shop-label').textContent = `Shop ${formatTime(sale.remaining)}`;
  $('btn-shop').setAttribute('aria-label', `Shop, neue Angebote in ${formatTime(sale.remaining)}`);
  updateFilterControls();
  renderQueue();
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), msg.includes('Lagerverlust:') ? 3500 : 1500);
}

function lossText(losses = {}) {
  const names = { gold: 'Gold', holz: 'Holz', korn: 'Korn', werkzeug: 'Werkzeuge' };
  const parts = Object.entries(losses).map(([id, amount]) => `${fmt(amount)} ${names[id]}`);
  return parts.length ? ` · Lagerverlust: ${parts.join(', ')}` : '';
}

function drawNextCard() {
  syncBandits();
  syncProduction();
  const card = drawCard(state);
  if (!card) { toast(state.hand ? 'Erst die Karte einsetzen' : 'Keine Karten – stelle ein Pack her'); return; }
  moveMode = null;
  movePreview = null;
  if (card === 'joker_banditenzeit') {
    selected = null;
    refreshTargets();
    save();
    toast(`⏳ Banditen-Timer auf ${formatTime(BANDIT_INTERVAL)} zurückgesetzt`);
    return;
  }
  if (card === 'joker_shop') {
    selected = null;
    refreshTargets();
    save();
    updateShopView();
    toast('🔄 Shop-Angebot erneuert · nächster Wechsel in 5:00');
    return;
  }
  if (card === 'joker_freizug') {
    selected = null;
    refreshTargets();
    save();
    toast(`🧭 ${state.freeMoves} Freizüge verfügbar – der nächste Zug kostet kein Gold`);
    return;
  }
  if (TILES[card] && !HAZARDS[card]) {
    const result = placeRandomTile(state);
    if (result) {
      const land = LAND_TYPES.includes(card);
      selected = land ? null : result.tile;
      flashPairs(result.pairs);
      focusNewTile(result.tile);
      toast(`${TILES[card].name} bei (${result.tile.x}, ${result.tile.y}) erschienen${land ? '' : ' · ↔ Verschieben im Tile-Info'}`);
    } else {
      returnHand(state);
      selected = null;
      toast('Kein freies Nachbarfeld – Karte ans Deckende gelegt');
    }
    refreshTargets();
    save();
    return;
  }
  if (HAZARDS[card]) {
    const result = spawnBandit(state);
    if (result) {
      selected = result.tile;
      cam.x = (selected.x + 0.5) * TILE;
      cam.y = (selected.y + 0.5) * TILE;
      toast(`${result.previous ? `Banditen übernehmen ${TILES[result.previous.type].name}!` : 'Ein Banditencamp ist erschienen!'}${lossText(result.losses)}`);
    } else {
      returnHand(state);
      selected = null;
      toast('Kein ungeschütztes Feld – Niete ans Deckende gelegt');
    }
    refreshTargets();
    save();
    return;
  }
  selected = null;
  refreshTargets();
  save();
}
$('queue').onclick = drawNextCard;

$('btn-return-card').onclick = () => {
  if (!JOKERS[state.hand]) return;
  returnHand(state);
  refreshTargets();
  save();
  toast('Joker ans Deckende gelegt');
};

let overlayView = '';
function openOverlay(title, view = '') {
  overlayView = view;
  $('overlay-title').textContent = title;
  $('overlay').classList.remove('hidden');
  return $('overlay-body');
}
function closeOverlay() {
  const wasFilter = overlayView === 'tile-filter';
  overlayView = '';
  $('overlay').classList.add('hidden');
  if (wasFilter) $('btn-filter').focus();
}
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
    activeSince = document.visibilityState === 'visible' ? performance.now() : null;
    cam = initialCamera();
    selected = null;
    moveMode = null;
    movePreview = null;
    previewBuffCache = null;
    lastMove = null;
    moveAnims = [];
    flashes.length = 0;
    closeOverlay();
    refreshTargets();
    toast('Neues Spiel gestartet');
  };
  body.append(cancel, confirm);
};

const costText = (cost) => `${cost} ${GOLD_ICON}`;

const WAREHOUSE_RESOURCES = [
  { id: 'gold', name: 'Gold', icon: '🪙' },
  { id: 'holz', name: 'Holz', icon: '🪵' },
  { id: 'korn', name: 'Korn', icon: '🌾' },
  { id: 'werkzeug', name: 'Werkzeuge', icon: '🔨' },
];

function filterName(filter) {
  return filter.kind === 'resource'
    ? WAREHOUSE_RESOURCES.find(resource => resource.id === filter.id).name
    : TILES[filter.id].name;
}

function updateFilterControls() {
  const name = activeFilter && filterName(activeFilter);
  const label = name ? `Filter ${name} aktiv${state.hand ? ', während des Platzierens pausiert' : ''} – Filter öffnen` : 'Tile-Filter öffnen';
  $('btn-filter').classList.toggle('filter-active', !!activeFilter);
  $('btn-filter').setAttribute('aria-label', label);
  $('btn-filter').title = label;
  $('filter-clear').hidden = !activeFilter;
  $('filter-clear').setAttribute('aria-label', name ? `Filter ${name} ausschalten` : 'Filter ausschalten');
  $('filter-clear').title = name ? `Filter ${name} ausschalten` : 'Filter ausschalten';
}

function setTileFilter(filter) {
  activeFilter = filter;
  updateFilterControls();
  toast(filter ? `Filter: ${filterName(filter)}${state.hand ? ' · nach dem Platzieren sichtbar' : ''}` : 'Filter ausgeschaltet');
}

function showTileFilters() {
  const body = openOverlay('Tile-Filter', 'tile-filter');
  body.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'pack-chances';
  hint.textContent = 'Wähle eine Rohstoffkette oder einen Tile-Typ. Beim Platzieren pausiert die Hervorhebung.';
  body.appendChild(hint);

  const addGroup = (title, options) => {
    const heading = document.createElement('h3');
    heading.className = 'section-title';
    heading.textContent = title;
    body.appendChild(heading);
    const group = document.createElement('div');
    group.className = 'filter-options';
    for (const option of options) {
      const button = document.createElement('button');
      button.className = 'filter-option';
      button.dataset.filterKind = option.kind;
      button.dataset.filterId = option.id;
      button.textContent = option.label;
      button.setAttribute('aria-pressed', String(activeFilter?.kind === option.kind && activeFilter.id === option.id));
      button.onclick = () => {
        setTileFilter({ kind: option.kind, id: option.id });
        closeOverlay();
      };
      group.appendChild(button);
    }
    body.appendChild(group);
  };
  addGroup('Rohstoffketten', WAREHOUSE_RESOURCES.map(resource => ({
    kind: 'resource', id: resource.id,
    label: `${resource.icon} ${resource.name} · ${RESOURCE_CHAINS[resource.id].map(id => TILES[id].name).join(', ')}`,
  })));
  addGroup('Einzelne Tile-Typen', Object.entries(TILES).map(([id, tile]) => ({
    kind: 'tile', id, label: `${tile.icon ? `${tile.icon} ` : ''}${tile.name}`,
  })));
  body.querySelector('button').focus();
}

$('btn-filter').onclick = showTileFilters;
$('filter-clear').onclick = () => {
  setTileFilter(null);
  $('btn-filter').focus();
};

let warehouseResource = null;

function showWarehouse(resourceId = null) {
  warehouseResource = WAREHOUSE_RESOURCES.find(resource => resource.id === resourceId) || null;
  const body = openOverlay('Warehouse', 'warehouse');
  body.innerHTML = '';
  for (const resource of WAREHOUSE_RESOURCES) {
    const button = document.createElement('button');
    button.className = 'row resource-option';
    button.dataset.resource = resource.id;
    button.setAttribute('aria-pressed', 'false');
    button.onclick = () => {
      warehouseResource = resource;
      syncBandits();
      syncProduction();
      updateWarehouse();
    };
    body.appendChild(button);
  }
  const detail = document.createElement('div');
  detail.id = 'warehouse-detail';
  detail.className = 'workshop';
  body.appendChild(detail);
  updateWarehouse();
}

function updateWarehouse() {
  if (overlayView !== 'warehouse') return;
  const caps = storageCapacity(state);
  for (const resource of WAREHOUSE_RESOURCES) {
    const stock = resource.id === 'gold' ? state.gold : state.resources[resource.id];
    const button = document.querySelector(`[data-resource="${resource.id}"]`);
    button.textContent = `${resource.icon} ${resource.name} · Bestand: ${fmt(stock)} / ${caps[resource.id]}`;
    button.setAttribute('aria-pressed', String(warehouseResource?.id === resource.id));
  }
  const detail = $('warehouse-detail');
  if (!warehouseResource) {
    detail.textContent = 'Tippe eine Ressource an, um ihren Ertrag pro Tick zu sehen.';
    return;
  }
  const { id, name, icon } = warehouseResource;
  const rate = productionRates(state)[id];
  detail.innerHTML = `<b>${icon} ${name}: +${fmt(rate)} pro Tick</b><div class="pack-chances">Ein Tick dauert ${PRODUCTION_INTERVAL / 1000} Sekunden. Gesamtertrag aller Tiles inklusive Nachbarschaftsboni; Goldpaare zählen nur einmal.</div>`;
  const stock = id === 'gold' ? state.gold : state.resources[id];
  const stored = Math.min(rate, Math.max(0, caps[id] - stock));
  detail.innerHTML += `<div class="pack-chances">Bei aktuellem Lagerstand passen beim nächsten Tick ${fmt(stored)} ${name} ins Lager. Lagerlimit: ${caps[id]}; neu produzierter Überschuss verfällt.${stock > caps[id] ? ' Vorhandener Überschuss bleibt bis zur Ausgabe erhalten.' : ''}</div>`;
}

function showInventory() {
  const body = openOverlay(`Inventar & Deck (${cardCount(state)} Karten)`, 'inventory');
  body.innerHTML = '';
  const packTitle = document.createElement('h3');
  packTitle.className = 'section-title';
  packTitle.textContent = 'Fertige Packs';
  body.appendChild(packTitle);
  const packEntries = Object.entries(state.packs).filter(([, count]) => count > 0);
  if (!packEntries.length) {
    const empty = document.createElement('div');
    empty.textContent = 'Noch keine Packs im Inventar.';
    body.appendChild(empty);
  }
  for (const [id, count] of packEntries) {
    const row = document.createElement('div');
    row.className = 'pack';
    const name = id === 'starthilfe' ? 'Starthilfe-Pack' : PACKS[id].name;
    row.innerHTML = `<span>📦 ${name} ×${count}</span>`;
    const btn = document.createElement('button');
    btn.textContent = 'Öffnen';
    btn.onclick = () => {
      const cards = openPack(state, id);
      if (!cards) { toast('Pack nicht verfügbar'); return; }
      save();
      showInventory();
      toast(`Erhalten: ${cards.map(card => CARDS[card].name).join(', ')}`);
    };
    row.appendChild(btn);
    body.appendChild(row);
  }
  const deckTitle = document.createElement('h3');
  deckTitle.className = 'section-title';
  deckTitle.textContent = 'Deck – Reihenfolge der Ziehung';
  body.appendChild(deckTitle);
  const rarityInfo = document.createElement('div');
  rarityInfo.className = 'pack-chances';
  rarityInfo.textContent = 'Tile-Seltenheit: Common weiß 70 % · Uncommon grün 20 % · Rare blau 8 % · Epic lila 2 %. Höhere Stufen verstärken die Wirkung.';
  body.appendChild(rarityInfo);
  if (!state.deck.length) {
    const empty = document.createElement('div');
    empty.textContent = 'Keine Karten im Deck.';
    body.appendChild(empty);
  }
  state.deck.forEach((id, i) => {
    const d = CARDS[id];
    const rarity = state.deckRarities[i];
    const el = document.createElement('div');
    el.className = `card ${rarity}`;
    el.innerHTML = `<span class="card-number">#${i + 1}</span>${cardArt(id)}<b class="card-name">${d.name}</b><span class="card-rarity">${RARITY[rarity].name}</span>${INSTANT_JOKERS.includes(id) ? '<span class="card-effect">Wirkt sofort</span>' : TILES[id] ? '<span class="card-effect">Erscheint zufällig</span>' : ''}`;
    body.appendChild(el);
  });
}

let shopViewKey = '';
function showShop() {
  const body = openOverlay('Shop', 'shop');
  body.innerHTML = '';
  const sale = shopStatus(state);
  shopViewKey = `${state.shop.round}|${sale.open}`;
  const status = document.createElement('div');
  status.id = 'shop-sale-status';
  status.className = 'workshop';
  body.appendChild(status);
  if (sale.open) {
    const round = state.shop.round;
    for (const offer of state.shop.offers) {
      const card = CARDS[offer.card];
      const row = document.createElement('div');
      row.className = 'pack';
      row.innerHTML = `<span><b>${card.icon} ${card.name}</b> · <s>${SHOP_PRICES[card.shopTier || card.rarity]} ${GOLD_ICON}</s> → ${offer.price} ${GOLD_ICON}${HAZARDS[offer.card] ? '<br>Vorsicht: Diese Niete lässt Banditen erscheinen!' : offer.card === 'joker_banditenzeit' ? '<br>Setzt den Banditen-Timer beim Ziehen sofort zurück.' : offer.card === 'joker_shop' ? '<br>Erneuert das Shop-Angebot beim Ziehen sofort.' : offer.card === 'joker_freizug' ? '<br>Gibt beim Ziehen sofort 5 kostenlose Züge.' : ''}</span>`;
      const button = document.createElement('button');
      button.dataset.shopCard = offer.card;
      button.onclick = () => {
        syncBandits();
        syncProduction();
        if (!buyShopCard(state, offer.card, round)) { toast('Kauf nicht möglich: Angebot erneuert, ausverkauft oder zu wenig Gold'); updateShopView(); return; }
        save();
        showShop();
        toast(`${card.name} gekauft – im Inventar am Deckende`);
      };
      row.appendChild(button);
      body.appendChild(row);
    }
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
  if (state.size !== START_SIZE) {
    const notice = document.createElement('p');
    notice.textContent = 'Das Spielfeld ist bereits erweitert.';
    body.appendChild(notice);
  }
  updateShopView();
}

function updateShopView() {
  if (overlayView !== 'shop') return;
  const sale = shopStatus(state);
  if (shopViewKey !== `${state.shop.round}|${sale.open}`) {
    const scroll = $('overlay-box').scrollTop;
    showShop();
    $('overlay-box').scrollTop = scroll;
    return;
  }
  $('shop-sale-status').textContent = `Shop dauerhaft geöffnet · neue Angebote in ${formatTime(sale.remaining)} aktiver Spielzeit. ${SHOP_DISCOUNT * 100} % Rabatt; jede Karte einmal verfügbar.`;
  for (const offer of state.shop.offers) {
    const button = document.querySelector(`[data-shop-card="${offer.card}"]`);
    if (!button) continue;
    button.textContent = offer.bought ? 'Ausverkauft' : `Kaufen · ${offer.price} ${GOLD_ICON}`;
    button.disabled = !sale.open || offer.bought || state.gold < offer.price;
  }
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateJobIndicator(indicator, now = Date.now()) {
  const remaining = Math.max(0, Number(indicator.dataset.endsAt) - now);
  indicator.querySelector('.job-timer').textContent = `Noch ${formatTime(remaining)}`;
  const duration = Number(indicator.dataset.duration);
  if (duration > 0) {
    indicator.querySelector('progress').value = Math.max(0, Math.min(1, 1 - remaining / duration));
  }
}

function createJobStatus(job) {
  const status = document.createElement('div');
  const name = job.pack === 'starthilfe' ? 'Starthilfe-Pack' : PACKS[job.pack].name;
  status.className = 'job-status';
  status.dataset.endsAt = job.endsAt;
  if (job.duration != null) status.dataset.duration = job.duration;
  const heading = document.createElement('div');
  heading.className = 'job-heading';
  const packName = document.createElement('b');
  packName.textContent = name;
  const timer = document.createElement('strong');
  timer.className = 'job-timer';
  heading.append(packName, timer);
  const progress = document.createElement('progress');
  progress.max = 1;
  progress.setAttribute('aria-label', `Fortschritt ${name}`);
  status.append(heading, progress);
  updateJobIndicator(status);
  return status;
}

let craftingJobsKey = '';
function updateCraftingPanel() {
  if ($('crafting-panel').classList.contains('closed')) return;
  const jobs = [...state.crafting].sort((a, b) => a.endsAt - b.endsAt);
  const key = JSON.stringify(jobs.map(job => [job.pack, job.duration, job.endsAt]));
  if (key === craftingJobsKey) return;
  craftingJobsKey = key;
  const body = $('crafting-jobs');
  body.innerHTML = '';
  if (!jobs.length) {
    body.textContent = 'Zurzeit keine laufenden Aufträge.';
    return;
  }
  const count = document.createElement('div');
  count.className = 'pack-chances';
  count.textContent = `${jobs.length}/${MAX_CRAFT_JOBS} Aufträge`;
  body.appendChild(count);
  for (const job of jobs) {
    const section = document.createElement('div');
    section.className = 'workshop';
    section.appendChild(createJobStatus(job));
    body.appendChild(section);
  }
}

$('crafting-toggle').onclick = () => {
  const panel = $('crafting-panel');
  const open = panel.classList.contains('closed');
  panel.classList.toggle('closed', !open);
  $('crafting-content').inert = !open;
  $('crafting-toggle').setAttribute('aria-expanded', String(open));
  $('crafting-toggle').setAttribute('aria-label', open ? 'Herstellungsübersicht schließen' : 'Herstellungsübersicht öffnen');
  $('crafting-toggle').textContent = open ? '❯' : '❮';
  if (open) {
    syncBandits();
    syncProduction();
    craftingJobsKey = '';
    updateCraftingPanel();
  }
};

const COST_ICONS = { gold: '🪙', holz: '🪵', korn: '🌾', werkzeug: '🔨' };
function showWorkshops() {
  const body = openOverlay('Workshops', 'workshops');
  body.innerHTML = '';
  const rates = productionRates(state);
  const caps = storageCapacity(state);
  const summary = document.createElement('div');
  summary.className = 'pack-chances';
  summary.textContent = `🔨 Werkzeuge: ${Math.floor(state.resources.werkzeug)}/${caps.werkzeug} · +${fmt(rates.werkzeug)} alle ${PRODUCTION_INTERVAL / 1000} Sek. · Aufträge: ${state.crafting.length}/${MAX_CRAFT_JOBS}`;
  body.appendChild(summary);
  const workshops = Object.values(state.tiles).filter(tile => tile.type === 'workshop');
  if (!workshops.length && !Object.values(state.tiles).some(tile => tile.type === 'rathaus')) {
    const notice = document.createElement('p');
    notice.textContent = 'Weder Rathaus noch Workshop platziert – es entstehen keine Werkzeuge.';
    body.appendChild(notice);
  }
  for (const tile of workshops) {
    const { supply, base, bonus } = tileProduction(state, tile);
    const section = document.createElement('div');
    section.className = 'workshop';
    const head = document.createElement('div');
    head.className = 'workshop-head';
    const title = document.createElement('div');
    title.textContent = `🛠️ Workshop (${tile.x}, ${tile.y}) · ${supply.active ? '✅' : '⚠️ Notbetrieb'} ${supply.count}/${supply.required} Schmieden · +${fmt(base.werkzeug + bonus.werkzeug)} 🔨`;
    const jump = document.createElement('button');
    jump.textContent = 'Anzeigen';
    jump.onclick = () => jumpTo(tile);
    head.append(title, jump);
    section.appendChild(head);
    body.appendChild(section);
  }
  const pct = value => `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value * 100)} %`;
  const start = (id, times) => {
    syncBandits();
    syncProduction();
    let started = 0;
    for (let n = 0; n < times && startPack(state, id); n++) started++;
    if (!started) toast('Herstellung nicht möglich');
    else if (started > 1) toast(`${started} Aufträge gestartet`);
    save();
    const scroll = $('overlay-box').scrollTop;
    showWorkshops();
    $('overlay-box').scrollTop = scroll;
  };
  for (const [id, pack] of Object.entries(PACKS)) {
    const row = document.createElement('div');
    row.className = 'workshop pack pack-recipe';
    const head = document.createElement('div');
    head.className = 'pack-recipe-head';
    const info = document.createElement('div');
    const cost = Object.entries(pack.cost).map(([resource, amount]) => `${COST_ICONS[resource]} ${amount}`).join(' · ');
    const valueLabel = id === 'joker' ? 'Joker' : 'Wertkarte';
    info.innerHTML = `<b>${pack.name}</b> · ${cost} · ${formatTime(craftDuration(id))}<div class="pack-chances">${pack.land} Landkarten + 1 ${valueLabel}, mit ${pct(pack.extraChance)} eine zweite.${pack.hazardChance ? ` Mit ${pct(pack.hazardChance)} ersetzt eine Banditen-Niete eine Landkarte.` : ''}</div>`;
    const buttons = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = 'Herstellen';
    button.disabled = !canStartPack(state, id);
    button.onclick = () => start(id, 1);
    buttons.appendChild(button);
    const max = maxStartablePacks(state, id);
    if (max > 1) {
      const all = document.createElement('button');
      all.textContent = `Max (${max})`;
      all.onclick = () => start(id, max);
      buttons.appendChild(all);
    }
    head.append(info, buttons);
    row.appendChild(head);
    const chances = packChances(pack);
    for (const [group, label] of [['value', `${id === 'joker' ? 'Joker' : 'Wertkarten'} – Chance je Karte`], ['land', 'Landkarten – Chance je Karte']]) {
      const groupTitle = document.createElement('div');
      groupTitle.className = 'pack-chances';
      groupTitle.textContent = label;
      row.appendChild(groupTitle);
      const contents = document.createElement('div');
      contents.className = 'pack-contents';
      for (const [type, chance] of chances[group]) {
        const card = CARDS[type];
        const item = document.createElement('div');
        item.className = 'pack-item';
        const percent = `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(chance)} %`;
        const icon = document.createElement('span');
        icon.className = 'pack-item-icon';
        icon.style.background = card.color;
        icon.textContent = card.icon;
        icon.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.textContent = card.name + (INSTANT_JOKERS.includes(type) ? ' (wirkt sofort)' : '');
        const value = document.createElement('span');
        value.className = 'pack-item-chance';
        value.textContent = percent;
        item.append(icon, name, value);
        contents.appendChild(item);
      }
      row.appendChild(contents);
    }
    body.appendChild(row);
  }
  if (canStartRecovery(state)) {
    const row = document.createElement('div');
    row.className = 'pack';
    row.textContent = `Starthilfe-Pack: kostenlos, mit Holzfäller, Windmühle, Forsten und Feldern · ${formatTime(craftDuration('starthilfe'))}`;
    const button = document.createElement('button');
    button.textContent = 'Herstellen';
    button.onclick = () => {
      syncBandits();
      syncProduction();
      if (!startRecovery(state)) { toast('Starthilfe nicht verfügbar'); return; }
      save();
      showWorkshops();
    };
    row.appendChild(button);
    body.appendChild(row);
  }
}

function syncProduction() {
  if (!updateProduction(state)) return;
  save();
  if (overlayView === 'workshops' || overlayView === 'inventory') {
    const box = $('overlay-box');
    const scroll = box.scrollTop;
    if (overlayView === 'workshops') showWorkshops();
    else showInventory();
    box.scrollTop = scroll;
  }
}

function syncBandits() {
  if (activeSince == null) return;
  const now = performance.now();
  const elapsed = Math.max(0, now - activeSince);
  activeSince = now;
  if (!elapsed) return;
  if (state.banditElapsed + elapsed >= BANDIT_INTERVAL) syncProduction();
  const captured = advanceBandits(state, elapsed);
  advanceShop(state, elapsed);
  updateShopView();
  save();
  if (!captured.length) return;
  if (selected && tileAt(state, selected.x, selected.y) !== selected) selected = null;
  refreshTargets();
  if (overlayView === 'workshops' || overlayView === 'archive') {
    const box = $('overlay-box');
    const scroll = box.scrollTop;
    if (overlayView === 'workshops') showWorkshops();
    else showArchive();
    box.scrollTop = scroll;
  }
  const losses = {};
  for (const result of captured) for (const [id, amount] of Object.entries(result.losses || {})) losses[id] = (losses[id] || 0) + amount;
  toast(`Banditen breiten sich auf ${captured.length} ${captured.length === 1 ? 'Feld' : 'Felder'} aus!${lossText(losses)}`);
}

let archiveFilter = 'all';

const CATALOG_CATEGORIES = [
  ['landschaft', '🌄 Landschaft'],
  ['industrie', '🏭 Industrie'],
  ['siedlung', '🏘️ Siedlung'],
  ['verteidigung', '🛡️ Verteidigung'],
  ['joker', '🃏 Joker'],
  ['gefahr', '⚠️ Gefahren'],
];
const landText = 'Hat derzeit keine Produktion und füllt Lücken im Reich.';
const CARD_DESCRIPTIONS = {
  gras: landText,
  erde: landText,
  wasser: landText,
  berge: landText,
  wald: 'Produziert allein nichts. Versorgt benachbarte Holzfäller, auch diagonal. Jede Seltenheitsstufe des Forsts über Common bringt dem Holzfäller +1 Holz pro 10 Sekunden.',
  feld: 'Produziert allein nichts. Versorgt benachbarte Windmühlen, auch diagonal. Jede Seltenheitsstufe des Feldes über Common bringt der Windmühle +1 Korn pro 10 Sekunden.',
  holzfaeller: `Braucht mindestens ${MIN_SUPPLIERS} benachbarte Forste (auch diagonal). Aktiv erzeugt er pro 10 Sekunden je Forst ${SUPPLIER_OUTPUT} Holz × eigene Seltenheitsstufe (Common 1 bis Epic 4). Mit weniger Forsten läuft er im Notbetrieb mit ${EMERGENCY_RATE * 100} % der Mindestleistung (Common: 1 Holz).`,
  windmuehle: `Braucht mindestens ${MIN_SUPPLIERS} benachbarte Felder (auch diagonal). Aktiv erzeugt sie pro 10 Sekunden je Feld ${SUPPLIER_OUTPUT} Korn × eigene Seltenheitsstufe (Common 1 bis Epic 4). Mit weniger Feldern läuft sie im Notbetrieb mit ${EMERGENCY_RATE * 100} % der Mindestleistung (Common: 1 Korn).`,
  haus: 'Erzeugt Gold mit benachbarten Gebäuden, auch diagonal: Haus + Haus 1 Gold, Haus + Taverne 2 Gold pro 10 Sekunden. Jedes Paar zählt einmal und wird mit der höheren Seltenheitsstufe der beiden multipliziert.',
  taverne: 'Erzeugt mit jedem benachbarten Haus 2 Gold pro 10 Sekunden, auch diagonal. Zwei Tavernen erzeugen zusammen nichts. Das Paar wird mit der höheren Seltenheitsstufe multipliziert.',
  rathaus: `Das Start-Gebäude. Erzeugt ohne Nachbarn automatisch ${TOWN_HALL_OUTPUT.gold} Gold 🪙 und ${TOWN_HALL_OUTPUT.werkzeug} Werkzeug 🔨 pro 10 Sekunden, damit du auch bei schlechten Kartenziehungen immer Grundressourcen hast. Kann nicht gelöscht werden; der Lösch-Joker verschont das letzte Rathaus.`,
  workshop: `Produziert Werkzeuge 🔨, mit denen Packs hergestellt werden. Braucht mindestens ${MIN_SUPPLIERS} benachbarte Werkzeugschmieden (auch diagonal). Aktiv erzeugt er pro 10 Sekunden je Schmiede ${SUPPLIER_OUTPUT} Werkzeuge × eigene Seltenheitsstufe (Common 1 bis Epic 4). Mit weniger Schmieden läuft er im Notbetrieb mit ${EMERGENCY_RATE * 100} % der Mindestleistung (Common: 1 Werkzeug).`,
  lagerhalle: `Erhöht das Holzlimit um ${STORAGE_BONUS} je Seltenheitsstufe (Common ${STORAGE_BONUS} bis Epic ${STORAGE_BONUS * 4}), unabhängig von der Position. Wird es zerstört, verfällt Holz über dem neuen Limit.`,
  kornlager: `Erhöht das Kornlimit um ${STORAGE_BONUS} je Seltenheitsstufe (Common ${STORAGE_BONUS} bis Epic ${STORAGE_BONUS * 4}), unabhängig von der Position. Wird es zerstört, verfällt Korn über dem neuen Limit.`,
  goldlager: `Erhöht das Goldlimit um ${STORAGE_BONUS} je Seltenheitsstufe (Common ${STORAGE_BONUS} bis Epic ${STORAGE_BONUS * 4}), unabhängig von der Position. Wird es zerstört, verfällt Gold über dem neuen Limit.`,
  werkzeugschmiede: 'Produziert allein nichts. Versorgt benachbarte Workshops, auch diagonal. Jede Seltenheitsstufe der Schmiede über Common bringt dem Workshop +1 Werkzeug pro 10 Sekunden.',
  wachturm: 'Schützt ein Quadrat um sich vor Banditen: Common 7×7, Uncommon 9×9, Rare 11×11, Epic 13×13 Felder. Vertreibt beim Erscheinen oder Verschieben alle Banditencamps in diesem Bereich.',
  joker_loeschen: 'Entfernt ein angetipptes Tile ohne Rückzahlung. Nicht möglich bei Banditencamps, dem letzten Tile oder dem letzten Workshop. Kann ans Deckende gelegt werden.',
  joker_verwandeln: 'Verwandelt ein angetipptes Tile zufällig in einen anderen Tile-Typ (nie in ein Banditencamp). Die Seltenheit bleibt erhalten. Gleiche Einschränkungen wie beim Lösch-Joker.',
  joker_schutz: 'Schützt ein freies oder belegtes Feld dauerhaft vor Banditen, auch wenn sich das Tile darauf später ändert. Nicht auf Banditencamps oder bereits dauerhaft geschützten Feldern.',
  joker_banditenzeit: `Wirkt sofort beim Ziehen: Setzt den Banditen-Countdown auf ${formatTime(BANDIT_INTERVAL)} zurück. Angekündigte Ziele bleiben erhalten.`,
  joker_shop: 'Wirkt sofort beim Ziehen: Erneuert die vier Shop-Angebote und setzt den Shop-Timer auf 5:00 zurück.',
  joker_freizug: 'Wirkt sofort beim Ziehen: Gibt 5 Freizüge. Jeder Zug – egal wie weit – oder jeder Tausch verbraucht dann einen Freizug statt Gold.',
  banditen_niete: 'Erscheint beim Ziehen sofort als Banditencamp auf einem zufälligen ungeschützten freien Feld, sonst auf einem ungeschützten Tile. Camps breiten sich alle 10 Minuten aus und lassen sich nicht mit Jokern entfernen – nur ein Wachturm vertreibt sie.',
};

function catalogCategory(id) {
  if (JOKERS[id]) return 'joker';
  if (HAZARDS[id]) return 'gefahr';
  return TILES[id].category;
}

function showCatalog() {
  const body = openOverlay('Karten-Browser', 'catalog');
  body.innerHTML = '<p class="catalog-intro">Alle Karten im Spiel. Tile-Karten erhalten beim Erhalt eine zufällige Seltenheit (Stärke 1–4); Joker und Nieten nicht. Beim Ziehen erscheint jedes Tile auf einem zufälligen freien Feld neben einem bestehenden Tile und lässt sich danach gegen Gold verschieben oder mit einem Nachbarn tauschen.</p>';
  const ids = Object.keys(CARDS).filter(id => id !== 'banditen');
  for (const [category, label] of CATALOG_CATEGORIES) {
    const cards = ids.filter(id => catalogCategory(id) === category);
    if (!cards.length) continue;
    const title = document.createElement('h3');
    title.className = 'section-title';
    title.textContent = label;
    body.appendChild(title);
    for (const id of cards) {
      const card = CARDS[id];
      const packs = Object.values(PACKS).filter(pack => pack.weights[id] || (LAND_TYPES.includes(id) && pack.land) || (id === 'banditen_niete' && pack.hazardChance)).map(pack => pack.name);
      const el = document.createElement('div');
      el.className = 'card catalog-card';
      el.innerHTML = `${cardArt(id)}<b class="card-name">${card.name}</b>` +
        `<span class="card-description">${CARD_DESCRIPTIONS[id]}</span>` +
        `<span class="card-meta">Vorkommen: ${packs.length ? packs.join(', ') : 'nur Start/Shop'}<br>Shop: ${Math.round(SHOP_PRICES[card.shopTier || card.rarity] * (1 - SHOP_DISCOUNT))} ${GOLD_ICON}</span>`;
      body.appendChild(el);
    }
  }
}

function jumpTo(tile) {
  cam.x = (tile.x + 0.5) * TILE; cam.y = (tile.y + 0.5) * TILE;
  selected = tile;
  closeOverlay();
  updatePanel();
}

function showArchive() {
  const body = openOverlay('Tile-Archiv', 'archive');
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
    row.innerHTML = `${chip(t.type)}<span>${t.x}, ${t.y}</span>`;
    row.onclick = () => jumpTo(t);
    body.appendChild(row);
  }
}

$('btn-archive').onclick = showArchive;
$('btn-catalog').onclick = showCatalog;
$('btn-cards').onclick = () => { syncProduction(); showInventory(); };
$('ready-packs').onclick = () => { syncBandits(); syncProduction(); showInventory(); };
$('btn-workshop').onclick = () => { syncBandits(); syncProduction(); showWorkshops(); };
$('btn-warehouse').onclick = () => { syncBandits(); syncProduction(); showWarehouse(); };
for (const button of document.querySelectorAll('[data-hud-resource]')) {
  button.onclick = () => { syncBandits(); syncProduction(); showWarehouse(button.dataset.hudResource); };
}
$('btn-shop').onclick = () => { syncBandits(); syncProduction(); showShop(); };
$('btn-grid').onclick = () => {
  showGrid = !showGrid;
  $('btn-grid').setAttribute('aria-pressed', String(showGrid));
};
$('btn-follow').setAttribute('aria-pressed', String(followNewTiles));
$('btn-follow').onclick = () => {
  followNewTiles = !followNewTiles;
  localStorage.setItem(FOLLOW_KEY, String(followNewTiles));
  $('btn-follow').setAttribute('aria-pressed', String(followNewTiles));
  toast(followNewTiles ? '🎯 Kamera springt zu neuen Tiles' : 'Kamera bleibt beim Erstellen stehen');
};
$('btn-shields').onclick = () => {
  showShields = !showShields;
  $('btn-shields').setAttribute('aria-pressed', String(showShields));
};
$('btn-delete-card').onclick = () => {
  const name = CARDS[state.deck[0]]?.name;
  const card = deleteNextCard(state);
  if (!card) { toast('Diese Karte kann nicht gelöscht werden'); return; }
  toast(`${name} gelöscht · +${DELETE_CARD_REWARD} ${GOLD_ICON}`);
  save();
};
$('btn-shuffle').onclick = () => {
  if (shuffleDeck(state)) { toast('Deck gemischt'); save(); } else toast(`Shuffle kostet ${SHUFFLE_COST} 🪙`);
};

// ---------- Zeichnen ----------
const TILE_GROUND = {
  gras: '#9caf73',
  erde: '#ba9b72',
  wasser: '#8eb8ad',
  berge: '#a5a9a0',
  feld: '#c9b57d',
  banditen: '#a7967c',
};
const DEFAULT_GROUND = '#a9bb85';

function drawTerrain(type, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.rect(2, 2, TILE - 4, TILE - 4);
  ctx.clip();
  ctx.lineCap = 'round';
  const offsetX = ((Math.round(x / TILE) * 13 + Math.round(y / TILE) * 7) % 28 + 28) % 28;
  const offsetY = ((Math.round(x / TILE) * 5 + Math.round(y / TILE) * 11) % 26 + 26) % 26;
  if (type === 'gras') {
    ctx.strokeStyle = '#698a50';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
      const px = col * 28 + offsetX + (row % 2 ? 9 : 0), py = row * 26 + offsetY;
      ctx.moveTo(px - 4, py - 4);
      ctx.lineTo(px, py);
      ctx.lineTo(px + 4, py - 6);
      ctx.moveTo(px, py);
      ctx.lineTo(px - 1, py - 8);
    }
    ctx.stroke();
  } else if (type === 'erde') {
    ctx.strokeStyle = '#927450';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
      const px = col * 28 + offsetX + (row % 2 ? 9 : 0), py = row * 26 + offsetY;
      ctx.moveTo(px - 5, py + 1);
      ctx.lineTo(px + 1, py - 1);
      ctx.moveTo(px + 7, py + 5);
      ctx.lineTo(px + 9, py + 5);
    }
    ctx.stroke();
  } else if (type === 'wasser') {
    ctx.strokeStyle = '#d1e4d7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
      const px = col * 28 + offsetX + (row % 2 ? 12 : 0), py = row * 26 + offsetY;
      ctx.moveTo(px - 8, py);
      ctx.quadraticCurveTo(px - 4, py - 4, px, py);
      ctx.quadraticCurveTo(px + 4, py + 4, px + 8, py);
    }
    ctx.stroke();
  } else if (type === 'berge') {
    ctx.fillStyle = '#747e7d';
    ctx.beginPath();
    ctx.moveTo(2, 70); ctx.lineTo(27, 24); ctx.lineTo(45, 50);
    ctx.lineTo(63, 12); ctx.lineTo(94, 70); ctx.lineTo(94, 94); ctx.lineTo(2, 94);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e2e5d9';
    ctx.beginPath();
    ctx.moveTo(19, 39); ctx.lineTo(27, 24); ctx.lineTo(36, 37); ctx.lineTo(30, 34); ctx.lineTo(26, 39);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(53, 33); ctx.lineTo(63, 12); ctx.lineTo(74, 33); ctx.lineTo(67, 29); ctx.lineTo(62, 34);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawTile(tile, x, y, alpha = 1) {
  const def = TILES[tile.type];
  ctx.save();
  ctx.globalAlpha = alpha;
  if (images[tile.type]) {
    ctx.drawImage(images[tile.type], x, y, TILE, TILE);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, TILE, TILE);
  } else {
    ctx.fillStyle = TILE_GROUND[tile.type] || DEFAULT_GROUND;
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    if (LAND_TYPES.includes(tile.type)) {
      drawTerrain(tile.type, x, y);
    } else if (tileArt[tile.type]) {
      ctx.drawImage(tileArt[tile.type], x + 7, y + 7, TILE - 14, TILE - 14);
    } else if (def.icon) {
      ctx.font = `${TILE * 0.5}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(def.icon, x + TILE / 2, y + TILE / 2);
    }
    ctx.strokeStyle = 'rgba(53,66,39,.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  }
  if (tile.type !== 'banditen') {
    ctx.beginPath();
    ctx.moveTo(x + TILE - 24, y + TILE - 4);
    ctx.lineTo(x + TILE - 4, y + TILE - 24);
    ctx.lineTo(x + TILE - 4, y + TILE - 4);
    ctx.closePath();
    ctx.fillStyle = RARITY[tileRarity(tile)].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(25,35,25,.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawShield(tile, permanent = false) {
  const x = tile.x * TILE + TILE - 32, y = tile.y * TILE + 4;
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + 27, y + 5);
  ctx.lineTo(x + 26, y + 17);
  ctx.quadraticCurveTo(x + 24, y + 24, x + 14, y + 30);
  ctx.quadraticCurveTo(x + 4, y + 24, x + 2, y + 17);
  ctx.lineTo(x + 1, y + 5);
  ctx.closePath();
  ctx.fillStyle = permanent ? '#b9790d' : '#20659d';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 7);
  ctx.lineTo(x + 14, y + 21);
  ctx.moveTo(x + 8, y + 14);
  ctx.lineTo(x + 20, y + 14);
  ctx.stroke();
}

function drawBanditArrow(tile) {
  const dx = tile.target.x - tile.x, dy = tile.target.y - tile.y;
  const length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
  const cx = (tile.x + 0.5) * TILE, cy = (tile.y + 0.5) * TILE;
  const x = cx + dx * TILE * 0.47, y = cy + dy * TILE * 0.47;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + dx * TILE * 0.19, cy + dy * TILE * 0.19);
  ctx.lineTo(x - ux * 7, y - uy * 7);
  ctx.strokeStyle = '#251013';
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = '#ffdf76';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - ux * 17 - uy * 8, y - uy * 17 + ux * 8);
  ctx.lineTo(x - ux * 17 + uy * 8, y - uy * 17 - ux * 8);
  ctx.closePath();
  ctx.fillStyle = '#ffdf76';
  ctx.fill();
  ctx.strokeStyle = '#251013';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBadge(cx, cy, text, color, scale = 1) {
  ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 14 * scale, h = 22 * scale;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, cx, cy + 1);
}

function drawMovePath(points, swap) {
  const centers = points.map(p => [(p.x + 0.5) * TILE, (p.y + 0.5) * TILE]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color] of [[12, 'rgba(20,30,25,.7)'], [6, '#ffe27a']]) {
    ctx.beginPath();
    ctx.moveTo(...centers[0]);
    for (const c of centers.slice(1)) ctx.lineTo(...c);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(width === 6 ? [14, 10] : []);
    ctx.lineDashOffset = -performance.now() / 40;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  const arrow = (from, to) => {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const tip = [to[0] - Math.cos(angle) * TILE * 0.18, to[1] - Math.sin(angle) * TILE * 0.18];
    ctx.beginPath();
    ctx.moveTo(...tip);
    ctx.lineTo(tip[0] - Math.cos(angle - 0.5) * 22, tip[1] - Math.sin(angle - 0.5) * 22);
    ctx.lineTo(tip[0] - Math.cos(angle + 0.5) * 22, tip[1] - Math.sin(angle + 0.5) * 22);
    ctx.closePath();
    ctx.fillStyle = '#ffe27a';
    ctx.strokeStyle = 'rgba(20,30,25,.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();
  };
  const segments = centers.filter((c, i) => i === 0 || c[0] !== centers[i - 1][0] || c[1] !== centers[i - 1][1]);
  if (segments.length > 1) arrow(segments[segments.length - 2], segments[segments.length - 1]);
  if (swap && segments.length > 1) arrow(segments[1], segments[0]);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawGrid(half) {
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

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (backgroundImage.complete && backgroundImage.naturalWidth) {
    const scale = Math.max(innerWidth / backgroundImage.naturalWidth, innerHeight / backgroundImage.naturalHeight);
    const width = backgroundImage.naturalWidth * scale;
    const height = backgroundImage.naturalHeight * scale;
    ctx.drawImage(backgroundImage, (innerWidth - width) / 2, (innerHeight - height) / 2, width, height);
    ctx.fillStyle = 'rgba(0, 20, 28, .12)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  } else {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const half = state.size / 2;
  ctx.fillStyle = 'rgba(37, 91, 47, .12)';
  ctx.fillRect(-half * TILE, -half * TILE, state.size * TILE, state.size * TILE);
  if (moveMode) drawGrid(half);

  const tiles = Object.values(state.tiles);
  const townHallCount = tiles.filter(t => t.type === 'rathaus').length;
  const animNow = performance.now();
  moveAnims = moveAnims.filter(a => animNow - a.start < a.duration);
  const animated = [];
  for (const t of tiles) {
    const pos = animatedPosition(t, animNow);
    if (pos) { animated.push([t, pos]); continue; }
    drawTile(t, t.x * TILE, t.y * TILE);
    const partners = displayPartners(t).length;
    const supply = SUPPLY_CHAINS[t.type] ? tileProduction(state, t).supply : null;
    if (partners || supply) {
      ctx.fillStyle = supply && !supply.active ? '#ff8a65' : '#ffd54f';
      ctx.font = `bold ${TILE * 0.22}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(supply && !supply.active ? `⚠${supply.count}/${supply.required}` : `×${partners}`, t.x * TILE + 6, t.y * TILE + 4);
    }
    if (JOKERS[state.hand] && t.type !== 'banditen' &&
        (state.hand === 'joker_schutz' ? !state.protectedFields[`${t.x},${t.y}`] :
          (state.hand !== 'joker_loeschen' || tiles.length > 1) && (t.type !== 'rathaus' || townHallCount > 1))) {
      ctx.strokeStyle = '#d39cff';
      ctx.lineWidth = 4;
      ctx.strokeRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
    }
  }

  for (const [t, pos] of animated) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 16;
    drawTile(t, pos.x * TILE, pos.y * TILE);
    ctx.restore();
  }

  if (state.hand === 'joker_schutz') {
    for (let x = -half; x < half; x++) for (let y = -half; y < half; y++) {
      if (tileAt(state, x, y) || state.protectedFields[`${x},${y}`]) continue;
      ctx.fillStyle = 'rgba(177,115,230,.22)';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = 'rgba(211,156,255,.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
    }
  }

  const visibleGuards = moveMode ?
    Object.values(previewSimulation()?.sim.tiles || state.tiles).filter(t => t.type === 'wachturm') :
    selected?.type === 'wachturm' && !state.hand ? [selected] : [];
  for (const guard of visibleGuards) {
    const radius = guardRadius(guard);
    const minX = Math.max(-half, guard.x - radius);
    const minY = Math.max(-half, guard.y - radius);
    const maxX = Math.min(half - 1, guard.x + radius);
    const maxY = Math.min(half - 1, guard.y + radius);
    ctx.fillStyle = 'rgba(80, 175, 255, .18)';
    ctx.fillRect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
    ctx.strokeStyle = '#63c7ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
  }

  if (moveMode) {
    for (const slot of Object.keys(state.specialSlots || {})) {
      const [sx, sy] = slot.split(',').map(Number);
      if (tileAt(state, sx, sy) || moveMode.moves.some(t => t.x === sx && t.y === sy)) continue;
      ctx.strokeStyle = 'rgba(255,214,90,.75)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(sx * TILE + 6, sy * TILE + 6, TILE - 12, TILE - 12);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,214,90,.85)';
      ctx.font = `bold ${TILE * 0.3}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', sx * TILE + TILE / 2, sy * TILE + TILE / 2);
    }

    const free = (state.freeMoves || 0) > 0;
    for (const g of moveMode.moves) {
      const x = g.x * TILE, y = g.y * TILE;
      const afford = free || state.gold >= g.cost;
      const chosen = movePreview === g;
      ctx.fillStyle = !afford ? 'rgba(70,70,70,.5)' : g.special ? 'rgba(255,205,70,.8)' : 'rgba(120,205,255,.34)';
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = !afford ? 'rgba(190,190,190,.45)' : g.special ? '#fff3c4' : 'rgba(225,245,255,.8)';
      ctx.lineWidth = chosen ? 5 : 2;
      ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
      if (g.special) {
        ctx.fillStyle = afford ? '#5a3d05' : 'rgba(255,255,255,.6)';
        ctx.font = `bold ${TILE * 0.3}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', x + TILE / 2, y + TILE * 0.3);
      }
      if (!chosen) drawBadge(x + TILE / 2, y + TILE * (g.special ? 0.68 : 0.5), free ? 'Frei' : `${g.cost}🪙`, afford ? '#173a4d' : '#555');
    }
    for (const swap of moveMode.swaps) {
      const afford = free || state.gold >= swap.cost;
      ctx.strokeStyle = afford ? '#c79bff' : 'rgba(190,190,190,.5)';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(swap.x * TILE + 4, swap.y * TILE + 4, TILE - 8, TILE - 8);
      ctx.setLineDash([]);
      if (movePreview !== swap) drawBadge(swap.x * TILE + TILE / 2, swap.y * TILE + TILE * 0.78, free ? '🔁 Frei' : `🔁 ${swap.cost}🪙`, afford ? '#4b2a6b' : '#555');
    }

    const tile = moveMode.tile;
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);
    ctx.strokeStyle = `rgba(255,235,59,${pulse})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(tile.x * TILE + 3, tile.y * TILE + 3, TILE - 6, TILE - 6);

    const simulation = previewSimulation();
    if (simulation) {
      const points = movePreview.kind === 'swap' ? [tile, movePreview] : movePreview.path || movePath(tile, movePreview);
      drawMovePath(points, movePreview.kind === 'swap');
      if (movePreview.kind === 'move') {
        ctx.fillStyle = 'rgba(20,30,25,.45)';
        ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
        const x = movePreview.x * TILE, y = movePreview.y * TILE;
        drawTile(simulation.copies.get(tile), x, y, 0.88);
        ctx.strokeStyle = '#fff6b0';
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
      }
      const cx = (movePreview.x + 0.5) * TILE, cy = (movePreview.y + 0.5) * TILE;
      drawBadge(cx, movePreview.y * TILE - 2, free ? '🧭 Frei' : `${movePreview.cost}🪙`, canPayMove(state, movePreview.cost) ? '#7a5200' : '#8a2020', 1.25);
      for (const buff of previewBuffs()) {
        const bx = buff.tile.x * TILE, by = buff.tile.y * TILE;
        ctx.fillStyle = buff.gain ? 'rgba(71,210,105,.22)' : 'rgba(230,70,60,.25)';
        ctx.fillRect(bx + 2, by + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = buff.gain ? '#6cff91' : '#ff6b5e';
        ctx.lineWidth = 4;
        ctx.strokeRect(bx + 6, by + 6, TILE - 12, TILE - 12);
        ctx.beginPath();
        ctx.arc(bx + 18, by + 18, 11, 0, Math.PI * 2);
        ctx.fillStyle = buff.gain ? '#1c5635' : '#6b1d17';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(buff.gain ? '↑' : '↓', bx + 18, by + 18);
      }
    }
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
    ctx.fillText(`+${f.value}/10s`, (f.x + 0.5) * TILE, (f.y + 0.5) * TILE - p * TILE * 0.4);
  }

  if (selected && !state.hand) {
    for (const b of displayPartners(selected)) {
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

  if (showShields) {
    const guards = tiles.filter(tile => tile.type === 'wachturm');
    for (const tile of tiles) if (!state.protectedFields[`${tile.x},${tile.y}`] && isProtected(state, tile.x, tile.y, guards)) drawShield(tile);
  }
  for (const tile of tiles) if (tile.type === 'banditen' && tile.target) drawBanditArrow(tile);
  if ((selected || activeFilter) && !state.hand) {
    const related = selected ? new Set([selected, ...displayPartners(selected)]) : new Set();
    const matches = activeFilter ? tiles.filter(tile => matchesTileFilter(tile, activeFilter)) : [];
    for (const tile of matches) related.add(tile);
    const target = selected?.type === 'banditen' ? selected.target : null;
    ctx.fillStyle = 'rgba(85,85,85,.82)';
    for (const tile of tiles) {
      if (!related.has(tile) && !(target && tile.x === target.x && tile.y === target.y)) {
        ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
      }
    }
    if (activeFilter) {
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 4;
      for (const tile of matches) ctx.strokeRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
    }
    if (target) {
      ctx.fillStyle = 'rgba(255,35,35,.48)';
      ctx.fillRect(target.x * TILE, target.y * TILE, TILE, TILE);
      ctx.strokeStyle = '#ff3838';
      ctx.lineWidth = 5;
      ctx.strokeRect(target.x * TILE + 2, target.y * TILE + 2, TILE - 4, TILE - 4);
    }
  }
  for (const field of Object.keys(state.protectedFields)) {
    const [x, y] = field.split(',').map(Number);
    drawShield({ x, y }, true);
  }
  if (showGrid && !moveMode) drawGrid(half);
}

function frame() {
  draw();
  updateHud();
  updateUndo();
  updateCraftingPanel();
  requestAnimationFrame(frame);
}

refreshTargets();
frame();
setInterval(() => {
  syncBandits();
  syncProduction();
  updateWarehouse();
  updateShopView();
  for (const indicator of document.querySelectorAll('.job-status')) updateJobIndicator(indicator);
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    syncBandits();
    activeSince = null;
  } else {
    activeSince = performance.now();
    syncProduction();
  }
});
window.addEventListener('pagehide', () => { syncBandits(); activeSince = null; });
window.addEventListener('pageshow', () => {
  if (document.visibilityState === 'visible' && activeSince == null) activeSince = performance.now();
});

$('btn-full').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => toast('Vollbild nicht verfügbar'));
};
