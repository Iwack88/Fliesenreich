import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKS } from '../src/config.js';
import { buyPack, packChances } from '../src/logic.js';

test('packs expose the specified chances per card', () => {
  assert.deepEqual(Object.fromEntries(packChances(PACKS.natur)),
    { gras: 30, erde: 25, wasser: 25, feld: 10, wald: 10 });
  assert.deepEqual(Object.fromEntries(packChances(PACKS.basis)),
    { gras: 28, erde: 24, wasser: 24, feld: 10, wald: 10, windmuehle: 2, holzfaeller: 2 });
  assert.ok(PACKS.basis.cost > PACKS.natur.cost);
});

test('each pack uses its own weights for independent draws and appends the cards', (t) => {
  const state = { gold: 50, deck: ['feld'] };
  const values = [0.01, 0.31, 0.56, 0.81, 0.91, 0.01, 0.29, 0.53, 0.97, 0.99];
  t.mock.method(Math, 'random', () => values.shift());
  assert.deepEqual(buyPack(state, 'natur'), ['gras', 'erde', 'wasser', 'feld', 'wald']);
  assert.equal(state.gold, 42);
  assert.deepEqual(buyPack(state, 'basis'), ['gras', 'erde', 'wasser', 'windmuehle', 'holzfaeller']);
  assert.equal(state.gold, 27);
  assert.deepEqual(state.deck.slice(0, 2), ['feld', 'gras']);
  assert.equal(state.deck.length, 11);
});

test('an unaffordable pack does not spend gold or change the deck', () => {
  const state = { gold: 7, deck: ['wald'] };
  assert.equal(buyPack(state, 'natur'), null);
  assert.deepEqual(state, { gold: 7, deck: ['wald'] });
});
