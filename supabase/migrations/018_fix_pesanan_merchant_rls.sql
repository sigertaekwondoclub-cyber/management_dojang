-- ==========================================
-- FIX: Perbaikan RLS Policy pesanan_merchant & pesanan_item
-- Menggunakan get_my_role() = 'admin' untuk mencegah masalah recursive RLS query
-- ==========================================

-- pesanan_merchant policies
DROP POLICY IF EXISTS "Admin full access pesanan_merchant" ON pesanan_merchant;
DROP POLICY IF EXISTS "Ortu view own pesanan" ON pesanan_merchant;

CREATE POLICY "Admin full access pesanan_merchant"
ON pesanan_merchant FOR ALL TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Ortu view own pesanan"
ON pesanan_merchant FOR SELECT TO authenticated
USING (
  get_my_role() = 'admin'
  OR siswa_id IN (
    SELECT siswa_id FROM profiles
    WHERE id = auth.uid() AND role = 'ortu'
  )
);

-- pesanan_item policies
DROP POLICY IF EXISTS "Admin full access pesanan_item" ON pesanan_item;
DROP POLICY IF EXISTS "Ortu view own pesanan_item" ON pesanan_item;

CREATE POLICY "Admin full access pesanan_item"
ON pesanan_item FOR ALL TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Ortu view own pesanan_item"
ON pesanan_item FOR SELECT TO authenticated
USING (
  get_my_role() = 'admin'
  OR pesanan_id IN (
    SELECT pm.id FROM pesanan_merchant pm
    JOIN profiles p ON p.siswa_id = pm.siswa_id
    WHERE p.id = auth.uid() AND p.role = 'ortu'
  )
);
