import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUARD_RADIUS, SHOP_INTERVAL, TILES, LAND_TYPES } from '../src/config.js';
import { addTile, advanceShop, buyShopCard, drawCard, guardRadius, isProtected, migrateState, newState, openPack, pairValue, placeHand, productionRates, returnHand, rollRarity, shuffleDeck, storageCapacity, tileProduction, useJoker } from '../src/logic.js';

test('tile rarity rolls use the agreed thresholds and leave jokers unchanged', t => {
  let value = 0;
  t.mock.method(Math, 'random', () => value);
  for (const [random, expected] of [[0, 'common'], [.6999, 'common'], [.7, 'uncommon'], [.8999, 'uncommon'], [.9, 'rare'], [.9799, 'rare'], [.98, 'epic'], [.999, 'epic']]) {
    value = random;
    assert.equal(rollRarity('windmuehle'), expected);
  }
  assert.equal(rollRarity('joker_loeschen'), 'rare');
});

test('rarity is rolled on pack opening, survives shuffle, return, reload and placement', t => {
  const s = newState();
  s.tiles = { '0,0': s.tiles['0,0'] };
  s.deck = [];
  s.deckRarities = [];
  s.packs.starthilfe = 1;
  t.mock.method(Math, 'random', () => .99);
  const cards = openPack(s, 'starthilfe');
  assert.equal(cards.length, 3);
  assert.deepEqual(s.deckRarities, Array(3).fill('epic'));
  s.deckRarities[0] = 'rare';
  const pairs = () => s.deck.map((type, i) => `${type}:${s.deckRarities[i]}`).sort();
  const expected = pairs();
  assert.equal(shuffleDeck(s), true);
  assert.deepEqual(pairs(), expected);
  const first = s.deck[0], rarity = s.deckRarities[0];
  assert.equal(drawCard(s), first);
  assert.equal(s.handRarity, rarity);
  assert.equal(returnHand(s), true);
  assert.equal(s.deck.at(-1), first);
  assert.equal(s.deckRarities.at(-1), rarity);
  let restored = JSON.parse(JSON.stringify(s));
  while (restored.deck[0] !== first) {
    drawCard(restored);
    returnHand(restored);
  }
  drawCard(restored);
  restored = JSON.parse(JSON.stringify(restored));
  assert.equal(restored.handRarity, rarity);
  assert.equal(placeHand(restored, 1, 0).tile.rarity, rarity);
});

test('old saves keep their existing production and gain common tile rarities', () => {
  const s = newState();
  s.tiles = {};
  const mill = addTile(s, 'windmuehle', 0, 0);
  delete mill.rarity;
  s.deck = ['wald', 'joker_loeschen'];
  s.hand = 'holzfaeller';
  delete s.deckRarities;
  delete s.handRarity;
  assert.equal(migrateState(s), true);
  assert.deepEqual(s.deckRarities, ['common', 'rare']);
  assert.equal(s.handRarity, 'common');
  assert.equal(tileProduction(s, mill).base.korn, 1);
  assert.equal(migrateState(s), false);
});

test('production and pair buffs use rarity without extending adjacency or double-counting gold', () => {
  const s = { tiles: {}, nextId: 1 };
  const mill = addTile(s, 'windmuehle', 0, 0, 'epic');
  const field = addTile(s, 'feld', 1, 0, 'uncommon');
  addTile(s, 'feld', 1, 1, 'epic');
  assert.equal(tileProduction(s, mill).base.korn, 16);
  assert.equal(tileProduction(s, mill).bonus.korn, 4);
  assert.equal(tileProduction(s, field).base.korn, 0);
  assert.equal(pairValue(mill, field), pairValue(field, mill));
  const house = addTile(s, 'haus', 0, 3, 'rare');
  const tavern = addTile(s, 'taverne', 1, 3, 'uncommon');
  assert.equal(pairValue(house, tavern), 6);
  assert.deepEqual(productionRates(s), { holz: 0, korn: 20, gold: 6, werkzeug: 0 });
});

test('rarity strengthens storage, workshops, forges and guards', () => {
  const s = newState();
  const workshop = s.tiles['0,0'];
  workshop.type = 'workshop';
  s.tiles = { '0,0': workshop };
  workshop.rarity = 'rare';
  s.resources = { holz: 100, korn: 100 };
  s.hand = 'werkzeugschmiede';
  s.handRarity = 'uncommon';
  placeHand(s, 1, 0, 96000);
  assert.equal(tileProduction(s, workshop).base.werkzeug, 3, 'rare workshop in emergency mode');
  s.hand = 'werkzeugschmiede';
  s.handRarity = 'rare';
  placeHand(s, -1, 0);
  const { base, bonus } = tileProduction(s, workshop);
  assert.equal(base.werkzeug, 2 * 3 * 2);
  assert.equal(bonus.werkzeug, 1 + 2);
  const storage = addTile(s, 'lagerhalle', 2, 0, 'epic');
  assert.equal(storageCapacity(s).holz, 300);
  s.hand = 'joker_loeschen';
  s.resources.holz = 250;
  const result = useJoker(s, storage.x, storage.y);
  assert.equal(result.losses.holz, 150);
  const guard = addTile(s, 'wachturm', 0, 4, 'rare');
  assert.equal(guardRadius(guard), GUARD_RADIUS + 2);
  assert.equal(isProtected(s, 5, 4), true);
  assert.equal(isProtected(s, 6, 4), false);
});

test('shop purchases roll once and preserve the resulting tile rarity', t => {
  const s = newState();
  s.gold = 1000;
  advanceShop(s, SHOP_INTERVAL);
  const offer = s.shop.offers[0];
  offer.card = 'windmuehle';
  t.mock.method(Math, 'random', () => .99);
  assert.equal(buyShopCard(s, offer.card, s.shop.round), true);
  assert.equal(s.deck.at(-1), 'windmuehle');
  assert.equal(s.deckRarities.at(-1), 'epic');
  assert.equal(buyShopCard(s, offer.card, s.shop.round), false);
});

test('transformation keeps rarity', t => {
  const s = newState();
  const workshop = s.tiles['0,0'];
  workshop.type = 'workshop';
  s.tiles = { '0,0': workshop };
  s.resources = { holz: 100, korn: 100 };
  const tile = addTile(s, 'gras', 1, 0, 'uncommon');
  const types = Object.keys(TILES).filter(type => type !== 'banditen' && !LAND_TYPES.includes(type));
  t.mock.method(Math, 'random', () => (types.indexOf('werkzeugschmiede') + .5) / types.length);
  s.hand = 'joker_verwandeln';
  const result = useJoker(s, 1, 0, 90000);
  assert.equal(result.tile, tile);
  assert.equal(tile.rarity, 'uncommon');
  assert.equal(tileProduction(s, workshop).supply.count, 1);
});
