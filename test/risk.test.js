'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessAttritionRisk } = require('../src/lib/risk');

test('risk: detects attendance drop and severe fatigue', () => {
  const now = 1700000000000;
  const DAY = 24 * 3600 * 1000;

  // Previous 14 days had 10 shifts, recent 14 days only has 2 shifts
  const records = [];
  // 10 shifts between 14 and 28 days ago
  for (let i = 15; i <= 24; i++) {
    records.push({
      checkIn: new Date(now - i * DAY).toISOString(),
      checkOut: new Date(now - i * DAY + 8 * 3600 * 1000).toISOString(),
    });
  }
  // 2 shifts in last 14 days
  records.push({
    checkIn: new Date(now - 3 * DAY).toISOString(),
    checkOut: new Date(now - 3 * DAY + 8 * 3600 * 1000).toISOString(),
  });
  records.push({
    checkIn: new Date(now - 2 * DAY).toISOString(),
    checkOut: new Date(now - 2 * DAY + 8 * 3600 * 1000).toISOString(),
  });

  const res = assessAttritionRisk({
    records,
    fatigueLevel: 'high',
    joinedAt: new Date(now - 300 * DAY).toISOString(),
    skillsLast90d: 0,
    now,
  });

  assert.equal(res.level, 'high');
  assert.ok(res.reasons.includes('attendance_drop'));
  assert.ok(res.reasons.includes('fatigue_high'));
});

test('risk: low risk for stable, rested workers', () => {
  const now = 1700000000000;
  const DAY = 24 * 3600 * 1000;

  const records = [];
  for (let i = 1; i <= 24; i++) {
    if (i % 7 === 0) continue; // 1 day off a week
    records.push({
      checkIn: new Date(now - i * DAY).toISOString(),
      checkOut: new Date(now - i * DAY + 8 * 3600 * 1000).toISOString(),
    });
  }

  const res = assessAttritionRisk({
    records,
    fatigueLevel: 'ok',
    joinedAt: new Date(now - 400 * DAY).toISOString(),
    skillsLast90d: 1,
    now,
  });

  assert.equal(res.level, 'low');
  assert.equal(res.score, 0);
});
