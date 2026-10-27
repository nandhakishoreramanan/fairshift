'use strict';

/**
 * Working-hours and overtime calculation.
 * Attendance record shape: { workerId, siteId, checkIn: ISO, checkOut: ISO|null, method }
 */

const HOUR_MS = 3600 * 1000;
const IST_OFFSET_MIN = 330;

/** Calendar day key (YYYY-MM-DD) in the organisation's local time zone. */
function dayKey(iso, offsetMinutes = IST_OFFSET_MIN) {
  const t = new Date(iso).getTime() + offsetMinutes * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Hours worked in one shift (0 if still open or invalid). Rounded to 2 dp. */
function shiftHours(record) {
  if (!record || !record.checkIn || !record.checkOut) return 0;
  const ms = new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / HOUR_MS) * 100) / 100;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Split a day's hours into regular and overtime. */
function splitOvertime(hours, standardDailyHours) {
  const regular = Math.min(hours, standardDailyHours);
  return { regular: round2(regular), overtime: round2(Math.max(0, hours - standardDailyHours)) };
}

/**
 * Summarise a list of attendance records into per-day totals.
 * Overtime is computed per calendar day (multiple shifts in a day are added up first).
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
