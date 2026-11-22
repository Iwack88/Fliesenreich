import { TILES, CARDS, START_GOLD, START_TILE, START_DECK, PACKS, PACK_FILLER_TYPES, PACK_MIN_SPECIAL, SHUFFLE_COST, START_SIZE, EXPANDED_SIZE, START_OBSTACLES, EXPANSION_OBSTACLES, EXPANSION_COST, OBSTACLE_TYPES } from './config.js?v=9';

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
  const s = { gold: START_GOLD, size: START_SIZE, nextId: 1, tiles: {}, hand: null, deck: shuffled(Object.entries(START_DECK).flatMap(([id, n]) => Array(n).fill(id))) };
  addTile(s, START_TILE, 0, 0);
  addObstacles(s, 0, START_OBSTACLES);
  return s;
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

export function placeHand(s, x, y) {
  if (!TILES[s.hand]) return null;
  const valid = placeCells(s).some(c => c[0] === x && c[1] === y);
  if (!valid) return null;
  const tile = addTile(s, s.hand, x, y);
  s.hand = null;
  let gold = 0;
  const pairs = [];
  for (const o of partnersOf(s, tile)) {
    const v = pairValue(tile, o);
    gold += v;
    pairs.push({ tile: o, value: v });
    o.earned = (o.earned || 0) + v;
    tile.earned += v;
  }
  s.gold += gold;
  return { tile, gold, pairs };
}

const NEIGHBORS = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => [dx, dy])).filter(([dx, dy]) => dx || dy);

// Gold-Wert eines Nachbar-Paares.
export function pairValue(a, b) {
  const ga = TILES[a.type].gives?.[b.type] || 0;
  if (a.type === b.type) return ga;
  return ga + (TILES[b.type].gives?.[a.type] || 0);
}

// Nachbarn (8 Felder rundherum), mit denen dieses Tile ein Gold-Paar bildet.
export function partnersOf(s, tile) {
  return NEIGHBORS.map(([dx, dy]) => s.tiles[key(tile.x + dx, tile.y + dy)]).filter(o => o && pairValue(tile, o) > 0);
}

export function useJoker(s, x, y) {
  const tile = tileAt(s, x, y);
  if (!tile) return null;
  if (s.hand === 'joker_loeschen') {
    if (Object.keys(s.tiles).length <= 1) return null;
    delete s.tiles[key(x, y)];
    s.hand = null;
    return { kind: 'deleted', tile };
  }
  if (s.hand !== 'joker_verwandeln') return null;
  const types = Object.keys(TILES).filter(type => type !== tile.type);
  const newType = types[Math.floor(Math.random() * types.length)];
  const oldType = tile.type;
  const neighbors = NEIGHBORS.map(([dx, dy]) => tileAt(s, x + dx, y + dy)).filter(Boolean);
  const before = neighbors.map(neighbor => pairValue(tile, neighbor));
  tile.type = newType;
  const pairs = [];
  let gold = 0;
  neighbors.forEach((neighbor, i) => {
    const value = Math.max(0, pairValue(tile, neighbor) - before[i]);
    if (!value) return;
    gold += value;
    pairs.push({ tile: neighbor, value });
    neighbor.earned = (neighbor.earned || 0) + value;
    tile.earned = (tile.earned || 0) + value;
  });
  s.gold += gold;
  s.hand = null;
  return { kind: 'transformed', tile, oldType, gold, pairs };
}

export const canAfford = (s, cost) => s.gold >= cost;

export function buyPack(s, packId) {
  const pack = PACKS[packId];
  if (!pack) throw new Error(`Unbekanntes Pack: ${packId}`);
  if (!canAfford(s, pack.cost)) return null;
  packChances(pack);
  const pool = Object.entries(pack.weights);
  const specialPool = pool.filter(([id]) => !PACK_FILLER_TYPES.includes(id));
  s.gold -= pack.cost;
  const drawn = [];
  for (let i = 0; i < pack.cards; i++) {
    const id = pickWeighted(i < PACK_MIN_SPECIAL ? specialPool : pool);
    drawn.push(id);
  }
  const cards = shuffled(drawn);
  s.deck.push(...cards);
  return cards;
}
