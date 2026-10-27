'use strict';

const express = require('express');
const { signToken, verifyPin } = require('../lib/auth');
const { cleanText } = require('../lib/validate');
const { LANGUAGES } = require('../lib/translate');
const { rateLimit } = require('../middleware');

module.exports = function authRoutes({ store, config }) {
  const router = express.Router();
  const loginLimiter = rateLimit({ windowMs: 60_000, max: 10 });

  /** Demo directory shown on the login page (no secrets, no PIN hashes). */
  router.get('/demo', (req, res) => {
    res.json({
      languages: LANGUAGES,
      workers: store.featuredWorkers().map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        lang: w.lang,
        site: store.getSite(w.siteId).name,
        industry: store.getOrg(w.orgId).industry,
      })),
      admins: ['A-BUILD', 'A-COLLEGE'].map((id) => {
        const a = store.findAdmin(id);
        return { id: a.id, name: a.name, industry: store.getOrg(a.orgId).industry };
      }),
    });
  });

  router.post('/login', loginLimiter, (req, res) => {
    const role = req.body?.role === 'admin' ? 'admin' : 'worker';
    const id = cleanText(req.body?.id, { max: 20, field: 'id' });
    const pin = cleanText(req.body?.pin, { min: 4, max: 8, field: 'pin' });
    const user = role === 'admin' ? store.findAdmin(id) : store.findWorker(id);
    if (!user || !verifyPin(pin, user.pinHash)) {
      return res.status(401).json({ error: 'Wrong ID or PIN.' });
    }
    const token = signToken({ sub: user.id, role, orgId: user.orgId }, config.sessionSecret, config.sessionTtlSeconds);
    return res.json({ token, role, name: user.name });
  });

  return router;
};
