-- ==========================================
-- FASE 6: EVENT & KOMPETISI
-- ==========================================

-- Tabel: event_kompetisi
CREATE TABLE event_kompetisi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama TEXT NOT NULL,
    tgl DATE NOT NULL,
    lokasi TEXT NOT NULL,
    biaya_pendaftaran NUMERIC NOT NULL DEFAULT 0,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel: event_peserta
CREATE TABLE event_peserta (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES event_kompetisi(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    status_daftar TEXT NOT NULL DEFAULT 'terdaftar' CHECK (status_daftar IN ('terdaftar', 'batal')),
    hasil TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, siswa_id)
);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE event_kompetisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_peserta ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- POLICIES: event_kompetisi
-- ------------------------------------------

-- Admin: full access
CREATE POLICY "Admin full access event_kompetisi"
ON event_kompetisi FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Pelatih & Ortu: Read-only (SELECT)
CREATE POLICY "Pelatih and Ortu select event_kompetisi"
ON event_kompetisi FOR SELECT
TO authenticated
USING (get_my_role() IN ('pelatih', 'ortu'));


-- ------------------------------------------
-- POLICIES: event_peserta
-- ------------------------------------------

-- Admin: full access
CREATE POLICY "Admin full access event_peserta"
ON event_peserta FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Pelatih: SELECT, INSERT, UPDATE (tapi tidak delete)
CREATE POLICY "Pelatih insert/update event_peserta"
ON event_peserta FOR ALL
TO authenticated
USING (get_my_role() = 'pelatih')
WITH CHECK (get_my_role() = 'pelatih');

-- Ortu: SELECT dan INSERT untuk anaknya sendiri
CREATE POLICY "Ortu select own child event_peserta"
ON event_peserta FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND
    siswa_id = (SELECT siswa_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Ortu insert own child event_peserta"
ON event_peserta FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'ortu' AND
    siswa_id = (SELECT siswa_id FROM profiles WHERE id = auth.uid())
);
