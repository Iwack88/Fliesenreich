import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CRAFT_JOBS, PACKS, START_RESOURCES } from '../src/config.js';
import { addTile, newState, migrateState, tileProduction, productionClusters, productionRates, updateProduction, startPack, canStartPack, maxStartablePacks, craftDuration, openPack, canStartRecovery, startRecovery, storageCapacity, useJoker } from '../src/logic.js';

const ZERO = { holz: 0, korn: 0, gold: 0, werkzeug: 0, forschung: 0 };

test('active production clusters merge shared suppliers and include diagonal neighbors', () => {
  const s = { tiles: {}, nextId: 1 };
  const mill = addTile(s, 'windmuehle', 0, 0);
  const field = addTile(s, 'feld', 1, 0);
  addTile(s, 'gras', 0, 1);
  assert.deepEqual(productionClusters(s), [], 'emergency production does not use a supplier');
  const diagonal = addTile(s, 'feld', 1, 1);
  const otherMill = addTile(s, 'windmuehle', 2, 0);
  const third = addTile(s, 'feld', 3, 0);
  const forest = addTile(s, 'wald', -3, 0);
  const logger = addTile(s, 'holzfaeller', -3, 1);
  const forest2 = addTile(s, 'wald', -2, 1);
  const clusters = productionClusters(s).map(group => ({ resource: group.resource, tiles: new Set(group.tiles) }));
  assert.equal(clusters.length, 2);
  assert.ok(clusters.some(group => group.resource === 'korn' && group.tiles.size === 5 && [mill, field, diagonal, otherMill, third].every(tile => group.tiles.has(tile))));
  assert.ok(clusters.some(group => group.resource === 'holz' && group.tiles.size === 3 && [forest, logger, forest2].every(tile => group.tiles.has(tile))));
  delete s.tiles['1,1'];
  assert.ok(!productionClusters(s).some(group => group.tiles.includes(mill)));
});

test('gold pairs and forge chains form separate clusters, excluding unrelated tiles', () => {
  const s = { tiles: {}, nextId: 1 };
  const house = addTile(s, 'haus', 0, 0);
  const tavern = addTile(s, 'taverne', 1, 1);
  const house2 = addTile(s, 'haus', 2, 1);
  const isolated = addTile(s, 'taverne', 5, 0);
  const workshop = addTile(s, 'workshop', 0, 4);
  const forge1 = addTile(s, 'werkzeugschmiede', 1, 4);
  const forge2 = addTile(s, 'werkzeugschmiede', 0, 5);
  const clusters = productionClusters(s);
  assert.equal(clusters.length, 2);
  assert.ok(clusters.some(group => group.resource === 'gold' && group.tiles.length === 3 && [house, tavern, house2].every(tile => group.tiles.includes(tile))));
  assert.ok(clusters.some(group => group.resource === 'werkzeug' && group.tiles.length === 3 && [workshop, forge1, forge2].every(tile => group.tiles.includes(tile))));
  assert.ok(clusters.every(group => !group.tiles.includes(isolated)));
});

test('shared houses belong to separate research and gold clusters', () => {
  const s = { tiles: {}, nextId: 1 };
  const school = addTile(s, 'schule', 0, 0);
  const house = addTile(s, 'haus', 1, 0);
  const tavern = addTile(s, 'taverne', 1, 1);
  const clusters = productionClusters(s);
  assert.equal(clusters.length, 2);
  assert.deepEqual(new Set(clusters.find(group => group.resource === 'forschung').tiles), new Set([school, house]));
  assert.deepEqual(new Set(clusters.find(group => group.resource === 'gold').tiles), new Set([house, tavern]));
  delete s.tiles['0,0'];
  assert.deepEqual(productionClusters(s).map(group => group.resource), ['gold']);
});

test('suppliers produce nothing alone and activate producers from two neighbors, including diagonals', () => {
  const s = { tiles: {}, nextId: 1 };
  const forest = addTile(s, 'wald', 0, 0);
  const logger = addTile(s, 'holzfaeller', 1, 0);
  assert.deepEqual(tileProduction(s, forest), { base: ZERO, bonus: ZERO });
  assert.deepEqual(tileProduction(s, logger).supply, { supplier: 'wald', count: 1, required: 2, active: false });
  assert.equal(tileProduction(s, logger).base.holz, 1);
  addTile(s, 'wald', 2, 1);
  assert.deepEqual(tileProduction(s, logger), {
    base: { ...ZERO, holz: 4 }, bonus: ZERO,
    supply: { supplier: 'wald', count: 2, required: 2, active: true },
  });
  addTile(s, 'feld', 5, 5);
  const mill = addTile(s, 'windmuehle', 0, 5);
  assert.equal(tileProduction(s, mill).base.korn, 1);
  assert.deepEqual(productionRates(s), { ...ZERO, holz: 4, korn: 1 });
});

