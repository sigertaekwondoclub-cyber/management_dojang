# Codebase Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengoptimalkan performa loading, memperbaiki query N+1 pada payroll, menyatukan utility format, dan menyelesaikan bug edit produk merchant.

**Architecture:** Refactoring client-side auth bypass, pemisahan utility helper, batch fetching database pada Server Action payroll, dan upsert varian merchant.

**Tech Stack:** Next.js 14, Supabase JS Client, TailwindCSS, TypeScript.

## Global Constraints
- Next.js 14 App Router convention.
- Pastikan semua file diimpor dengan path alias `@/`.
- Jangan mengubah aturan RLS di Supabase.

---

### Task 1: Pembersihan Redundansi Auth & Supabase Client

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/pelatih/layout.tsx`
- Modify: `src/app/ortu/layout.tsx`
- Modify: `src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Modifikasi Admin Layout**
  Hapus pemanggilan query database profile dan getUser. Ubah state `authorized` langsung bernilai `true` dan `loading` bernilai `false` pada lifecycle mount.
  ```typescript
  // src/app/admin/layout.tsx
  useEffect(() => {
    setAuthorized(true)
    setLoading(false)
  }, [])
  ```

- [ ] **Step 2: Modifikasi Pelatih Layout & Ortu Layout**
  Lakukan hal yang sama pada layout untuk role pelatih (`src/app/pelatih/layout.tsx`) dan ortu (`src/app/ortu/layout.tsx`).

- [ ] **Step 3: Pindahkan Supabase Client di Dashboard**
  Buka `src/app/admin/dashboard/page.tsx` dan pindahkan deklarasi `const supabase = createClient()` ke level file scope (di atas fungsi komponen `AdminDashboardPage`).

- [ ] **Step 4: Verifikasi & Komit**
  Pastikan server dev berjalan tanpa error. Komit perubahan.
  ```bash
  git add src/app/admin/layout.tsx src/app/pelatih/layout.tsx src/app/ortu/layout.tsx src/app/admin/dashboard/page.tsx
  git commit -m "refactor: bypass redundant layout auth checks and stabilize supabase client"
  ```

---

### Task 2: Sentralisasi Utility Format

**Files:**
- Create: `src/lib/utils.ts`
- Modify: `src/app/admin/dashboard/page.tsx`
- Modify: `src/app/admin/merchant/page.tsx`
- Modify: `src/app/admin/merchant/pesanan/page.tsx`

- [ ] **Step 1: Buat File `src/lib/utils.ts`**
  ```typescript
  export function formatRupiah(n: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }

  export function formatTanggal(s: string): string {
    return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  ```

- [ ] **Step 2: Ganti Referensi di Dashboard**
  Hapus fungsi `formatRupiah` lokal di `src/app/admin/dashboard/page.tsx` and gunakan impor dari `@/lib/utils`.

- [ ] **Step 3: Ganti Referensi di Merchant & Pesanan**
  Hapus fungsi `formatRupiah` lokal di `src/app/admin/merchant/page.tsx` dan `src/app/admin/merchant/pesanan/page.tsx` lalu gunakan impor `@/lib/utils`. Ganti juga pemanggilan `formatTgl` lokal di pesanan page menggunakan `formatTanggal`.

- [ ] **Step 4: Komit**
  ```bash
  git add src/lib/utils.ts src/app/admin/dashboard/page.tsx src/app/admin/merchant/page.tsx src/app/admin/merchant/pesanan/page.tsx
  git commit -m "feat: centralize currency and date formatting utility functions"
  ```

---

### Task 3: Resolusi N+1 Query di Payroll Server Action

**Files:**
- Modify: `src/app/admin/honor/actions.ts`

- [ ] **Step 1: Ganti Loop Query Siswa Aktif Menjadi Single Query**
  Buka `src/app/admin/honor/actions.ts`. Ambil semua siswa aktif yang memiliki kelas dalam sekali query:
  ```typescript
  const { data: allActiveStudents, error: countErr } = await supabaseAdmin
    .from('siswa')
    .select('program_kelas_id')
    .eq('status_aktif', true)
  ```
  Kemudian hitung jumlah per kelas menggunakan `.filter()` di memory JavaScript.

- [ ] **Step 2: Ganti Loop Query Sesi Absensi Pelatih Menjadi Single Query**
  Query seluruh data absensi pelatih dalam rentang tanggal target secara sekaligus:
  ```typescript
  const { data: allSessions, error: sessErr } = await supabaseAdmin
    .from('absensi_pelatih')
    .select('id, program_kelas_id, pelatih_id')
    .gte('tgl', startDate)
    .lte('tgl', endDate)
  ```
  Kemudian hitung sesi mengajar per kelas dan per pelatih di memory JavaScript menggunakan filter data `allSessions`.

- [ ] **Step 3: Verifikasi Kalkulasi & Komit**
  Uji proses payroll dan komit perubahan:
  ```bash
  git add src/app/admin/honor/actions.ts
  git commit -m "perf: resolve database query N+1 bottleneck in generatePayroll"
  ```

---

### Task 4: Perbaikan Edit Varian Merchant & Loading Toggle

**Files:**
- Modify: `src/app/admin/merchant/page.tsx`

- [ ] **Step 1: Implementasi Upsert & Selective Delete pada Varian**
  Buka `src/app/admin/merchant/page.tsx`. Pada `handleSave`, ketika melakukan edit produk (`editId` aktif):
  1. Ambil daftar varian yang dikirim dari form.
  2. Lakukan `upsert` untuk varian-varian tersebut ke database.
  3. Lakukan `delete` hanya pada varian ukuran lama di DB yang tidak ada lagi di dalam form input untuk produk tersebut.

- [ ] **Step 2: Menambahkan Loading State pada Toggle Status Aktif**
  Tambahkan state loading lokal atau disable button sementara pada `toggleAktif` agar user tidak bisa double klik yang memicu race condition.

- [ ] **Step 3: Komit**
  ```bash
  git add src/app/admin/merchant/page.tsx
  git commit -m "fix: replace destructive delete-all varian logic with upsert and add toggle action loading"
  ```

---

### Task 5: Pembersihan Aset Kode (CSS & Types)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Perbaiki Invalid CSS Property**
  Buka `src/app/globals.css` line 13:
  Ganti `min-h-screen: 100vh;` menjadi `min-height: 100vh;`.

- [ ] **Step 2: Hapus Import/Export Redundan di `types.ts`**
  Buka `src/lib/types.ts` dan hapus baris import/export `createClient` karena tidak seharusnya didefinisikan di dalam file types.

- [ ] **Step 3: Komit**
  ```bash
  git add src/app/globals.css src/lib/types.ts
  git commit -m "style: fix invalid CSS and remove side-effect export from types"
  ```
