import { TILES, JOKERS, HAZARDS, CARDS, RARITY, RESOURCE_CHAINS, LAND_WEIGHTS, PLACEMENT_SHARE, START_LAND_TILES, EXPANSION_LAND_TILES, START_GOLD, START_TILE, TOWN_HALL_OUTPUT, START_DECK, START_RESOURCES, BASE_CAPACITY, STORAGE_BONUS, PRODUCTION_INTERVAL, BANDIT_INTERVAL, GUARD_RADIUS, PACKS, SHUFFLE_COST, DELETE_CARD_REWARD, UNDELETABLE_CARDS, START_SIZE, EXPANDED_SIZE, EXPANSION_COST, SHOP_INTERVAL, SHOP_OFFER_COUNT, SHOP_PRICES, SHOP_DISCOUNT, SUPPLY_CHAINS, MIN_SUPPLIERS, SUPPLIER_OUTPUT, EMERGENCY_RATE, SPECIAL_SLOT_SHARE, SPECIAL_SLOT_CLEARANCE, MOVE_STEP_COST, SWAP_COST, FREE_MOVE_JOKER, MAX_CRAFT_JOBS } from './config.js?v=32';

const key = (x, y) => `${x},${y}`;
export const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const baseRarity = type => CARDS[type].rarity;
export const tileRarity = tile => tile.rarity || baseRarity(tile.type);
export const tileStrength = tile => RARITY[tileRarity(tile)].strength;
export const guardRadius = tile => GUARD_RADIUS + tileStrength(tile) - 1;
export const matchesTileFilter = (tile, filter) => filter.kind === 'resource'
  ? RESOURCE_CHAINS[filter.id].includes(tile.type)
  : tile.type === filter.id;

export function rollRarity(type) {
  const base = baseRarity(type);
  if (!TILES[type] || type === 'banditen') return base;
  const entries = Object.entries(RARITY);
  const minimum = entries.findIndex(([id]) => id === base);
  const eligible = entries.slice(minimum);
  return pickWeighted(eligible.map(([id, rarity]) => [id, rarity.weight]));
}

function ensureDeckRarities(s) {
  if (!Array.isArray(s.deckRarities) || s.deckRarities.length !== s.deck.length) {
    s.deckRarities = s.deck.map(baseRarity);
  }
  if (!Array.isArray(s.deckPlacementSlots) || s.deckPlacementSlots.length !== s.deck.length) {
    s.deckPlacementSlots = s.deck.map(() => null);
  }
}

