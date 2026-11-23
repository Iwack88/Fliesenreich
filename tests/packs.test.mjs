import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKS, PACK_LAND_WEIGHTS, LAND_TYPES, JOKERS } from '../src/config.js';
import { openPack, packChances } from '../src/logic.js';

const isLand = id => LAND_TYPES.includes(id);

test('displayed chances are per group and sum to 100%', () => {
  for (const pack of Object.values(PACKS)) {
    const { land, value } = packChances(pack);
    for (const group of [land, value]) assert.ok(Math.abs(group.reduce((sum, [, chance]) => sum + chance, 0) - 100) < 1e-10);
    assert.deepEqual(land.map(([id]) => id), Object.keys(PACK_LAND_WEIGHTS));
    assert.ok(value.every(([id]) => !isLand(id) && id !== 'banditen_niete'));
  }
  assert.deepEqual(Object.fromEntries(packChances(PACKS.natur).land), { gras: 30, erde: 30, wasser: 30, berge: 10 });
});

test('packs contain their fixed land cards and one or two value cards', (t) => {
  for (const [id, pack] of Object.entries(PACKS)) {
    for (const [roll, extra, hazard] of [[0.99, false, false], [0, true, pack.hazardChance > 0]]) {
      t.mock.method(Math, 'random', () => roll);
      const state = { packs: { [id]: 1 }, deck: ['wasser'] };
      const cards = openPack(state, id);
      t.mock.restoreAll();
      const values = cards.filter(card => !isLand(card) && card !== 'banditen_niete');
      assert.equal(values.length, extra ? 2 : 1);
      assert.ok(values.every(card => pack.weights[card]));
      assert.equal(cards.filter(card => card === 'banditen_niete').length, hazard ? 1 : 0);
      assert.equal(cards.filter(isLand).length + (hazard ? 1 : 0), pack.land);
      assert.deepEqual(state.deck, ['wasser', ...cards]);
      assert.equal(state.packs[id], 0);
    }
  }
});

test('a missing pack does not change the deck', () => {
  const state = { packs: {}, deck: ['wald'] };
  assert.equal(openPack(state, 'natur'), null);
  assert.deepEqual(state, { packs: {}, deck: ['wald'] });
});

test('pack tiers cost more and take longer as their value cards improve', () => {
  const { natur, basis, humancity, joker } = PACKS;
  assert.ok(natur.cost.holz < basis.cost.holz && basis.cost.holz < humancity.cost.holz);
  assert.ok(natur.duration < basis.duration && basis.duration < humancity.duration);
  assert.ok(Object.keys(humancity.weights).includes('wachturm'));
  assert.deepEqual(Object.keys(joker.weights).sort(), Object.keys(JOKERS).sort());
  assert.equal(joker.hazardChance, 0);
});
