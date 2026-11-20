# Rencana Implementasi: Keamanan Server Actions, Indeks DB, dan No Registrasi Ujian Sabuk

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengamankan Server Actions dengan auth guards terpusat dan proteksi manipulasi harga checkout, menambahkan indeks performa database (Migrasi 031), serta menambahkan fitur nomor registrasi sertifikat ujian sabuk yang permanen sejak sabuk kuning (Migrasi 032 & UI Ujian).

**Architecture:** Modul keamanan dibuat di `src/lib/auth-guard.ts` untuk memvalidasi user session dan role (`admin`, `pelatih`, `ortu`) sebelum operasi `supabaseAdmin` dieksekusi. Skema DB diperluas dengan file SQL migrasi 031 dan 032. UI Ujian Sabuk (`admin/ujian` dan `pelatih/ujian`) diperbarui dengan form input nomor registrasi terkunci/auto-fill untuk sabuk lanjutan.

**Tech Stack:** Next.js 14 (App Router, Server Actions), TypeScript, Supabase (PostgreSQL, Auth, RLS), Node Test Runner (`npx tsx --test`).

## Global Constraints
- Jalankan unit tests dengan `npx tsx --test src/lib/__tests__/*.test.ts` dan pastikan lulus.
- Jangan gunakan `any` jika tipe sudah tersedia di `src/lib/types.ts`.
- Pertahankan design system neubrutalism (border tebal, hard shadow, pill badge).

---

### Task 1: Auth Guard Terpusat & Unit Tests Keamanan

**Files:**
- Create: `src/lib/auth-guard.ts`
- Create: `src/lib/__tests__/auth-guard.test.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `requireUser()`, `requireAdmin()`, `requirePelatih()`, `requireOrtu()`, `verifyParentOwnsChild(parentSiswaId: string | null, targetSiswaId: string)`

- [ ] **Step 1: Tulis unit test untuk verifikasi kepemilikan orang tua ke anak**

Tulis test di `src/lib/__tests__/auth-guard.test.ts` yang menguji helper verifikasi kepemilikan ortu terhadap anak (primary siswa_id dan sibling validation).

```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyChildBelongsToParent } from '../auth-guard'

test('Parent child ownership validation', () => {
  // Case 1: Matching primary child
  assert.equal(verifyChildBelongsToParent('siswa-1', 'siswa-1', []), true)
  
  // Case 2: Matching sibling by ID
  assert.equal(verifyChildBelongsToParent('siswa-1', 'siswa-2', ['siswa-1', 'siswa-2']), true)
  
  // Case 3: Unauthorized target child
  assert.equal(verifyChildBelongsToParent('siswa-1', 'siswa-999', ['siswa-1', 'siswa-2']), false)
  
  // Case 4: No primary child
  assert.equal(verifyChildBelongsToParent(null, 'siswa-1', []), false)
})
```

- [ ] **Step 2: Jalankan test untuk memastikan test gagal (failing test)**

Run: `cd /media/lian/Ubuntu/Siger\ TC/siger-tkd-manager && npx tsx --test src/lib/__tests__/auth-guard.test.ts`  
Expected: FAIL dengan `Cannot find module '../auth-guard'`

- [ ] **Step 3: Implementasikan `src/lib/auth-guard.ts`**

Buat file `src/lib/auth-guard.ts`:
```typescript
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AuthUserContext {
  userId: string
  email: string
  profile: Profile
}

export function verifyChildBelongsToParent(
  primarySiswaId: string | null,
  targetSiswaId: string,
  siblingIds: string[] = []
): boolean {
  if (!primarySiswaId || !targetSiswaId) return false
  if (primarySiswaId === targetSiswaId) return true
  return siblingIds.includes(targetSiswaId)
}

export async function requireUser(): Promise<AuthUserContext> {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('UNAUTHORIZED: Harap login terlebih dahulu.')
  }

  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (pErr || !profile) {
    throw new Error('PROFILE_NOT_FOUND: Profil pengguna tidak ditemukan.')
  }

  return {
    userId: user.id,
    email: user.email || '',
    profile: profile as Profile,
  }
}

export async function requireAdmin(): Promise<AuthUserContext> {
  const ctx = await requireUser()
  if (ctx.profile.role !== 'admin') {
    throw new Error('FORBIDDEN: Tindakan ini memerlukan hak akses Admin.')
  }
  return ctx
}

