# Merchant (Toko Produk Club) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fitur toko produk club (Merchant) lengkap — admin bisa CRUD produk + kelola pesanan, ortu bisa browsing, keranjang belanja, checkout, dan upload bukti transfer.

**Architecture:** 4 tabel baru di Supabase (produk_merchant, produk_varian, pesanan_merchant, pesanan_item) dengan RLS per role. Admin panel di `/admin/merchant` dan `/admin/merchant/pesanan`. Panel ortu di `/ortu/merchant`, `/ortu/merchant/keranjang`, dan `/ortu/merchant/pesanan`. Keranjang belanja menggunakan React Context (tidak persisten ke DB). Pembayaran mengikuti pola iuran: upload bukti transfer → admin verifikasi.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + Storage + RLS), TypeScript, Tailwind CSS (Neo-Brutalism), React Context API.

## Global Constraints

- Semua komponen menggunakan `'use client'` karena menggunakan state dan Supabase client.
- Supabase client: `import { createClient } from '@/lib/supabase/client'` — **bukan** `@/lib/supabase/server`.
- Semua komponen UI menggunakan `@/components/ui/Button`, `@/components/ui/Card`, `@/components/ui/Badge`, `@/components/ui/Input`.
- Style: Neo-Brutalism — `border-2/border-4 border-dark`, `shadow-brutal`, warna primary/secondary/accent.
- Format harga: `new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)`
- Stok dikurangi saat **checkout** (bukan saat tambah ke keranjang).
- Foto produk disimpan di Supabase Storage bucket `merchant`.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/010_merchant.sql`

- [ ] **Step 1: Buat file migration**

```sql
-- supabase/migrations/010_merchant.sql

