import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORTIFY_COST, GUARD_RADIUS, TILES } from '../src/config.js';
import { activateGuard, addTile, advanceBandits, drawCard, fortifyTile, hasTileProtection, isActiveGuard, isProtected, migrateState, moveOptions, moveTile, newState, placeHand, planBandits, spawnBandit, spreadBandits, swapTiles, undoMove, useJoker } from '../src/logic.js';

function emptyWorld() {
  return { size: 16, gold: 100, resources: { holz: 8, korn: 8 }, productionAt: 0, banditElapsed: 0, packs: {}, nextId: 1, tiles: {}, deck: [], hand: null };
}

test('new games have a guarded town hall and no automatically spawned camps', () => {
  for (let i = 0; i < 50; i++) {
    const s = newState();
    assert.equal(s.tiles['0,0'].type, 'rathaus');
    assert.equal(s.tiles['1,0'].type, 'wachturm');
    assert.equal(isProtected(s, 0, 0), true);
    const camps = Object.values(s.tiles).filter(tile => tile.type === 'banditen');
    assert.equal(camps.length, 0);
  }
});

test('town halls are protected without a tower in both new and old saves', () => {
  const s = newState();
  delete s.tiles['1,0'];
  const hall = s.tiles['0,0'];
  assert.equal(hasTileProtection(hall), true);
  assert.equal(isProtected(s, 0, 0, []), true);
  assert.equal(fortifyTile(s, hall), false);
  const loaded = JSON.parse(JSON.stringify(s));
  const camp = addTile(loaded, 'banditen', 1, 0);
  camp.target = { x: 0, y: 0 };
  migrateState(loaded);
  assert.notDeepEqual(camp.target, { x: 0, y: 0 });
  spreadBandits(loaded);
  assert.equal(loaded.tiles['0,0'].type, 'rathaus');
});

test('fortification costs 50 gold once and immediately reroutes attacks', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  const house = addTile(s, 'haus', 1, 0);
  camp.target = { x: 1, y: 0 };
  s.gold = FORTIFY_COST - 1;
  assert.equal(fortifyTile(s, house), false);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  s.gold = FORTIFY_COST;
  assert.equal(fortifyTile(s, camp), false);
  assert.equal(fortifyTile(s, { ...house }), false);
  assert.equal(fortifyTile(s, house), true);
  assert.equal(s.gold, 0);
  assert.notDeepEqual(camp.target, { x: 1, y: 0 });
  assert.equal(fortifyTile(s, house), false);
  assert.equal(isProtected(s, 1, 0, []), true);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(hasTileProtection(loaded.tiles['1,0']), true);
  spreadBandits(loaded);
  assert.equal(loaded.tiles['1,0'].type, 'haus');
});

test('fortification follows tiles when moved, swapped and undone, even with other protection', () => {
  const s = emptyWorld();
  s.gold = 300;
  s.protectedFields = { '0,0': true };
  const house = addTile(s, 'haus', 0, 0);
  const other = addTile(s, 'feld', 2, 0);
  assert.equal(fortifyTile(s, house), true);
  const move = moveTile(s, house, 1, 0);
  assert.ok(move);
  assert.equal(isProtected(s, 1, 0, []), true);
  assert.equal(isProtected(s, 0, 0, []), true, 'joker protection stays on the field');
  const swap = swapTiles(s, house, other);
  assert.ok(swap);
  assert.equal(isProtected(s, 2, 0, []), true);
  assert.equal(isProtected(s, 1, 0, []), false);
  assert.equal(undoMove(s, swap), true);
  assert.equal(isProtected(s, 1, 0, []), true);
  assert.equal(undoMove(s, move), true);
  assert.equal(hasTileProtection(s.tiles['0,0']), true);
});

test('bandit cards cannot replace a fortified tile when no free cells exist', () => {
  const s = emptyWorld();
  s.size = 2;
  const house = addTile(s, 'haus', 0, 0);
  fortifyTile(s, house);
  for (const [x, y] of [[-1, -1], [-1, 0], [0, -1]]) addTile(s, 'banditen', x, y);
  s.hand = 'banditen_niete';
  assert.equal(spawnBandit(s), null);
  assert.equal(s.tiles['0,0'], house);
});

