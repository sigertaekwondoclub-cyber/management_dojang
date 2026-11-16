# Desain Fitur Inventaris Club Siger TC

**Tanggal:** 2026-11-16  
**Status:** Approved by User  
**Target Aplikasi:** Siger Taekwondo Club Manager (`siger-tkd-manager`)  

---

## 1. Ringkasan & Tujuan

Fitur ini menyediakan sistem manajemen inventaris komprehensif untuk Siger Taekwondo Club. Sistem ini mencatat seluruh aset dan peralatan latihan fisik (seperti target pad, kicking paddle, samsak, pelindung tubuh/hogu, head guard, cone, matras, dan perangkat scoring), melacak kondisi fisik alat (baik, rusak ringan, rusak berat/afkir), mengelola pengadaan/pembelian alat baru yang terintegrasi secara otomatis dengan modul Kas Keuangan Club (`keuangan_club`), mengelola sirkulasi peminjaman alat ke pelatih/atlet untuk keperluan latihan/kejuaraan luar dojang, serta menyediakan kanal pengajuan kebutuhan alat baru oleh pelatih.

### Sasaran & Kriteria Sukses
1. **Pencatatan Aset Transparan:** Admin dapat mengetahui total stok, lokasi penyimpanan, dan kondisi fisik tiap alat di dojang secara real-time.
2. **Sinkronisasi Kas Otomatis:** Setiap pembelian alat baru dapat langsung dibukukan ke modul pengeluaran kas (`keuangan_club`) tanpa perlu input ganda oleh admin, serta aman disinkronkan saat pembatalan/penghapusan.
3. **Tracking Sirkulasi Peminjaman:** Mengurangi risiko kehilangan alat saat dibawa bertanding atau latihan luar dengan pelacakan peminjam, tanggal pinjam, dan estimasi kembali.
4. **Keterlibatan Pelatih:** Pelatih dapat memantau ketersediaan alat dojang, meminjam alat secara mandiri, dan mengusulkan pengadaan alat baru langsung dari panel pelatih.
5. **Prinsip Minimalis & Ringan:** Pencatatan berbasis data teks & numerik yang terstruktur rapi tanpa overhead upload media foto/nota.

---

## 2. Skema Database & Migrasi Supabase

Migrasi baru: `supabase/migrations/029_inventaris_club.sql`

