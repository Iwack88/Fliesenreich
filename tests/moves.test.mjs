import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTile, drawCard, moveOptions, moveTile, newState, swapTiles, undoMove } from '../src/logic.js';

function world() {
  const s = newState();
  s.tiles = {};
  s.specialSlots = {};
  s.gold = 300;
  return s;
}

test('moves may leave gaps or split clusters and cost per field by rarity', () => {
  const s = world();
  const a = addTile(s, 'windmuehle', 0, 0);
  addTile(s, 'feld', 1, 0);
  addTile(s, 'feld', 2, 0);
  const { moves, swaps } = moveOptions(s, a);
  assert.equal(moves.find(m => m.x === -2 && m.y === 0).cost, 20);
  assert.equal(moves.find(m => m.x === 3 && m.y === 0).cost, 50);
  assert.equal(moves.find(m => m.x === 2 && m.y === 1).cost, 30);
  assert.deepEqual(swaps.map(swap => swap.tile.x), [1]);
  a.rarity = 'epic';
  assert.equal(moveOptions(s, a).moves.find(m => m.x === 3 && m.y === 0).cost, 150);
  const middle = s.tiles['1,0'];
  assert.ok(moveOptions(s, middle).moves.some(m => m.x === 1 && m.y === 1), 'moving the bridge may split the map');
  assert.ok(moveTile(s, middle, 1, 1));
});

test('moving pays gold, uses special slots once and can be undone with a refund', () => {
  const s = world();
  const a = addTile(s, 'windmuehle', 0, 0, 'uncommon');
  addTile(s, 'feld', 1, 0);
  s.specialSlots = { '2,0': true };
  assert.equal(moveTile(s, a, 5, 5), null);
  const record = moveTile(s, a, 2, 0);
  assert.equal(record.cost, 60);
  assert.equal(s.gold, 240);
  assert.equal(a.rarity, 'rare');
  assert.equal(s.tiles['2,0'], a);
  assert.equal(s.tiles['0,0'], undefined);
  assert.deepEqual(s.specialSlots, {});
  assert.equal(undoMove(s, record), true);
  assert.equal(s.gold, 300);
  assert.equal(a.rarity, 'uncommon');
  assert.equal(s.tiles['0,0'], a);
  assert.ok(s.specialSlots['2,0']);
  assert.equal(undoMove(s, record), false);
  s.gold = 9;
  assert.equal(moveTile(s, a, 0, 1), null);
  assert.equal(s.tiles['0,0'], a);
});

test('swapping neighbours costs 50 gold, free moves are used first and banditen stay put', () => {
  const s = world();
  const a = addTile(s, 'werkzeugschmiede', 0, 0);
  const b = addTile(s, 'haus', 1, 0);
  const camp = addTile(s, 'banditen', 0, 3);
  assert.deepEqual(moveOptions(s, camp), { moves: [], swaps: [] });
  assert.ok(!moveOptions(s, a).swaps.some(swap => swap.tile === camp));
  const record = swapTiles(s, a, b);
  assert.equal(s.gold, 250);
  assert.equal(s.tiles['1,0'], a);
  assert.equal(s.tiles['0,0'], b);
  s.deck = ['joker_freizug'];
  s.deckRarities = ['rare'];
  assert.equal(drawCard(s), 'joker_freizug');
  assert.equal(s.hand, null);
  assert.equal(s.freeMoves, 5);
  const free = swapTiles(s, a, b);
  assert.equal(free.free, true);
  assert.equal(s.gold, 250);
  assert.equal(s.freeMoves, 4);
  assert.equal(undoMove(s, free), true);
  assert.equal(s.freeMoves, 5);
  assert.equal(undoMove(s, record), true);
  assert.equal(s.gold, 300);
  assert.equal(s.tiles['0,0'], a);
});

test('tiles take the shortest free path and never cross occupied fields', () => {
  const s = world();
  const a = addTile(s, 'windmuehle', 0, 0);
  addTile(s, 'feld', 1, 0);
  addTile(s, 'feld', 2, 0);
  const { moves } = moveOptions(s, a);
  const around = moves.find(m => m.x === 3 && m.y === 0);
  assert.equal(around.distance, 5, 'detour around the row instead of jumping over it');
  assert.ok(around.path.every(p => !s.tiles[`${p.x},${p.y}`] || s.tiles[`${p.x},${p.y}`] === a));
  assert.equal(moves.find(m => m.x === 2 && m.y === 1).distance, 3);
  assert.equal(moveTile(s, a, 3, 0).cost, 50);
});

test('an isolated tile can travel across empty fields and undo the move', () => {
  const s = world();
  const tile = addTile(s, 'wald', -3, -3);
  addTile(s, 'haus', 2, 2);
  const option = moveOptions(s, tile).moves.find(m => m.x === 0 && m.y === -1);
  assert.equal(option.distance, 5);
  assert.equal(option.cost, 50);
  assert.deepEqual(option.path[0], { x: -3, y: -3 });
  assert.deepEqual(option.path.at(-1), { x: 0, y: -1 });
  const record = moveTile(s, tile, 0, -1);
  assert.equal(s.gold, 250);
  assert.equal(s.tiles['0,-1'], tile);
  assert.equal(undoMove(s, record), true);
  assert.equal(s.gold, 300);
  assert.equal(s.tiles['-3,-3'], tile);
});

test('impassable barriers and board boundaries restrict moves, but swaps remain available', () => {
  const s = world();
  const tile = addTile(s, 'haus', 0, 0);
  for (let y = -4; y < 4; y++) addTile(s, 'gras', 1, y);
  const { moves, swaps } = moveOptions(s, tile);
  assert.ok(moves.some(m => m.x === -4 && m.y === -4));
  assert.ok(!moves.some(m => m.x >= 1));
  assert.ok(moves.every(m => m.x >= -4 && m.y >= -4 && m.y < 4));
  assert.equal(moveTile(s, tile, 2, 0), null);
  assert.ok(swaps.some(m => m.x === 1 && m.y === 0));
});
