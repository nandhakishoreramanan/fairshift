'use strict';

/**
 * Centralised runtime configuration.
 *
 * Secrets are NEVER hard-coded. In production (Cloud Run) they are injected as
 * environment variables, ideally sourced from Secret Manager. When a secret is
 * missing we generate a random one at boot so the app still runs safely in
 * local/demo mode (sessions simply reset on restart).
 */
const crypto = require('node:crypto');

function secretFromEnv(name) {
  const value = process.env[name];
  if (value && value.length >= 16) return value;
  return crypto.randomBytes(32).toString('hex');
}

const config = Object.freeze({
  port: Number.parseInt(process.env.PORT, 10) || 8080,
  env: process.env.NODE_ENV || 'development',

  /** Signs worker/admin session tokens. */
  sessionSecret: secretFromEnv('SESSION_SECRET'),
  /** Pepper used to derive anonymous "Me too" tokens. Kept separate from the session secret. */
  anonSecret: secretFromEnv('ANON_SECRET'),
  /** Signs the rotating attendance codes shown on site kiosks / QR posters. */
  kioskSecret: secretFromEnv('KIOSK_SECRET'),

  sessionTtlSeconds: 60 * 60 * 12,

  /** Google Cloud integrations use Application Default Credentials (no API keys). */
  gcp: {
    translateEnabled: process.env.ENABLE_CLOUD_TRANSLATE === 'true',
    ttsEnabled: process.env.ENABLE_CLOUD_TTS === 'true',
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
  },

  /** Labour rules (defaults follow common Indian labour-law practice). */
  labour: {
    standardDailyHours: 8,
    overtimeMultiplier: 2,
    maxDailyHours: 12,
    maxWeeklyHours: 60,
    minRestHours: 10,
    maxConsecutiveDays: 6,
  },

  /** Attendance code rotates every N seconds. */
  kioskWindowSeconds: 120,
});

module.exports = config;
