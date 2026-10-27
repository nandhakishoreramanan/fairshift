'use strict';

/**
 * Robust Input Validation & Sanitization Layer.
 * Guarantees OWASP validation standards and type safety.
 */

/**
 * Custom application validation error with HTTP 400 Bad Request status.
 */
class ValidationError extends Error {
  /**
   * @param {string} message - Human-readable validation failure reason.
   */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

/**
 * Trims input, purges non-printable control characters, and enforces strict length boundaries.
 *
 * @param {unknown} value - Raw string input.
 * @param {object} [options] - Validation parameters.
 * @param {number} [options.min=1] - Minimum length threshold.
 * @param {number} [options.max=500] - Maximum length threshold.
 * @param {string} [options.field='text'] - Field name for clear error messaging.
 * @returns {string} Sanitised and bounded string.
 * @throws {ValidationError} When type or length bounds are violated.
 */
function cleanText(value, { min = 1, max = 500, field = 'text' } = {}) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} is required.`);
  }
  // Remove control characters (excluding newline \n and tab \t)
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (v.length < min) {
    throw new ValidationError(`${field} is too short (min ${min} characters).`);
  }
  if (v.length > max) {
    throw new ValidationError(`${field} exceeds maximum allowed length of ${max} characters.`);
  }
  return v;
}

/**
 * Validates that an input belongs strictly to an allowed enumeration array.
 *
 * @template T
 * @param {T} value - Input value to test.
 * @param {readonly T[]} allowed - Permitted enumerated options.
 * @param {string} [field='value'] - Field name for error messaging.
 * @returns {T} Verified value.
 * @throws {ValidationError} When value is not within permitted options.
 */
function oneOf(value, allowed, field = 'value') {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

/**
 * Parses and validates an optional numeric value within specified min/max boundaries.
 *
 * @param {unknown} value - Value to coerce and validate.
 * @param {object} [options] - Numeric range options.
 * @param {number} [options.min=-Infinity] - Minimum boundary.
 * @param {number} [options.max=Infinity] - Maximum boundary.
 * @returns {number|undefined} Numeric value or undefined if omitted.
 * @throws {ValidationError} When value is invalid or out of bounds.
 */
function optionalNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ValidationError('Invalid numeric input.');
  }
  return n;
}

/**
 * Escapes dangerous HTML entities to prevent Cross-Site Scripting (XSS).
 *
 * @param {string} str - Raw string.
 * @returns {string} Safe HTML-escaped string.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { ValidationError, cleanText, oneOf, optionalNumber, escapeHtml };
