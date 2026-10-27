'use strict';

/**
 * Anonymous Supporter Tokens for Collective Whistleblowing ("Me Too" Grievances).
 *
 * Privacy Guarantees (UN SDG 8 Whistleblower Protection):
 * -------------------------------------------------------
 * 1. An issue records ONLY an aggregate support count and a list of blind HMAC tokens.
 * 2. Strictly ZERO worker IDs are persisted in or linked to grievance records.
 * 3. token = HMAC-SHA256(anonSecret, workerId + ":" + issueId).
 *    - Deterministic per (worker, issue): prevents double-voting idempotently.
 *    - Unlinkable across issues: tokens differ per issue; preventing cross-issue profiling.
 *    - Non-invertible: without the HSM pepper, tokens cannot be reversed back to worker IDs.
 * 4. Temporal privacy: Timestamps are coarsened to the nearest hour to defeat timing correlation attacks.
 */
const crypto = require('node:crypto');

/**
 * Generates an unforgeable, privacy-preserving blind token for an issue support vote.
 *
 * @param {string} secret - Cryptographic pepper secret.
 * @param {string} workerId - Unique worker identifier.
 * @param {string} issueId - Unique grievance identifier.
 * @returns {string} Truncated 24-character hexadecimal privacy token.
 */
function anonToken(secret, workerId, issueId) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${workerId}:${issueId}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Coarsens an epoch millisecond timestamp to the nearest UTC hour.
 * Defeats timing correlation attacks that attempt to link filing time with shift check-ins.
 *
 * @param {number} [ms=Date.now()] - Epoch milliseconds.
 * @returns {string} ISO 8601 coarsened timestamp with zeroed minutes and seconds.
 */
function coarseTimestamp(ms = Date.now()) {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

module.exports = { anonToken, coarseTimestamp };