function addCards(s, cards) {
  ensureDeckRarities(s);
  s.deck.push(...cards);
  s.deckRarities.push(...cards.map(rollRarity));
  s.deckPlacementSlots.push(...cards.map(() => null));
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newState() {
  const s = { gold: START_GOLD, resources: { ...START_RESOURCES }, productionAt: Date.now(), banditElapsed: 0, packs: {}, crafting: [], size: START_SIZE, nextId: 1, tiles: {}, hand: null, deck: shuffled(Object.entries(START_DECK).flatMap(([id, n]) => Array(n).fill(id))) };
  s.deckRarities = s.deck.map(rollRarity);
  s.deckPlacementSlots = s.deck.map(() => null);
  s.shop = { elapsed: 0, round: 0, offers: [] };
  refreshShop(s);
  s.protectedFields = {};
  addTile(s, START_TILE, 0, 0);
  addTile(s, 'wachturm', 1, 0);
  s.specialSlots = {};
  addLandTiles(s, 0, START_LAND_TILES);
  addSpecialSlots(s);
  return s;
}

const RARITY_IDS = Object.keys(RARITY);
export const upgradedRarity = rarity => RARITY_IDS[Math.min(RARITY_IDS.indexOf(rarity) + 1, RARITY_IDS.length - 1)];
export const isSpecialSlot = (s, x, y) => !!s.specialSlots?.[key(x, y)];

export function placementRarity(s, type, rarity, x, y) {
  const own = rarity || baseRarity(type);
  return isSpecialSlot(s, x, y) ? upgradedRarity(own) : own;
}

// Verteilt Spezial-Bauplätze auf freie Felder ohne Slot, die nicht direkt am Startbereich liegen.
function addSpecialSlots(s, isNew = () => true) {
  const half = s.size / 2;
  const cells = [];
  for (let x = -half; x < half; x++) for (let y = -half; y < half; y++) {
    if (!isNew(x, y) || s.tiles[key(x, y)]) continue;
    if (Math.max(Math.abs(x), Math.abs(y)) <= SPECIAL_SLOT_CLEARANCE ||
        Math.max(Math.abs(x - 1), Math.abs(y)) <= SPECIAL_SLOT_CLEARANCE) continue;
    cells.push([x, y]);
  }
  const count = Math.round(cells.length * SPECIAL_SLOT_SHARE);
  for (const [x, y] of shuffled(cells).slice(0, count)) s.specialSlots[key(x, y)] = true;
}

export function migrateState(s, now = Date.now()) {
  let changed = false;
  if (!s.protectedFields) {
    s.protectedFields = {};
    changed = true;
  }
  if (!s.specialSlots) {
    s.specialSlots = {};
    addSpecialSlots(s);
    changed = true;
  }
  if (!s.shop) {
    s.shop = { elapsed: 0, round: 0, offers: [] };
    changed = true;
  }
  if (!s.shop.offers.length) {
    refreshShop(s, false);
    changed = true;
  }
  if (!s.resources) {
    s.resources = { ...START_RESOURCES };
    s.productionAt = now;
    s.packs = {};
    if (!Object.values(s.tiles).some(tile => tile.type === 'workshop') && s.hand !== 'workshop' && !s.deck.includes('workshop')) {
      s.deck.unshift('workshop');
    }
    changed = true;
  }
  if (!Array.isArray(s.crafting)) {
    s.crafting = [];
    for (const tile of Object.values(s.tiles)) {
      if (!tile.job) continue;
      s.crafting.push(tile.job);
      delete tile.job;
    }
    changed = true;
  }
  if (s.resources.werkzeug == null) {
    s.resources.werkzeug = START_RESOURCES.werkzeug;
    changed = true;
  }
  if (s.banditElapsed == null) {
    s.banditElapsed = 0;
    if (!Object.values(s.tiles).some(tile => tile.type === 'wachturm') && s.hand !== 'wachturm' && !s.deck.includes('wachturm')) {
      s.deck.unshift('wachturm');
    }
    s.deck.push('banditen_niete');
    changed = true;
  }
  if (!Array.isArray(s.deckRarities) || s.deckRarities.length !== s.deck.length) {
    s.deckRarities = s.deck.map(baseRarity);
    changed = true;
  }
  if (s.hand && !s.handRarity) {
    s.handRarity = baseRarity(s.hand);
    changed = true;
  }
  if (!Array.isArray(s.deckPlacementSlots) || s.deckPlacementSlots.length !== s.deck.length) {
    s.deckPlacementSlots = s.deck.map(() => null);
    changed = true;
  }
  if (TILES[s.hand] && s.hand !== 'banditen' && !Array.isArray(s.handPlacementSlots)) {
    s.handPlacementSlots = choosePlacementSlots(s, s.handRarity);
    changed = true;
  }
  return planBandits(s) || changed;
}

export function addTile(s, type, x, y, rarity = baseRarity(type)) {
  const t = { id: s.nextId++, type, x, y, rarity, earned: 0 };
  s.tiles[key(x, y)] = t;
  return t;
}

export const tileAt = (s, x, y) => s.tiles[key(x, y)];

export function inBounds(size, x, y) {
  const half = size / 2;
  return x >= -half && x < half && y >= -half && y < half;
}

function addLandTiles(s, oldSize, count) {
  const cells = [];
  for (let x = -s.size / 2; x < s.size / 2; x++) for (let y = -s.size / 2; y < s.size / 2; y++) {
    if (oldSize && inBounds(oldSize, x, y)) continue;
    if (s.tiles[key(x, y)] || s.specialSlots?.[key(x, y)]) continue;
    if (!oldSize && (Math.abs(x) + Math.abs(y) <= 1 || Math.abs(x - 1) + Math.abs(y) <= 1)) continue;
    cells.push([x, y]);
  }
  if (cells.length < count) throw new Error('Nicht genügend freie Felder für die Landschaftsgenerierung');
  for (const [x, y] of shuffled(cells).slice(0, count)) {
    addTile(s, pickWeighted(Object.entries(LAND_WEIGHTS)), x, y);
  }
}

export function expandWorld(s) {
  if (s.size !== START_SIZE || s.gold < EXPANSION_COST) return false;
  const oldSize = s.size;
  s.size = EXPANDED_SIZE;
  s.specialSlots ||= {};
  addLandTiles(s, oldSize, EXPANSION_LAND_TILES);
  addSpecialSlots(s, (x, y) => !inBounds(oldSize, x, y));
  planBandits(s);
  s.gold -= EXPANSION_COST;
  return true;
}

export function placeCells(s) {
  const cells = [];
  for (let x = -s.size / 2; x < s.size / 2; x++) for (let y = -s.size / 2; y < s.size / 2; y++) {
    if (!s.tiles[key(x, y)]) cells.push([x, y]);
  }
  return cells;
}

function choosePlacementSlots(s, rarity) {
  const free = placeCells(s);
  const count = free.length ? Math.max(1, Math.ceil(free.length * PLACEMENT_SHARE[rarity])) : 0;
  return shuffled(free).slice(0, count);
}

export function availablePlacementSlots(s) {
  if (!TILES[s.hand] || s.hand === 'banditen' || !Array.isArray(s.handPlacementSlots)) return [];
  return s.handPlacementSlots.filter(([x, y]) => inBounds(s.size, x, y) && !tileAt(s, x, y));
}

function pickWeighted(entries) {
  let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of entries) { if (r < w) return id; r -= w; }
  return entries[entries.length - 1][0];
}

