'use strict';

/**
 * Workforce Analytics & Predictive Insights Subsystem.
 * Computes fatigue diagnostics, payroll aggregations, and attrition risks.
 */
const config = require('../config');
const { summarise, shiftHours, dayKey } = require('../lib/hours');
const { assessFatigue } = require('../lib/fatigue');
const { assessAttritionRisk } = require('../lib/risk');
const { calculatePayslip } = require('../lib/payroll');
const { FEEDBACK_TOPICS } = require('../data/seed');

const DAY_MS = 24 * 3600 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * Derives epoch-ms boundaries of a calendar month in IST timezone.
 *
 * @param {number} now - Reference epoch millisecond timestamp.
 * @param {number} [offset=0] - Month offset (0 = current month, 1 = previous month).
 * @returns {{ from: number, to: number, label: string }}
 */
function monthBounds(now, offset = 0) {
  const local = new Date(now + IST_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() - offset;
  const from = Date.UTC(y, m, 1) - IST_OFFSET_MS;
  const to = Math.min(Date.UTC(y, m + 1, 1) - IST_OFFSET_MS, now);
  return { from, to, label: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7) };
}

/**
 * Synthesises a worker's health status including recent shifts, fatigue, and flight risk.
 *
 * @param {object} store - Store repository.
 * @param {object} worker - Worker record.
 * @param {number} now - Epoch milliseconds.
 * @returns {{ records: Array<object>, fatigue: object, risk: object }}
 */
function workerStatus(store, worker, now) {
  const records = store.attendanceFor(worker.id, now - 40 * DAY_MS, now + DAY_MS);
  const fatigue = assessFatigue(records, config.labour, now);
  const skillsLast90d = store.skillsFor(worker.id).filter((s) => new Date(s.issuedAt).getTime() > now - 90 * DAY_MS).length;
  const risk = assessAttritionRisk({ records, fatigueLevel: fatigue.level, joinedAt: worker.joinedAt, skillsLast90d, now });
  return { records, fatigue, risk };
}

/**
 * Builds the frontline worker attendance view with 14-day history and fatigue flags.
 *
 * @param {object} store - Store repository.
 * @param {object} worker - Worker record.
 * @param {number} now - Epoch milliseconds.
 * @returns {object} Attendance view DTO.
 */
function attendanceView(store, worker, now) {
  const { records, fatigue } = workerStatus(store, worker, now);
  const last14 = records.filter((r) => new Date(r.checkIn).getTime() >= now - 14 * DAY_MS);
  const summary = summarise(last14, config.labour.standardDailyHours);
  const open = store.openShift(worker.id);
  return {
    openShift: open ? { checkIn: open.checkIn, method: open.method } : null,
    summary,
    fatigue,
    recent: last14
      .filter((r) => r.checkOut)
      .slice(-7)
      .reverse()
      .map((r) => ({ date: dayKey(r.checkIn), checkIn: r.checkIn, checkOut: r.checkOut, hours: shiftHours(r), method: r.method })),
  };
}

/**
 * Generates transparent payslips for current and previous calendar months.
 *
 * @param {object} store - Store repository.
 * @param {object} worker - Worker record.
 * @param {number} now - Epoch milliseconds.
 * @returns {object} Dual-month payslip DTO.
 */
function payView(store, worker, now) {
  const current = monthBounds(now, 0);
  const prev = monthBounds(now, 1);
  const currentRecords = store.attendanceFor(worker.id, current.from, current.to);
  const prevRecords = store.attendanceFor(worker.id, prev.from, prev.to);
  return {
    current: { label: current.label, ...calculatePayslip(worker, currentRecords, config.labour) },
    previous: { label: prev.label, ...calculatePayslip(worker, prevRecords, config.labour) },
  };
}

/**
 * Compiles holistic workforce health telemetry for the employer dashboard.
 *
 * @param {object} store - Store repository.
 * @param {string} orgId - Organisation identifier.
 * @param {number} now - Epoch milliseconds.
 * @returns {object} Admin insights DTO.
 */
function adminOverview(store, orgId, now) {
  const workers = store.workersForOrg(orgId);
  const sites = store.sitesForOrg(orgId);
  const siteMap = new Map(sites.map((s) => [s.id, s.name]));

  let presentToday = 0;
  const todayKey = dayKey(new Date(now).toISOString());

  const workerInsights = workers.map((w) => {
    const { records, fatigue, risk } = workerStatus(store, w, now);
    const open = store.openShift(w.id);
    const workedToday = open || records.some((r) => dayKey(r.checkIn) === todayKey);
    if (workedToday) presentToday += 1;
    const weekRecords = records.filter((r) => new Date(r.checkIn).getTime() >= now - 7 * DAY_MS);
    const weekHours = summarise(weekRecords, config.labour.standardDailyHours).totalHours;
    return {
      id: w.id,
      name: w.name,
      role: w.role,
      siteId: w.siteId,
      siteName: siteMap.get(w.siteId) || 'Site',
      openShift: Boolean(open),
      weekHours,
      fatigue,
      risk,
    };
  });

  const feedback = store.feedbackForOrg(orgId);
  const feedbackByTopic = FEEDBACK_TOPICS.map((topic) => {
    const matching = feedback.filter((f) => f.topic === topic);
    const avg = matching.length ? Math.round((matching.reduce((s, f) => s + f.score, 0) / matching.length) * 10) / 10 : null;
    return { topic, count: matching.length, average: avg };
  });

  return {
    kpis: {
      totalWorkers: workers.length,
      presentToday,
      fatigueHigh: workerInsights.filter((w) => w.fatigue.level === 'high').length,
      attritionHigh: workerInsights.filter((w) => w.risk.level === 'high').length,
      openIssues: store.issuesForOrg(orgId).filter((i) => i.status !== 'resolved').length,
    },
    workers: workerInsights,
    feedback: feedbackByTopic,
  };
}

module.exports = { attendanceView, payView, adminOverview, monthBounds };
