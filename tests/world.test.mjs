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

test('new worlds contain a workshop, guard, camps and 12 obstacles with connected free space', () => {
  for (let i = 0; i < 30; i++) {
    const state = newState();
    assert.equal(state.size, 8);
    assert.equal(Object.keys(state.tiles).length, 16);
    assert.equal(state.tiles['0,0'].type, 'workshop');
    assert.equal(state.tiles['1,0'].type, 'wachturm');
    for (const [dx, dy] of dirs.filter(([dx, dy]) => dx !== 1 || dy !== 0)) assert.equal(state.tiles[key(dx, dy)], undefined);
    assert.equal(Object.values(state.tiles).filter(t => t.type === 'banditen').length, 2);
    for (const tile of Object.values(state.tiles)) {
      assert.ok(inBounds(8, tile.x, tile.y));
      assert.ok(['gras', 'erde', 'wasser', 'workshop', 'wachturm', 'banditen'].includes(tile.type));
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
  assert.equal(placeHand(state, 2, 0).pairs.length, 1);
  assert.equal(state.gold, gold);
  assert.equal(placeHand(state, 2, 0), null);
});

test('expansion costs gold once and adds 36 obstacles and two camps in new area', () => {
  for (let i = 0; i < 20; i++) {
    const state = newState();
    const original = JSON.stringify(state.tiles);
    state.gold = 29;
    assert.equal(expandWorld(state), false);
    assert.equal(JSON.stringify(state.tiles), original);
    state.gold = 30;
    state.hand = 'wald';
    assert.equal(expandWorld(state), true);
    assert.equal(state.gold, 0);
    assert.equal(state.size, 16);
    assert.equal(state.hand, 'wald');
    const oldTiles = Object.fromEntries(Object.entries(state.tiles).filter(([, t]) => inBounds(8, t.x, t.y)));
    for (const [pos, tile] of Object.entries(JSON.parse(original))) {
      const { target: oldTarget, ...before } = tile;
      const { target: newTarget, ...after } = oldTiles[pos];
      assert.deepEqual(after, before);
    }
    assert.equal(Object.keys(state.tiles).length, 54);
    assert.equal(Object.values(state.tiles).filter(t => t.type === 'banditen' && !inBounds(8, t.x, t.y)).length, 2);
    assertFreeConnected(state, 8);
    assert.equal(expandWorld(state), false);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(state))), JSON.stringify(state));
  }
});
