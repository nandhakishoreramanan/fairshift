'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanText, oneOf, optionalNumber, escapeHtml, ValidationError } = require('../src/lib/validate');
const { signToken, verifyToken, hashPin, verifyPin } = require('../src/lib/auth');
const { rateLimit } = require('../src/middleware');

test('security: XSS prevention and HTML sanitisation', () => {
  const xssPayload = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
  const clean = escapeHtml(xssPayload);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('onerror='), true);
  assert.equal(clean.includes('&lt;script&gt;'), true);
  assert.equal(clean.includes('&lt;img'), true);
});

test('security: cleanText strips control characters and strictly enforces boundaries', () => {
  assert.throws(() => cleanText(12345), ValidationError);
  assert.throws(() => cleanText(''), ValidationError);
  assert.throws(() => cleanText('hi', { min: 5 }), ValidationError);
  assert.throws(() => cleanText('this is way too long text', { max: 10 }), ValidationError);

  // Control characters stripped
  const malicious = 'SafeText\u0000\u0008\u001F';
  assert.equal(cleanText(malicious), 'SafeText');
});

test('security: oneOf rejects unapproved enumeration values', () => {
  const allowed = ['safety', 'wages', 'facilities'];
  assert.equal(oneOf('safety', allowed), 'safety');
  assert.throws(() => oneOf('sql_injection', allowed), ValidationError);
});

test('security: optionalNumber validates finite numbers and range boundaries', () => {
  assert.equal(optionalNumber(undefined), undefined);
  assert.equal(optionalNumber('42'), 42);
  assert.equal(optionalNumber(10, { min: 0, max: 20 }), 10);
  assert.throws(() => optionalNumber('not-a-number'), ValidationError);
  assert.throws(() => optionalNumber(100, { min: 0, max: 50 }), ValidationError);
});

test('security: session tokens tamper resistance and expiration checks', () => {
  const secret = 'test-secret-ultra-secure-key-12345';
  const now = 1700000000000;
  const token = signToken({ sub: 'W1001', role: 'worker' }, secret, 3600, now);

  // Valid token passes
  const claims = verifyToken(token, secret, now);
  assert.equal(claims.sub, 'W1001');

  // Tampered payload fails
  const [body, sig] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'ATTACKER', role: 'admin', exp: claims.exp })).toString('base64url');
  assert.equal(verifyToken(`${tamperedPayload}.${sig}`, secret, now), null);

  // Expired token fails
  const expiredTime = now + 3601 * 1000;
  assert.equal(verifyToken(token, secret, expiredTime), null);
});

test('security: rate limiter sliding window protects sensitive endpoints', () => {
  const limiter = rateLimit({ windowMs: 1000, max: 2 });
  const req = { ip: '192.168.1.1' };
  let status = 200;
  const res = {
    status: (s) => {
      status = s;
      return { json: () => {} };
    },
    setHeader: () => {},
  };

  let nextCalled = 0;
  const next = () => { nextCalled += 1; };

  limiter(req, res, next);
  assert.equal(nextCalled, 1);

  limiter(req, res, next);
  assert.equal(nextCalled, 2);

  // Third request exceeds limit
  limiter(req, res, next);
  assert.equal(status, 429);
});

test('translation: synthesizeSpeech gracefully degrades when Cloud TTS is disabled', async () => {
  const { synthesizeSpeech, translateText } = require('../src/lib/translate');
  const audio = await synthesizeSpeech('Test text', 'ta');
  assert.equal(audio, null); // Gracefully returns null for native Web Speech API fallback

  const sameLang = await translateText('Hello', 'en', 'en');
  assert.equal(sameLang.text, 'Hello');
  assert.equal(sameLang.translated, true);
});
