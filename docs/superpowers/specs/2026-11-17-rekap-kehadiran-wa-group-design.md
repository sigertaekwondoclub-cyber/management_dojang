# Design Spec: Rekap Kehadiran Siswa untuk WhatsApp Grup Orang Tua

- **Date**: 2026-11-17
- **Feature**: Rekap Kehadiran Bulanan via WhatsApp Grup
- **Target Page**: Admin Laporan & Rekap (`/admin/laporan`) - Tab Rekap Kehadiran

## 1. Overview
Fitur ini mempermudah pelatih dan admin Siger Taekwondo Club untuk membagikan rekap kehadiran bulanan siswa langsung ke grup WhatsApp orang tua murid. Admin dapat memfilter berdasarkan program kelas (Semua Program, Kelas Umum, atau Kelas Prestasi), melihat pratinjau teks dengan catatan tambahan, lalu menyalin pesan berformat rapi siap kirim.

## 2. Technical Architecture

### 2.1 Modul Generator Pesan (`src/lib/absensi.ts`)
Fungsi `generatePesanRekapKehadiranGrup`:
- **Interface Input**:
  ```typescript
  export interface RekapKehadiranItem {
    nama: string
    programKelas: string
    hadir: number
    izin: number
    sakit: number
    alpha: number
    totalSesi: number
    persen: number
  }

  export interface GenerateRekapKehadiranParams {
    siswaList: RekapKehadiranItem[]
    bulanNama: string
    tahun: number | string
    labelKelas: string
    totalSesiDojang: number
    catatanTambahan?: string
  }
  ```
- **Logika Formatting**:
  - Sorting: Siswa diurutkan secara menurun (*descending*) berdasarkan persentase kehadiran (`persen`), kemudian secara alfabetis berdasarkan nama jika persentase sama.
  - Kategori kehadiran:
    - $\ge 80\%$: `🌟 Sangat Baik`
    - $60\% - 79\%$: `👍 Cukup`
    - $< 60\%$: `⚠️ Perlu Ditingkatkan`
  - Ringkasan statistik di akhir pesan:
    - Rata-rata kehadiran persentase kelompok terpilih
    - Jumlah siswa yang hadir penuh (100%)
  - Opsional: Catatan kustom dari input admin (pengumuman libur, jadwal ujian kenaikan tingkat, dll).

### 2.2 Template Pesan WhatsApp
```text
🥋 *REKAP KEHADIRAN SISWA*
*SIGER TAEKWONDO CLUB*
📅 *Periode*: {bulanNama} {tahun}
🏷️ *Program*: {labelKelas}
📊 *Total Sesi*: {totalSesiDojang} Sesi Latihan

📋 *Rincian Kehadiran Siswa*:
{nomor}. *{nama}* ({programKelas})
   • Hadir: {hadir} | Izin: {izin} | Sakit: {sakit} | Alpha: {alpha}
   • Kehadiran: {persen}% ({badge})

...

📈 *Ringkasan Dojang*:
• Rata-rata Kehadiran: {avgPersen}%
• Kehadiran Penuh (100%): {count100} Siswa

{catatanTambahan}

Terima kasih atas bimbingan dan dukungan Ayah/Bunda di rumah. Tetap semangat berlatih! 🥋🔥
```

### 2.3 Komponen Antarmuka Pengguna (`src/app/admin/laporan/page.tsx`)
1. **Tombol "📋 Salin Rekap WhatsApp"**:
   - Ditempatkan di header tab **Rekap Kehadiran** berdampingan dengan dropdown filter kelas dan pencarian nama.
   - Disabled jika `filteredKehadiran.length === 0`.
2. **Modal Pratinjau Rekap WhatsApp**:
   - Status modal `showModalRekapWA`: boolean.
   - State `catatanRekapWA`: string (textarea untuk input catatan khusus).
   - Tampilan live preview teks dengan font monospace berlatar belakang abu-abu/krem bersih.
   - Tombol **"📋 Salin Teks ke Clipboard"** dengan feedback visual toast hijau ketika berhasil disalin.
   - Tombol **"Batal / Tutup"** untuk menutup modal.

## 3. Testing Strategy
- **Unit Test (`src/lib/__tests__/absensi-filter.test.ts`)**:
  - Validasi output `generatePesanRekapKehadiranGrup` dengan data siswa campuran.
  - Validasi sorting persentase tertinggi ke terendah.
  - Validasi saat ada catatan tambahan vs tidak ada catatan tambahan.
  - Validasi saat daftar siswa kosong.
- **Type Checking**:
  - `npx tsc --noEmit` bebas error.
- **Build Verification**:
  - `npm run build` berhasil tanpa kendala.