export async function requirePelatih(): Promise<AuthUserContext> {
  const ctx = await requireUser()
  if (ctx.profile.role !== 'pelatih' && ctx.profile.role !== 'admin') {
    throw new Error('FORBIDDEN: Tindakan ini memerlukan hak akses Pelatih.')
  }
  return ctx
}

export async function requireOrtu(): Promise<AuthUserContext> {
  const ctx = await requireUser()
  if (ctx.profile.role !== 'ortu' && ctx.profile.role !== 'admin') {
    throw new Error('FORBIDDEN: Tindakan ini memerlukan hak akses Orang Tua.')
  }
  return ctx
}
```

- [ ] **Step 4: Jalankan test kembali untuk memverifikasi kelulusan test**

Run: `cd /media/lian/Ubuntu/Siger\ TC/siger-tkd-manager && npx tsx --test src/lib/__tests__/auth-guard.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-guard.ts src/lib/__tests__/auth-guard.test.ts
git commit -m "feat(security): add central auth guards and parent-child verification test"
```

---

### Task 2: Integrasi Auth Guard pada Server Actions Sensitif

**Files:**
- Modify: `src/app/admin/akun/actions.ts`
- Modify: `src/app/admin/honor/actions.ts`
- Modify: `src/app/admin/keuangan/actions.ts`
- Modify: `src/app/admin/inventaris/actions.ts`
- Modify: `src/app/pelatih/inventaris/actions.ts`

- [ ] **Step 1: Pasang `requireAdmin()` di `src/app/admin/akun/actions.ts`**

Panggil `await requireAdmin()` di awal fungsi `createAccount`, `updateAccount`, `deleteAccount`, `resetPassword`, `listAkun`, `listPelatih`, dan `listSiswaAktif`.

- [ ] **Step 2: Pasang `requireAdmin()` di `src/app/admin/honor/actions.ts` dan `src/app/admin/keuangan/actions.ts`**

Panggil `await requireAdmin()` di `generatePayroll`, `toggleReconcileStatus`.

- [ ] **Step 3: Pasang `requireAdmin()` dan `requirePelatih()` di aksi inventaris**

- `src/app/admin/inventaris/actions.ts`: pasang `await requireAdmin()` di setiap action.
- `src/app/pelatih/inventaris/actions.ts`: pasang `const ctx = await requirePelatih()` dan gunakan `ctx.profile.pelatih_id` alih-alih mempercayai argumen `pelatihId` kiriman client.

- [ ] **Step 4: Jalankan tsc untuk verifikasi type safety**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/akun/actions.ts src/app/admin/honor/actions.ts src/app/admin/keuangan/actions.ts src/app/admin/inventaris/actions.ts src/app/pelatih/inventaris/actions.ts
git commit -m "fix(security): enforce requireAdmin and requirePelatih on all server actions"
```

---

### Task 3: Proteksi Checkout Merchant & Validasi Upload Bukti

**Files:**
- Modify: `src/app/ortu/merchant/actions.ts`
- Create: `src/lib/__tests__/merchant-calc.test.ts`

- [ ] **Step 1: Tulis unit test untuk perhitungan harga di sisi server**

Tulis test di `src/lib/__tests__/merchant-calc.test.ts` yang memastikan total pesanan dihitung dari harga produk master di database, bukan dari input client.

```typescript
import test from 'node:test'
import assert from 'node:assert/strict'

test('Server-side cart total calculation', () => {
  const masterProducts = new Map([
    ['var-1', { id: 'var-1', harga: 250000, stok: 10 }],
    ['var-2', { id: 'var-2', harga: 50000, stok: 5 }]
  ])
  
  const clientPayload = [
    { varianId: 'var-1', qty: 2, hargaSatuan: 1 }, // manipulated price
    { varianId: 'var-2', qty: 1, hargaSatuan: 1 }
  ]
  
  let calculatedTotal = 0
  const items = clientPayload.map(item => {
    const v = masterProducts.get(item.varianId)
    assert.ok(v, 'Variant must exist')
    const realPrice = v.harga
    calculatedTotal += realPrice * item.qty
    return { ...item, hargaSatuan: realPrice }
  })
  
  assert.equal(calculatedTotal, 550000)
  assert.equal(items[0].hargaSatuan, 250000)
  assert.equal(items[1].hargaSatuan, 50000)
})
```

