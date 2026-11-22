import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTile, newState, migrateState, productionRates, updateProduction, startPack, workshopDuration, openPack, canStartRecovery, startRecovery, useJoker } from '../src/logic.js';

test('production uses adjacent buffs, counts gold pairs once and caps resources', () => {
  const s = newState();
  s.tiles = {};
  s.productionAt = 1000;
  s.resources = { holz: 98, korn: 0 };
  s.gold = 0;
  addTile(s, 'wald', 0, 0);
  addTile(s, 'holzfaeller', 1, 1);
  addTile(s, 'feld', 4, 0);
  addTile(s, 'windmuehle', 5, 0);
  addTile(s, 'haus', 0, 4);
  addTile(s, 'haus', 1, 4);
  addTile(s, 'taverne', 2, 4);
  assert.deepEqual(productionRates(s), { holz: 3, korn: 3, gold: 3 });
  assert.equal(updateProduction(s, 30999), true);
  assert.deepEqual(s.resources, { holz: 100, korn: 6 });
  assert.equal(s.gold, 6);
  assert.equal(s.productionAt, 21000);
  assert.equal(updateProduction(s, 30999), false);
  updateProduction(s, 31000);
  assert.equal(s.gold, 9);
});

test('workshops spend resources once, gain warehouse speed, and deliver packs offline', () => {
  const s = newState();
  s.productionAt = 1000;
  const w = s.tiles['0,0'];
  addTile(s, 'lagerhalle', 1, 1);
  assert.equal(workshopDuration(s, w, 'natur'), 24000);
  assert.equal(startPack(s, w, 'natur', 1000), true);
  assert.deepEqual(s.resources, { holz: 5, korn: 6 });
  assert.equal(startPack(s, w, 'natur', 1000), false);
  assert.equal(updateProduction(s, 24999), true);
  assert.equal(s.packs.natur, undefined);
  assert.equal(updateProduction(s, 25000), true);
  assert.equal(s.packs.natur, 1);
  assert.equal(w.job, undefined);
  updateProduction(s, 35000);
  assert.equal(s.packs.natur, 1);
  const before = s.deck.length;
  assert.equal(openPack(s, 'natur').length, 5);
  assert.equal(s.deck.length, before + 5);
  assert.equal(openPack(s, 'natur'), null);
});

test('insufficient resources cannot start and warehouse speed has a limit', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.resources = { holz: 2, korn: 2 };
  for (const [x, y] of [[-1,-1], [0,-1], [1,-1], [-1,0], [1,0]]) addTile(s, 'lagerhalle', x, y);
  assert.equal(workshopDuration(s, w, 'natur'), 12000);
  assert.equal(startPack(s, w, 'natur', 0), false);
  assert.deepEqual(s.resources, { holz: 2, korn: 2 });
  assert.equal(w.job, undefined);
});

test('migration preserves old progress and provides a workshop card only once', () => {
  const s = { gold: 13, tiles: {}, nextId: 1, deck: ['gras'], hand: null };
  addTile(s, 'gras', 0, 0);
  assert.equal(migrateState(s, 123), true);
  assert.equal(s.gold, 13);
  assert.deepEqual(s.deck, ['workshop', 'gras']);
  assert.equal(s.productionAt, 123);
  assert.equal(migrateState(s, 456), false);
  assert.equal(s.deck.filter(id => id === 'workshop').length, 1);
});

test('joker protects the last workshop and workshops with active production', () => {
  const s = newState();
  const first = s.tiles['0,0'];
  for (const joker of ['joker_loeschen', 'joker_verwandeln']) {
    s.hand = joker;
    assert.equal(useJoker(s, 0, 0), null);
    assert.equal(s.hand, joker);
  }
  const second = addTile(s, 'workshop', 1, 0);
  startPack(s, first, 'natur', 1000);
  for (const joker of ['joker_loeschen', 'joker_verwandeln']) {
    s.hand = joker;
    assert.equal(useJoker(s, 0, 0), null);
  }
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 1, 0).tile, second);
  assert.equal(s.tiles['0,0'], first);
});

test('starthilfe recovers a deadlocked game without granting infinite free packs', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.tiles = { '0,0': w };
  s.resources = { holz: 0, korn: 0 };
  s.deck = [];
  assert.equal(canStartRecovery(s, w), true);
  assert.equal(startRecovery(s, w, 1000), true);
  assert.equal(canStartRecovery(s, w), false);
  updateProduction(s, 31000);
  assert.equal(canStartRecovery(s, w), false);
  assert.deepEqual(new Set(openPack(s, 'starthilfe')), new Set(['wald', 'feld', 'gras', 'erde', 'wasser']));
  assert.equal(canStartRecovery(s, w), false);
});

test('starthilfe is unavailable when normal production or an affordable pack can recover', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.deck = [];
  s.resources = { holz: 0, korn: 0 };
  addTile(s, 'wald', 1, 0);
  addTile(s, 'feld', -1, 0);
  assert.equal(canStartRecovery(s, w), false);
  s.tiles = { '0,0': w };
  s.resources = { holz: 3, korn: 2 };
  assert.equal(canStartRecovery(s, w), false);
});

test('starthilfe remains available if only unusable jokers remain', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.tiles = { '0,0': w };
  s.resources = { holz: 0, korn: 0 };
  s.hand = 'joker_loeschen';
  s.deck = ['joker_verwandeln'];
  assert.equal(canStartRecovery(s, w), true);
  s.deck.push('gras');
  assert.equal(canStartRecovery(s, w), false);
});
