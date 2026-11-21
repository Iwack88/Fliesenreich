import { TILES, RARITY, RESOURCES, START_GOLD, START_TILE, NEXT_BASE_COST, NEXT_COST_STEP } from './config.js';

const key = (x, y) => `${x},${y}`;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function newState() {
  const s = { gold: START_GOLD, wood: 0, grain: 0, spawned: 0, nextId: 1, tiles: {} };
  addTile(s, START_TILE, 0, 0);
  return s;
}

export function addTile(s, type, x, y) {
  const maxMoves = RARITY[TILES[type].rarity].maxMoves;
  const t = { id: s.nextId++, type, x, y, movesLeft: maxMoves, acc: {} };
  s.tiles[key(x, y)] = t;
  return t;
}

export const tileAt = (s, x, y) => s.tiles[key(x, y)];
export const nextCost = (s) => NEXT_BASE_COST + NEXT_COST_STEP * s.spawned;

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

function randomType() {
  const entries = Object.entries(TILES);
  let r = Math.random() * entries.reduce((a, [, d]) => a + d.weight, 0);
  for (const [id, d] of entries) { r -= d.weight; if (r <= 0) return id; }
  return entries[0][0];
}

export function spawnTile(s) {
  const cost = nextCost(s);
  if (s.gold < cost) return null;
  const cells = freeCellsNextToTiles(s);
  const [x, y] = cells[Math.floor(Math.random() * cells.length)];
  s.gold -= cost;
  s.spawned++;
  return addTile(s, randomType(), x, y);
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
  if (tile.movesLeft <= 0) return [];
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
  s.tiles[key(tile.x, tile.y)] = tile;
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

export function sellAll(s) {
  let gold = 0;
  for (const [res, def] of Object.entries(RESOURCES)) {
    if (!def.sellValue) continue;
    gold += s[res] * def.sellValue;
    s[res] = 0;
  }
  s.gold += gold;
  return gold;
}
