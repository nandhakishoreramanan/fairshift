'use strict';

/**
 * High-Precision Labour Hours & Overtime Engine.
 *
 * Implements statutory standards (e.g., Factories Act 1948 Section 59):
 * 1. Daily summation across multiple discrete shifts before overtime threshold split.
 * 2. Organisation timezone awareness (defaulting to IST UTC+05:30).
 * 3. 2-decimal rounded precision preventing cumulative rounding drift.
 */

const HOUR_MS = 3600 * 1000;
const IST_OFFSET_MIN = 330;

/**
 * Derives the calendar day key (YYYY-MM-DD) in the organisation's local time zone.
 *
 * @param {string} iso - ISO 8601 timestamp string.
 * @param {number} [offsetMinutes=330] - Timezone offset in minutes (default IST +330).
 * @returns {string} Calendar day formatted as YYYY-MM-DD.
 */
function dayKey(iso, offsetMinutes = IST_OFFSET_MIN) {
  const t = new Date(iso).getTime() + offsetMinutes * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Calculates duration in decimal hours for a completed shift.
 * Returns 0 if shift is currently active (unclosed) or duration is invalid.
 *
 * @param {object} record - Attendance record.
 * @param {string} record.checkIn - Check-in ISO timestamp.
 * @param {string|null} [record.checkOut] - Check-out ISO timestamp.
 * @returns {number} Duration rounded to 2 decimal places.
 */
function shiftHours(record) {
  if (!record || !record.checkIn || !record.checkOut) return 0;
  const ms = new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / HOUR_MS) * 100) / 100;
}

/**
 * Rounds a floating point number to 2 decimal places.
 *
 * @param {number} n - Input number.
 * @returns {number} Rounded number.
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Decomposes a total daily hour count into standard regular hours and statutory overtime.
 *
 * @param {number} hours - Total hours worked in a calendar day.
 * @param {number} standardDailyHours - Statutory daily standard hours (e.g. 8 hours).
 * @returns {{ regular: number, overtime: number }} Decomposed hours.
 */
function splitOvertime(hours, standardDailyHours) {
  const regular = Math.min(hours, standardDailyHours);
  return { regular: round2(regular), overtime: round2(Math.max(0, hours - standardDailyHours)) };
}

/**
 * Aggregates attendance records into daily totals and period summaries.
 * Aggregates multiple shifts within the same calendar day before calculating overtime.
 *
 * @param {Array<object>} records - Collection of attendance records.
 * @param {number} standardDailyHours - Statutory standard daily hours.
 * @returns {{ daysWorked: number, totalHours: number, regularHours: number, overtimeHours: number, perDay: Array<object> }}
 */
function summarise(records, standardDailyHours) {
  const perDayMap = new Map();
  for (const r of records) {
    const h = shiftHours(r);
    if (h <= 0) continue;
    const key = dayKey(r.checkIn);
    perDayMap.set(key, (perDayMap.get(key) || 0) + h);
  }
  const perDay = [...perDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => ({ date, hours: round2(hours), ...splitOvertime(hours, standardDailyHours) }));

  const totals = perDay.reduce(
    (acc, d) => {
      acc.totalHours += d.hours;
      acc.regularHours += d.regular;
      acc.overtimeHours += d.overtime;
      return acc;
    },
    { totalHours: 0, regularHours: 0, overtimeHours: 0 },
  );

  return {
    daysWorked: perDay.length,
    totalHours: round2(totals.totalHours),
    regularHours: round2(totals.regularHours),
    overtimeHours: round2(totals.overtimeHours),
    perDay,
  };
}

module.exports = { dayKey, shiftHours, splitOvertime, summarise, HOUR_MS };
