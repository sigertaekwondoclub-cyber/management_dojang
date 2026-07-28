# Implementation Plan: Admin Dashboard Visual Charts & Feature Integration

**Goal:** Memperbarui dashboard admin (`src/app/admin/dashboard/page.tsx`) dengan:
1. Penambahan diagram batang SVG untuk visualisasi perbandingan Income, Expense, dan Omzet Merchant.
2. Penambahan diagram donat SVG untuk perbandingan proporsi pemasukan (Iuran Bulanan vs Merchant).
3. Penambahan counter verifikasi pesanan merchant baru di jajaran kartu statistik utama.
4. Penambahan banner peringatan stok kritis untuk produk varian merchant yang stoknya kurang dari atau sama dengan 5.

---

### Task 1: Update Data Fetching & State

- [ ] **Step 1: Modifikasi State `stats`**
  Tambahkan properti state baru:
  * `pesananMerchantMenunggu: number` (untuk counter kartu atas)
  * `merchantPemasukan: number` (untuk data chart)
  * `stokKritis: Array<{ produk_nama: string, ukuran: string, stok: number }>` (untuk alert banner)

- [ ] **Step 2: Update Query Paralel di `fetchDashboard`**
  * Query `pesanan_merchant` dengan filter `status = 'menunggu_pembayaran'` (ambil `count`).
  * Query `pesanan_merchant` dengan filter `status` in `('lunas', 'diproses', 'siap_diambil')` (ambil data `total_harga` untuk agregasi pemasukan merchant).
  * Query `produk_varian` join `produk_merchant` dengan filter `stok <= 5` (ambil data nama produk, ukuran, dan jumlah stok).

---

### Task 2: Implement Component UI & Charts

- [ ] **Step 1: Tambahkan Kartu Metrik Merchant**
  * Sisipkan kartu "Verifikasi Pesanan" (🛒) di bagian grid atas di samping "Verifikasi Iuran" (menghubungkan ke `/admin/merchant/pesanan`).

- [ ] **Step 2: Gambar SVG Bar Chart (Cashflow Bulanan)**
  * Gambar diagram batang SVG dengan grid horizontal, legenda warna Neo-Brutalist, dan label data Income (Iuran + Keuangan Club), Pemasukan Merchant, dan Expense.

- [ ] **Step 3: Gambar SVG Donut Chart (Proporsi Sumber Keuangan)**
  * Gambar diagram donat SVG interaktif menggunakan parameter `strokeDasharray` proporsional untuk membandingkan Pemasukan Iuran vs Pemasukan Merchant.

- [ ] **Step 4: Tambahkan Banner Alert Stok Kritis**
  * Tampilkan daftar produk dengan stok kritis di bagian bawah dashboard menggunakan desain Neo-Brutalist yang tegas (berlatar merah/kuning dengan border hitam tebal).

---

### Task 3: Verification & Build Check

- [ ] **Step 1: Jalankan Type Check**
  ```bash
  npx tsc --noEmit
  ```
