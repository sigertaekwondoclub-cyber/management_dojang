# Specification Design: Admin Dashboard Visualization & Feature Integration

**Date:** 2026-07-28  
**Author:** Antigravity  

## 1. Goal
Memperbarui halaman Dashboard Admin (`/admin/dashboard`) dengan integrasi penuh fitur Merchant (Verifikasi pesanan, status stok kritis) dan visualisasi grafik interaktif (Bar Chart & Donut Chart) yang dibangun dengan SVG murni bergaya Neo-Brutalist.

## 2. Proposed Changes

### 2.1 Database & State Additions
Dashboard akan melakukan query tambahan secara paralel:
1. `pesanan_merchant`: Menghitung pesanan dengan status `menunggu_pembayaran` untuk ditambahkan ke kartu aksi atas (Verifikasi Pesanan).
2. `pesanan_merchant` (lunas): Menghitung akumulasi pemasukan dari transaksi merchant (`status` = `lunas`, `diproses`, atau `siap_diambil`).
3. `produk_varian` join `produk_merchant`: Mengambil varian produk yang memiliki `stok <= 5` untuk alert stok kritis.

### 2.2 UI Layout Changes
* **Metrik Utama (Grid Atas)**:
  * Siswa Aktif (🥋)
  * Pelatih Aktif (👨‍🏫)
  * Pendaftaran Baru (📝)
  * Verifikasi Iuran (💰)
  * **[NEW] Verifikasi Pesanan Merchant (🛒)**
* **Visualisasi & Analitik (Grid Tengah)**:
  * **Donut Chart SVG**: Distribusi Pemasukan (Iuran vs Merchant).
  * **Bar Chart SVG**: Cashflow Bulanan (Pemasukan vs Pengeluaran).
* **Alert & Informasi (Grid Bawah)**:
  * **[NEW] Alert Stok Kritis**: Daftar varian produk dengan stok <= 5.
  * Jadwal Terdekat (Ujian Sabuk & Kompetisi).

## 3. Visual & Styling System
* **Style**: Neo-Brutalist. Setiap chart akan menggunakan border hitam tebal `border-2 border-dark`, warna latar belakang cerah khas (`#BBF7D0`, `#BFDBFE`, `#FDE68A`, `#FECACA`), and bayangan brutal `shadow-brutal`.
* **SVG Components**: Menggunakan representasi SVG murni agar responsif di mobile dan desktop tanpa memuat library eksternal yang lambat atau tidak kompatibel dengan skema Next.js.
