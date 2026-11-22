import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, SHOP_INTERVAL, SHOP_DURATION, SHOP_PRICES, SHOP_DISCOUNT } from '../src/config.js';
import { newState, migrateState, shopStatus, advanceShop, buyShopCard } from '../src/logic.js';

test('sales open after five active minutes, close after one, and do not advance offline', () => {
  const s = newState();
  assert.deepEqual(shopStatus(s), { open: false, remaining: SHOP_INTERVAL });
  advanceShop(s, SHOP_INTERVAL - 1);
  assert.equal(shopStatus(s).open, false);
  advanceShop(s, 1);
  assert.deepEqual(shopStatus(s), { open: true, remaining: SHOP_DURATION });
  assert.equal(s.shop.offers.length, 4);
  assert.equal(new Set(s.shop.offers.map(o => o.card)).size, 4);
  const loaded = JSON.parse(JSON.stringify(s));
  migrateState(loaded, Date.now() + 3600000);
  advanceShop(loaded, 0);
  assert.deepEqual(loaded.shop, s.shop);
  advanceShop(s, SHOP_DURATION);
  assert.deepEqual(shopStatus(s), { open: false, remaining: SHOP_INTERVAL - SHOP_DURATION });
  assert.equal(buyShopCard(s, s.shop.offers[0].card, s.shop.round), false);
  assert.throws(() => advanceShop(s, -1), /Shop-Zeit/);
});

test('buying charges the discounted price once and preserves the hand and saved purchase', () => {
  const s = newState();
  s.gold = 1000;
  s.hand = 'wald';
  advanceShop(s, SHOP_INTERVAL);
  const { card, price } = s.shop.offers[0];
  assert.equal(price, Math.round(SHOP_PRICES[CARDS[card].rarity] * (1 - SHOP_DISCOUNT)));
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
  assert.equal(loaded.gold, s.gold);
});

test('new sales replace stock, reject stale offers and can offer every playable card', (t) => {
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
  advanceShop(s, SHOP_INTERVAL * 2 + SHOP_DURATION);
  assert.equal(s.shop.round, 62);
  assert.equal(shopStatus(s).open, false);
});

test('old saves receive a closed shop without losing gold or cards', () => {
  const s = newState();
  delete s.shop;
  const gold = s.gold, deck = [...s.deck];
  assert.equal(migrateState(s), true);
  assert.deepEqual(shopStatus(s), { open: false, remaining: SHOP_INTERVAL });
  assert.equal(s.gold, gold);
  assert.deepEqual(s.deck, deck);
  assert.equal(migrateState(s), false);
});
