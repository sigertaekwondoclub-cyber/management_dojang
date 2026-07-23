-- ==========================================
-- FASE 2: ABSENSI SISWA & PELATIH
-- ==========================================

-- ==========================================
-- 1. CREATE TABLES
-- ==========================================

-- Tabel: absensi_siswa
CREATE TABLE absensi_siswa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tgl DATE NOT NULL,
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    kelas TEXT NOT NULL,
    status_hadir TEXT NOT NULL CHECK (status_hadir IN ('hadir', 'izin', 'sakit', 'alpha')),
    pelatih_id_pengajar UUID NOT NULL REFERENCES pelatih(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tgl, siswa_id, kelas)
);

-- Tabel: absensi_pelatih
CREATE TABLE absensi_pelatih (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tgl DATE NOT NULL,
    pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE CASCADE,
    kelas TEXT NOT NULL,
    jam_masuk TIME NOT NULL,
    jam_keluar TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tgl, pelatih_id, kelas)
);

-- ==========================================
-- 2. ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE absensi_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi_pelatih ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- POLICIES: absensi_siswa
-- ------------------------------------------

-- Admin: full access
CREATE POLICY "Admin full access to absensi_siswa"
ON absensi_siswa FOR ALL
TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Pelatih: SELECT semua absensi siswa
CREATE POLICY "Pelatih can view all absensi_siswa"
ON absensi_siswa FOR SELECT
TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'pelatih');

-- Pelatih: INSERT untuk kelas yang dia ajar (pelatih_id_pengajar = pelatih miliknya)
CREATE POLICY "Pelatih can insert absensi_siswa for own kelas"
ON absensi_siswa FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'pelatih'
    AND pelatih_id_pengajar = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
);

-- Pelatih: UPDATE untuk kelas yang dia ajar
CREATE POLICY "Pelatih can update absensi_siswa for own kelas"
ON absensi_siswa FOR UPDATE
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'pelatih'
    AND pelatih_id_pengajar = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'pelatih'
    AND pelatih_id_pengajar = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
);

-- Ortu: hanya bisa READ absensi anaknya sendiri
CREATE POLICY "Ortu can view own child absensi"
ON absensi_siswa FOR SELECT
TO authenticated
USING (
    siswa_id = (
        SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'
    )
);

-- ------------------------------------------
-- POLICIES: absensi_pelatih
-- ------------------------------------------

-- Admin: full access
CREATE POLICY "Admin full access to absensi_pelatih"
ON absensi_pelatih FOR ALL
TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Pelatih: SELECT hanya data absensi diri sendiri
CREATE POLICY "Pelatih can view own absensi_pelatih"
ON absensi_pelatih FOR SELECT
TO authenticated
USING (
    pelatih_id = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
);

-- Pelatih: INSERT data absensi diri sendiri
CREATE POLICY "Pelatih can insert own absensi_pelatih"
ON absensi_pelatih FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'pelatih'
    AND pelatih_id = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
);

-- Pelatih: UPDATE data absensi diri sendiri
CREATE POLICY "Pelatih can update own absensi_pelatih"
ON absensi_pelatih FOR UPDATE
TO authenticated
USING (
    pelatih_id = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
)
WITH CHECK (
    pelatih_id = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
);

-- Ortu: TIDAK ada akses ke absensi_pelatih (tidak perlu policy, default deny)
