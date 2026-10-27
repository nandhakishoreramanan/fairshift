'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Auto-load .env if present (local dev)
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch {}

const config = require('../src/config');
const { createApp } = require('../src/app');
const { createStore } = require('../src/data/store');

const store = createStore({ now: Date.now(), anonSecret: config.anonSecret });
const app = createApp({ config, store });

module.exports = app;
