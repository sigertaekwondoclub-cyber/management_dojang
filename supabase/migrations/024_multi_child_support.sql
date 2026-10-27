-- ====================================================================
-- 024: DUKUNGAN MULTI-ANAK (SIBLINGS) UNTUK AKUN ORANG TUA
-- Memungkinkan orang tua yang memiliki 2 anak atau lebih (nomor HP ortu sama)
-- untuk melihat dan mengelola data seluruh anaknya.
-- ====================================================================

SET search_path TO public;

-- 1. Helper function SECURITY DEFINER untuk mendapatkan seluruh siswa_id milik akun ortu
-- Fungsi ini membaca anak utama di profiles serta semua anak dengan no_hp_ortu yang sama
CREATE OR REPLACE FUNCTION public.get_my_child_siswa_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH my_primary AS (
    SELECT p.siswa_id, s.no_hp_ortu
    FROM profiles p
    JOIN siswa s ON s.id = p.siswa_id
    WHERE p.id = auth.uid() AND p.role = 'ortu'
  )
  SELECT s.id
  FROM siswa s, my_primary mp
  WHERE s.id = mp.siswa_id
     OR (
       mp.no_hp_ortu IS NOT NULL 
       AND TRIM(mp.no_hp_ortu) != '' 
       AND TRIM(s.no_hp_ortu) = TRIM(mp.no_hp_ortu)
       AND s.status_aktif = true
     );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_child_siswa_ids() TO authenticated;

-- 2. Kebijakan RLS: siswa
DROP POLICY IF EXISTS "Ortu can view own child" ON public.siswa;
CREATE POLICY "Ortu can view own child"
ON public.siswa FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND id IN (SELECT public.get_my_child_siswa_ids())
);

-- 3. Kebijakan RLS: iuran
DROP POLICY IF EXISTS "Ortu can view own child iuran" ON public.iuran;
CREATE POLICY "Ortu can view own child iuran"
ON public.iuran FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

DROP POLICY IF EXISTS "Ortu can update own iuran bukti" ON public.iuran;
CREATE POLICY "Ortu can update own iuran bukti"
ON public.iuran FOR UPDATE
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
    AND status_bayar IN ('belum_bayar', 'ditolak')
)
WITH CHECK (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
    AND status_bayar = 'menunggu_verifikasi'
);

-- 4. Kebijakan RLS: absensi_siswa
DROP POLICY IF EXISTS "Ortu can view own child absensi" ON public.absensi_siswa;
CREATE POLICY "Ortu can view own child absensi"
ON public.absensi_siswa FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

-- 5. Kebijakan RLS: ujian_sabuk
DROP POLICY IF EXISTS "Ortu can view own child ujian" ON public.ujian_sabuk;
CREATE POLICY "Ortu can view own child ujian"
ON public.ujian_sabuk FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

-- 6. Kebijakan RLS: event_peserta
DROP POLICY IF EXISTS "Ortu select own child event_peserta" ON public.event_peserta;
CREATE POLICY "Ortu select own child event_peserta"
ON public.event_peserta FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

DROP POLICY IF EXISTS "Ortu insert own child event_peserta" ON public.event_peserta;
CREATE POLICY "Ortu insert own child event_peserta"
ON public.event_peserta FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

-- 7. Kebijakan RLS: kartu_anggota
DROP POLICY IF EXISTS "Ortu can view own child kartu" ON public.kartu_anggota;
DROP POLICY IF EXISTS "Ortu can view own kartu" ON public.kartu_anggota;
CREATE POLICY "Ortu can view own child kartu"
ON public.kartu_anggota FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

-- 8. Kebijakan RLS: pesanan_merchant & pesanan_item
DROP POLICY IF EXISTS "Ortu view own pesanan" ON public.pesanan_merchant;
CREATE POLICY "Ortu view own pesanan"
ON public.pesanan_merchant FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND (
        siswa_id IN (SELECT public.get_my_child_siswa_ids())
        OR id IN (
            SELECT p.id FROM public.pesanan_merchant p 
            WHERE p.siswa_id IN (SELECT public.get_my_child_siswa_ids())
        )
    )
);

DROP POLICY IF EXISTS "Ortu insert pesanan for own child" ON public.pesanan_merchant;
CREATE POLICY "Ortu insert pesanan for own child"
ON public.pesanan_merchant FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

DROP POLICY IF EXISTS "Ortu update own pesanan bukti transfer" ON public.pesanan_merchant;
CREATE POLICY "Ortu update own pesanan bukti transfer"
ON public.pesanan_merchant FOR UPDATE
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

DROP POLICY IF EXISTS "Ortu view own pesanan_item" ON public.pesanan_item;
CREATE POLICY "Ortu view own pesanan_item"
ON public.pesanan_item FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND pesanan_id IN (
        SELECT id FROM public.pesanan_merchant WHERE siswa_id IN (SELECT public.get_my_child_siswa_ids())
    )
);

DROP POLICY IF EXISTS "Ortu insert pesanan_item for own pesanan" ON public.pesanan_item;
CREATE POLICY "Ortu insert pesanan_item for own pesanan"
ON public.pesanan_item FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'ortu' AND pesanan_id IN (
        SELECT id FROM public.pesanan_merchant WHERE siswa_id IN (SELECT public.get_my_child_siswa_ids())
    )
);

-- 9. Kebijakan RLS: penilaian_atlet
DROP POLICY IF EXISTS "Ortu can view own child penilaian_atlet" ON public.penilaian_atlet;
CREATE POLICY "Ortu can view own child penilaian_atlet"
ON public.penilaian_atlet FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);
