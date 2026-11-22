import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES, START_DECK } from '../src/config.js';
import { addTile, drawCard, newState, placeHand, useJoker } from '../src/logic.js';

test('new games have one of each joker and drawing preserves them', () => {
  const state = newState();
  for (const id of ['joker_loeschen', 'joker_verwandeln']) {
    assert.equal(START_DECK[id], 1);
    assert.equal(state.deck.filter(card => card === id).length, 1);
  }
  state.deck = ['joker_loeschen'];
  assert.equal(drawCard(state), 'joker_loeschen');
  assert.equal(placeHand(state, 1, 0), null);
});

test('delete joker consumes itself only on an existing tile, and protects the last tile', () => {
  const state = { gold: 12, size: 8, tiles: {}, nextId: 1, hand: 'joker_loeschen' };
  addTile(state, 'gras', 0, 0);
  assert.equal(useJoker(state, 0, 0), null);
  addTile(state, 'haus', 1, 0);
  assert.equal(useJoker(state, 2, 0), null);
  assert.equal(state.hand, 'joker_loeschen');
  assert.equal(useJoker(state, 0, 0).kind, 'deleted');
  assert.equal(state.tiles['0,0'], undefined);
  assert.equal(state.tiles['1,0'].type, 'haus');
  assert.equal(state.hand, null);
  assert.equal(state.gold, 12);
});

test('transformation can select every other tile type, never a joker or the old type', (t) => {
  const types = Object.keys(TILES).filter(type => type !== 'gras');
  let value = 0;
  t.mock.method(Math, 'random', () => value);
  for (let i = 0; i < types.length; i++) {
    value = (i + 0.5) / types.length;
    const state = { gold: 0, tiles: {}, nextId: 1, hand: 'joker_verwandeln' };
    const tile = addTile(state, 'gras', 0, 0);
    const result = useJoker(state, 0, 0);
    assert.equal(result.oldType, 'gras');
    assert.equal(result.tile, tile);
    assert.equal(tile.type, types[i]);
    assert.equal(state.hand, null);
  }
});

test('transformation pays only newly added bonus values, including diagonal neighbors', (t) => {
  const state = { gold: 3, tiles: {}, nextId: 1, hand: 'joker_verwandeln' };
  const tile = addTile(state, 'haus', 0, 0);
  const house = addTile(state, 'haus', 1, 1);
  const pool = Object.keys(TILES).filter(type => type !== 'haus');
  t.mock.method(Math, 'random', () => (pool.indexOf('taverne') + 0.5) / pool.length);
  const result = useJoker(state, 0, 0);
  assert.equal(result.gold, 1);
  assert.equal(state.gold, 4);
  assert.equal(tile.earned, 1);
  assert.equal(house.earned, 1);
  assert.deepEqual(result.pairs, [{ tile: house, value: 1 }]);
  assert.equal(useJoker(state, 0, 0), null);
});

test('transformation keeps the card on an empty target and never deducts lost bonuses', (t) => {
  const state = { gold: 7, tiles: {}, nextId: 1, hand: 'joker_verwandeln' };
  const tile = addTile(state, 'taverne', 0, 0);
  const house = addTile(state, 'haus', 1, 0);
  tile.earned = 2;
  house.earned = 2;
  assert.equal(useJoker(state, 2, 0), null);
  assert.equal(state.hand, 'joker_verwandeln');
  const pool = Object.keys(TILES).filter(type => type !== 'taverne');
  t.mock.method(Math, 'random', () => (pool.indexOf('haus') + 0.5) / pool.length);
  const result = useJoker(state, 0, 0);
  assert.equal(result.gold, 0);
  assert.deepEqual(result.pairs, []);
  assert.equal(state.gold, 7);
  assert.equal(tile.earned, 2);
  assert.equal(house.earned, 2);
});