test('workshops need two neighboring forges and run in emergency mode otherwise', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  w.type = 'workshop';
  assert.equal(tileProduction(s, w).base.werkzeug, 1);
  assert.deepEqual(tileProduction(s, w).supply, { supplier: 'werkzeugschmiede', count: 0, required: 2, active: false });
  addTile(s, 'werkzeugschmiede', 1, 1);
  addTile(s, 'werkzeugschmiede', -1, 0, 'rare');
  const { base, bonus, supply } = tileProduction(s, w);
  assert.equal(supply.active, true);
  assert.equal(base.werkzeug, 4);
  assert.equal(bonus.werkzeug, 2);
  w.rarity = 'uncommon';
  assert.equal(tileProduction(s, w).base.werkzeug, 8);
});

test('new games start with 30 tools, tools are produced over time and capped by capacity', () => {
  const s = newState();
  assert.equal(s.resources.werkzeug, START_RESOURCES.werkzeug);
  assert.equal(START_RESOURCES.werkzeug, 30);
  s.productionAt = 0;
  updateProduction(s, 30000);
  assert.equal(s.resources.werkzeug, 33);
  s.resources.werkzeug = storageCapacity(s).werkzeug;
  updateProduction(s, 60000);
  assert.equal(s.resources.werkzeug, storageCapacity(s).werkzeug);
});

test('crafting orders cost tools and resources, run in parallel and deliver packs offline', (t) => {
  const s = newState();
  s.resources = { holz: 100, korn: 100, werkzeug: 100 };
  s.productionAt = 1000;
  assert.equal(PACKS.natur.cost.werkzeug, 30);
  assert.equal(craftDuration('natur'), 240000);
  assert.equal(maxStartablePacks(s, 'natur'), 3);
  assert.equal(startPack(s, 'natur', 1000), true);
  assert.equal(startPack(s, 'natur', 1000), true);
  assert.deepEqual(s.resources, { holz: 40, korn: 50, werkzeug: 40 });
  assert.equal(s.crafting.length, 2);
  assert.equal(updateProduction(s, 240999), true);
  assert.equal(s.packs.natur, undefined);
  updateProduction(s, 241000);
  assert.equal(s.packs.natur, 2);
  assert.equal(s.crafting.length, 0);
  t.mock.method(Math, 'random', () => 0);
  assert.ok(openPack(s, 'natur'));
  assert.equal(s.packs.natur, 1);
});

test('orders are refused without enough tools or when 30 orders are running', () => {
  const s = newState();
  s.resources = { holz: 9999, korn: 9999, werkzeug: 29 };
  assert.equal(canStartPack(s, 'natur'), false);
  assert.equal(startPack(s, 'natur', 0), false);
  assert.equal(s.resources.werkzeug, 29);
  s.resources.werkzeug = 99999;
  s.crafting = Array.from({ length: MAX_CRAFT_JOBS - 1 }, () => ({ pack: 'natur', duration: 1, endsAt: 1e12 }));
  assert.equal(maxStartablePacks(s, 'natur'), 1);
  assert.equal(startPack(s, 'natur', 0), true);
  assert.equal(startPack(s, 'natur', 0), false);
  assert.equal(s.crafting.length, MAX_CRAFT_JOBS);
});

test('Joker pack charges gold and tools once and delivers only jokers', () => {
  const s = newState();
  s.productionAt = 1000;
  s.resources.werkzeug = 100;
  s.gold = 349;
  assert.equal(startPack(s, 'joker', 1000), false);
  assert.equal(s.gold, 349);
  s.gold = 350;
  const holz = s.resources.holz;
  assert.equal(startPack(s, 'joker', 1000), true);
  assert.equal(s.gold, 0);
  assert.equal(s.resources.werkzeug, 0);
  assert.equal(s.resources.holz, holz);
  updateProduction(s, 1000 + craftDuration('joker') + 1);
  assert.equal(s.packs.joker, 1);
  const cards = openPack(s, 'joker');
  const jokers = cards.filter(id => id.startsWith('joker_')).length;
  assert.ok(jokers >= 2 && jokers <= 3);
  assert.equal(cards.length, jokers);
  assert.ok(!cards.includes('banditen_niete'));
});

