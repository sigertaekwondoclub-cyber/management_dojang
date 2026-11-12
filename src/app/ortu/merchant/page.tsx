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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-dark">🛒 Toko Club</h1>
          <p className="text-dark/60 mt-1">Produk resmi Siger Taekwondo Club</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ortu/merchant/pesanan">
            <Button variant="secondary" className="text-sm">
              📦 Pesanan Saya
            </Button>
          </Link>
          <Link href="/ortu/merchant/keranjang">
            <Button variant="primary" className="relative text-sm">
              🛒 Keranjang
              {totalItem > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-accent border-2 border-dark rounded-full text-xs font-bold flex items-center justify-center text-dark">
                  {totalItem}
                </span>
              )}
            </Button>
          </Link>
        </div>
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
            const totalStok = varianList.reduce((acc, v) => acc + (v.stok || 0), 0)
            const selVarianId = selectedVarian[p.id]
            const selVarian = varianList.find(v => v.id === selVarianId)
            const isAdded = addedIds.includes(p.id)
            const currentQty = qty[p.id] || 1

            // Logika teks dan status tombol
            let btnLabel = '+ Keranjang'
            let btnVariant: 'primary' | 'secondary' | 'accent' = 'accent'
            let btnDisabled = false

            if (totalStok === 0) {
              btnLabel = 'Stok Habis'
              btnVariant = 'secondary'
              btnDisabled = true
            } else if (!selVarianId) {
              btnLabel = 'Pilih Ukuran'
              btnVariant = 'secondary'
              btnDisabled = true
            } else if (selVarian && selVarian.stok === 0) {
              btnLabel = 'Ukuran Habis'
              btnVariant = 'secondary'
              btnDisabled = true
            } else if (isAdded) {
              btnLabel = '✓ Ditambahkan!'
              btnVariant = 'primary'
              btnDisabled = false
            }

            return (
              <Card key={p.id} className="flex flex-col p-0 overflow-hidden">
                <div className="w-full aspect-square bg-background border-b-2 border-dark overflow-hidden">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nama} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <Badge color="secondary" className="text-xs">{p.kategori}</Badge>
                    <span className="text-[11px] font-bold text-dark/50">
                      {totalStok > 0 ? `Total stok: ${totalStok}` : 'Habis'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-dark text-sm leading-tight">{p.nama}</h3>
                    {p.deskripsi && (
                      <p className="text-dark/60 text-xs mt-0.5 line-clamp-1" title={p.deskripsi}>
                        {p.deskripsi}
                      </p>
                    )}
                  </div>
                  <p className="text-primary font-bold">{formatRupiah(p.harga)}</p>

                  <select
                    className="w-full border-2 border-dark rounded-lg px-2 py-1.5 text-sm font-sans text-dark bg-white focus:outline-none"
                    value={selVarianId || ''}
                    onChange={e => {
                      const vId = e.target.value
                      setSelectedVarian(prev => ({ ...prev, [p.id]: vId }))
                      const chosen = varianList.find(v => v.id === vId)
                      if (chosen && chosen.stok > 0) {
                        setQty(prev => ({ ...prev, [p.id]: Math.min(prev[p.id] || 1, chosen.stok) }))
                      }
                    }}
                  >
                    <option value="">Pilih ukuran</option>
                    {varianList.map(v => (
                      <option key={v.id} value={v.id} disabled={v.stok === 0}>
                        {v.ukuran} {v.stok === 0 ? '(Habis)' : `(${v.stok} tersedia)`}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between gap-2 bg-background p-1.5 rounded-lg border border-dark/20">
                    <span className="text-xs font-bold text-dark/70">Jumlah:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQty(prev => ({ ...prev, [p.id]: Math.max(1, (prev[p.id] || 1) - 1) }))}
                        disabled={currentQty <= 1}
                        className="w-7 h-7 border-2 border-dark rounded-lg font-bold text-dark bg-white hover:bg-background disabled:opacity-40 transition-colors"
                      >
                        −
                      </button>
                      <span className="font-bold text-dark w-6 text-center text-sm">{currentQty}</span>
                      <button
                        onClick={() => setQty(prev => ({ ...prev, [p.id]: Math.min(selVarian?.stok || 99, (prev[p.id] || 1) + 1) }))}
                        disabled={!selVarian || selVarian.stok <= 0 || currentQty >= selVarian.stok}
                        className="w-7 h-7 border-2 border-dark rounded-lg font-bold text-dark bg-white hover:bg-background disabled:opacity-40 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <Button
                    variant={btnVariant}
                    onClick={() => handleTambah(p)}
                    disabled={btnDisabled}
                    className="w-full text-sm mt-auto"
                  >
                    {btnLabel}
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
