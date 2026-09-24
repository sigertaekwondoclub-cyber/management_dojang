# Rencana Implementasi: Fitur Hutang & Kasbon Pelatih Terintegrasi Kas Riil

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur pencatatan kasbon/hutang pelatih yang terintegrasi secara otomatis dengan arus kas riil klub (Keuangan Club), sistem Payroll Bulanan (potong honor), serta slip honor transparan di dashboard pelatih.

**Architecture:** Menggunakan model data relational ledger (`kasbon_pelatih` untuk pokok pinjaman & `pembayaran_kasbon` untuk riwayat cicilan tunai maupun potong payroll). Sinkronisasi kas riil dilakukan melalui penambahan transaksi otomatis ke `keuangan_club` saat pinjaman diserahkan (expense) dan saat disetor tunai (income), serta penghitungan pengeluaran honor berdasarkan honor bersih (`honor_kotor - potongan_kasbon`).

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL & RLS), TypeScript, Tailwind CSS.

## Global Constraints
- Setiap pengeluaran honor pelatih di seluruh sistem (`/admin/keuangan`, `/admin/dashboard`, `/admin/laporan`) harus menggunakan `honor_bersih` (`total_payout - potongan_kasbon`).
- Transaksi pinjaman kasbon langsung memotong kas klub (`jenis: 'expense'`, `kategori: 'Kasbon Pelatih'`, `sumber: 'kasbon'`).
- Transaksi pelunasan tunai langsung menambah kas klub (`jenis: 'income'`, `kategori: 'Pelunasan Kasbon'`, `sumber: 'kasbon'`).
- Validasi ketat: Potongan kasbon tidak boleh melebihi sisa hutang dan tidak boleh melebihi honor kotor pelatih.
- Pelatih hanya berhak melihat data kasbon miliknya sendiri melalui RLS.

---

### Task 1: Database Migration Script

**Files:**
- Create: `supabase/migrations/022_kasbon_pelatih.sql`

**Interfaces:**
- Produces: Tabel `kasbon_pelatih`, `pembayaran_kasbon`, alter kolom `payroll_details (potongan_kasbon, honor_bersih)`, RLS policies.

- [ ] **Step 1: Tulis file migration SQL**

Tulis `supabase/migrations/022_kasbon_pelatih.sql` dengan skema DDL lengkap, foreign keys, alter table, dan RLS policies.

- [ ] **Step 2: Verifikasi sintaks SQL**

Pastikan foreign key mengarah ke `pelatih(id)` dan `payroll_details(id)` dengan benar, serta check constraint valid.

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/022_kasbon_pelatih.sql
git commit -m "feat(db): add kasbon_pelatih and pembayaran_kasbon migration"
```

---

### Task 2: Type Definitions Update

**Files:**
- Modify: `src/lib/types.ts:187-204`

**Interfaces:**
- Produces: Tipe data `KasbonPelatih`, `PembayaranKasbon`, dan pembaruan `PayrollDetail` dengan `potongan_kasbon: number` dan `honor_bersih: number`.

- [ ] **Step 1: Update interface di `src/lib/types.ts`**

Tambahkan interface `KasbonPelatih`, `PembayaranKasbon`, serta perbarui interface `PayrollDetail`.

- [ ] **Step 2: Verifikasi type safety**

Jalankan `npx tsc --noEmit` untuk memastikan tidak ada konflik tipe data.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add KasbonPelatih and update PayrollDetail types"
```

---

### Task 3: Server Actions untuk Kasbon & Payroll Potongan

**Files:**
- Modify: `src/app/admin/honor/actions.ts`

**Interfaces:**
- Consumes: Supabase Admin client, `KasbonPelatih`, `PembayaranKasbon`, `PayrollDetail`.
- Produces:
  - `tambahKasbon(pelatihId: string, nominal: number, tglPinjam: string, keterangan: string)`
  - `hapusKasbon(kasbonId: string)`
  - `catatPembayaranTunai(kasbonId: string, nominal: number, tglBayar: string, catatan?: string)`
  - `updatePotonganKasbon(detailId: string, potongan: number)`
  - `generatePayroll(bulan: number, tahun: number)` (diperbarui dengan kalkulasi kasbon aktif)
  - `updateDetailStatusDibayar(detailId: string, status: boolean)` (diperbarui dengan potong cicilan FIFO & rollback cicilan)

- [ ] **Step 1: Implementasi fungsi-fungsi manajemen kasbon di `actions.ts`**

Tambahkan fungsi `tambahKasbon`, `hapusKasbon`, `catatPembayaranTunai`, dan `updatePotonganKasbon`. Pastikan `tambahKasbon` membuat entri expense di `keuangan_club`, `hapusKasbon` menghapus entri terkait di `keuangan_club`, dan `catatPembayaranTunai` membuat entri income di `keuangan_club`.

- [ ] **Step 2: Update `generatePayroll`**

Ambil data total sisa hutang pelatih aktif saat kalkulasi, hitung default `potongan_kasbon = Math.min(total_payout, sisa_hutang)`, dan simpan `potongan_kasbon` serta `honor_bersih` ke `payroll_details`.

- [ ] **Step 3: Update `updateDetailStatusDibayar`**

Saat `status === true`, jika `potongan_kasbon > 0`, kurangi `sisa_hutang` pelatih (secara FIFO pada kasbon yang belum lunas) dan catat di `pembayaran_kasbon` (`metode: 'potong_honor'`, `payroll_detail_id`). Saat `status === false`, rollback pembayaran kasbon terkait dan kembalikan `sisa_hutang`.

- [ ] **Step 4: Verifikasi kompilasi TypeScript**

