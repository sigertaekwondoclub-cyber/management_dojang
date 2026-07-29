# Implementation Plan: Extended Student Registration Form

**Goal:** Menambahkan Berat badan, Sabuk saat ini, Tempat Lahir, dan Alamat ke dalam form pendaftaran dan tabel data siswa.

---

### Task 1: Database Migration

- [ ] **Step 1: Buat file SQL migration**
  * Buat file `supabase/migrations/015_add_pendaftaran_extra_fields.sql`.
  * Tambahkan kolom `berat_badan` (NUMERIC), `sabuk_pendaftaran` (TEXT), `tempat_lahir` (TEXT), `alamat` (TEXT) ke tabel `pendaftaran_siswa`.
  * Tambahkan kolom `berat_badan` (NUMERIC), `tempat_lahir` (TEXT), `alamat` (TEXT) ke tabel `siswa`.

---

### Task 2: Type Definition Updates

- [ ] **Step 1: Update interface di `src/lib/types.ts`**
  * Tambahkan field baru ke interface `PendaftaranSiswa`:
    * `berat_badan?: number`
    * `sabuk_pendaftaran?: string`
    * `tempat_lahir?: string`
    * `alamat?: string`
  * Tambahkan field baru ke interface `Siswa`:
    * `berat_badan?: number`
    * `tempat_lahir?: string`
    * `alamat?: string`

---

### Task 3: Public Form Update (`src/app/daftar/page.tsx`)

- [ ] **Step 1: Update form state**
  * Tambahkan property ke `formData` state: `berat_badan`, `sabuk_pendaftaran` (default: 'Putih'), `tempat_lahir`, `alamat`.
- [ ] **Step 2: Sisipkan elemen input baru di Form UI**
  * Input Tempat Lahir (flex row berdampingan dengan Tanggal Lahir).
  * Input Berat Badan (kg, tipe number).
  * Select Option Sabuk saat ini dengan pilihan lengkap yang diminta.
  * Textarea Alamat.
- [ ] **Step 3: Sesuaikan data payload saat submit insert Supabase**

---

### Task 4: Admin Verification Update (`src/app/admin/pendaftaran/page.tsx`)

- [ ] **Step 1: Perbarui rendering kartu pendaftaran**
  * Tampilkan info Tempat Lahir, Alamat, Berat Badan, dan Sabuk Pendaftaran di daftar kartu detail calon siswa.
- [ ] **Step 2: Sesuaikan fungsi `handleTerima`**
  * Teruskan data `berat_badan`, `tempat_lahir`, `alamat`, dan `sabuk_saat_ini` (diambil dari `sabuk_pendaftaran` pendaftar) ketika melakukan insert baris siswa baru di tabel `siswa`.

---

### Task 5: Verification & Build Check

- [ ] **Step 1: Jalankan Type Check**
  ```bash
  npx tsc --noEmit
  ```
