'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { currentSiteCode } = require('../src/lib/checkin');

// Use inject helper to test Express routes without network/port binding
function mockRequest(app, method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: { ...headers },
      get(name) { return this.headers[name.toLowerCase()]; },
      body,
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      protocol: 'http',
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, headers: this.headers, body: data }); },
      send(data) { resolve({ status: this.statusCode, headers: this.headers, body: data }); },
    };
    app(req, res);
  });
}

test('api: full worker and admin workflow with collective "Me Too" and contract audio', async () => {
  const clock = () => 1700000000000;
  const config = {
    sessionSecret: 'test-session-secret-key-32charslong!!',
    anonSecret: 'test-anon-pepper-secret-32charslong!!',
    kioskSecret: 'test-kiosk-secret-key-32charslong!!',
    sessionTtlSeconds: 3600,
    kioskWindowSeconds: 120,
    labour: { standardDailyHours: 8, overtimeMultiplier: 2, maxDailyHours: 12, maxWeeklyHours: 60, minRestHours: 10, maxConsecutiveDays: 6 },
    gcp: { translateEnabled: false, ttsEnabled: false },
    env: 'test',
  };

  const app = createApp({ config, clock });

  // 1. Worker 1 Login (Murugan S - W1001)
  const loginRes1 = await mockRequest(app, 'POST', '/api/auth/login', {
    body: { id: 'W1001', pin: '1234', role: 'worker' },
  });
  assert.equal(loginRes1.status, 200);
  const token1 = loginRes1.body.token;
  const authHeader1 = { authorization: `Bearer ${token1}` };

  // 2. Check-in using rotating 6-digit site code
  const { code } = currentSiteCode(config.kioskSecret, 'site-omr', config.kioskWindowSeconds, clock());
  const checkinRes = await mockRequest(app, 'POST', '/api/worker/checkin', {
    headers: authHeader1,
    body: { code },
  });
  assert.equal(checkinRes.status, 201);
  assert.equal(checkinRes.body.method, 'qr');

  // Check-out
  const checkoutRes = await mockRequest(app, 'POST', '/api/worker/checkout', {
    headers: authHeader1,
    body: {},
  });
  assert.equal(checkoutRes.status, 200);

  // 3. Worker 1 reports a safety issue
  const reportRes = await mockRequest(app, 'POST', '/api/worker/issues', {
    headers: authHeader1,
    body: { category: 'safety', text: 'Loose scaffolding near Tower B elevator shaft', lang: 'ta' },
  });
  assert.equal(reportRes.status, 201);
  const issueId = reportRes.body.id;
  assert.equal(reportRes.body.supportCount, 1);
  assert.equal(reportRes.body.supportedByMe, true);

  // 4. Worker 2 Login (Ramesh Yadav - W1002 on same site)
  const loginRes2 = await mockRequest(app, 'POST', '/api/auth/login', {
    body: { id: 'W1002', pin: '1234', role: 'worker' },
  });
  assert.equal(loginRes2.status, 200);
  const token2 = loginRes2.body.token;
  const authHeader2 = { authorization: `Bearer ${token2}` };

  // Worker 2 taps "Me too"
  const supportRes = await mockRequest(app, 'POST', `/api/worker/issues/${issueId}/support`, {
    headers: authHeader2,
    body: {},
  });
  assert.equal(supportRes.status, 200);
  assert.equal(supportRes.body.added, true);
  assert.equal(supportRes.body.supportCount, 2);
  assert.equal(supportRes.body.supportedByMe, true);

  // 5. Admin Login (Priya Menon - A-BUILD)
  const adminLogin = await mockRequest(app, 'POST', '/api/auth/login', {
    body: { id: 'A-BUILD', pin: '9999', role: 'admin' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.token;
  const adminHeader = { authorization: `Bearer ${adminToken}` };

  // Admin views issues list
  const adminIssues = await mockRequest(app, 'GET', '/api/admin/issues', {
    headers: adminHeader,
  });
  assert.equal(adminIssues.status, 200);
  const targetIssue = adminIssues.body.issues.find((i) => i.id === issueId);
  assert.ok(targetIssue);
  assert.equal(targetIssue.supportCount, 2);
  // Verify NO worker IDs or tokens are exposed to Admin
  assert.equal(targetIssue.workerId, undefined);
  assert.equal(targetIssue.supporterTokens, undefined);

  // 6. Admin updates issue status with resolution note
  const updateRes = await mockRequest(app, 'PATCH', `/api/admin/issues/${issueId}`, {
    headers: adminHeader,
    body: { status: 'in_progress', note: 'Safety engineer dispatched to reinforce clamps' },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.status, 'in_progress');

  // 7. Worker 2 inspects issue list and sees real-time status update & timeline
  const workerIssues = await mockRequest(app, 'GET', '/api/worker/issues', {
    headers: authHeader2,
  });
  assert.equal(workerIssues.status, 200);
  const updatedForWorker = workerIssues.body.issues.find((i) => i.id === issueId);
  assert.equal(updatedForWorker.status, 'in_progress');
  assert.equal(updatedForWorker.history.length, 2);

  // 8. Admin publishes contract notice
  const createContract = await mockRequest(app, 'POST', '/api/admin/contracts', {
    headers: adminHeader,
    body: {
      title: 'Site Safety Protocol & Daily Rest Periods',
      body: 'All workers are required to take 1 hour lunch break. Water coolers refreshed every 3 hours.',
    },
  });
  assert.equal(createContract.status, 201);
  const contractId = createContract.body.id;

  // 9. Worker 1 fetches contracts and can listen in chosen language
  const contractsRes = await mockRequest(app, 'GET', '/api/worker/contracts', {
    headers: authHeader1,
  });
  assert.equal(contractsRes.status, 200);
  const newContract = contractsRes.body.contracts.find((c) => c.id === contractId);
  assert.ok(newContract);
  assert.ok(newContract.versions);

  // Worker 1 acknowledges ("understood")
  const ackRes = await mockRequest(app, 'POST', `/api/worker/contracts/${contractId}/ack`, {
    headers: authHeader1,
    body: { response: 'understood' },
  });
  assert.equal(ackRes.status, 200);
  assert.equal(ackRes.body.response, 'understood');
});
