import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTile, drawCard, moveOptions, moveTile, newState, startPack, swapTiles, undoMove } from '../src/logic.js';

function world() {
  const s = newState();
  s.tiles = {};
  s.specialSlots = {};
  s.gold = 300;
  return s;
}

test('move targets stay adjacent, keep the map connected and cost per field by rarity', () => {
  const s = world();
  const a = addTile(s, 'windmuehle', 0, 0);
  addTile(s, 'feld', 1, 0);
  addTile(s, 'feld', 2, 0);
  const { moves, swaps } = moveOptions(s, a);
  assert.ok(moves.every(m => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => s.tiles[`${m.x + dx},${m.y + dy}`] && s.tiles[`${m.x + dx},${m.y + dy}`] !== a)));
  assert.equal(moves.find(m => m.x === 3 && m.y === 0).cost, 30);
  assert.equal(moves.find(m => m.x === 2 && m.y === 1).cost, 30);
  assert.deepEqual(swaps.map(swap => swap.tile.x), [1]);
  const middle = s.tiles['1,0'];
  assert.ok(!moveOptions(s, middle).moves.some(m => m.x === 1 && m.y === 1), 'moving the bridge must not split the map');
  a.rarity = 'epic';
  assert.equal(moveOptions(s, a).moves.find(m => m.x === 3 && m.y === 0).cost, 90);
});

test('moving pays gold, uses special slots once and can be undone with a refund', () => {
  const s = world();
  const a = addTile(s, 'windmuehle', 0, 0, 'uncommon');
  addTile(s, 'feld', 1, 0);
  s.specialSlots = { '2,0': true };
  assert.equal(moveTile(s, a, 5, 5), null);
  const record = moveTile(s, a, 2, 0);
  assert.equal(record.cost, 30);
  assert.equal(s.gold, 270);
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
  const camp = addTile(s, 'banditen', 0, 1);
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

test('moving a forge away from a workshop slows its running job', () => {
  const s = world();
  s.resources = { holz: 100, korn: 100 };
  const workshop = addTile(s, 'workshop', 0, 0);
  const forge = addTile(s, 'werkzeugschmiede', 1, 0);
  for (const x of [0, 1, 2]) addTile(s, 'gras', x, 1);
  assert.equal(startPack(s, workshop, 'natur', 0), true);
  assert.equal(workshop.job.endsAt, 192000);
  assert.ok(moveTile(s, forge, 3, 1, 96000));
  assert.equal(workshop.job.endsAt, 216000);
});