test('fortification survives transformation but disappears with the deleted tile', t => {
  const s = emptyWorld();
  const house = addTile(s, 'haus', 0, 0);
  addTile(s, 'feld', 2, 0);
  assert.equal(fortifyTile(s, house), true);
  const types = Object.keys(TILES).filter(type => type !== 'haus' && type !== 'banditen');
  t.mock.method(Math, 'random', () => (types.indexOf('gras') + 0.5) / types.length);
  s.hand = 'joker_verwandeln';
  assert.equal(useJoker(s, 0, 0).tile.type, 'gras');
  assert.equal(isProtected(s, 0, 0, []), true);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 0, 0).kind, 'deleted');
  assert.equal(isProtected(s, 0, 0, []), false);
});

test('a guard protects itself until activated, then protects tiles and clears camps in range', () => {
  const s = emptyWorld();
  addTile(s, 'gras', 0, 0);
  addTile(s, 'banditen', 3, 3);
  addTile(s, 'banditen', 5, 0);
  addTile(s, 'haus', 1 - GUARD_RADIUS, -GUARD_RADIUS);
  addTile(s, 'haus', 1 - GUARD_RADIUS - 1, 0);
  s.hand = 'wachturm';
  s.handPlacementSlots = [[1, 0]];
  const result = placeHand(s, 1, 0);
  assert.equal(result.cleared, 0);
  assert.equal(isProtected(s, 1, 0), true);
  assert.equal(isProtected(s, 0, 0), false);
  assert.equal(s.tiles['3,3'].type, 'banditen');
  assert.deepEqual(activateGuard(s, result.tile), { cleared: 1 });
  assert.equal(s.tiles['3,3'], undefined);
  assert.equal(s.tiles['5,0'].type, 'banditen');
  assert.equal(isProtected(s, 1 - GUARD_RADIUS, -GUARD_RADIUS), true);
  assert.equal(isProtected(s, 1 - GUARD_RADIUS - 1, 0), false);
  assert.equal(isProtected(s, 2, 0), false, 'empty fields are not shielded');
  assert.equal(activateGuard(s, result.tile), null);
});

test('active guards lock movement and swaps even when undoing an earlier move', () => {
  const s = emptyWorld();
  s.gold = 300;
  const guard = addTile(s, 'wachturm', 0, 0);
  const house = addTile(s, 'haus', 2, 0);
  const moved = moveTile(s, guard, 1, 0);
  assert.ok(moved);
  assert.deepEqual(activateGuard(s, guard), { cleared: 0 });
  assert.deepEqual(moveOptions(s, guard), { moves: [], swaps: [] });
  assert.equal(moveTile(s, guard, 0, 0), null);
  assert.equal(swapTiles(s, house, guard), null);
  assert.ok(!moveOptions(s, house).swaps.some(option => option.tile === guard));
  assert.equal(undoMove(s, moved), false);
  assert.equal(s.tiles['1,0'], guard);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(isActiveGuard(restored.tiles['1,0']), true);
  assert.deepEqual(moveOptions(restored, restored.tiles['1,0']), { moves: [], swaps: [] });
});

test('tiles gain and lose area protection as they move, while personal protection remains', () => {
  const s = emptyWorld();
  s.gold = 300;
  const guard = addTile(s, 'wachturm', 0, 0);
  const house = addTile(s, 'haus', 4, 0);
  activateGuard(s, guard);
  assert.equal(isProtected(s, 4, 0), false);
  assert.ok(moveTile(s, house, 3, 0));
  assert.equal(isProtected(s, 3, 0), true);
  assert.ok(moveTile(s, house, 4, 0));
  assert.equal(isProtected(s, 4, 0), false);
  const second = addTile(s, 'wachturm', 7, 0);
  activateGuard(s, second);
  assert.equal(isProtected(s, 4, 0), true);
  assert.ok(moveTile(s, house, 3, 0));
  assert.equal(isProtected(s, 3, 0), true);
  assert.equal(fortifyTile(s, house), true);
  assert.ok(moveTile(s, house, 3, -1));
  assert.equal(isProtected(s, 3, -1), true);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 0, 0).kind, 'deleted');
  assert.equal(isProtected(s, 3, -1), true, 'personal fortification survives losing tower coverage');
});

test('overlapping guards and personal protection remain independent when a tower is removed', () => {
  const s = emptyWorld();
  const first = addTile(s, 'wachturm', 0, 0);
  const second = addTile(s, 'wachturm', 4, 0);
  const house = addTile(s, 'haus', 2, 0);
  activateGuard(s, first);
  activateGuard(s, second);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 0, 0).kind, 'deleted');
  assert.equal(isProtected(s, house.x, house.y), true);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 4, 0).kind, 'deleted');
  assert.equal(isProtected(s, house.x, house.y), false);
});

