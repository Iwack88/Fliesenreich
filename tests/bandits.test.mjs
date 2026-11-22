import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDIT_INTERVAL, START_BANDITS, GUARD_RADIUS, TILES } from '../src/config.js';
import { addTile, advanceBandits, drawCard, isProtected, migrateState, newState, placeHand, planBandits, spawnBandit, spreadBandits, startPack, useJoker } from '../src/logic.js';

function emptyWorld() {
  return { size: 16, gold: 100, resources: { holz: 8, korn: 8 }, productionAt: 0, banditElapsed: 0, packs: {}, nextId: 1, tiles: {}, deck: [], hand: null };
}

test('new games have a guarded workshop and camps outside the protected area', () => {
  for (let i = 0; i < 50; i++) {
    const s = newState();
    assert.equal(s.tiles['0,0'].type, 'workshop');
    assert.equal(s.tiles['1,0'].type, 'wachturm');
    assert.equal(isProtected(s, 0, 0), true);
    const camps = Object.values(s.tiles).filter(tile => tile.type === 'banditen');
    assert.equal(camps.length, START_BANDITS);
    assert.ok(camps.every(tile => !isProtected(s, tile.x, tile.y)));
  }
});

test('guard shields all cells within its square and clears existing camps when placed', () => {
  const s = emptyWorld();
  addTile(s, 'gras', 0, 0);
  addTile(s, 'banditen', 3, 3);
  addTile(s, 'banditen', 5, 0);
  s.hand = 'wachturm';
  const result = placeHand(s, 1, 0);
  assert.equal(result.cleared, 1);
  assert.equal(s.tiles['3,3'], undefined);
  assert.equal(s.tiles['5,0'].type, 'banditen');
  assert.equal(isProtected(s, 1 - GUARD_RADIUS, -GUARD_RADIUS), true);
  assert.equal(isProtected(s, 1 - GUARD_RADIUS - 1, 0), false);
});

test('camps cannot be deleted or transformed by jokers', () => {
  const s = emptyWorld();
  addTile(s, 'banditen', 0, 0);
  addTile(s, 'gras', 1, 0);
  for (const joker of ['joker_loeschen', 'joker_verwandeln']) {
    s.hand = joker;
    assert.equal(useJoker(s, 0, 0), null);
    assert.equal(s.hand, joker);
    assert.equal(s.tiles['0,0'].type, 'banditen');
  }
});

test('a tile transformed into a guard clears camps in range', (t) => {
  const s = emptyWorld();
  addTile(s, 'gras', 0, 0);
  addTile(s, 'banditen', 2, 0);
  const pool = Object.keys(TILES).filter(type => type !== 'gras' && type !== 'banditen');
  t.mock.method(Math, 'random', () => (pool.indexOf('wachturm') + 0.5) / pool.length);
  s.hand = 'joker_verwandeln';
  assert.equal(useJoker(s, 0, 0).cleared, 1);
  assert.equal(s.tiles['0,0'].type, 'wachturm');
  assert.equal(s.tiles['2,0'], undefined);
});

test('all camps spread once simultaneously without attacking guarded cells', () => {
  const s = emptyWorld();
  addTile(s, 'banditen', 0, 0);
  addTile(s, 'haus', 1, 0);
  addTile(s, 'feld', 2, 0);
  const captures = spreadBandits(s, 0);
  assert.equal(captures.length, 1);
  assert.equal(s.tiles['1,0'].type, 'banditen');
  assert.equal(s.tiles['2,0'].type, 'feld');
  assert.equal(Object.keys(s.tiles).length, 3);
  assert.equal(spreadBandits(s, 0).length, 2);
  assert.equal(s.tiles['2,0'].type, 'banditen');

  const guarded = emptyWorld();
  addTile(guarded, 'banditen', -4, 0);
  addTile(guarded, 'workshop', -3, 0);
  addTile(guarded, 'wachturm', 0, 0);
  spreadBandits(guarded, 0);
  assert.equal(guarded.tiles['-3,0'].type, 'workshop');
});

test('camps cannot claim the same tile twice in a tick', () => {
  const s = emptyWorld();
  addTile(s, 'banditen', 0, 0);
  addTile(s, 'banditen', 2, 0);
  addTile(s, 'wald', 1, 0);
  planBandits(s);
  const targets = Object.values(s.tiles).filter(t => t.type === 'banditen').map(t => `${t.target.x},${t.target.y}`);
  assert.equal(new Set(targets).size, 2);
  assert.ok(targets.includes('1,0'));
  assert.equal(spreadBandits(s, 0).length, 2);
  assert.equal(Object.values(s.tiles).filter(t => t.type === 'banditen').length, 4);
});

test('a camp attacks its announced target even after saving and reloading', (t) => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  addTile(s, 'feld', 1, 0);
  addTile(s, 'wald', 0, 1);
  let random = 0;
  t.mock.method(Math, 'random', () => random);
  assert.equal(planBandits(s), true);
  const chosen = { ...camp.target };
  random = 0.99;
  assert.equal(planBandits(s), false);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(spreadBandits(restored, 0)[0].previous.type, s.tiles[`${chosen.x},${chosen.y}`].type);
  assert.equal(restored.tiles[`${chosen.x},${chosen.y}`].type, 'banditen');
});

test('a target remains on the same field when its tile is removed and rebuilt', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  s.hand = 'feld';
  placeHand(s, 1, 0);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  s.hand = 'joker_loeschen';
  useJoker(s, 1, 0);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  s.hand = 'wald';
  placeHand(s, 1, 0);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  assert.equal(spreadBandits(s, 0)[0].previous.type, 'wald');
});

