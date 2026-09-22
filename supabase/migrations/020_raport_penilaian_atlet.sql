-- ==========================================
-- 020: TABEL PENILAIAN ATLET (RAPORT SKILL)
-- ==========================================

CREATE TABLE IF NOT EXISTS penilaian_atlet (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    pelatih_id UUID REFERENCES pelatih(id) ON DELETE SET NULL,
    periode_bulan INT NOT NULL CHECK (periode_bulan BETWEEN 1 AND 12),
    periode_tahun INT NOT NULL,
    skor_fisik INT NOT NULL DEFAULT 75 CHECK (skor_fisik BETWEEN 0 AND 100),
    skor_kyorugi INT NOT NULL DEFAULT 75 CHECK (skor_kyorugi BETWEEN 0 AND 100),
    skor_poomsae INT NOT NULL DEFAULT 75 CHECK (skor_poomsae BETWEEN 0 AND 100),
    skor_disiplin INT NOT NULL DEFAULT 85 CHECK (skor_disiplin BETWEEN 0 AND 100),
    catatan_pelatih TEXT,
    rekomendasi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (siswa_id, periode_bulan, periode_tahun)
);

-- RLS
ALTER TABLE penilaian_atlet ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin full access to penilaian_atlet"
ON penilaian_atlet FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Pelatih: read, insert, update
CREATE POLICY "Pelatih can view penilaian_atlet"
ON penilaian_atlet FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

CREATE POLICY "Pelatih can insert penilaian_atlet"
ON penilaian_atlet FOR INSERT
TO authenticated
WITH CHECK (get_my_role() = 'pelatih');

CREATE POLICY "Pelatih can update penilaian_atlet"
ON penilaian_atlet FOR UPDATE
TO authenticated
USING (get_my_role() = 'pelatih')
WITH CHECK (get_my_role() = 'pelatih');

-- Ortu: read own child's report
CREATE POLICY "Ortu can view own child penilaian_atlet"
ON penilaian_atlet FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu'
    AND (
        siswa_id = (SELECT siswa_id FROM profiles WHERE id = auth.uid())
        OR siswa_id IN (
            SELECT s.id FROM siswa s
            WHERE s.no_hp_ortu = (
                SELECT s2.no_hp_ortu FROM siswa s2
                WHERE s2.id = (SELECT siswa_id FROM profiles WHERE id = auth.uid())
            )
        )
    )
);
