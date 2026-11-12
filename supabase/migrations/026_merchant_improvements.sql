-- ==========================================
-- 026: PERBAIKAN STORAGE & RLS MERCHANT
-- ==========================================

-- Pastikan policy UPDATE tersedia untuk Ortu saat upload bukti transfer (upsert)
DROP POLICY IF EXISTS "Ortu update bukti transfer" ON storage.objects;
CREATE POLICY "Ortu update bukti transfer"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'merchant'
  AND name LIKE 'bukti/%'
  AND get_my_role() = 'ortu'
)
WITH CHECK (
  bucket_id = 'merchant'
  AND name LIKE 'bukti/%'
  AND get_my_role() = 'ortu'
);

-- Pastikan policy INSERT menggunakan helper get_my_role() untuk mencegah recursion
DROP POLICY IF EXISTS "Ortu upload bukti transfer" ON storage.objects;
CREATE POLICY "Ortu upload bukti transfer"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'merchant'
  AND name LIKE 'bukti/%'
  AND get_my_role() = 'ortu'
);

