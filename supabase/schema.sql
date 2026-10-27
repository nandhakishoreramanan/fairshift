-- ============================================================================
-- FairShift Database Schema for Supabase (PostgreSQL)
-- UN SDG 8: Decent Work & Economic Growth
-- ============================================================================

-- 1. Organisations (Construction & Education / Colleges)
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL
);

-- 2. Sites & Workplaces
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  radius_m NUMERIC NOT NULL DEFAULT 400
);

-- 3. Workers (Demographic, wage model, and skill profile)
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ta',
  pay_type TEXT NOT NULL DEFAULT 'daily',
  daily_wage NUMERIC DEFAULT 0,
  monthly_salary NUMERIC DEFAULT 0,
  pin_hash TEXT NOT NULL,
  passport_code TEXT,
  featured BOOLEAN DEFAULT false,
  profile TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  pf BOOLEAN DEFAULT true,
  esi BOOLEAN DEFAULT true,
  allowances JSONB DEFAULT '[]'::jsonb
);

-- 4. Admins & Employers
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL
);

-- 5. Attendance (QR and Geofenced clock-ins)
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ,
  method TEXT NOT NULL DEFAULT 'qr',
  flag TEXT
);

-- 6. Collective Issues / Anonymous Grievance Engine
-- NOTE: Absolutely ZERO worker IDs are stored in this table to preserve whistleblower privacy.
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  support_count INTEGER NOT NULL DEFAULT 1,
  support_tokens TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

-- 7. Multilingual Voice Contracts & Site Notices
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  translations JSONB DEFAULT '{}'::jsonb,
  audio_keys JSONB DEFAULT '{}'::jsonb
);

-- 8. Contract Comprehension Acknowledgements ("I understood" / "I have a doubt")
CREATE TABLE IF NOT EXISTS contract_acks (
  id BIGSERIAL PRIMARY KEY,
  contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id, worker_id)
);

-- 9. Portable Skill Passport Credentials
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT true
);

-- 10. Anonymous Pulse Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  "topic" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "coarse_day" TEXT NOT NULL
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_attendance_worker ON attendance(worker_id, check_in);
CREATE INDEX IF NOT EXISTS idx_attendance_site ON attendance(site_id, check_in);
CREATE INDEX IF NOT EXISTS idx_issues_org ON issues(org_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_site ON issues(site_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_org ON contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback(org_id);

-- Enable Row Level Security (RLS)
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Clean standard RLS Policies (No DO $$ block needed)
DROP POLICY IF EXISTS "Public read orgs" ON orgs;
CREATE POLICY "Public read orgs" ON orgs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read sites" ON sites;
CREATE POLICY "Public read sites" ON sites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read workers" ON workers;
CREATE POLICY "Public read workers" ON workers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read admins" ON admins;
CREATE POLICY "Public read admins" ON admins FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public all attendance" ON attendance;
CREATE POLICY "Public all attendance" ON attendance FOR ALL USING (true);

DROP POLICY IF EXISTS "Public all issues" ON issues;
CREATE POLICY "Public all issues" ON issues FOR ALL USING (true);

DROP POLICY IF EXISTS "Public all contracts" ON contracts;
CREATE POLICY "Public all contracts" ON contracts FOR ALL USING (true);

DROP POLICY IF EXISTS "Public all contract_acks" ON contract_acks;
CREATE POLICY "Public all contract_acks" ON contract_acks FOR ALL USING (true);

DROP POLICY IF EXISTS "Public all skills" ON skills;
CREATE POLICY "Public all skills" ON skills FOR ALL USING (true);

DROP POLICY IF EXISTS "Public all feedback" ON feedback;
CREATE POLICY "Public all feedback" ON feedback FOR ALL USING (true);
