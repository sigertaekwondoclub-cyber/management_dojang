-- Migration 025: Auto sync iuran bulanan & keuangan saat siswa berubah status aktif/nonaktif atau program kelas

-- 1. Buat fungsi trigger untuk sinkronisasi otomatis
CREATE OR REPLACE FUNCTION public.sync_siswa_iuran_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_biaya_bulanan NUMERIC;
    v_curr_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
    v_curr_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_has_current_iuran BOOLEAN;
BEGIN
    -- Skenario A: Siswa diubah menjadi NONAKTIF (status_aktif: false)
    IF (TG_OP = 'UPDATE' AND OLD.status_aktif = true AND NEW.status_aktif = false) OR
       (TG_OP = 'INSERT' AND NEW.status_aktif = false) THEN
        -- Hapus semua tagihan iuran yang belum lunas (belum_bayar atau ditolak)
        -- Tagihan yang lunas dan menunggu_verifikasi tetap dipertahankan sebagai bukti pembayaran
        DELETE FROM public.iuran
        WHERE siswa_id = NEW.id
          AND status_bayar IN ('belum_bayar', 'ditolak');
          
        RETURN NEW;
    END IF;

    -- Skenario B: Siswa diaktifkan kembali (status_aktif: false -> true)
    IF (TG_OP = 'UPDATE' AND OLD.status_aktif = false AND NEW.status_aktif = true) THEN
        -- Cek apakah sudah ada tagihan di bulan berjalan
        SELECT EXISTS (
            SELECT 1 FROM public.iuran
            WHERE siswa_id = NEW.id
              AND bulan = v_curr_month
              AND tahun = v_curr_year
        ) INTO v_has_current_iuran;

        -- Jika belum ada tagihan dan siswa memiliki program kelas, buatkan tagihan bulan ini
        IF NOT v_has_current_iuran AND NEW.program_kelas_id IS NOT NULL THEN
            SELECT COALESCE(biaya_bulanan, 100000) INTO v_biaya_bulanan
            FROM public.program_kelas
            WHERE id = NEW.program_kelas_id;

            INSERT INTO public.iuran (siswa_id, bulan, tahun, nominal, status_bayar)
            VALUES (NEW.id, v_curr_month, v_curr_year, COALESCE(v_biaya_bulanan, 100000), 'belum_bayar');
        END IF;

        RETURN NEW;
    END IF;

    -- Skenario C: Siswa AKTIF berganti program_kelas_id
    IF (TG_OP = 'UPDATE' AND NEW.status_aktif = true AND NEW.program_kelas_id IS DISTINCT FROM OLD.program_kelas_id) THEN
        IF NEW.program_kelas_id IS NOT NULL THEN
            SELECT COALESCE(biaya_bulanan, 100000) INTO v_biaya_bulanan
            FROM public.program_kelas
            WHERE id = NEW.program_kelas_id;

            -- Perbarui nominal tagihan belum bayar sesuai tarif kelas baru
            UPDATE public.iuran
            SET nominal = COALESCE(v_biaya_bulanan, 100000)
            WHERE siswa_id = NEW.id
              AND status_bayar IN ('belum_bayar', 'ditolak');
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Pasang trigger pada tabel siswa
DROP TRIGGER IF EXISTS trg_sync_siswa_iuran ON public.siswa;
CREATE TRIGGER trg_sync_siswa_iuran
AFTER INSERT OR UPDATE OF status_aktif, program_kelas_id ON public.siswa
FOR EACH ROW
EXECUTE FUNCTION public.sync_siswa_iuran_on_change();

-- 3. Pembersihan satu kali (One-time cleanup) untuk tagihan belum bayar milik siswa yang saat ini sudah nonaktif
DELETE FROM public.iuran
WHERE siswa_id IN (SELECT id FROM public.siswa WHERE status_aktif = false)
  AND status_bayar IN ('belum_bayar', 'ditolak');
