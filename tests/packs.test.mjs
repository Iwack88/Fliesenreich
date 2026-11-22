import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKS, PACK_FILLER_TYPES } from '../src/config.js';
import { buyPack, packChances } from '../src/logic.js';

test('displayed probabilities include the guarantee and sum to 100%', () => {
  const nature = Object.fromEntries(packChances(PACKS.natur));
  const explorer = Object.fromEntries(packChances(PACKS.basis));
  assert.ok(Math.abs(nature.gras - 18) < 1e-10);
  assert.ok(Math.abs(nature.haus - 15.6) < 1e-10);
  assert.ok(Math.abs(explorer.windmuehle - 100 * (3 * 2 / 100 + 2 * 2 / 24) / 5) < 1e-10);
  assert.equal(explorer.windmuehle, explorer.taverne);
  for (const pack of Object.values(PACKS)) {
    assert.ok(Math.abs(packChances(pack).reduce((sum, [, chance]) => sum + chance, 0) - 100) < 1e-10);
  }
});

test('both packs always contain at least two non-filler cards even with worst-case randomness', (t) => {
  t.mock.method(Math, 'random', () => 0);
  for (const id of Object.keys(PACKS)) {
    const state = { gold: 50, deck: ['wasser'] };
    const cards = buyPack(state, id);
    assert.equal(cards.length, 5);
    assert.equal(cards.filter(card => !PACK_FILLER_TYPES.includes(card)).length, 2);
    assert.deepEqual(state.deck, ['wasser', ...cards]);
    assert.equal(state.gold, 50 - PACKS[id].cost);
  }
});

test('the guaranteed cards are shuffled with the rest of the pack', (t) => {
  t.mock.method(Math, 'random', () => 0);
  const cards = buyPack({ gold: 50, deck: [] }, 'natur');
  assert.ok(PACK_FILLER_TYPES.includes(cards[1]));
  assert.ok(!PACK_FILLER_TYPES.includes(cards[4]));
});

test('an unaffordable pack does not spend gold or change the deck', () => {
  const state = { gold: 7, deck: ['wald'] };
  assert.equal(buyPack(state, 'natur'), null);
  assert.deepEqual(state, { gold: 7, deck: ['wald'] });
});
