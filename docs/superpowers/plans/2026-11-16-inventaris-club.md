# Fitur Inventaris Club Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun sistem inventaris club Siger TC komprehensif untuk mencatat master aset alat latihan, kondisi fisik (baik/rusak), pencatatan pembelian baru yang otomatis terintegrasi ke kas pengeluaran club (`keuangan_club`), sirkulasi peminjaman alat, serta pengajuan kebutuhan alat baru oleh pelatih.

**Architecture:** Next.js 14 App Router dengan arsitektur Server Actions, Supabase PostgreSQL dengan skema tabel terisolasi, trigger perhitungan kuantitas otomatis, serta kebijakan Row Level Security (RLS) berbasis role (`admin` & `pelatih`).

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS (Neo-brutalist / retro pixel theme), Supabase Client & PostgreSQL.

## Global Constraints

- Tema UI wajib konsisten dengan gaya Siger TC: `border-[3px] border-dark`, bayangan `shadow-[3px_3px_0px_#1E2A38]`, font pixel (`font-pixel`), dan palet warna (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-white`, `text-dark`).
- Setiap transaksi pengadaan yang mengaktifkan sinkronisasi kas wajib mencatat baris pengeluaran baru di `keuangan_club` (`jenis: 'expense'`, `kategori: 'Pengadaan Alat & Inventaris'`) dan menyimpan referensi `keuangan_id`.
- Penghapusan atau pembatalan pembelian alat wajib membersihkan catatan di `keuangan_club` dan mengembalikan stok master barang.
- Seluruh input numerik (jumlah, harga, kondisi) wajib divalidasi tidak boleh bernilai negatif (`>= 0`).
- Validasi peminjaman alat: jumlah pinjam tidak boleh melebihi stok yang tersedia di dojang (`(kondisi_baik + kondisi_rusak_ringan) - stok_dipinjam`).

---

### Task 1: Database Migration & Schema Setup

**Files:**
- Create: `siger-tkd-manager/supabase/migrations/029_inventaris_club.sql`

**Interfaces:**
- Produces: 4 tabel Supabase (`inventaris_barang`, `inventaris_pembelian`, `inventaris_peminjaman`, `inventaris_pengajuan`), trigger `trg_calc_total_stok_inventaris`, serta kebijakan RLS untuk Admin dan Pelatih.

- [ ] **Step 1: Write migration SQL file**

Buat file migrasi `siger-tkd-manager/supabase/migrations/029_inventaris_club.sql` dengan DDL lengkap:

```sql
-- =====================================================
-- MIGRASI 029: FITUR INVENTARIS CLUB SIGER TC
-- =====================================================

-- 1. TABEL: inventaris_barang (Master Alat & Stok Kondisi)
CREATE TABLE IF NOT EXISTS inventaris_barang (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kode_barang TEXT UNIQUE NOT NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL CHECK (kategori IN (
        'Target & Kicking',
        'Proteksi & Sparring',
        'Fasilitas Dojang',
        'Elektronik & Scoring',
        'Lainnya'
    )),
    total_stok INT NOT NULL DEFAULT 0 CHECK (total_stok >= 0),
    kondisi_baik INT NOT NULL DEFAULT 0 CHECK (kondisi_baik >= 0),
    kondisi_rusak_ringan INT NOT NULL DEFAULT 0 CHECK (kondisi_rusak_ringan >= 0),
    kondisi_rusak_berat INT NOT NULL DEFAULT 0 CHECK (kondisi_rusak_berat >= 0),
    stok_dipinjam INT NOT NULL DEFAULT 0 CHECK (stok_dipinjam >= 0),
    lokasi_penyimpanan TEXT NOT NULL DEFAULT 'Dojang Utama',
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger untuk sinkronisasi total_stok otomatis
CREATE OR REPLACE FUNCTION trg_sync_total_stok_inventaris()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_stok := NEW.kondisi_baik + NEW.kondisi_rusak_ringan + NEW.kondisi_rusak_berat;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_total_stok_inventaris ON inventaris_barang;
CREATE TRIGGER trg_calc_total_stok_inventaris
BEFORE INSERT OR UPDATE ON inventaris_barang
FOR EACH ROW
EXECUTE FUNCTION trg_sync_total_stok_inventaris();

-- 2. TABEL: inventaris_pembelian (Log Pengadaan Baru)
CREATE TABLE IF NOT EXISTS inventaris_pembelian (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barang_id UUID REFERENCES inventaris_barang(id) ON DELETE SET NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL,
    tgl_beli DATE NOT NULL,
    jumlah INT NOT NULL CHECK (jumlah > 0),
    harga_satuan NUMERIC NOT NULL CHECK (harga_satuan >= 0),
    total_biaya NUMERIC NOT NULL CHECK (total_biaya >= 0),
    toko_vendor TEXT,
    catat_ke_kas BOOLEAN NOT NULL DEFAULT true,
    keuangan_id UUID REFERENCES keuangan_club(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABEL: inventaris_peminjaman (Sirkulasi & Peminjaman)
CREATE TABLE IF NOT EXISTS inventaris_peminjaman (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barang_id UUID NOT NULL REFERENCES inventaris_barang(id) ON DELETE CASCADE,
    pelatih_id UUID REFERENCES pelatih(id) ON DELETE SET NULL,
    nama_peminjam TEXT NOT NULL,
    jumlah INT NOT NULL CHECK (jumlah > 0),
    tgl_pinjam DATE NOT NULL,
    tgl_rencana_kembali DATE NOT NULL,
    tgl_kembali DATE,
    keperluan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'dipinjam' CHECK (status IN ('dipinjam', 'kembali', 'terlambat')),
    catatan_kondisi_kembali TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABEL: inventaris_pengajuan (Usulan Alat dari Pelatih)
CREATE TABLE IF NOT EXISTS inventaris_pengajuan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE CASCADE,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL DEFAULT 'Target & Kicking',
    jumlah INT NOT NULL CHECK (jumlah > 0),
    estimasi_harga NUMERIC DEFAULT 0,
    alasan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
    catatan_admin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE inventaris_barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_pembelian ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_peminjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_pengajuan ENABLE ROW LEVEL SECURITY;

-- Polisi inventaris_barang
DROP POLICY IF EXISTS "Admin full access inventaris_barang" ON inventaris_barang;
CREATE POLICY "Admin full access inventaris_barang"
ON inventaris_barang FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Pelatih view inventaris_barang" ON inventaris_barang;
CREATE POLICY "Pelatih view inventaris_barang"
ON inventaris_barang FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

-- Polisi inventaris_pembelian
DROP POLICY IF EXISTS "Admin full access inventaris_pembelian" ON inventaris_pembelian;
CREATE POLICY "Admin full access inventaris_pembelian"
ON inventaris_pembelian FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Polisi inventaris_peminjaman
DROP POLICY IF EXISTS "Admin full access inventaris_peminjaman" ON inventaris_peminjaman;
CREATE POLICY "Admin full access inventaris_peminjaman"
ON inventaris_peminjaman FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Pelatih view own peminjaman" ON inventaris_peminjaman;
CREATE POLICY "Pelatih view own peminjaman"
ON inventaris_peminjaman FOR SELECT
TO authenticated
USING (
    get_my_role() = 'pelatih' AND (
        pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
        OR created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Pelatih insert peminjaman" ON inventaris_peminjaman;
CREATE POLICY "Pelatih insert peminjaman"
ON inventaris_peminjaman FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih' AND
    created_by = auth.uid()
);

-- Polisi inventaris_pengajuan
DROP POLICY IF EXISTS "Admin full access inventaris_pengajuan" ON inventaris_pengajuan;
CREATE POLICY "Admin full access inventaris_pengajuan"
ON inventaris_pengajuan FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Pelatih select own pengajuan" ON inventaris_pengajuan;
CREATE POLICY "Pelatih select own pengajuan"
ON inventaris_pengajuan FOR SELECT
TO authenticated
USING (
    get_my_role() = 'pelatih' AND
    pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
);

DROP POLICY IF EXISTS "Pelatih insert own pengajuan" ON inventaris_pengajuan;
CREATE POLICY "Pelatih insert own pengajuan"
ON inventaris_pengajuan FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih' AND
    pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
);
```

- [ ] **Step 2: Verify SQL syntax and file creation**

Run: `ls -la siger-tkd-manager/supabase/migrations/029_inventaris_club.sql`
Expected: File exists with correct permissions and full DDL.

- [ ] **Step 3: Commit**

```bash
git add siger-tkd-manager/supabase/migrations/029_inventaris_club.sql
git commit -m "feat(db): add migration 029 for club inventory schema and rls"
```

---

### Task 2: Domain Types & Admin Server Actions

**Files:**
- Modify: `siger-tkd-manager/src/lib/types.ts`
- Create: `siger-tkd-manager/src/app/admin/inventaris/actions.ts`

**Interfaces:**
- Consumes: `supabase/migrations/029_inventaris_club.sql`, `keuangan_club` table.
- Produces: `KategoriInventaris`, `InventarisBarang`, `InventarisPembelian`, `InventarisPeminjaman`, `InventarisPengajuan` types in `src/lib/types.ts`, and server actions: `getAdminInventarisData`, `tambahBarangMaster`, `updateKondisiBarang`, `catatPembelianBaru`, `hapusPembelian`, `catatPeminjamanAdmin`, `kembalikanPeminjaman`, `updateStatusPengajuan`.

- [ ] **Step 1: Add types to `src/lib/types.ts`**

Tambahkan interface inventaris berikut ke `siger-tkd-manager/src/lib/types.ts`:

```typescript
export type KategoriInventaris = 
  | 'Target & Kicking'
  | 'Proteksi & Sparring'
  | 'Fasilitas Dojang'
  | 'Elektronik & Scoring'
  | 'Lainnya'

export interface InventarisBarang {
  id: string
  kode_barang: string
  nama_barang: string
  kategori: KategoriInventaris
  total_stok: number
  kondisi_baik: number
  kondisi_rusak_ringan: number
  kondisi_rusak_berat: number
  stok_dipinjam: number
  lokasi_penyimpanan: string
  keterangan?: string | null
  created_at: string
  updated_at: string
}

export interface InventarisPembelian {
  id: string
  barang_id?: string | null
  nama_barang: string
  kategori: string
  tgl_beli: string
  jumlah: number
  harga_satuan: number
  total_biaya: number
  toko_vendor?: string | null
  catat_ke_kas: boolean
  keuangan_id?: string | null
  created_by?: string | null
  created_at: string
  inventaris_barang?: {
    nama_barang: string
  } | null
}

export interface InventarisPeminjaman {
  id: string
  barang_id: string
  pelatih_id?: string | null
  nama_peminjam: string
  jumlah: number
  tgl_pinjam: string
  tgl_rencana_kembali: string
  tgl_kembali?: string | null
  keperluan: string
  status: 'dipinjam' | 'kembali' | 'terlambat'
  catatan_kondisi_kembali?: string | null
  created_by?: string | null
  created_at: string
  inventaris_barang?: {
    nama_barang: string
    kode_barang: string
  } | null
}

export interface InventarisPengajuan {
  id: string
  pelatih_id: string
  nama_barang: string
  kategori: string
  jumlah: number
  estimasi_harga?: number | null
  alasan: string
  status: 'menunggu' | 'disetujui' | 'ditolak'
  catatan_admin?: string | null
  created_at: string
  updated_at: string
  pelatih?: {
    nama: string
  } | null
}
```

- [ ] **Step 2: Implement server actions in `src/app/admin/inventaris/actions.ts`**

Buat file `siger-tkd-manager/src/app/admin/inventaris/actions.ts`:
- `getAdminInventarisData()`: Fetch semua barang, pembelian, peminjaman, pengajuan, dan daftar pelatih aktif.
- `tambahBarangMaster(data)`: Generate kode `INV-...`, insert ke `inventaris_barang`.
- `updateKondisiBarang(id, { kondisi_baik, kondisi_rusak_ringan, kondisi_rusak_berat, lokasi_penyimpanan, keterangan })`: Update rincian kondisi.
- `catatPembelianBaru(data)`:
  - Validasi jumlah > 0, harga >= 0.
  - Jika barang baru: buat master barang baru dengan `kondisi_baik = jumlah`.
  - Jika barang ada: update master barang `kondisi_baik = kondisi_baik + jumlah`.
  - Jika `catat_ke_kas`: insert ke `keuangan_club` (`jenis: 'expense'`, `kategori: 'Pengadaan Alat & Inventaris'`).
  - Insert ke `inventaris_pembelian`.
- `hapusPembelian(id)`:
  - Kurangi stok barang terkait.
  - Hapus catatan di `keuangan_club` via `keuangan_id`.
  - Hapus dari `inventaris_pembelian`.
- `catatPeminjamanAdmin(data)`:
  - Cek stok tersedia `(kondisi_baik + kondisi_rusak_ringan) - stok_dipinjam`.
  - Update `stok_dipinjam` di master barang.
  - Insert ke `inventaris_peminjaman`.
- `kembalikanPeminjaman(id, { catatan_kondisi_kembali, rusak_ringan_tambah, rusak_berat_tambah })`:
  - Update peminjaman: `status = 'kembali'`, `tgl_kembali = CURRENT_DATE`.
  - Update `stok_dipinjam` di master barang (berkurang).
  - Jika ada kerusakan baru: sesuaikan rasio `kondisi_baik` ke `kondisi_rusak_ringan/berat`.
- `updateStatusPengajuan(id, status, catatan_admin)`:
  - Update status `inventaris_pengajuan`.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors in `src/lib/types.ts` and `src/app/admin/inventaris/actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add siger-tkd-manager/src/lib/types.ts siger-tkd-manager/src/app/admin/inventaris/actions.ts
git commit -m "feat(inventaris): add domain types and admin server actions with cash sync"
```

---

### Task 3: Admin Inventaris UI Page

**Files:**
- Create: `siger-tkd-manager/src/app/admin/inventaris/page.tsx`

**Interfaces:**
- Consumes: Server actions from `src/app/admin/inventaris/actions.ts`, UI components (`Button`, `Card`, `Badge`).
- Produces: Complete admin dashboard at `/admin/inventaris` with 4 pixel-styled tabs:
  1. Tab Katalog Alat (Grid kartu alat, status stok, modal tambah alat, modal sesuaikan kondisi).
  2. Tab Pengadaan & Pembelian (Riwayat pembelian, form pembelian baru dengan toggle sync kas, tombol hapus/batal).
  3. Tab Peminjaman Alat (Filter aktif/selesai, form catat pinjam, dialog konfirmasi pengembalian + cek kondisi kembali).
  4. Tab Pengajuan Pelatih (Review usulan alat, approval, tombol "Setujui & Realisasikan Beli").

- [ ] **Step 1: Create `src/app/admin/inventaris/page.tsx`**

Implementasikan halaman admin inventaris dengan:
- 4 KPI cards di bagian atas:
  - Total Unit Alat (akumulasi)
  - Alat Siap Pakai (kondisi baik)
  - Alat Rusak/Servis (kondisi rusak ringan + berat)
  - Sedang Dipinjam (`stok_dipinjam`)
- Tab switcher (Katalog, Pembelian, Peminjaman, Pengajuan).
- Search & filter berdasarkan kategori alat taekwondo.
- Modal dialog neo-brutalist untuk:
  - Tambah Master Alat
  - Sesuaikan Kondisi Fisik Alat
  - Catat Pembelian Baru (+ switch Catat ke Kas)
  - Catat Peminjaman
  - Pengembalian Alat
  - Tolak Pengajuan Pelatih

- [ ] **Step 2: Test rendering and UI interactions**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add siger-tkd-manager/src/app/admin/inventaris/page.tsx
git commit -m "feat(ui): add admin inventory management page with 4 tabs and kpi cards"
```

---

### Task 4: Pelatih Inventaris Server Actions & UI Page

**Files:**
- Create: `siger-tkd-manager/src/app/pelatih/inventaris/actions.ts`
- Create: `siger-tkd-manager/src/app/pelatih/inventaris/page.tsx`

**Interfaces:**
- Consumes: `inventaris_barang`, `inventaris_peminjaman`, `inventaris_pengajuan` with Pelatih RLS permissions.
- Produces: Server actions (`getPelatihInventarisData`, `ajukanPinjamPelatih`, `ajukanKebutuhanAlat`) and Pelatih portal page at `/pelatih/inventaris`.

- [ ] **Step 1: Create `src/app/pelatih/inventaris/actions.ts`**

Implementasikan server actions untuk pelatih:
- `getPelatihInventarisData()`:
  - Mengambil daftar master alat (katalog ketersediaan siap pakai di dojang).
  - Mengambil daftar peminjaman yang diajukan/dimiliki oleh pelatih yang sedang login.
  - Mengambil daftar pengajuan alat yang dibuat oleh pelatih yang sedang login.
- `ajukanPinjamPelatih(barang_id, jumlah, tgl_pinjam, tgl_rencana_kembali, keperluan)`:
  - Cek ketersediaan stok dojang.
  - Insert ke `inventaris_peminjaman` dan update `stok_dipinjam` di master.
- `ajukanKebutuhanAlat(nama_barang, kategori, jumlah, estimasi_harga, alasan)`:
  - Insert ke `inventaris_pengajuan`.

- [ ] **Step 2: Create `src/app/pelatih/inventaris/page.tsx`**

Implementasikan halaman pelatih `/pelatih/inventaris`:
- Tab 1: **Ketersediaan Alat**:
  - Tampilan kartu visual alat latihan: nama, kategori, jumlah unit siap pakai di dojang, tombol cepat "Pinjam".
- Tab 2: **Peminjaman Saya**:
  - Modal form pinjam alat (pilih alat, jumlah, tanggal rencana kembali, keperluan event/latihan).
  - Daftar alat yang sedang dibawa oleh pelatih dengan status & highlight jika melewati tanggal kembali.
- Tab 3: **Ajukan Kebutuhan Alat**:
  - Modal form usulan alat baru.
  - Daftar riwayat usulan beserta status dari admin (*Menunggu / Disetujui / Ditolak* dan catatan admin).

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add siger-tkd-manager/src/app/pelatih/inventaris/actions.ts siger-tkd-manager/src/app/pelatih/inventaris/page.tsx
git commit -m "feat(pelatih): add coach inventory page with stock view, borrowing, and requests"
```

---

### Task 5: Navigation & Menu Integration

**Files:**
- Modify: `siger-tkd-manager/src/app/admin/layout.tsx:48-66`
- Modify: `siger-tkd-manager/src/app/pelatih/layout.tsx:63-71`

**Interfaces:**
- Consumes: routes `/admin/inventaris` dan `/pelatih/inventaris`.
- Produces: Entry menu `📦 Inventaris Alat` pada Admin Sidebar, Admin Mobile Drawer, Pelatih Sidebar, dan Pelatih Mobile Drawer.

- [ ] **Step 1: Update `src/app/admin/layout.tsx`**

Tambahkan item navigasi inventaris:
```typescript
{ label: '📦 Inventaris Alat', path: '/admin/inventaris' },
```
di letak yang strategis (setelah Keuangan / Merchant).

- [ ] **Step 2: Update `src/app/pelatih/layout.tsx`**

Tambahkan item navigasi inventaris:
```typescript
{ label: '📦 Inventaris Alat', path: '/pelatih/inventaris' },
```
pada menu pelatih.

- [ ] **Step 3: Verify navigation bar rendering**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add siger-tkd-manager/src/app/admin/layout.tsx siger-tkd-manager/src/app/pelatih/layout.tsx
git commit -m "feat(nav): add inventory navigation links for admin and coach layouts"
```

---

### Task 6: System Build Verification & End-to-End Validation

**Files:**
- Test / Verify all files:
  - `siger-tkd-manager/supabase/migrations/029_inventaris_club.sql`
  - `siger-tkd-manager/src/lib/types.ts`
  - `siger-tkd-manager/src/app/admin/inventaris/actions.ts`
  - `siger-tkd-manager/src/app/admin/inventaris/page.tsx`
  - `siger-tkd-manager/src/app/pelatih/inventaris/actions.ts`
  - `siger-tkd-manager/src/app/pelatih/inventaris/page.tsx`
  - `siger-tkd-manager/src/app/admin/layout.tsx`
  - `siger-tkd-manager/src/app/pelatih/layout.tsx`

- [ ] **Step 1: Run production build check**

Run: `cd siger-tkd-manager && npm run build`
Expected: Build succeeds with 0 compile errors, routes `/admin/inventaris` and `/pelatih/inventaris` generated cleanly.

- [ ] **Step 2: Verify git status and clean working tree**

Run: `git status -s`
Expected: Clean working tree or only expected tracked modifications.

- [ ] **Step 3: Final Commit (if any adjustments made)**

```bash
git commit -m "chore(inventaris): verify production build and route compilation"
```
