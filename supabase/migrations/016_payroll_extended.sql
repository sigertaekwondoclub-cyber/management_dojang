-- ==========================================
-- PAYROLL SYSTEM MIGRATION
-- ==========================================

-- 1. Extend tabel pelatih
ALTER TABLE pelatih ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('head_coach', 'core_coach', 'assistant_coach')) DEFAULT 'core_coach';
ALTER TABLE pelatih ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT false;

-- 2. Extend tabel pengaturan_club
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS pct_coach_pool NUMERIC DEFAULT 0.45;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS pct_operational NUMERIC DEFAULT 0.18;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS pct_reserve NUMERIC DEFAULT 0.17;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS pct_development NUMERIC DEFAULT 0.12;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS pct_founder_margin NUMERIC DEFAULT 0.08;

-- Update baris default agar totalnya 1.0 (100%)
UPDATE pengaturan_club 
SET 
  pct_coach_pool = 0.45,
  pct_operational = 0.18,
  pct_reserve = 0.17,
  pct_development = 0.12,
  pct_founder_margin = 0.08,
  persentase_pool_honor = 45 -- Sync dengan pct_coach_pool * 100
WHERE id = (SELECT id FROM pengaturan_club LIMIT 1);

-- 3. Extend tabel absensi_pelatih
ALTER TABLE absensi_pelatih ADD COLUMN IF NOT EXISTS program_kelas_id UUID REFERENCES program_kelas(id) ON DELETE SET NULL;

-- 4. Tabel snapshot payroll bulanan (payroll_runs)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun INT NOT NULL,
  total_income NUMERIC NOT NULL DEFAULT 0,
  coach_pool_amount NUMERIC NOT NULL DEFAULT 0,
  operational_amount NUMERIC NOT NULL DEFAULT 0,
  reserve_amount NUMERIC NOT NULL DEFAULT 0,
  development_amount NUMERIC NOT NULL DEFAULT 0,
  founder_margin_amount NUMERIC NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bulan, tahun)
);

-- 5. Tabel detail payout per pelatih (payroll_details)
CREATE TABLE IF NOT EXISTS payroll_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE CASCADE,
  sessions_taught INT NOT NULL DEFAULT 0,
  teaching_honor NUMERIC NOT NULL DEFAULT 0,
  founder_margin_share NUMERIC NOT NULL DEFAULT 0,
  total_payout NUMERIC NOT NULL DEFAULT 0,
  status_dibayar BOOLEAN NOT NULL DEFAULT false,
  tgl_dibayar DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payroll_run_id, pelatih_id)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- ==========================================
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_details ENABLE ROW LEVEL SECURITY;

-- Admin: Full Access
DROP POLICY IF EXISTS "Admin full access payroll_runs" ON payroll_runs;
CREATE POLICY "Admin full access payroll_runs" ON payroll_runs
FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admin full access payroll_details" ON payroll_details;
CREATE POLICY "Admin full access payroll_details" ON payroll_details
FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Pelatih: SELECT own details
DROP POLICY IF EXISTS "Pelatih view own payroll details" ON payroll_details;
CREATE POLICY "Pelatih view own payroll details" ON payroll_details
FOR SELECT TO authenticated 
USING (
  pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
);
