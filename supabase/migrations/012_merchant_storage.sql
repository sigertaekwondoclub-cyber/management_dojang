-- ==========================================
-- MERCHANT STORAGE: Buat bucket untuk foto produk & bukti transfer
-- ==========================================

-- Buat bucket 'merchant' jika belum ada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant',
  'merchant',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- STORAGE POLICIES
-- ==========================================

-- Admin bisa upload/read/delete semua di bucket merchant
DROP POLICY IF EXISTS "Admin full access merchant storage" ON storage.objects;
CREATE POLICY "Admin full access merchant storage"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'merchant'
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  bucket_id = 'merchant'
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Ortu hanya bisa upload ke folder bukti/
DROP POLICY IF EXISTS "Ortu upload bukti transfer" ON storage.objects;
CREATE POLICY "Ortu upload bukti transfer"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'merchant'
  AND name LIKE 'bukti/%'
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ortu'
);

-- Semua user authenticated bisa membaca file di bucket merchant (karena public)
DROP POLICY IF EXISTS "Public read merchant storage" ON storage.objects;
CREATE POLICY "Public read merchant storage"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'merchant');
