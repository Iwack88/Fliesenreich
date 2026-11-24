import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDIT_CHARGES, BANDIT_INTERVAL, FORTIFY_COST, GUARD_RADIUS, TILES } from '../src/config.js';
import { activateGuard, addTile, advanceBandits, drawCard, fortifyTile, hasTileProtection, isActiveGuard, isBanditAdjacent, isProtected, migrateState, moveOptions, moveTile, newState, placeHand, planBandits, spawnBandit, spreadBandits, swapTiles, undoMove, useJoker } from '../src/logic.js';

function emptyWorld() {
  return { size: 16, gold: 100, resources: { holz: 8, korn: 8 }, productionAt: 0, banditElapsed: 0, packs: {}, nextId: 1, tiles: {}, deck: [], hand: null };
}

test('camps start with three charges, consume one each tick and expire after their final attack', () => {
  const s = emptyWorld();
  const camp = addTile(s, 'banditen', 0, 0);
  assert.equal(camp.charges, BANDIT_CHARGES);
  const first = advanceBandits(s, BANDIT_INTERVAL);
  assert.equal(camp.charges, 2);
  assert.equal(first.captured.length, 1);
  const spawned = first.captured[0].tile;
  assert.equal(spawned.charges, 3, 'new camps do not lose a charge on their birth tick');
  advanceBandits(s, BANDIT_INTERVAL);
  assert.equal(camp.charges, 1);
  assert.equal(spawned.charges, 2);
  const final = advanceBandits(s, BANDIT_INTERVAL);
  assert.ok(final.expired.includes(camp));
  assert.equal(s.tiles['0,0'], undefined);
  assert.equal(spawned.charges, 1);
});

test('blocked camps still consume charges and expire without a target', () => {
  const s = emptyWorld();
  s.size = 2;
  addTile(s, 'wachturm', 0, 0);
  for (const [x, y] of [[-1, -1], [0, -1], [-1, 0]]) addTile(s, 'banditen', x, y);
  const result = advanceBandits(s, BANDIT_INTERVAL * 3);
  assert.equal(result.ticks, 3);
  assert.equal(result.captured.length, 0);
  assert.equal(result.expired.length, 3);
  assert.deepEqual(Object.keys(s.tiles), ['0,0']);
});

test('existing camps receive charges once on migration and keep remaining charges after reload', () => {
  const s = newState();
  const camp = addTile(s, 'banditen', -4, -4);
  delete camp.charges;
  assert.equal(migrateState(s), true);
  assert.equal(camp.charges, 3);
  camp.charges = 1;
  const loaded = JSON.parse(JSON.stringify(s));
  migrateState(loaded);
  assert.equal(loaded.tiles['-4,-4'].charges, 1);
});

test('all neighboring tiles including diagonals are locked regardless of protection', () => {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const s = emptyWorld();
    addTile(s, 'banditen', 0, 0);
    const tile = addTile(s, 'haus', dx, dy);
    assert.equal(fortifyTile(s, tile), true);
    assert.equal(isBanditAdjacent(s, tile), true);
    assert.deepEqual(moveOptions(s, tile), { moves: [], swaps: [] });
    assert.equal(moveTile(s, tile, dx + 2, dy + 2), null);
  }
});

test('locked swap partners cannot be moved; newly adjacent tiles and undo stay locked until camps disappear', () => {
  const s = emptyWorld();
  s.gold = 300;
  const tile = addTile(s, 'haus', 0, 0);
  const blocked = addTile(s, 'feld', 1, 0);
  const camp = addTile(s, 'banditen', 2, 1);
  assert.equal(isBanditAdjacent(s, tile), false);
  assert.equal(isBanditAdjacent(s, blocked), true);
  assert.ok(!moveOptions(s, tile).swaps.some(option => option.tile === blocked));
  assert.equal(swapTiles(s, tile, blocked), null);
  const record = moveTile(s, tile, 1, 1);
  assert.ok(record);
  assert.equal(isBanditAdjacent(s, tile), true);
  assert.deepEqual(moveOptions(s, tile), { moves: [], swaps: [] });
  assert.equal(undoMove(s, record), false);
  camp.charges = 1;
  camp.target = { x: 3, y: 2 };
  const tick = advanceBandits(s, BANDIT_INTERVAL);
  assert.ok(tick.expired.includes(camp));
  assert.equal(isBanditAdjacent(s, tile), false);
  assert.equal(undoMove(s, record), true);
});

test('newly placed tiles are immediately locked next to a camp', () => {
  const s = emptyWorld();
  addTile(s, 'banditen', 0, 0);
  s.hand = 'haus';
  s.handPlacementSlots = [[1, 1]];
  const house = placeHand(s, 1, 1).tile;
  assert.equal(isBanditAdjacent(s, house), true);
  assert.deepEqual(moveOptions(s, house), { moves: [], swaps: [] });
});

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

