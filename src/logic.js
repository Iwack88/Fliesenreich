import { TILES, JOKERS, CARDS, START_GOLD, START_TILE, START_DECK, START_RESOURCES, RESOURCE_CAP, PRODUCTION_INTERVAL, PACKS, PACK_FILLER_TYPES, PACK_MIN_SPECIAL, SHUFFLE_COST, START_SIZE, EXPANDED_SIZE, START_OBSTACLES, EXPANSION_OBSTACLES, EXPANSION_COST, OBSTACLE_TYPES } from './config.js?v=10';

const key = (x, y) => `${x},${y}`;
export const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newState() {
  const s = { gold: START_GOLD, resources: { ...START_RESOURCES }, productionAt: Date.now(), packs: {}, size: START_SIZE, nextId: 1, tiles: {}, hand: null, deck: shuffled(Object.entries(START_DECK).flatMap(([id, n]) => Array(n).fill(id))) };
  addTile(s, START_TILE, 0, 0);
  addObstacles(s, 0, START_OBSTACLES);
  return s;
}

export function migrateState(s, now = Date.now()) {
  if (s.resources) return false;
  s.resources = { ...START_RESOURCES };
  s.productionAt = now;
  s.packs = {};
  if (!Object.values(s.tiles).some(tile => tile.type === 'workshop') && s.hand !== 'workshop' && !s.deck.includes('workshop')) {
    s.deck.unshift('workshop');
  }
  return true;
}

export function addTile(s, type, x, y) {
  const t = { id: s.nextId++, type, x, y, earned: 0 };
  s.tiles[key(x, y)] = t;
  return t;
}

export const tileAt = (s, x, y) => s.tiles[key(x, y)];

export function inBounds(size, x, y) {
  const half = size / 2;
  return x >= -half && x < half && y >= -half && y < half;
}

function connected(cells) {
  if (!cells.size) return true;
  const seen = new Set();
  const queue = [cells.values().next().value];
  seen.add(key(...queue[0]));
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of DIRS4) {
      const k = key(x + dx, y + dy);
      if (cells.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(cells.get(k));
      }
    }
  }
  return seen.size === cells.size;
}

function addObstacles(s, oldSize, count) {
  const cells = new Map();
  for (let x = -s.size / 2; x < s.size / 2; x++) {
    for (let y = -s.size / 2; y < s.size / 2; y++) {
      if ((!oldSize || !inBounds(oldSize, x, y)) && !tileAt(s, x, y)) cells.set(key(x, y), [x, y]);
    }
  }
  for (const [x, y] of shuffled([...cells.values()])) {
    if (!count) break;
    if (!oldSize && Math.abs(x) + Math.abs(y) <= 1) continue;
    cells.delete(key(x, y));
    if (!connected(cells)) {
      cells.set(key(x, y), [x, y]);
      continue;
    }
    addTile(s, OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)], x, y);
    count--;
  }
  if (count) throw new Error('Nicht genügend freie Felder für die Weltgenerierung');
}

export function expandWorld(s) {
  if (s.size !== START_SIZE || s.gold < EXPANSION_COST) return false;
  s.size = EXPANDED_SIZE;
  addObstacles(s, START_SIZE, EXPANSION_OBSTACLES);
  s.gold -= EXPANSION_COST;
  return true;
}

export function placeCells(s) {
  const cells = new Map();
  for (const t of Object.values(s.tiles)) {
    for (const [dx, dy] of DIRS4) {
      const x = t.x + dx, y = t.y + dy;
      if (inBounds(s.size, x, y) && !s.tiles[key(x, y)]) cells.set(key(x, y), [x, y]);
    }
  }
  return [...cells.values()];
}

function pickWeighted(entries) {
  let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of entries) { if (r < w) return id; r -= w; }
  return entries[entries.length - 1][0];
}

