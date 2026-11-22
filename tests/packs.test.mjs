import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKS, PACK_FILLER_TYPES } from '../src/config.js';
import { openPack, packChances } from '../src/logic.js';

test('displayed probabilities include the guarantee and sum to 100%', () => {
  const nature = Object.fromEntries(packChances(PACKS.natur));
  const explorer = Object.fromEntries(packChances(PACKS.basis));
  assert.ok(Math.abs(nature.gras - 100 * (3 * 26 / 105) / 5) < 1e-10);
  assert.ok(Math.abs(nature.haus - 100 * (3 * 6 / 105 + 2 * 6 / 27) / 5) < 1e-10);
  assert.ok(Math.abs(explorer.windmuehle - 100 * (3 * 2 / 105 + 2 * 2 / 35) / 5) < 1e-10);
  assert.equal(explorer.windmuehle, explorer.taverne);
  assert.ok(explorer.joker_loeschen > 0);
  assert.equal(explorer.joker_loeschen, explorer.joker_verwandeln);
  assert.equal(nature.joker_loeschen, undefined);
  assert.ok(Math.abs(nature.banditen_niete - 100 * 3 * 2 / 105 / 5) < 1e-10);
  assert.equal(explorer.banditen_niete, nature.banditen_niete);
  for (const pack of Object.values(PACKS)) {
    const chances = packChances(pack);
    assert.ok(Object.fromEntries(chances).joker_schutz > 0);
    for (const id of ['lagerhalle', 'kornlager', 'goldlager', 'werkzeugschmiede']) assert.ok(Object.fromEntries(chances)[id] > 0);
    assert.ok(Math.abs(chances.reduce((sum, [, chance]) => sum + chance, 0) - 100) < 1e-10);
  }
});

test('all packs always contain at least two non-filler cards even with worst-case randomness', (t) => {
  t.mock.method(Math, 'random', () => 0);
  for (const id of Object.keys(PACKS)) {
    const state = { packs: { [id]: 1 }, deck: ['wasser'] };
    const cards = openPack(state, id);
    assert.equal(cards.length, 5);
    assert.equal(cards.filter(card => !PACK_FILLER_TYPES.includes(card)).length, 2);
    assert.deepEqual(state.deck, ['wasser', ...cards]);
    assert.equal(state.packs[id], 0);
  }
});

test('the guaranteed cards are shuffled with the rest of the pack', (t) => {
  t.mock.method(Math, 'random', () => 0);
  const cards = openPack({ packs: { natur: 1 }, deck: [] }, 'natur');
  assert.ok(PACK_FILLER_TYPES.includes(cards[1]));
  assert.ok(!PACK_FILLER_TYPES.includes(cards[4]));
});

test('a missing pack does not change the deck', () => {
  const state = { packs: {}, deck: ['wald'] };
  assert.equal(openPack(state, 'natur'), null);
  assert.deepEqual(state, { packs: {}, deck: ['wald'] });
});

test('HumanCity offers houses, taverns and guards with guarantee-adjusted chances', () => {
  const chances = Object.fromEntries(packChances(PACKS.humancity));
  assert.ok(Math.abs(chances.wachturm - 100 * (3 * 8 / 107 + 2 * 8 / 57) / 5) < 1e-10);
  assert.ok(Math.abs(chances.haus - 100 * (3 * 30 / 107 + 2 * 30 / 57) / 5) < 1e-10);
  assert.ok(Math.abs(chances.taverne - 100 * (3 * 12 / 107 + 2 * 12 / 57) / 5) < 1e-10);
  assert.ok(Math.abs(chances.banditen_niete - 100 * 3 * 5 / 107 / 5) < 1e-10);
});
