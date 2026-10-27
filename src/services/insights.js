'use strict';

/**
 * Workforce insights for the employer dashboard and the worker home screen.
 */
const config = require('../config');
const { summarise, shiftHours, dayKey } = require('../lib/hours');
const { assessFatigue } = require('../lib/fatigue');
const { assessAttritionRisk } = require('../lib/risk');
const { calculatePayslip } = require('../lib/payroll');
const { FEEDBACK_TOPICS } = require('../data/seed');

const DAY_MS = 24 * 3600 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

/** [from, to) epoch-ms bounds of a calendar month in IST. offset 0 = current month. */
function monthBounds(now, offset = 0) {
  const local = new Date(now + IST_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() - offset;
  const from = Date.UTC(y, m, 1) - IST_OFFSET_MS;
  const to = Math.min(Date.UTC(y, m + 1, 1) - IST_OFFSET_MS, now);
  return { from, to, label: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7) };
}

function workerStatus(store, worker, now) {
  const records = store.attendanceFor(worker.id, now - 40 * DAY_MS, now + DAY_MS);
  const fatigue = assessFatigue(records, config.labour, now);
  const skillsLast90d = store.skillsFor(worker.id).filter((s) => new Date(s.issuedAt).getTime() > now - 90 * DAY_MS).length;
  const risk = assessAttritionRisk({ records, fatigueLevel: fatigue.level, joinedAt: worker.joinedAt, skillsLast90d, now });
  return { records, fatigue, risk };
}

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

function payslipView(store, worker, now, offset = 0) {
  const { from, to, label } = monthBounds(now, offset);
  const records = store.attendanceFor(worker.id, from, to);
  return { period: label, ...calculatePayslip(worker, records, config.labour) };
}

function feedbackThemes(items) {
  return FEEDBACK_TOPICS.map((topic) => {
    const list = items.filter((f) => f.topic === topic);
    const avg = list.length ? list.reduce((s, f) => s + f.score, 0) / list.length : null;
    return { topic, responses: list.length, average: avg === null ? null : Math.round(avg * 10) / 10 };
  });
}

function orgOverview(store, orgId, now) {
  const workers = store.workersForOrg(orgId);
  const sites = store.sitesForOrg(orgId);
  const today = dayKey(new Date(now).toISOString());

  const attendance = store.attendanceForOrg(orgId, now - 15 * DAY_MS);
  const trendMap = new Map();
  for (let i = 13; i >= 0; i -= 1) trendMap.set(dayKey(new Date(now - i * DAY_MS).toISOString()), new Set());
  for (const r of attendance) {
    const k = dayKey(r.checkIn);
    if (trendMap.has(k)) trendMap.get(k).add(r.workerId);
  }
  const trend = [...trendMap.entries()].map(([date, set]) => ({ date, present: set.size }));

  const people = workers.map((w) => {
    const { fatigue, risk } = workerStatus(store, w, now);
    return { id: w.id, name: w.name, role: w.role, siteId: w.siteId, lang: w.lang, fatigue, risk };
  });

  const issues = store.issuesForOrg(orgId);
  const openIssues = issues.filter((i) => i.status !== 'resolved');

  const contracts = store.contractsForOrg(orgId).map((c) => {
    const audience = workers.filter((w) => !c.siteId || w.siteId === c.siteId).length;
    const acks = store.acksFor(c.id);
    return {
      id: c.id,
      title: c.title.en || c.title[c.originalLang],
      audience,
      understood: acks.filter((a) => a.response === 'understood').length,
      doubts: acks.filter((a) => a.response === 'doubt').length,
    };
  });

  return {
    org: store.getOrg(orgId),
    sites,
    kpis: {
      workforce: workers.length,
      presentToday: trend.find((t) => t.date === today)?.present || 0,
      openIssues: openIssues.length,
      workersBehindOpenIssues: openIssues.reduce((s, i) => s + i.supportCount, 0),
      fatigueHigh: people.filter((p) => p.fatigue.level === 'high').length,
      attritionHigh: people.filter((p) => p.risk.level === 'high').length,
    },
    trend,
    fatigue: people
      .filter((p) => p.fatigue.level !== 'ok')
      .sort((a, b) => b.fatigue.weekHours - a.fatigue.weekHours)
      .slice(0, 12),
    atRisk: people
      .filter((p) => p.risk.level !== 'low')
      .sort((a, b) => b.risk.score - a.risk.score)
      .slice(0, 12),
    feedback: feedbackThemes(store.feedbackForOrg(orgId)),
    contracts,
  };
}

module.exports = { monthBounds, workerStatus, attendanceView, payslipView, orgOverview, feedbackThemes };
