-- ==========================================
-- PENDAFTARAN SISWA: Tambah kolom informasi tambahan
-- ==========================================

-- Tabel pendaftaran_siswa
ALTER TABLE pendaftaran_siswa ADD COLUMN IF NOT EXISTS berat_badan NUMERIC;
ALTER TABLE pendaftaran_siswa ADD COLUMN IF NOT EXISTS sabuk_pendaftaran TEXT DEFAULT 'Putih';
ALTER TABLE pendaftaran_siswa ADD COLUMN IF NOT EXISTS tempat_lahir TEXT;
ALTER TABLE pendaftaran_siswa ADD COLUMN IF NOT EXISTS alamat TEXT;

-- Tabel siswa (untuk kolom baru yang akan diisi saat pendaftaran diterima)
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS berat_badan NUMERIC;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS tempat_lahir TEXT;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS alamat TEXT;
