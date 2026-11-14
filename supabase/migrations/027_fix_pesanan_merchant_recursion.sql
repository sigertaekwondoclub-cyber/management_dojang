-- ========================================================
-- 027: FIX RECURSION IN PESANAN_MERCHANT & PESANAN_ITEM RLS
-- ========================================================
-- Memperbaiki error PostgreSQL 42P17:
-- "infinite recursion detected in policy for relation pesanan_merchant"
-- yang disebabkan oleh subquery rekursif pada policy SELECT di migration 024.

-- 1. Perbaiki policy SELECT pada pesanan_merchant untuk Ortu
DROP POLICY IF EXISTS "Ortu view own pesanan" ON public.pesanan_merchant;
CREATE POLICY "Ortu view own pesanan"
ON public.pesanan_merchant FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND siswa_id IN (SELECT public.get_my_child_siswa_ids())
);

-- 2. Pastikan Admin memiliki akses penuh tanpa restriksi
DROP POLICY IF EXISTS "Admin full access pesanan_merchant" ON public.pesanan_merchant;
CREATE POLICY "Admin full access pesanan_merchant"
ON public.pesanan_merchant FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- 3. Perbaiki policy pesanan_item
DROP POLICY IF EXISTS "Ortu view own pesanan_item" ON public.pesanan_item;
CREATE POLICY "Ortu view own pesanan_item"
ON public.pesanan_item FOR SELECT
TO authenticated
USING (
    get_my_role() = 'ortu' AND pesanan_id IN (
        SELECT id FROM public.pesanan_merchant WHERE siswa_id IN (SELECT public.get_my_child_siswa_ids())
    )
);

DROP POLICY IF EXISTS "Admin full access pesanan_item" ON public.pesanan_item;
CREATE POLICY "Admin full access pesanan_item"
ON public.pesanan_item FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

