import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTile, placeHand } from '../src/logic.js';

function placeNextTo(first, second, diagonal = false) {
  const state = { gold: 0, size: 8, tiles: {}, nextId: 1, hand: second };
  addTile(state, first, 0, 0);
  if (diagonal) addTile(state, 'gras', 1, 0);
  const result = placeHand(state, 1, diagonal ? 1 : 0);
  return { state, result };
}

test('houses pay once for each house pair', () => {
  const { state, result } = placeNextTo('haus', 'haus');
  assert.equal(result.gold, 1);
  assert.equal(state.gold, 1);
  assert.equal(placeHand(state, 1, 0), null);
  assert.equal(state.gold, 1);
});

test('house and tavern pay 2 regardless of order, including diagonals', () => {
  for (const [first, second] of [['haus', 'taverne'], ['taverne', 'haus']]) {
    for (const diagonal of [false, true]) {
      const { state, result } = placeNextTo(first, second, diagonal);
      assert.equal(result.gold, 2);
      assert.equal(state.gold, 2);
    }
  }
  assert.equal(placeNextTo('taverne', 'taverne').result.gold, 0);
});
