import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKS, LAND_TYPES, JOKERS } from '../src/config.js';
import { openPack, packChances } from '../src/logic.js';

const isLand = id => LAND_TYPES.includes(id);

test('displayed value card chances sum to 100% and exclude landscape', () => {
  for (const pack of Object.values(PACKS)) {
    const { value } = packChances(pack);
    assert.ok(Math.abs(value.reduce((sum, [, chance]) => sum + chance, 0) - 100) < 1e-10);
    assert.ok(value.every(([id]) => !isLand(id) && id !== 'banditen_niete'));
  }
});

test('packs contain two value cards and at most one optional value card or hazard', (t) => {
  for (const [id, pack] of Object.entries(PACKS)) {
    const rolls = [0, pack.hazardChance, pack.hazardChance + pack.extraChance, 0.99];
    for (const roll of rolls) {
      t.mock.method(Math, 'random', () => roll);
      const state = { packs: { [id]: 1 }, deck: ['wasser'] };
      const cards = openPack(state, id);
      t.mock.restoreAll();
      const values = cards.filter(card => !isLand(card) && card !== 'banditen_niete');
      const hazard = roll < pack.hazardChance;
      const extra = !hazard && roll < pack.hazardChance + pack.extraChance;
      assert.equal(values.length, extra ? 3 : 2);
      assert.ok(values.every(card => pack.weights[card]));
      assert.equal(cards.filter(card => card === 'banditen_niete').length, hazard ? 1 : 0);
      assert.equal(cards.filter(isLand).length, 0);
      assert.ok(cards.length <= 3);
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
