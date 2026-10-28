# Desain Spesifikasi: Sinkronisasi Otomatis Iuran & Perhitungan Keuangan Berdasarkan Status & Kelas Siswa

- **Tanggal**: 2026-10-28
- **Topik**: Sinkronisasi Otomatis Iuran Siswa (Aktif/Nonaktif & Perubahan Program Kelas) terhadap Perhitungan Keuangan, Iuran, dan Honor Pelatih
- **Status**: Disetujui (Approved)

---

## 1. Latar Belakang & Masalah

Pada sistem manajemen klub taekwondo Siger TC:
1. Ketika status anggota/siswa diubah menjadi **Nonaktif**, tagihan iuran bulanan (`iuran`) yang belum dibayar masih tersimpan dan ikut terhitung dalam ringkasan keuangan, laporan tunggakan, serta dashboard admin.
2. Ketika siswa mengalami pergantian program kelas (misal dari Reguler ke Prestasi atau sebaliknya), nominal iuran bulan berjalan yang belum dibayar perlu otomatis disesuaikan dengan biaya bulanan kelas baru secara andal di semua jalur mutasi (form web, import CSV, atau langsung di database).
3. Modul perhitungan keuangan, generate iuran, dan honor/payroll pelatih harus secara konsisten memperhitungkan siswa aktif dan kelas terbarunya.

---

## 2. Arsitektur & Solusi

Digunakan pendekatan **Hybrid (PostgreSQL Trigger + Frontend/Action Layer Sync)**:
- **Tingkat Database**: PostgreSQL trigger pada tabel `siswa` mengeksekusi logika otomatis saat kolom `status_aktif` atau `program_kelas_id` diperbarui.
- **Tingkat Aplikasi**: UI Admin Siswa, Admin Iuran, Generate Iuran, Admin Dashboard, Laporan, dan Honor Pelatih menyelaraskan query dan menampilkan informasi sinkronisasi.

---

## 3. Komponen Spesifikasi

### 3.1. Migrasi Database (`supabase/migrations/025_auto_sync_siswa_iuran.sql`)

Membuat fungsi trigger `sync_siswa_iuran_on_change()` dan trigger `trg_sync_siswa_iuran` pada tabel `siswa`:

1. **Ketika `status_aktif` diubah menjadi `false` (Nonaktif)**:
   - Menghapus tagihan iuran untuk siswa bersangkutan yang status bayarnya masih `belum_bayar` atau `ditolak`.
   ```sql
   DELETE FROM iuran
   WHERE siswa_id = NEW.id
     AND status_bayar IN ('belum_bayar', 'ditolak');
   ```
   - Tagihan yang berstatus `lunas` dan `menunggu_verifikasi` **tidak dihapus** untuk menjaga integritas data keuangan dan bukti transaksi.

2. **Ketika `status_aktif` diaktifkan kembali (`false` -> `true`)**:
   - Memeriksa apakah siswa sudah memiliki tagihan iuran di bulan dan tahun saat ini (`EXTRACT(MONTH FROM CURRENT_DATE)` dan `EXTRACT(YEAR FROM CURRENT_DATE)`).
   - Jika belum ada dan `NEW.program_kelas_id IS NOT NULL`, buat otomatis 1 record iuran:
     - `nominal`: `biaya_bulanan` dari `program_kelas` terkait (default 100000 jika null).
     - `status_bayar`: `'belum_bayar'`.

3. **Ketika `program_kelas_id` berubah (Siswa Ganti Kelas) dan siswa berstatus aktif**:
   - Memperbarui nominal tagihan iuran yang berstatus `belum_bayar` atau `ditolak` ke biaya bulanan dari program kelas yang baru:
   ```sql
   UPDATE iuran
   SET nominal = COALESCE(new_biaya, 100000)
   WHERE siswa_id = NEW.id
     AND status_bayar IN ('belum_bayar', 'ditolak');
   ```