test('fortification locks movement and swaps, while field protection alone does not', () => {
  const s = emptyWorld();
  s.gold = 300;
  s.protectedFields = { '0,0': true };
  const house = addTile(s, 'haus', 0, 0);
  const other = addTile(s, 'feld', 1, 0);
  assert.ok(moveOptions(s, house).moves.length);
  assert.equal(fortifyTile(s, house), true);
  assert.deepEqual(moveOptions(s, house), { moves: [], swaps: [] });
  assert.equal(moveTile(s, house, 0, 1), null);
  assert.equal(swapTiles(s, house, other), null);
  assert.equal(swapTiles(s, other, house), null);
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
  addTile(s, 'banditen', 2, 1);
  addTile(s, 'banditen', 5, 0);
  addTile(s, 'haus', 1 - GUARD_RADIUS, -GUARD_RADIUS);
  addTile(s, 'haus', 1 - GUARD_RADIUS - 1, 0);
  s.hand = 'wachturm';
  s.handPlacementSlots = [[1, 0]];
  const result = placeHand(s, 1, 0);
  assert.equal(result.cleared, 0);
  assert.equal(isProtected(s, 1, 0), true);
  assert.equal(isProtected(s, 0, 0), false);
  assert.equal(s.tiles['2,1'].type, 'banditen');
  assert.deepEqual(activateGuard(s, result.tile), { cleared: 1 });
  assert.equal(s.tiles['2,1'], undefined);
  assert.equal(s.tiles['5,0'].type, 'banditen');
  assert.equal(isProtected(s, 1 - GUARD_RADIUS, -GUARD_RADIUS), true);
  assert.equal(isProtected(s, 1 - GUARD_RADIUS - 1, 0), false);
  assert.equal(isProtected(s, 2, 0), false, 'empty fields are not shielded');
  assert.equal(activateGuard(s, result.tile), null);
});

test('tower grants permanent protection only to all eight neighbors, for every rarity', () => {
  for (const rarity of ['common', 'uncommon', 'rare', 'epic']) {
    const s = emptyWorld();
    const tower = addTile(s, 'wachturm', 0, 0, rarity);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
      if (x || y) addTile(s, 'haus', x, y);
    }
    const outside = addTile(s, 'haus', 2, 0);
    assert.deepEqual(activateGuard(s, tower), { cleared: 0 });
    for (const tile of Object.values(s.tiles)) {
      if (tile === tower || tile === outside) continue;
      assert.equal(tile.fortified, true);
      assert.deepEqual(moveOptions(s, tile), { moves: [], swaps: [] });
    }
    assert.equal(outside.fortified, undefined);
  }
});

test('loading active towers grants protection to current neighbors but not camps or distant tiles', () => {
  const s = newState();
  s.tiles = {};
  const tower = addTile(s, 'wachturm', 0, 0);
  tower.guardActive = true;
  const house = addTile(s, 'haus', 1, 0);
  delete house.fortified;
  const far = addTile(s, 'haus', 2, 0);
  addTile(s, 'banditen', 0, 1);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(migrateState(loaded), true);
  assert.equal(loaded.tiles['1,0'].fortified, true);
  assert.equal(loaded.tiles['2,0'].fortified, undefined);
  assert.equal(loaded.tiles['0,1'].type, 'banditen');
  assert.equal(migrateState(loaded), false);
  assert.equal(far.fortified, undefined);
});

test('town halls and inactive towers are intrinsically locked', () => {
  const s = emptyWorld();
  const hall = addTile(s, 'rathaus', 0, 0);
  const tower = addTile(s, 'wachturm', 1, 0);
  assert.deepEqual(moveOptions(s, hall), { moves: [], swaps: [] });
  assert.deepEqual(moveOptions(s, tower), { moves: [], swaps: [] });
  assert.equal(swapTiles(s, hall, tower), null);
});

test('all guards lock movement and swaps before and after activation', () => {
  const s = emptyWorld();
  s.gold = 300;
  const guard = addTile(s, 'wachturm', 0, 0);
  const house = addTile(s, 'haus', 1, 0);
  assert.deepEqual(moveOptions(s, guard), { moves: [], swaps: [] });
  assert.equal(swapTiles(s, house, guard), null);
  assert.deepEqual(activateGuard(s, guard), { cleared: 0 });
  assert.deepEqual(moveOptions(s, guard), { moves: [], swaps: [] });
  assert.equal(moveTile(s, guard, 0, 1), null);
  assert.equal(swapTiles(s, house, guard), null);
  assert.equal(house.fortified, true);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(isActiveGuard(restored.tiles['0,0']), true);
  assert.deepEqual(moveOptions(restored, restored.tiles['0,0']), { moves: [], swaps: [] });
});

