# Desain Spesifikasi: Pendaftaran Langsung Peserta Event oleh Admin / Owner

- **Tanggal**: 2026-10-28
- **Topik**: Fitur Pendaftaran Siswa/Atlet Langsung ke Event oleh Admin/Owner (Form Pembuatan Event & Modal Kelola Peserta)
- **Status**: Disetujui (Approved)

---

## 1. Latar Belakang & Masalah

Saat ini, pendaftaran event kejuaraan atau kompetisi hanya dapat dilakukan oleh orang tua/wali murid melalui portal ortu (`/ortu/event`). Admin/owner klub taekwondo sering kali perlu mendaftarkan atlet/kontingen secara mandiri (misal: atlet yang ditunjuk oleh pelatih untuk kejuaraan daerah atau open tournament) tanpa harus menunggu orang tua mendaftar sendiri.

---

## 2. Arsitektur & Solusi

Sistem mengintegrasikan pendaftaran langsung peserta event di level Admin pada halaman `/admin/event`:

1. **Pada Form Pembuatan/Pengeditan Event**:
   - Ditambahkan opsi interaktif untuk memilih siswa aktif secara langsung saat membuat event.
   - Pilihan multi-select siswa dilengkapi pencarian nama dan filter program kelas.
   - Siswa yang dipilih otomatis di-insert ke tabel `event_peserta`.

2. **Pada Tabel Event (Modal "Kelola Peserta")**:
   - Kolom peserta menampilkan badge jumlah peserta aktif yang terdaftar (contoh: `👥 6 Peserta`).
   - Tombol `👥 Kelola Peserta` membuka modal komprehensif untuk:
     - Melihat daftar peserta terdaftar beserta data sabuk dan kelas.
     - Menambah siswa baru ke event kapan saja.
     - Menghapus/membatalkan peserta dari event.
     - Menyalin daftar kontingen untuk laporan WhatsApp/pelatih.

---

## 3. Komponen Spesifikasi

### 3.1. Master Data & Query (`src/app/admin/event/page.tsx`)

1. **State Siswa Aktif**:
   - Mengambil daftar siswa aktif (`status_aktif = true`) dari tabel `siswa`:
     ```typescript
     supabase
       .from('siswa')
       .select('id, nama, sabuk_saat_ini, program_kelas_id, program_kelas:program_kelas_id(nama_program)')
       .eq('status_aktif', true)
       .order('nama')
     ```
2. **State Jumlah Peserta**:
   - Query event join `event_peserta(count)` atau query batch jumlah peserta per event agar tabel event menampilkan badge akurat.

### 3.2. Form Buat/Edit Event

1. **Section "Daftarkan Siswa Langsung"**:
   - Toggles / accordion opsional: `"👥 Daftarkan Siswa Langsung (Opsional)"`.
   - Kotak pencarian (filter nama siswa realtime).
   - Tombol aksi cepat: `Pilih Semua`, `Reset Pilihan`.
   - Checklist grid siswa menampilkan nama, badge sabuk, dan nama program kelas.
2. **Logika Penyimpanan**:
   - Simpan `event_kompetisi`.
   - Jika ada siswa yang dipilih:
     ```typescript
     const pesertaRows = selectedSiswaIds.map(siswa_id => ({
       event_id: eventId,
       siswa_id,
       status_daftar: 'terdaftar'
     }))
     await supabase.from('event_peserta').upsert(pesertaRows, { onConflict: 'event_id, siswa_id' })
     ```

### 3.3. Modal "Kelola Peserta Event"

1. **Tampilan Header**:
   - Nama Event, Tanggal, Lokasi, Biaya Pendaftaran, Total Peserta.
2. **Tambah Peserta Cepat**:
   - Dropdown multi-select / search siswa aktif yang **belum terdaftar** di event ini.
   - Tombol `➕ Daftarkan ke Event`.
3. **Daftar Peserta Terdaftar**:
   - Tabel: No, Nama Siswa, Sabuk, Kelas, Tanggal Terdaftar, Hasil/Medali.
   - Aksi: Tombol `🗑️ Hapus Peserta` (konfirmasi dialog).
4. **Fitur Ekspor / Salin Kontingen**:
   - Tombol `📋 Salin Format WA`: menghasilkan teks rapi berisi daftar kontingen atlet beserta event dan tanggal untuk dibagikan ke grup WhatsApp pelatih / orang tua.

---

## 4. Validasi & Integritas Data

- Relasi unik `UNIQUE(event_id, siswa_id)` pada tabel `event_peserta` terjaga sehingga tidak ada duplikasi data pendaftaran.
- RLS policy yang ada (`Admin full access event_peserta`) sudah mendukung operasi INSERT, UPDATE, dan DELETE dari sisi admin.
- Hanya siswa dengan `status_aktif = true` yang disarankan pada daftar pencarian atlet baru.
