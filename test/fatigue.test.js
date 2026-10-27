'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessFatigue } = require('../src/lib/fatigue');

const rules = {
  standardDailyHours: 8,
  overtimeMultiplier: 2,
  maxDailyHours: 12,
  maxWeeklyHours: 60,
  minRestHours: 10,
  maxConsecutiveDays: 6,
};

test('fatigue: flags short rest between back-to-back shifts', () => {
  const records = [
    { checkIn: '2026-10-25T14:00:00.000Z', checkOut: '2026-10-25T23:00:00.000Z' }, // finishes 23:00
    { checkIn: '2026-10-26T06:00:00.000Z', checkOut: '2026-10-26T14:00:00.000Z' }, // starts 06:00 (only 7h rest!)
  ];

  const now = new Date('2026-10-27T00:00:00.000Z').getTime();
  const res = assessFatigue(records, rules, now);

  assert.ok(res.flags.some((f) => f.type === 'short_rest' && f.hours === 7));
  assert.notEqual(res.level, 'ok');
});

test('fatigue: flags excessive weekly hours over 60h', () => {
  const now = new Date('2026-10-27T00:00:00.000Z').getTime();
  const records = [];
  // 6 consecutive days with 11 hours each = 66 hours
  for (let i = 1; i <= 6; i++) {
    const day = 27 - i;
    records.push({
      checkIn: `2026-10-${String(day).padStart(2, '0')}T07:00:00.000Z`,
      checkOut: `2026-10-${String(day).padStart(2, '0')}T18:00:00.000Z`, // 11h
    });
  }

  const res = assessFatigue(records, rules, now);
  assert.equal(res.level, 'high');
  assert.ok(res.flags.some((f) => f.type === 'weekly_hours'));
});