// Prozentwerte innerhalb der Gruppen; wirft bei ungültiger Konfiguration.
export function packChances(pack) {
  const percent = weights => {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (!total || entries.some(([id, weight]) => !CARDS[id] || !Number.isFinite(weight) || weight <= 0)) {
      throw new Error(`Ungültige Kartengewichte für ${pack.name}`);
    }
    return entries.map(([id, weight]) => [id, 100 * weight / total]);
  };
  if (!(pack.extraChance >= 0 && pack.hazardChance >= 0 && pack.extraChance + pack.hazardChance <= 1) ||
      Object.keys(pack.weights).some(id => id === 'banditen_niete')) {
    throw new Error(`Ungültiger Pack-Aufbau für ${pack.name}`);
  }
  return { value: percent(pack.weights) };
}

export const cardCount = (s) => s.deck.length;

export function shopStatus(s) {
  return { open: true, remaining: SHOP_INTERVAL - s.shop.elapsed };
}

export function refreshShop(s, resetTimer = true) {
  s.shop.round++;
  if (resetTimer) s.shop.elapsed = 0;
  s.shop.offers = shuffled(Object.keys(CARDS).filter(id => id !== 'banditen'))
    .slice(0, SHOP_OFFER_COUNT).map(card => ({
      card, price: Math.round(SHOP_PRICES[CARDS[card].shopTier || CARDS[card].rarity] * (1 - SHOP_DISCOUNT)), bought: false,
    }));
}

export function advanceShop(s, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Ungültige aktive Shop-Zeit');
  const elapsed = s.shop.elapsed + elapsedMs;
  const rounds = Math.floor(elapsed / SHOP_INTERVAL);
  s.shop.elapsed = elapsed % SHOP_INTERVAL;
  if (rounds) {
    s.shop.round += rounds - 1;
    refreshShop(s, false);
  }
}

export function buyShopCard(s, card, round) {
  if (!shopStatus(s).open || s.shop.round !== round) return false;
  const offer = s.shop.offers.find(offer => offer.card === card);
  if (!offer || offer.bought || s.gold < offer.price) return false;
  s.gold -= offer.price;
  addCards(s, [card]);
  offer.bought = true;
  return true;
}

export function drawCard(s) {
  if (s.hand || !s.deck.length) return null;
  ensureDeckRarities(s);
  const card = s.deck.shift();
  const rarity = s.deckRarities.shift();
  const slots = s.deckPlacementSlots.shift();
  if (card === 'joker_banditenzeit') { s.banditElapsed = 0; s.handRarity = null; }
  else if (card === 'joker_shop') { refreshShop(s); s.handRarity = null; }
  else if (card === 'joker_freizug') { s.freeMoves = (s.freeMoves || 0) + FREE_MOVE_JOKER; s.handRarity = null; }
  else {
    s.hand = card;
    s.handRarity = rarity;
    if (TILES[card] && card !== 'banditen') s.handPlacementSlots = slots?.length ? slots : choosePlacementSlots(s, rarity);
  }
  return card;
}

