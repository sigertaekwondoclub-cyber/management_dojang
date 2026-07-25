# Desain Navigasi Mobile Adaptif (Responsive Navigation) - Siger Taekwondo Club

Menyesuaikan navigasi panel Admin, Pelatih, dan Orang Tua agar adaptif dan nyaman digunakan di perangkat mobile menggunakan Bottom Navigation Bar dan Bottom Sheet Drawer.

## Fitur Utama

- **Tampilan Desktop (>= 768px)**: Tetap menggunakan sidebar brutalism bawaan di sebelah kiri.
- **Tampilan Mobile (< 768px)**:
  - **Top Header**: Header ringkas di bagian atas dengan logo klub dan nama panel.
  - **Bottom Navigation Bar**: Navigasi bawah dengan 4 menu utama + 1 tombol "Lainnya".
  - **Bottom Sheet Drawer**: Panel menu tambahan yang muncul dari bawah dengan animasi *slide-up* saat tombol "Lainnya" ditekan.
  - **Konsistensi Desain**: Gaya Brutalism dengan border hitam tebal, shadow tegas (`shadow-brutal`), dan font Baloo 2 / Inter.

## Rancangan Menu

### 1. Panel Admin
- **Bottom Bar**: 🏠 Dashboard, 👤 Siswa, 💰 Iuran, 📊 Keuangan, ➕ Lainnya
- **Bottom Sheet (Lainnya)**:
  - 📋 Verifikasi Pendaftaran
  - 🥋 Data Pelatih
  - 📅 Absensi
  - 🏆 Honor Pelatih
  - 🪪 Kartu Anggota
  - 🏅 Ujian Sabuk
  - 🥋 Event Kompetisi
  - 🌟 Rekap Prestasi
  - ⚙️ Pengaturan
  - 🔑 Kelola Akun
  - 🔴 Logout

### 2. Panel Pelatih
- **Bottom Bar**: 🏠 Dashboard, 📋 Absensi, 🏅 Ujian, ➕ Lainnya
- **Bottom Sheet (Lainnya)**:
  - 🥋 Event Kompetisi
  - 🏆 Honor Saya
  - 🔴 Logout

### 3. Panel Orang Tua (Ortu)
- **Bottom Bar**: 🏠 Dashboard, 📅 Absensi, 💰 Iuran, ➕ Lainnya
- **Bottom Sheet (Lainnya)**:
  - 🏅 Riwayat Ujian
  - 🥋 Event Kompetisi
  - 🪪 Kartu Anggota
  - 🔴 Logout

## Verifikasi Plan

- Membuka halaman admin, pelatih, dan ortu di simulator perangkat mobile (lebar < 768px).
- Memastikan menu "Lainnya" memicu Bottom Sheet.
- Memastikan navigasi ke semua halaman berfungsi dan responsif.
