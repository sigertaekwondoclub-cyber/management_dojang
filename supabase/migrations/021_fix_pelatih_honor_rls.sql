-- ==========================================
-- 021: FIX RLS POLICY UNTUK HONOR & ESTIMASI PELATIH
-- ==========================================

-- 1. Beri izin SELECT pada tabel iuran untuk role pelatih (untuk kalkulasi estimasi honor real-time)
DROP POLICY IF EXISTS "Pelatih can view iuran for estimasi honor" ON iuran;
CREATE POLICY "Pelatih can view iuran for estimasi honor"
ON iuran FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

-- 2. Beri izin SELECT pada tabel payroll_runs untuk role pelatih (agar bisa melihat status payroll resmi & join payroll_details)
DROP POLICY IF EXISTS "Pelatih can view payroll_runs" ON payroll_runs;
CREATE POLICY "Pelatih can view payroll_runs"
ON payroll_runs FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

-- 3. Pastikan policy SELECT payroll_details untuk pelatih menggunakan get_my_pelatih_id()
DROP POLICY IF EXISTS "Pelatih view own payroll details" ON payroll_details;
CREATE POLICY "Pelatih view own payroll details"
ON payroll_details FOR SELECT
TO authenticated
USING (
    get_my_role() = 'pelatih' 
    AND pelatih_id = get_my_pelatih_id()
);

-- 4. Beri izin SELECT pada tabel pelatih agar pelatih dapat melihat daftar pelatih (untuk pembagian founder margin)
DROP POLICY IF EXISTS "Pelatih can view own data" ON pelatih;
DROP POLICY IF EXISTS "Pelatih can view all pelatih" ON pelatih;
CREATE POLICY "Pelatih can view all pelatih"
ON pelatih FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');
