'use strict';

/**
 * Check-in verification: rotating site codes (shown as QR + digits on a kiosk/poster)
 * and GPS geofencing. Either method is accepted, so workers on basic phones
 * without GPS can still check in by typing the 6-digit code.
 */
const crypto = require('node:crypto');

function windowIndex(now, windowSeconds) {
  return Math.floor(now / 1000 / windowSeconds);
}

function codeFor(secret, siteId, index) {
  const digest = crypto.createHmac('sha256', secret).update(`${siteId}:${index}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

/** Current code for a site and seconds until it rotates. */
function currentSiteCode(secret, siteId, windowSeconds, now = Date.now()) {
  const idx = windowIndex(now, windowSeconds);
  const expiresIn = windowSeconds - (Math.floor(now / 1000) % windowSeconds);
  return { code: codeFor(secret, siteId, idx), expiresIn };
}

/** Accepts the current or immediately previous code (tolerates clock skew / slow typing). */
function verifySiteCode(secret, siteId, code, windowSeconds, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const idx = windowIndex(now, windowSeconds);
  return [idx, idx - 1].some((i) => codeFor(secret, siteId, i) === String(code));
}

/** Great-circle distance in metres. */
function distanceMetres(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function withinGeofence(site, coords) {
  if (!site || !coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return false;
  return distanceMetres(site, coords) <= site.radiusM;
}

module.exports = { currentSiteCode, verifySiteCode, distanceMetres, withinGeofence };
