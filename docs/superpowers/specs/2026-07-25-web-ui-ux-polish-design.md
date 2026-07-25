# Desain Penyempurnaan UI/UX Web (Web UI/UX Polish) - Siger Taekwondo Club

Menyempurnakan interaktivitas komponen visual (Button, Card, Input) dan mengatasi masalah visual seperti watermark logo yang mengganggu keterbacaan data pada dashboard/tabel.

## Fitur Utama

- **Kontrol Watermark**: Menyembunyikan watermark logo besar di halaman dashboard/admin/pelatih/ortu, namun tetap menampilkannya di landing page dan login page.
- **Button Micro-Animations**: Animasi hover yang taktil (translate-x/y negatif, bayangan membesar) dan klik (active: translate-x/y positif, bayangan nol).
- **Card Hover Elevation**: Kartu interaktif melayang halus saat di-hover.
- **Input Focus Effect**: Indikator fokus input yang tebal dan kontras menggunakan border & solid shadow.
- **Custom Retro/Brutal Scrollbars**: Scrollbar dengan style kustom yang cocok dengan tema Neo-Brutalism.

## Rencana Perubahan Komponen

### 1. `src/app/globals.css`
- Menambahkan aturan selektor `.hide-watermark` agar watermark di `body::after` tidak dirender (`display: none` atau `opacity: 0`).
- Menambahkan utility scrollbar kustom untuk mesin webkit dan standard CSS.
- Menambahkan utility shadow neo-brutalisme kustom.

### 2. `src/components/ui/Button.tsx`
- Menambahkan kelas-kelas transisi dan efek hover/active kustom pada button agar terasa sangat taktil.

### 3. `src/components/ui/Card.tsx`
- Menambahkan prop `hoverable?: boolean` agar card yang bertindak sebagai link/button bisa melayang secara halus saat disorot kursor.

### 4. `src/components/ui/Input.tsx`
- Menambahkan transisi dan shadow kustom saat focus.

### 5. Layout Panels (`src/app/admin/layout.tsx`, `src/app/pelatih/layout.tsx`, `src/app/ortu/layout.tsx`)
- Menambahkan logika di sisi klien (`useEffect`) untuk menyisipkan kelas `hide-watermark` pada objek `document.body` saat layout dimuat, dan membersihkannya saat dilepas (*unmounted*).

## Verifikasi Plan

- Menjalankan server lokal dan memverifikasi interaktivitas tombol pada hover dan click.
- Memastikan watermark logo tidak terlihat pada halaman dashboard/tabel/form admin, tetapi tetap tampil pada halaman login dan landing page.
- Memverifikasi tampilan scrollbar kustom pada halaman yang memiliki scrollbar vertikal/horizontal.
