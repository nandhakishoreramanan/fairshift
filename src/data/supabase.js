'use strict';

/**
 * Supabase client and sync engine for FairShift.
 *
 * Provides resilient two-way persistence:
 * 1. Reads are cached in-memory for sub-millisecond local responses.
 * 2. Writes write-through to Supabase tables in real-time.
 * 3. Gracefully degrades to local seed memory if credentials are not configured or offline.
 */
const { createClient } = require('@supabase/supabase-js');

let client = null;
let enabled = false;

function getSupabaseClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (url && key) {
    try {
      client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      enabled = true;
    } catch (err) {
      console.warn('[Supabase] Failed to initialize client:', err.message);
      enabled = false;
    }
  }
  return client;
}

function isSupabaseEnabled() {
  getSupabaseClient();
  return enabled;
}

/**
 * Load remote records from Supabase into memory on startup.
 */
async function loadFromSupabase() {
  const sb = getSupabaseClient();
  if (!sb) return null;

  try {
    const [
      { data: orgs },
      { data: sites },
      { data: workers },
      { data: admins },
      { data: attendance },
      { data: issues },
      { data: contracts },
      { data: acks },
      { data: skills },
      { data: feedback },
    ] = await Promise.all([
      sb.from('orgs').select('*'),
      sb.from('sites').select('*'),
      sb.from('workers').select('*'),
      sb.from('admins').select('*'),
      sb.from('attendance').select('*'),
      sb.from('issues').select('*'),
      sb.from('contracts').select('*'),
      sb.from('contract_acks').select('*'),
      sb.from('skills').select('*'),
      sb.from('feedback').select('*'),
    ]);

    // If tables are empty, return null so seed runs
    if (!orgs || orgs.length === 0 || !workers || workers.length === 0) {
      console.log('[Supabase] Connected, but tables are empty. Running auto-seed...');
      return null;
    }

    console.log(`[Supabase] Successfully loaded ${workers.length} workers, ${issues?.length || 0} issues, ${attendance?.length || 0} shifts.`);

    return {
      orgs: orgs || [],
      sites: (sites || []).map((s) => ({
        id: s.id,
        orgId: s.org_id,
        name: s.name,
        lat: Number(s.lat),
        lng: Number(s.lng),
        radiusM: Number(s.radius_m),
      })),
      workers: (workers || []).map((w) => ({
        id: w.id,
        orgId: w.org_id,
        siteId: w.site_id,
        name: w.name,
        role: w.role,
        lang: w.lang,
        payType: w.pay_type,
        dailyWage: Number(w.daily_wage || 0),
        monthlySalary: Number(w.monthly_salary || 0),
        pinHash: w.pin_hash,
        passportCode: w.passport_code,
        featured: Boolean(w.featured),
        profile: w.profile,
        joinedAt: w.joined_at,
        pf: Boolean(w.pf),
        esi: Boolean(w.esi),
        allowances: w.allowances || [],
      })),
      admins: (admins || []).map((a) => ({
        id: a.id,
        orgId: a.org_id,
        name: a.name,
        pinHash: a.pin_hash,
      })),
      attendance: (attendance || []).map((att) => ({
        id: att.id,
        workerId: att.worker_id,
        siteId: att.site_id,
        checkIn: att.check_in,
        checkOut: att.check_out,
        method: att.method,
        flag: att.flag,
      })),
      issues: (issues || []).map((i) => ({
        id: i.id,
        orgId: i.org_id,
        siteId: i.site_id,
        category: i.category,
        urgency: i.urgency,
        title: i.title,
        description: i.description,
        status: i.status,
        supportCount: Number(i.support_count || 1),
        supportTokens: i.support_tokens || [],
        createdAt: i.created_at,
        resolvedAt: i.resolved_at,
        resolutionNote: i.resolution_note,
      })),
      contracts: (contracts || []).map((c) => ({
        id: c.id,
        orgId: c.org_id,
        siteId: c.site_id,
        title: c.title,
        body: c.body,
        createdAt: c.created_at,
        translations: c.translations || {},
        audioKeys: c.audio_keys || {},
      })),
      acks: (acks || []).map((a) => ({
        contractId: a.contract_id,
        workerId: a.worker_id,
        response: a.response,
        at: a.at,
      })),
      skills: (skills || []).map((s) => ({
        id: s.id,
        workerId: s.worker_id,
        title: s.title,
        issuer: s.issuer,
        issuedAt: s.issued_at,
        verified: Boolean(s.verified),
      })),
      feedback: (feedback || []).map((f) => ({
        orgId: f.org_id,
        topic: f.topic,
        score: Number(f.score),
        coarseDay: f.coarse_day,
      })),
    };
  } catch (err) {
    console.warn('[Supabase] Sync failed, running local mode:', err.message);
    return null;
  }
}

/**
 * Seed all synthetic seed data into Supabase tables.
 */
