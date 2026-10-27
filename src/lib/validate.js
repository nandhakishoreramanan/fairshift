'use strict';

/** Small input-validation helpers (keeps route handlers readable). */

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/** Trim, strip control characters and enforce length bounds. */
function cleanText(value, { min = 1, max = 500, field = 'text' } = {}) {
  if (typeof value !== 'string') throw new ValidationError(`${field} is required`);
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (v.length < min) throw new ValidationError(`${field} is too short`);
  if (v.length > max) throw new ValidationError(`${field} is too long (max ${max})`);
  return v;
}

function oneOf(value, allowed, field = 'value') {
  if (!allowed.includes(value)) throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

function optionalNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError('invalid number');
  return n;
}

module.exports = { ValidationError, cleanText, oneOf, optionalNumber };
