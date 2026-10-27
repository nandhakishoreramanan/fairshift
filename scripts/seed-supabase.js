'use strict';

/**
 * CLI script to seed your Supabase database with realistic demo data
 * for both Construction Sites (BuildRight Infra) and Colleges (Sunrise College).
 *
 * Usage:
 *   SUPABASE_URL="https://your-project.supabase.co" \
 *   SUPABASE_KEY="your-supabase-key" \
 *   npm run supabase:seed
 */
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

const config = require('../src/config');
const { seed } = require('../src/data/seed');
const { seedToSupabase, isSupabaseEnabled } = require('../src/data/supabase');

async function main() {
  if (!isSupabaseEnabled()) {
    console.error('❌ Supabase is not configured.');
    console.error('Please set SUPABASE_URL and SUPABASE_KEY in your environment or .env file.');
    process.exit(1);
  }

  console.log('Generating seed dataset...');
  const db = seed({ now: Date.now(), anonSecret: config.anonSecret });

  console.log(`Pushing dataset to Supabase (${process.env.SUPABASE_URL})...`);
  const success = await seedToSupabase(db);

  if (success) {
    console.log('✅ Supabase database populated successfully!');
    console.log('You can now log in with demo workers (W1001, W2001) or admins (A-BUILD, A-COLLEGE).');
  } else {
    console.error('❌ Failed to seed Supabase database.');
    process.exit(1);
  }
}

main();
