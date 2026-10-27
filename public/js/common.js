/* Shared helpers: API calls, speech (TTS + voice input), toasts, safe DOM building. */
(function () {
  'use strict';

  const TOKEN_KEY = 'fs_token';

  function getToken(role) {
    return sessionStorage.getItem(`${TOKEN_KEY}_${role}`);
  }
  function setToken(role, token) {
    sessionStorage.setItem(`${TOKEN_KEY}_${role}`, token);
  }
  function clearToken(role) {
    sessionStorage.removeItem(`${TOKEN_KEY}_${role}`);
  }

  async function api(path, { method = 'GET', body, role } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = role ? getToken(role) : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      const err = new Error('offline');
      err.offline = true;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && role) {
      clearToken(role);
      location.href = '/';
    }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /** Build DOM nodes safely (no innerHTML with user content). */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  let toastTimer;
  function toast(message, kind = 'info') {
    let box = document.getElementById('toast');
    if (!box) {
      box = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(box);
    }
    box.textContent = message;
    box.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (box.className = 'toast'), 3500);
  }

  // ---- Text to speech -------------------------------------------------------
  let audioEl;
  function findVoice(speechLang) {
    if (!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices();
    const base = speechLang.split('-')[0];
    return voices.find((v) => v.lang === speechLang) || voices.find((v) => v.lang.replace('_', '-').startsWith(base)) || null;
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();

  function stopSpeaking() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (audioEl) audioEl.pause();
  }

  /**
   * Speak text in a language. Order: on-device voice -> server voice (Cloud TTS) -> notify.
   * @returns {Promise<boolean>} whether audio was played
   */
  async function speak(text, lang, role = 'worker') {
    stopSpeaking();
    const speechLang = (window.I18N && window.I18N.SPEECH[lang]) || 'en-IN';
    const voice = findVoice(speechLang);
    if (voice) {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9;
      speechSynthesis.speak(u);
      return true;
    }
    try {
      const { audio } = await api('/api/tts', { method: 'POST', body: { text, lang }, role });
      audioEl = audioEl || new Audio();
      audioEl.src = audio;
      await audioEl.play();
      return true;
    } catch {
      if ('speechSynthesis' in window && lang === 'en') {
        speechSynthesis.speak(new SpeechSynthesisUtterance(text));
        return true;
      }
      toast(window.I18N ? window.I18N.t('voice_unavailable') : 'Voice unavailable', 'warn');
      return false;
    }
  }

  // ---- Voice input ----------------------------------------------------------
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  /** Start dictation into a textarea. Returns a stop() function, or null if unsupported. */
  function dictate(lang, onText, onEnd) {
    if (!Recognition) return null;
    const rec = new Recognition();
    rec.lang = (window.I18N && window.I18N.SPEECH[lang]) || 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      onText(text);
    };
    rec.onend = onEnd;
    rec.onerror = onEnd;
    rec.start();
    return () => rec.stop();
  }

  /**
   * Optional on-device translation (Chrome built-in Translator API) used only when the
   * server has no translation for the worker's language. Fails silently elsewhere.
   */
  async function deviceTranslate(text, from, to) {
    try {
      if (!('Translator' in self) || from === to) return null;
      const avail = await self.Translator.availability({ sourceLanguage: from, targetLanguage: to });
      if (avail === 'unavailable') return null;
      const tr = await self.Translator.create({ sourceLanguage: from, targetLanguage: to });
      return await tr.translate(text);
    } catch {
      return null;
    }
  }

  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtTime = (iso, lang) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso, lang) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: 'numeric', month: 'short' });

  window.FS = { api, h, toast, speak, stopSpeaking, dictate, canDictate: Boolean(Recognition), deviceTranslate, getToken, setToken, clearToken, money, fmtTime, fmtDate };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update().catch(() => {});
      }).catch(() => {});
    });
  }
})();