test('activation prevents undoing a swap whether the tower initiated it or was its target', () => {
  for (const initiates of [false, true]) {
    const s = emptyWorld();
    const guard = addTile(s, 'wachturm', 0, 0);
    const house = addTile(s, 'haus', 1, 0);
    const swap = initiates ? swapTiles(s, guard, house) : swapTiles(s, house, guard);
    assert.ok(swap);
    activateGuard(s, guard);
    assert.equal(undoMove(s, swap), false);
  }
});

test('entering a guarded empty target replans the attack and active towers do not shield empty cells', () => {
  const s = emptyWorld();
  const guard = addTile(s, 'wachturm', 0, 0);
  const camp = addTile(s, 'banditen', 4, 0);
  activateGuard(s, guard);
  camp.target = { x: 3, y: 0 };
  assert.equal(isProtected(s, 3, 0), false);
  s.hand = 'feld';
  s.handPlacementSlots = [[3, 0]];
  const field = placeHand(s, 3, 0).tile;
  assert.equal(isProtected(s, 3, 0), true);
  assert.notDeepEqual(camp.target, { x: 3, y: 0 });
  assert.equal(s.tiles['3,0'], field);
});

test('old towers stay inactive on loading and transformation removes their activated area protection', t => {
  const s = newState();
  s.tiles = {};
  const guard = addTile(s, 'wachturm', 0, 0);
  const house = addTile(s, 'haus', 1, 0);
  const old = JSON.parse(JSON.stringify(s));
  migrateState(old);
  assert.equal(isProtected(old, 0, 0), true);
  assert.equal(isProtected(old, 1, 0), false);
  assert.equal(isActiveGuard(old.tiles['0,0']), false);
  activateGuard(s, guard);
  assert.equal(isProtected(s, 1, 0), true);
  const types = Object.keys(TILES).filter(type => type !== 'wachturm' && type !== 'banditen');
  t.mock.method(Math, 'random', () => (types.indexOf('gras') + 0.5) / types.length);
  s.hand = 'joker_verwandeln';
  assert.equal(useJoker(s, 0, 0).tile.type, 'gras');
  assert.equal(isActiveGuard(guard), false);
  assert.equal(isProtected(s, house.x, house.y), false);
});

test('camps cannot be deleted, transformed or protected by jokers', () => {
  const s = emptyWorld();
  addTile(s, 'banditen', 0, 0);
  addTile(s, 'gras', 1, 0);
  for (const joker of ['joker_loeschen', 'joker_verwandeln', 'joker_schutz']) {
    s.hand = joker;
    assert.equal(useJoker(s, 0, 0), null);
    assert.equal(s.hand, joker);
    assert.equal(s.tiles['0,0'].type, 'banditen');
  }
});

test('protection joker saves a field, reroutes attacks, and survives changing the tile and reloading', (t) => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  const house = addTile(s, 'haus', 1, 0);
  camp.target = { x: 1, y: 0 };
  s.hand = 'joker_schutz';
  const result = useJoker(s, 1, 0);
  assert.equal(result.kind, 'protected');
  assert.equal(result.tile, house);
  assert.equal(s.hand, null);
  assert.equal(isProtected(s, 1, 0), true);
  assert.notDeepEqual(camp.target, { x: 1, y: 0 });
  t.mock.method(Math, 'random', () => 0);
  s.hand = 'joker_verwandeln';
  assert.equal(useJoker(s, 1, 0).kind, 'transformed');
  assert.equal(isProtected(s, 1, 0), true);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 1, 0).kind, 'deleted');
  s.hand = 'feld';
  s.handPlacementSlots = [[1, 0]];
  assert.equal(placeHand(s, 1, 0).tile.type, 'feld');
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(isProtected(loaded, 1, 0), true);
  spreadBandits(loaded);
  assert.equal(loaded.tiles['1,0'].type, 'feld');
});

test('old saves gain empty permanent protection without altering the world', () => {
  const s = newState();
  delete s.protectedFields;
  const tiles = JSON.stringify(s.tiles);
  assert.equal(migrateState(s), true);
  assert.deepEqual(s.protectedFields, {});
  assert.equal(JSON.stringify(s.tiles), tiles);
  assert.equal(migrateState(s), false);
});