export function returnHand(s) {
  if (!s.hand) return false;
  ensureDeckRarities(s);
  s.deck.push(s.hand);
  s.deckRarities.push(s.handRarity || baseRarity(s.hand));
  s.deckPlacementSlots.push(s.handPlacementSlots || null);
  s.hand = null;
  s.handRarity = null;
  delete s.handPlacementSlots;
  return true;
}

export const canDeleteCard = s => !s.hand && s.deck.length > 0 && !UNDELETABLE_CARDS.includes(s.deck[0]);

// Entfernt die oberste Deckkarte gegen Gold (begrenzt durch die Lagerkapazität).
export function deleteNextCard(s) {
  if (!canDeleteCard(s)) return null;
  ensureDeckRarities(s);
  const card = s.deck.shift();
  s.deckRarities.shift();
  s.deckPlacementSlots.shift();
  s.gold = Math.max(s.gold, Math.min(s.gold + DELETE_CARD_REWARD, storageCapacity(s).gold));
  return card;
}

export function shuffleDeck(s) {
  if (s.gold < SHUFFLE_COST || s.deck.length < 2) return false;
  s.gold -= SHUFFLE_COST;
  ensureDeckRarities(s);
  const cards = shuffled(s.deck.map((type, i) => ({ type, rarity: s.deckRarities[i], slots: s.deckPlacementSlots[i] })));
  s.deck = cards.map(card => card.type);
  s.deckRarities = cards.map(card => card.rarity);
  s.deckPlacementSlots = cards.map(card => card.slots);
  return true;
}

export function placeHand(s, x, y, now = Date.now()) {
  if (!TILES[s.hand] || s.hand === 'banditen') return null;
  const valid = availablePlacementSlots(s).some(c => c[0] === x && c[1] === y);
  if (!valid) return null;
  const special = isSpecialSlot(s, x, y);
  const tile = addTile(s, s.hand, x, y, placementRarity(s, s.hand, s.handRarity, x, y));
  if (special) delete s.specialSlots[key(x, y)];
  const cleared = tile.type === 'wachturm' ? clearGuardedBandits(s) : 0;
  planBandits(s);
  s.hand = null;
  s.handRarity = null;
  delete s.handPlacementSlots;
  return { tile, cleared, special, pairs: partnersOf(s, tile).map(o => ({ tile: o, value: pairValue(tile, o) })) };
}

const NEIGHBORS = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => [dx, dy])).filter(([dx, dy]) => dx || dy);

export function isProtected(s, x, y, tiles = Object.values(s.tiles)) {
  return !!s.protectedFields?.[key(x, y)] || tiles.some(t => t.type === 'wachturm' &&
    Math.abs(t.x - x) <= guardRadius(t) && Math.abs(t.y - y) <= guardRadius(t));
}

function clearGuardedBandits(s) {
  let cleared = 0;
  for (const tile of Object.values(s.tiles)) {
    if (tile.type === 'banditen' && isProtected(s, tile.x, tile.y)) {
      delete s.tiles[key(tile.x, tile.y)];
      cleared++;
    }
  }
  return cleared;
}

function replaceWithBandits(s, cells, now) {
  const lostStorage = new Set();
  for (const [x, y] of cells) {
    const type = tileAt(s, x, y)?.type;
    if (TILES[type]?.storage) lostStorage.add(TILES[type].storage);
  }
  const results = cells.map(([x, y]) => {
    const previous = tileAt(s, x, y);
    return { previous, tile: addTile(s, 'banditen', x, y) };
  });
  if (results.length) results[0].losses = trimStorage(s, lostStorage);
  return results;
}

export function spawnBandit(s, now = Date.now()) {
  if (s.hand !== 'banditen_niete') return null;
  const empty = [], occupied = [];
  for (let x = -s.size / 2; x < s.size / 2; x++) for (let y = -s.size / 2; y < s.size / 2; y++) {
    if (isProtected(s, x, y)) continue;
    const tile = tileAt(s, x, y);
    if (!tile) empty.push([x, y]);
    else if (tile.type !== 'banditen') occupied.push([x, y]);
  }
  const candidates = empty.length ? empty : occupied;
  if (!candidates.length) return null;
  const result = replaceWithBandits(s, [candidates[Math.floor(Math.random() * candidates.length)]], now)[0];
  s.hand = null;
  s.handRarity = null;
  planBandits(s);
  return result;
}

