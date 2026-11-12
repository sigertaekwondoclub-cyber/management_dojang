'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { KeranjangItem, ProdukMerchant, ProdukVarian } from '@/lib/types'

const STORAGE_KEY = 'siger_keranjang_items'

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
  const [isInitialized, setIsInitialized] = useState(false)

  // Muat dari localStorage saat client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setItems(parsed)
        }
      }
    } catch (e) {
      console.error('Gagal membaca keranjang dari storage:', e)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Simpan ke localStorage setiap ada perubahan setelah initial load
  useEffect(() => {
    if (!isInitialized) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (e) {
      console.error('Gagal menyimpan keranjang ke storage:', e)
    }
  }, [items, isInitialized])

  const tambahItem = (produk: ProdukMerchant, varian: ProdukVarian, qty: number) => {
    if (varian.stok <= 0) return
    const safeQty = Math.max(1, Math.min(qty, varian.stok))

    setItems(prev => {
      const existing = prev.find(i => i.varian.id === varian.id)
      if (existing) {
        return prev.map(i =>
          i.varian.id === varian.id
            ? { ...i, qty: Math.min(i.qty + safeQty, varian.stok) }
            : i
        )
      }
      return [...prev, { produk, varian, qty: safeQty }]
    })
  }

  const hapusItem = (varianId: string) =>
    setItems(prev => prev.filter(i => i.varian.id !== varianId))

  const updateQty = (varianId: string, qty: number) => {
    if (qty <= 0) {
      hapusItem(varianId)
      return
    }
    setItems(prev => prev.map(i => {
      if (i.varian.id !== varianId) return i
      const safeQty = Math.min(qty, i.varian.stok)
      return { ...i, qty: safeQty }
    }))
  }

  const clearKeranjang = () => {
    setItems([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

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
