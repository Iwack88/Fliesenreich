import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAND_TYPES, START_DECK, START_LAND_TILES, EXPANSION_LAND_TILES, PLACEMENT_SHARE } from '../src/config.js';
import { newState, addTile, availablePlacementSlots, drawCard, inBounds, placeCells, placeHand, expandWorld, returnHand, migrateState, shuffleDeck } from '../src/logic.js';

test('new worlds spawn random landscape anywhere without replacing start buildings', t => {
  let seed = 42;
  t.mock.method(Math, 'random', () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
  const state = newState();
  assert.equal(state.size, 8);
  const land = Object.values(state.tiles).filter(tile => LAND_TYPES.includes(tile.type));
  assert.equal(land.length, START_LAND_TILES);
  assert.equal(Object.keys(state.tiles).length, START_LAND_TILES + 2);
  assert.ok(land.every(tile => inBounds(state.size, tile.x, tile.y)));
  assert.ok(land.every(tile => !state.specialSlots[`${tile.x},${tile.y}`]));
  assert.ok(land.some(tile => ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => state.tiles[`${tile.x + dx},${tile.y + dy}`])));
  assert.equal(state.tiles['0,0'].type, 'rathaus');
  assert.equal(state.tiles['1,0'].type, 'wachturm');
});

test('placement accepts only selected free cells within the world', () => {
  const state = newState();
  state.tiles = {};
  addTile(state, 'feld', 3, 0);
  state.deck = ['windmuehle'];
  assert.equal(drawCard(state), 'windmuehle');
  assert.ok(!placeCells(state).some(([x, y]) => x === 4 && y === 0));
  assert.equal(placeHand(state, 4, 0), null);
  assert.equal(placeHand(state, 3, 0), null);
  const unavailable = placeCells(state).find(([x, y]) => !state.handPlacementSlots.some(([a, b]) => a === x && b === y));
  assert.equal(placeHand(state, ...unavailable), null);
  const gold = state.gold;
  const [x, y] = availablePlacementSlots(state)[0];
  assert.ok(placeHand(state, x, y));
  assert.equal(state.gold, gold);
});

test('expansion costs gold once and adds landscape only in the new area', () => {
  const state = newState();
  const camp = addTile(state, 'banditen', -3, -3);
  camp.target = { x: -3, y: -2 };
  const original = structuredClone(state.tiles);
  state.gold = 29;
  assert.equal(expandWorld(state), false);
  state.gold = 30;
  state.hand = 'wald';
  assert.equal(expandWorld(state), true);
  assert.equal(state.gold, 0);
  assert.equal(state.size, 16);
  assert.equal(state.hand, 'wald');
  for (const [key, tile] of Object.entries(original)) assert.deepEqual(state.tiles[key], tile);
  const added = Object.entries(state.tiles).filter(([key]) => !original[key]).map(([, tile]) => tile);
  assert.equal(added.length, EXPANSION_LAND_TILES);
  assert.ok(added.every(tile => LAND_TYPES.includes(tile.type) && !inBounds(8, tile.x, tile.y) && inBounds(16, tile.x, tile.y)));
  assert.ok(added.every(tile => !state.specialSlots[`${tile.x},${tile.y}`]));
  assert.equal(expandWorld(state), false);
});

test('rarity determines the number of randomly selected free cells, with at least one', () => {
  for (const [rarity, share] of Object.entries(PLACEMENT_SHARE)) {
    const state = newState();
    state.tiles = {};
    addTile(state, 'haus', 0, 0);
    state.deck = ['wald'];
    state.deckRarities = [rarity];
    drawCard(state);
    const slots = availablePlacementSlots(state);
    assert.equal(slots.length, Math.ceil(63 * share));
    assert.equal(new Set(slots.map(cell => cell.join(','))).size, slots.length);
    assert.ok(slots.every(([x, y]) => inBounds(8, x, y) && !state.tiles[`${x},${y}`]));
    assert.ok(slots.some(([x, y]) => Math.abs(x) > 1 || Math.abs(y) > 1));
  }
  const state = newState();
  state.size = 2;
  state.tiles = {};
  for (const [x, y] of [[-1, -1], [0, -1], [-1, 0]]) addTile(state, 'gras', x, y);
  state.deck = ['wald'];
  state.deckRarities = ['common'];
  drawCard(state);
  assert.deepEqual(availablePlacementSlots(state), [[0, 0]]);
});