Jalankan `npx tsc --noEmit` untuk memastikan semua parameter dan query Supabase valid.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/honor/actions.ts
git commit -m "feat(honor): implement kasbon server actions and payroll deduction sync"
```

---

### Task 4: Halaman Admin Honor (`/admin/honor`) — Tab Kasbon & Kolom Potongan

**Files:**
- Modify: `src/app/admin/honor/page.tsx`

**Interfaces:**
- Consumes: Server actions dari Task 3, `PayrollDetail`, `KasbonPelatih`, `PembayaranKasbon`.
- Produces:
  - Tab switcher: "🏆 Payroll Bulanan" & "💳 Kelola Kasbon Pelatih"
  - Tabel Payroll dengan kolom Honor Kotor, Potongan Kasbon (bisa diedit lewat modal/input inline), dan Honor Bersih
  - Kartu Ringkasan Kasbon Aktif, Kasbon Lunas, Pelatih Terlibat
  - Modal Tambah Kasbon Baru
  - Modal Catat Bayar Tunai
  - Modal Riwayat Pembayaran Kasbon
  - Aksi Hapus Kasbon (validasi: jika belum ada cicilan)

- [ ] **Step 1: Buat state & tabs navigasi di `page.tsx`**

Tambahkan tab state (`tab: 'payroll' | 'kasbon'`), state data kasbon, riwayat, dan modal state.

- [ ] **Step 2: Tampilkan kolom Potongan Kasbon & Honor Bersih pada Tab Payroll**

Tampilkan honor kotor, potongan kasbon, dan honor bersih. Berikan tombol edit potongan kasbon jika pelatih memiliki kasbon aktif.

- [ ] **Step 3: Implementasikan Tab Kelola Kasbon Pelatih**

Bangun ringkasan statistik kasbon, tabel kasbon, modal tambah kasbon, modal bayar tunai, dan modal riwayat pembayaran cicilan.

- [ ] **Step 4: Verifikasi build dan tampilan**

Jalankan `npx tsc --noEmit` untuk memastikan tidak ada kesalahan compile.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/honor/page.tsx
git commit -m "feat(admin-honor): add kasbon management tab and payroll deduction editing"
```

---

### Task 5: Integrasi Kas Riil di Keuangan Club, Dashboard, & Laporan

**Files:**
- Modify: `src/app/admin/keuangan/page.tsx`
- Modify: `src/app/admin/dashboard/page.tsx`
- Modify: `src/app/admin/laporan/page.tsx`

**Interfaces:**
- Consumes: `honor_bersih` dari `payroll_details`, transaksi kategori `Kasbon Pelatih` dan `Pelunasan Kasbon` dari `keuangan_club`.
- Produces: Sinkronisasi pengeluaran kas klub menggunakan honor bersih dan pengenalan sumber `'kasbon'`.

- [ ] **Step 1: Update `src/app/admin/keuangan/page.tsx`**

Tambahkan sumber `'kasbon'` ke tipe `Sumber` dan `SUMBER_CONFIG`. Update pemetaan pengeluaran honor agar menggunakan `total = Number(h.honor_bersih ?? h.total_payout)`. Update filter sumber transaksi agar menyertakan kasbon.

- [ ] **Step 2: Update `src/app/admin/dashboard/page.tsx`**

Perbarui perhitungan pengeluaran honor pada `stats.expense` agar menggunakan `h.honor_bersih ?? h.total_payout`.

- [ ] **Step 3: Update `src/app/admin/laporan/page.tsx`**

Perbarui perhitungan `pengeluaranHonor` agar menggunakan `Number(d.honor_bersih ?? d.total_payout || 0)`.

- [ ] **Step 4: Verifikasi TypeScript & Build**

Jalankan `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/keuangan/page.tsx src/app/admin/dashboard/page.tsx src/app/admin/laporan/page.tsx
git commit -m "feat(keuangan): sync net honor payout and kasbon transactions across finance, dashboard, and reports"
```

---

### Task 6: Slip Honor Pelatih Transparan (`/pelatih/honor`)

**Files:**
- Modify: `src/app/pelatih/honor/page.tsx`

**Interfaces:**
- Consumes: `payroll_details` (`potongan_kasbon`, `honor_bersih`), `kasbon_pelatih`.
- Produces: Tampilan slip honor transparan dengan rincian potongan hutang & kartu status sisa kasbon aktif pelatih.

- [ ] **Step 1: Update fetch query di `/pelatih/honor`**

Query `potongan_kasbon` dan `honor_bersih` dari `payroll_details`. Query juga data `kasbon_pelatih` aktif milik pelatih yang sedang login.

- [ ] **Step 2: Tampilkan rincian potongan di slip honor & kartu sisa kasbon aktif**

Tambahkan baris rincian potongan kasbon (warna merah lembut) dan total bersih yang diterima (warna hijau). Jika ada kasbon yang belum lunas, tampilkan kartu info *"💳 Sisa Tanggungan Kasbon"* dengan sisa hutang dan riwayat singkat.

- [ ] **Step 3: Verifikasi TypeScript & Build**

Jalankan `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add src/app/pelatih/honor/page.tsx
git commit -m "feat(pelatih-honor): display transparent loan deduction and active loan balance on coach payslip"
```

---

### Task 7: Verifikasi End-to-End & Build Validation

**Files:**
- All modified files

- [ ] **Step 1: Jalankan `npx tsc --noEmit`**

Pastikan nol error TypeScript.

- [ ] **Step 2: Jalankan `npm run build`**

Pastikan seluruh halaman berhasil dioptimasi dan dibundle tanpa kegagalan.

- [ ] **Step 3: Final commit & status check**

Pastikan repository git bersih dan semua perubahan telah ter-commit rapi.
