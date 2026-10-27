'use strict';

/**
 * Google Cloud access via Application Default Credentials on Cloud Run.
 * Tokens come from the metadata server, so NO API keys exist in code or config.
 */
const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

let cached = { token: null, expiresAt: 0 };

async function getAccessToken(fetchImpl = fetch) {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const res = await fetchImpl(METADATA_TOKEN_URL, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!res.ok) throw new Error(`metadata token request failed: ${res.status}`);
  const body = await res.json();
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

async function callGoogleApi(url, payload, fetchImpl = fetch) {
  const token = await getAccessToken(fetchImpl);
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google API ${url} failed: ${res.status}`);
  return res.json();
}

module.exports = { getAccessToken, callGoogleApi };
