-- ==========================================
-- MIGRATION 017: Izinkan Pelatih SELECT kartu_anggota
-- Diperlukan untuk fitur scan barcode absensi pelatih
-- ==========================================

-- Pelatih perlu bisa lookup siswa dari qr_code_value saat scan
CREATE POLICY "Pelatih can view kartu_anggota"
ON kartu_anggota FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');
