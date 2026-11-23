import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAND_TYPES, START_DECK, PACKS, PACK_LAND_WEIGHTS } from '../src/config.js';
import { newState, addTile, drawCard, inBounds, placeCells, placeHand, placeRandomLand, expandWorld, returnHand } from '../src/logic.js';

test('new worlds contain only the workshop and guard, with no randomly generated tiles', () => {
  const state = newState();
  assert.equal(state.size, 8);
  assert.deepEqual(Object.values(state.tiles).map(tile => tile.type), ['workshop', 'wachturm']);
  assert.equal(state.tiles['0,0'].type, 'workshop');
  assert.equal(state.tiles['1,0'].type, 'wachturm');
});

test('free placement only allows unoccupied neighboring cells within the world', () => {
  const state = newState();
  state.tiles = {};
  addTile(state, 'feld', 3, 0);
  state.deck = ['windmuehle'];
  assert.equal(drawCard(state), 'windmuehle');
  assert.ok(!placeCells(state).some(([x, y]) => x === 4 && y === 0));
  assert.equal(placeHand(state, 4, 0), null);
  assert.equal(placeHand(state, 3, 0), null);
  assert.equal(placeHand(state, -4, -4), null);
  const gold = state.gold;
  assert.equal(placeHand(state, 2, 0).pairs.length, 1);
  assert.equal(state.gold, gold);
});

test('expansion costs gold once and preserves every existing tile without generating new ones', () => {
  const state = newState();
  const camp = addTile(state, 'banditen', -3, -3);
  camp.target = { x: -3, y: -2 };
  const original = JSON.stringify(state.tiles);
  state.gold = 29;
  assert.equal(expandWorld(state), false);
  state.gold = 30;
  state.hand = 'wald';
  assert.equal(expandWorld(state), true);
  assert.equal(state.gold, 0);
  assert.equal(state.size, 16);
  assert.equal(state.hand, 'wald');
  assert.equal(JSON.stringify(state.tiles), original);
  assert.equal(expandWorld(state), false);
});

test('land cards are placed at a valid random neighboring cell with their rarity', t => {
  const state = newState();
  state.tiles = {};
  addTile(state, 'workshop', 3, 0);
  t.mock.method(Math, 'random', () => 0.99);
  for (const type of LAND_TYPES) {
    state.hand = type;
    state.handRarity = 'epic';
    const valid = placeCells(state).map(cell => cell.join(','));
    const result = placeRandomLand(state);
    assert.ok(valid.includes(`${result.tile.x},${result.tile.y}`));
    assert.ok(inBounds(state.size, result.tile.x, result.tile.y));
    assert.equal(result.tile.type, type);
    assert.equal(result.tile.rarity, 'epic');
    assert.equal(state.hand, null);
  }
  state.hand = 'wald';
  assert.equal(placeRandomLand(state), null);
  assert.equal(state.hand, 'wald');
});

test('a land card with no available neighboring cell can return to the deck unchanged', () => {
  const state = newState();
  state.size = 2;
  state.tiles = {};
  for (const x of [-1, 0]) for (const y of [-1, 0]) addTile(state, 'gras', x, y);
  state.deck = ['gras'];
  state.deckRarities = ['rare'];
  assert.equal(drawCard(state), 'gras');
  assert.equal(placeRandomLand(state), null);
  assert.equal(returnHand(state), true);
  assert.deepEqual(state.deck, ['gras']);
  assert.deepEqual(state.deckRarities, ['rare']);
});

test('mountain cards are available from the start and landscape packs', () => {
  assert.ok(START_DECK.berge > 0);
  assert.ok(PACK_LAND_WEIGHTS.berge > 0);
  for (const pack of Object.values(PACKS)) assert.ok(pack.land > 0);
});