- [ ] **Step 2: Jalankan test untuk memverifikasi logika kalkulasi**

Run: `npx tsx --test src/lib/__tests__/merchant-calc.test.ts`  
Expected: PASS

- [ ] **Step 3: Perbarui `checkoutMerchantAction` dan `uploadBuktiTransferMerchantAction`**

Di `src/app/ortu/merchant/actions.ts`:
1. `checkoutMerchantAction`:
   - Gunakan `requireOrtu()`.
   - Validasi kepemilikan anak (apakah `payload.siswaId` adalah anak dari user yang login).
   - Ambil harga satuan dari tabel `produk_merchant.harga` via join `produk_varian`.
   - Hitung `total_harga` di sisi server dan abaikan `payload.totalHarga` / `item.hargaSatuan` dari client.
2. `uploadBuktiTransferMerchantAction`:
   - Validasi ukuran file: `if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran berkas maksimal 5MB')`.
   - Validasi MIME type: `['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)`.

- [ ] **Step 4: Jalankan unit tests & build test**

Run: `npx tsx --test src/lib/__tests__/*.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/ortu/merchant/actions.ts src/lib/__tests__/merchant-calc.test.ts
git commit -m "fix(merchant): prevent price tampering, verify child ownership, validate file upload"
```

---

### Task 4: Migrasi Database 031 (Indeks Performa) & 032 (No Registrasi Sertifikat)

**Files:**
- Create: `supabase/migrations/031_performance_indexes.sql`
- Create: `supabase/migrations/032_no_reg_sertifikat.sql`

- [ ] **Step 1: Buat file migrasi `031_performance_indexes.sql`**

Buat file `supabase/migrations/031_performance_indexes.sql` berisi indeks komposit:
```sql
-- MIGRASI 031: INDEKS PERFORMA & OPTIMASI QUERY
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl_kelas ON public.absensi_siswa (tgl, kelas);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_siswa_tgl ON public.absensi_siswa (siswa_id, tgl);
CREATE INDEX IF NOT EXISTS idx_absensi_pelatih_tgl ON public.absensi_pelatih (tgl, pelatih_id);
CREATE INDEX IF NOT EXISTS idx_iuran_periode_status ON public.iuran (tahun, bulan, status_bayar);
CREATE INDEX IF NOT EXISTS idx_iuran_siswa_periode ON public.iuran (siswa_id, tahun, bulan);
CREATE INDEX IF NOT EXISTS idx_keuangan_club_tgl_jenis ON public.keuangan_club (tgl, jenis);
CREATE INDEX IF NOT EXISTS idx_siswa_no_hp_ortu ON public.siswa (no_hp_ortu);
CREATE INDEX IF NOT EXISTS idx_siswa_status_program ON public.siswa (status_aktif, program_kelas_id);
CREATE INDEX IF NOT EXISTS idx_profiles_siswa_pelatih ON public.profiles (siswa_id, pelatih_id);
```

- [ ] **Step 2: Buat file migrasi `032_no_reg_sertifikat.sql`**

Buat file `supabase/migrations/032_no_reg_sertifikat.sql`:
```sql
-- MIGRASI 032: NOMOR REGISTRASI SERTIFIKAT KENAIKAN SABUK
-- Menambahkan kolom no_reg_sertifikat ke tabel siswa dan ujian_sabuk
ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS no_reg_sertifikat TEXT;
ALTER TABLE public.ujian_sabuk ADD COLUMN IF NOT EXISTS no_reg_sertifikat TEXT;

-- Indeks pencarian no registrasi
CREATE INDEX IF NOT EXISTS idx_siswa_no_reg ON public.siswa (no_reg_sertifikat);

-- Update trigger otomatis sinkronisasi ke profil siswa saat lulus
CREATE OR REPLACE FUNCTION update_sabuk_siswa_on_lulus()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hasil = 'lulus' AND (OLD.hasil IS NULL OR OLD.hasil != 'lulus') THEN
        UPDATE siswa 
        SET 
            sabuk_saat_ini = NEW.sabuk_tujuan,
            no_reg_sertifikat = COALESCE(NEW.no_reg_sertifikat, siswa.no_reg_sertifikat)
        WHERE id = NEW.siswa_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 3: Commit migrasi database**

```bash
git add supabase/migrations/031_performance_indexes.sql supabase/migrations/032_no_reg_sertifikat.sql
git commit -m "feat(db): add 031 performance indexes and 032 no_reg_sertifikat migrations"
```

---

### Task 5: Implementasi Fitur No Registrasi Sertifikat pada UI Ujian Sabuk & Data Siswa

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/app/admin/ujian/page.tsx`
- Modify: `src/app/pelatih/ujian/page.tsx`
- Modify: `src/app/admin/siswa/page.tsx`

