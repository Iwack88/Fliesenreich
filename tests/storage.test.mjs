import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../src/config.js';
import { addTile, migrateState, newState, placeHand, spawnBandit, spreadBandits, storageCapacity, updateProduction, useJoker, workshopDuration } from '../src/logic.js';

test('storage buildings add 50 only to their own resource and production respects each cap', () => {
  const s = newState();
  const workshop = s.tiles['0,0'];
  s.tiles = { '0,0': workshop };
  s.productionAt = 0;
  s.resources = { holz: 149, korn: 149 };
  s.gold = 349;
  addTile(s, 'lagerhalle', 1, 0);
  addTile(s, 'kornlager', 2, 0);
  addTile(s, 'goldlager', 3, 0);
  addTile(s, 'holzfaeller', 0, 2);
  addTile(s, 'windmuehle', 1, 2);
  addTile(s, 'haus', 2, 2);
  addTile(s, 'haus', 3, 2);
  assert.deepEqual(storageCapacity(s), { gold: 350, holz: 150, korn: 150 });
  assert.equal(workshopDuration(s, workshop, 'natur'), 240000);
  updateProduction(s, 100000);
  assert.deepEqual(s.resources, { holz: 150, korn: 150 });
  assert.equal(s.gold, 350);
});

test('storage loss by delete and transform immediately discards only excess of affected resource', (t) => {
  const s = newState();
  s.tiles = {};
  s.resources = { holz: 145, korn: 145 };
  s.gold = 345;
  addTile(s, 'lagerhalle', 0, 0);
  addTile(s, 'kornlager', 1, 0);
  addTile(s, 'goldlager', 2, 0);
  addTile(s, 'gras', 3, 0);
  s.hand = 'joker_loeschen';
  assert.deepEqual(useJoker(s, 0, 0).losses, { holz: 45 });
  assert.deepEqual(s.resources, { holz: 100, korn: 145 });
  const pool = Object.keys(TILES).filter(type => type !== 'kornlager' && type !== 'banditen');
  t.mock.method(Math, 'random', () => (pool.indexOf('goldlager') + 0.5) / pool.length);
  s.hand = 'joker_verwandeln';
  assert.deepEqual(useJoker(s, 1, 0).losses, { korn: 45 });
  assert.deepEqual(storageCapacity(s), { gold: 400, holz: 100, korn: 100 });
  assert.equal(s.gold, 345);
  s.hand = 'joker_loeschen';
  assert.deepEqual(useJoker(s, 2, 0).losses, {});
  assert.equal(s.gold, 345);
  s.hand = 'joker_loeschen';
  assert.deepEqual(useJoker(s, 1, 0).losses, { gold: 45 });
  assert.equal(s.gold, 300);
});

test('bandit attacks and bandit cards trim destroyed storage immediately', () => {
  const s = newState();
  s.tiles = {};
  s.resources = { holz: 145, korn: 140 };
  s.gold = 100;
  const camp = addTile(s, 'banditen', 0, 0);
  addTile(s, 'lagerhalle', 1, 0);
  camp.target = { x: 1, y: 0 };
  assert.deepEqual(spreadBandits(s)[0].losses, { holz: 45 });
  assert.equal(s.resources.holz, 100);
  s.size = 2;
  s.tiles = {};
  addTile(s, 'kornlager', -1, -1);
  for (const [x, y] of [[0, -1], [-1, 0], [0, 0]]) addTile(s, 'banditen', x, y);
  s.hand = 'banditen_niete';
  assert.deepEqual(spawnBandit(s).losses, { korn: 40 });
  assert.equal(s.resources.korn, 100);
});

test('old warehouses become wood storage and existing excess gold and active jobs are preserved', () => {
  const s = newState();
  const workshop = s.tiles['0,0'];
  s.tiles = { '0,0': workshop };
  addTile(s, 'lagerhalle', 1, 0);
  workshop.job = { pack: 'natur', duration: 24000, endsAt: 24000 };
  s.gold = 450;
  s.productionAt = 0;
  const loaded = JSON.parse(JSON.stringify(s));
  migrateState(loaded, 1000);
  assert.equal(loaded.gold, 450);
  assert.deepEqual(loaded.tiles['0,0'].job, { pack: 'natur', duration: 24000, endsAt: 24000 });
  assert.equal(storageCapacity(loaded).holz, 150);
  updateProduction(loaded, 10000);
  assert.equal(loaded.gold, 450);
  loaded.gold = 299;
  addTile(loaded, 'haus', 2, 0);
  addTile(loaded, 'haus', 3, 0);
  updateProduction(loaded, 20000);
  assert.equal(loaded.gold, 300);
});

test('new forges adjust old in-progress jobs proportionally without replacing their original duration', () => {
  const s = newState();
  const workshop = s.tiles['0,0'];
  s.tiles = { '0,0': workshop };
  workshop.job = { pack: 'natur', duration: 24000, endsAt: 24000 };
  s.hand = 'werkzeugschmiede';
  placeHand(s, 1, 0, 12000);
  assert.equal(workshop.job.duration, 19200);
  assert.equal(workshop.job.endsAt, 21600);
});