export function packChances(pack) {
  const entries = Object.entries(pack.weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const specialTotal = entries.filter(([id]) => !PACK_FILLER_TYPES.includes(id)).reduce((sum, [, weight]) => sum + weight, 0);
  if (!total || !specialTotal || pack.cards < PACK_MIN_SPECIAL || entries.some(([id, weight]) => !CARDS[id] || !Number.isFinite(weight) || weight <= 0)) {
    throw new Error(`Ungültige Kartengewichte für ${pack.name}`);
  }
  return entries.map(([id, weight]) => [id, 100 * (
    (pack.cards - PACK_MIN_SPECIAL) * weight / total +
    (PACK_FILLER_TYPES.includes(id) ? 0 : PACK_MIN_SPECIAL * weight / specialTotal)
  ) / pack.cards]);
}

export const cardCount = (s) => s.deck.length;

export function drawCard(s) {
  if (s.hand || !s.deck.length) return null;
  s.hand = s.deck.shift();
  return s.hand;
}

export function shuffleDeck(s) {
  if (s.gold < SHUFFLE_COST || s.deck.length < 2) return false;
  s.gold -= SHUFFLE_COST;
  s.deck = shuffled(s.deck);
  return true;
}

export function placeHand(s, x, y, now = Date.now()) {
  if (!TILES[s.hand]) return null;
  const valid = placeCells(s).some(c => c[0] === x && c[1] === y);
  if (!valid) return null;
  const affected = s.hand === 'lagerhalle' ? affectedWorkshopJobs(s, x, y) : [];
  const tile = addTile(s, s.hand, x, y);
  adjustWorkshopJobs(s, affected, now);
  s.hand = null;
  return { tile, pairs: partnersOf(s, tile).map(o => ({ tile: o, value: pairValue(tile, o) })) };
}

const NEIGHBORS = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => [dx, dy])).filter(([dx, dy]) => dx || dy);

// Stärke eines Nachbar-Paares.
export function pairValue(a, b) {
  const ga = TILES[a.type].gives?.[b.type] || 0;
  if (a.type === b.type) return ga;
  return ga + (TILES[b.type].gives?.[a.type] || 0);
}

// Nachbarn (8 Felder rundherum), mit denen dieses Tile ein Paar bildet.
export function partnersOf(s, tile) {
  return NEIGHBORS.map(([dx, dy]) => s.tiles[key(tile.x + dx, tile.y + dy)]).filter(o => o && pairValue(tile, o) > 0);
}

export function useJoker(s, x, y, now = Date.now()) {
  const tile = tileAt(s, x, y);
  if (!tile) return null;
  if (tile.type === 'workshop' && (tile.job || Object.values(s.tiles).filter(t => t.type === 'workshop').length <= 1)) return null;
  if (s.hand === 'joker_loeschen') {
    if (Object.keys(s.tiles).length <= 1) return null;
    const affected = tile.type === 'lagerhalle' ? affectedWorkshopJobs(s, x, y) : [];
    delete s.tiles[key(x, y)];
    adjustWorkshopJobs(s, affected, now);
    s.hand = null;
    return { kind: 'deleted', tile };
  }
  if (s.hand !== 'joker_verwandeln') return null;
  const types = Object.keys(TILES).filter(type => type !== tile.type);
  const newType = types[Math.floor(Math.random() * types.length)];
  const oldType = tile.type;
  const affected = oldType === 'lagerhalle' || newType === 'lagerhalle' ? affectedWorkshopJobs(s, x, y) : [];
  tile.type = newType;
  adjustWorkshopJobs(s, affected, now);
  s.hand = null;
  return { kind: 'transformed', tile, oldType, pairs: partnersOf(s, tile).map(o => ({ tile: o, value: pairValue(tile, o) })) };
}

export const canAfford = (s, cost) => s.gold >= cost;

export function productionRates(s) {
  const rates = { holz: 0, korn: 0, gold: 0 };
  for (const tile of Object.values(s.tiles)) {
    if (tile.type === 'wald' || tile.type === 'holzfaeller') rates.holz++;
    if (tile.type === 'feld' || tile.type === 'windmuehle') rates.korn++;
    for (const other of partnersOf(s, tile)) {
      if (tile.id >= other.id) continue;
      const value = pairValue(tile, other);
      if (tile.type === 'holzfaeller' || other.type === 'holzfaeller') rates.holz += value;
      else if (tile.type === 'windmuehle' || other.type === 'windmuehle') rates.korn += value;
      else rates.gold += value;
    }
  }
  return rates;
}

