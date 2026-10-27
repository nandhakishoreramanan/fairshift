'use strict';

/**
 * Multilingual Translation & Voice Synthesis Subsystem.
 *
 * Provides resilient 5-language accessibility (English, Hindi, Tamil, Telugu, Bengali):
 * 1. Cloud Mode: Connects to Google Cloud Translation v2 when ENABLE_CLOUD_TRANSLATE=true.
 * 2. Edge / Browser Fallback: In-memory LRU cache with language-independent visual cues.
 * 3. Client Voice: Synthesised regional speech via W3C Web Speech API with regional accents (en-IN, hi-IN, ta-IN, te-IN, bn-IN).
 */
const config = require('../config');
const { callGoogleApi } = require('./google');

/** Supported languages configuration. */
const LANGUAGES = Object.freeze({
  en: { name: 'English', native: 'English', speech: 'en-IN' },
  hi: { name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN' },
  ta: { name: 'Tamil', native: 'தமிழ்', speech: 'ta-IN' },
  te: { name: 'Telugu', native: 'తెలుగు', speech: 'te-IN' },
  bn: { name: 'Bengali', native: 'বাংলা', speech: 'bn-IN' },
});
const LANGUAGE_CODES = Object.keys(LANGUAGES);

const CACHE_LIMIT = 500;
const cache = new Map();

/**
 * Derives unique composite cache key for memoisation.
 *
 * @param {string} text - Source text.
 * @param {string} target - Target ISO language code.
 * @returns {string} Cache key.
 */
function cacheKey(text, target) {
  return `${target}::${text}`;
}

/**
 * Caches translation with LRU eviction to prevent memory growth.
 *
 * @param {string} key - Cache key.
 * @param {{ text: string, translated: boolean }} value - Translation result.
 * @returns {void}
 */
function remember(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

/**
 * Checks whether language code is officially supported.
 *
 * @param {string} lang - ISO code.
 * @returns {boolean} True if supported.
 */
function isSupported(lang) {
  return LANGUAGE_CODES.includes(lang);
}

/**
 * Translates text into target language with automated fallback.
 *
 * @param {string} text - Source content.
 * @param {string} target - Target language code.
 * @param {string} [source] - Optional source language code.
 * @returns {Promise<{ text: string, translated: boolean }>} Translated text and success flag.
 */
async function translateText(text, target, source) {
  if (!text || target === source || !isSupported(target)) return { text, translated: target === source };
  const key = cacheKey(text, target);
  if (cache.has(key)) return cache.get(key);
  if (!config.gcp.translateEnabled) return { text, translated: false };
  try {
    const body = await callGoogleApi('https://translation.googleapis.com/language/translate/v2', {
      q: text,
      target,
      ...(source ? { source } : {}),
      format: 'text',
    });
    const result = { text: body.data.translations[0].translatedText, translated: true };
    remember(key, result);
    return result;
  } catch {
    return { text, translated: false };
  }
}

/**
 * Translates content simultaneously across all 5 supported regional languages.
 *
 * @param {string} text - Source content.
 * @param {string} sourceLang - Original language of the content.
 * @returns {Promise<Record<string, string>>} Mapping of language code to translated string.
 */
async function translateToAll(text, sourceLang) {
  const entries = await Promise.all(
    LANGUAGE_CODES.map(async (code) => {
      if (code === sourceLang) return [code, text];
      const res = await translateText(text, code, sourceLang);
      return [code, res.text];
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Synthesizes speech using Google Cloud Text-to-Speech API if enabled,
 * or returns null so the client falls back to native Web Speech API.
 *
 * @param {string} text - Content to speak.
 * @param {string} lang - ISO language code.
 * @returns {Promise<string|null>} Base64 audio content or null if disabled/error.
 */
async function synthesizeSpeech(text, lang) {
  if (!config.gcp.ttsEnabled || !text || !isSupported(lang)) return null;
  try {
    const speechCode = LANGUAGES[lang]?.speech || 'en-IN';
    const body = await callGoogleApi('https://texttospeech.googleapis.com/v1/text:synthesize', {
      input: { text },
      voice: { languageCode: speechCode, ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    });
    return body?.audioContent || null;
  } catch {
    return null;
  }
}

module.exports = { LANGUAGES, LANGUAGE_CODES, translateText, translateToAll, synthesizeSpeech };
