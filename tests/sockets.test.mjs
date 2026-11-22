import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, addTile, drawCard, placeCells, placeHand, migrateSockets, returnBlockedCard } from '../src/logic.js';

const fixedSockets = ['landschaft', 'industrie', 'landschaft', 'zukunft'];

test('all cards, including former world tiles, are drawn into the hand', () => {
  const state = newState();
  state.deck = ['wasser', 'windmuehle'];
  assert.equal(drawCard(state), 'wasser');
  assert.equal(state.hand, 'wasser');
  assert.equal(Object.keys(state.tiles).length, 1);
  assert.equal(drawCard(state), null);
});

test('targets use the existing tile socket and reject occupied or mismatched sides', () => {
  const state = newState();
  state.tiles['0,0'].sockets = [...fixedSockets];
  assert.deepEqual(placeCells(state, 'feld'), [[0, -1], [0, 1]]);
  assert.deepEqual(placeCells(state, 'windmuehle'), [[1, 0]]);
  state.hand = 'windmuehle';
  assert.equal(placeHand(state, 0, -1), null);
  assert.equal(placeHand(state, 0, 0), null);
  assert.equal(state.hand, 'windmuehle');
  assert.equal(placeHand(state, 1, 0).tile.type, 'windmuehle');
  assert.equal(state.hand, null);
  assert.ok(!placeCells(state, 'windmuehle').some(([x, y]) => x === 1 && y === 0));
});

test('a single matching socket suffices and existing gold bonuses still pay once', () => {
  const state = newState();
  state.tiles['0,0'].sockets = [...fixedSockets];
  addTile(state, 'feld', 1, -1);
  state.hand = 'windmuehle';
  const before = state.gold;
  const result = placeHand(state, 1, 0);
  assert.equal(result.gold, 2);
  assert.equal(state.gold, before + 2);
  assert.equal(placeHand(state, 1, 0), null);
  assert.equal(state.gold, before + 2);
});

test('tiles receive independently shuffled socket positions', (t) => {
  const state = newState();
  const random = t.mock.method(Math, 'random', () => 0);
  const a = addTile(state, 'gras', 1, 0);
  random.mock.mockImplementation(() => 0.999);
  const b = addTile(state, 'gras', 2, 0);
  assert.notDeepEqual(a.sockets, b.sockets);
  assert.deepEqual([...a.sockets].sort(), [...fixedSockets].sort());
  assert.deepEqual([...b.sockets].sort(), [...fixedSockets].sort());
});

test('old saves gain sockets once and keep them after reload', () => {
  const state = newState();
  delete state.tiles['0,0'].sockets;
  assert.equal(migrateSockets(state), true);
  const reloaded = JSON.parse(JSON.stringify(state));
  assert.equal(migrateSockets(reloaded), false);
  assert.deepEqual(reloaded.tiles['0,0'].sockets, state.tiles['0,0'].sockets);
});

test('blocked card goes to the back without changing gold or losing cards', () => {
  const state = newState();
  state.tiles['0,0'].sockets = [...fixedSockets];
  const other = addTile(state, 'gras', 1, 0);
  other.sockets = ['landschaft', 'zukunft', 'landschaft', 'industrie'];
  state.hand = 'windmuehle';
  state.deck = ['wald', 'feld'];
  assert.deepEqual(placeCells(state, state.hand), []);
  const gold = state.gold;
  assert.equal(returnBlockedCard(state), true);
  assert.deepEqual(state.deck, ['wald', 'feld', 'windmuehle']);
  assert.equal(state.hand, null);
  assert.equal(state.gold, gold);
  assert.equal(drawCard(state), 'wald');
  assert.equal(returnBlockedCard(state), false);
});
