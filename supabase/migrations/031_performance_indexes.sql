-- MIGRASI 031: INDEKS PERFORMA & OPTIMASI QUERY
-- Menambahkan indeks komposit untuk mempercepat query yang sering digunakan

-- Absensi siswa: filter by tanggal & kelas, dan by siswa & tanggal
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl_kelas ON public.absensi_siswa (tgl, kelas);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_siswa_tgl ON public.absensi_siswa (siswa_id, tgl);

-- Absensi pelatih: filter by tanggal & pelatih
CREATE INDEX IF NOT EXISTS idx_absensi_pelatih_tgl ON public.absensi_pelatih (tgl, pelatih_id);

-- Iuran: filter by periode (tahun+bulan) & status, dan by siswa & periode
CREATE INDEX IF NOT EXISTS idx_iuran_periode_status ON public.iuran (tahun, bulan, status_bayar);
CREATE INDEX IF NOT EXISTS idx_iuran_siswa_periode ON public.iuran (siswa_id, tahun, bulan);

-- Keuangan club: filter by tanggal & jenis transaksi
CREATE INDEX IF NOT EXISTS idx_keuangan_club_tgl_jenis ON public.keuangan_club (tgl, jenis);

-- Siswa: pencarian by no HP ortu, dan filter status & program kelas
CREATE INDEX IF NOT EXISTS idx_siswa_no_hp_ortu ON public.siswa (no_hp_ortu);
CREATE INDEX IF NOT EXISTS idx_siswa_status_program ON public.siswa (status_aktif, program_kelas_id);

-- Profiles: filter by siswa_id & pelatih_id untuk resolusi akses
CREATE INDEX IF NOT EXISTS idx_profiles_siswa_pelatih ON public.profiles (siswa_id, pelatih_id);