```sql
-- =====================================================
-- MIGRASI 029: FITUR INVENTARIS CLUB SIGER TC
-- =====================================================

-- 1. TABEL: inventaris_barang (Master Alat & Stok Kondisi)
CREATE TABLE inventaris_barang (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kode_barang TEXT UNIQUE NOT NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL CHECK (kategori IN (
        'Target & Kicking',
        'Proteksi & Sparring',
        'Fasilitas Dojang',
        'Elektronik & Scoring',
        'Lainnya'
    )),
    total_stok INT NOT NULL DEFAULT 0 CHECK (total_stok >= 0),
    kondisi_baik INT NOT NULL DEFAULT 0 CHECK (kondisi_baik >= 0),
    kondisi_rusak_ringan INT NOT NULL DEFAULT 0 CHECK (kondisi_rusak_ringan >= 0),
    kondisi_rusak_berat INT NOT NULL DEFAULT 0 CHECK (kondisi_rusak_berat >= 0),
    stok_dipinjam INT NOT NULL DEFAULT 0 CHECK (stok_dipinjam >= 0),
    lokasi_penyimpanan TEXT NOT NULL DEFAULT 'Dojang Utama',
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger untuk memastikan total_stok konsisten dengan rincian kondisi
CREATE OR REPLACE FUNCTION trg_sync_total_stok_inventaris()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_stok := NEW.kondisi_baik + NEW.kondisi_rusak_ringan + NEW.kondisi_rusak_berat;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_total_stok_inventaris
BEFORE INSERT OR UPDATE ON inventaris_barang
FOR EACH ROW
EXECUTE FUNCTION trg_sync_total_stok_inventaris();

-- 2. TABEL: inventaris_pembelian (Log Pengadaan Baru)
CREATE TABLE inventaris_pembelian (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barang_id UUID REFERENCES inventaris_barang(id) ON DELETE SET NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL,
    tgl_beli DATE NOT NULL,
    jumlah INT NOT NULL CHECK (jumlah > 0),
    harga_satuan NUMERIC NOT NULL CHECK (harga_satuan >= 0),
    total_biaya NUMERIC NOT NULL CHECK (total_biaya >= 0),
    toko_vendor TEXT,
    catat_ke_kas BOOLEAN NOT NULL DEFAULT true,
    keuangan_id UUID REFERENCES keuangan_club(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABEL: inventaris_peminjaman (Sirkulasi & Peminjaman)
CREATE TABLE inventaris_peminjaman (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barang_id UUID NOT NULL REFERENCES inventaris_barang(id) ON DELETE CASCADE,
    pelatih_id UUID REFERENCES pelatih(id) ON DELETE SET NULL,
    nama_peminjam TEXT NOT NULL,
    jumlah INT NOT NULL CHECK (jumlah > 0),
    tgl_pinjam DATE NOT NULL,
    tgl_rencana_kembali DATE NOT NULL,
    tgl_kembali DATE,
    keperluan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'dipinjam' CHECK (status IN ('dipinjam', 'kembali', 'terlambat')),
    catatan_kondisi_kembali TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABEL: inventaris_pengajuan (Usulan Alat dari Pelatih)
CREATE TABLE inventaris_pengajuan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE CASCADE,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL DEFAULT 'Target & Kicking',
    jumlah INT NOT NULL CHECK (jumlah > 0),
    estimasi_harga NUMERIC DEFAULT 0,
    alasan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
    catatan_admin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE inventaris_barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_pembelian ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_peminjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_pengajuan ENABLE ROW LEVEL SECURITY;

-- Polisi inventaris_barang: Admin full, Pelatih SELECT only
CREATE POLICY "Admin full access inventaris_barang"
ON inventaris_barang FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Pelatih view inventaris_barang"
ON inventaris_barang FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

-- Polisi inventaris_pembelian: Admin full, Pelatih no access
CREATE POLICY "Admin full access inventaris_pembelian"
ON inventaris_pembelian FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Polisi inventaris_peminjaman: Admin full, Pelatih SELECT own/all & INSERT
CREATE POLICY "Admin full access inventaris_peminjaman"
ON inventaris_peminjaman FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Pelatih view own peminjaman"
ON inventaris_peminjaman FOR SELECT
TO authenticated
USING (
    get_my_role() = 'pelatih' AND (
        pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
        OR created_by = auth.uid()
    )
);

CREATE POLICY "Pelatih insert peminjaman"
ON inventaris_peminjaman FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih' AND
    created_by = auth.uid()
);

-- Polisi inventaris_pengajuan: Admin full, Pelatih manage own
CREATE POLICY "Admin full access inventaris_pengajuan"
ON inventaris_pengajuan FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Pelatih select own pengajuan"
ON inventaris_pengajuan FOR SELECT
TO authenticated
USING (
    get_my_role() = 'pelatih' AND
    pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
);

CREATE POLICY "Pelatih insert own pengajuan"
ON inventaris_pengajuan FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih' AND
    pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
);
```

---

## 3. Logika Bisnis & Alur Data (Server Actions)

Ditempatkan di file terisolasi: `src/app/admin/inventaris/actions.ts` dan `src/app/pelatih/inventaris/actions.ts`.

