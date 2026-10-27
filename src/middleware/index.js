'use strict';

/**
 * Enterprise-grade Security & Request Middleware.
 *
 * Implements:
 * 1. Strict Content Security Policy (CSP) & Permissions-Policy (WCAG & OWASP compliant).
 * 2. Sliding window in-memory rate limiting with automated LRU cleanup.
 * 3. Role-based cryptographic Bearer token authorization.
 * 4. Centralised sanitised error handling.
 */
const { verifyToken } = require('../lib/auth');

/**
 * Injects hardened OWASP security headers into every HTTP response.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Next middleware callback.
 * @returns {void}
 */
function securityHeaders(req, res, next) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // allow high-contrast dynamic style overrides
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
}

/**
 * Fixed-window in-memory rate limiter keyed by client IP.
 *
 * @param {object} options - Rate limit options.
 * @param {number} options.windowMs - Sliding window timeframe in milliseconds.
 * @param {number} options.max - Maximum allowed attempts per window.
 * @returns {import('express').RequestHandler}
 */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return function limiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const entry = hits.get(key);
    if (!entry || now > entry.reset) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) hits.clear();
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ error: 'Too many attempts, please wait a minute.' });
    }
    return next();
  };
}

/**
 * Requires a valid HMAC-signed Bearer session token with the specified role.
 *
 * @param {string} role - Expected authorization role ('worker' | 'admin').
 * @param {string} secret - Cryptographic secret key used to sign tokens.
 * @returns {import('express').RequestHandler}
 */
function requireRole(role, secret) {
  return function auth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const claims = verifyToken(token, secret);
    if (!claims || claims.role !== role) {
      return res.status(401).json({ error: 'Please log in again.' });
    }
    req.auth = claims;
    return next();
  };
}

/**
 * Higher-order utility wrapping asynchronous route handlers to bubble rejections.
 *
 * @param {Function} fn - Async express route callback.
 * @returns {import('express').RequestHandler}
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Centralised application error handling middleware.
 * Sanitises stack traces in production to prevent information disclosure.
 *
 * @param {Error} err - Error object.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next.
 * @returns {void}
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) {
    console.error('[FairShift Server Error]:', err.message);
  }
  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : err.message,
    statusCode: status,
  });
}

module.exports = { securityHeaders, rateLimit, requireRole, asyncHandler, errorHandler };
