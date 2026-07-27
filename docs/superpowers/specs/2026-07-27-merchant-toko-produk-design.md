# Fitur Merchant (Toko Produk Club) — Design Spec
**Tanggal:** 2026-07-27
**Status:** Disetujui

## Latar Belakang

Siger Taekwondo Club membutuhkan fitur toko internal agar orang tua/wali dapat memesan produk club (kaos, dobok, aksesoris, dll.) langsung dari aplikasi. Admin mengelola katalog produk dan memverifikasi pembayaran. Alur pembayaran mengikuti pola yang sama dengan iuran: ortu upload bukti transfer, admin verifikasi dan update status.

---

## Skema Database (4 Tabel Baru)

### `produk_merchant`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID PK | auto-generated |
| nama | TEXT NOT NULL | Nama produk |
| kategori | TEXT | `'Seragam'` / `'Aksesoris'` / `'Perlengkapan'` |
| harga | NUMERIC NOT NULL | Harga dasar produk |
| deskripsi | TEXT | Deskripsi produk |
| foto_url | TEXT | URL foto produk (Supabase Storage) |
| status_aktif | BOOLEAN DEFAULT true | Jika false, tidak tampil di toko ortu |
| created_at | TIMESTAMPTZ | auto |

### `produk_varian`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID PK | auto-generated |
| produk_id | UUID FK → produk_merchant | |
| ukuran | TEXT NOT NULL | e.g. `'S'`, `'M'`, `'L'`, `'XL'`, `'XXL'`, `'Bebas'` |
| stok | INT NOT NULL DEFAULT 0 | Stok per ukuran |
| created_at | TIMESTAMPTZ | auto |

### `pesanan_merchant`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID PK | auto-generated |
| siswa_id | UUID FK → siswa | Siswa/anak yang dipesankan |
| total_harga | NUMERIC NOT NULL | Total semua item dalam pesanan |
| status | TEXT | `'menunggu_pembayaran'` / `'lunas'` / `'diproses'` / `'siap_diambil'` |
| bukti_transfer_url | TEXT | URL foto bukti transfer |
| catatan_admin | TEXT | Catatan dari admin |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto-update on status change |

### `pesanan_item`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UUID PK | auto-generated |
| pesanan_id | UUID FK → pesanan_merchant | |
| produk_id | UUID FK → produk_merchant | Snapshot produk saat pesan |
| varian_id | UUID FK → produk_varian | Snapshot varian/ukuran saat pesan |
| qty | INT NOT NULL | Jumlah yang dipesan |
| harga_satuan | NUMERIC NOT NULL | Harga saat dipesan (snapshot) |

---

## Row Level Security (RLS)

| Tabel | Admin | Ortu | Pelatih |
|---|---|---|---|
| produk_merchant | ALL | SELECT (status_aktif=true) | SELECT |
| produk_varian | ALL | SELECT | SELECT |
| pesanan_merchant | ALL | SELECT/INSERT/UPDATE milik siswa sendiri | — |
| pesanan_item | ALL | SELECT/INSERT milik pesanan sendiri | — |

---

## Fitur Admin

### `/admin/merchant` — Manajemen Produk

**Tampilan:**
- Tabel produk: Foto (thumbnail), Nama, Kategori, Harga, Total Stok, Status Aktif (toggle), Aksi (Edit/Hapus)
- Tombol **"+ Tambah Produk"**

**Form Tambah/Edit Produk:**
- Nama produk (text)
- Kategori (dropdown: Seragam / Aksesoris / Perlengkapan)
- Harga (number)
- Deskripsi (textarea)
- Upload Foto (Supabase Storage bucket `merchant`)
- **Tabel Varian Ukuran**: baris dinamis [Ukuran (text) | Stok (number) | Hapus]. Tombol `+ Tambah Ukuran`
- Minimal 1 varian wajib diisi sebelum bisa simpan

