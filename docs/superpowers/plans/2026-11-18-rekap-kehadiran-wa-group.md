# Rekap Kehadiran WhatsApp Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur generator pesan dan modal salin rekap kehadiran bulanan siswa untuk grup WhatsApp orang tua murid di halaman Admin Laporan & Rekap (`/admin/laporan`).

**Architecture:** Fungsi murni generator teks WhatsApp ditempatkan di `src/lib/absensi.ts` dan diuji secara TDD di `src/lib/__tests__/absensi-filter.test.ts`. Antarmuka pengguna dan modal live-preview diimplementasikan di `src/app/admin/laporan/page.tsx` pada tab `kehadiran`.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript, Node.js Test Runner.

## Global Constraints
- Mengikuti tema brutalist UI dojang Siger Taekwondo Club (borders, rounded shapes, badge styling).
- Menggunakan TypeScript tanpa `any` yang tidak perlu.
- Tidak mengubah skema database (menggunakan data kehadiran yang sudah ada).

---

### Task 1: TDD Generator Teks Rekap WhatsApp di `src/lib/absensi.ts`

**Files:**
- Modify: `src/lib/absensi.ts`
- Test: `src/lib/__tests__/absensi-filter.test.ts`

**Interfaces:**
- Produces:
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

  export function generatePesanRekapKehadiranGrup(params: GenerateRekapKehadiranParams): string
  ```

- [x] **Step 1: Write failing unit tests for `generatePesanRekapKehadiranGrup` in `src/lib/__tests__/absensi-filter.test.ts`**
  - Uji formatting teks dengan daftar siswa
  - Uji sorting persentase kehadiran descending
  - Uji lencana kehadiran (`🌟 Sangat Baik`, `👍 Cukup`, `⚠️ Perlu Ditingkatkan`)
  - Uji penambahan catatan opsional

- [x] **Step 2: Run test to confirm it fails**
  Run: `node --experimental-strip-types src/lib/__tests__/absensi-filter.test.ts` (expect import error / missing function)

- [x] **Step 3: Implement `generatePesanRekapKehadiranGrup` in `src/lib/absensi.ts`**
  - Implementasikan interface `RekapKehadiranItem` dan `GenerateRekapKehadiranParams`
  - Implementasikan pengurutan siswa berdasarkan `persen` descending, kemudian `nama`
  - Implementasikan penghitungan rata-rata dan jumlah kehadiran 100%
  - Kembalikan string teks terformat rapi dengan emoji WhatsApp

- [x] **Step 4: Run test to confirm it passes**
  Run: `node --experimental-strip-types src/lib/__tests__/absensi-filter.test.ts`

- [x] **Step 5: Commit changes**
  Run: `git commit -am "feat: implement generatePesanRekapKehadiranGrup with tests"`

---

### Task 2: Implementasi Tombol dan Modal Pratinjau di `src/app/admin/laporan/page.tsx`

**Files:**
- Modify: `src/app/admin/laporan/page.tsx`

**Interfaces:**
- Consumes:
  `generatePesanRekapKehadiranGrup` dari `@/lib/absensi`
  `BULAN_NAMES` dari `@/lib/tunggakan`

- [x] **Step 1: Tambahkan state modal di `AdminLaporanPage`**
  - `showModalRekapWA`: boolean (default `false`)
  - `catatanRekapWA`: string (default `''`)

- [x] **Step 2: Tambahkan tombol "📋 Salin Rekap WhatsApp" di tab `kehadiran`**
  - Letakkan di sebelah kanan filter kelas & pencarian nama
  - Disabled jika `filteredKehadiran.length === 0`
  - Saat diklik: buka modal `showModalRekapWA = true`

- [x] **Step 3: Buat komponen `ModalRekapKehadiranWA`**
  - Generate live-preview teks WhatsApp berdasarkan data siswa terfilter, bulan, tahun, kelasFilter, dan catatan kustom
  - Tampilkan kotak textarea/pre-formatted preview yang bisa di-scroll
  - Input field textarea untuk `catatanRekapWA`
  - Tombol "📋 Salin Teks ke Clipboard" dengan feedback toast dan status icon
  - Tombol "Tutup / Batal"

- [x] **Step 4: Verifikasi build dan tipe data**
  Run: `npx tsc --noEmit`

- [x] **Step 5: Commit changes**
  Run: `git commit -am "feat: add whatsapp attendance recap modal and copy trigger"`

---

### Task 3: Verifikasi Lengkap & Push ke Remote Repository

**Files:**
- All touched files

- [x] **Step 1: Jalankan semua unit test**
  Run: `node --experimental-strip-types src/lib/__tests__/absensi-filter.test.ts && node --experimental-strip-types src/lib/__tests__/tunggakan.test.ts`

- [x] **Step 2: Jalankan TypeScript compiler check**
  Run: `npx tsc --noEmit`

- [x] **Step 3: Jalankan Next.js production build**
  Run: `npm run build`

- [x] **Step 4: Push commit ke GitHub `origin/master`**
  Run: `git push origin master`

