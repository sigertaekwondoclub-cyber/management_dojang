-- ==========================================
-- 1. ADD COLUMN FOKUS PRESTASI
-- ==========================================

ALTER TABLE pendaftaran_siswa ADD COLUMN IF NOT EXISTS fokus_prestasi TEXT CHECK (fokus_prestasi IN ('pomsae', 'kyurugi'));
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS fokus_prestasi TEXT CHECK (fokus_prestasi IN ('pomsae', 'kyurugi'));

-- Update views/functions if any (none rely on * strictly in a way that breaks here)
