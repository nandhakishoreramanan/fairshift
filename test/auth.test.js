'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken, hashPin, verifyPin } = require('../src/lib/auth');

test('auth: signToken and verifyToken', () => {
  const secret = 'super-secret-key-1234567890';
  const claims = { sub: 'W1001', role: 'worker', orgId: 'org-build' };
  const token = signToken(claims, secret, 3600);

  assert.ok(typeof token === 'string' && token.includes('.'));

  const verified = verifyToken(token, secret);
  assert.ok(verified);
  assert.equal(verified.sub, 'W1001');
  assert.equal(verified.role, 'worker');
  assert.equal(verified.orgId, 'org-build');

  // Rejects invalid secret
  assert.equal(verifyToken(token, 'wrong-secret-key'), null);

  // Rejects expired token
  const expiredToken = signToken(claims, secret, -10);
  assert.equal(verifyToken(expiredToken, secret), null);

  // Rejects malformed token
  assert.equal(verifyToken('garbage.data', secret), null);
  assert.equal(verifyToken(null, secret), null);
});

test('auth: hashPin and verifyPin', () => {
  const pin = '1234';
  const hashed = hashPin(pin);

  assert.ok(hashed.includes(':'));
  assert.equal(verifyPin('1234', hashed), true);
  assert.equal(verifyPin('9999', hashed), false);
  assert.equal(verifyPin('', hashed), false);
  assert.equal(verifyPin(null, hashed), false);
});
