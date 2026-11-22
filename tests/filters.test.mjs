import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../src/config.js';
import { matchesTileFilter } from '../src/logic.js';

test('resource filters highlight the complete production and storage chain', () => {
  const chains = {
    holz: ['wald', 'holzfaeller', 'lagerhalle'],
    korn: ['feld', 'windmuehle', 'kornlager'],
    gold: ['haus', 'taverne', 'goldlager'],
  };
  for (const [id, expected] of Object.entries(chains)) {
    const matches = Object.keys(TILES).filter(type => matchesTileFilter({ type }, { kind: 'resource', id }));
    assert.deepEqual(new Set(matches), new Set(expected));
  }
});

test('tile filters match only the selected type and reflect changes to a tile', () => {
  const tile = { type: 'feld' };
  const filter = { kind: 'tile', id: 'feld' };
  assert.equal(matchesTileFilter(tile, filter), true);
  tile.type = 'windmuehle';
  assert.equal(matchesTileFilter(tile, filter), false);
  assert.equal(matchesTileFilter(tile, { kind: 'resource', id: 'korn' }), true);
});
