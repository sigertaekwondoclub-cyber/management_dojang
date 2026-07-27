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
    if (qty <= 0) {
      hapusItem(varianId)
      return
    }
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
