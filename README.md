# 🥋 Siger Taekwondo Club — Sistem Manajemen Dojang

> Aplikasi manajemen keanggotaan, jadwal latihan, perkembangan atlet, dan administrasi keuangan untuk Siger Taekwondo Club — dibangun dengan Next.js 14 dan Supabase.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.io)

---

## ✨ Fitur Utama

### 👨‍💼 Panel Admin
| Modul | Fitur |
|---|---|
| **Dashboard** | Statistik ringkasan (total siswa, iuran bulan ini, absensi) |
| **Kelola Akun** | CRUD akun pengguna, reset password, hubungkan ke profil siswa/pelatih |
| **Data Siswa** | CRUD lengkap, Export/Import CSV massal, filter status aktif |
| **Data Pelatih** | CRUD lengkap, kelola rate honor per sesi |
| **Absensi** | Rekap kehadiran siswa & pelatih, filter tanggal/kelas, Export CSV |
| **Iuran** | Kelola status iuran bulanan, verifikasi bukti transfer, generate iuran otomatis |
| **Hitung Honor** | Kalkulasi honor pelatih otomatis berbasis pool iuran & jumlah sesi mengajar |
| **Keuangan Club** | Pencatatan arus kas income/expense manual, grafik cashflow tahunan, Export CSV |
| **Ujian Sabuk** | Rekam riwayat kenaikan tingkat sabuk siswa |
| **Event & Kompetisi** | Kelola event, daftar peserta siswa, rekam hasil kompetisi |
| **Prestasi** | Monitor prestasi siswa di kompetisi |
| **Verifikasi Pendaftaran** | Terima/tolak pendaftaran siswa baru dari halaman publik, dengan modal konfirmasi |
| **Kartu Anggota** | Generate & tampilkan kartu anggota digital dengan QR Code |
| **Pengaturan Club** | Konfigurasi persentase pool honor pelatih |

### 👨‍🏫 Panel Pelatih
- Dashboard ringkasan sesi mengajar & honor bulan ini
- Input absensi siswa per kelas (Umum / Poomsae / Kyorugi)
- Rekap honor yang sudah dibayarkan
- Jadwal ujian sabuk & event kompetisi mendatang

### 👨‍👩‍👧 Panel Orang Tua / Wali
- Dashboard monitoring perkembangan anak (absensi, sabuk, iuran)
- Status iuran bulanan & riwayat pembayaran
- Upload bukti transfer untuk verifikasi iuran
- Jadwal ujian sabuk & event kompetisi
- Kartu anggota digital anak

### 🌐 Halaman Publik
- **Pendaftaran Online** — Form pendaftaran siswa baru yang dapat diisi oleh calon anggota
- **Login** — Autentikasi berbasis peran (Admin / Pelatih / Orang Tua)

---

## 🛠️ Teknologi

- **Framework**: [Next.js 14](https://nextjs.org) (App Router, Server Actions)
- **Bahasa**: [TypeScript 5](https://www.typescriptlang.org)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com) (Brutalism Design System)
- **Database & Auth**: [Supabase](https://supabase.io) (PostgreSQL + Row Level Security)
- **QR Code**: `qrcode.react`
- **Grafik**: [Recharts](https://recharts.org)
- **Font**: Baloo 2 & Inter (Google Fonts)

---

## 🚀 Cara Menjalankan Secara Lokal

### 1. Clone Repositori
```bash
git clone https://github.com/sigertaekwondoclub-cyber/management_dojang.git
cd management_dojang
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Buat file `.env.local` di root direktori proyek, lalu isi dengan nilai berikut:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```
> Nilai-nilai ini dapat ditemukan di dashboard Supabase Anda di **Project Settings → API**.

### 4. Jalankan Migrasi Database
Jalankan file SQL di dalam folder `supabase/migrations/` secara berurutan melalui Supabase SQL Editor atau Supabase CLI.

### 5. Jalankan Server Pengembangan
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 🗂️ Struktur Direktori

```
src/
├── app/
│   ├── admin/          # Panel Admin (dashboard, siswa, pelatih, keuangan, dll.)
│   ├── pelatih/        # Panel Pelatih
│   ├── ortu/           # Panel Orang Tua
│   ├── daftar/         # Halaman pendaftaran siswa baru (publik)
│   └── login/          # Halaman login
├── components/
│   └── ui/             # Komponen UI reusable (Button, Card, Badge, Input, dll.)
├── lib/
│   ├── supabase/       # Konfigurasi Supabase client (browser & server)
│   └── types.ts        # Definisi tipe TypeScript global
├── middleware.ts        # Proteksi rute berbasis peran (Admin/Pelatih/Ortu)
supabase/
└── migrations/         # File SQL migrasi skema database
```

---

## 🔒 Keamanan

- Autentikasi dikelola sepenuhnya oleh **Supabase Auth**.
- Proteksi rute diimplementasikan melalui **Next.js Middleware** — setiap peran pengguna (admin, pelatih, ortu) hanya dapat mengakses halaman yang sesuai.
- Operasi admin sensitif (seperti membuat/menghapus akun) menggunakan **Supabase Service Role Key** yang hanya berjalan di sisi server (Server Actions).
- **Row Level Security (RLS)** PostgreSQL aktif di semua tabel untuk mencegah akses data lintas pengguna.

---

## ☁️ Deploy ke Vercel

Cara paling mudah untuk meng-online-kan aplikasi ini:

1. Hubungkan repositori GitHub ini ke akun [Vercel](https://vercel.com).
2. Tambahkan variabel environment yang dibutuhkan di pengaturan proyek Vercel.
3. Klik **Deploy** — Vercel akan otomatis mendeteksi konfigurasi Next.js.

---

## 📄 Lisensi

Proyek ini dikembangkan untuk kebutuhan internal **Siger Taekwondo Club**.

---

*Dibangun dengan ❤️ untuk kemajuan atlet Taekwondo Siger.*
