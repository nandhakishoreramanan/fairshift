'use strict';

/**
 * Explainable attrition ("likely to leave") risk score, 0–100.
 *
 * Uses only signals that are tied to an individual by design (attendance,
 * hours, growth). Anonymous feedback and complaints are deliberately NOT used
 * here, so speaking up can never raise a worker's personal risk score.
 */
const { shiftHours, dayKey, HOUR_MS } = require('./hours');

function daysWorkedBetween(records, fromMs, toMs) {
  const set = new Set();
  for (const r of records) {
    const t = new Date(r.checkIn).getTime();
    if (t >= fromMs && t < toMs && shiftHours(r) > 0) set.add(dayKey(r.checkIn));
  }
  return set.size;
}

/**
 * @param {object} input { records, fatigueLevel, joinedAt, skillsLast90d, now }
 * @returns {{ score:number, level:'low'|'medium'|'high', reasons:string[] }}
 */
function assessAttritionRisk({ records, fatigueLevel, joinedAt, skillsLast90d = 0, now = Date.now() }) {
  const reasons = [];
  let score = 0;
  const DAY = 24 * HOUR_MS;

  const recent = daysWorkedBetween(records, now - 14 * DAY, now);
  const previous = daysWorkedBetween(records, now - 28 * DAY, now - 14 * DAY);
  if (previous > 0 && recent < previous * 0.7) {
    score += 35;
    reasons.push('attendance_drop');
  }

  if (fatigueLevel === 'high') {
    score += 30;
    reasons.push('fatigue_high');
  } else if (fatigueLevel === 'watch') {
    score += 15;
    reasons.push('fatigue_watch');
  }

  const tenureDays = joinedAt ? (now - new Date(joinedAt).getTime()) / DAY : 999;
  if (tenureDays < 90) {
    score += 15;
    reasons.push('new_joiner');
  }

  if (skillsLast90d === 0 && tenureDays > 180) {
    score += 10;
    reasons.push('no_growth');
  }

  score = Math.min(100, score);
  let level = 'low';
  if (score >= 50) level = 'high';
  else if (score >= 25) level = 'medium';
  return { score, level, reasons };
}

module.exports = { assessAttritionRisk };
