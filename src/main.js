import { TILES, JOKERS, HAZARDS, CARDS, RARITY, PACKS, GOLD_ICON, SHUFFLE_COST, START_SIZE, EXPANDED_SIZE, EXPANSION_COST, PACK_MIN_SPECIAL, RESOURCE_CAP, PRODUCTION_INTERVAL, BANDIT_INTERVAL, GUARD_RADIUS, SHOP_PRICES, SHOP_DISCOUNT } from './config.js?v=14';
import { newState, migrateState, tileAt, drawCard, placeHand, placeCells, useJoker, expandWorld, openPack, packChances, cardCount, shuffleDeck, partnersOf, tileProduction, productionRates, updateProduction, warehouseCount, workshopDuration, canStartPack, startPack, canStartRecovery, startRecovery, spawnBandit, advanceBandits, isProtected, shopStatus, advanceShop, buyShopCard } from './logic.js?v=18';

const SAVE_KEY = 'fliesenreich-save-v8';
const TILE = 96;
const BG = '#1e5aa8';
const BOARD_COLOR = '#355b38';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const loadedState = load();
let state = loadedState || newState();
if (loadedState && migrateState(state)) save();
if (updateProduction(state)) save();
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
let activeSince = document.visibilityState === 'visible' ? performance.now() : null;
let showShields = false;
let showGrid = false;

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
  else if (e.key.toLowerCase() === 'd') { syncProduction(); showInventory(); }
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
  syncBandits();
  syncProduction();
  const c = toCell(sx, sy);
  if (JOKERS[state.hand]) {
    const result = useJoker(state, c.x, c.y);
    if (!result) {
      const tile = tileAt(state, c.x, c.y);
      toast(tile?.type === 'banditen' ? 'Banditencamps sind gegen Joker geschützt' :
        state.hand === 'joker_schutz' ? (state.protectedFields[`${c.x},${c.y}`] ? 'Dieses Feld ist bereits dauerhaft geschützt' : 'Wähle ein Feld innerhalb des Spielfelds') :
        tile?.type === 'workshop' ? 'Letzter oder beschäftigter Workshop ist geschützt' :
        Object.keys(state.tiles).length <= 1 && state.hand === 'joker_loeschen'
          ? 'Das letzte Tile kann nicht gelöscht werden' : 'Wähle ein vorhandenes Tile');
      return;
    }
    selected = result.kind === 'transformed' || result.kind === 'protected' ? result.tile || null : null;
    if (result.kind === 'transformed') {
      toast(`${TILES[result.oldType].name} → ${TILES[result.tile.type].name}${result.cleared ? ` · ${result.cleared} Camps vertrieben` : ''}`);
      flashPairs(result.pairs);
    } else if (result.kind === 'protected') toast(`Feld (${result.x}, ${result.y}) dauerhaft vor Banditen geschützt`);
    else toast(`${TILES[result.tile.type].name} gelöscht`);
    refreshTargets();
    save();
    return;
  }
  if (state.hand) {
    const target = targets.find(t => t.x === c.x && t.y === c.y);
    if (target) {
      const res = placeHand(state, target.x, target.y);
      if (!res) { toast('Dieses Feld ist nicht frei'); return; }
      if (res.cleared) toast(`${res.cleared} Banditencamps vertrieben`);
      flashPairs(res.pairs);
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

function displayPartners(tile) {
  const otherType = tile.type === 'workshop' ? 'lagerhalle' : tile.type === 'lagerhalle' ? 'workshop' : null;
  if (!otherType) return partnersOf(state, tile);
  const neighbors = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const neighbor = tileAt(state, tile.x + dx, tile.y + dy);
    if (neighbor?.type === otherType) neighbors.push(neighbor);
  }
  return neighbors;
}

function updatePanel() {
  const panel = $('panel');
  const hand = state.hand && CARDS[state.hand];
  if (hand) {
    panel.classList.remove('hidden');
    const blockedDelete = state.hand === 'joker_loeschen' && Object.keys(state.tiles).length <= 1;
    $('btn-return-card').hidden = !JOKERS[state.hand];
    const message = blockedDelete ? 'Das letzte Tile kann nicht gelöscht werden.' :
      state.hand === 'joker_loeschen' ? 'Tile antippen, um es zu löschen' :
      state.hand === 'joker_verwandeln' ? 'Tile antippen, um es zufällig zu verwandeln' :
      state.hand === 'joker_schutz' ? 'Freies oder belegtes Feld antippen, um es dauerhaft vor Banditen zu schützen' :
      targets.length ? 'Grünes Feld antippen zum Platzieren' :
      state.size === START_SIZE ? 'Spielfeld voll – im Shop erweitern' : 'Spielfeld voll';
    const guardHint = TILES[state.hand] && Object.values(state.tiles).some(t => t.type === 'wachturm') ? ' · Blau: Wachturm-Schutz' : '';
    $('panel-info').innerHTML = `<b>${hand.icon} ${hand.name}</b><br>${message}${guardHint}`;
  } else {
    panel.classList.add('hidden');
  }
  updateTilePopup();
}

function updateTilePopup() {
  const el = $('tile-popup');
  if (!selected || state.hand) { el.classList.add('hidden'); return; }
  const def = TILES[selected.type];
  const partners = displayPartners(selected);
  let html = `<div class="head"><b>${def.icon} ${def.name}</b><button id="tile-close">✕</button></div>`;
  html += `<div class="dim">${RARITY[def.rarity].name} · Position ${selected.x}, ${selected.y}</div>`;
  if (state.protectedFields[`${selected.x},${selected.y}`]) html += '<div>🛡️ Dieses Feld ist dauerhaft vor Banditen geschützt.</div>';
  const descriptions = {
    wald: 'Produziert 1 Holz pro 10 Sekunden.',
    holzfaeller: 'Produziert 1 Holz; +1 pro benachbartem Wald.',
    feld: 'Produziert 1 Korn pro 10 Sekunden.',
    windmuehle: 'Produziert 1 Korn; +1 pro benachbartem Feld.',
    haus: 'Erzeugt Gold durch benachbarte Häuser und Tavernen.',
    taverne: 'Ein benachbartes Haus gibt 2 Gold pro 10 Sekunden.',
    workshop: 'Produziert Packs. Benachbarte Lagerhallen beschleunigen die Herstellung.',
    lagerhalle: 'Beschleunigt benachbarte Workshops um 20 %, bis zu 60 %.',
    wachturm: `Schützt einen Bereich von ${GUARD_RADIUS * 2 + 1}×${GUARD_RADIUS * 2 + 1} Feldern und entfernt dort Banditencamps.`,
    banditen: 'Breitet sich bei jedem Banditen-Timer auf ein ungeschütztes Nachbarfeld aus. Joker wirken nicht.',
  };
  html += `<div>${descriptions[selected.type] || 'Keine Produktion.'}</div>`;
  const { base, bonus } = tileProduction(state, selected);
  const resourceNames = { holz: '🪵 Holz', korn: '🌾 Korn', gold: '🪙 Gold' };
  for (const id of ['holz', 'korn', 'gold']) {
    if (!base[id] && !bonus[id]) continue;
    html += `<div>Aktueller Ertrag: <b>${base[id] + bonus[id]} ${resourceNames[id]} / 10 Sek.</b><br><span class="dim">${base[id]} Basis + ${bonus[id]} Nachbarschaftsbonus</span></div>`;
  }
  if (selected.type === 'haus' || selected.type === 'taverne') {
    if (!bonus.gold) html += '<div>Aktueller Ertrag: <b>0 Gold / 10 Sek.</b></div>';
    html += '<div class="dim">Gold zählt gemeinsam pro Paar, nicht doppelt pro Gebäude.</div>';
  }
  if (selected.type === 'workshop') {
    const count = warehouseCount(state, selected);
    html += `<div>📦 Lagerhallen: ${count} · Herstellungszeit −${Math.min(60, count * 20)} %</div>`;
    for (const [id, pack] of Object.entries(PACKS)) {
      html += `<div>${pack.name}: <b>1 Pack / ${formatTime(workshopDuration(state, selected, id))}</b></div>`;
    }
  } else if (selected.type === 'lagerhalle') {
    html += `<div>Beschleunigte Workshops: ${partners.length}</div>`;
  } else if (selected.type === 'banditen') {
    const target = selected.target && tileAt(state, selected.target.x, selected.target.y);
    html += selected.target ? `<div>Nächstes Ziel: <b>${target ? TILES[target.type].name : 'Freies Feld'} (${selected.target.x}, ${selected.target.y})</b></div>` :
      '<div>Kein ungeschütztes Ziel in Reichweite.</div>';
  }
  if (def.gives) {
    html += `<div>Bonus je Nachbar: <b>${givesText(def)}</b> pro 10 Sek.</div>`;
  }
  html += `<div>Aktive Paare: <b>${partners.length}</b> <span class="dim">(orange markiert)</span></div>`;
  el.innerHTML = html;
  el.style.top = `${$('hud').getBoundingClientRect().bottom + 8}px`;
  el.style.maxHeight = `calc(100vh - ${$('hud').getBoundingClientRect().bottom + 16}px)`;
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
  $('r-holz').textContent = `${state.resources.holz}/${RESOURCE_CAP}`;
  $('r-korn').textContent = `${state.resources.korn}/${RESOURCE_CAP}`;
  $('r-banditen').textContent = formatTime(BANDIT_INTERVAL - state.banditElapsed);
  $('btn-next').disabled = !!state.hand || cardCount(state) < 1;
  $('btn-next').textContent = `Next (${cardCount(state)})`;
  const readyPacks = Object.values(state.packs).reduce((sum, count) => sum + count, 0);
  $('btn-cards').textContent = readyPacks ? `Inventar 📦${readyPacks}` : 'Inventar';
  $('btn-shuffle').textContent = `🔀 ${SHUFFLE_COST}🪙`;
  $('btn-shuffle').disabled = state.gold < SHUFFLE_COST || state.deck.length < 2;
  const sale = shopStatus(state);
  $('btn-shop').textContent = sale.open ? `Shop SALE ${formatTime(sale.remaining)}` : `Shop ${formatTime(sale.remaining)}`;
  const idleWorkshops = Object.values(state.tiles).filter(tile => tile.type === 'workshop' && !tile.job).length;
  $('idle-workshop').hidden = !idleWorkshops;
  $('idle-workshop-count').textContent = idleWorkshops;
  $('idle-workshop').setAttribute('aria-label', `${idleWorkshops} untätige Workshops anzeigen`);
  $('panel').classList.toggle('has-idle-workshop', idleWorkshops > 0);
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
  syncBandits();
  syncProduction();
  const card = drawCard(state);
  if (!card) { toast(state.hand ? 'Erst die Karte einsetzen' : 'Keine Karten – stelle ein Pack her'); return; }
  if (HAZARDS[card]) {
    const result = spawnBandit(state);
    if (result) {
      selected = result.tile;
      cam.x = (selected.x + 0.5) * TILE;
      cam.y = (selected.y + 0.5) * TILE;
      toast(result.previous ? `Banditen übernehmen ${TILES[result.previous.type].name}!` : 'Ein Banditencamp ist erschienen!');
    } else {
      state.deck.push(state.hand);
      state.hand = null;
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
};

$('btn-return-card').onclick = () => {
  if (!JOKERS[state.hand]) return;
  state.deck.push(state.hand);
  state.hand = null;
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
function closeOverlay() { overlayView = ''; $('overlay').classList.add('hidden'); }
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
];
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
  for (const resource of WAREHOUSE_RESOURCES) {
    const stock = resource.id === 'gold' ? state.gold : state.resources[resource.id];
    const button = document.querySelector(`[data-resource="${resource.id}"]`);
    button.textContent = `${resource.icon} ${resource.name} · Bestand: ${fmt(stock)}${resource.id === 'gold' ? '' : ` / ${RESOURCE_CAP}`}`;
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
  if (id !== 'gold') {
    const stored = Math.min(rate, Math.max(0, RESOURCE_CAP - state.resources[id]));
    detail.innerHTML += `<div class="pack-chances">Bei aktuellem Lagerstand passen beim nächsten Tick ${fmt(stored)} ${name} ins Lager. Lagerlimit: ${RESOURCE_CAP}; Überschuss verfällt.</div>`;
  }
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
  if (!state.deck.length) {
    const empty = document.createElement('div');
    empty.textContent = 'Keine Karten im Deck.';
    body.appendChild(empty);
  }
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
      row.innerHTML = `<span><b>${card.icon} ${card.name}</b> · <s>${SHOP_PRICES[card.rarity]} ${GOLD_ICON}</s> → ${offer.price} ${GOLD_ICON}${HAZARDS[offer.card] ? '<br>Vorsicht: Diese Niete lässt Banditen erscheinen!' : ''}</span>`;
      const button = document.createElement('button');
      button.dataset.shopCard = offer.card;
      button.onclick = () => {
        syncBandits();
        syncProduction();
        if (!buyShopCard(state, offer.card, round)) { toast('Kauf nicht möglich: Sale beendet, ausverkauft oder zu wenig Gold'); updateShopView(); return; }
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
  $('shop-sale-status').textContent = sale.open
    ? `SALE: ${SHOP_DISCOUNT * 100} % Rabatt · noch ${formatTime(sale.remaining)}. Jede Karte einmal verfügbar.`
    : `Karten-Shop geschlossen · nächster Sale in ${formatTime(sale.remaining)} aktiver Spielzeit. Alle 5 Minuten, eine Minute lang, vier zufällige Karten inklusive Joker und Nieten.`;
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

let expandedWorkshopId = null;
function showWorkshops() {
  const body = openOverlay('Workshops', 'workshops');
  body.innerHTML = '';
  const rates = productionRates(state);
  const summary = document.createElement('div');
  summary.className = 'pack-chances';
  summary.textContent = `Produktion alle ${PRODUCTION_INTERVAL / 1000} Sek.: 🪵 ${rates.holz} · 🌾 ${rates.korn} · 🪙 ${rates.gold}. Holz und Korn: max. ${RESOURCE_CAP}.`;
  body.appendChild(summary);
  const workshops = Object.values(state.tiles).filter(tile => tile.type === 'workshop');
  if (!workshops.some(tile => tile.id === expandedWorkshopId)) expandedWorkshopId = null;
  if (!workshops.length) {
    const notice = document.createElement('p');
    notice.textContent = 'Kein Workshop platziert. Ohne Workshop-Karte oder fertiges Pack ist ein neues Spiel nötig.';
    body.appendChild(notice);
  }
  for (const tile of workshops) {
    const section = document.createElement('div');
    section.className = 'workshop';
    section.dataset.workshopId = tile.id;
    const head = document.createElement('div');
    head.className = 'workshop-head';
    const expanded = tile.id === expandedWorkshopId;
    const title = document.createElement('button');
    title.className = 'workshop-toggle';
    title.textContent = `🛠️ Workshop (${tile.x}, ${tile.y}) · ${tile.job ? 'Produziert' : 'Bereit'} ${expanded ? '▴' : '▾'}`;
    title.setAttribute('aria-expanded', String(expanded));
    title.onclick = () => {
      expandedWorkshopId = expanded ? null : tile.id;
      const scroll = $('overlay-box').scrollTop;
      showWorkshops();
      $('overlay-box').scrollTop = scroll;
    };
    const jump = document.createElement('button');
    jump.textContent = 'Anzeigen';
    jump.onclick = () => jumpTo(tile);
    head.append(title, jump);
    section.appendChild(head);
    if (expanded) {
      const warehouses = warehouseCount(state, tile);
      const bonus = document.createElement('div');
      bonus.className = 'pack-chances';
      bonus.textContent = `📦 ${warehouses} Lagerhallen · Herstellungszeit −${Math.min(60, warehouses * 20)} %`;
      section.appendChild(bonus);
    }
    if (tile.job) {
      const status = document.createElement('div');
      const name = tile.job.pack === 'starthilfe' ? 'Starthilfe-Pack' : PACKS[tile.job.pack].name;
      status.className = 'job-status';
      status.dataset.endsAt = tile.job.endsAt;
      if (tile.job.duration != null) status.dataset.duration = tile.job.duration;
      const heading = document.createElement('div');
      heading.className = 'job-heading';
      const packName = document.createElement('b');
      packName.textContent = name;
      const timer = document.createElement('strong');
      timer.className = 'job-timer';
      heading.append(packName, timer);
      const progress = document.createElement('progress');
      progress.max = 1;
      progress.setAttribute('aria-label', `Fortschritt ${name} bei Workshop ${tile.x}, ${tile.y}`);
      status.append(heading, progress);
      updateJobIndicator(status);
      section.appendChild(status);
      if (tile.job.duration == null) {
        const notice = document.createElement('div');
        notice.className = 'pack-chances';
        notice.textContent = 'Bei diesem älteren Auftrag ist der Fortschritt nicht verfügbar; die Restzeit bleibt erhalten.';
        section.appendChild(notice);
      }
    } else if (expanded) {
      for (const [id, pack] of Object.entries(PACKS)) {
        const row = document.createElement('div');
        row.className = 'pack pack-recipe';
        const head = document.createElement('div');
        head.className = 'pack-recipe-head';
        const info = document.createElement('div');
        info.innerHTML = `<b>${pack.name}</b> · 🪵 ${pack.cost.holz} · 🌾 ${pack.cost.korn} · ${formatTime(workshopDuration(state, tile, id))}<div class="pack-chances">${pack.cards} Karten, mindestens ${PACK_MIN_SPECIAL} außer Gras, Erde, Wasser und Banditen-Niete. Chance je zufälliger Karte:</div>`;
        const button = document.createElement('button');
        button.textContent = 'Herstellen';
        button.disabled = !canStartPack(state, tile, id);
        button.onclick = () => {
          syncBandits();
          syncProduction();
          if (!startPack(state, tile, id)) { toast('Herstellung nicht möglich'); return; }
          save();
          showWorkshops();
        };
        head.append(info, button);
        row.appendChild(head);
        const contents = document.createElement('div');
        contents.className = 'pack-contents';
        for (const [type, chance] of packChances(pack)) {
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
          name.textContent = card.name;
          const value = document.createElement('span');
          value.className = 'pack-item-chance';
          value.textContent = percent;
          item.append(icon, name, value);
          contents.appendChild(item);
        }
        row.appendChild(contents);
        section.appendChild(row);
      }
      if (canStartRecovery(state, tile)) {
        const row = document.createElement('div');
        row.className = 'pack';
        row.textContent = `Starthilfe-Pack: kostenlos, mit Wald und Feld · ${formatTime(workshopDuration(state, tile, 'starthilfe'))}`;
        const button = document.createElement('button');
        button.textContent = 'Herstellen';
        button.onclick = () => {
          syncBandits();
          syncProduction();
          if (!startRecovery(state, tile)) { toast('Starthilfe nicht verfügbar'); return; }
          save();
          showWorkshops();
        };
        row.appendChild(button);
        section.appendChild(row);
      }
    }
    body.appendChild(section);
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
  toast(`Banditen breiten sich auf ${captured.length} ${captured.length === 1 ? 'Feld' : 'Felder'} aus!`);
}

let archiveFilter = 'all';

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
$('btn-cards').onclick = () => { syncProduction(); showInventory(); };
$('btn-workshop').onclick = () => { syncBandits(); syncProduction(); expandedWorkshopId = null; showWorkshops(); };
$('idle-workshop').onclick = () => {
  syncBandits();
  syncProduction();
  const tile = Object.values(state.tiles).find(tile => tile.type === 'workshop' && !tile.job);
  if (!tile) { toast('Kein untätiger Workshop vorhanden'); return; }
  expandedWorkshopId = tile.id;
  showWorkshops();
  document.querySelector(`[data-workshop-id="${tile.id}"]`).scrollIntoView({ block: 'nearest' });
};
$('btn-warehouse').onclick = () => { syncBandits(); syncProduction(); showWarehouse(); };
for (const button of document.querySelectorAll('[data-hud-resource]')) {
  button.onclick = () => { syncBandits(); syncProduction(); showWarehouse(button.dataset.hudResource); };
}
$('btn-shop').onclick = () => { syncBandits(); syncProduction(); showShop(); };
$('btn-grid').onclick = () => {
  showGrid = !showGrid;
  $('btn-grid').setAttribute('aria-pressed', String(showGrid));
};
$('btn-shields').onclick = () => {
  showShields = !showShields;
  $('btn-shields').setAttribute('aria-pressed', String(showShields));
};
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
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const half = state.size / 2;
  ctx.fillStyle = BOARD_COLOR;
  ctx.fillRect(-half * TILE, -half * TILE, state.size * TILE, state.size * TILE);
  if (TILES[state.hand]) {
    drawGrid(half);
  }

  const tiles = Object.values(state.tiles);
  const workshopCount = tiles.filter(t => t.type === 'workshop').length;
  for (const t of tiles) {
    drawTile(t, t.x * TILE, t.y * TILE);
    const partners = displayPartners(t).length;
    if (partners) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold ${TILE * 0.22}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`×${partners}`, t.x * TILE + 6, t.y * TILE + 4);
    }
    if (JOKERS[state.hand] && t.type !== 'banditen' &&
        (state.hand === 'joker_schutz' ? !state.protectedFields[`${t.x},${t.y}`] :
          (state.hand !== 'joker_loeschen' || tiles.length > 1) && (t.type !== 'workshop' || (!t.job && workshopCount > 1)))) {
      ctx.strokeStyle = '#d39cff';
      ctx.lineWidth = 4;
      ctx.strokeRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
    }
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

  const visibleGuards = TILES[state.hand] ? tiles.filter(t => t.type === 'wachturm') :
    selected?.type === 'wachturm' && !state.hand ? [selected] : [];
  for (const guard of visibleGuards) {
    const minX = Math.max(-half, guard.x - GUARD_RADIUS);
    const minY = Math.max(-half, guard.y - GUARD_RADIUS);
    const maxX = Math.min(half - 1, guard.x + GUARD_RADIUS);
    const maxY = Math.min(half - 1, guard.y + GUARD_RADIUS);
    ctx.fillStyle = 'rgba(80, 175, 255, .18)';
    ctx.fillRect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
    ctx.strokeStyle = '#63c7ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
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
  if (selected && !state.hand) {
    const related = new Set([selected, ...displayPartners(selected)]);
    const target = selected.type === 'banditen' ? selected.target : null;
    ctx.fillStyle = 'rgba(85,85,85,.82)';
    for (const tile of tiles) {
      if (!related.has(tile) && !(target && tile.x === target.x && tile.y === target.y)) {
        ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
      }
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
  if (showGrid && !TILES[state.hand]) drawGrid(half);
}

function frame() {
  draw();
  updateHud();
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
