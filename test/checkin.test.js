'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { currentSiteCode, verifySiteCode, distanceMetres, withinGeofence } = require('../src/lib/checkin');

test('checkin: rotating 6-digit site codes', () => {
  const secret = 'kiosk-secret-key-xyz-789';
  const siteId = 'site-omr';
  const windowSeconds = 120;
  const now = 1700000000000;

  const current = currentSiteCode(secret, siteId, windowSeconds, now);
  assert.equal(/^\d{6}$/.test(current.code), true);
  assert.ok(current.expiresIn > 0 && current.expiresIn <= 120);

  // Exact match verifies
  assert.equal(verifySiteCode(secret, siteId, current.code, windowSeconds, now), true);

  // Still valid within clock skew / immediately previous window
  const slightlyLater = now + 125000; // shifted to next window
  assert.equal(verifySiteCode(secret, siteId, current.code, windowSeconds, slightlyLater), true);

  // Invalid after 2 full windows
  const muchLater = now + 300000;
  assert.equal(verifySiteCode(secret, siteId, current.code, windowSeconds, muchLater), false);

  // Wrong code or site fails
  assert.equal(verifySiteCode(secret, 'other-site', current.code, windowSeconds, now), false);
  assert.equal(verifySiteCode(secret, siteId, '000000', windowSeconds, now), false);
});

test('checkin: GPS geofencing calculation', () => {
  const site = { lat: 12.9010, lng: 80.2279, radiusM: 400 };

  // Worker is 50 metres away
  const insideCoords = { lat: 12.9013, lng: 80.2281 };
  assert.ok(distanceMetres(site, insideCoords) < 400);
  assert.equal(withinGeofence(site, insideCoords), true);

  // Worker is 5 km away in city center
  const outsideCoords = { lat: 12.9800, lng: 80.2500 };
  assert.ok(distanceMetres(site, outsideCoords) > 400);
  assert.equal(withinGeofence(site, outsideCoords), false);
});
