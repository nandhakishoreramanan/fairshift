'use strict';

/**
 * Anonymous supporter tokens for collective ("Me too") complaints.
 *
 * Privacy model
 * -------------
 * - An issue stores ONLY a count and a list of opaque tokens; never a worker ID.
 * - token = HMAC(anonSecret, workerId + ":" + issueId), truncated.
 *   - Deterministic per (worker, issue): lets us stop double-voting and lets the
 *     worker's own device see "you supported this" by re-deriving the token.
 *   - Different for every issue: tokens cannot be joined across issues to build
 *     a profile of one worker.
 *   - One-way: without the separately-held pepper, a token cannot be mapped back
 *     to a worker. In production the pepper lives in Secret Manager / KMS and is
 *     not accessible to admin users.
 */
const crypto = require('node:crypto');

function anonToken(secret, workerId, issueId) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${workerId}:${issueId}`)
    .digest('hex')
    .slice(0, 24);
}

/** Round a timestamp down to the hour so report time can't be matched to a check-in. */
function coarseTimestamp(ms = Date.now()) {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

module.exports = { anonToken, coarseTimestamp };
