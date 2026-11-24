import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, SHOP_INTERVAL, SHOP_PRICES, SHOP_DISCOUNT } from '../src/config.js';
import { newState, migrateState, shopStatus, advanceShop, buyShopCard, drawCard } from '../src/logic.js';

test('shop is open immediately and refreshes after five active minutes', () => {
  const s = newState();
  assert.deepEqual(shopStatus(s), { open: true, remaining: SHOP_INTERVAL });
  assert.equal(s.shop.offers.length, 4);
  assert.equal(new Set(s.shop.offers.map(o => o.card)).size, 4);
  const original = JSON.stringify(s.shop.offers);
  advanceShop(s, SHOP_INTERVAL - 1);
  assert.equal(JSON.stringify(s.shop.offers), original);
  assert.equal(shopStatus(s).remaining, 1);
  advanceShop(s, 1);
  assert.equal(s.shop.round, 2);
  assert.deepEqual(shopStatus(s), { open: true, remaining: SHOP_INTERVAL });
  const loaded = JSON.parse(JSON.stringify(s));
  migrateState(loaded, Date.now() + 3600000);
  assert.deepEqual(loaded.shop, s.shop);
  assert.throws(() => advanceShop(s, -1), /Shop-Zeit/);
});

test('buying charges once and survives reload until the next refresh', () => {
  const s = newState();
  s.gold = 1000;
  s.hand = 'wald';
  const { card, price } = s.shop.offers[0];
  assert.equal(price, Math.round(SHOP_PRICES[CARDS[card].shopTier || CARDS[card].rarity] * (1 - SHOP_DISCOUNT)));
  const before = [...s.deck];
  assert.equal(buyShopCard(s, 'banditen', s.shop.round), false);
  s.gold = price - 1;
  assert.equal(buyShopCard(s, card, s.shop.round), false);
  assert.deepEqual(s.deck, before);
  s.gold = 1000;
  assert.equal(buyShopCard(s, card, s.shop.round), true);
  assert.equal(s.gold, 1000 - price);
  assert.deepEqual(s.deck, [...before, card]);
  assert.equal(s.hand, 'wald');
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(buyShopCard(loaded, card, loaded.shop.round), false);
});

test('refreshes replace stock, reject stale offers and can offer every playable card', t => {
  let seed = 42;
  t.mock.method(Math, 'random', () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
  const s = newState();
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    advanceShop(s, SHOP_INTERVAL);
    for (const offer of s.shop.offers) {
      seen.add(offer.card);
      assert.equal(offer.bought, false);
    }
    assert.equal(buyShopCard(s, s.shop.offers[0].card, s.shop.round - 1), false);
  }
  assert.deepEqual(seen, new Set(Object.keys(CARDS).filter(id => id !== 'banditen')));
  const before = s.shop.round;
  advanceShop(s, SHOP_INTERVAL * 2 + 60000);
  assert.equal(s.shop.round, before + 2);
  assert.deepEqual(shopStatus(s), { open: true, remaining: SHOP_INTERVAL - 60000 });
});

test('landscape shop offers survive migration and can be purchased', () => {
  const s = newState();
  s.deck = ['gras', 'haus'];
  s.deckRarities = ['rare', 'common'];
  s.hand = 'wasser';
  s.handRarity = 'epic';
  s.shop.offers = [{ card: 'berge', price: 60, bought: false }, { card: 'haus', price: 60, bought: true }];
  assert.equal(migrateState(s), true);
  assert.deepEqual(s.shop.offers, [{ card: 'berge', price: 60, bought: false }, { card: 'haus', price: 60, bought: true }]);
  assert.deepEqual(s.deck, ['gras', 'haus']);
  assert.deepEqual(s.deckRarities, ['rare', 'common']);
  assert.equal(s.hand, 'wasser');
  assert.equal(s.handRarity, 'epic');
  assert.equal(migrateState(s), false);
  assert.equal(buyShopCard(s, 'berge', s.shop.round), true);
  assert.equal(s.deck.at(-1), 'berge');
});

test('old saves keep their stock, purchase flags and timer or receive initial offers', () => {
  const s = newState();
  s.shop.elapsed = 180000;
  s.shop.offers[0].bought = true;
  const saved = JSON.stringify(s.shop);
  assert.equal(migrateState(s), false);
  assert.equal(JSON.stringify(s.shop), saved);
  s.shop = { elapsed: 180000, round: 0, offers: [] };
  assert.equal(migrateState(s), true);
  assert.equal(s.shop.offers.length, 4);
  assert.equal(s.shop.elapsed, 180000);
  assert.equal(migrateState(s), false);
  delete s.shop;
  assert.equal(migrateState(s), true);
  assert.equal(s.shop.offers.length, 4);
  assert.equal(s.shop.elapsed, 0);
});

test('shop joker refreshes immediately, resets timer and invalidates prior offers', () => {
  const s = newState();
  s.deck = ['joker_shop'];
  s.deckRarities = ['rare'];
  s.shop.elapsed = 220000;
  const round = s.shop.round;
  const oldCard = s.shop.offers[0].card;
  s.shop.offers[0].bought = true;
  assert.equal(drawCard(s), 'joker_shop');
  assert.equal(s.hand, null);
  assert.equal(s.shop.round, round + 1);
  assert.equal(s.shop.elapsed, 0);
  assert.ok(s.shop.offers.every(offer => !offer.bought));
  assert.equal(buyShopCard(s, oldCard, round), false);
  assert.deepEqual(JSON.parse(JSON.stringify(s)).shop, s.shop);
});

test('deleting the next card pays gold, but landscape and hazard cards are protected', async () => {
  const { newState, canDeleteCard, deleteNextCard, storageCapacity } = await import('../src/logic.js');
  const s = newState();
  s.deck = ['berge', 'holzfaeller', 'gras', 'banditen_niete'];
  s.deckRarities = ['common', 'common', 'common', 'common'];
  assert.equal(canDeleteCard(s), false);
  assert.equal(deleteNextCard(s), null);
  s.deck.shift(); s.deckRarities.shift();
  const gold = s.gold;
  assert.equal(deleteNextCard(s), 'holzfaeller');
  assert.equal(s.gold, Math.min(gold + 10, Math.max(gold, storageCapacity(s).gold)));
  assert.deepEqual(s.deck, ['gras', 'banditen_niete']);
  assert.equal(s.deckRarities.length, 2);
  assert.equal(canDeleteCard(s), false);
});
