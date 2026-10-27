'use strict';

const express = require('express');
const { verifyToken } = require('../lib/auth');
const { cleanText, oneOf } = require('../lib/validate');
const { LANGUAGE_CODES, synthesizeSpeech } = require('../lib/translate');
const { asyncHandler, rateLimit } = require('../middleware');

module.exports = function publicRoutes({ store, config }) {
  const router = express.Router();

  router.get('/healthz', (req, res) => res.json({ ok: true }));

  /** Public, read-only skill passport by worker ID or passport code */
  router.get('/passport/:code', (req, res) => {
    const param = String(req.params.code);
    let w = null;
    if (/^[a-f0-9]{12}$/.test(param)) {
      w = store.workerByPassport(param);
    } else {
      w = store.findWorker(param);
    }
    if (!w) return res.status(404).json({ error: 'Passport not found.' });
    return res.json({
      name: w.name,
      role: w.role,
      employer: store.getOrg(w.orgId).name,
      since: w.joinedAt,
      skills: store
        .skillsFor(w.id)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
        .map(({ title, issuer, type, issuedAt, verified }) => ({ title, issuer, type, issuedAt, verified })),
    });
  });

  /**
   * Server-side text-to-speech fallback (Google Cloud TTS) for phones that
   * have no local voice for the chosen language. Requires a logged-in user.
   */
  router.post(
    '/tts',
    rateLimit({ windowMs: 60_000, max: 30 }),
    asyncHandler(async (req, res) => {
      const token = (req.get('authorization') || '').replace(/^Bearer /, '');
      if (!verifyToken(token, config.sessionSecret)) return res.status(401).json({ error: 'Please log in again.' });
      const text = cleanText(req.body?.text, { max: 4500, field: 'text' });
      const lang = oneOf(req.body?.lang, LANGUAGE_CODES, 'lang');
      const audio = await synthesizeSpeech(text, lang);
      if (!audio) return res.status(503).json({ error: 'Server voice unavailable.' });
      return res.json({ audio: `data:audio/mpeg;base64,${audio}` });
    }),
  );

  return router;
};
