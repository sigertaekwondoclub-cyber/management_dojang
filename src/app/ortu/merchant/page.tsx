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

  useEffect(() => {
    fetchProduk()
  }, [fetchProduk])

  const filtered = filterKategori === 'Semua' ? produkList : produkList.filter(p => p.kategori === filterKategori)

  const handleTambah = (p: ProdukMerchant) => {
    const varian = (p.produk_varian || []).find(v => v.id === selectedVarian[p.id])
    if (!varian) return
    const jumlah = qty[p.id] || 1
    tambahItem(p, varian, jumlah)
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
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-accent border-2 border-dark rounded-full text-xs font-bold flex items-center justify-center text-dark">{totalItem}</span>
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
                  <Badge color="secondary" className="self-start text-xs">{p.kategori}</Badge>
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
                  <Button variant={isAdded ? 'primary' : stokHabis ? 'secondary' : 'accent'} onClick={() => handleTambah(p)} disabled={stokHabis || !selectedVarian[p.id]} className="w-full text-sm">
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