async function seedToSupabase(db) {
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    console.log('[Supabase] Seeding orgs and sites...');
    await sb.from('orgs').upsert(db.orgs);
    await sb.from('sites').upsert(
      db.sites.map((s) => ({
        id: s.id,
        org_id: s.orgId,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        radius_m: s.radiusM,
      }))
    );

    console.log(`[Supabase] Seeding ${db.workers.length} workers...`);
    await sb.from('workers').upsert(
      db.workers.map((w) => ({
        id: w.id,
        org_id: w.orgId,
        site_id: w.siteId,
        name: w.name,
        role: w.role,
        lang: w.lang,
        pay_type: w.payType,
        daily_wage: w.dailyWage || 0,
        monthly_salary: w.monthlySalary || 0,
        pin_hash: w.pinHash,
        passport_code: w.passportCode,
        featured: w.featured,
        profile: w.profile,
        joined_at: w.joinedAt,
        pf: w.pf,
        esi: w.esi,
        allowances: w.allowances || [],
      }))
    );

    await sb.from('admins').upsert(
      db.admins.map((a) => ({
        id: a.id,
        org_id: a.orgId,
        name: a.name,
        pin_hash: a.pinHash,
      }))
    );

    console.log(`[Supabase] Seeding ${db.issues.length} collective grievances...`);
    await sb.from('issues').upsert(
      db.issues.map((i) => ({
        id: i.id,
        org_id: i.orgId,
        site_id: i.siteId,
        category: i.category,
        urgency: i.urgency || 'medium',
        title: i.title,
        description: i.description,
        status: i.status,
        support_count: i.supportCount || 1,
        support_tokens: i.supportTokens || [],
        created_at: i.createdAt,
        resolved_at: i.resolvedAt,
        resolution_note: i.resolutionNote,
      }))
    );

    await sb.from('contracts').upsert(
      db.contracts.map((c) => ({
        id: c.id,
        org_id: c.orgId,
        site_id: c.siteId,
        title: c.title,
        body: c.body,
        created_at: c.createdAt,
        translations: c.translations || {},
        audio_keys: c.audioKeys || {},
      }))
    );

    if (db.skills?.length) {
      await sb.from('skills').upsert(
        db.skills.map((s) => ({
          id: s.id,
          worker_id: s.workerId,
          title: s.title,
          issuer: s.issuer,
          issued_at: s.issuedAt,
          verified: s.verified,
        }))
      );
    }

    console.log('[Supabase] Seeding completed successfully!');
    return true;
  } catch (err) {
    console.error('[Supabase] Seeding error:', err.message);
    return false;
  }
}

// ---- Asynchronous Write-through Hooks --------------------------------------

function writeAttendance(rec) {
  if (!enabled) return;
  client
    .from('attendance')
    .upsert({
      id: rec.id,
      worker_id: rec.workerId,
      site_id: rec.siteId,
      check_in: rec.checkIn,
      check_out: rec.checkOut,
      method: rec.method || 'qr',
      flag: rec.flag || null,
    })
    .catch((err) => console.warn('[Supabase] writeAttendance error:', err.message));
}

function writeIssue(rec) {
  if (!enabled) return;
  client
    .from('issues')
    .upsert({
      id: rec.id,
      org_id: rec.orgId,
      site_id: rec.siteId,
      category: rec.category,
      urgency: rec.urgency || 'medium',
      title: rec.title,
      description: rec.description,
      status: rec.status || 'open',
      support_count: rec.supportCount || 1,
      support_tokens: rec.supportTokens || [],
      created_at: rec.createdAt,
      resolved_at: rec.resolvedAt || null,
      resolution_note: rec.resolutionNote || null,
    })
    .catch((err) => console.warn('[Supabase] writeIssue error:', err.message));
}

function writeContract(rec) {
  if (!enabled) return;
  client
    .from('contracts')
    .upsert({
      id: rec.id,
      org_id: rec.orgId,
      site_id: rec.siteId,
      title: rec.title,
      body: rec.body,
      created_at: rec.createdAt,
      translations: rec.translations || {},
      audio_keys: rec.audioKeys || {},
    })
    .catch((err) => console.warn('[Supabase] writeContract error:', err.message));
}

function writeAck(rec) {
  if (!enabled) return;
  client
    .from('contract_acks')
    .upsert(
      {
        contract_id: rec.contractId,
        worker_id: rec.workerId,
        response: rec.response,
        at: rec.at,
      },
      { onConflict: 'contract_id,worker_id' }
    )
    .catch((err) => console.warn('[Supabase] writeAck error:', err.message));
}

function writeSkill(rec) {
  if (!enabled) return;
  client
    .from('skills')
    .upsert({
      id: rec.id,
      worker_id: rec.workerId,
      title: rec.title,
      issuer: rec.issuer,
      issued_at: rec.issuedAt,
      verified: rec.verified !== false,
    })
    .catch((err) => console.warn('[Supabase] writeSkill error:', err.message));
}

function writeFeedback(rec) {
  if (!enabled) return;
  client
    .from('feedback')
    .insert({
      org_id: rec.orgId,
      topic: rec.topic,
      score: rec.score,
      coarse_day: rec.coarseDay,
    })
    .catch((err) => console.warn('[Supabase] writeFeedback error:', err.message));
}

function writeWorkerLang(workerId, lang) {
  if (!enabled) return;
  client
    .from('workers')
    .update({ lang })
    .eq('id', workerId)
    .catch((err) => console.warn('[Supabase] writeWorkerLang error:', err.message));
}

module.exports = {
  getSupabaseClient,
  isSupabaseEnabled,
  loadFromSupabase,
  seedToSupabase,
  writeAttendance,
  writeIssue,
  writeContract,
  writeAck,
  writeSkill,
  writeFeedback,
  writeWorkerLang,
};
