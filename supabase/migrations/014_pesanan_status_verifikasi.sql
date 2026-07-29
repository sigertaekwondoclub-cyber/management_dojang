-- ==========================================
-- UPDATE PESANAN MERCHANT STATUS CONSTRAINT
-- Tambahkan status 'menunggu_verifikasi' untuk melacak pesanan yang sudah di-upload buktinya.
-- ==========================================

-- Hapus check constraint lama
ALTER TABLE pesanan_merchant DROP CONSTRAINT IF EXISTS pesanan_merchant_status_check;

-- Tambah check constraint baru yang mencakup 'menunggu_verifikasi'
ALTER TABLE pesanan_merchant ADD CONSTRAINT pesanan_merchant_status_check
CHECK (status IN ('menunggu_pembayaran', 'menunggu_verifikasi', 'lunas', 'diproses', 'siap_diambil'));
