import { TILES, RARITY, RESOURCES, START_GOLD, START_TILE, START_DECK, NEXT_TYPES, RARITY_ORDER, PACKS } from './config.js';

const key = (x, y) => `${x},${y}`;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function newState() {
  const s = { gold: START_GOLD, wood: 0, grain: 0, nextId: 1, tiles: {}, inventory: { ...START_DECK } };
  addTile(s, START_TILE, 0, 0);
  return s;
}

export const maxMovesOf = (type) => TILES[type].maxMoves ?? RARITY[TILES[type].rarity].maxMoves;

export function addTile(s, type, x, y, unplaced = false) {
  const maxMoves = maxMovesOf(type);
  const t = { id: s.nextId++, type, x, y, movesLeft: maxMoves, acc: {}, unplaced };
  s.tiles[key(x, y)] = t;
  return t;
}

export const tileAt = (s, x, y) => s.tiles[key(x, y)];

function freeCellsNextToTiles(s) {
  const cells = new Map();
  for (const t of Object.values(s.tiles)) {
    for (const [dx, dy] of DIRS4) {
      const x = t.x + dx, y = t.y + dy;
      if (!s.tiles[key(x, y)]) cells.set(key(x, y), [x, y]);
    }
  }
  return [...cells.values()];
}

const rarityOk = (type, max) => !max || RARITY_ORDER.indexOf(TILES[type].rarity) <= RARITY_ORDER.indexOf(max);

function pickWeighted(entries) {
  let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of entries) { r -= w; if (r <= 0) return id; }
  return entries[entries.length - 1][0];
}

export const cardCount = (s) => Object.values(s.inventory).reduce((a, n) => a + n, 0);

// Zufälliges Tile für "Next" (unabhängig vom Inventar).
export const drawNextType = () => pickWeighted(NEXT_TYPES.map(id => [id, TILES[id].weight]));

// Spielt eine Karte: verbraucht sie und legt das Tile an eine freie Seite.
export function playCard(s, type, fromInventory = true) {
  if (hasUnplaced(s) || (fromInventory && !(s.inventory[type] > 0))) return null;
  const cells = freeCellsNextToTiles(s);
  const [x, y] = cells[Math.floor(Math.random() * cells.length)];
  if (fromInventory) s.inventory[type]--;
  return addTile(s, type, x, y, true);
}

export function canAfford(s, cost) {
  return Object.entries(cost).every(([r, n]) => s[r] >= n);
}

export function buyPack(s, packId) {
  const pack = PACKS[packId];
  if (!canAfford(s, pack.cost)) return null;
  for (const [r, n] of Object.entries(pack.cost)) s[r] -= n;
  const pool = Object.entries(TILES).filter(([id]) => rarityOk(id, pack.maxRarity)).map(([id, d]) => [id, d.weight]);
  const drawn = [];
  for (let i = 0; i < pack.cards; i++) {
    const id = pickWeighted(pool);
    s.inventory[id] = (s.inventory[id] || 0) + 1;
    drawn.push(id);
  }
  return drawn;
}

function isConnected(tiles) {
  if (tiles.length <= 1) return true;
  const set = new Set(tiles.map(t => key(t.x, t.y)));
  const seen = new Set([key(tiles[0].x, tiles[0].y)]);
  const stack = [[tiles[0].x, tiles[0].y]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of DIRS4) {
      const k = key(x + dx, y + dy);
      if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
    }
  }
  return seen.size === set.size;
}

// Freie Zielfelder (nur über freie Felder erreichbar), Kosten = Schritte.
// Das Tile muss am Ziel an ein anderes Tile angrenzen und das Netz darf nicht zerfallen.
export function moveTargets(s, tile) {
  if (!tile.unplaced || tile.movesLeft <= 0) return [];
  const others = Object.values(s.tiles).filter(t => t !== tile);
  const dist = new Map([[key(tile.x, tile.y), 0]]);
  const queue = [[tile.x, tile.y]];
  const result = [];
  while (queue.length) {
    const [x, y] = queue.shift();
    const d = dist.get(key(x, y));
    if (d >= tile.movesLeft) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (dist.has(k) || (s.tiles[k] && s.tiles[k] !== tile)) continue;
      dist.set(k, d + 1);
      queue.push([nx, ny]);
      const adjacent = DIRS4.some(([ax, ay]) => others.some(o => o.x === nx + ax && o.y === ny + ay));
      if (adjacent && isConnected([...others, { x: nx, y: ny }])) result.push({ x: nx, y: ny, cost: d + 1 });
    }
  }
  return result;
}

export function moveTile(s, tile, target) {
  delete s.tiles[key(tile.x, tile.y)];
  tile.x = target.x; tile.y = target.y;
  tile.movesLeft -= target.cost;
  tile.unplaced = false;
  s.tiles[key(tile.x, tile.y)] = tile;
}

export const hasUnplaced = (s) => Object.values(s.tiles).some(t => t.unplaced);

export function placeTile(tile) { tile.unplaced = false; }

// Anzahl buffender Nachbarn (8 Felder rundherum).
export function buffCount(s, tile) {
  const def = TILES[tile.type];
  if (!def.buffedBy) return 0;
  let n = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const o = s.tiles[key(tile.x + dx, tile.y + dy)];
    if (o && def.buffedBy[o.type]) n += 1;
  }
  return n;
}

export function ratePerTick(s, tile) {
  const def = TILES[tile.type];
  const rates = { ...(def.produces || {}) };
  if (def.buffedBy) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const o = s.tiles[key(tile.x + dx, tile.y + dy)];
      const bonus = o && def.buffedBy[o.type];
      if (bonus) for (const r of Object.keys(def.produces)) rates[r] += bonus;
    }
  }
  return rates;
}

export function tick(s) {
  for (const t of Object.values(s.tiles)) {
    const rates = ratePerTick(s, t);
    for (const [res, rate] of Object.entries(rates)) {
      t.acc[res] = (t.acc[res] || 0) + rate;
      const whole = Math.floor(t.acc[res]);
      if (whole > 0) { s[res] += whole; t.acc[res] -= whole; }
    }
  }
}
