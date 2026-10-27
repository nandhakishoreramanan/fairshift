'use strict';

/**
 * Collective anonymous complaints ("Me too").
 *
 * Issues never hold worker IDs. Support is recorded as an opaque per-issue
 * token (see lib/anon.js) plus a count.
 */
const { anonToken, coarseTimestamp } = require('../lib/anon');
const { translateToAll } = require('../lib/translate');

const CATEGORIES = Object.freeze(['water', 'safety', 'wages', 'sanitation', 'harassment', 'workload', 'equipment', 'facilities', 'other']);
const STATUSES = Object.freeze(['open', 'in_progress', 'resolved']);

function localise(issue, lang) {
  const text = issue.text[lang];
  return { text: text || issue.text[issue.originalLang], translated: Boolean(text) || lang === issue.originalLang };
}

/** Worker view: localised text + whether *this* worker has supported it. */
function toWorkerView(issue, worker, anonSecret) {
  const token = anonToken(anonSecret, worker.id, issue.id);
  const { text, translated } = localise(issue, worker.lang);
  return {
    id: issue.id,
    category: issue.category,
    text,
    translated,
    originalText: issue.text[issue.originalLang],
    originalLang: issue.originalLang,
    status: issue.status,
    supportCount: issue.supportCount,
    supportedByMe: issue.supporterTokens.includes(token),
    history: issue.history,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

/** Admin view: aggregate only. Tokens are never exposed. */
function toAdminView(issue, siteName) {
  return {
    id: issue.id,
    siteId: issue.siteId,
    siteName,
    category: issue.category,
    text: issue.text.en || issue.text[issue.originalLang],
    originalText: issue.text[issue.originalLang],
    originalLang: issue.originalLang,
    status: issue.status,
    supportCount: issue.supportCount,
    history: issue.history,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

async function createIssue(store, worker, { category, text, lang }, anonSecret, now = Date.now()) {
  const translations = await translateToAll(text, lang);
  const at = coarseTimestamp(now);
  const issue = store.addIssue({
    orgId: worker.orgId,
    siteId: worker.siteId,
    category,
    text: { ...translations, [lang]: text },
    originalLang: lang,
    status: 'open',
    createdAt: at,
    updatedAt: at,
    supporterTokens: [],
    supportCount: 0,
    history: [{ status: 'open', at }],
  });
  // The reporter counts as the first supporter – stored only as a token.
  addSupport(issue, worker, anonSecret);
  return issue;
}

/** Idempotent "Me too". Returns true if this tap added a new supporter. */
function addSupport(issue, worker, anonSecret) {
  const token = anonToken(anonSecret, worker.id, issue.id);
  if (issue.supporterTokens.includes(token)) return false;
  issue.supporterTokens.push(token);
  issue.supportCount = issue.supporterTokens.length;
  return true;
}

function updateStatus(issue, status, note, now = Date.now()) {
  const at = new Date(now).toISOString();
  issue.status = status;
  issue.updatedAt = at;
  issue.history.push({ status, at, ...(note ? { note } : {}) });
  return issue;
}

module.exports = { CATEGORIES, STATUSES, toWorkerView, toAdminView, createIssue, addSupport, updateStatus };