test('a card with no free cells can return and select slots when space is available', () => {
  const state = newState();
  state.size = 2;
  state.tiles = {};
  for (const x of [-1, 0]) for (const y of [-1, 0]) addTile(state, 'gras', x, y);
  state.deck = ['gras'];
  state.deckRarities = ['rare'];
  assert.equal(drawCard(state), 'gras');
  assert.deepEqual(availablePlacementSlots(state), []);
  assert.equal(returnHand(state), true);
  assert.deepEqual(state.deck, ['gras']);
  assert.deepEqual(state.deckRarities, ['rare']);
  delete state.tiles['0,0'];
  drawCard(state);
  assert.deepEqual(availablePlacementSlots(state), [[0, 0]]);
});

test('starting decks do not contain landscape cards', () => {
  for (const type of LAND_TYPES) assert.equal(START_DECK[type], undefined);
});

test('special slots avoid the start area and raise placed card rarity once', () => {
  const state = newState();
  const slots = Object.keys(state.specialSlots);
  assert.ok(slots.length > 0);
  for (const slot of slots) {
    const [x, y] = slot.split(',').map(Number);
    assert.ok(Math.max(Math.abs(x), Math.abs(y)) > 2 || Math.max(Math.abs(x - 1), Math.abs(y)) > 2);
  }
  state.tiles = {};
  state.specialSlots = { '3,1': true };
  addTile(state, 'gras', 3, 0);
  state.hand = 'windmuehle';
  state.handRarity = 'rare';
  state.handPlacementSlots = [[3, 1]];
  const result = placeHand(state, 3, 1);
  assert.equal(result.special, true);
  assert.equal(result.tile.rarity, 'epic');
  assert.deepEqual(state.specialSlots, {});
});

test('chosen fields survive reload, rejected placements, returning and shuffling', () => {
  const s = newState();
  s.deck = ['haus', 'feld'];
  s.deckRarities = ['common', 'rare'];
  s.deckPlacementSlots = [null, null];
  drawCard(s);
  const chosen = structuredClone(s.handPlacementSlots);
  assert.equal(placeHand(s, 100, 100), null);
  const loaded = JSON.parse(JSON.stringify(s));
  migrateState(loaded);
  assert.deepEqual(loaded.handPlacementSlots, chosen);
  assert.equal(returnHand(loaded), true);
  assert.equal(shuffleDeck(loaded), true);
  while (loaded.deck[0] !== 'haus') {
    drawCard(loaded);
    returnHand(loaded);
  }
  drawCard(loaded);
  assert.deepEqual(loaded.handPlacementSlots, chosen);
  const [x, y] = chosen[0];
  addTile(loaded, 'banditen', x, y);
  assert.equal(placeHand(loaded, x, y), null);
  assert.deepEqual(loaded.handPlacementSlots, chosen);
});

test('older saves with a tile in hand receive one persistent set of choices', () => {
  const s = newState();
  s.hand = 'wald';
  s.handRarity = 'rare';
  delete s.handPlacementSlots;
  delete s.deckPlacementSlots;
  assert.equal(migrateState(s), true);
  const chosen = structuredClone(s.handPlacementSlots);
  assert.equal(chosen.length, Math.ceil(placeCells(s).length * PLACEMENT_SHARE.rare));
  assert.equal(migrateState(s), false);
  assert.deepEqual(s.handPlacementSlots, chosen);
});

test('expanding adds special slots only in the new area', () => {
  const state = newState();
  const before = { ...state.specialSlots };
  state.gold = 100;
  assert.equal(expandWorld(state), true);
  const added = Object.keys(state.specialSlots).filter(slot => !before[slot]);
  assert.ok(added.length > 0);
  for (const slot of added) assert.ok(!inBounds(8, ...slot.split(',').map(Number)));
});
