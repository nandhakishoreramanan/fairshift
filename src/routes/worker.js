'use strict';

const express = require('express');
const { asyncHandler, requireRole } = require('../middleware');
const { cleanText, oneOf, optionalNumber, ValidationError } = require('../lib/validate');
const { verifySiteCode, withinGeofence } = require('../lib/checkin');
const { LANGUAGES, LANGUAGE_CODES } = require('../lib/translate');
const issues = require('../services/issues');
const insights = require('../services/insights');
const { FEEDBACK_TOPICS } = require('../data/seed');
const { coarseTimestamp } = require('../lib/anon');

module.exports = function workerRoutes({ store, config, clock }) {
  const router = express.Router();
  router.use(requireRole('worker', config.sessionSecret));

  /** Resolve the logged-in worker for every request. */
  router.use((req, res, next) => {
    req.worker = store.findWorker(req.auth.sub);
    if (!req.worker) return res.status(401).json({ error: 'Please log in again.' });
    return next();
  });

  router.get('/me', (req, res) => {
    const w = req.worker;
    const site = store.getSite(w.siteId);
    res.json({
      id: w.id,
      name: w.name,
      role: w.role,
      lang: w.lang,
      payType: w.payType,
      site: { id: site.id, name: site.name },
      org: store.getOrg(w.orgId),
      languages: LANGUAGES,
    });
  });

  router.put('/me/lang', (req, res) => {
    const lang = oneOf(req.body?.lang, LANGUAGE_CODES, 'lang');
    store.setWorkerLang(req.worker.id, lang);
    res.json({ lang });
  });

  // ---- Attendance & fatigue ------------------------------------------------
  router.get('/attendance', (req, res) => {
    res.json(insights.attendanceView(store, req.worker, clock()));
  });

  router.post('/checkin', (req, res) => {
    const w = req.worker;
    if (store.openShift(w.id)) throw new ValidationError('You are already checked in.');
    const site = store.getSite(w.siteId);
    const code = req.body?.code ? String(req.body.code).trim() : '';
    const lat = optionalNumber(req.body?.lat, { min: -90, max: 90 });
    const lng = optionalNumber(req.body?.lng, { min: -180, max: 180 });

    let method = null;
    if (code && verifySiteCode(config.kioskSecret, site.id, code, config.kioskWindowSeconds, clock())) method = 'qr';
    else if (lat !== undefined && lng !== undefined && withinGeofence(site, { lat, lng })) method = 'gps';
    if (!method) {
      return res.status(422).json({ error: 'Could not verify you are at the site. Scan the site QR or enter the code.', code: 'not_verified' });
    }
    const record = store.addAttendance({ workerId: w.id, siteId: site.id, checkIn: new Date(clock()).toISOString(), checkOut: null, method });
    return res.status(201).json({ checkIn: record.checkIn, method });
  });

  router.post('/checkout', (req, res) => {
    const open = store.openShift(req.worker.id);
    if (!open) throw new ValidationError('You are not checked in.');
    open.checkOut = new Date(clock()).toISOString();
    res.json(insights.attendanceView(store, req.worker, clock()));
  });

  // ---- Transparent payslip --------------------------------------------------
  router.get('/payslip', (req, res) => {
    const offset = req.query.month === 'previous' ? 1 : 0;
    res.json(insights.payslipView(store, req.worker, clock(), offset));
  });

  // ---- Collective anonymous complaints ("Me too") ---------------------------
  router.get('/issues', (req, res) => {
    const list = store
      .issuesForSite(req.worker.siteId)
      .map((i) => issues.toWorkerView(i, req.worker, config.anonSecret))
      .sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || b.supportCount - a.supportCount);
    res.json({ issues: list, categories: issues.CATEGORIES });
  });

  router.post(
    '/issues',
    asyncHandler(async (req, res) => {
      const category = oneOf(req.body?.category, issues.CATEGORIES, 'category');
      const text = cleanText(req.body?.text, { min: 3, max: 400, field: 'text' });
      const lang = LANGUAGE_CODES.includes(req.body?.lang) ? req.body.lang : req.worker.lang;
      const issue = await issues.createIssue(store, req.worker, { category, text, lang }, config.anonSecret, clock());
      res.status(201).json(issues.toWorkerView(issue, req.worker, config.anonSecret));
    }),
  );

  router.post('/issues/:id/support', (req, res) => {
    const issue = store.getIssue(req.params.id);
    if (!issue || issue.siteId !== req.worker.siteId) return res.status(404).json({ error: 'Issue not found.' });
    if (issue.status === 'resolved') throw new ValidationError('This issue is already resolved.');
    const added = issues.addSupport(issue, req.worker, config.anonSecret);
    if (added) store.updateIssue(issue);
    return res.json({ added, ...issues.toWorkerView(issue, req.worker, config.anonSecret) });
  });

  // ---- Contracts read aloud in the worker's language ------------------------
  router.get('/contracts', (req, res) => {
    const lang = req.worker.lang;
    const list = store
      .contractsForWorker(req.worker)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => ({
        id: c.id,
        title: c.title[lang] || c.title[c.originalLang],
        body: c.body[lang] || c.body[c.originalLang],
        translated: Boolean(c.body[lang]),
        originalLang: c.originalLang,
        // Every available translation, so the worker can switch "listen in" language instantly.
        versions: Object.fromEntries(
          Object.keys(c.body).map((l) => [l, { title: c.title[l] || c.title[c.originalLang], body: c.body[l] }]),
        ),
        createdAt: c.createdAt,
        myResponse: store.ackOf(c.id, req.worker.id)?.response || null,
      }));
    res.json({ contracts: list });
  });

  router.post('/contracts/:id/ack', (req, res) => {
    const c = store.getContract(req.params.id);
    const visible = c && store.contractsForWorker(req.worker).some((x) => x.id === c.id);
    if (!visible) return res.status(404).json({ error: 'Contract not found.' });
    const response = oneOf(req.body?.response, ['understood', 'doubt'], 'response');
    store.setAck(c.id, req.worker.id, response, new Date(clock()).toISOString());
    return res.json({ response });
  });

  // ---- Skill passport --------------------------------------------------------
  router.get('/skills', (req, res) => {
    res.json({
      skills: store.skillsFor(req.worker.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
      passportCode: req.worker.passportCode,
    });
  });

  // ---- Anonymous pulse feedback (site + topic + score only) ------------------
  router.post('/feedback', (req, res) => {
    const topic = oneOf(req.body?.topic, FEEDBACK_TOPICS, 'topic');
    const score = optionalNumber(req.body?.score, { min: 1, max: 5 });
    if (!Number.isInteger(score)) throw new ValidationError('score must be 1-5');
    store.addFeedback({ orgId: req.worker.orgId, siteId: req.worker.siteId, topic, score, at: coarseTimestamp(clock()) });
    res.status(201).json({ ok: true });
  });

  return router;
};
