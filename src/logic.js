import { TILES, START_GOLD, START_TILE, START_DECK, RARITY_ORDER, PACKS } from './config.js';

const key = (x, y) => `${x},${y}`;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function newState() {
  const s = { gold: START_GOLD, wood: 0, grain: 0, nextId: 1, tiles: {}, hand: null, inventory: { ...START_DECK } };
  addTile(s, START_TILE, 0, 0);
  return s;
}

export function addTile(s, type, x, y) {
  const t = { id: s.nextId++, type, x, y, acc: {} };
  s.tiles[key(x, y)] = t;
  return t;
}

export const tileAt = (s, x, y) => s.tiles[key(x, y)];

export function placeCells(s) {
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

// Zieht zufällig eine Karte aus dem Inventar (gewichtet nach Anzahl) auf die Hand.
export function drawCard(s) {
  if (s.hand) return null;
  const entries = Object.entries(s.inventory).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  const type = pickWeighted(entries);
  s.inventory[type]--;
  s.hand = type;
  return type;
}

// Legt die Handkarte frei auf ein freies Feld neben einem bestehenden Tile.
export function placeHand(s, x, y) {
  if (!s.hand || !placeCells(s).some(c => c[0] === x && c[1] === y)) return null;
  const t = addTile(s, s.hand, x, y);
  s.hand = null;
  return t;
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