test('production uses adjacent buffs, counts gold pairs once and caps resources', () => {
  const s = newState();
  s.tiles = {};
  s.productionAt = 1000;
  s.resources = { holz: 98, korn: 0, werkzeug: 0 };
  s.gold = 0;
  addTile(s, 'wald', 0, 0);
  addTile(s, 'holzfaeller', 1, 1);
  addTile(s, 'feld', 4, 0);
  addTile(s, 'windmuehle', 5, 0);
  addTile(s, 'haus', 0, 4);
  addTile(s, 'haus', 1, 4);
  addTile(s, 'taverne', 2, 4);
  assert.deepEqual(productionRates(s), { holz: 1, korn: 1, gold: 3, werkzeug: 0, forschung: 0 });
  assert.equal(updateProduction(s, 30999), true);
  assert.deepEqual(s.resources, { holz: 100, korn: 2, werkzeug: 0, forschung: 0 });
  assert.equal(s.gold, 6);
  assert.equal(s.productionAt, 21000);
  assert.equal(updateProduction(s, 30999), false);
  updateProduction(s, 31000);
  assert.equal(s.gold, 9);
});

test('migration moves per-workshop jobs into the shared queue and grants start tools once', () => {
  const s = newState();
  delete s.crafting;
  delete s.resources.werkzeug;
  s.tiles['0,0'].job = { pack: 'natur', duration: 24000, endsAt: 24000 };
  assert.equal(migrateState(s, 1), true);
  assert.deepEqual(s.crafting, [{ pack: 'natur', duration: 24000, endsAt: 24000 }]);
  assert.equal(s.tiles['0,0'].job, undefined);
  assert.equal(s.resources.werkzeug, 30);
  assert.equal(migrateState(s, 2), false);
  assert.equal(s.crafting.length, 1);
});

test('migration preserves old progress and provides a workshop card only once', () => {
  const s = { gold: 13, tiles: {}, nextId: 1, deck: ['gras'], hand: null };
  addTile(s, 'gras', 0, 0);
  assert.equal(migrateState(s, 123), true);
  assert.equal(s.gold, 13);
  assert.deepEqual(s.deck, ['wachturm', 'workshop', 'gras', 'banditen_niete']);
  assert.equal(s.productionAt, 123);
  assert.equal(s.resources.werkzeug, 30);
  assert.equal(migrateState(s, 456), false);
  assert.equal(s.deck.filter(id => id === 'workshop').length, 1);
});

test('joker protects only the last town hall', () => {
  const s = newState();
  const first = s.tiles['0,0'];
  for (const joker of ['joker_loeschen', 'joker_verwandeln']) {
    s.hand = joker;
    assert.equal(useJoker(s, 0, 0), null);
    assert.equal(s.hand, joker);
  }
  const second = addTile(s, 'rathaus', 2, 0);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 2, 0).tile, second);
  assert.equal(s.tiles['0,0'], first);
});

test('the town hall alone yields 1 gold and 1 tool per tick, independent of neighbors', () => {
  const s = newState();
  s.tiles = { '0,0': s.tiles['0,0'] };
  assert.deepEqual(productionRates(s), { ...ZERO, gold: 1, werkzeug: 1 });
  const gold = s.gold, tools = s.resources.werkzeug;
  s.productionAt = 0;
  updateProduction(s, 30000);
  assert.equal(s.gold, gold + 3);
  assert.equal(s.resources.werkzeug, tools + 3);
});

test('starthilfe recovers a deadlocked game without granting infinite free packs', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.tiles = { '0,0': w };
  s.resources = { holz: 0, korn: 0, werkzeug: 100 };
  s.deck = [];
  assert.equal(canStartRecovery(s), true);
  assert.equal(startRecovery(s, 1000), true);
  assert.equal(canStartRecovery(s), false);
  updateProduction(s, 31000);
  assert.equal(canStartRecovery(s), false);
  const cards = openPack(s, 'starthilfe');
  assert.equal(cards.length, 3);
  assert.ok(cards.includes('holzfaeller') && cards.includes('windmuehle'));
  assert.ok(cards.includes('wald') || cards.includes('feld'));
  assert.equal(canStartRecovery(s), false);
});

test('starthilfe is unavailable when normal production or an affordable pack can recover', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.deck = [];
  s.resources = { holz: 0, korn: 0, werkzeug: 100 };
  addTile(s, 'wald', 1, 0);
  addTile(s, 'feld', -1, 0);
  assert.equal(canStartRecovery(s), true);
  addTile(s, 'holzfaeller', 1, 1);
  addTile(s, 'windmuehle', -1, 1);
  assert.equal(canStartRecovery(s), false);
  s.tiles = { '0,0': w };
  s.resources = { holz: 30, korn: 25, werkzeug: 30 };
  assert.equal(canStartRecovery(s), false);
});

test('starthilfe remains available if only unusable jokers remain', () => {
  const s = newState();
  const w = s.tiles['0,0'];
  s.tiles = { '0,0': w };
  s.resources = { holz: 0, korn: 0, werkzeug: 100 };
  s.hand = 'joker_loeschen';
  s.deck = ['joker_verwandeln'];
  assert.equal(canStartRecovery(s), true);
  s.deck.push('gras');
  assert.equal(canStartRecovery(s), false);
});
