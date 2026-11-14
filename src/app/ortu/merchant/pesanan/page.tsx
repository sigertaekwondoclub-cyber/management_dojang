'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { uploadBuktiTransferMerchantAction, batalkanPesananMerchantAction, getOrtuPesananAction } from '@/app/ortu/merchant/actions'
import type { PesananMerchant, StatusPesanan } from '@/lib/types'

// Supabase client hanya digunakan untuk mengambil info rekening bank (data publik, tidak perlu RLS bypass)
const supabase = createClient()

const STATUS_CONFIG: Record<StatusPesanan, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark' }> = {
  menunggu_pembayaran: { label: 'Menunggu Bayar', color: 'accent' },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi', color: 'accent' },
  lunas:               { label: 'Lunas',           color: 'secondary' },
  diproses:            { label: 'Diproses',         color: 'dark' },
  siap_diambil:        { label: 'Siap Diambil ✅',  color: 'primary' },
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
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // State Rekening Pembayaran
  const [bankInfo, setBankInfo] = useState({
    bank: 'GoPay',
    nomor: '082176721334',
    atasNama: 'Siger Taekwondo Club'
  })

  // Fetch Pengaturan Rekening (data publik, aman lewat client)
  useEffect(() => {
    supabase.from('pengaturan_club').select('*').limit(1).single()
      .then(({ data }) => {
        if (data) {
          const bank = data.merchant_bank || data.rekening_bank || 'GoPay'
          const nomor = data.merchant_nomor || data.rekening_nomor || '082176721334'
          const atasNama = data.merchant_atas_nama || data.rekening_atas_nama || 'Siger Taekwondo Club'
          setBankInfo({ bank, nomor, atasNama })
        }
      })
  }, [])

  // Gunakan server action untuk bypass RLS — data pesanan milik ortu selalu terbaca dengan benar
  const fetchPesanan = useCallback(async () => {
    setLoading(true)
    const res = await getOrtuPesananAction()
    if (res.success) {
      setPesananList(res.pesanan)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPesanan()
  }, [fetchPesanan])

  const handleUploadBukti = async () => {
    if (!buktiFile || !selected) return
    setUploading(true)
    setError(null)
    setSuccessMsg(null)

    const fd = new FormData()
    fd.append('pesananId', selected.id)
    fd.append('file', buktiFile)

    const res = await uploadBuktiTransferMerchantAction(fd)
    if (!res.success) {
      setError(res.message || 'Gagal mengupload bukti transfer.')
      setUploading(false)
      return
    }

    setUploading(false)
    setSuccessMsg(res.message || 'Bukti transfer berhasil dikirim!')
    setBuktiFile(null)
    await fetchPesanan()
    setSelected(prev => prev ? { ...prev, bukti_transfer_url: res.url || prev.bukti_transfer_url, status: 'menunggu_verifikasi' } : null)
  }

  const handleBatalkan = async () => {
    if (!selected) return
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini? Stok produk akan dikembalikan.')) return

    setCancelling(true)
    setError(null)
    setSuccessMsg(null)

    const res = await batalkanPesananMerchantAction(selected.id)
    if (!res.success) {
      setError(res.message || 'Gagal membatalkan pesanan.')
      setCancelling(false)
      return
    }

    setCancelling(false)
    setSelected(null)
    fetchPesanan()
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans text-dark">📦 Riwayat Pesanan</h1>
          <p className="text-dark/60 text-xs mt-0.5">Daftar pesanan produk toko club anak Anda</p>
        </div>
        <Link href="/ortu/merchant">
          <Button variant="secondary" className="text-xs">
            🛒 Belanja Lagi
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-dark border-t-primary rounded-full animate-spin" />
        </div>
      ) : pesananList.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-dark/60 text-base mb-4">Belum ada riwayat pesanan.</p>
          <Link href="/ortu/merchant">
            <Button variant="primary">Kunjungi Toko Club</Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pesananList.map(p => (
            <Card
              key={p.id}
              className="p-4 cursor-pointer hover:shadow-brutal transition-shadow"
              onClick={() => { setSelected(p); setBuktiFile(null); setError(null); setSuccessMsg(null) }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <Badge color={STATUS_CONFIG[p.status].color}>{STATUS_CONFIG[p.status].label}</Badge>
                <span className="text-dark/50 text-xs">{formatTgl(p.created_at)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <div>
                  <p className="font-bold text-dark text-sm">
                    🥋 {(p.siswa as any)?.nama || 'Siswa'}
                  </p>
                  <p className="text-dark/50 text-xs mt-0.5">
                    {p.pesanan_item?.length || 0} item pesanan
                  </p>
                </div>
                <p className="font-bold text-primary text-base">{formatRupiah(p.total_harga)}</p>
              </div>
              {p.catatan_admin && (
                <p className="text-dark/70 text-xs mt-2 bg-background p-2 rounded-lg border border-dark/20 italic">
                  Catatan Admin: "{p.catatan_admin}"
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white border-4 border-dark shadow-brutal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-dark">Detail Pesanan</h2>
                <p className="text-dark/60 text-xs">Untuk: {(selected.siswa as any)?.nama || 'Siswa'} · {formatTgl(selected.created_at)}</p>
              </div>
              <Badge color={STATUS_CONFIG[selected.status].color}>{STATUS_CONFIG[selected.status].label}</Badge>
            </div>

            {error && (
              <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 mb-4 text-red-700 text-xs font-bold">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-green-100 border-2 border-green-500 rounded-xl p-3 mb-4 text-green-800 text-xs font-bold">
                {successMsg}
              </div>
            )}

            {/* Jika masih menunggu bayar, tampilkan tujuan transfer rekening */}
            {selected.status === 'menunggu_pembayaran' && (
              <div className="bg-primary/10 border-2 border-dark rounded-xl p-3.5 mb-4 text-left">
                <p className="font-bold text-dark text-xs mb-1">Silakan transfer pembayaran ke:</p>
                <p className="text-dark font-bold text-base">{bankInfo.bank} · {bankInfo.nomor}</p>
                <p className="text-dark/60 text-xs">a/n {bankInfo.atasNama}</p>
                <div className="border-t border-dark/20 mt-2 pt-2 flex justify-between font-bold text-sm">
                  <span>Nominal Pas:</span>
                  <span className="text-primary">{formatRupiah(selected.total_harga)}</span>
                </div>
              </div>
            )}

            {/* Rincian Item */}
            <div className="border-2 border-dark rounded-xl overflow-hidden mb-4">
              {(selected.pesanan_item || []).map((item: any) => (
                <div key={item.id} className="flex gap-3 items-center p-3 border-b border-dark/20 last:border-b-0">
                  <div className="w-11 h-11 rounded-lg border border-dark overflow-hidden shrink-0 bg-background">
                    {item.produk_merchant?.foto_url ? (
                      <img src={item.produk_merchant.foto_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xl">🛍️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-dark text-sm truncate">{item.produk_merchant?.nama}</p>
                    <p className="text-dark/60 text-xs">Ukuran: {item.produk_varian?.ukuran} · {item.qty}x · {formatRupiah(item.harga_satuan)}</p>
                  </div>
                  <p className="font-bold text-sm shrink-0">{formatRupiah(item.qty * item.harga_satuan)}</p>
                </div>
              ))}
              <div className="flex justify-between px-3.5 py-2.5 bg-background font-bold text-dark text-sm">
                <span>Total Tagihan</span>
                <span className="text-primary text-base">{formatRupiah(selected.total_harga)}</span>
              </div>
            </div>

            {/* Bukti Transfer yang ada */}
            {selected.bukti_transfer_url && (
              <div className="mb-4">
                <p className="font-bold text-dark text-xs mb-2">Bukti Transfer Terkirim:</p>
                <a href={selected.bukti_transfer_url} target="_blank" rel="noopener noreferrer" className="block relative group">
                  <img
                    src={selected.bukti_transfer_url}
                    alt="Bukti Transfer"
                    className="w-full max-h-48 object-contain rounded-xl border-2 border-dark bg-background"
                  />
                  <div className="text-[11px] text-center text-primary font-bold mt-1">
                    🔍 Klik untuk melihat ukuran penuh
                  </div>
                </a>
              </div>
            )}

            {/* Form Upload Bukti Transfer */}
            {(selected.status === 'menunggu_pembayaran' || selected.status === 'menunggu_verifikasi') && (
              <div className="mb-4 bg-background p-3 rounded-xl border-2 border-dark/20">
                <label className="block font-bold text-dark text-xs mb-1.5">
                  {selected.bukti_transfer_url ? 'Unggah Ulang Bukti Transfer' : 'Unggah Bukti Transfer'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full border-2 border-dark rounded-xl px-3 py-2 text-xs bg-white text-dark mb-2.5"
                  onChange={e => setBuktiFile(e.target.files?.[0] || null)}
                />
                <Button
                  variant="primary"
                  onClick={handleUploadBukti}
                  disabled={!buktiFile || uploading}
                  className="w-full text-xs py-2"
                >
                  {uploading ? 'Mengupload Bukti...' : '📤 Kirim Bukti Transfer'}
                </Button>
              </div>
            )}

            {/* Catatan Admin */}
            {selected.catatan_admin && (
              <div className="bg-background border-2 border-dark rounded-xl p-3 mb-4">
                <p className="font-bold text-dark text-xs mb-0.5">Catatan Admin:</p>
                <p className="text-dark/70 text-xs italic">"{selected.catatan_admin}"</p>
              </div>
            )}

            {/* Tombol Batalkan Pesanan jika status masih menunggu_pembayaran */}
            {selected.status === 'menunggu_pembayaran' && (
              <div className="mb-4">
                <button
                  onClick={handleBatalkan}
                  disabled={cancelling}
                  className="w-full text-xs text-red-600 hover:text-red-800 font-bold py-2 border-2 border-dashed border-red-300 hover:border-red-500 rounded-xl transition-colors"
                >
                  {cancelling ? 'Membatalkan...' : '🗑️ Batalkan Pesanan Ini'}
                </button>
              </div>
            )}

            <Button variant="secondary" onClick={() => setSelected(null)} className="w-full">
              Tutup
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
