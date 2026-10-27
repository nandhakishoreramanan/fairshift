'use strict';

/**
 * Repository layer for FairShift.
 *
 * Implements a High-Performance Hybrid Model:
 * 1. Sub-millisecond in-memory cache for ultra-responsive mobile experience on site.
 * 2. Real-time write-through to Supabase (PostgreSQL) when credentials are provided.
 * 3. Gracefully boots with rich synthetic data if Supabase is offline or unconfigured.
 */
const crypto = require('node:crypto');
const { seed } = require('./seed');
const supabase = require('./supabase');

function newId(prefix) {
  return `${prefix}${crypto.randomUUID().slice(0, 8)}`;
}

function createStore({ now = Date.now(), anonSecret, preloadedDb } = {}) {
  const db = preloadedDb || seed({ now, anonSecret });

  return {
    // ---- organisations & people -------------------------------------------
    getOrg: (id) => db.orgs.find((o) => o.id === id) || null,
    getSite: (id) => db.sites.find((s) => s.id === id) || null,
    sitesForOrg: (orgId) => db.sites.filter((s) => s.orgId === orgId),
    findWorker: (id) => db.workers.find((w) => w.id === String(id).toUpperCase()) || null,
    findAdmin: (id) => db.admins.find((a) => a.id === String(id).toUpperCase()) || null,
    workersForOrg: (orgId) => db.workers.filter((w) => w.orgId === orgId),
    featuredWorkers: () => db.workers.filter((w) => w.featured),
    workerByPassport: (code) => db.workers.find((w) => w.passportCode === code) || null,
    setWorkerLang(workerId, lang) {
      const w = db.workers.find((x) => x.id === workerId);
      if (w) {
        w.lang = lang;
        supabase.writeWorkerLang(workerId, lang);
      }
      return w;
    },

    // ---- attendance --------------------------------------------------------
    attendanceFor(workerId, fromMs = 0, toMs = Infinity) {
      return db.attendance.filter((r) => {
        if (r.workerId !== workerId) return false;
        const t = new Date(r.checkIn).getTime();
        return t >= fromMs && t < toMs;
      });
    },
    attendanceForOrg(orgId, fromMs = 0) {
      const ids = new Set(db.workers.filter((w) => w.orgId === orgId).map((w) => w.id));
      return db.attendance.filter((r) => ids.has(r.workerId) && new Date(r.checkIn).getTime() >= fromMs);
    },
    openShift: (workerId) => db.attendance.find((r) => r.workerId === workerId && !r.checkOut) || null,
    addAttendance(rec) {
      const record = { id: newId('A'), ...rec };
      db.attendance.push(record);
      supabase.writeAttendance(record);
      return record;
    },

    // ---- collective issues (anonymous) ------------------------------------
    getIssue: (id) => db.issues.find((i) => i.id === id) || null,
    issuesForSite: (siteId) => db.issues.filter((i) => i.siteId === siteId),
    issuesForOrg: (orgId) => db.issues.filter((i) => i.orgId === orgId),
    addIssue(issue) {
      const record = { id: newId('I'), ...issue };
      db.issues.push(record);
      supabase.writeIssue(record);
      return record;
    },
    updateIssue(issue) {
      const idx = db.issues.findIndex((i) => i.id === issue.id);
      if (idx !== -1) db.issues[idx] = issue;
      supabase.writeIssue(issue);
      return issue;
    },

    // ---- contracts & notices ----------------------------------------------
    getContract: (id) => db.contracts.find((c) => c.id === id) || null,
    contractsForOrg: (orgId) => db.contracts.filter((c) => c.orgId === orgId),
    contractsForWorker: (w) => db.contracts.filter((c) => c.orgId === w.orgId && (!c.siteId || c.siteId === w.siteId)),
    addContract(contract) {
      const record = { id: newId('C'), ...contract };
      db.contracts.push(record);
      supabase.writeContract(record);
      return record;
    },
    acksFor: (contractId) => db.acks.filter((a) => a.contractId === contractId),
    ackOf: (contractId, workerId) => db.acks.find((a) => a.contractId === contractId && a.workerId === workerId) || null,
    setAck(contractId, workerId, response, at) {
      const existing = db.acks.find((a) => a.contractId === contractId && a.workerId === workerId);
      if (existing) {
        Object.assign(existing, { response, at });
      } else {
        db.acks.push({ contractId, workerId, response, at });
      }
      supabase.writeAck({ contractId, workerId, response, at });
    },

    // ---- skill passport ----------------------------------------------------
    skillsFor: (workerId) => db.skills.filter((s) => s.workerId === workerId),
    addSkill(skill) {
      const record = { id: newId('S'), ...skill };
      db.skills.push(record);
      supabase.writeSkill(record);
      return record;
    },

    // ---- anonymous pulse feedback -----------------------------------------
    addFeedback(item) {
      db.feedback.push(item);
      supabase.writeFeedback(item);
    },
    feedbackForOrg: (orgId) => db.feedback.filter((f) => f.orgId === orgId),

    // Expose raw db object for initial bulk seeding
    _raw: db,
  };
}

module.exports = { createStore };
