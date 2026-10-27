'use strict';

/**
 * Minimal, dependency-free signed session tokens (HMAC-SHA256) and PIN hashing.
 * Format: base64url(JSON payload) + "." + base64url(signature)
 */
const crypto = require('node:crypto');

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * @param {object} claims  e.g. { sub, role, orgId }
 * @param {string} secret
 * @param {number} ttlSeconds
 * @param {number} [now] epoch ms (injectable for tests)
 */
function signToken(claims, secret, ttlSeconds, now = Date.now()) {
  const payload = { ...claims, exp: Math.floor(now / 1000) + ttlSeconds };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(secret, body)}`;
}

/** @returns {object|null} claims if valid and unexpired, otherwise null */
function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqual(sig, hmac(secret, body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Hash a PIN with scrypt and a random salt. */
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return safeEqual(candidate, hash);
}

module.exports = { signToken, verifyToken, hashPin, verifyPin, safeEqual, hmac };
