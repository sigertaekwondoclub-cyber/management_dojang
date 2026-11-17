-- ==============================================================================
-- 030: SINKRONISASI & PEMBERSIHAN FOKUS PRESTASI PADA SISWA NON-PRESTASI
-- ==============================================================================

-- 1. Bersihkan fokus_prestasi pada siswa yang bukan program Prestasi
UPDATE siswa
SET fokus_prestasi = NULL
WHERE fokus_prestasi IS NOT NULL
  AND (
    program_kelas_id IS NULL
    OR program_kelas_id IN (
      SELECT id FROM program_kelas WHERE LOWER(nama_program) NOT LIKE '%prestasi%'
    )
  );

-- 2. Buat fungsi trigger agar fokus_prestasi otomatis di-reset ke NULL jika siswa berpindah kelas/bukan prestasi
CREATE OR REPLACE FUNCTION trg_sync_siswa_fokus_prestasi()
RETURNS TRIGGER AS $$
DECLARE
    v_is_prestasi BOOLEAN;
BEGIN
    IF NEW.program_kelas_id IS NULL THEN
        NEW.fokus_prestasi := NULL;
    ELSE
        SELECT (LOWER(nama_program) LIKE '%prestasi%')
        INTO v_is_prestasi
        FROM program_kelas
        WHERE id = NEW.program_kelas_id;

        IF v_is_prestasi IS NOT TRUE THEN
            NEW.fokus_prestasi := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Pasang trigger pada tabel siswa
DROP TRIGGER IF EXISTS trg_clean_fokus_prestasi ON siswa;

CREATE TRIGGER trg_clean_fokus_prestasi
BEFORE INSERT OR UPDATE OF program_kelas_id, fokus_prestasi ON siswa
FOR EACH ROW
EXECUTE FUNCTION trg_sync_siswa_fokus_prestasi();

