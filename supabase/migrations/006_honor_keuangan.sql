-- ==========================================
-- FASE 4: HONOR PELATIH & KEUANGAN KLUB
-- ==========================================

-- ==========================================
-- 1. CREATE TABLES
-- ==========================================

-- Tabel: pengaturan_club
CREATE TABLE pengaturan_club (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    persentase_pool_honor NUMERIC NOT NULL DEFAULT 40,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed 1 baris default
INSERT INTO pengaturan_club (persentase_pool_honor) VALUES (40);

-- Tabel: honor_pelatih
CREATE TABLE honor_pelatih (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE CASCADE,
    bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    tahun INT NOT NULL,
    jumlah_sesi_mengajar INT NOT NULL DEFAULT 0,
    total_sesi_semua_pelatih INT NOT NULL DEFAULT 0,
    total_iuran_terkumpul_bulan NUMERIC NOT NULL DEFAULT 0,
    persentase_pool_dipakai NUMERIC NOT NULL DEFAULT 40,
    total_pool_honor NUMERIC NOT NULL DEFAULT 0,
    honor_diterima NUMERIC NOT NULL DEFAULT 0,
    status_dibayar BOOLEAN NOT NULL DEFAULT false,
    tgl_dibayar DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (pelatih_id, bulan, tahun)
);

-- Tabel: keuangan_club
CREATE TABLE keuangan_club (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tgl DATE NOT NULL,
    jenis TEXT NOT NULL CHECK (jenis IN ('income', 'expense')),
    kategori TEXT NOT NULL,
    nominal NUMERIC NOT NULL,
    keterangan TEXT NOT NULL,
    sumber TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE pengaturan_club ENABLE ROW LEVEL SECURITY;
ALTER TABLE honor_pelatih ENABLE ROW LEVEL SECURITY;
ALTER TABLE keuangan_club ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- POLICIES: pengaturan_club (admin only)
-- ------------------------------------------
CREATE POLICY "Admin full access to pengaturan_club"
ON pengaturan_club FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- ------------------------------------------
-- POLICIES: honor_pelatih
-- ------------------------------------------

-- Admin: full access
CREATE POLICY "Admin full access to honor_pelatih"
ON honor_pelatih FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Pelatih: SELECT hanya milik sendiri
CREATE POLICY "Pelatih can view own honor"
ON honor_pelatih FOR SELECT
TO authenticated
USING (
    pelatih_id = (
        SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'
    )
);

-- ------------------------------------------
-- POLICIES: keuangan_club (admin only)
-- ------------------------------------------
CREATE POLICY "Admin full access to keuangan_club"
ON keuangan_club FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');