test('tiles entering tower range are permanently fortified and cannot be moved or undone', () => {
  const s = emptyWorld();
  s.gold = 300;
  const guard = addTile(s, 'wachturm', 0, 0);
  const house = addTile(s, 'haus', 3, 0);
  activateGuard(s, guard);
  const record = moveTile(s, house, 1, 0);
  assert.ok(record);
  assert.equal(house.fortified, true);
  assert.equal(moveTile(s, house, 2, 0), null);
  assert.equal(undoMove(s, record), false);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 0, 0).kind, 'deleted');
  assert.equal(isProtected(s, 1, 0), true);
  assert.equal(moveTile(s, house, 2, 0), null);
});

test('overlapping guards leave durable protection after removal', () => {
  const s = emptyWorld();
  const first = addTile(s, 'wachturm', 0, 0);
  const second = addTile(s, 'wachturm', 2, 0);
  const house = addTile(s, 'haus', 1, 0);
  activateGuard(s, first);
  activateGuard(s, second);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 0, 0).kind, 'deleted');
  assert.equal(isProtected(s, house.x, house.y), true);
  s.hand = 'joker_loeschen';
  assert.equal(useJoker(s, 2, 0).kind, 'deleted');
  assert.equal(isProtected(s, house.x, house.y), true);
});

test('fortification prevents undoing a previous move or swap', () => {
  for (const initiates of [false, true]) {
    const s = emptyWorld();
    const tile = addTile(s, 'feld', 0, 0);
    const house = addTile(s, 'haus', 1, 0);
    const swap = initiates ? swapTiles(s, tile, house) : swapTiles(s, house, tile);
    assert.ok(swap);
    assert.equal(fortifyTile(s, tile), true);
    assert.equal(undoMove(s, swap), false);
  }
});

test('undoing a move into a newly active tower range grants permanent protection', () => {
  const s = emptyWorld();
  const guard = addTile(s, 'wachturm', 0, 0);
  const house = addTile(s, 'haus', 1, 0);
  const record = moveTile(s, house, 2, 0);
  assert.ok(record);
  activateGuard(s, guard);
  assert.equal(undoMove(s, record), true);
  assert.equal(house.fortified, true);
  assert.deepEqual(moveOptions(s, house), { moves: [], swaps: [] });
});

test('entering a guarded empty target replans the attack and active towers do not shield empty cells', () => {
  const s = emptyWorld();
  const guard = addTile(s, 'wachturm', 0, 0);
  const camp = addTile(s, 'banditen', 2, 0);
  activateGuard(s, guard);
  camp.target = { x: 1, y: 0 };
  assert.equal(isProtected(s, 1, 0), false);
  s.hand = 'feld';
  s.handPlacementSlots = [[1, 0]];
  const field = placeHand(s, 1, 0).tile;
  assert.equal(isProtected(s, 1, 0), true);
  assert.equal(field.fortified, true);
  assert.notDeepEqual(camp.target, { x: 1, y: 0 });
  assert.equal(s.tiles['1,0'], field);
});

test('old towers stay inactive on loading and transformation preserves granted protection', t => {
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
  assert.equal(isProtected(s, house.x, house.y), true);
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
  addTile(s, 'banditen', 1, 0);
  const pool = Object.keys(TILES).filter(type => type !== 'gras' && type !== 'banditen');
  t.mock.method(Math, 'random', () => (pool.indexOf('wachturm') + 0.5) / pool.length);
  s.hand = 'joker_verwandeln';
  assert.equal(useJoker(s, 0, 0).cleared, 0);
  assert.equal(s.tiles['0,0'].type, 'wachturm');
  assert.equal(s.tiles['1,0'].type, 'banditen');
  assert.equal(activateGuard(s, s.tiles['0,0']).cleared, 1);
  assert.equal(s.tiles['1,0'], undefined);
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
  activateGuard(guarded, addTile(guarded, 'wachturm', -2, 0));
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
  s.handPlacementSlots = [[2, 0]];
  const guard = placeHand(s, 2, 0).tile;
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
  assert.deepEqual(advanceBandits(s, 10 * 60 * 1000 - 1, 0), { captured: [], expired: [], ticks: 0 });
  const saved = JSON.parse(JSON.stringify(s));
  assert.equal(saved.tiles['1,0'].type, 'feld');
  assert.equal(advanceBandits(saved, 1, 0).captured.length, 1);
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
