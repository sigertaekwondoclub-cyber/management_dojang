# Sinkronisasi Otomatis Iuran & Perhitungan Keuangan Status Siswa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan sinkronisasi otomatis status aktif/nonaktif dan pergantian kelas siswa terhadap tagihan iuran bulanan dan perhitungan keuangan/honor, sehingga tagihan anggota tidak aktif otomatis dibatalkan/tidak dihitung dan perubahan kelas otomatis memperbarui nominal iuran.

**Architecture:** Pendekatan Hybrid: PostgreSQL database trigger pada tabel `siswa` (`AFTER UPDATE OR INSERT`) yang secara otomatis menghapus/memperbarui tagihan iuran belum bayar, didukung oleh UI Admin Siswa, utilitas pembersihan di Generate Iuran, serta audit filter pada Dashboard, Laporan, dan Estimasi Pelatih.

**Tech Stack:** Supabase (PostgreSQL 15 PL/pgSQL triggers), Next.js 14 App Router, TypeScript, Tailwind CSS.

---

### Task 1: Database Migration Trigger Sinkronisasi Siswa-Iuran

**Files:**
- Create: `supabase/migrations/025_auto_sync_siswa_iuran.sql`

**Interfaces:**
- Produces: Trigger `trg_sync_siswa_iuran` on table `public.siswa` executing `public.sync_siswa_iuran_on_change()`.

- [ ] **Step 1: Tulis file migrasi SQL `025_auto_sync_siswa_iuran.sql`**

```sql
-- Migration 025: Auto sync iuran bulanan & keuangan saat siswa berubah status atau kelas

-- 1. Buat fungsi trigger untuk sinkronisasi otomatis
CREATE OR REPLACE FUNCTION public.sync_siswa_iuran_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_biaya_bulanan NUMERIC;
    v_curr_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
    v_curr_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_has_current_iuran BOOLEAN;
BEGIN
    -- Skenario A: Siswa diubah menjadi NONAKTIF (status_aktif = false)
    IF (TG_OP = 'UPDATE' AND OLD.status_aktif = true AND NEW.status_aktif = false) OR
       (TG_OP = 'INSERT' AND NEW.status_aktif = false) THEN
        -- Hapus semua tagihan iuran yang belum lunas (belum_bayar atau ditolak)
        -- Tagihan yang lunas dan menunggu_verifikasi tetap dipertahankan sebagai bukti pembayaran
        DELETE FROM public.iuran
        WHERE siswa_id = NEW.id
          AND status_bayar IN ('belum_bayar', 'ditolak');
          
        RETURN NEW;
    END IF;

    -- Skenario B: Siswa diaktifkan kembali (status_aktif: false -> true)
    IF (TG_OP = 'UPDATE' AND OLD.status_aktif = false AND NEW.status_aktif = true) THEN
        -- Cek apakah sudah ada tagihan di bulan berjalan
        SELECT EXISTS (
            SELECT 1 FROM public.iuran
            WHERE siswa_id = NEW.id
              AND bulan = v_curr_month
              AND tahun = v_curr_year
        ) INTO v_has_current_iuran;

        -- Jika belum ada tagihan dan siswa memiliki program kelas, buatkan tagihan bulan ini
        IF NOT v_has_current_iuran AND NEW.program_kelas_id IS NOT NULL THEN
            SELECT COALESCE(biaya_bulanan, 100000) INTO v_biaya_bulanan
            FROM public.program_kelas
            WHERE id = NEW.program_kelas_id;

            INSERT INTO public.iuran (siswa_id, bulan, tahun, nominal, status_bayar)
            VALUES (NEW.id, v_curr_month, v_curr_year, COALESCE(v_biaya_bulanan, 100000), 'belum_bayar');
        END IF;

        RETURN NEW;
    END IF;

    -- Skenario C: Siswa AKTIF berganti program_kelas_id
    IF (TG_OP = 'UPDATE' AND NEW.status_aktif = true AND NEW.program_kelas_id IS DISTINCT FROM OLD.program_kelas_id) THEN
        IF NEW.program_kelas_id IS NOT NULL THEN
            SELECT COALESCE(biaya_bulanan, 100000) INTO v_biaya_bulanan
            FROM public.program_kelas
            WHERE id = NEW.program_kelas_id;

            -- Perbarui nominal tagihan belum bayar sesuai tarif kelas baru
            UPDATE public.iuran
            SET nominal = COALESCE(v_biaya_bulanan, 100000)
            WHERE siswa_id = NEW.id
              AND status_bayar IN ('belum_bayar', 'ditolak');
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Pasang trigger pada tabel siswa
DROP TRIGGER IF EXISTS trg_sync_siswa_iuran ON public.siswa;
CREATE TRIGGER trg_sync_siswa_iuran
AFTER INSERT OR UPDATE OF status_aktif, program_kelas_id ON public.siswa
FOR EACH ROW
EXECUTE FUNCTION public.sync_siswa_iuran_on_change();

-- 3. Pembersihan satu kali (One-time cleanup) untuk tagihan belum bayar milik siswa yang saat ini sudah nonaktif
DELETE FROM public.iuran
WHERE siswa_id IN (SELECT id FROM public.siswa WHERE status_aktif = false)
  AND status_bayar IN ('belum_bayar', 'ditolak');
```

- [ ] **Step 2: Validasi sintaks SQL migrasi**

Run: `cat supabase/migrations/025_auto_sync_siswa_iuran.sql`
Expected: File terbaca utuh dan sintaks PostgreSQL valid.

- [ ] **Step 3: Commit migrasi database**

```bash
git add supabase/migrations/025_auto_sync_siswa_iuran.sql
git commit -m "feat(db): add trigger 025 to auto sync iuran on siswa status/class change"
```