export function planBandits(s) {
  const camps = Object.values(s.tiles).filter(tile => tile.type === 'banditen');
  const guards = Object.values(s.tiles).filter(tile => tile.type === 'wachturm');
  const claimed = new Set();
  let changed = false;
  const eligible = (camp, x, y) => {
    const tile = tileAt(s, x, y);
    return inBounds(s.size, x, y) && Math.max(Math.abs(x - camp.x), Math.abs(y - camp.y)) === 1 &&
      tile?.type !== 'banditen' && !isProtected(s, x, y, guards);
  };
  for (const camp of camps) {
    const target = camp.target;
    if (target && eligible(camp, target.x, target.y) && !claimed.has(key(target.x, target.y))) {
      claimed.add(key(target.x, target.y));
    } else if (target) {
      delete camp.target;
      changed = true;
    }
  }
  for (const camp of shuffled(camps.filter(tile => !tile.target))) {
    const candidates = NEIGHBORS.map(([dx, dy]) => [camp.x + dx, camp.y + dy])
      .filter(([x, y]) => eligible(camp, x, y) && !claimed.has(key(x, y)));
    if (!candidates.length) continue;
    const occupied = candidates.filter(([x, y]) => tileAt(s, x, y));
    const pool = occupied.length ? occupied : candidates;
    const [x, y] = pool[Math.floor(Math.random() * pool.length)];
    camp.target = { x, y };
    claimed.add(key(x, y));
    changed = true;
  }
  return changed;
}

export function spreadBandits(s, now = Date.now()) {
  planBandits(s);
  const cells = Object.values(s.tiles).filter(tile => tile.type === 'banditen' && tile.target)
    .map(tile => [tile.target.x, tile.target.y]);
  const results = replaceWithBandits(s, cells, now);
  planBandits(s);
  return results;
}

export function advanceBandits(s, elapsed, now = Date.now()) {
  s.banditElapsed += Math.max(0, elapsed);
  const captured = [];
  while (s.banditElapsed >= BANDIT_INTERVAL) {
    s.banditElapsed -= BANDIT_INTERVAL;
    captured.push(...spreadBandits(s, now));
    if (!Object.values(s.tiles).some(tile => tile.type === 'banditen')) {
      s.banditElapsed %= BANDIT_INTERVAL;
      break;
    }
  }
  return captured;
}

// Stärke eines Nachbar-Paares.
export function pairValue(a, b) {
  const ga = TILES[a.type].gives?.[b.type] || 0;
  const value = a.type === b.type ? ga : ga + (TILES[b.type].gives?.[a.type] || 0);
  return value * Math.max(tileStrength(a), tileStrength(b));
}

// Nachbarn (8 Felder rundherum), mit denen dieses Tile ein Paar bildet.
export function partnersOf(s, tile) {
  return NEIGHBORS.map(([dx, dy]) => s.tiles[key(tile.x + dx, tile.y + dy)]).filter(o => o && pairValue(tile, o) > 0);
}

export function useJoker(s, x, y, now = Date.now()) {
  const tile = tileAt(s, x, y);
  if (s.hand === 'joker_schutz') {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(s.size, x, y) ||
        tile?.type === 'banditen' || s.protectedFields?.[key(x, y)]) return null;
    if (!s.protectedFields) s.protectedFields = {};
    s.protectedFields[key(x, y)] = true;
    planBandits(s);
    s.hand = null;
    s.handRarity = null;
    return { kind: 'protected', tile, x, y };
  }
  if (!tile || tile.type === 'banditen') return null;
  if (tile.type === 'rathaus' && Object.values(s.tiles).filter(t => t.type === 'rathaus').length <= 1) return null;
  if (s.hand === 'joker_loeschen') {
    if (Object.keys(s.tiles).length <= 1) return null;
    const lostStorage = TILES[tile.type].storage;
    delete s.tiles[key(x, y)];
    const losses = trimStorage(s, lostStorage ? [lostStorage] : []);
    planBandits(s);
    s.hand = null;
    s.handRarity = null;
    return { kind: 'deleted', tile, losses };
  }
  if (s.hand !== 'joker_verwandeln') return null;
  const types = Object.keys(TILES).filter(type => type !== tile.type && type !== 'banditen');
  const newType = types[Math.floor(Math.random() * types.length)];
  const oldType = tile.type;
  tile.type = newType;
  const losses = trimStorage(s, TILES[oldType].storage ? [TILES[oldType].storage] : []);
  const cleared = newType === 'wachturm' ? clearGuardedBandits(s) : 0;
  planBandits(s);
  s.hand = null;
  s.handRarity = null;
  return { kind: 'transformed', tile, oldType, cleared, losses, pairs: partnersOf(s, tile).map(o => ({ tile: o, value: pairValue(tile, o) })) };
}

