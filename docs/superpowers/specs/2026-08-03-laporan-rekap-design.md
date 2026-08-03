# Desain Fitur: Rekap & Laporan

## Latar Belakang
Aplikasi Siger TKD Manager sudah memiliki data lengkap (absensi, iuran, ujian, prestasi, keuangan, honor pelatih, event). Dibutuhkan dua jenis laporan:
1. **Laporan untuk Orang Tua** — ringkasan perkembangan anak (absensi + iuran) via WhatsApp
2. **Laporan untuk Owner/Admin** — ringkasan bisnis lengkap yang bisa di-download PDF/Excel

## File Baru
- `src/app/admin/laporan/page.tsx` — halaman laporan admin (tab owner + blast WA ke semua ortu)
- `src/app/ortu/laporan/page.tsx` — halaman laporan ortu (view pribadi + tombol WA)

## Modifikasi
- `src/app/admin/layout.tsx` — tambah menu "📄 Laporan & Rekap"
- `src/app/ortu/layout.tsx` — tambah menu "📄 Laporan Saya"