**Aksi:**
- Toggle aktif/nonaktif produk
- Hapus produk (dengan konfirmasi, hanya jika belum ada pesanan aktif)

### `/admin/merchant/pesanan` — Manajemen Pesanan

**Tampilan:**
- Tabel pesanan: Nama Siswa, Tanggal, Total Harga, Status (badge warna), Aksi
- Filter tab berdasarkan status: Semua / Menunggu Pembayaran / Lunas / Diproses / Siap Diambil
- Klik baris → modal detail pesanan

**Detail Pesanan (modal):**
- Daftar item: nama produk, ukuran, qty, harga satuan, subtotal
- Preview bukti transfer (jika sudah diupload)
- Dropdown update status + field catatan admin
- Tombol **Simpan Perubahan**

**Badge Warna Status:**
- `menunggu_pembayaran` → kuning (accent)
- `lunas` → biru (secondary)
- `diproses` → ungu
- `siap_diambil` → hijau (primary)

---

## Fitur Ortu

### `/ortu/merchant` — Toko Produk

**Tampilan:**
- Header toko + ikon keranjang (badge counter jumlah item)
- Filter kategori (tab/chip: Semua / Seragam / Aksesoris / Perlengkapan)
- Grid kartu produk (2 kolom mobile, 3 kolom desktop):
  - Foto produk
  - Nama & Kategori
  - Harga
  - Pilih ukuran (dropdown, menampilkan stok per ukuran)
  - Input qty
  - Tombol **"+ Keranjang"** (disabled jika stok habis)

### `/ortu/merchant/keranjang` — Keranjang Belanja

- Daftar item: foto thumbnail, nama, ukuran, qty (bisa edit), subtotal, tombol hapus
- Ringkasan total harga
- Tombol **"Checkout & Buat Pesanan"**
- Setelah checkout: tampil instruksi transfer (nomor rekening club) + tombol **"Upload Bukti Transfer"**

### `/ortu/merchant/pesanan` — Riwayat Pesanan

- Daftar pesanan dengan status (badge warna)
- Klik pesanan → detail item + status saat ini
- Jika status `menunggu_pembayaran`: tampil tombol **Upload / Ganti Bukti Transfer**

### Widget di Dashboard Ortu

- Card ringkasan: "Pesanan Terbaru" — menampilkan status pesanan terakhir dan link ke halaman pesanan

---

## Navigasi Tambahan

**Admin Sidebar (Desktop) & Bottom Sheet (Mobile):**
- Tambahkan: `🛒 Merchant` → `/admin/merchant`
- Tambahkan: `📦 Pesanan Merchant` → `/admin/merchant/pesanan`

**Ortu Bottom Bar (Mobile) — sudah penuh 3 + Lainnya:**
- `🛒 Toko` → `/ortu/merchant` masuk ke Bottom Sheet "Lainnya"
- `📦 Pesanan Saya` → `/ortu/merchant/pesanan` masuk ke Bottom Sheet "Lainnya"

---

## Alur Lengkap Pemesanan

```
Ortu pilih produk + ukuran + qty
    → Tambah ke keranjang (localStorage/state)
    → Checkout → buat pesanan_merchant (status: menunggu_pembayaran)
       + insert pesanan_item[] + kurangi stok produk_varian
    → Ortu upload bukti transfer → update bukti_transfer_url
    → Admin verifikasi → update status: lunas
    → Admin proses → update status: diproses
    → Admin selesai → update status: siap_diambil
    → Ortu lihat di dashboard: status "Siap Diambil" ✅
```

---

## Batasan Scope (YAGNI)

- Tidak ada fitur pengiriman/ongkos kirim (ambil langsung ke dojang)
- Tidak ada integrasi payment gateway otomatis
- Tidak ada fitur rating/ulasan produk
- Keranjang belanja menggunakan React state (tidak persisten ke database) — hilang saat logout
- Foto produk disimpan di Supabase Storage bucket `merchant` (bukan CDN eksternal)