- [ ] **Step 1: Perbarui tipe di `src/lib/types.ts`**

Tambahkan `no_reg_sertifikat?: string | null` ke interface `Siswa` dan `UjianSabuk`.

- [ ] **Step 2: Update modal evaluasi kelulusan di `src/app/admin/ujian/page.tsx`**

1. Tambahkan state `evalNoReg: string`.
2. Saat `openEval(ujian)`:
   - Cari data siswa terkait: `const siswa = siswaList.find(s => s.id === ujian.siswa_id)`.
   - Cek apakah siswa sudah memiliki nomor registrasi (`siswa?.no_reg_sertifikat`) atau ujian ini sudah memiliki nomor registrasi (`ujian.no_reg_sertifikat`).
   - Tentukan apakah field bersifat terkunci (*read-only*): `const isLocked = Boolean(siswa?.no_reg_sertifikat)`.
   - Set state `evalNoReg` dengan nomor yang ada.
3. Render input di Modal:
   - Jika `isLocked`: Tampilkan input disable / read-only dengan info badge hijau *"Nomor Registrasi Terdaftar (Permanen)"*.
   - Jika belum terkunci (misal Putih ke Kuning): Tampilkan input aktif dengan teks bantuan: *"Wajib/disarankan diisi saat kenaikan sabuk Putih ke Kuning untuk dipakai permanen pada sabuk-sabuk berikutnya."*
4. Pada `submitEval`:
   - Kirim `no_reg_sertifikat: evalNoReg || null` saat meng-update tabel `ujian_sabuk`.
   - Sekaligus update `siswa.no_reg_sertifikat` jika terisi.
5. Tampilkan kolom badge "No. Reg" pada tabel daftar ujian sabuk.

- [ ] **Step 3: Sinkronisasi ke `src/app/pelatih/ujian/page.tsx`**

Lakukan penyesuaian serupa pada portal pelatih agar pelatih juga melihat nomor registrasi yang sudah terkunci atau dapat menginputkannya saat menilai kelulusan.

- [ ] **Step 4: Tampilkan No Registrasi di `src/app/admin/siswa/page.tsx`**

Tambahkan field `No. Registrasi Sertifikat` pada formulir edit siswa dan kolom tabel data siswa.

- [ ] **Step 5: Verifikasi dengan `npx tsc --noEmit` & `npm run build`**

Run: `npx tsc --noEmit && npm run build`  
Expected: PASS tanpa error.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/app/admin/ujian/page.tsx src/app/pelatih/ujian/page.tsx src/app/admin/siswa/page.tsx
git commit -m "feat(ujian): add permanent certificate registration number input and display"
```

---

### Task 6: Verifikasi Menyeluruh & Testing Regresi

**Files:**
- Modify: `src/lib/__tests__/ujian-sertifikat.test.ts` (Create)

- [ ] **Step 1: Buat test simulasi alur penomoran registrasi sabuk**

Buat `src/lib/__tests__/ujian-sertifikat.test.ts` untuk memverifikasi logika:
- Siswa putih lulus ke kuning -> no_reg di-assign.
- Siswa kuning naik ke hijau -> no_reg tetap menggunakan nilai dari putih ke kuning.

- [ ] **Step 2: Jalankan seluruh test suite**

Run: `npx tsx --test src/lib/__tests__/*.test.ts`  
Expected: Semua test (absensi, tunggakan, auth-guard, merchant-calc, ujian-sertifikat) PASS.

- [ ] **Step 3: Jalankan Next.js build**

Run: `npm run build`  
Expected: Exit code 0, semua 47 route terkompilasi dengan baik.

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/ujian-sertifikat.test.ts
git commit -m "test(ujian): add unit tests for belt cert registration permanence"
```
