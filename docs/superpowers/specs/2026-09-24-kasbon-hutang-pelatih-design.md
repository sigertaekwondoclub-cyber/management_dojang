# Spesifikasi Desain: Fitur Hutang & Kasbon Pelatih Terintegrasi Kas Riil

**Tanggal**: 2026-09-24  
**Status**: Disetujui (Approved)  
**Tujuan**: Menyediakan pencatatan kasbon/hutang pelatih yang terintegrasi langsung dengan arus kas klub (Keuangan Club), sistem Payroll/Honor, serta transparansi pada slip honor pelatih sehingga perhitungan kas selalu 100% sinkron dengan kondisi uang riil.

---

## 1. Latar Belakang & Kebutuhan

Saat ini klub memiliki sistem payroll honor pelatih dan arus kas (Keuangan Club). Ketika seorang pelatih meminjam uang (berhutang/kasbon) dari kas klub:
1. Uang kas klub keluar pada saat pinjaman diserahkan.
2. Jika pinjaman tidak dicatat sebagai kas keluar, saldo kas di aplikasi akan lebih besar dari uang riil di bank/brankas.
3. Pelunasan hutang dapat dilakukan melalui:
   - **Potong honor bulanan** saat payroll dibagikan.
   - **Pembayaran tunai / transfer langsung** oleh pelatih ke kas klub.
4. Ketika honor dipotong hutang, kas yang keluar saat pembayaran honor adalah **honor bersih**. Hal ini mencegah terjadinya pencatatan pengeluaran ganda (*double deduction*) pada kas klub.

---

## 2. Arsitektur Data & Skema Database

### 2.1. File Migrasi SQL: `supabase/migrations/022_kasbon_pelatih.sql`

```sql
-- 1. Tabel Master Pinjaman Kasbon Pelatih
CREATE TABLE IF NOT EXISTS kasbon_pelatih (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE RESTRICT,
  nominal_pinjaman NUMERIC NOT NULL CHECK (nominal_pinjaman > 0),
  sisa_hutang NUMERIC NOT NULL CHECK (sisa_hutang >= 0),
  tgl_pinjam DATE NOT NULL,
  keterangan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('belum_lunas', 'lunas')) DEFAULT 'belum_lunas',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Riwayat Pembayaran/Cicilan Kasbon
CREATE TABLE IF NOT EXISTS pembayaran_kasbon (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kasbon_id UUID NOT NULL REFERENCES kasbon_pelatih(id) ON DELETE CASCADE,
  pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE RESTRICT,
  tgl_bayar DATE NOT NULL,
  nominal NUMERIC NOT NULL CHECK (nominal > 0),
  metode TEXT NOT NULL CHECK (metode IN ('potong_honor', 'tunai')),
  payroll_detail_id UUID REFERENCES payroll_details(id) ON DELETE SET NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Alter Tabel payroll_details untuk mencatat potongan kasbon & honor bersih
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS potongan_kasbon NUMERIC DEFAULT 0;
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS honor_bersih NUMERIC DEFAULT 0;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE kasbon_pelatih ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran_kasbon ENABLE ROW LEVEL SECURITY;

-- Policies untuk Admin
CREATE POLICY "Admin full access kasbon_pelatih" ON kasbon_pelatih
FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin full access pembayaran_kasbon" ON pembayaran_kasbon
FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Policies untuk Pelatih (Hanya melihat data miliknya)
CREATE POLICY "Pelatih view own kasbon" ON kasbon_pelatih
FOR SELECT TO authenticated 
USING (pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'));

CREATE POLICY "Pelatih view own pembayaran kasbon" ON pembayaran_kasbon
FOR SELECT TO authenticated 
USING (pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih'));
```

---

## 3. Alur Bisnis & Sinkronisasi Kas Riil

### 3.1. Penyerahan Kasbon Baru (Peminjaman)
1. Admin memasukkan data pinjaman baru: `pelatih_id`, `nominal_pinjaman`, `tgl_pinjam`, `keterangan`.
2. Sistem menyimpan ke tabel `kasbon_pelatih` dengan `sisa_hutang = nominal_pinjaman`, `status = 'belum_lunas'`.
3. Sistem secara otomatis mencatat transaksi pengeluaran di `keuangan_club`:
   - `tgl`: `tgl_pinjam`
   - `jenis`: `'expense'`
   - `kategori`: `'Kasbon Pelatih'`
   - `nominal`: `nominal_pinjaman`
   - `keterangan`: `'Kasbon Pelatih: [Nama Pelatih] — [Keterangan]'`
   - `sumber`: `'kasbon'`
