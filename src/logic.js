import { TILES, RARITY, START_GOLD, START_TILE, START_DECK, RARITY_ORDER, PACKS, SHUFFLE_COST } from './config.js';

const key = (x, y) => `${x},${y}`;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newState() {
  const s = { gold: START_GOLD, nextId: 1, tiles: {}, hand: null, deck: shuffled(Object.entries(START_DECK).flatMap(([id, n]) => Array(n).fill(id))) };
  addTile(s, START_TILE, 0, 0);
  return s;
}

export function addTile(s, type, x, y) {
  const t = { id: s.nextId++, type, x, y, earned: 0 };
  s.tiles[key(x, y)] = t;
  return t;
}

export const tileAt = (s, x, y) => s.tiles[key(x, y)];

export function maxMovesOf(type) {
  const def = TILES[type];
  return def.maxMoves ?? RARITY[def.rarity].maxMoves;
}

// Eine gezogene Karte spawnt zufällig an einer freien Seite eines bestehenden Tiles.
export function spawnHandTile(s) {
  if (!s.hand) return null;
  const cells = [];
  for (const t of Object.values(s.tiles)) {
    for (const [dx, dy] of DIRS4) {
      const x = t.x + dx, y = t.y + dy;
      if (!s.tiles[key(x, y)]) cells.push([x, y]);
    }
  }
  if (!cells.length) return null;
  const [x, y] = cells[Math.floor(Math.random() * cells.length)];
  const tile = addTile(s, s.hand, x, y);
  tile.unplaced = true;
  tile.movesLeft = maxMovesOf(tile.type);
  s.hand = null;
  return tile;
}

// Alle erreichbaren leeren Felder, deren Entfernung <= Moves bleibt.
// Das Netz muss an mindestens einem bestehenden Tile liegen.
export function moveTargets(s, tile) {
  if (!tile.unplaced || tile.movesLeft <= 0) return [];
  const dist = new Map([[key(tile.x, tile.y), 0]]);
  const queue = [[tile.x, tile.y]];
  const result = [];
  while (queue.length) {
    const [x, y] = queue.shift();
    const d = dist.get(key(x, y));
    if (d >= tile.movesLeft) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (dist.has(k) || s.tiles[k] && s.tiles[k] !== tile) continue;
      dist.set(k, d + 1);
      queue.push([nx, ny]);
      const adjacent = DIRS4.some(([ax, ay]) => tileAt(s, nx + ax, ny + ay) && tileAt(s, nx + ax, ny + ay) !== tile);
      if (adjacent) result.push({ x: nx, y: ny, cost: d + 1 });
    }
  }
  return result;
}

export function moveTile(s, tile, target) {
  delete s.tiles[key(tile.x, tile.y)];
  tile.x = target.x;
  tile.y = target.y;
  tile.movesLeft -= target.cost;
  s.tiles[key(tile.x, tile.y)] = tile;
}

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

export const cardCount = (s) => s.deck.length;

// Zieht die oberste Karte des Decks auf die Hand.
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

// Legt die Handkarte frei auf ein freies Feld neben einem bestehenden Tile.
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

// Platzierung bestätigt das bewegte Tile und zahlt einmalig Gold für neue Paare.
export function placeTile(s, tile) {
  if (!tile.unplaced) return null;
  tile.unplaced = false;
  delete tile.movesLeft;
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

export const canAfford = (s, cost) => s.gold >= cost;

export function buyPack(s, packId) {
  const pack = PACKS[packId];
  if (!canAfford(s, pack.cost)) return null;
  s.gold -= pack.cost;
  const pool = Object.entries(TILES).filter(([id]) => rarityOk(id, pack.maxRarity)).map(([id, d]) => [id, d.weight]);
  const drawn = [];
  for (let i = 0; i < pack.cards; i++) {
    const id = pickWeighted(pool);
    drawn.push(id);
  }
  s.deck.push(...drawn);
  return drawn;
}
