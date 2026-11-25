import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTile, placeHand, productionClusters, productionRates, tileProduction, updateProduction } from '../src/logic.js';

function placeNextTo(first, second, diagonal = false) {
  const state = { gold: 0, size: 8, tiles: {}, nextId: 1, hand: second };
  state.handPlacementSlots = [[1, diagonal ? 1 : 0]];
  addTile(state, first, 0, 0);
  if (diagonal) addTile(state, 'gras', 1, 0);
  const result = placeHand(state, 1, diagonal ? 1 : 0);
  return { state, result };
}

test('houses never produce gold beside other houses', () => {
  const { state, result } = placeNextTo('haus', 'haus');
  assert.equal(result.pairs.length, 0);
  assert.equal(productionRates(state).gold, 0);
  assert.deepEqual(productionClusters(state), []);
  assert.equal(state.gold, 0);
  assert.equal(placeHand(state, 1, 0), null);
  assert.equal(state.gold, 0);
});

test('taverns need two houses, count diagonals and stop producing when a house is lost', () => {
  for (const [first, second] of [['haus', 'taverne'], ['taverne', 'haus']]) {
    for (const diagonal of [false, true]) {
      const { state, result } = placeNextTo(first, second, diagonal);
      assert.equal(result.pairs.length, 1);
      assert.equal(productionRates(state).gold, 0);
      assert.deepEqual(productionClusters(state), []);
      assert.equal(state.gold, 0);
      const tavern = Object.values(state.tiles).find(tile => tile.type === 'taverne');
      const house = addTile(state, 'haus', 0, 1);
      assert.equal(productionRates(state).gold, 4);
      assert.equal(tileProduction(state, house).base.gold, 0);
      assert.equal(tileProduction(state, tavern).supply.active, true);
      assert.equal(productionClusters(state)[0].resource, 'gold');
      assert.equal(productionClusters(state)[0].tiles.length, 3);
      delete state.tiles['0,1'];
      assert.equal(productionRates(state).gold, 0);
    }
  }
  assert.equal(productionRates(placeNextTo('taverne', 'taverne').state).gold, 0);
});

test('shared houses supply each tavern independently and offline gold is counted once', () => {
  const state = { gold: 0, resources: { holz: 0, korn: 0, werkzeug: 0, forschung: 0 }, crafting: [], productionAt: 1000, tiles: {}, nextId: 1 };
  addTile(state, 'taverne', 0, 0);
  addTile(state, 'taverne', 2, 0);
  addTile(state, 'haus', 1, 0);
  addTile(state, 'haus', 1, 1);
  assert.equal(productionRates(state).gold, 8);
  updateProduction(state, 31000);
  assert.equal(state.gold, 24);
  assert.equal(productionClusters(state).length, 1);
});
