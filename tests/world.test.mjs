import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, addTile, drawCard, inBounds, placeCells, placeHand, expandWorld } from '../src/logic.js';

const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const key = (x, y) => `${x},${y}`;

function assertFreeConnected(state, oldSize = 0) {
  const cells = new Set();
  for (let x = -state.size / 2; x < state.size / 2; x++) {
    for (let y = -state.size / 2; y < state.size / 2; y++) {
      if ((!oldSize || !inBounds(oldSize, x, y)) && !state.tiles[key(x, y)]) cells.add(key(x, y));
    }
  }
  const queue = [cells.values().next().value];
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i].split(',').map(Number);
    for (const [dx, dy] of dirs) {
      const neighbor = key(x + dx, y + dy);
      if (cells.has(neighbor) && !seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  assert.equal(seen.size, cells.size);
}

test('new worlds contain exactly 12 obstacles, reserve the start, and leave connected space', () => {
  for (let i = 0; i < 30; i++) {
    const state = newState();
    assert.equal(state.size, 8);
    assert.equal(Object.keys(state.tiles).length, 13);
    assert.equal(state.tiles['0,0'].type, 'gras');
    for (const [dx, dy] of dirs) assert.equal(state.tiles[key(dx, dy)], undefined);
    for (const tile of Object.values(state.tiles)) {
      assert.ok(inBounds(8, tile.x, tile.y));
      assert.ok(['gras', 'erde', 'wasser'].includes(tile.type));
    }
    assertFreeConnected(state);
  }
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
  assert.equal(placeHand(state, 2, 0).gold, 2);
  assert.equal(state.gold, gold + 2);
  assert.equal(placeHand(state, 2, 0), null);
});

test('expansion costs gold once and adds exactly 36 obstacles in new area', () => {
  for (let i = 0; i < 20; i++) {
    const state = newState();
    const original = JSON.stringify(state.tiles);
    assert.equal(expandWorld(state), false);
    assert.equal(JSON.stringify(state.tiles), original);
    state.gold = 30;
    state.hand = 'wald';
    assert.equal(expandWorld(state), true);
    assert.equal(state.gold, 0);
    assert.equal(state.size, 16);
    assert.equal(state.hand, 'wald');
    const oldTiles = Object.fromEntries(Object.entries(state.tiles).filter(([, t]) => inBounds(8, t.x, t.y)));
    assert.deepEqual(oldTiles, JSON.parse(original));
    assert.equal(Object.keys(state.tiles).length, 49);
    assertFreeConnected(state, 8);
    assert.equal(expandWorld(state), false);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(state))), JSON.stringify(state));
  }
});