export const canAfford = (s, cost) => s.gold >= cost;

function suppliersOf(s, tile, chain) {
  return NEIGHBORS.map(([dx, dy]) => s.tiles[key(tile.x + dx, tile.y + dy)]).filter(o => o?.type === chain.supplier);
}

export function tileProduction(s, tile) {
  const base = { holz: 0, korn: 0, gold: 0, werkzeug: 0 };
  const bonus = { holz: 0, korn: 0, gold: 0, werkzeug: 0 };
  const chain = SUPPLY_CHAINS[tile.type];
  if (chain) {
    const suppliers = suppliersOf(s, tile, chain);
    const strength = tileStrength(tile);
    const active = suppliers.length >= MIN_SUPPLIERS;
    if (active) {
      base[chain.resource] = SUPPLIER_OUTPUT * strength * suppliers.length;
      bonus[chain.resource] = suppliers.reduce((sum, o) => sum + tileStrength(o) - 1, 0);
    } else {
      base[chain.resource] = SUPPLIER_OUTPUT * strength * MIN_SUPPLIERS * EMERGENCY_RATE;
    }
    return { base, bonus, supply: { supplier: chain.supplier, count: suppliers.length, required: MIN_SUPPLIERS, active } };
  }
  if (tile.type === 'rathaus') {
    base.gold = TOWN_HALL_OUTPUT.gold;
    base.werkzeug = TOWN_HALL_OUTPUT.werkzeug;
    return { base, bonus };
  }
  for (const other of partnersOf(s, tile)) {
    if (tile.type === 'haus' || tile.type === 'taverne') bonus.gold += pairValue(tile, other);
  }
  return { base, bonus };
}