4. **Pembersihan Data Warisan (One-time Migration Cleanup)**:
   - Menghapus tagihan iuran berstatus `belum_bayar` atau `ditolak` yang saat ini masih melekat pada siswa yang berstatus `status_aktif = false`.

---

### 3.2. Modul Admin Siswa (`src/app/admin/siswa/page.tsx`)

1. Pada saat penyimpanan form edit siswa (`handleSubmit`):
   - Jika `status_aktif` diubah menjadi nonaktif, tampilkan pesan informatif bahwa tagihan bulanan yang belum dibayar otomatis dibatalkan/dihapus.
   - Jika siswa diaktifkan kembali atau berganti kelas, konfirmasi bahwa tagihan bulan berjalan telah otomatis disesuaikan.
2. Penanganan impor CSV siswa: otomatis ter-sync di database karena trigger berjalan pada setiap INSERT / UPDATE.

---

### 3.3. Modul Generate & Sinkron Tagihan (`src/app/admin/iuran/generate/page.tsx`)

1. **Deteksi Tagihan Siswa Nonaktif**:
   - Menambahkan pengecekan apakah ada tagihan `belum_bayar` milik siswa dengan `status_aktif = false`.
   - Menambahkan tombol aksi manual "🧹 Bersihkan Tagihan Siswa Nonaktif" sebagai utilitas jika terdapat anomali data.
2. **Kalkulasi Siswa Siap Generate**:
   - Memastikan query siswa tetap konsisten menggunakan `.eq('status_aktif', true)` sehingga siswa nonaktif tidak pernah di-generate tagihannya.

---

### 3.4. Modul Admin Dashboard & Laporan Keuangan

1. **Dashboard Admin (`src/app/admin/dashboard/page.tsx`)**:
   - Memastikan metrik total iuran dan daftar tunggakan hanya menghitung siswa yang berstatus aktif atau tagihan yang sah/lunas.
2. **Laporan (`src/app/admin/laporan/page.tsx`)**:
   - Memastikan rekapitulasi iuran dan tagihan bulanan mencerminkan hanya anggota aktif untuk tunggakan berjalan.

---

### 3.5. Modul Honor Pelatih & Estimasi (`src/app/admin/honor/actions.ts` & `src/app/pelatih/estimasi/page.tsx`)

1. Potensi revenue per kelas (`classRevenue`) dihitung berdasarkan jumlah siswa aktif (`status_aktif = true`).
2. Total iuran lunas (`status_bayar = 'lunas'`) menjadi basis riil coach pool dan founder margin.
3. Estimasi real-time pelatih (`/pelatih/estimasi`) memastikan siswa nonaktif tidak menambah kuota jumlah siswa di kelas.

---

## 4. Rencana Pengujian (Testing & Verifikasi)

1. **Uji Transisi Nonaktif**:
   - Ubah status siswa aktif yang memiliki tagihan `belum_bayar` menjadi nonaktif.
   - Verifikasi bahwa tagihan `belum_bayar` siswa tersebut terhapus dari tabel `iuran`.
   - Verifikasi total iuran belum bayar di Dashboard berkurang secara otomatis.
2. **Uji Transisi Aktif Kembali**:
   - Ubah siswa nonaktif menjadi aktif kembali.
   - Verifikasi bahwa tagihan bulan berjalan otomatis terbuat dengan tarif kelas yang sesuai.
3. **Uji Pergantian Kelas**:
   - Pindahkan siswa dari satu kelas ke kelas lain dengan biaya bulanan berbeda.
   - Verifikasi bahwa tagihan iuran belum bayar berubah nominalnya sesuai kelas baru.
   - Verifikasi bahwa kalkulasi potensi kelas di Honor Pelatih otomatis memperhitungkan kelas baru.
4. **Uji Tagihan Lunas**:
   - Pastikan tagihan yang sudah berstatus `lunas` tidak pernah terhapus saat siswa dinonaktifkan.
