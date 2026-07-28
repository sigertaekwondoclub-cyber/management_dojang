-- ==========================================
-- FIX: Perbaikan RLS Policy produk_merchant & produk_varian
-- Masalah: FOR ALL USING policy tidak otomatis mencakup WITH CHECK untuk INSERT
-- Solusi: Pisahkan policy per operasi dengan WITH CHECK eksplisit
-- ==========================================

-- produk_merchant: Hapus policy lama yang ambigu
DROP POLICY IF EXISTS "Admin full access produk_merchant" ON produk_merchant;
DROP POLICY IF EXISTS "Authenticated can view active produk" ON produk_merchant;

-- Buat policy per operasi dengan cakupan yang jelas
CREATE POLICY "admin_select_produk_merchant"
ON produk_merchant FOR SELECT TO authenticated
USING (
  status_aktif = true
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "admin_insert_produk_merchant"
ON produk_merchant FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "admin_update_produk_merchant"
ON produk_merchant FOR UPDATE TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admin_delete_produk_merchant"
ON produk_merchant FOR DELETE TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- produk_varian: Hapus policy lama yang ambigu
DROP POLICY IF EXISTS "Admin full access produk_varian" ON produk_varian;
DROP POLICY IF EXISTS "Authenticated can view produk_varian" ON produk_varian;

-- Buat policy per operasi untuk produk_varian
CREATE POLICY "select_produk_varian"
ON produk_varian FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admin_insert_produk_varian"
ON produk_varian FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "admin_update_produk_varian"
ON produk_varian FOR UPDATE TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admin_delete_produk_varian"
ON produk_varian FOR DELETE TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
