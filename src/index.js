'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Auto-load .env if present
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

const config = require('./config');
const { createApp } = require('./app');
const { loadFromSupabase, isSupabaseEnabled, seedToSupabase } = require('./data/supabase');
const { createStore } = require('./data/store');

async function start() {
  let preloadedDb = null;

  if (isSupabaseEnabled()) {
    console.log('[Supabase] Initialising connection...');
    preloadedDb = await loadFromSupabase();
  }

  const store = createStore({ now: Date.now(), anonSecret: config.anonSecret, preloadedDb });

  // If Supabase was connected but tables were empty, auto-seed with raw store data
  if (isSupabaseEnabled() && !preloadedDb && store._raw) {
    console.log('[Supabase] Automatically seeding remote tables with default dataset...');
    seedToSupabase(store._raw).catch((err) => console.warn('[Supabase] Auto-seed background error:', err.message));
  }

  const app = createApp({ config, store });
  const server = app.listen(config.port, () => {
    console.log(`FairShift listening on port ${config.port}`);
    if (isSupabaseEnabled()) {
      console.log('⚡ Connected to Supabase (PostgreSQL)');
    } else {
      console.log('🌱 Running with in-memory seeded store (set SUPABASE_URL & SUPABASE_KEY to enable Supabase)');
    }
  });

  // Graceful shutdown for Cloud Run (SIGTERM before instance stop).
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

start();
