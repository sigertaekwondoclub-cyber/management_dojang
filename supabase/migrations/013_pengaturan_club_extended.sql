-- ==========================================
-- PENGATURAN CLUB: Tambah kolom-kolom pengaturan baru
-- ==========================================

-- Identitas Club
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS nama_club TEXT DEFAULT 'Siger Taekwondo Club';
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS alamat_dojo TEXT;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS kontak_wa TEXT;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS kontak_email TEXT;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Rekening Utama (untuk pembayaran iuran)
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS rekening_bank TEXT DEFAULT 'BCA';
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS rekening_nomor TEXT;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS rekening_atas_nama TEXT;

-- Rekening Merchant / Toko (opsional, jika berbeda)
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS merchant_bank TEXT;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS merchant_nomor TEXT;
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS merchant_atas_nama TEXT;

-- Iuran Default
ALTER TABLE pengaturan_club ADD COLUMN IF NOT EXISTS iuran_default NUMERIC DEFAULT 0;

-- Tambah policy untuk ortu bisa READ pengaturan (rekening, dll)
DROP POLICY IF EXISTS "Ortu read pengaturan" ON pengaturan_club;
CREATE POLICY "Ortu read pengaturan"
ON pengaturan_club FOR SELECT TO authenticated
USING (true);