test('protection joker can protect free or tower-protected fields but rejects invalid targets', () => {
  const s = emptyWorld();
  const guard = addTile(s, 'wachturm', 0, 0);
  const workshop = addTile(s, 'workshop', 1, 0);
  activateGuard(s, guard);
  s.hand = 'joker_schutz';
  assert.equal(useJoker(s, 8, 0), null);
  assert.equal(useJoker(s, 0.5, 0), null);
  assert.equal(s.hand, 'joker_schutz');
  assert.equal(useJoker(s, 1, 0).kind, 'protected');
  assert.equal(s.tiles['1,0'], workshop);
  s.hand = 'joker_schutz';
  assert.equal(useJoker(s, 1, 0), null);
  assert.equal(s.hand, 'joker_schutz');
  assert.equal(useJoker(s, 2, 0).kind, 'protected');
  delete s.tiles['0,0'];
  assert.equal(isProtected(s, 1, 0), true);
  assert.equal(isProtected(s, 2, 0), true);
});

test('bandit cards cannot spawn on permanently protected occupied or empty fields', () => {
  const s = emptyWorld();
  s.size = 2;
  s.protectedFields = { '-1,-1': true, '-1,0': true, '0,-1': true, '0,0': true };
  addTile(s, 'haus', 0, 0);
  s.hand = 'banditen_niete';
  assert.equal(spawnBandit(s), null);
  assert.equal(s.hand, 'banditen_niete');
  assert.equal(s.tiles['0,0'].type, 'haus');
});

test('a tile transformed into a guard starts inactive and clears camps only on activation', (t) => {
  const s = emptyWorld();
  addTile(s, 'gras', 0, 0);
  addTile(s, 'banditen', 2, 0);
  const pool = Object.keys(TILES).filter(type => type !== 'gras' && type !== 'banditen');
  t.mock.method(Math, 'random', () => (pool.indexOf('wachturm') + 0.5) / pool.length);
  s.hand = 'joker_verwandeln';
  assert.equal(useJoker(s, 0, 0).cleared, 0);
  assert.equal(s.tiles['0,0'].type, 'wachturm');
  assert.equal(s.tiles['2,0'].type, 'banditen');
  assert.equal(activateGuard(s, s.tiles['0,0']).cleared, 1);
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
  activateGuard(guarded, addTile(guarded, 'wachturm', 0, 0));
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
  s.handPlacementSlots = [[1, 0]];
  placeHand(s, 1, 0);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  s.hand = 'joker_loeschen';
  useJoker(s, 1, 0);
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  s.hand = 'wald';
  s.handPlacementSlots = [[1, 0]];
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
  s.handPlacementSlots = [[1, 0]];
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

test('bandits may target free fields inside an active guard radius but not outside the board', () => {
  const s = emptyWorld();
  s.size = 8;
  const camp = addTile(s, 'banditen', -4, 0);
  activateGuard(s, addTile(s, 'wachturm', 0, 0));
  planBandits(s);
  assert.ok(camp.target.x >= -4 && camp.target.y >= -4 && camp.target.y < 4);
  assert.equal(isProtected(s, camp.target.x, camp.target.y), false);
  assert.equal(spreadBandits(s, 0).length, 1);
});

test('a guard protects an announced target and forces a different target immediately', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  addTile(s, 'feld', 1, 0);
  addTile(s, 'wald', -1, 0);
  addTile(s, 'gras', 3, 0);
  camp.target = { x: 1, y: 0 };
  s.hand = 'wachturm';
  s.handPlacementSlots = [[4, 0]];
  const guard = placeHand(s, 4, 0).tile;
  assert.deepEqual(camp.target, { x: 1, y: 0 });
  activateGuard(s, guard);
  assert.deepEqual(camp.target, { x: -1, y: 0 });
  assert.equal(spreadBandits(s, 0)[0].previous.type, 'wald');
  assert.equal(s.tiles['1,0'].type, 'feld');
});

test('global clock attacks after ten active minutes and persists its remainder', () => {
  const s = emptyWorld();
  addTile(s, 'banditen', 0, 0);
  addTile(s, 'feld', 1, 0);
  assert.deepEqual(advanceBandits(s, 10 * 60 * 1000 - 1, 0), []);
  const saved = JSON.parse(JSON.stringify(s));
  assert.equal(saved.tiles['1,0'].type, 'feld');
  assert.equal(advanceBandits(saved, 1, 0).length, 1);
  assert.equal(saved.banditElapsed, 0);
});

test('bandits can capture a workshop', () => {
  const s = emptyWorld();
  addTile(s, 'workshop', 0, 0);
  addTile(s, 'banditen', 1, 0);
  assert.equal(spreadBandits(s, 0)[0].previous.type, 'workshop');
  assert.equal(s.tiles['0,0'].type, 'banditen');
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
  const guard = addTile(s, 'wachturm', 0, 0);
  for (const [x, y] of [[-1, -1], [0, -1], [-1, 0]]) addTile(s, 'haus', x, y);
  activateGuard(s, guard);
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
