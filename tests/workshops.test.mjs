import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../src/config.js';
import { addTile, newState, migrateState, tileProduction, productionRates, updateProduction, startPack, forgeCount, workshopDuration, placeHand, openPack, canStartRecovery, startRecovery, useJoker } from '../src/logic.js';

test('suppliers produce nothing alone and activate producers from two neighbors, including diagonals', () => {
  const s = { tiles: {}, nextId: 1 };
  const forest = addTile(s, 'wald', 0, 0);
  const logger = addTile(s, 'holzfaeller', 1, 0);
  assert.deepEqual(tileProduction(s, forest), { base: { holz: 0, korn: 0, gold: 0 }, bonus: { holz: 0, korn: 0, gold: 0 } });
  assert.deepEqual(tileProduction(s, logger).supply, { supplier: 'wald', count: 1, required: 2, active: false });
  assert.equal(tileProduction(s, logger).base.holz, 1);
  addTile(s, 'wald', 2, 1);
  assert.deepEqual(tileProduction(s, logger), {
    base: { holz: 4, korn: 0, gold: 0 }, bonus: { holz: 0, korn: 0, gold: 0 },
    supply: { supplier: 'wald', count: 2, required: 2, active: true },
  });
  addTile(s, 'feld', 5, 5);
  const mill = addTile(s, 'windmuehle', 0, 5);
  assert.equal(tileProduction(s, mill).base.korn, 1);
  assert.deepEqual(productionRates(s), { holz: 4, korn: 1, gold: 0 });
});

test('HumanCity is crafted with resources, gains forge speed and opens from inventory', (t) => {
  const s = newState();
  s.resources = { holz: 100, korn: 100 };
  s.productionAt = 1000;
  const workshop = s.tiles['0,0'];
  addTile(s, 'werkzeugschmiede', 1, 1);
  assert.equal(startPack(s, workshop, 'humancity', 1000), true);
  assert.deepEqual(s.resources, { holz: 50, korn: 65 });
  assert.equal(workshop.job.duration, 432000);
  updateProduction(s, 433000);
  assert.equal(s.packs.humancity, 1);
  t.mock.method(Math, 'random', () => 0.85);
  const cards = openPack(s, 'humancity');
  assert.equal(cards.length, 5);
  assert.ok(cards.includes('wachturm'));
  assert.equal(s.packs.humancity, 0);
});

test('Joker pack charges gold once, uses forge speed and delivers only jokers offline', () => {
  const s = newState();
  s.productionAt = 1000;
  s.gold = 249;
  const workshop = s.tiles['0,0'];
  addTile(s, 'werkzeugschmiede', 1, 1);
  assert.equal(startPack(s, workshop, 'joker', 1000), false);
  assert.equal(s.gold, 249);
  s.gold = 250;
  const resources = { ...s.resources };
  assert.equal(startPack(s, workshop, 'joker', 1000), true);
  assert.equal(s.gold, 0);
  assert.deepEqual(s.resources, resources);
  assert.equal(workshop.job.duration, 288000);
  assert.equal(startPack(s, workshop, 'joker', 1000), false);
  updateProduction(s, 289000);
  assert.equal(s.packs.joker, 1);
  const cards = openPack(s, 'joker');
  assert.equal(cards.length, 5);
  assert.ok(cards.every(id => id.startsWith('joker_')));
});

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
  assert.deepEqual(productionRates(s), { holz: 1, korn: 1, gold: 3 });
  assert.equal(updateProduction(s, 30999), true);
  assert.deepEqual(s.resources, { holz: 100, korn: 2 });
  assert.equal(s.gold, 6);
  assert.equal(s.productionAt, 21000);
  assert.equal(updateProduction(s, 30999), false);
  updateProduction(s, 31000);
  assert.equal(s.gold, 9);
});

test('workshops spend resources once, gain forge speed, and deliver packs offline', () => {
  const s = newState();
  s.resources = { holz: 100, korn: 100 };
  s.productionAt = 1000;
  const w = s.tiles['0,0'];
  addTile(s, 'werkzeugschmiede', 1, 1);
  assert.equal(workshopDuration(s, w, 'natur'), 144000);
  assert.equal(startPack(s, w, 'natur', 1000), true);
  assert.deepEqual(s.resources, { holz: 80, korn: 85 });
  assert.equal(startPack(s, w, 'natur', 1000), false);
  assert.equal(updateProduction(s, 144999), true);
  assert.equal(s.packs.natur, undefined);
  assert.equal(updateProduction(s, 145000), true);
  assert.equal(s.packs.natur, 1);
  assert.equal(w.job, undefined);
  updateProduction(s, 155000);
  assert.equal(s.packs.natur, 1);
  const before = s.deck.length;
  assert.equal(openPack(s, 'natur').length, 5);
  assert.equal(s.deck.length, before + 5);
  assert.equal(openPack(s, 'natur'), null);
});

