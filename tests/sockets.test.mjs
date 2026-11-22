import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, addTile, drawCard, placeCells, placeHand } from '../src/logic.js';

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
  addTile(state, 'feld', 1, -1);
  state.hand = 'windmuehle';
  const before = state.gold;
  const result = placeHand(state, 1, 0);
  assert.equal(result.gold, 2);
  assert.equal(state.gold, before + 2);
  assert.equal(placeHand(state, 1, 0), null);
  assert.equal(state.gold, before + 2);
});

test('both categories have an available socket even on a compact board', () => {
  const state = newState();
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) {
    if (x || y) addTile(state, 'gras', x, y);
  }
  assert.ok(placeCells(state, 'feld').length);
  assert.ok(placeCells(state, 'holzfaeller').length);
});
