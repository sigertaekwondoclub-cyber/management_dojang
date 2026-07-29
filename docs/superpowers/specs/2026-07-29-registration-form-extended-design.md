# Specification Design: Extended Student Registration Form

**Date:** 2026-07-29  
**Author:** Antigravity  

## 1. Goal
Menambahkan field informasi tambahan pada formulir pendaftaran siswa baru agar memuat informasi:
* Berat badan (kg)
* Sabuk saat ini (Putih, Kuning, Kuning Strip, Hijau, Hijau Strip, Biru, Biru Strip, Merah Strip 1, Merah Strip 2)
* Tempat lahir
* Alamat lengkap

Data ini harus terekam di database `pendaftaran_siswa` dan diteruskan ke database `siswa` saat disetujui oleh admin.

## 2. Proposed Changes

### 2.1 Database Schema updates
* **Tabel `pendaftaran_siswa`**:
  * `berat_badan`: NUMERIC
  * `sabuk_pendaftaran`: TEXT
  * `tempat_lahir`: TEXT
  * `alamat`: TEXT
* **Tabel `siswa`**:
  * `berat_badan`: NUMERIC
  * `tempat_lahir`: TEXT
  * `alamat`: TEXT
  *(Catatan: kolom `sabuk_saat_ini` sudah ada di tabel `siswa`)*

### 2.2 UI Form updates (Wali Murid / Public)
* Menambahkan kolom-kolom baru di formulir pendaftaran `/daftar`:
  * Input Tempat Lahir (berdampingan dengan Tanggal Lahir)
  * Input Berat Badan (kg, tipe number)
  * Select Option Sabuk saat ini (default: 'Putih')
  * Textarea Alamat Lengkap

### 2.3 UI Admin Verifikasi
* Menampilkan field tambahan (Berat Badan, Sabuk saat ini, Tempat Lahir, Alamat) di kartu verifikasi pendaftaran.
* Memastikan fungsi `handleTerima` meneruskan field-field baru tersebut ke tabel `siswa`.

## 3. Options for Belts
Daftar pilihan sabuk (belt options) yang valid:
* Putih
* Kuning
* Kuning Strip
* Hijau
* Hijau Strip
* Biru
* Biru Strip
* Merah Strip 1
* Merah Strip 2
