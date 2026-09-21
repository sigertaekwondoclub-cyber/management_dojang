-- ==========================================
-- FIX RLS POLICY UNTUK ABSENSI SISWA & PELATIH
-- ==========================================

-- 1. Helper function untuk get_my_pelatih_id (SECURITY DEFINER untuk hindari RLS recursion)
CREATE OR REPLACE FUNCTION get_my_pelatih_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT pelatih_id FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_pelatih_id() TO authenticated;

-- 2. Reset & Recreate Policies: absensi_siswa
DROP POLICY IF EXISTS "Admin full access to absensi_siswa" ON absensi_siswa;
DROP POLICY IF EXISTS "Pelatih can view all absensi_siswa" ON absensi_siswa;
DROP POLICY IF EXISTS "Pelatih can insert absensi_siswa for own kelas" ON absensi_siswa;
DROP POLICY IF EXISTS "Pelatih can update absensi_siswa for own kelas" ON absensi_siswa;
DROP POLICY IF EXISTS "Pelatih can insert absensi_siswa" ON absensi_siswa;
DROP POLICY IF EXISTS "Pelatih can update absensi_siswa" ON absensi_siswa;
DROP POLICY IF EXISTS "Ortu can view own child absensi" ON absensi_siswa;

-- Admin: full access
CREATE POLICY "Admin full access to absensi_siswa"
ON absensi_siswa FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Pelatih: View all absensi siswa
CREATE POLICY "Pelatih can view all absensi_siswa"
ON absensi_siswa FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

-- Pelatih: INSERT absensi siswa (pelatih_id_pengajar harus miliknya)
CREATE POLICY "Pelatih can insert absensi_siswa"
ON absensi_siswa FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih'
    AND pelatih_id_pengajar = get_my_pelatih_id()
);

-- Pelatih: UPDATE / UPSERT absensi siswa
-- USING hanya mengecek role pelatih agar tidak gagal saat conflict/update data yang sebelumnya diinput pelatih lain / admin
CREATE POLICY "Pelatih can update absensi_siswa"
ON absensi_siswa FOR UPDATE
TO authenticated
USING (get_my_role() = 'pelatih')
WITH CHECK (
    get_my_role() = 'pelatih'
    AND pelatih_id_pengajar = get_my_pelatih_id()
);

-- Ortu: hanya bisa lihat absensi anaknya
CREATE POLICY "Ortu can view own child absensi"
ON absensi_siswa FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu'
    AND siswa_id = (SELECT siswa_id FROM profiles WHERE id = auth.uid())
);


-- 3. Reset & Recreate Policies: absensi_pelatih
DROP POLICY IF EXISTS "Admin full access to absensi_pelatih" ON absensi_pelatih;
DROP POLICY IF EXISTS "Pelatih can view own absensi_pelatih" ON absensi_pelatih;
DROP POLICY IF EXISTS "Pelatih can view all absensi_pelatih" ON absensi_pelatih;
DROP POLICY IF EXISTS "Pelatih can insert own absensi_pelatih" ON absensi_pelatih;
DROP POLICY IF EXISTS "Pelatih can update own absensi_pelatih" ON absensi_pelatih;

-- Admin: full access
CREATE POLICY "Admin full access to absensi_pelatih"
ON absensi_pelatih FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Pelatih: View absensi pelatih (diperlukan dashboard & estimasi honor untuk menghitung total sesi)
CREATE POLICY "Pelatih can view all absensi_pelatih"
ON absensi_pelatih FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

-- Pelatih: INSERT absensi pelatih diri sendiri
CREATE POLICY "Pelatih can insert own absensi_pelatih"
ON absensi_pelatih FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih'
    AND pelatih_id = get_my_pelatih_id()
);

-- Pelatih: UPDATE absensi pelatih diri sendiri
CREATE POLICY "Pelatih can update own absensi_pelatih"
ON absensi_pelatih FOR UPDATE
TO authenticated
USING (
    get_my_role() = 'pelatih'
    AND pelatih_id = get_my_pelatih_id()
)
WITH CHECK (
    get_my_role() = 'pelatih'
    AND pelatih_id = get_my_pelatih_id()
);
