'use strict';

/**
 * Multi-Modal Attendance Verification Engine.
 *
 * Supports dual verification paths ensuring 100% digital inclusion:
 * 1. Rotating Time-based One-Time Password (TOTP) site codes (displayed as rolling QR + 6 digits).
 * 2. GPS Geofencing calculating Haversine great-circle distance.
 * Workers with low-end feature phones without camera or GPS can verify shifts via the 6-digit gate code.
 */
const crypto = require('node:crypto');

/**
 * Calculates the current window index based on epoch time and window duration.
 *
 * @param {number} now - Epoch millisecond timestamp.
 * @param {number} windowSeconds - Rotation interval duration in seconds.
 * @returns {number} Integer window index.
 */
function windowIndex(now, windowSeconds) {
  return Math.floor(now / 1000 / windowSeconds);
}

/**
 * Generates an HMAC-derived 6-digit numeric token for a site and time window.
 *
 * @param {string} secret - Kiosk cryptographic secret key.
 * @param {string} siteId - Unique site identifier.
 * @param {number} index - Integer window index.
 * @returns {string} Zero-padded 6-digit numeric code.
 */
function codeFor(secret, siteId, index) {
  const digest = crypto.createHmac('sha256', secret).update(`${siteId}:${index}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

/**
 * Generates the active dynamic site code and remaining validity countdown.
 *
 * @param {string} secret - Kiosk secret key.
 * @param {string} siteId - Site identifier.
 * @param {number} windowSeconds - Rotation interval in seconds.
 * @param {number} [now=Date.now()] - Current epoch timestamp.
 * @returns {{ code: string, expiresIn: number }} Active code and countdown seconds.
 */
function currentSiteCode(secret, siteId, windowSeconds, now = Date.now()) {
  const idx = windowIndex(now, windowSeconds);
  const expiresIn = windowSeconds - (Math.floor(now / 1000) % windowSeconds);
  return { code: codeFor(secret, siteId, idx), expiresIn };
}

/**
 * Validates a candidate 6-digit site check-in code with tolerance for clock drift.
 * Accepts code from the current window or immediately preceding window (tolerance for typing delays).
 *
 * @param {string} secret - Kiosk secret key.
 * @param {string} siteId - Site identifier.
 * @param {string|number} code - Candidate 6-digit code.
 * @param {number} windowSeconds - Rotation interval in seconds.
 * @param {number} [now=Date.now()] - Current epoch timestamp.
 * @returns {boolean} True if code is valid and active.
 */
function verifySiteCode(secret, siteId, code, windowSeconds, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const idx = windowIndex(now, windowSeconds);
  return [idx, idx - 1].some((i) => codeFor(secret, siteId, i) === String(code));
}

/**
 * Calculates Great-Circle Haversine distance between two geographic coordinates in metres.
 *
 * @param {{ lat: number, lng: number }} a - Source coordinate.
 * @param {{ lat: number, lng: number }} b - Target coordinate.
 * @returns {number} Distance in metres.
 */
function distanceMetres(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Evaluates whether given coordinates fall within a site's designated geofence perimeter.
 *
 * @param {object} site - Workplace site configuration.
 * @param {number} site.lat - Site latitude.
 * @param {number} site.lng - Site longitude.
 * @param {number} site.radiusM - Geofence radius threshold in metres.
 * @param {object} coords - Worker's client GPS coordinates.
 * @param {number} coords.lat - Client latitude.
 * @param {number} coords.lng - Client longitude.
 * @returns {boolean} True if worker is within geofence perimeter.
 */
function withinGeofence(site, coords) {
  if (!site || !coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return false;
  return distanceMetres(site, coords) <= site.radiusM;
}

module.exports = { currentSiteCode, verifySiteCode, distanceMetres, withinGeofence };
