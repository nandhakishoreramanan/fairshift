'use strict';

const express = require('express');
const QRCode = require('qrcode');
const { asyncHandler, requireRole } = require('../middleware');
const { cleanText, oneOf } = require('../lib/validate');
const { currentSiteCode } = require('../lib/checkin');
const { translateToAll } = require('../lib/translate');
const issues = require('../services/issues');
const insights = require('../services/insights');

const SKILL_TYPES = ['certification', 'training', 'experience'];

module.exports = function adminRoutes({ store, config, clock }) {
  const router = express.Router();
  router.use(requireRole('admin', config.sessionSecret));

  router.use((req, res, next) => {
    req.admin = store.findAdmin(req.auth.sub);
    if (!req.admin) return res.status(401).json({ error: 'Please log in again.' });
    return next();
  });

  const siteName = (id) => store.getSite(id)?.name || id;
  const ownSite = (req, siteId) => store.sitesForOrg(req.admin.orgId).some((s) => s.id === siteId);

  router.get('/overview', (req, res) => {
    res.json({ admin: { name: req.admin.name }, ...insights.orgOverview(store, req.admin.orgId, clock()) });
  });

  // ---- Collective issues ----------------------------------------------------
  router.get('/issues', (req, res) => {
    const list = store
      .issuesForOrg(req.admin.orgId)
      .map((i) => issues.toAdminView(i, siteName(i.siteId)))
      .sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || b.supportCount - a.supportCount);
    res.json({ issues: list });
  });

  router.patch(
    '/issues/:id',
    asyncHandler(async (req, res) => {
      const issue = store.getIssue(req.params.id);
      if (!issue || issue.orgId !== req.admin.orgId) return res.status(404).json({ error: 'Issue not found.' });
      const status = oneOf(req.body?.status, issues.STATUSES, 'status');
      const noteText = req.body?.note ? cleanText(req.body.note, { max: 300, field: 'note' }) : null;
      // Status notes are translated so every supporter reads the update in their language.
      const note = noteText ? { ...(await translateToAll(noteText, 'en')), en: noteText } : null;
      issues.updateStatus(issue, status, note, clock());
      store.updateIssue(issue);
      return res.json(issues.toAdminView(issue, siteName(issue.siteId)));
    }),
  );

  // ---- Contracts / notices --------------------------------------------------
  router.post(
    '/contracts',
    asyncHandler(async (req, res) => {
      const title = cleanText(req.body?.title, { min: 3, max: 120, field: 'title' });
      const body = cleanText(req.body?.body, { min: 10, max: 3000, field: 'body' });
      const siteId = req.body?.siteId || null;
      if (siteId && !ownSite(req, siteId)) return res.status(400).json({ error: 'Unknown site.' });
      const [titleT, bodyT] = await Promise.all([translateToAll(title, 'en'), translateToAll(body, 'en')]);
      const contract = store.addContract({
        orgId: req.admin.orgId,
        siteId,
        title: { ...titleT, en: title },
        body: { ...bodyT, en: body },
        originalLang: 'en',
        createdAt: new Date(clock()).toISOString(),
      });
      return res.status(201).json({ id: contract.id, languages: Object.keys(contract.body) });
    }),
  );

  router.get('/contracts/:id/responses', (req, res) => {
    const c = store.getContract(req.params.id);
    if (!c || c.orgId !== req.admin.orgId) return res.status(404).json({ error: 'Contract not found.' });
    const doubts = store
      .acksFor(c.id)
      .filter((a) => a.response === 'doubt')
      .map((a) => {
        const w = store.findWorker(a.workerId);
        return { workerId: w.id, name: w.name, role: w.role, lang: w.lang, site: siteName(w.siteId) };
      });
    return res.json({ id: c.id, languages: Object.keys(c.body), doubts });
  });

  // ---- Attendance kiosk (rotating QR) ---------------------------------------
  router.get(
    '/kiosk/:siteId',
    asyncHandler(async (req, res) => {
      if (!ownSite(req, req.params.siteId)) return res.status(404).json({ error: 'Unknown site.' });
      const { code, expiresIn } = currentSiteCode(config.kioskSecret, req.params.siteId, config.kioskWindowSeconds, clock());
      const origin = `${req.protocol}://${req.get('host')}`;
      const url = `${origin}/worker.html#checkin=${code}`;
      const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      return res.json({ siteId: req.params.siteId, siteName: siteName(req.params.siteId), code, expiresIn, qrSvg });
    }),
  );

  // ---- Workers & skill passport ---------------------------------------------
  router.get('/workers', (req, res) => {
    const now = clock();
    const list = store.workersForOrg(req.admin.orgId).map((w) => {
      const { fatigue, risk } = insights.workerStatus(store, w, now);
      return { id: w.id, name: w.name, role: w.role, site: siteName(w.siteId), lang: w.lang, fatigue: fatigue.level, weekHours: fatigue.weekHours, risk: risk.level, riskScore: risk.score, skills: store.skillsFor(w.id).length };
    });
    res.json({ workers: list });
  });

  router.post('/skills', (req, res) => {
    const worker = store.findWorker(cleanText(req.body?.workerId, { max: 20, field: 'workerId' }));
    if (!worker || worker.orgId !== req.admin.orgId) return res.status(404).json({ error: 'Worker not found.' });
    const skill = store.addSkill({
      workerId: worker.id,
      title: cleanText(req.body?.title, { min: 3, max: 120, field: 'title' }),
      issuer: store.getOrg(req.admin.orgId).name,
      type: oneOf(req.body?.type, SKILL_TYPES, 'type'),
      issuedAt: new Date(clock()).toISOString(),
      verified: true,
    });
    return res.status(201).json(skill);
  });

  return router;
};