test('insufficient resources cannot start and forge speed has a limit', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.resources = { holz: 2, korn: 2 };
  for (const [x, y] of [[-1,-1], [0,-1], [1,-1], [-1,0], [1,0]]) addTile(s, 'werkzeugschmiede', x, y);
  assert.equal(workshopDuration(s, w, 'natur'), 72000);
  assert.equal(startPack(s, w, 'natur', 0), false);
  assert.deepEqual(s.resources, { holz: 2, korn: 2 });
  assert.equal(w.job, undefined);
});

test('adding and removing a forge adjusts only remaining production time, including after reload', () => {
  let s = newState();
  s.resources = { holz: 100, korn: 100 };
  const w = s.tiles['0,0'];
  s.tiles = { '0,0': w };
  startPack(s, w, 'natur', 0);
  s.hand = 'werkzeugschmiede';
  assert.ok(placeHand(s, 1, 0, 90000));
  assert.equal(forgeCount(s, w), 1);
  assert.equal(w.job.endsAt, 162000);
  assert.equal(w.job.duration, 144000);
  s = JSON.parse(JSON.stringify(s));
  s.hand = 'joker_loeschen';
  assert.ok(useJoker(s, 1, 0, 126000));
  assert.equal(forgeCount(s, s.tiles['0,0']), 0);
  assert.equal(s.tiles['0,0'].job.endsAt, 171000);
  assert.equal(updateProduction(s, 170999), true);
  assert.equal(s.packs.natur, undefined);
  updateProduction(s, 171000);
  assert.equal(s.packs.natur, 1);
});

test('transforming a tile to or from a forge updates neighboring workshops', (t) => {
  const s = newState();
  s.resources = { holz: 100, korn: 100 };
  const w = s.tiles['0,0'];
  s.tiles = { '0,0': w };
  addTile(s, 'gras', 1, 1);
  startPack(s, w, 'natur', 0);
  let index = Object.keys(TILES).filter(type => type !== 'gras' && type !== 'banditen').indexOf('werkzeugschmiede');
  const poolSize = Object.keys(TILES).length - 2;
  t.mock.method(Math, 'random', () => (index + 0.5) / poolSize);
  s.hand = 'joker_verwandeln';
  assert.ok(useJoker(s, 1, 1, 15000));
  assert.equal(w.job.endsAt, 147000);
  index = Object.keys(TILES).filter(type => type !== 'werkzeugschmiede' && type !== 'banditen').indexOf('gras');
  s.hand = 'joker_verwandeln';
  assert.ok(useJoker(s, 1, 1, 21000));
  assert.equal(w.job.endsAt, 178500);
});

test('legacy jobs without a recorded duration keep working when a forge is added', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.tiles = { '0,0': w };
  w.job = { pack: 'natur', endsAt: 30000 };
  s.hand = 'werkzeugschmiede';
  placeHand(s, 1, 0, 15000);
  assert.equal(w.job.endsAt, 27000);
  assert.equal(w.job.duration, undefined);
});

test('one forge accelerates every neighboring workshop, including starthilfe', () => {
  const s = newState();
  s.resources = { holz: 100, korn: 100 };
  const first = s.tiles['0,0'];
  s.tiles = { '0,0': first };
  const second = addTile(s, 'workshop', 2, 0);
  startPack(s, first, 'natur', 0);
  second.job = { pack: 'starthilfe', duration: 30000, endsAt: 30000 };
  s.hand = 'werkzeugschmiede';
  placeHand(s, 1, 0, 15000);
  assert.equal(first.job.endsAt, 147000);
  assert.equal(second.job.endsAt, 27000);
  assert.equal(workshopDuration(s, second, 'starthilfe'), 24000);
});

test('migration preserves old progress and provides a workshop card only once', () => {
  const s = { gold: 13, tiles: {}, nextId: 1, deck: ['gras'], hand: null };
  addTile(s, 'gras', 0, 0);
  assert.equal(migrateState(s, 123), true);
  assert.equal(s.gold, 13);
  assert.deepEqual(s.deck, ['wachturm', 'workshop', 'gras', 'banditen_niete']);
  assert.equal(s.productionAt, 123);
  assert.equal(migrateState(s, 456), false);
  assert.equal(s.deck.filter(id => id === 'workshop').length, 1);
});

test('joker protects the last workshop and workshops with active production', () => {
  const s = newState();
  s.resources = { holz: 100, korn: 100 };
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
  assert.deepEqual(new Set(openPack(s, 'starthilfe')), new Set(['holzfaeller', 'windmuehle', 'wald', 'feld']));
  assert.equal(canStartRecovery(s, w), false);
});

test('starthilfe is unavailable when normal production or an affordable pack can recover', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.deck = [];
  s.resources = { holz: 0, korn: 0 };
  addTile(s, 'wald', 1, 0);
  addTile(s, 'feld', -1, 0);
  assert.equal(canStartRecovery(s, w), true);
  addTile(s, 'holzfaeller', 1, 1);
  addTile(s, 'windmuehle', -1, 1);
  assert.equal(canStartRecovery(s, w), false);
  s.tiles = { '0,0': w };
  s.resources = { holz: 20, korn: 15 };
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