4. **Dampak Kas**: Saldo kas klub berkurang sebesar `nominal_pinjaman`, sinkron dengan uang yang diserahkan.

### 3.2. Pembayaran Tunai / Transfer Langsung (Cicilan Manual)
1. Pelatih membayar langsung ke klub. Admin mencatat pelunasan tunai: `kasbon_id`, `nominal`, `tgl_bayar`, `catatan`.
2. Sistem mencatat di `pembayaran_kasbon` dengan `metode = 'tunai'`.
3. Sistem mengurangi `sisa_hutang` di `kasbon_pelatih`. Jika `sisa_hutang == 0`, status berubah menjadi `'lunas'`.
4. Sistem otomatis mencatat transaksi pemasukan di `keuangan_club`:
   - `tgl`: `tgl_bayar`
   - `jenis`: `'income'`
   - `kategori`: `'Pelunasan Kasbon'`
   - `nominal`: `nominal`
   - `keterangan`: `'Pelunasan Kasbon Tunai: [Nama Pelatih] — [Catatan]'`
   - `sumber`: `'kasbon'`
5. **Dampak Kas**: Saldo kas klub bertambah kembali sebesar nominal yang disetor.

### 3.3. Pemotongan Honor Saat Payroll Bulanan
1. **Saat Generate Payroll (`generatePayroll`)**:
   - Menghitung `total_payout` kotor (`teaching_honor + founder_margin_share`).
   - Memeriksa total `sisa_hutang` aktif pelatih tersebut di tabel `kasbon_pelatih`.
   - Menetapkan default `potongan_kasbon = Math.min(total_payout, sisa_hutang)`.
   - Menetapkan `honor_bersih = total_payout - potongan_kasbon`.
2. **Fleksibilitas Nominal Potongan**:
   - Pada halaman `/admin/honor`, admin dapat mengedit nominal `potongan_kasbon` sebelum menandai dibayar (misalnya pelatih ingin mencicil Rp 200.000 saja dari total hutang Rp 500.000).
   - `honor_bersih` otomatis diperbarui (`total_payout - potongan_kasbon`).
3. **Saat Menandai Dibayar (`updateDetailStatusDibayar`)**:
   - Jika status diubah menjadi **sudah dibayar (`status_dibayar = true`)**:
     - Jika ada `potongan_kasbon > 0`, sistem mencatat entri di `pembayaran_kasbon` (`metode = 'potong_honor'`, `payroll_detail_id = id`).
     - Mengurangi `sisa_hutang` pada kasbon aktif milik pelatih tersebut (mendahulukan kasbon tertua/FIFO jika ada lebih dari 1 pinjaman).
     - Mengupdate status kasbon menjadi `'lunas'` jika sisa hutang mencapai 0.
   - Jika status diubah menjadi **batal dibayar (`status_dibayar = false`)**:
     - Sistem menghapus catatan pembayaran terkait di `pembayaran_kasbon` berdasarkan `payroll_detail_id`.
     - Mengembalikan nilai `sisa_hutang` dan status `belum_lunas` pada kasbon yang sebelumnya terpotong.
4. **Dampak Kas**:
   - Uang kas yang dihitung keluar dari kas klub saat pembayaran honor adalah **Honor Bersih** (`honor_bersih`).
   - Karena pokok kasbon sudah dicatat keluar saat peminjaman awal, klub tidak menduplikasi pengeluaran uang. Saldo kas riil akurat.

---

## 4. Perubahan UI & Halaman Aplikasi