### 3.1. Pembelian Alat Baru & Sinkronisasi Kas
* **Tambah Pembelian:**
  1. Validasi input: `nama_barang`, `jumlah > 0`, `harga_satuan >= 0`.
  2. Hitung `total_biaya = jumlah * harga_satuan`.
  3. Update / Buat master `inventaris_barang`:
     * Jika memilih item master yang ada: `kondisi_baik = kondisi_baik + jumlah`.
     * Jika item baru: buat entri baru di `inventaris_barang` dengan `kode_barang = 'INV-' + UPPER(SUBSTRING(nama, 1, 3)) + '-' + RANDOM_CODE`, `kondisi_baik = jumlah`.
  4. Jika `catat_ke_kas = true`:
     * Insert baris pengeluaran ke `keuangan_club`:
       * `tgl`: `tgl_beli`
       * `jenis`: `'expense'`
       * `kategori`: `'Pengadaan Alat & Inventaris'`
       * `nominal`: `total_biaya`
       * `keterangan`: `'Pembelian Inventaris: ' + nama_barang + ' (' + jumlah + ' unit)'`
       * `sumber`: `toko_vendor`
     * Simpan ID `keuangan_club` yang dihasilkan ke kolom `inventaris_pembelian.keuangan_id`.
  5. Insert log ke `inventaris_pembelian`.
* **Hapus / Batal Pembelian:**
  1. Ambil data `inventaris_pembelian`.
  2. Kurangi stok `kondisi_baik` di `inventaris_barang` sesuai `jumlah`.
  3. Jika `keuangan_id` tidak null, hapus baris terkait di `keuangan_club`.
  4. Hapus data `inventaris_pembelian`.

### 3.2. Peminjaman & Pengembalian Alat
* **Pencatatan Pinjam:**
  1. Validasi: Ambil stok alat dari `inventaris_barang`.
  2. Hitung stok tersedia = `(kondisi_baik + kondisi_rusak_ringan) - stok_dipinjam`.
  3. Jika `jumlah > stok_tersedia`, lemparkan error: *"Stok alat tidak mencukupi (Tersedia: X unit)"*.
  4. Insert ke `inventaris_peminjaman` dengan status `'dipinjam'`.
  5. Update `inventaris_barang`: `stok_dipinjam = stok_dipinjam + jumlah`.
* **Pengembalian Alat:**
  1. Ambil data `inventaris_peminjaman`. Pastikan status saat ini `'dipinjam'`.
  2. Update `inventaris_peminjaman`: `status = 'kembali'`, `tgl_kembali = CURRENT_DATE`, dan simpan `catatan_kondisi_kembali` jika ada.
  3. Update `inventaris_barang`: `stok_dipinjam = GREATEST(0, stok_dipinjam - jumlah)`.
  4. Jika admin menandai ada barang rusak saat pengembalian (misal: 1 rusak ringan): kurangi `kondisi_baik` sebanyak 1, dan tambahkan `kondisi_rusak_ringan` sebanyak 1.

### 3.3. Pengajuan Kebutuhan Alat (Pelatih ke Admin)
* Pelatih mengirim form pengajuan: nama alat, kategori, perkiraan jumlah, estimasi harga, alasan. Status awal: `'menunggu'`.
* Admin di panel `/admin/inventaris` (Tab Pengajuan):
  * **Setujui (Approve):** Ubah status ke `'disetujui'`. Admin dapat langsung menekan tombol *"Realisasikan Pembelian"* yang akan mengisi form modal pembelian secara otomatis.
  * **Tolak (Reject):** Ubah status ke `'ditolak'` disertai catatan alasan admin.

---

## 4. Struktur Antarmuka Pengguna (UI Components)

### 4.1. Admin Panel (`src/app/admin/inventaris/page.tsx`)
1. **Header & KPI Summary Cards:**
   * Total Aset (akumulasi seluruh stok alat).
   * Siap Pakai (`kondisi_baik`).
   * Perlu Servis / Rusak (`kondisi_rusak_ringan + kondisi_rusak_berat`).
   * Sedang Dipinjam (`stok_dipinjam`).
