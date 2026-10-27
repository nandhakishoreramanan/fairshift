'use strict';

/**
 * Fatigue detection: flags excessive hours and back-to-back shifts.
 */
const { shiftHours, summarise, dayKey, HOUR_MS } = require('./hours');

/**
 * @param {Array} records attendance records for ONE worker
 * @param {object} rules  labour rules from config
 * @param {number} now    epoch ms
 * @returns {{ level: 'ok'|'watch'|'high', flags: Array<object>, weekHours: number }}
 */
function assessFatigue(records, rules, now = Date.now()) {
  const flags = [];
  const weekAgo = now - 7 * 24 * HOUR_MS;
  const recent = records
    .filter((r) => r.checkOut && new Date(r.checkIn).getTime() >= weekAgo)
    .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));

  // 1. Weekly hours
  const summary = summarise(recent, rules.standardDailyHours);
  if (summary.totalHours > rules.maxWeeklyHours) {
    flags.push({ type: 'weekly_hours', hours: summary.totalHours, limit: rules.maxWeeklyHours });
  }

  // 2. Very long days
  for (const d of summary.perDay) {
    if (d.hours > rules.maxDailyHours) {
      flags.push({ type: 'long_day', date: d.date, hours: d.hours, limit: rules.maxDailyHours });
    }
  }

  // 3. Short rest between consecutive shifts (back-to-back)
  for (let i = 1; i < recent.length; i += 1) {
    const gap = (new Date(recent[i].checkIn) - new Date(recent[i - 1].checkOut)) / HOUR_MS;
    if (gap >= 0 && gap < rules.minRestHours) {
      flags.push({
        type: 'short_rest',
        date: dayKey(recent[i].checkIn),
        hours: Math.round(gap * 10) / 10,
        limit: rules.minRestHours,
      });
    }
  }

  // 4. Consecutive working days (looks back further than a week)
  const days = new Set(records.filter((r) => shiftHours(r) > 0).map((r) => dayKey(r.checkIn)));
  let streak = 0;
  const cursor = new Date(dayKey(new Date(now).toISOString()));
  // If today's shift hasn't happened yet, count the streak ending yesterday.
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  if (streak > rules.maxConsecutiveDays) {
    flags.push({ type: 'consecutive_days', days: streak, limit: rules.maxConsecutiveDays });
  }

  const severe = flags.some((f) => f.type === 'weekly_hours' || f.type === 'consecutive_days');
  let level = 'ok';
  if (severe || flags.length >= 3) level = 'high';
  else if (flags.length > 0) level = 'watch';

  return { level, flags, weekHours: summary.totalHours };
}

module.exports = { assessFatigue };
