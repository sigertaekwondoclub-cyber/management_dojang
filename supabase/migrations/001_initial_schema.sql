-- ==========================================
-- 1. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- Tabel: program_kelas
CREATE TABLE program_kelas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_program TEXT NOT NULL,
    frekuensi_per_minggu INT NOT NULL,
    biaya_bulanan NUMERIC NOT NULL,
    deskripsi TEXT,
    status_aktif BOOLEAN DEFAULT true
);

-- Tabel: pelatih
CREATE TABLE pelatih (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama TEXT NOT NULL,
    sabuk TEXT NOT NULL,
    no_hp TEXT NOT NULL,
    tgl_gabung DATE NOT NULL,
    rate_honor_per_sesi NUMERIC,
    status_aktif BOOLEAN DEFAULT true
);

-- Tabel: siswa
CREATE TABLE siswa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama TEXT NOT NULL,
    tgl_lahir DATE NOT NULL,
    sabuk_saat_ini TEXT DEFAULT 'Putih',
    tgl_gabung DATE DEFAULT CURRENT_DATE,
    no_hp_ortu TEXT NOT NULL,
    status_aktif BOOLEAN DEFAULT true,
    foto_url TEXT,
    no_kartu TEXT,
    program_kelas_id UUID REFERENCES program_kelas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel: pendaftaran_siswa
CREATE TABLE pendaftaran_siswa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_calon_siswa TEXT NOT NULL,
    tgl_lahir DATE NOT NULL,
    nama_ortu TEXT NOT NULL,
    no_hp_ortu TEXT NOT NULL,
    program_kelas_id UUID REFERENCES program_kelas(id) ON DELETE SET NULL,
    tgl_daftar TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'diterima', 'ditolak')),
    catatan_admin TEXT
);

-- Tabel: profiles
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role TEXT CHECK (role IN ('admin', 'pelatih', 'ortu')) NOT NULL,
    siswa_id UUID REFERENCES siswa(id) ON DELETE SET NULL,
    pelatih_id UUID REFERENCES pelatih(id) ON DELETE SET NULL,
    nama TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. SEED DATA
-- ==========================================

INSERT INTO program_kelas (nama_program, frekuensi_per_minggu, biaya_bulanan, deskripsi, status_aktif) 
VALUES 
    ('Umum', 1, 100000, 'Latihan umum reguler', true),
    ('Prestasi', 2, 200000, '1 sesi umum + 1 sesi pomsae/kyurugi', true);

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE program_kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pelatih ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendaftaran_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- POLICIES: profiles
-- ------------------------------------------
-- User can read own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Admin can read all profiles
CREATE POLICY "Admin can view all profiles" 
ON profiles FOR SELECT 
TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admin can insert/update profiles (saat buat akun kelola akun)
CREATE POLICY "Admin can insert profiles" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin can update profiles" 
ON profiles FOR UPDATE 
TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ------------------------------------------
-- POLICIES: program_kelas
-- ------------------------------------------
-- Everyone can read (including anon for public form)
CREATE POLICY "Everyone can view program kelas" 
ON program_kelas FOR SELECT 
TO authenticated, anon 
USING (true);

-- Only admin can modify
CREATE POLICY "Admin can insert program kelas" ON program_kelas FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Admin can update program kelas" ON program_kelas FOR UPDATE TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ------------------------------------------
-- POLICIES: pendaftaran_siswa
-- ------------------------------------------
-- Anyone can insert (public form)
CREATE POLICY "Anyone can insert pendaftaran" 
ON pendaftaran_siswa FOR INSERT 
TO authenticated, anon 
WITH CHECK (true);

-- Only admin can view and update
CREATE POLICY "Admin can view pendaftaran" 
ON pendaftaran_siswa FOR SELECT 
TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin can update pendaftaran" 
ON pendaftaran_siswa FOR UPDATE 
TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ------------------------------------------
-- POLICIES: siswa
-- ------------------------------------------
-- Admin full access
CREATE POLICY "Admin full access to siswa" 
ON siswa FOR ALL 
TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Pelatih read-only all
CREATE POLICY "Pelatih can view all siswa" 
ON siswa FOR SELECT 
TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'pelatih');

-- Ortu read only where siswa.id = profiles.siswa_id
CREATE POLICY "Ortu can view own child" 
ON siswa FOR SELECT 
TO authenticated 
USING (
    id IN (
        SELECT siswa_id FROM profiles 
        WHERE id = auth.uid() AND role = 'ortu'
    )
);

-- ------------------------------------------
-- POLICIES: pelatih
-- ------------------------------------------
-- Admin full access
CREATE POLICY "Admin full access to pelatih" 
ON pelatih FOR ALL 
TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Pelatih can read own data
CREATE POLICY "Pelatih can view own data" 
ON pelatih FOR SELECT 
TO authenticated 
USING (
    id IN (
        SELECT pelatih_id FROM profiles 
        WHERE id = auth.uid() AND role = 'pelatih'
    )
);

