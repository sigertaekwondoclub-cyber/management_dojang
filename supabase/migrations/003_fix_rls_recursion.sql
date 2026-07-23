-- ==========================================
-- FIX LANGKAH 1: Helper function (jalankan sebagai role = postgres)
-- ==========================================

-- Buat function yang baca role TANPA kena RLS (bypass via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Grant execute ke semua authenticated users
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

-- ==========================================
-- FIX LANGKAH 2: Drop & recreate policies profiles
-- ==========================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;

-- User baca profil sendiri
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admin baca semua
CREATE POLICY "Admin can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (get_my_role() = 'admin');

-- Admin insert profiles
CREATE POLICY "Admin can insert profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (get_my_role() = 'admin');

-- Admin update profiles
CREATE POLICY "Admin can update profiles"
ON profiles FOR UPDATE
TO authenticated
USING (get_my_role() = 'admin');

-- ==========================================
-- FIX LANGKAH 3: Drop & recreate policies tabel lain
-- ==========================================

DROP POLICY IF EXISTS "Admin can insert program kelas" ON program_kelas;
DROP POLICY IF EXISTS "Admin can update program kelas" ON program_kelas;
DROP POLICY IF EXISTS "Admin can view pendaftaran" ON pendaftaran_siswa;
DROP POLICY IF EXISTS "Admin can update pendaftaran" ON pendaftaran_siswa;
DROP POLICY IF EXISTS "Admin full access to siswa" ON siswa;
DROP POLICY IF EXISTS "Pelatih can view all siswa" ON siswa;
DROP POLICY IF EXISTS "Admin full access to pelatih" ON pelatih;

CREATE POLICY "Admin can insert program kelas"
ON program_kelas FOR INSERT TO authenticated
WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admin can update program kelas"
ON program_kelas FOR UPDATE TO authenticated
USING (get_my_role() = 'admin');

CREATE POLICY "Admin can view pendaftaran"
ON pendaftaran_siswa FOR SELECT TO authenticated
USING (get_my_role() = 'admin');

CREATE POLICY "Admin can update pendaftaran"
ON pendaftaran_siswa FOR UPDATE TO authenticated
USING (get_my_role() = 'admin');

CREATE POLICY "Admin full access to siswa"
ON siswa FOR ALL TO authenticated
USING (get_my_role() = 'admin');

CREATE POLICY "Pelatih can view all siswa"
ON siswa FOR SELECT TO authenticated
USING (get_my_role() = 'pelatih');

CREATE POLICY "Admin full access to pelatih"
ON pelatih FOR ALL TO authenticated
USING (get_my_role() = 'admin');