2. **Tab Navigasi (Pixel-styled Tabs):**
   * **Tab 1: 📦 Katalog Alat:**
     * Filter kategori pill & live search.
     * Grid / List kartu alat dengan rincian stok, kondisi, lokasi, tombol edit/sesuaikan kondisi.
     * Modal *"Tambah Alat Baru"*.
     * Modal *"Sesuaikan Kondisi Fisik Alat"*.
   * **Tab 2: 🛒 Pembelian & Pengadaan:**
     * Tombol *"Catat Pembelian Baru"*.
     * Tabel riwayat pembelian (Tanggal, Nama Alat, Qty, Harga Satuan, Total Biaya, Vendor, Status Sync Kas, Aksi Hapus).
   * **Tab 3: 🔄 Sirkulasi Peminjaman:**
     * Tombol *"Catat Peminjaman"*.
     * Filter: Sedang Dipinjam / Sudah Kembali.
     * Kartu / Tabel Peminjaman dengan badge status (*Dipinjam*, *Terlambat*, *Kembali*), serta tombol *"Konfirmasi Kembali"*.
   * **Tab 4: 📝 Pengajuan Pelatih:**
     * Kartu tiket pengajuan dari para pelatih.
     * Tombol *"Setujui & Beli"* dan *"Tolak"*.

### 4.2. Pelatih Panel (`src/app/pelatih/inventaris/page.tsx`)
1. **Header & Info Dojang:** Menampilkan status operasional ketersediaan alat latihan dojang.
2. **Tab Navigasi:**
   * **Tab 1: 🥋 Ketersediaan Alat:**
     * Katalog visual alat latihan: Nama, Kategori, Stok Tersedia untuk Latihan (kondisi baik - dipinjam).
   * **Tab 2: 📋 Peminjaman Saya:**
     * Tombol *"Ajukan Pinjam Alat"*.
     * Daftar alat yang sedang dipinjam pelatih yang login beserta tanggal batas kembali.
   * **Tab 3: 💡 Usulan Kebutuhan:**
     * Tombol *"Ajukan Kebutuhan Alat Baru"*.
     * Riwayat usulan pelatih beserta status respons admin (*Menunggu / Disetujui / Ditolak*).

### 4.3. Navigasi Sidebar & Drawer
* **Admin Layout (`src/app/admin/layout.tsx`):**
  * Tambahkan item menu: `{ label: '📦 Inventaris Alat', path: '/admin/inventaris' }`.
* **Pelatih Layout (`src/app/pelatih/layout.tsx`):**
  * Tambahkan item menu: `{ label: '📦 Inventaris Alat', path: '/pelatih/inventaris' }`.

---

## 5. Penanganan Error & Validasi (Error Handling)

| Skenario | Penanganan Sistem |
|---|---|
| Pinjam melebihi stok tersedia | Sistem menolak aksi dan menampilkan notifikasi: *"Stok yang tersedia tidak mencukupi (Hanya tersisa X unit)"*. |
| Pengembalian alat melebihi yang dipinjam | Sistem memvalidasi jumlah pengembalian = jumlah peminjaman terkait. |
| Pembelian dengan nominal/jumlah <= 0 | Form validasi mencegah submit, menampilkan pesan error field angka positif. |
| Hapus pembelian yang sudah tercatat di kas | Menjalankan pembersihan ganda: mengurangi stok master + menghapus baris di `keuangan_club` via `keuangan_id`. |
| Pelatih mengakses data pembelian / keuangan | RLS memblokir query SELECT/INSERT/UPDATE di tabel `inventaris_pembelian`. |

---

## 6. Rencana Pengujian (Testing Strategy)

1. **Migrasi Database:** Menjalankan script migrasi `029_inventaris_club.sql` di database Supabase dan memverifikasi trigger penghitungan stok otomatis.
2. **Unit & Flow Testing Server Actions:**
   * Uji alur input pembelian dengan sync kas aktif -> Cek saldo & daftar di `/admin/keuangan`.
   * Uji alur input pembelian tanpa sync kas -> Pastikan tidak ada baris baru di `keuangan_club`.
   * Uji alur peminjaman alat -> Cek pengurangan `stok_dipinjam` dan penolakan jika melebihi kuota.
   * Uji pengembalian alat -> Cek pengembalian kuota stok dan update status peminjaman.
   * Uji pengajuan pelatih -> Cek muncul di tab admin dan aksi "Setujui & Beli".
3. **Build Check:** Memastikan `npm run build` sukses tanpa adanya type error atau missing export.