test('isolated camps target empty in-bounds fields and create camps on the next tick', () => {
  const s = emptyWorld();
  s.size = 2;
  const camp = addTile(s, 'banditen', 0, 0);
  planBandits(s);
  const target = { ...camp.target };
  assert.ok(target.x >= -1 && target.x <= 0 && target.y >= -1 && target.y <= 0);
  assert.equal(s.tiles[`${target.x},${target.y}`], undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(s)).tiles['0,0'].target, target);
  const result = spreadBandits(s, 0);
  assert.equal(result.length, 1);
  assert.equal(result[0].previous, undefined);
  assert.equal(s.tiles[`${target.x},${target.y}`].type, 'banditen');
  assert.equal(Object.keys(s.tiles).length, 2);
});

test('building on an announced empty target does not change it before the attack', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  camp.target = { x: 1, y: 0 };
  s.hand = 'haus';
  placeHand(s, 1, 0);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  const captured = spreadBandits(s, 0);
  assert.equal(captured[0].previous.type, 'haus');
  assert.equal(s.tiles['1,0'].type, 'banditen');
  assert.equal(s.tiles['0,0'].type, 'banditen');
});

test('new targets prioritize an unprotected occupied neighbor over empty fields', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  addTile(s, 'haus', 1, 1);
  planBandits(s);
  assert.deepEqual(camp.target, { x: 1, y: 1 });
});

test('no target is chosen outside the board or inside guard protection', () => {
  const s = emptyWorld();
  s.size = 8;
  const camp = addTile(s, 'banditen', -4, 0);
  addTile(s, 'wachturm', -1, 0);
  planBandits(s);
  assert.equal(camp.target, undefined);
  assert.deepEqual(spreadBandits(s, 0), []);
});

test('a guard protects an announced target and forces a different target immediately', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  addTile(s, 'feld', 1, 0);
  addTile(s, 'wald', -1, 0);
  addTile(s, 'gras', 3, 0);
  camp.target = { x: 1, y: 0 };
  s.hand = 'wachturm';
  placeHand(s, 4, 0);
  assert.deepEqual(camp.target, { x: -1, y: 0 });
  assert.equal(spreadBandits(s, 0)[0].previous.type, 'wald');
  assert.equal(s.tiles['1,0'].type, 'feld');
});

test('global clock advances only by supplied active time and persists its remainder', () => {
  const s = emptyWorld();
  addTile(s, 'banditen', 0, 0);
  addTile(s, 'feld', 1, 0);
  assert.deepEqual(advanceBandits(s, BANDIT_INTERVAL - 1, 0), []);
  const saved = JSON.parse(JSON.stringify(s));
  assert.equal(saved.tiles['1,0'].type, 'feld');
  assert.equal(advanceBandits(saved, 1, 0).length, 1);
  assert.equal(saved.banditElapsed, 0);
});

test('capturing a warehouse updates active workshop timers and can capture a workshop', () => {
  const s = emptyWorld();
  const workshop = addTile(s, 'workshop', 0, 0);
  addTile(s, 'lagerhalle', 1, 0);
  addTile(s, 'banditen', 2, 0);
  startPack(s, workshop, 'natur', 0);
  assert.equal(workshop.job.endsAt, 24000);
  assert.equal(spreadBandits(s, 12000)[0].previous.type, 'lagerhalle');
  assert.equal(workshop.job.endsAt, 27000);
  assert.equal(spreadBandits(s, 13000)[0].previous.type, 'workshop');
  assert.equal(s.tiles['0,0'].type, 'banditen');
  assert.equal(s.packs.natur, undefined);
});

test('a drawn bandit card spawns on an unprotected free field and consumes itself', () => {
  const s = emptyWorld();
  addTile(s, 'wachturm', 0, 0);
  s.deck = ['banditen_niete'];
  assert.equal(drawCard(s), 'banditen_niete');
  const result = spawnBandit(s, 0);
  assert.equal(result.previous, undefined);
  assert.equal(result.tile.type, 'banditen');
  assert.equal(isProtected(s, result.tile.x, result.tile.y), false);
  assert.equal(s.hand, null);
});

test('a bandit card takes an unprotected occupied tile if no free cells remain', () => {
  const s = emptyWorld();
  s.size = 2;
  for (const [x, y] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) addTile(s, 'haus', x, y);
  s.hand = 'banditen_niete';
  const result = spawnBandit(s, 0);
  assert.equal(result.previous.type, 'haus');
  assert.equal(result.tile.type, 'banditen');
  assert.ok(result.tile.target);
  assert.equal(s.hand, null);
});

test('a bandit card is not consumed when every field is guarded', () => {
  const s = emptyWorld();
  s.size = 2;
  addTile(s, 'wachturm', 0, 0);
  s.hand = 'banditen_niete';
  assert.equal(spawnBandit(s, 0), null);
  assert.equal(s.hand, 'banditen_niete');
});

test('migration adds a guard card and a bandit card without replacing existing tiles', () => {
  const s = emptyWorld();
  delete s.banditElapsed;
  addTile(s, 'workshop', 0, 0);
  s.deck = ['wald'];
  const before = JSON.stringify(s.tiles);
  assert.equal(migrateState(s), true);
  assert.equal(JSON.stringify(s.tiles), before);
  assert.deepEqual(s.deck, ['wachturm', 'wald', 'banditen_niete']);
  assert.equal(migrateState(s), false);
});

test('existing camps get a saved target on loading without resetting progress', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  addTile(s, 'haus', 1, 0);
  s.banditElapsed = 12345;
  assert.equal(migrateState(s), true);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  assert.equal(s.banditElapsed, 12345);
  assert.equal(migrateState(s), false);
});
