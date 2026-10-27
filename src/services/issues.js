'use strict';

/**
 * Collective Anonymous Grievance & Hazard Escalation Engine ("Me Too").
 *
 * Privacy Guarantees:
 * 1. Issues NEVER store worker IDs.
 * 2. Backing is recorded via non-reversible HMAC-SHA256 blind tokens plus an integer count.
 * 3. Individual workers cannot be singled out, reprimanded, or identified.
 */
const { anonToken, coarseTimestamp } = require('../lib/anon');
const { translateToAll } = require('../lib/translate');

const CATEGORIES = Object.freeze([
  'water',
  'safety',
  'wages',
  'sanitation',
  'harassment',
  'workload',
  'equipment',
  'facilities',
  'other',
]);
const STATUSES = Object.freeze(['open', 'in_progress', 'resolved']);

/**
 * Retrieves the localised text for an issue according to the worker's chosen language.
 *
 * @param {object} issue - Grievance object.
 * @param {string} lang - Worker's preferred language code.
 * @returns {{ text: string, translated: boolean }} Localised text and translation status.
 */
function localise(issue, lang) {
  const text = issue.text[lang];
  return { text: text || issue.text[issue.originalLang], translated: Boolean(text) || lang === issue.originalLang };
}

/**
 * Transforms an issue into a secure frontline worker view.
 *
 * @param {object} issue - Internal issue record.
 * @param {object} worker - Worker session object.
 * @param {string} anonSecret - Secret key used to re-derive the worker's anonymous token.
 * @returns {object} WorkerView DTO.
 */
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

/**
 * Transforms an issue into an aggregate employer/admin view.
 * Tokens and voter signatures are strictly stripped.
 *
 * @param {object} issue - Internal issue record.
 * @param {string} siteName - Human-readable workplace name.
 * @returns {object} AdminView DTO.
 */
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

/**
 * Creates and registers a new anonymous collective issue.
 *
 * @param {object} store - Store repository.
 * @param {object} worker - Reporting worker.
 * @param {object} params - Grievance params.
 * @param {string} params.category - Issue category.
 * @param {string} params.text - Descriptive text.
 * @param {string} params.lang - Source language.
 * @param {string} anonSecret - Cryptographic pepper.
 * @param {number} [now=Date.now()] - Timestamp.
 * @returns {Promise<object>} Created issue record.
 */
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
  // The reporter counts as the first supporter – stored strictly as a blind token.
  addSupport(issue, worker, anonSecret);
  return issue;
}

/**
 * Idempotent "Me too" backing tap.
 *
 * @param {object} issue - Target issue record.
 * @param {object} worker - Supporting worker.
 * @param {string} anonSecret - Cryptographic pepper.
 * @returns {boolean} True if new support was added; false if already backed.
 */
function addSupport(issue, worker, anonSecret) {
  const token = anonToken(anonSecret, worker.id, issue.id);
  if (issue.supporterTokens.includes(token)) return false;
  issue.supporterTokens.push(token);
  issue.supportCount = issue.supporterTokens.length;
  return true;
}

/**
 * Transitions issue status and records audit history.
 *
 * @param {object} issue - Target issue record.
 * @param {string} status - New status.
 * @param {object} [note] - Translated resolution note.
 * @param {number} [now=Date.now()] - Timestamp.
 * @returns {object} Updated issue record.
 */
function updateStatus(issue, status, note, now = Date.now()) {
  const at = new Date(now).toISOString();
  issue.status = status;
  issue.updatedAt = at;
  issue.history.push({ status, at, ...(note ? { note } : {}) });
  return issue;
}

module.exports = { CATEGORIES, STATUSES, toWorkerView, toAdminView, createIssue, addSupport, updateStatus };
