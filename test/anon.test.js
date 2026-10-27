'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { anonToken, coarseTimestamp } = require('../src/lib/anon');

test('anon: collective grievance token privacy guarantees', () => {
  const secret = 'test-secret-pepper-for-anonymity-999';

  const token1 = anonToken(secret, 'W1001', 'I100');
  const token2 = anonToken(secret, 'W1001', 'I100'); // same worker, same issue
  const tokenOtherIssue = anonToken(secret, 'W1001', 'I101'); // same worker, different issue
  const tokenOtherWorker = anonToken(secret, 'W1002', 'I100'); // different worker, same issue

  // 1. Deterministic for same (worker, issue) to allow idempotent "Me Too" voting
  assert.equal(token1, token2);

  // 2. Unlinkable across different issues (prevents cross-issue profiling)
  assert.notEqual(token1, tokenOtherIssue);

  // 3. Distinct across different workers
  assert.notEqual(token1, tokenOtherWorker);

  // 4. Token never contains raw worker ID
  assert.equal(token1.includes('W1001'), false);
  assert.equal(token1.length, 24);
});

test('anon: coarseTimestamp removes minutes/seconds to avoid shift timing correlation', () => {
  const now = new Date('2026-10-27T10:45:32.123Z').getTime();
  const rounded = coarseTimestamp(now);

  const d = new Date(rounded);
  assert.equal(d.getUTCMinutes(), 0);
  assert.equal(d.getUTCSeconds(), 0);
  assert.equal(d.getUTCMilliseconds(), 0);
  assert.equal(rounded, '2026-10-27T10:00:00.000Z');
});