---

### Task 2: Pembaruan Modul Admin Siswa (`src/app/admin/siswa/page.tsx`)

**Files:**
- Modify: `src/app/admin/siswa/page.tsx`

**Interfaces:**
- Consumes: `supabase.from('siswa').update(...)`, `supabase.from('iuran')`.
- Produces: Updated user feedback & instant client sync during student form save.

- [ ] **Step 1: Perbarui logika `handleSubmit` di `src/app/admin/siswa/page.tsx`**

Perbarui blok penyimpanan siswa pada `src/app/admin/siswa/page.tsx`:
1. Jika status aktif di-uncheck (`payload.status_aktif === false`), berikan pesan feedback yang jelas: `"Data siswa berhasil diperbarui. Tagihan bulanan yang belum dibayar otomatis dibatalkan."`
2. Tambahkan pembersihan eksplisit di client sebagai fallback instan:
```typescript
if (editingId && payload.status_aktif === false) {
  await supabase
    .from('iuran')
    .delete()
    .eq('siswa_id', editingId)
    .in('status_bayar', ['belum_bayar', 'ditolak'])
}
```
3. Jika status aktif dicentang (`payload.status_aktif === true`) dan berganti kelas, sinkronkan nominal tagihan belum bayar ke tarif baru.

- [ ] **Step 2: Uji kompilasi kode `admin/siswa`**

Run: `npx tsc --noEmit`
Expected: 0 error pada `src/app/admin/siswa/page.tsx`.

- [ ] **Step 3: Commit perubahan**

```bash
git add src/app/admin/siswa/page.tsx
git commit -m "feat(siswa): handle automatic iuran cancellation on inactive status"
```

---

### Task 3: Pembaruan Modul Generate & Sinkron Iuran (`src/app/admin/iuran/generate/page.tsx`)

**Files:**
- Modify: `src/app/admin/iuran/generate/page.tsx`

**Interfaces:**
- Consumes: `supabase.from('iuran')`, `supabase.from('siswa')`.
- Produces: Visual alert and one-click cleanup for orphan/inactive students' unpaid bills.

- [ ] **Step 1: Tambahkan deteksi dan pembersihan tagihan siswa nonaktif**

Di `src/app/admin/iuran/generate/page.tsx`:
1. Tambahkan state `inactiveWithIuranList: { id: string, siswa_nama: string, nominal: number }[]`.
2. Di `checkSiswaWithoutIuran`:
   - Ambil juga tagihan di bulan/tahun terpilih dengan `status_bayar IN ('belum_bayar', 'ditolak')` yang siswanya `status_aktif = false`.
   - Simpan ke `inactiveWithIuranList`.
3. Tambahkan fungsi `handleCleanupInactiveBills`:
   - Menghapus iuran belum bayar milik siswa nonaktif tersebut dan me-refresh data.
4. Tampilkan kartu peringatan kuning di UI jika `inactiveWithIuranList.length > 0` dengan tombol "🧹 Bersihkan Tagihan Siswa Nonaktif ({count})".

- [ ] **Step 2: Uji build & TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 type errors.

- [ ] **Step 3: Commit perubahan**

```bash
git add src/app/admin/iuran/generate/page.tsx
git commit -m "feat(iuran): add detection and cleanup tool for inactive student bills"
```

---

### Task 4: Audit & Penyelarasan Perhitungan di Dashboard, Laporan, dan Estimasi Pelatih

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`
- Modify: `src/app/pelatih/estimasi/page.tsx`
- Modify: `src/app/admin/honor/actions.ts`

**Interfaces:**
- Consumes: `siswa(status_aktif)`, `iuran(status_bayar)`.
- Produces: Perfectly consistent stats ignoring inactive students for monthly bill projections.

- [ ] **Step 1: Update Dashboard Admin (`src/app/admin/dashboard/page.tsx`)**

Pastikan query daftar tagihan belum bayar dan total potensi iuran bulanan:
- Query `iuran`: join `siswa:siswa_id!inner(nama, status_aktif)` dengan filter `.eq('siswa.status_aktif', true)` untuk tagihan belum bayar, atau filter di memori `i.siswa?.status_aktif !== false` agar tagihan siswa nonaktif tidak dihitung sebagai tunggakan aktif.

- [ ] **Step 2: Verifikasi Estimasi Pelatih (`src/app/pelatih/estimasi/page.tsx`) & Payroll (`src/app/admin/honor/actions.ts`)**

- Pastikan `allActiveStudents` murni `.eq('status_aktif', true)`.
- Pastikan breakdown pendapatan kelas (`classRevenue`) dan jumlah kuota siswa per kelas hanya menghitung siswa dengan `status_aktif = true`.

- [ ] **Step 3: Uji build aplikasi**

Run: `npm run build`
Expected: Next.js build sukses tanpa error type / compilation.

- [ ] **Step 4: Commit perubahan**

```bash
git add src/app/admin/dashboard/page.tsx src/app/pelatih/estimasi/page.tsx src/app/admin/honor/actions.ts
git commit -m "fix(finance): ensure all financial summaries exclude inactive student bills"
```

---

### Task 5: Pengujian Menyeluruh (Verification & End-to-End Validation)

**Files:**
- Test / Verify all touched components.

- [ ] **Step 1: Jalankan `npm run build` untuk memverifikasi seluruh modul web**
Run: `npm run build`
Expected: Successful production build.

- [ ] **Step 2: Review perubahan git diff untuk memastikan tidak ada regresi**
Run: `git diff HEAD~4 --stat`
Expected: Perubahan rapi dan terarah pada migrasi SQL, form siswa, generate iuran, dan dashboard.