### 4.1. Halaman `/admin/honor`
- Penambahan Tab Navigasi:
  - **Tab 1: 🏆 Payroll Bulanan**
    - Tabel rincian pelatih menampilkan: Honor Kotor, Potongan Kasbon (dengan modal/input edit nominal potongan jika pelatih punya kasbon aktif), dan Total Honor Bersih.
    - Tombol "Tandai Dibayar" menampilkan konfirmasi nominal bersih yang akan dibayarkan.
  - **Tab 2: 💳 Kelola Kasbon Pelatih**
    - Kartu Statistik: Total Kasbon Aktif (belum lunas), Total Kasbon Lunas, Jumlah Pelatih Berhutang.
    - Tombol Aksi: `+ Kasbon Baru` dan `+ Catat Bayar Tunai`.
    - Tabel Kasbon: Nama Pelatih, Tgl Pinjam, Total Pinjaman, Sisa Hutang, Status, Tombol Riwayat Cicilan & Tombol Hapus Kasbon (hanya jika belum ada cicilan).
    - Modal Riwayat Cicilan: Menampilkan daftar pembayaran/pemotongan yang telah dilakukan untuk kasbon tersebut.

### 4.2. Halaman `/admin/keuangan`
- Sumber transaksi mendukung `'kasbon'`.
- Filter sumber transaksi ditambahkan opsi `💳 Kasbon`.
- Badge sumber `💳 Kasbon` untuk transaksi kasbon keluar dan pelunasan kasbon masuk.
- Perhitungan pengeluaran honor pelatih otomatis menggunakan `honor_bersih` dari `payroll_details`.

### 4.3. Halaman `/admin/dashboard` & `/admin/laporan`
- Pengeluaran honor disinkronkan menggunakan `honor_bersih`.
- Transaksi kasbon yang ada di `keuangan_club` otomatis tercakup dalam perhitungan cashflow tahunan/bulanan dan saldo bersih.

### 4.4. Halaman `/pelatih/honor` (Slip Honor Pelatih)
- Slip honor bulanan menampilkan breakdown:
  - Honor Mengajar: `Rp xxx`
  - Founder Margin (jika founder): `Rp xxx`
  - Potongan Kasbon: `-Rp xxx` (merah)
  - Total Bersih Diterima: `Rp xxx` (hijau)
- Kartu Info Tanggungan Kasbon: Menampilkan status sisa hutang aktif pelatih tersebut agar pelatih mengetahui status pinjamannya secara transparan.

---

## 5. Type Definitions (`src/lib/types.ts`)

```typescript
export interface KasbonPelatih {
  id: string
  pelatih_id: string
  nominal_pinjaman: number
  sisa_hutang: number
  tgl_pinjam: string
  keterangan: string
  status: 'belum_lunas' | 'lunas'
  created_at: string
  pelatih?: Pick<Pelatih, 'nama'>
}

export interface PembayaranKasbon {
  id: string
  kasbon_id: string
  pelatih_id: string
  tgl_bayar: string
  nominal: number
  metode: 'potong_honor' | 'tunai'
  payroll_detail_id?: string | null
  catatan?: string | null
  created_at: string
  kasbon_pelatih?: Pick<KasbonPelatih, 'keterangan' | 'nominal_pinjaman'>
}

// Update PayrollDetail
export interface PayrollDetail {
  id: string
  payroll_run_id: string
  pelatih_id: string
  sessions_taught: number
  teaching_honor: number
  founder_margin_share: number
  total_payout: number
  potongan_kasbon: number
  honor_bersih: number
  status_dibayar: boolean
  tgl_dibayar: string | null
  created_at: string
  pelatih?: {
    nama: string
    role: 'head_coach' | 'core_coach' | 'assistant_coach'
    is_founder: boolean
  }
}
```

---

## 6. Penanganan Edge Cases & Keamanan
1. **Nominal Potongan Tidak Boleh Melebihi Total Payout**: Sistem memvalidasi bahwa `potongan_kasbon <= total_payout`.
2. **Nominal Potongan Tidak Boleh Melebihi Sisa Hutang**: Sistem memvalidasi bahwa `potongan_kasbon <= total_sisa_hutang`.
3. **Pembayaran Tunai Melebihi Sisa Hutang**: Ditolak oleh sistem dengan validasi `nominal <= kasbon.sisa_hutang`.
4. **Pembatalan Status Dibayar pada Payroll**: Jika admin tidak sengaja menandai dibayar lalu membatalkannya, sistem melakukan *rollback* cicilan kasbon yang terpotong pada payroll tersebut.
5. **Penghapusan Kasbon**: Jika kasbon dihapus oleh admin (misal salah input saat belum ada pembayaran), pengeluaran terkait di `keuangan_club` otomatis dihapus sehingga saldo kas kembali utuh.
