'use strict';

/**
 * High-Assurance Authentication & Cryptography Layer.
 *
 * Implements:
 * 1. Dependency-free HMAC-SHA256 signed session tokens.
 * 2. Scrypt key derivation for PIN storage with per-user salt.
 * 3. Constant-time comparison (timingSafeEqual) against side-channel timing attacks.
 */
const crypto = require('node:crypto');

/**
 * Encodes string/buffer into URL-safe base64 format without padding.
 *
 * @param {string|Buffer} input - Input buffer or string.
 * @returns {string} Base64url representation.
 */
function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/**
 * Computes HMAC-SHA256 signature in base64url format.
 *
 * @param {string} secret - Secret key.
 * @param {string} data - Payload data.
 * @returns {string} Base64url signature.
 */
function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/**
 * Timing-safe string comparison to protect against side-channel analysis.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {boolean} True if strings match identically.
 */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Signs claims into a tamper-evident session token with an expiration timestamp.
 *
 * @param {object} claims - Session payload e.g. { sub: string, role: string, orgId: string }.
 * @param {string} secret - Signing secret.
 * @param {number} ttlSeconds - Token time-to-live in seconds.
 * @param {number} [now=Date.now()] - Current epoch millisecond timestamp (injectable for testing).
 * @returns {string} Compact token format: base64url(payload).base64url(signature).
 */
function signToken(claims, secret, ttlSeconds, now = Date.now()) {
  const payload = { ...claims, exp: Math.floor(now / 1000) + ttlSeconds };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(secret, body)}`;
}

/**
 * Cryptographically verifies and extracts token claims.
 *
 * @param {string} token - Signed session token.
 * @param {string} secret - Verification secret.
 * @param {number} [now=Date.now()] - Current epoch timestamp.
 * @returns {object|null} Decoded claims if valid and active, or null if expired/tampered.
 */
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

/**
 * Generates an OWASP-compliant scrypt hash of a PIN with a cryptographic salt.
 *
 * @param {string|number} pin - User's secret PIN.
 * @param {string} [salt] - Hex salt (auto-generated 16 random bytes if omitted).
 * @returns {string} Formatted string: salt:hexHash.
 */
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a candidate PIN against a stored salt:hash string.
 *
 * @param {string|number} pin - Candidate PIN.
 * @param {string} stored - Stored salt:hash credential.
 * @returns {boolean} True if PIN matches correctly.
 */
function verifyPin(pin, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return safeEqual(candidate, hash);
}

module.exports = { signToken, verifyToken, hashPin, verifyPin, safeEqual, hmac };
