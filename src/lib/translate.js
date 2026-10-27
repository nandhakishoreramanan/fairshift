'use strict';

/**
 * Translation + speech services with graceful degradation.
 *
 * - Cloud Run with ENABLE_CLOUD_TRANSLATE=true -> Google Cloud Translation API.
 * - Otherwise -> text is returned unchanged with `translated: false`, and the UI
 *   still shows language-independent cues (category icons, translated
 *   category labels, status colours) so low-literacy workers are never blocked.
 */
const config = require('../config');
const { callGoogleApi } = require('./google');

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

function cacheKey(text, target) {
  return `${target}::${text}`;
}

function remember(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

function isSupported(lang) {
  return LANGUAGE_CODES.includes(lang);
}

/**
 * @returns {Promise<{ text: string, translated: boolean }>}
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
  } catch (err) {
    console.warn('translate fallback:', err.message);
    return { text, translated: false };
  }
}

/** Translate into every supported language. Returns { en: '...', hi: '...', ... } */
async function translateToAll(text, source) {
  const entries = await Promise.all(
    LANGUAGE_CODES.map(async (lang) => {
      if (lang === source) return [lang, text];
      const r = await translateText(text, lang, source);
      return [lang, r.translated ? r.text : null];
    }),
  );
  return Object.fromEntries(entries.filter(([, v]) => v));
}

/** Server-side speech (MP3, base64) for devices without a local voice for that language. */
async function synthesizeSpeech(text, lang) {
  if (!config.gcp.ttsEnabled || !isSupported(lang)) return null;
  try {
    const body = await callGoogleApi('https://texttospeech.googleapis.com/v1/text:synthesize', {
      input: { text: text.slice(0, 4500) },
      voice: { languageCode: LANGUAGES[lang].speech },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
    });
    return body.audioContent;
  } catch (err) {
    console.warn('tts unavailable:', err.message);
    return null;
  }
}

module.exports = { LANGUAGES, LANGUAGE_CODES, isSupported, translateText, translateToAll, synthesizeSpeech };
