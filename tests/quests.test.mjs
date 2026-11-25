import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../src/config.js';
import { addTile, advanceQuest, collectQuestRewards, drawCard, migrateState, newState, placeHand, startPack, useJoker } from '../src/logic.js';

function world(id, now = 1000, reward = { resource: 'holz', amount: 30 }) {
  const s = newState();
  s.tiles = {};
  s.quest = { id, progress: 0, endsAt: now + QUESTS[id].duration, reward };
  s.questRewards = {};
  return s;
}

function place(s, type, x, y, now = 2000) {
  s.hand = type;
  s.handRarity = 'common';
  s.handPlacementSlots = [[x, y]];
  return placeHand(s, x, y, now);
}

test('only successfully played matching cards count, once per quest, and progress persists', () => {
  const s = world('forst');
  addTile(s, 'wald', -2, 0);
  assert.equal(s.quest.progress, 0);
  assert.ok(place(s, 'feld', -1, 0));
  assert.equal(s.quest.progress, 0);
  assert.ok(place(s, 'wald', 0, 0));
  assert.equal(s.quest.progress, 1);
  s.hand = 'wald';
  s.handPlacementSlots = [[1, 0]];
  assert.equal(placeHand(s, 2, 0, 2000), null);
  assert.equal(s.quest.progress, 1);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.ok(place(loaded, 'wald', 1, 0));
  assert.equal(loaded.quest.progress, 2);
  assert.ok(place(loaded, 'wald', 2, 0));
  assert.equal(loaded.questLast.id, 'forst');
  assert.equal(loaded.resources.holz, 38);
  assert.notEqual(loaded.quest.id, 'forst');
  assert.equal(loaded.quest.progress, 0);
});

test('supplier quest checks neighbors at the moment the producer is played', () => {
  const s = world('holzfaeller');
  addTile(s, 'wald', -1, 0);
  addTile(s, 'wald', 0, -1);
  assert.ok(place(s, 'holzfaeller', 0, 0));
  assert.equal(s.quest.progress, 0);
  addTile(s, 'wald', 1, 0);
  assert.equal(s.quest.progress, 0);
  addTile(s, 'wald', 2, 1);
  assert.ok(place(s, 'holzfaeller', 2, 0));
  assert.equal(s.questLast?.id, undefined);
  addTile(s, 'wald', 3, 0);
  addTile(s, 'wald', 2, -2);
  assert.ok(place(s, 'holzfaeller', 2, -1));
  assert.equal(s.questLast.id, 'holzfaeller');
});

test('joker quests count successful targeted or immediate jokers, not invalid attempts', () => {
  const s = world('joker');
  s.size = 8;
  s.hand = 'joker_schutz';
  assert.equal(useJoker(s, 9, 9, 2000), null);
  assert.equal(s.quest.progress, 0);
  assert.ok(useJoker(s, 0, 0, 2000));
  assert.equal(s.questLast.id, 'joker');
  const other = world('joker');
  other.deck = ['joker_freizug'];
  assert.equal(drawCard(other, 2000), 'joker_freizug');
  assert.equal(other.questLast.id, 'joker');
});

test('quest joker completes exactly one active quest and pays its reward', () => {
  const s = world('joker', 1000, { resource: 'forschung', amount: 30 });
  s.deck = ['joker_quest'];
  assert.equal(drawCard(s, 2000), 'joker_quest');
  assert.equal(s.hand, null);
  assert.equal(s.questLast.id, 'joker');
  assert.equal(s.resources.forschung, 30);
  assert.notEqual(s.quest.id, 'joker');
  assert.equal(s.quest.progress, 0);
});

test('rewards exceeding capacity remain available and can be collected later', () => {
  const s = world('joker', 1000, { resource: 'holz', amount: 30 });
  s.resources.holz = 95;
  s.deck = ['joker_quest'];
  drawCard(s, 2000);
  assert.equal(s.resources.holz, 100);
  assert.equal(s.questRewards.holz, 25);
  assert.deepEqual(collectQuestRewards(s), {});
  const loaded = JSON.parse(JSON.stringify(s));
  loaded.resources.holz = 80;
  assert.deepEqual(collectQuestRewards(loaded), { holz: 20 });
  assert.equal(loaded.questRewards.holz, 5);
  loaded.resources.holz = 90;
  assert.deepEqual(collectQuestRewards(loaded), { holz: 5 });
  assert.deepEqual(loaded.questRewards, {});
});

test('expired quests are replaced once on return without retroactive rewards', () => {
  const s = world('forst');
  s.quest.progress = 2;
  const expiredAt = s.quest.endsAt;
  assert.equal(advanceQuest(s, expiredAt - 1), false);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(migrateState(loaded, expiredAt + 5 * 3600000), true);
  assert.equal(loaded.questLast.id, 'forst');
  assert.equal(loaded.questLast.expired, true);
  assert.notEqual(loaded.quest.id, 'forst');
  assert.equal(loaded.quest.progress, 0);
  assert.equal(loaded.resources.holz, 8);
  assert.equal(advanceQuest(loaded, expiredAt + 5 * 3600000), false);
});

test('an action after the deadline cannot complete the expired quest', t => {
  const s = world('forst');
  s.quest.progress = 2;
  t.mock.method(Math, 'random', () => 0);
  assert.ok(place(s, 'wald', 0, 0, s.quest.endsAt));
  assert.equal(s.questLast.id, 'forst');
  assert.equal(s.questLast.expired, true);
  assert.equal(s.quest.id, 'felder');
  assert.equal(s.quest.progress, 0);
  assert.equal(s.resources.holz, 8);
});

test('a quest joker after the deadline completes the replacement, not the expired quest', t => {
  const s = world('forst');
  s.deck = ['joker_quest'];
  t.mock.method(Math, 'random', () => 0);
  drawCard(s, s.quest.endsAt);
  assert.equal(s.questLast.id, 'felder');
  assert.equal(s.questLast.expired, undefined);
  assert.equal(s.gold, 130);
});

test('migration initializes one quest without counting existing buildings', () => {
  const s = newState();
  delete s.quest;
  delete s.questRewards;
  addTile(s, 'wald', -3, -3);
  assert.equal(migrateState(s, 5000), true);
  assert.equal(s.quest.progress, 0);
  assert.equal(s.quest.endsAt, 5000 + QUESTS[s.quest.id].duration);
  assert.deepEqual(s.questRewards, {});
  const quest = JSON.stringify(s.quest);
  migrateState(s, 5001);
  assert.equal(JSON.stringify(s.quest), quest);
});

test('successful crafting starts count, but refused orders do not', () => {
  const s = world('pack');
  assert.equal(startPack(s, 'natur', 2000), false);
  assert.equal(s.quest.progress, 0);
  s.resources.holz = 90;
  s.resources.korn = 90;
  assert.equal(startPack(s, 'natur', 2000), true);
  assert.equal(s.questLast.id, 'pack');
});
