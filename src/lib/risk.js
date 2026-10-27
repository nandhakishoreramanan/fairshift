'use strict';

/**
 * Explainable Attrition & Flight-Risk Analytics Engine.
 * Computes transparent risk indices from 0–100 with actionable human-readable drivers.
 *
 * Ethical AI Guardrails:
 * -----------------------
 * Anonymous grievances and pulse ratings are deliberately EXCLUDED from this calculation.
 * Filing a safety concern or exercising whistleblowing rights can NEVER adversely affect
 * a worker's personal attrition risk profile or supervisor visibility.
 */
const { shiftHours, dayKey, HOUR_MS } = require('./hours');

/**
 * Counts unique calendar days worked by a worker within a millisecond timeframe.
 *
 * @param {Array<object>} records - Attendance records.
 * @param {number} fromMs - Window start in epoch milliseconds.
 * @param {number} toMs - Window end in epoch milliseconds.
 * @returns {number} Unique days worked.
 */
function daysWorkedBetween(records, fromMs, toMs) {
  const set = new Set();
  for (const r of records) {
    const t = new Date(r.checkIn).getTime();
    if (t >= fromMs && t < toMs && shiftHours(r) > 0) set.add(dayKey(r.checkIn));
  }
  return set.size;
}

/**
 * Assesses holistic attrition probability and generates specific diagnostic risk drivers.
 *
 * @param {object} input - Worker telemetry data.
 * @param {Array<object>} input.records - Historical attendance records.
 * @param {'ok'|'watch'|'high'} input.fatigueLevel - Assessed fatigue severity.
 * @param {string} [input.joinedAt] - ISO timestamp of joining date.
 * @param {number} [input.skillsLast90d=0] - Number of skill credentials acquired in the last 90 days.
 * @param {number} [input.now=Date.now()] - Current epoch timestamp.
 * @returns {{ score: number, level: 'low'|'medium'|'high', reasons: Array<string> }} Assessed risk metrics.
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
