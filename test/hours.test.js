'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { shiftHours, splitOvertime, summarise } = require('../src/lib/hours');

test('hours: shiftHours calculates duration accurately', () => {
  const rec = {
    checkIn: '2026-10-27T08:00:00.000Z',
    checkOut: '2026-10-27T17:30:00.000Z',
  };
  assert.equal(shiftHours(rec), 9.5);

  // Unfinished shift returns 0
  assert.equal(shiftHours({ checkIn: '2026-10-27T08:00:00.000Z', checkOut: null }), 0);

  // Negative or invalid returns 0
  assert.equal(shiftHours({ checkIn: '2026-10-27T18:00:00.000Z', checkOut: '2026-10-27T17:00:00.000Z' }), 0);
});

test('hours: splitOvertime splits at standard threshold', () => {
  assert.deepEqual(splitOvertime(8, 8), { regular: 8, overtime: 0 });
  assert.deepEqual(splitOvertime(6.5, 8), { regular: 6.5, overtime: 0 });
  assert.deepEqual(splitOvertime(11.25, 8), { regular: 8, overtime: 3.25 });
});

test('hours: summarise aggregates multiple shifts on the same day correctly', () => {
  const records = [
    { checkIn: '2026-10-20T08:00:00.000Z', checkOut: '2026-10-20T12:00:00.000Z' }, // 4h
    { checkIn: '2026-10-20T13:00:00.000Z', checkOut: '2026-10-20T18:00:00.000Z' }, // 5h -> total 9h (8 reg + 1 ot)
    { checkIn: '2026-10-21T08:00:00.000Z', checkOut: '2026-10-21T16:00:00.000Z' }, // 8h reg
  ];
  const summary = summarise(records, 8);

  assert.equal(summary.daysWorked, 2);
  assert.equal(summary.totalHours, 17);
  assert.equal(summary.regularHours, 16);
  assert.equal(summary.overtimeHours, 1);
});