export function updateProduction(s, now = Date.now()) {
  let changed = false;
  if (now < s.productionAt) {
    s.productionAt = now;
    changed = true;
  }
  const ticks = Math.floor((now - s.productionAt) / PRODUCTION_INTERVAL);
  if (ticks > 0) {
    const rates = productionRates(s);
    for (const id of ['holz', 'korn']) s.resources[id] = Math.min(RESOURCE_CAP, s.resources[id] + rates[id] * ticks);
    s.gold += rates.gold * ticks;
    s.productionAt += ticks * PRODUCTION_INTERVAL;
    changed = true;
  }
  for (const tile of Object.values(s.tiles)) {
    if (tile.type === 'workshop' && tile.job && tile.job.endsAt <= now) {
      s.packs[tile.job.pack] = (s.packs[tile.job.pack] || 0) + 1;
      delete tile.job;
      changed = true;
    }
  }
  return changed;
}

export function warehouseCount(s, tile) {
  return NEIGHBORS.map(([dx, dy]) => tileAt(s, tile.x + dx, tile.y + dy)).filter(t => t?.type === 'lagerhalle').length;
}

export function workshopDuration(s, tile, packId) {
  const baseDuration = packId === 'starthilfe' ? 30000 : PACKS[packId].duration;
  return Math.round(baseDuration * Math.max(0.4, 1 - warehouseCount(s, tile) * 0.2));
}

function affectedWorkshopJobs(s, x, y) {
  return NEIGHBORS.map(([dx, dy]) => tileAt(s, x + dx, y + dy))
    .filter(tile => tile?.type === 'workshop' && tile.job)
    .map(tile => ({ tile, duration: tile.job.duration ?? workshopDuration(s, tile, tile.job.pack) }));
}

function adjustWorkshopJobs(s, affected, now) {
  for (const { tile, duration } of affected) {
    if (tile.job.endsAt <= now) continue;
    const newDuration = workshopDuration(s, tile, tile.job.pack);
    tile.job.endsAt = now + Math.round((tile.job.endsAt - now) * newDuration / duration);
    tile.job.duration = newDuration;
  }
}

export function canStartPack(s, tile, packId) {
  const pack = PACKS[packId];
  return !!(pack && tile?.type === 'workshop' && s.tiles[key(tile.x, tile.y)] === tile && !tile.job &&
    Object.entries(pack.cost).every(([id, amount]) => s.resources[id] >= amount));
}

export function startPack(s, tile, packId, now = Date.now()) {
  if (!canStartPack(s, tile, packId)) return false;
  for (const [id, amount] of Object.entries(PACKS[packId].cost)) s.resources[id] -= amount;
  const duration = workshopDuration(s, tile, packId);
  tile.job = { pack: packId, duration, endsAt: now + duration };
  return true;
}

export function canStartRecovery(s, tile) {
  const rates = productionRates(s);
  const cost = PACKS.natur.cost;
  return tile?.type === 'workshop' && s.tiles[key(tile.x, tile.y)] === tile && !tile.job &&
    (!s.hand || JOKERS[s.hand]) && s.deck.every(id => JOKERS[id]) && !Object.values(s.packs).some(Boolean) &&
    !Object.values(s.tiles).some(t => t.job) &&
    Object.entries(cost).some(([id, amount]) => s.resources[id] < amount && rates[id] === 0);
}

export function startRecovery(s, tile, now = Date.now()) {
  if (!canStartRecovery(s, tile)) return false;
  const duration = workshopDuration(s, tile, 'starthilfe');
  tile.job = { pack: 'starthilfe', duration, endsAt: now + duration };
  return true;
}

export function openPack(s, packId) {
  if (!s.packs[packId]) return null;
  if (packId === 'starthilfe') {
    s.packs[packId]--;
    const cards = shuffled(['wald', 'feld', 'gras', 'erde', 'wasser']);
    s.deck.push(...cards);
    return cards;
  }
  const pack = PACKS[packId];
  if (!pack) throw new Error(`Unbekanntes Pack: ${packId}`);
  packChances(pack);
  const pool = Object.entries(pack.weights);
  const specialPool = pool.filter(([id]) => !PACK_FILLER_TYPES.includes(id));
  s.packs[packId]--;
  const drawn = [];
  for (let i = 0; i < pack.cards; i++) {
    const id = pickWeighted(i < PACK_MIN_SPECIAL ? specialPool : pool);
    drawn.push(id);
  }
  const cards = shuffled(drawn);
  s.deck.push(...cards);
  return cards;
}
