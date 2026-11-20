-- MIGRASI 032: NOMOR REGISTRASI SERTIFIKAT KENAIKAN SABUK
-- Menambahkan kolom no_reg_sertifikat pada tabel siswa dan ujian_sabuk.
-- Nomor ini diinput PERTAMA KALI saat kenaikan putih → kuning, kemudian berlaku permanen
-- (tidak berubah pada kenaikan sabuk berikutnya).

-- 1. Tambahkan kolom ke tabel siswa (permanen, referensi utama)
ALTER TABLE public.siswa
  ADD COLUMN IF NOT EXISTS no_reg_sertifikat TEXT;

-- 2. Tambahkan kolom ke tabel ujian_sabuk (dicatat per ujian untuk histori)
ALTER TABLE public.ujian_sabuk
  ADD COLUMN IF NOT EXISTS no_reg_sertifikat TEXT;

-- 3. Indeks untuk pencarian cepat berdasarkan no_reg_sertifikat
CREATE INDEX IF NOT EXISTS idx_siswa_no_reg ON public.siswa (no_reg_sertifikat);

-- 4. Update atau buat fungsi trigger sinkronisasi sabuk + no_reg saat siswa lulus ujian
--    Trigger ini menggantikan fungsi lama (jika ada) agar sekaligus menyinkronkan no_reg_sertifikat.
--    Aturan:
--    - Saat hasil = 'lulus', update sabuk_saat_ini ke sabuk_tujuan (seperti sebelumnya).
--    - Jika siswa BELUM punya no_reg_sertifikat, isi dari ujian (no_reg kosong = lewati).
--    - Jika siswa SUDAH punya no_reg_sertifikat, pertahankan (tidak ditimpa).
CREATE OR REPLACE FUNCTION public.update_sabuk_siswa_on_lulus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.hasil = 'lulus' AND (OLD.hasil IS NULL OR OLD.hasil <> 'lulus') THEN
        UPDATE public.siswa
        SET
            sabuk_saat_ini   = NEW.sabuk_tujuan,
            no_reg_sertifikat = COALESCE(
                -- Pertahankan nomor yang sudah ada; jika belum ada, pakai dari ujian ini
                siswa.no_reg_sertifikat,
                NEW.no_reg_sertifikat
            )
        WHERE id = NEW.siswa_id;
    END IF;
    RETURN NEW;
END;
$$;

-- 5. Pastikan trigger terdaftar (drop dulu jika sudah ada, lalu buat ulang)
DROP TRIGGER IF EXISTS tr_ujian_sabuk_lulus ON public.ujian_sabuk;

CREATE TRIGGER tr_ujian_sabuk_lulus
AFTER INSERT OR UPDATE OF hasil
ON public.ujian_sabuk
FOR EACH ROW
EXECUTE FUNCTION public.update_sabuk_siswa_on_lulus();