CREATE TABLE produk_merchant (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('Seragam', 'Aksesoris', 'Perlengkapan')),
  harga NUMERIC NOT NULL CHECK (harga >= 0),
  deskripsi TEXT,
  foto_url TEXT,
  status_aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE produk_varian (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produk_id UUID NOT NULL REFERENCES produk_merchant(id) ON DELETE CASCADE,
  ukuran TEXT NOT NULL,
  stok INT NOT NULL DEFAULT 0 CHECK (stok >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pesanan_merchant (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  total_harga NUMERIC NOT NULL CHECK (total_harga >= 0),
  status TEXT NOT NULL DEFAULT 'menunggu_pembayaran'
    CHECK (status IN ('menunggu_pembayaran', 'lunas', 'diproses', 'siap_diambil')),
  bukti_transfer_url TEXT,
  catatan_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_pesanan_merchant_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pesanan_merchant_updated_at
BEFORE UPDATE ON pesanan_merchant
FOR EACH ROW EXECUTE FUNCTION update_pesanan_merchant_updated_at();

CREATE TABLE pesanan_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pesanan_id UUID NOT NULL REFERENCES pesanan_merchant(id) ON DELETE CASCADE,
  produk_id UUID NOT NULL REFERENCES produk_merchant(id) ON DELETE RESTRICT,
  varian_id UUID NOT NULL REFERENCES produk_varian(id) ON DELETE RESTRICT,
  qty INT NOT NULL CHECK (qty > 0),
  harga_satuan NUMERIC NOT NULL CHECK (harga_satuan >= 0)
);

-- RLS
ALTER TABLE produk_merchant ENABLE ROW LEVEL SECURITY;
ALTER TABLE produk_varian ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesanan_merchant ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesanan_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full produk_merchant" ON produk_merchant FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Auth view active produk" ON produk_merchant FOR SELECT TO authenticated
USING (status_aktif = true OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin full produk_varian" ON produk_varian FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Auth view produk_varian" ON produk_varian FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin full pesanan_merchant" ON pesanan_merchant FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Ortu insert pesanan" ON pesanan_merchant FOR INSERT TO authenticated
WITH CHECK (siswa_id IN (SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'));

CREATE POLICY "Ortu view own pesanan" ON pesanan_merchant FOR SELECT TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR siswa_id IN (SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'));

CREATE POLICY "Ortu update own pesanan" ON pesanan_merchant FOR UPDATE TO authenticated
USING (siswa_id IN (SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'))
WITH CHECK (siswa_id IN (SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'));

CREATE POLICY "Admin full pesanan_item" ON pesanan_item FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Ortu insert pesanan_item" ON pesanan_item FOR INSERT TO authenticated
WITH CHECK (pesanan_id IN (
  SELECT pm.id FROM pesanan_merchant pm
  JOIN profiles p ON p.siswa_id = pm.siswa_id
  WHERE p.id = auth.uid() AND p.role = 'ortu'));

CREATE POLICY "Ortu view own pesanan_item" ON pesanan_item FOR SELECT TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR pesanan_id IN (
    SELECT pm.id FROM pesanan_merchant pm
    JOIN profiles p ON p.siswa_id = pm.siswa_id
    WHERE p.id = auth.uid() AND p.role = 'ortu'));
```

- [ ] **Step 2: Jalankan migration**

Paste isi file ke Supabase Dashboard → SQL Editor → Run.

- [ ] **Step 3: Buat Storage bucket `merchant`**

Supabase Dashboard → Storage → New Bucket → Name: `merchant`, Public: true

Lalu jalankan di SQL Editor:
```sql
CREATE POLICY "Admin upload merchant" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'merchant' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin update merchant" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'merchant' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin delete merchant" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'merchant' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Public view merchant" ON storage.objects FOR SELECT TO public USING (bucket_id = 'merchant');

CREATE POLICY "Ortu upload bukti" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'merchant' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ortu'
  AND (storage.foldername(name))[1] = 'bukti');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/010_merchant.sql
git commit -m "feat: add merchant database migration with RLS"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Tambahkan ke akhir `src/lib/types.ts` (sebelum baris `export { createClient }`)**

```typescript
export type KategoriMerchant = 'Seragam' | 'Aksesoris' | 'Perlengkapan'
export type StatusPesanan = 'menunggu_pembayaran' | 'lunas' | 'diproses' | 'siap_diambil'

export interface ProdukMerchant {
  id: string
  nama: string
  kategori: KategoriMerchant
  harga: number
  deskripsi: string | null
  foto_url: string | null
  status_aktif: boolean
  created_at: string
  produk_varian?: ProdukVarian[]
}

export interface ProdukVarian {
  id: string
  produk_id: string
  ukuran: string
  stok: number
  created_at: string
}

export interface PesananMerchant {
  id: string
  siswa_id: string
  total_harga: number
  status: StatusPesanan
  bukti_transfer_url: string | null
  catatan_admin: string | null
  created_at: string
  updated_at: string
  siswa?: Pick<Siswa, 'nama'>
  pesanan_item?: PesananItemWithDetail[]
}

export interface PesananItem {
  id: string
  pesanan_id: string
  produk_id: string
  varian_id: string
  qty: number
  harga_satuan: number
}

export interface PesananItemWithDetail extends PesananItem {
  produk_merchant?: Pick<ProdukMerchant, 'nama' | 'foto_url'>
  produk_varian?: Pick<ProdukVarian, 'ukuran'>
}

export interface KeranjangItem {
  produk: ProdukMerchant
  varian: ProdukVarian
  qty: number
}
```

- [ ] **Step 2: Verifikasi**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add merchant TypeScript types"
```

---

### Task 3: Keranjang Context

**Files:**
- Create: `src/context/KeranjangContext.tsx`
- Modify: `src/app/ortu/layout.tsx`

- [ ] **Step 1: Buat `src/context/KeranjangContext.tsx`**

```typescript
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { KeranjangItem, ProdukMerchant, ProdukVarian } from '@/lib/types'

interface KeranjangContextValue {
  items: KeranjangItem[]
  tambahItem: (produk: ProdukMerchant, varian: ProdukVarian, qty: number) => void
  hapusItem: (varianId: string) => void
  updateQty: (varianId: string, qty: number) => void
  clearKeranjang: () => void
  totalHarga: number
  totalItem: number
}

const KeranjangContext = createContext<KeranjangContextValue | null>(null)

export function KeranjangProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<KeranjangItem[]>([])

  const tambahItem = (produk: ProdukMerchant, varian: ProdukVarian, qty: number) => {
    setItems(prev => {
      const existing = prev.find(i => i.varian.id === varian.id)
      if (existing) {
        return prev.map(i =>
          i.varian.id === varian.id
            ? { ...i, qty: Math.min(i.qty + qty, varian.stok) }
            : i
        )
      }
      return [...prev, { produk, varian, qty }]
    })
  }

  const hapusItem = (varianId: string) =>
    setItems(prev => prev.filter(i => i.varian.id !== varianId))

  const updateQty = (varianId: string, qty: number) => {
    if (qty <= 0) { hapusItem(varianId); return }
    setItems(prev => prev.map(i => i.varian.id === varianId ? { ...i, qty } : i))
  }

  const clearKeranjang = () => setItems([])
  const totalHarga = items.reduce((s, i) => s + i.produk.harga * i.qty, 0)
  const totalItem = items.reduce((s, i) => s + i.qty, 0)

  return (
    <KeranjangContext.Provider value={{ items, tambahItem, hapusItem, updateQty, clearKeranjang, totalHarga, totalItem }}>
      {children}
    </KeranjangContext.Provider>
  )
}

export function useKeranjang(): KeranjangContextValue {
  const ctx = useContext(KeranjangContext)
  if (!ctx) throw new Error('useKeranjang must be used inside KeranjangProvider')
  return ctx
}
```

- [ ] **Step 2: Wrap ortu layout dengan KeranjangProvider**

Buka `src/app/ortu/layout.tsx`. Tambahkan import:
```typescript
import { KeranjangProvider } from '@/context/KeranjangContext'
```

Temukan bagian `{authorized && (` — wrap seluruh konten di dalamnya dengan `<KeranjangProvider>...</KeranjangProvider>`.

- [ ] **Step 3: Verifikasi + Commit**

```bash
npx tsc --noEmit
git add src/context/KeranjangContext.tsx src/app/ortu/layout.tsx
git commit -m "feat: add shopping cart context (KeranjangProvider)"
```

---

### Task 4: Admin — Produk (`/admin/merchant`)

**Files:**
- Create: `src/app/admin/merchant/page.tsx`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Tambah menu ke `src/app/admin/layout.tsx`**

Temukan array `menu` (sekitar baris 69–84). Tambahkan dua item setelah `'🥋 Event Kompetisi'`:
```typescript
{ label: '🛒 Toko Merchant', path: '/admin/merchant' },
{ label: '📦 Pesanan Merchant', path: '/admin/merchant/pesanan' },
```

- [ ] **Step 2: Buat `src/app/admin/merchant/page.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { ProdukMerchant, KategoriMerchant } from '@/lib/types'

const supabase = createClient()
const KATEGORI_OPTIONS: KategoriMerchant[] = ['Seragam', 'Aksesoris', 'Perlengkapan']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

type VarianForm = { ukuran: string; stok: number }
type ProdukForm = { nama: string; kategori: KategoriMerchant; harga: string; deskripsi: string; varian: VarianForm[] }
const EMPTY_FORM: ProdukForm = { nama: '', kategori: 'Seragam', harga: '', deskripsi: '', varian: [{ ukuran: '', stok: 0 }] }

export default function AdminMerchantPage() {
  const [produkList, setProdukList] = useState<ProdukMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ProdukForm>(EMPTY_FORM)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProduk = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('produk_merchant').select('*, produk_varian(*)').order('created_at', { ascending: false })
    setProdukList((data || []) as ProdukMerchant[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProduk() }, [fetchProduk])

  const openTambah = () => { setEditId(null); setForm(EMPTY_FORM); setFotoFile(null); setError(null); setShowModal(true) }
  const openEdit = (p: ProdukMerchant) => {
    setEditId(p.id)
    setForm({ nama: p.nama, kategori: p.kategori, harga: String(p.harga), deskripsi: p.deskripsi || '', varian: (p.produk_varian || []).map(v => ({ ukuran: v.ukuran, stok: v.stok })) })
    setFotoFile(null); setError(null); setShowModal(true)
  }

  const toggleAktif = async (p: ProdukMerchant) => {
    await supabase.from('produk_merchant').update({ status_aktif: !p.status_aktif }).eq('id', p.id)
    fetchProduk()
  }

  const hapusProduk = async (id: string) => {
    if (!confirm('Hapus produk ini?')) return
    await supabase.from('produk_merchant').delete().eq('id', id)
    fetchProduk()
  }

  const tambahVarian = () => setForm(prev => ({ ...prev, varian: [...prev.varian, { ukuran: '', stok: 0 }] }))
  const hapusVarian = (i: number) => setForm(prev => ({ ...prev, varian: prev.varian.filter((_, idx) => idx !== i) }))
  const updateVarian = (i: number, field: keyof VarianForm, value: string | number) =>
    setForm(prev => ({ ...prev, varian: prev.varian.map((v, idx) => idx === i ? { ...v, [field]: value } : v) }))

  const handleSave = async () => {
    if (!form.nama.trim()) { setError('Nama produk wajib diisi.'); return }
    if (!form.harga || isNaN(Number(form.harga))) { setError('Harga wajib diisi.'); return }
    if (form.varian.length === 0 || form.varian.some(v => !v.ukuran.trim())) { setError('Minimal 1 varian ukuran wajib diisi.'); return }

    setSaving(true); setError(null)
    let foto_url: string | null = null

    if (fotoFile) {
      const ext = fotoFile.name.split('.').pop()
      const filename = `produk/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('merchant').upload(filename, fotoFile, { upsert: true })
      if (uploadErr) { setError('Gagal upload foto: ' + uploadErr.message); setSaving(false); return }
      foto_url = supabase.storage.from('merchant').getPublicUrl(uploadData.path).data.publicUrl
    }

    if (editId) {
      const payload: Partial<ProdukMerchant> = { nama: form.nama, kategori: form.kategori, harga: Number(form.harga), deskripsi: form.deskripsi || null }
      if (foto_url) payload.foto_url = foto_url
      await supabase.from('produk_merchant').update(payload).eq('id', editId)
      await supabase.from('produk_varian').delete().eq('produk_id', editId)
      await supabase.from('produk_varian').insert(form.varian.map(v => ({ produk_id: editId, ukuran: v.ukuran, stok: v.stok })))
    } else {
      const { data: p, error: err } = await supabase.from('produk_merchant')
        .insert({ nama: form.nama, kategori: form.kategori, harga: Number(form.harga), deskripsi: form.deskripsi || null, foto_url, status_aktif: true })
        .select().single()
      if (err || !p) { setError('Gagal simpan.'); setSaving(false); return }
      await supabase.from('produk_varian').insert(form.varian.map(v => ({ produk_id: p.id, ukuran: v.ukuran, stok: v.stok })))
    }

    setSaving(false); setShowModal(false); fetchProduk()
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-dark">🛒 Toko Merchant</h1>
          <p className="text-dark/60 mt-1">Kelola produk yang dijual kepada siswa/wali</p>
        </div>
        <Button variant="primary" onClick={openTambah}>+ Tambah Produk</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-dark border-t-primary rounded-full animate-spin" /></div>
      ) : produkList.length === 0 ? (
        <Card className="text-center py-12"><p className="text-dark/50 text-lg">Belum ada produk.</p></Card>
      ) : (
        <div className="grid gap-4">
          {produkList.map(p => (
            <Card key={p.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4">
              <div className="w-16 h-16 rounded-xl border-2 border-dark overflow-hidden shrink-0 bg-background">
                {p.foto_url ? <img src={p.foto_url} alt={p.nama} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-dark">{p.nama}</h3>
                  <Badge variant="secondary">{p.kategori}</Badge>
                  <Badge variant={p.status_aktif ? 'primary' : 'dark'}>{p.status_aktif ? 'Aktif' : 'Nonaktif'}</Badge>
                </div>
                <p className="text-primary font-bold mt-1">{formatRupiah(p.harga)}</p>
                <p className="text-dark/60 text-sm mt-1">
                  {(p.produk_varian || []).map(v => `${v.ukuran}(${v.stok})`).join(' · ')} — Total: {(p.produk_varian || []).reduce((s, v) => s + v.stok, 0)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button variant="secondary" onClick={() => openEdit(p)}>Edit</Button>
                <Button variant="accent" onClick={() => toggleAktif(p)}>{p.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                <Button variant="dark" onClick={() => hapusProduk(p.id)}>Hapus</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white border-4 border-dark shadow-brutal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold font-sans text-dark mb-6">{editId ? '✏️ Edit Produk' : '➕ Tambah Produk'}</h2>
            {error && <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 mb-4 text-red-700 text-sm font-bold">{error}</div>}
            <div className="flex flex-col gap-4">
              <div>
                <label className="block font-bold text-dark text-sm mb-1">Nama Produk *</label>
                <Input value={form.nama} onChange={e => setForm(p => ({ ...p, nama: e.target.value }))} placeholder="e.g. Kaos Club Siger" />
              </div>
              <div>
                <label className="block font-bold text-dark text-sm mb-1">Kategori *</label>
                <select className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow" value={form.kategori} onChange={e => setForm(p => ({ ...p, kategori: e.target.value as KategoriMerchant }))}>
                  {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-dark text-sm mb-1">Harga (Rp) *</label>
                <Input type="number" value={form.harga} onChange={e => setForm(p => ({ ...p, harga: e.target.value }))} placeholder="150000" />
              </div>
              <div>
                <label className="block font-bold text-dark text-sm mb-1">Deskripsi</label>
                <textarea className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow resize-none" rows={3} value={form.deskripsi} onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Opsional" />
              </div>
              <div>
                <label className="block font-bold text-dark text-sm mb-1">Foto Produk</label>
                <input type="file" accept="image/*" className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white" onChange={e => setFotoFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-bold text-dark text-sm">Varian Ukuran *</label>
                  <Button variant="secondary" onClick={tambahVarian} className="text-xs py-1">+ Tambah Ukuran</Button>
                </div>
                <div className="flex flex-col gap-2">
                  {form.varian.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input value={v.ukuran} onChange={e => updateVarian(i, 'ukuran', e.target.value)} placeholder="Ukuran (e.g. M)" className="flex-1" />
                      <Input type="number" value={String(v.stok)} onChange={e => updateVarian(i, 'stok', parseInt(e.target.value) || 0)} placeholder="Stok" className="w-24" />
                      {form.varian.length > 1 && <button onClick={() => hapusVarian(i)} className="text-red-500 font-bold px-2 text-lg">×</button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">{saving ? 'Menyimpan...' : 'Simpan Produk'}</Button>
              <Button variant="dark" onClick={() => setShowModal(false)}>Batal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verifikasi + Commit**

```bash
npx tsc --noEmit
git add src/app/admin/merchant/page.tsx src/app/admin/layout.tsx
git commit -m "feat: add admin merchant product management page"
```

---

### Task 5: Admin — Pesanan (`/admin/merchant/pesanan`)

**Files:**
- Create: `src/app/admin/merchant/pesanan/page.tsx`

- [ ] **Step 1: Buat `src/app/admin/merchant/pesanan/page.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { PesananMerchant, StatusPesanan } from '@/lib/types'

const supabase = createClient()

const STATUS_CONFIG: Record<StatusPesanan, { label: string; variant: 'primary' | 'secondary' | 'accent' | 'dark' }> = {
  menunggu_pembayaran: { label: 'Menunggu Bayar', variant: 'accent' },
  lunas:               { label: 'Lunas',           variant: 'secondary' },
  diproses:            { label: 'Diproses',         variant: 'dark' },
  siap_diambil:        { label: 'Siap Diambil',     variant: 'primary' },
}
const STATUS_FLOW: StatusPesanan[] = ['menunggu_pembayaran', 'lunas', 'diproses', 'siap_diambil']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function formatTgl(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AdminPesananMerchantPage() {
  const [pesananList, setPesananList] = useState<PesananMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [selected, setSelected] = useState<PesananMerchant | null>(null)
  const [newStatus, setNewStatus] = useState<StatusPesanan>('menunggu_pembayaran')
  const [catatanAdmin, setCatatanAdmin] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPesanan = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('pesanan_merchant')
      .select('*, siswa:siswa_id(nama), pesanan_item(*, produk_merchant:produk_id(nama, foto_url), produk_varian:varian_id(ukuran))')
      .order('created_at', { ascending: false })
    if (filterStatus !== 'semua') query = query.eq('status', filterStatus)
    const { data } = await query
    setPesananList((data || []) as PesananMerchant[])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { fetchPesanan() }, [fetchPesanan])

  const openDetail = (p: PesananMerchant) => {
    setSelected(p); setNewStatus(p.status); setCatatanAdmin(p.catatan_admin || '')
  }

  const handleUpdate = async () => {
    if (!selected) return
    setSaving(true)
    await supabase.from('pesanan_merchant').update({ status: newStatus, catatan_admin: catatanAdmin || null }).eq('id', selected.id)
    setSaving(false); setSelected(null); fetchPesanan()
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-dark">📦 Pesanan Merchant</h1>
        <p className="text-dark/60 mt-1">Verifikasi pembayaran dan update status pesanan</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {['semua', ...STATUS_FLOW].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all ${filterStatus === s ? 'bg-dark text-white border-dark' : 'bg-white border-dark/30 hover:border-dark'}`}>
            {s === 'semua' ? 'Semua' : STATUS_CONFIG[s as StatusPesanan].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-dark border-t-primary rounded-full animate-spin" /></div>
      ) : pesananList.length === 0 ? (
        <Card className="text-center py-12"><p className="text-dark/50 text-lg">Tidak ada pesanan.</p></Card>
      ) : (
        <div className="grid gap-4">
          {pesananList.map(p => (
            <Card key={p.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 cursor-pointer" onClick={() => openDetail(p)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-dark">{(p.siswa as any)?.nama || '-'}</span>
                  <Badge variant={STATUS_CONFIG[p.status].variant}>{STATUS_CONFIG[p.status].label}</Badge>
                </div>
                <p className="text-dark/60 text-sm">{formatTgl(p.created_at)}</p>
                <p className="text-primary font-bold mt-1">{formatRupiah(p.total_harga)}</p>
              </div>
              <Button variant="secondary">Lihat Detail →</Button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white border-4 border-dark shadow-brutal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold font-sans text-dark mb-2">📋 Detail Pesanan</h2>
            <p className="text-dark/60 text-sm mb-4">{(selected.siswa as any)?.nama} · {formatTgl(selected.created_at)}</p>

            <div className="border-2 border-dark rounded-xl overflow-hidden mb-4">
              {(selected.pesanan_item || []).map((item: any) => (
                <div key={item.id} className="flex gap-3 items-center p-3 border-b border-dark/20 last:border-b-0">
                  <div className="w-10 h-10 rounded-lg border border-dark overflow-hidden shrink-0 bg-background">
                    {item.produk_merchant?.foto_url ? <img src={item.produk_merchant.foto_url} alt="" className="w-full h-full object-cover" /> : <span className="flex h-full items-center justify-center">🛍️</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-dark text-sm">{item.produk_merchant?.nama}</p>
                    <p className="text-dark/60 text-xs">Ukuran: {item.produk_varian?.ukuran} · {item.qty}x · {formatRupiah(item.harga_satuan)}</p>
                  </div>
                  <p className="font-bold text-sm">{formatRupiah(item.qty * item.harga_satuan)}</p>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-background font-bold text-dark">
                <span>Total</span><span>{formatRupiah(selected.total_harga)}</span>
              </div>
            </div>

            <div className="mb-4">
              <p className="font-bold text-dark text-sm mb-2">Bukti Transfer:</p>
              {selected.bukti_transfer_url ? (
                <a href={selected.bukti_transfer_url} target="_blank" rel="noopener noreferrer">
                  <img src={selected.bukti_transfer_url} alt="Bukti" className="w-full max-h-40 object-contain rounded-xl border-2 border-dark" />
                </a>
              ) : (
                <div className="border-2 border-dashed border-dark/30 rounded-xl p-4 text-center text-dark/40 text-sm">Belum ada bukti transfer</div>
              )}
            </div>

            <div className="mb-4">
              <label className="block font-bold text-dark text-sm mb-1">Update Status</label>
              <select className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white" value={newStatus} onChange={e => setNewStatus(e.target.value as StatusPesanan)}>
                {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-bold text-dark text-sm mb-1">Catatan Admin</label>
              <textarea className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white resize-none" rows={2} value={catatanAdmin} onChange={e => setCatatanAdmin(e.target.value)} placeholder="Catatan untuk ortu..." />
            </div>
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleUpdate} disabled={saving} className="flex-1">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
              <Button variant="dark" onClick={() => setSelected(null)}>Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi + Commit**

```bash
npx tsc --noEmit
git add src/app/admin/merchant/pesanan/page.tsx
git commit -m "feat: add admin merchant order management page"
```

---

### Task 6: Ortu — Toko (`/ortu/merchant`)

**Files:**
- Create: `src/app/ortu/merchant/page.tsx`
- Modify: `src/app/ortu/layout.tsx` (tambah navigasi)

- [ ] **Step 1: Tambah navigasi ke ortu layout**

Buka `src/app/ortu/layout.tsx`. Temukan array `menu`. Tambahkan:
```typescript
{ label: '🛒 Toko', path: '/ortu/merchant' },
{ label: '📦 Pesanan Saya', path: '/ortu/merchant/pesanan' },
```

- [ ] **Step 2: Buat `src/app/ortu/merchant/page.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useKeranjang } from '@/context/KeranjangContext'
import type { ProdukMerchant, ProdukVarian, KategoriMerchant } from '@/lib/types'

const supabase = createClient()
const KATEGORI_OPTIONS: ('Semua' | KategoriMerchant)[] = ['Semua', 'Seragam', 'Aksesoris', 'Perlengkapan']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function OrtuMerchantPage() {
  const [produkList, setProdukList] = useState<ProdukMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [filterKategori, setFilterKategori] = useState<'Semua' | KategoriMerchant>('Semua')
  const [selectedVarian, setSelectedVarian] = useState<Record<string, string>>({})
  const [qty, setQty] = useState<Record<string, number>>({})
  const [addedIds, setAddedIds] = useState<string[]>([])
  const { tambahItem, totalItem } = useKeranjang()

  const fetchProduk = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('produk_merchant').select('*, produk_varian(*)').eq('status_aktif', true).order('created_at', { ascending: false })
    setProdukList((data || []) as ProdukMerchant[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProduk() }, [fetchProduk])

  const filtered = filterKategori === 'Semua' ? produkList : produkList.filter(p => p.kategori === filterKategori)

  const handleTambah = (p: ProdukMerchant) => {
    const varian = (p.produk_varian || []).find(v => v.id === selectedVarian[p.id])
    if (!varian) return
    tambahItem(p, varian, qty[p.id] || 1)
    setAddedIds(prev => [...prev, p.id])
    setTimeout(() => setAddedIds(prev => prev.filter(id => id !== p.id)), 1500)
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-dark">🛒 Toko Club</h1>
          <p className="text-dark/60 mt-1">Produk resmi Siger Taekwondo Club</p>
        </div>
        <Link href="/ortu/merchant/keranjang">
          <Button variant="primary" className="relative">
            🛒 Keranjang
            {totalItem > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-accent border-2 border-dark rounded-full text-xs font-bold flex items-center justify-center">{totalItem}</span>
            )}
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {KATEGORI_OPTIONS.map(k => (
          <button key={k} onClick={() => setFilterKategori(k)}
            className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all ${filterKategori === k ? 'bg-dark text-white border-dark' : 'bg-white border-dark/30 hover:border-dark'}`}>
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-dark border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12"><p className="text-dark/50 text-lg">Belum ada produk.</p></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map(p => {
            const varianList = p.produk_varian || []
            const selVarian = varianList.find(v => v.id === selectedVarian[p.id])
            const stokHabis = !selVarian || selVarian.stok === 0
            const isAdded = addedIds.includes(p.id)

            return (
              <Card key={p.id} className="flex flex-col p-0 overflow-hidden">
                <div className="w-full aspect-square bg-background border-b-2 border-dark overflow-hidden">
                  {p.foto_url ? <img src={p.foto_url} alt={p.nama} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>}
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <Badge variant="secondary" className="self-start text-xs">{p.kategori}</Badge>
                  <h3 className="font-bold text-dark text-sm leading-tight">{p.nama}</h3>
                  <p className="text-primary font-bold">{formatRupiah(p.harga)}</p>
                  <select className="w-full border-2 border-dark rounded-lg px-2 py-1.5 text-sm font-sans text-dark bg-white"
                    value={selectedVarian[p.id] || ''}
                    onChange={e => setSelectedVarian(prev => ({ ...prev, [p.id]: e.target.value }))}>
                    <option value="">Pilih ukuran</option>
                    {varianList.map(v => <option key={v.id} value={v.id} disabled={v.stok === 0}>{v.ukuran} {v.stok === 0 ? '(Habis)' : `(${v.stok})`}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(prev => ({ ...prev, [p.id]: Math.max(1, (prev[p.id] || 1) - 1) }))} className="w-7 h-7 border-2 border-dark rounded-lg font-bold text-dark hover:bg-background">−</button>
                    <span className="font-bold text-dark w-6 text-center">{qty[p.id] || 1}</span>
                    <button onClick={() => setQty(prev => ({ ...prev, [p.id]: Math.min(selVarian?.stok || 1, (prev[p.id] || 1) + 1) }))} className="w-7 h-7 border-2 border-dark rounded-lg font-bold text-dark hover:bg-background">+</button>
                  </div>
                  <Button variant={isAdded ? 'primary' : stokHabis ? 'dark' : 'secondary'} onClick={() => handleTambah(p)} disabled={stokHabis || !selectedVarian[p.id]} className="w-full text-sm">
                    {isAdded ? '✓ Ditambahkan!' : stokHabis ? 'Stok Habis' : '+ Keranjang'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verifikasi + Commit**

```bash
npx tsc --noEmit
git add src/app/ortu/merchant/page.tsx src/app/ortu/layout.tsx
git commit -m "feat: add ortu merchant store page"
```

---

### Task 7: Ortu — Keranjang & Checkout (`/ortu/merchant/keranjang`)

**Files:**
- Create: `src/app/ortu/merchant/keranjang/page.tsx`

- [ ] **Step 1: Buat `src/app/ortu/merchant/keranjang/page.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useKeranjang } from '@/context/KeranjangContext'

const supabase = createClient()
function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function KeranjangPage() {
  const { items, hapusItem, updateQty, clearKeranjang, totalHarga } = useKeranjang()
  const [siswaId, setSiswaId] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [pesananId, setPesananId] = useState<string | null>(null)
  const [pesananTotal, setPesananTotal] = useState(0)
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [uploadingBukti, setUploadingBukti] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('siswa_id').eq('id', user.id).single()
        .then(({ data }) => setSiswaId(data?.siswa_id || null))
    })
  }, [])

  const handleCheckout = async () => {
    if (!siswaId) { setError('Data siswa tidak ditemukan.'); return }
    if (items.length === 0) return
    setCheckingOut(true); setError(null)

    const { data: pesanan, error: err } = await supabase.from('pesanan_merchant')
      .insert({ siswa_id: siswaId, total_harga: totalHarga, status: 'menunggu_pembayaran' })
      .select().single()

    if (err || !pesanan) { setError('Gagal membuat pesanan.'); setCheckingOut(false); return }

    for (const item of items) {
      await supabase.from('pesanan_item').insert({
        pesanan_id: pesanan.id, produk_id: item.produk.id, varian_id: item.varian.id,
        qty: item.qty, harga_satuan: item.produk.harga
      })
      await supabase.from('produk_varian').update({ stok: Math.max(0, item.varian.stok - item.qty) }).eq('id', item.varian.id)
    }

    setPesananTotal(totalHarga)
    clearKeranjang()
    setPesananId(pesanan.id)
    setCheckingOut(false)
  }

  const handleUploadBukti = async () => {
    if (!buktiFile || !pesananId) return
    setUploadingBukti(true); setError(null)
    const ext = buktiFile.name.split('.').pop()
    const { data: up, error: upErr } = await supabase.storage.from('merchant').upload(`bukti/${pesananId}.${ext}`, buktiFile, { upsert: true })
    if (upErr) { setError('Gagal upload: ' + upErr.message); setUploadingBukti(false); return }
    const url = supabase.storage.from('merchant').getPublicUrl(up.path).data.publicUrl
    await supabase.from('pesanan_merchant').update({ bukti_transfer_url: url }).eq('id', pesananId)
    setUploadingBukti(false)
    router.push('/ortu/merchant/pesanan')
  }

  if (pesananId) {
    return (
      <div className="p-4 md:p-8 max-w-lg mx-auto">
        <Card className="text-center p-8">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-dark mb-2">Pesanan Dibuat!</h2>
          <p className="text-dark/60 mb-6">Silakan transfer dan upload bukti pembayaran.</p>
          <div className="bg-background border-2 border-dark rounded-xl p-4 mb-6 text-left">
            <p className="font-bold text-dark text-sm mb-1">Transfer ke:</p>
            <p className="text-dark font-bold text-lg">BCA · 1234567890</p>
            <p className="text-dark/60 text-sm">a/n Siger Taekwondo Club</p>
            <div className="border-t border-dark/20 mt-3 pt-3">
              <p className="text-dark font-bold">Total: {formatRupiah(pesananTotal)}</p>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
          <div className="mb-4">
            <label className="block font-bold text-dark text-sm mb-2 text-left">Upload Bukti Transfer</label>
            <input type="file" accept="image/*" className="w-full border-2 border-dark rounded-xl px-4 py-2.5" onChange={e => setBuktiFile(e.target.files?.[0] || null)} />
          </div>
          <Button variant="primary" onClick={handleUploadBukti} disabled={!buktiFile || uploadingBukti} className="w-full mb-3">
            {uploadingBukti ? 'Mengupload...' : '📤 Upload Bukti Transfer'}
          </Button>
          <Link href="/ortu/merchant/pesanan"><Button variant="dark" className="w-full">Lihat Riwayat Pesanan</Button></Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ortu/merchant"><button className="text-dark font-bold hover:text-primary transition-colors">← Lanjut Belanja</button></Link>
        <h1 className="text-2xl font-bold font-sans text-dark">🛒 Keranjang</h1>
      </div>

      {items.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-4xl mb-4">🛒</p>
          <p className="text-dark/50 text-lg mb-4">Keranjang kosong</p>
          <Link href="/ortu/merchant"><Button variant="primary">Belanja Sekarang</Button></Link>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-6">
            {items.map(item => (
              <Card key={item.varian.id} className="flex gap-3 items-center p-3">
                <div className="w-14 h-14 rounded-xl border-2 border-dark overflow-hidden shrink-0 bg-background">
                  {item.produk.foto_url ? <img src={item.produk.foto_url} alt="" className="w-full h-full object-cover" /> : <span className="flex h-full items-center justify-center text-2xl">🛍️</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-dark text-sm">{item.produk.nama}</p>
                  <p className="text-dark/60 text-xs">Ukuran: {item.varian.ukuran}</p>
                  <p className="text-primary font-bold text-sm">{formatRupiah(item.produk.harga * item.qty)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.varian.id, item.qty - 1)} className="w-7 h-7 border-2 border-dark rounded-lg font-bold">−</button>
                  <span className="w-6 text-center font-bold text-sm">{item.qty}</span>
                  <button onClick={() => updateQty(item.varian.id, item.qty + 1)} className="w-7 h-7 border-2 border-dark rounded-lg font-bold">+</button>
                  <button onClick={() => hapusItem(item.varian.id)} className="ml-1 text-red-500 font-bold text-lg">×</button>
                </div>
              </Card>
            ))}
          </div>
          <Card className="p-4 mb-4">
            <div className="flex justify-between items-center font-bold text-dark text-lg">
              <span>Total</span><span className="text-primary">{formatRupiah(totalHarga)}</span>
            </div>
          </Card>
          {error && <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 mb-4 text-red-700 text-sm">{error}</div>}
          <Button variant="primary" onClick={handleCheckout} disabled={checkingOut} className="w-full">
            {checkingOut ? 'Memproses...' : '✅ Checkout & Buat Pesanan'}
          </Button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi + Commit**

```bash
npx tsc --noEmit
git add src/app/ortu/merchant/keranjang/page.tsx
git commit -m "feat: add ortu merchant cart and checkout page"
```

---

### Task 8: Ortu — Riwayat Pesanan (`/ortu/merchant/pesanan`)

**Files:**
- Create: `src/app/ortu/merchant/pesanan/page.tsx`

- [ ] **Step 1: Buat `src/app/ortu/merchant/pesanan/page.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { PesananMerchant, StatusPesanan } from '@/lib/types'

const supabase = createClient()

const STATUS_CONFIG: Record<StatusPesanan, { label: string; variant: 'primary' | 'secondary' | 'accent' | 'dark' }> = {
  menunggu_pembayaran: { label: 'Menunggu Bayar', variant: 'accent' },
  lunas:               { label: 'Lunas',           variant: 'secondary' },
  diproses:            { label: 'Diproses',         variant: 'dark' },
  siap_diambil:        { label: 'Siap Diambil ✅',  variant: 'primary' },
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function formatTgl(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function OrtuPesananMerchantPage() {
  const [pesananList, setPesananList] = useState<PesananMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PesananMerchant | null>(null)
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPesanan = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('siswa_id').eq('id', user.id).single()
    if (!profile?.siswa_id) { setLoading(false); return }
    const { data } = await supabase.from('pesanan_merchant')
      .select('*, pesanan_item(*, produk_merchant:produk_id(nama, foto_url), produk_varian:varian_id(ukuran))')
      .eq('siswa_id', profile.siswa_id)
      .order('created_at', { ascending: false })
    setPesananList((data || []) as PesananMerchant[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPesanan() }, [fetchPesanan])

  const handleUploadBukti = async () => {
    if (!buktiFile || !selected) return
    setUploading(true); setError(null)
    const ext = buktiFile.name.split('.').pop()
    const { data: up, error: upErr } = await supabase.storage.from('merchant').upload(`bukti/${selected.id}.${ext}`, buktiFile, { upsert: true })
    if (upErr) { setError('Gagal upload: ' + upErr.message); setUploading(false); return }
    const url = supabase.storage.from('merchant').getPublicUrl(up.path).data.publicUrl
    await supabase.from('pesanan_merchant').update({ bukti_transfer_url: url }).eq('id', selected.id)
    setUploading(false); setSelected(null); fetchPesanan()
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold font-sans text-dark mb-6">📦 Riwayat Pesanan</h1>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-dark border-t-primary rounded-full animate-spin" /></div>
      ) : pesananList.length === 0 ? (
        <Card className="text-center py-12"><p className="text-dark/50 text-lg">Belum ada pesanan.</p></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {pesananList.map(p => (
            <Card key={p.id} className="p-4 cursor-pointer" onClick={() => { setSelected(p); setBuktiFile(null); setError(null) }}>
              <div className="flex items-center justify-between mb-2">
                <Badge variant={STATUS_CONFIG[p.status].variant}>{STATUS_CONFIG[p.status].label}</Badge>
                <span className="text-dark/50 text-xs">{formatTgl(p.created_at)}</span>
              </div>
              <p className="font-bold text-primary">{formatRupiah(p.total_harga)}</p>
              {p.catatan_admin && <p className="text-dark/60 text-xs mt-1 italic">"{p.catatan_admin}"</p>}
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white border-4 border-dark shadow-brutal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-dark">Detail Pesanan</h2>
              <Badge variant={STATUS_CONFIG[selected.status].variant}>{STATUS_CONFIG[selected.status].label}</Badge>
            </div>

            <div className="border-2 border-dark rounded-xl overflow-hidden mb-4">
              {(selected.pesanan_item || []).map((item: any) => (
                <div key={item.id} className="flex gap-3 items-center p-3 border-b border-dark/20 last:border-b-0">
                  <div className="w-10 h-10 rounded-lg border border-dark overflow-hidden shrink-0 bg-background">
                    {item.produk_merchant?.foto_url ? <img src={item.produk_merchant.foto_url} alt="" className="w-full h-full object-cover" /> : <span className="flex h-full items-center justify-center">🛍️</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-dark text-sm">{item.produk_merchant?.nama}</p>
                    <p className="text-dark/60 text-xs">Ukuran: {item.produk_varian?.ukuran} · {item.qty}x</p>
                  </div>
                  <p className="font-bold text-sm">{formatRupiah(item.qty * item.harga_satuan)}</p>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-background font-bold text-dark">
                <span>Total</span><span>{formatRupiah(selected.total_harga)}</span>
              </div>
            </div>

            {selected.bukti_transfer_url && (
              <div className="mb-4">
                <p className="font-bold text-dark text-sm mb-2">Bukti Transfer:</p>
                <img src={selected.bukti_transfer_url} alt="Bukti" className="w-full max-h-40 object-contain rounded-xl border-2 border-dark" />
              </div>
            )}

            {selected.status === 'menunggu_pembayaran' && (
              <div className="mb-4">
                <label className="block font-bold text-dark text-sm mb-2">
                  {selected.bukti_transfer_url ? 'Ganti Bukti Transfer' : 'Upload Bukti Transfer'}
                </label>
                {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
                <input type="file" accept="image/*" className="w-full border-2 border-dark rounded-xl px-4 py-2.5 mb-3" onChange={e => setBuktiFile(e.target.files?.[0] || null)} />
                <Button variant="primary" onClick={handleUploadBukti} disabled={!buktiFile || uploading} className="w-full">
                  {uploading ? 'Mengupload...' : '📤 Upload Bukti'}
                </Button>
              </div>
            )}

            {selected.catatan_admin && (
              <div className="bg-background border-2 border-dark rounded-xl p-3 mb-4">
                <p className="font-bold text-dark text-sm">Catatan Admin:</p>
                <p className="text-dark/70 text-sm italic">"{selected.catatan_admin}"</p>
              </div>
            )}

            <Button variant="dark" onClick={() => setSelected(null)} className="w-full">Tutup</Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi + Commit**

```bash
npx tsc --noEmit
git add src/app/ortu/merchant/pesanan/page.tsx
git commit -m "feat: add ortu merchant order history page"
```

---

### Task 9: Widget Dashboard Ortu + Push GitHub

**Files:**
- Modify: `src/app/ortu/dashboard/page.tsx`

- [ ] **Step 1: Tambahkan import di atas file `src/app/ortu/dashboard/page.tsx`**

```typescript
import Link from 'next/link'
import type { StatusPesanan } from '@/lib/types'

const STATUS_CONFIG_PESANAN: Record<StatusPesanan, { label: string; variant: 'primary' | 'secondary' | 'accent' | 'dark' }> = {
  menunggu_pembayaran: { label: 'Menunggu Bayar', variant: 'accent' },
  lunas:               { label: 'Lunas',           variant: 'secondary' },
  diproses:            { label: 'Diproses',         variant: 'dark' },
  siap_diambil:        { label: 'Siap Diambil ✅',  variant: 'primary' },
}
```

- [ ] **Step 2: Tambahkan fetch pesanan terbaru di dalam useEffect/fetch function yang sudah ada**

```typescript
// Di dalam fungsi fetch data (setelah ambil data siswa):
const { data: pesananTerbaru } = await supabase
  .from('pesanan_merchant')
  .select('id, status, total_harga, created_at')
  .eq('siswa_id', siswaData.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
// Simpan ke state: setPesananTerbaru(pesananTerbaru)
```

- [ ] **Step 3: Tambahkan widget card di JSX (setelah card-card yang sudah ada)**

```tsx
{pesananTerbaru && (
  <Link href="/ortu/merchant/pesanan">
    <Card hoverable className="border-2 border-dark p-4 cursor-pointer">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-dark text-sm">🛒 Pesanan Terbaru</p>
          <p className="text-primary font-bold">{formatRupiah(pesananTerbaru.total_harga)}</p>
        </div>
        <Badge variant={STATUS_CONFIG_PESANAN[pesananTerbaru.status as StatusPesanan]?.variant || 'dark'}>
          {STATUS_CONFIG_PESANAN[pesananTerbaru.status as StatusPesanan]?.label || pesananTerbaru.status}
        </Badge>
      </div>
    </Card>
  </Link>
)}
```

- [ ] **Step 4: Verifikasi TypeScript keseluruhan**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit dan push ke GitHub**

```bash
git add src/app/ortu/dashboard/page.tsx
git commit -m "feat: add merchant latest order widget to ortu dashboard"
git push https://<GITHUB_TOKEN>@github.com/sigertaekwondoclub-cyber/management_dojang.git master
```

---

## Verification Plan

### Automated Tests
```bash
npx tsc --noEmit
```

### Manual Verification
1. 4 tabel baru muncul di Supabase Dashboard → Table Editor
2. Storage bucket `merchant` ada dan public
3. Admin: tambah produk dengan varian → muncul di list → toggle aktif/nonaktif bekerja
4. Ortu: buka toko → pilih produk → tambah keranjang → counter badge bertambah
5. Ortu: checkout → pesanan terbuat di DB → upload bukti transfer → redirect ke riwayat
6. Admin: verifikasi pesanan → update status `lunas` → `diproses` → `siap_diambil`
7. Ortu: status pesanan berubah di riwayat pesanan
8. Dashboard ortu: widget pesanan terbaru tampil dengan status yang benar