export function productionClusters(s) {
  const links = new Map();
  const connect = (a, b) => {
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a).add(b);
    links.get(b).add(a);
  };
  for (const tile of Object.values(s.tiles)) {
    const chain = SUPPLY_CHAINS[tile.type];
    if (chain) {
      const suppliers = suppliersOf(s, tile, chain);
      if (suppliers.length >= MIN_SUPPLIERS) for (const supplier of suppliers) connect(tile, supplier);
    } else if (tile.type === 'haus' || tile.type === 'taverne') {
      for (const partner of partnersOf(s, tile)) connect(tile, partner);
    }
  }
  const visited = new Set(), clusters = [];
  for (const tile of links.keys()) {
    if (visited.has(tile)) continue;
    const cluster = [tile];
    visited.add(tile);
    for (let i = 0; i < cluster.length; i++) {
      for (const neighbor of links.get(cluster[i])) {
        if (!visited.has(neighbor)) { visited.add(neighbor); cluster.push(neighbor); }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function productionRates(s) {
  const rates = { holz: 0, korn: 0, gold: 0, werkzeug: 0 };
  for (const tile of Object.values(s.tiles)) {
    const { base, bonus } = tileProduction(s, tile);
    rates.holz += base.holz + bonus.holz;
    rates.korn += base.korn + bonus.korn;
    rates.werkzeug += base.werkzeug + bonus.werkzeug;
    // Gold belongs to a pair, which appears in both tiles' detail views.
    rates.gold += (base.gold + bonus.gold) / (tile.type === 'rathaus' ? 1 : 2);
  }
  return rates;
}

export function storageCapacity(s) {
  const caps = { ...BASE_CAPACITY };
  for (const tile of Object.values(s.tiles)) {
    const resource = TILES[tile.type].storage;
    if (resource) caps[resource] += STORAGE_BONUS * tileStrength(tile);
  }
  return caps;
}

function trimStorage(s, resources) {
  const caps = storageCapacity(s);
  const losses = {};
  for (const id of resources) {
    const current = id === 'gold' ? s.gold : s.resources[id];
    if (current <= caps[id]) continue;
    losses[id] = current - caps[id];
    if (id === 'gold') s.gold = caps[id];
    else s.resources[id] = caps[id];
  }
  return losses;
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
    const caps = storageCapacity(s);
    for (const id of ['holz', 'korn', 'werkzeug']) s.resources[id] = Math.max(s.resources[id], Math.min(caps[id], s.resources[id] + rates[id] * ticks));
    s.gold = Math.max(s.gold, Math.min(caps.gold, s.gold + rates.gold * ticks));
    s.productionAt += ticks * PRODUCTION_INTERVAL;
    changed = true;
  }
  const done = s.crafting.filter(job => job.endsAt <= now);
  if (done.length) {
    for (const job of done) s.packs[job.pack] = (s.packs[job.pack] || 0) + 1;
    s.crafting = s.crafting.filter(job => job.endsAt > now);
    changed = true;
  }
  return changed;
}

export function craftDuration(packId) {
  return packId === 'starthilfe' ? 30000 : PACKS[packId].duration;
}

export const moveStepCost = tile => MOVE_STEP_COST[tileRarity(tile)];
export const canPayMove = (s, cost) => (s.freeMoves || 0) > 0 || s.gold >= cost;

// Kürzeste Wege über freie Felder, ohne belegte Felder zu überqueren.
function freePaths(others, tile, half) {
  const start = { x: tile.x, y: tile.y };
  const paths = new Map([[key(start.x, start.y), [start]]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const [dx, dy] of DIRS4) {
      const x = cur.x + dx, y = cur.y + dy, k = key(x, y);
      if (paths.has(k) || others.has(k) || x < -half || x >= half || y < -half || y >= half) continue;
      paths.set(k, [...paths.get(key(cur.x, cur.y)), { x, y }]);
      queue.push({ x, y });
    }
  }
  return paths;
}

// Ziele für ein Tile: alle über freie Felder erreichbaren Positionen.
export function moveOptions(s, tile) {
  if (!tile || tile.type === 'banditen' || s.tiles[key(tile.x, tile.y)] !== tile) return { moves: [], swaps: [] };
  const all = new Set(Object.keys(s.tiles));
  all.delete(key(tile.x, tile.y));
  const half = s.size / 2;
  const step = moveStepCost(tile);
  const paths = freePaths(all, tile, half);
  const moves = [];
  for (const [cell, path] of paths) {
    const [x, y] = cell.split(',').map(Number);
    if (x === tile.x && y === tile.y) continue;
    const distance = path.length - 1;
    moves.push({ kind: 'move', x, y, distance, path, cost: distance * step, special: isSpecialSlot(s, x, y) });
  }
  const swaps = DIRS4.map(([dx, dy]) => tileAt(s, tile.x + dx, tile.y + dy))
    .filter(other => other && other.type !== 'banditen')
    .map(other => ({ kind: 'swap', x: other.x, y: other.y, tile: other, cost: SWAP_COST }));
  return { moves, swaps };
}

function payMove(s, cost) {
  if ((s.freeMoves || 0) > 0) { s.freeMoves--; return { free: true, cost: 0 }; }
  if (s.gold < cost) return null;
  s.gold -= cost;
  return { free: false, cost };
}

function refundMove(s, record) {
  if (record.free) s.freeMoves = (s.freeMoves || 0) + 1;
  else s.gold += record.cost;
}

function relocate(s, tile, x, y) {
  tile.x = x;
  tile.y = y;
  s.tiles[key(x, y)] = tile;
}

function afterMove(s, moved) {
  const cleared = moved.some(tile => tile.type === 'wachturm') ? clearGuardedBandits(s) : 0;
  planBandits(s);
  return cleared;
}

export function moveTile(s, tile, x, y, now = Date.now()) {
  const option = moveOptions(s, tile).moves.find(move => move.x === x && move.y === y);
  if (!option) return null;
  const payment = payMove(s, option.cost);
  if (!payment) return null;
  const from = { x: tile.x, y: tile.y };
  const oldRarity = tile.rarity;
  delete s.tiles[key(from.x, from.y)];
  relocate(s, tile, x, y);
  if (option.special) {
    tile.rarity = upgradedRarity(tileRarity(tile));
    delete s.specialSlots[key(x, y)];
  }
  const cleared = afterMove(s, [tile]);
  return { kind: 'move', tile, from, to: { x, y }, distance: option.distance, path: option.path, ...payment, special: option.special, oldRarity, cleared,
    pairs: partnersOf(s, tile).map(o => ({ tile: o, value: pairValue(tile, o) })) };
}

export function swapTiles(s, tile, other, now = Date.now()) {
  if (!moveOptions(s, tile).swaps.some(swap => swap.tile === other)) return null;
  const payment = payMove(s, SWAP_COST);
  if (!payment) return null;
  const from = { x: tile.x, y: tile.y }, to = { x: other.x, y: other.y };
  relocate(s, tile, to.x, to.y);
  relocate(s, other, from.x, from.y);
  const cleared = afterMove(s, [tile, other]);
  return { kind: 'swap', tile, other, from, to, ...payment, cleared,
    pairs: partnersOf(s, tile).map(o => ({ tile: o, value: pairValue(tile, o) })) };
}

// Macht einen Zug rückgängig, solange beide Positionen unverändert sind und keine Camps vertrieben wurden.
export function undoMove(s, record, now = Date.now()) {
  if (!record || record.cleared) return false;
  const { from, to } = record;
  const tile = tileAt(s, to.x, to.y);
  if (tile?.id !== record.tile.id) return false;
  if (record.kind === 'swap') {
    const other = tileAt(s, from.x, from.y);
    if (other?.id !== record.other.id) return false;
    relocate(s, tile, from.x, from.y);
    relocate(s, other, to.x, to.y);
  } else {
    if (tileAt(s, from.x, from.y)) return false;
    delete s.tiles[key(to.x, to.y)];
    relocate(s, tile, from.x, from.y);
    if (record.special) {
      if (record.oldRarity === undefined) delete tile.rarity;
      else tile.rarity = record.oldRarity;
      s.specialSlots[key(to.x, to.y)] = true;
    }
  }
  refundMove(s, record);
  planBandits(s);
  return true;
}

const hasCraftSlot = s => s.crafting.length < MAX_CRAFT_JOBS;

export function canStartPack(s, packId) {
  const pack = PACKS[packId];
  return !!(pack && hasCraftSlot(s) &&
    Object.entries(pack.cost).every(([id, amount]) => (id === 'gold' ? s.gold : s.resources[id]) >= amount));
}

// Wie viele Aufträge dieses Packs sich gerade bezahlen und einreihen lassen.
export function maxStartablePacks(s, packId) {
  const pack = PACKS[packId];
  if (!pack) return 0;
  const affordable = Math.min(...Object.entries(pack.cost).map(([id, amount]) => Math.floor((id === 'gold' ? s.gold : s.resources[id]) / amount)));
  return Math.max(0, Math.min(affordable, MAX_CRAFT_JOBS - s.crafting.length));
}

export function startPack(s, packId, now = Date.now()) {
  if (!canStartPack(s, packId)) return false;
  for (const [id, amount] of Object.entries(PACKS[packId].cost)) {
    if (id === 'gold') s.gold -= amount;
    else s.resources[id] -= amount;
  }
  const duration = craftDuration(packId);
  s.crafting.push({ pack: packId, duration, endsAt: now + duration });
  return true;
}

export function canStartRecovery(s) {
  const rates = productionRates(s);
  const cost = PACKS.natur.cost;
  return hasCraftSlot(s) &&
    (!s.hand || JOKERS[s.hand] || HAZARDS[s.hand]) && s.deck.every(id => JOKERS[id] || HAZARDS[id]) && !Object.values(s.packs).some(Boolean) &&
    !s.crafting.length &&
    Object.entries(cost).some(([id, amount]) => s.resources[id] < amount && rates[id] === 0);
}

export function startRecovery(s, now = Date.now()) {
  if (!canStartRecovery(s)) return false;
  const duration = craftDuration('starthilfe');
  s.crafting.push({ pack: 'starthilfe', duration, endsAt: now + duration });
  return true;
}

export function openPack(s, packId) {
  if (!s.packs[packId]) return null;
  if (packId === 'starthilfe') {
    s.packs[packId]--;
    const cards = shuffled(['holzfaeller', 'windmuehle', Math.random() < 0.5 ? 'wald' : 'feld']);
    addCards(s, cards);
    return cards;
  }
  const pack = PACKS[packId];
  if (!pack) throw new Error(`Unbekanntes Pack: ${packId}`);
  packChances(pack);
  const valuePool = Object.entries(pack.weights);
  s.packs[packId]--;
  const drawn = [pickWeighted(valuePool), pickWeighted(valuePool)];
  const third = Math.random();
  if (third < pack.hazardChance) drawn.push('banditen_niete');
  else if (third < pack.hazardChance + pack.extraChance) drawn.push(pickWeighted(valuePool));
  const cards = shuffled(drawn);
  addCards(s, cards);
  return cards;
}
