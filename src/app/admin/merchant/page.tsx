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

  useEffect(() => {
    fetchProduk()
  }, [fetchProduk])

  const openTambah = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setFotoFile(null)
    setError(null)
    setShowModal(true)
  }

  const openEdit = (p: ProdukMerchant) => {
    setEditId(p.id)
    setForm({
      nama: p.nama,
      kategori: p.kategori,
      harga: String(p.harga),
      deskripsi: p.deskripsi || '',
      varian: (p.produk_varian || []).map(v => ({ ukuran: v.ukuran, stok: v.stok }))
    })
    setFotoFile(null)
    setError(null)
    setShowModal(true)
  }

  const toggleAktif = async (p: ProdukMerchant) => {
    await supabase.from('produk_merchant').update({ status_aktif: !p.status_aktif }).eq('id', p.id)
    fetchProduk()
  }

  const hapusProduk = async (id: string) => {
    if (!confirm('Hapus produk ini? Aksi ini tidak bisa dibatalkan.')) return
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

    setSaving(true)
    setError(null)
    let foto_url: string | null = null

    if (fotoFile) {
      const ext = fotoFile.name.split('.').pop()
      const filename = `produk/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('merchant').upload(filename, fotoFile, { upsert: true })
      if (uploadErr) {
        setError('Gagal upload foto: ' + uploadErr.message)
        setSaving(false)
        return
      }
      foto_url = supabase.storage.from('merchant').getPublicUrl(uploadData.path).data.publicUrl
    }

    try {
      if (editId) {
        const payload: Partial<ProdukMerchant> = {
          nama: form.nama,
          kategori: form.kategori,
          harga: Number(form.harga),
          deskripsi: form.deskripsi || null
        }
        if (foto_url) payload.foto_url = foto_url
        await supabase.from('produk_merchant').update(payload).eq('id', editId)
        await supabase.from('produk_varian').delete().eq('produk_id', editId)
        await supabase.from('produk_varian').insert(form.varian.map(v => ({ produk_id: editId, ukuran: v.ukuran, stok: v.stok })))
      } else {
        const { data: p, error: err } = await supabase.from('produk_merchant')
          .insert({
            nama: form.nama,
            kategori: form.kategori,
            harga: Number(form.harga),
            deskripsi: form.deskripsi || null,
            foto_url,
            status_aktif: true
          })
          .select().single()
        if (err || !p) {
          setError('Gagal menyimpan produk.')
          setSaving(false)
          return
        }
        await supabase.from('produk_varian').insert(form.varian.map(v => ({ produk_id: p.id, ukuran: v.ukuran, stok: v.stok })))
      }
      setShowModal(false)
      fetchProduk()
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan.')
    } finally {
      setSaving(false)
    }
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
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-dark border-t-primary rounded-full animate-spin" />
        </div>
      ) : produkList.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-dark/50 text-lg">Belum ada produk. Tambahkan produk pertama!</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {produkList.map(p => (
            <Card key={p.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4">
              <div className="w-16 h-16 rounded-xl border-2 border-dark overflow-hidden shrink-0 bg-background">
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nama} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-dark">{p.nama}</h3>
                  <Badge color="secondary">{p.kategori}</Badge>
                  <Badge color={p.status_aktif ? 'primary' : 'dark'}>{p.status_aktif ? 'Aktif' : 'Nonaktif'}</Badge>
                </div>
                <p className="text-primary font-bold mt-1">{formatRupiah(p.harga)}</p>
                <p className="text-dark/60 text-sm mt-1">
                  {(p.produk_varian || []).map(v => `${v.ukuran}(${v.stok})`).join(' · ')} — Total: {(p.produk_varian || []).reduce((s, v) => s + v.stok, 0)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button variant="secondary" onClick={() => openEdit(p)}>Edit</Button>
                <Button variant="accent" onClick={() => toggleAktif(p)}>{p.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                <Button variant="secondary" onClick={() => hapusProduk(p.id)} className="bg-red-500 hover:bg-red-600 text-white">Hapus</Button>
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
                <textarea className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow resize-none" rows={3} value={form.deskripsi} onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Masukkan deskripsi produk..." />
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
              <Button variant="secondary" onClick={() => setShowModal(false)}>Batal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
