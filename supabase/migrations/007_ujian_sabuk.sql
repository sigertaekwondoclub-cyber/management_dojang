-- ==========================================
-- FASE 5: UJIAN KENAIKAN SABUK
-- ==========================================

CREATE TABLE ujian_sabuk (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    tgl_ujian DATE NOT NULL,
    sabuk_asal TEXT NOT NULL,
    sabuk_tujuan TEXT NOT NULL,
    hasil TEXT CHECK (hasil IN ('lulus', 'tidak_lulus')),
    penguji TEXT NOT NULL,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE ujian_sabuk ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin full access to ujian_sabuk"
ON ujian_sabuk FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Pelatih: INSERT & UPDATE
CREATE POLICY "Pelatih insert/update ujian_sabuk"
ON ujian_sabuk FOR ALL
TO authenticated
USING (get_my_role() = 'pelatih')
WITH CHECK (get_my_role() = 'pelatih');

-- Ortu: SELECT only for their child
CREATE POLICY "Ortu can view own child ujian"
ON ujian_sabuk FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND
    siswa_id = (
        SELECT siswa_id FROM profiles WHERE id = auth.uid()
    )
);

-- ==========================================
-- TRIGGER: UPDATE SABUK SISWA JIKA LULUS
-- ==========================================
CREATE OR REPLACE FUNCTION update_sabuk_siswa_on_lulus()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika hasil diupdate menjadi 'lulus'
    IF NEW.hasil = 'lulus' AND (OLD.hasil IS NULL OR OLD.hasil != 'lulus') THEN
        UPDATE siswa SET sabuk_saat_ini = NEW.sabuk_tujuan WHERE id = NEW.siswa_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_ujian_sabuk_lulus
AFTER UPDATE ON ujian_sabuk
FOR EACH ROW
EXECUTE FUNCTION update_sabuk_siswa_on_lulus();
