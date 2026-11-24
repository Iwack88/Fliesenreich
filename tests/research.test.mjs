import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPANSION_LAND_TILES, LAND_TYPES, PACKS, RESEARCH_COST, RESEARCH_DURATION, RESEARCHED_EXPANSION_COST } from '../src/config.js';
import { addTile, expandWorld, inBounds, migrateState, newState, productionClusters, productionRates, startResearch, tileProduction, updateProduction } from '../src/logic.js';

test('schools require neighboring houses and produce research without changing gold', () => {
  const s = newState();
  s.tiles = {};
  const school = addTile(s, 'schule', 0, 0, 'uncommon');
  assert.equal(tileProduction(s, school).base.forschung, 0);
  assert.equal(tileProduction(s, school).supply.active, false);
  assert.deepEqual(productionClusters(s), []);
  const house = addTile(s, 'haus', 1, 1, 'rare');
  assert.equal(tileProduction(s, school).base.forschung, 4);
  assert.equal(tileProduction(s, school).bonus.forschung, 2);
  assert.equal(productionRates(s).forschung, 6);
  assert.equal(productionRates(s).gold, 0);
  assert.ok(productionClusters(s).some(cluster => cluster.includes(school) && cluster.includes(house)));
  s.productionAt = 0;
  updateProduction(s, 200000);
  assert.equal(s.resources.forschung, 120, 'research has no storage cap');
  delete s.tiles['1,1'];
  updateProduction(s, 210000);
  assert.equal(s.resources.forschung, 120);
  assert.ok(PACKS.humancity.weights.schule > 0);
});

test('research costs points once, completes offline and persists through migration', () => {
  const s = newState();
  delete s.resources.forschung;
  delete s.research;
  assert.equal(migrateState(s, 1000), true);
  assert.equal(s.resources.forschung, 0);
  assert.deepEqual(s.research, { completed: false, endsAt: null });
  s.resources.forschung = RESEARCH_COST - 1;
  assert.equal(startResearch(s, 1000), false);
  s.resources.forschung = RESEARCH_COST + 10;
  assert.equal(startResearch(s, 1000), true);
  assert.equal(s.resources.forschung, 10);
  assert.equal(startResearch(s, 1000), false);
  const loaded = JSON.parse(JSON.stringify(s));
  migrateState(loaded, 1000);
  updateProduction(loaded, 1000 + RESEARCH_DURATION - 1);
  assert.equal(loaded.research.completed, false);
  updateProduction(loaded, 1000 + RESEARCH_DURATION);
  assert.deepEqual(loaded.research, { completed: true, endsAt: null });
  assert.equal(startResearch(loaded, 1000 + RESEARCH_DURATION), false);
});

test('32×32 needs research, the preceding expansion and enough gold', () => {
  const s = newState();
  s.gold = 300;
  assert.equal(expandWorld(s), true);
  assert.equal(s.size, 16);
  assert.equal(expandWorld(s), false);
  s.research.completed = true;
  s.gold = RESEARCHED_EXPANSION_COST - 1;
  assert.equal(expandWorld(s), false);
  const originalTiles = structuredClone(s.tiles);
  const originalSlots = structuredClone(s.specialSlots);
  s.gold = RESEARCHED_EXPANSION_COST;
  assert.equal(expandWorld(s), true);
  assert.equal(s.size, 32);
  assert.equal(s.gold, 0);
  for (const [key, tile] of Object.entries(originalTiles)) assert.deepEqual(s.tiles[key], tile);
  for (const key of Object.keys(originalSlots)) assert.equal(s.specialSlots[key], true);
  const added = Object.entries(s.tiles).filter(([key]) => !originalTiles[key]).map(([, tile]) => tile);
  assert.equal(added.length, EXPANSION_LAND_TILES);
  assert.ok(added.every(tile => LAND_TYPES.includes(tile.type) && !inBounds(16, tile.x, tile.y) && inBounds(32, tile.x, tile.y)));
  assert.equal(expandWorld(s), false);

  const researchedEarly = newState();
  researchedEarly.research.completed = true;
  researchedEarly.gold = 300;
  assert.equal(expandWorld(researchedEarly), true);
  assert.equal(researchedEarly.size, 16);
  assert.equal(expandWorld(researchedEarly), true);
  assert.equal(researchedEarly.size, 32);
});
