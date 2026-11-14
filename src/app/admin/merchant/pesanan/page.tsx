'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { batalkanPesananMerchantAction, getAdminPesananAction, updatePesananStatusAdminAction } from '@/app/ortu/merchant/actions'
import type { PesananMerchant, StatusPesanan } from '@/lib/types'
import { formatRupiah, formatTanggal as formatTgl } from '@/lib/utils'

const STATUS_CONFIG: Record<StatusPesanan, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark' }> = {
  menunggu_pembayaran: { label: 'Menunggu Bayar', color: 'accent' },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi', color: 'accent' },
  lunas:               { label: 'Lunas',           color: 'secondary' },
  diproses:            { label: 'Diproses',         color: 'dark' },
  siap_diambil:        { label: 'Siap Diambil',     color: 'primary' },
}
const STATUS_FLOW: StatusPesanan[] = ['menunggu_pembayaran', 'menunggu_verifikasi', 'lunas', 'diproses', 'siap_diambil']

export default function AdminPesananMerchantPage() {
  const [pesananList, setPesananList] = useState<PesananMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [selected, setSelected] = useState<PesananMerchant | null>(null)
  const [newStatus, setNewStatus] = useState<StatusPesanan>('menunggu_pembayaran')
  const [catatanAdmin, setCatatanAdmin] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const fetchPesanan = useCallback(async () => {
    setLoading(true)
    // Gunakan server action (supabaseAdmin) untuk bypass RLS — admin harus bisa lihat semua pesanan
    const res = await getAdminPesananAction(filterStatus !== 'semua' ? filterStatus : undefined)
    if (res.success) {
      setPesananList(res.pesanan)
    }
    setLoading(false)
  }, [filterStatus])

  useEffect(() => {
    fetchPesanan()
  }, [fetchPesanan])

  const openDetail = (p: PesananMerchant) => {
    setSelected(p)
    setNewStatus(p.status)
    setCatatanAdmin(p.catatan_admin || '')
  }

  const handleUpdate = async () => {
    if (!selected) return
    setSaving(true)

    const res = await updatePesananStatusAdminAction(selected.id, newStatus, catatanAdmin)
    if (!res.success) {
      alert('Gagal update status pesanan: ' + (res.message || ''))
      setSaving(false)
      return
    }

    setSaving(false)
    setSelected(null)
    fetchPesanan()
  }

  const handleBatalkanPesanan = async () => {
    if (!selected) return
    if (!confirm(`Batalkan pesanan ini (${(selected.siswa as any)?.nama || 'Siswa'})? Stok varian produk akan otomatis dikembalikan ke inventaris.`)) {
      return
    }

    setCancelling(true)
    const res = await batalkanPesananMerchantAction(selected.id)
    if (!res.success) {
      alert('Gagal membatalkan pesanan: ' + (res.message || ''))
      setCancelling(false)
      return
    }

    alert('Pesanan berhasil dibatalkan dan stok telah dikembalikan ke inventaris.')
    setCancelling(false)
    setSelected(null)
    fetchPesanan()
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-dark">📦 Pesanan Merchant</h1>
        <p className="text-dark/60 mt-1">Verifikasi pembayaran, proses pengiriman, dan kelola pesanan siswa</p>
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
            <Card key={p.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 cursor-pointer hover:shadow-brutal transition-shadow" onClick={() => openDetail(p)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-dark text-base">{(p.siswa as any)?.nama || '-'}</span>
                  <Badge color={STATUS_CONFIG[p.status].color}>{STATUS_CONFIG[p.status].label}</Badge>
                  {p.bukti_transfer_url && (
                    <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded border border-green-300">
                      Ada Bukti Transfer
                    </span>
                  )}
                </div>
                <p className="text-dark/60 text-xs">
                  {formatTgl(p.created_at)} · {p.pesanan_item?.length || 0} item
                </p>
                <p className="text-primary font-bold text-base mt-1">{formatRupiah(p.total_harga)}</p>
                {p.catatan_admin && (
                  <p className="text-dark/70 text-xs italic mt-1 bg-background px-2 py-1 rounded border border-dark/10">
                    "{p.catatan_admin}"
                  </p>
                )}
              </div>
              <Button variant="secondary" className="shrink-0 text-sm">Lihat Detail →</Button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white border-4 border-dark shadow-brutal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold font-sans text-dark mb-1">📋 Detail Pesanan</h2>
            <p className="text-dark/60 text-sm mb-4">{(selected.siswa as any)?.nama || 'Siswa'} · {formatTgl(selected.created_at)}</p>

            <div className="border-2 border-dark rounded-xl overflow-hidden mb-4">
              {(selected.pesanan_item || []).map((item: any) => (
                <div key={item.id} className="flex gap-3 items-center p-3 border-b border-dark/20 last:border-b-0">
                  <div className="w-10 h-10 rounded-lg border border-dark overflow-hidden shrink-0 bg-background">
                    {item.produk_merchant?.foto_url ? <img src={item.produk_merchant.foto_url} alt="" className="w-full h-full object-cover" /> : <span className="flex h-full items-center justify-center">🛍️</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-dark text-sm truncate">{item.produk_merchant?.nama}</p>
                    <p className="text-dark/60 text-xs">Ukuran: {item.produk_varian?.ukuran} · {item.qty}x · {formatRupiah(item.harga_satuan)}</p>
                  </div>
                  <p className="font-bold text-sm shrink-0">{formatRupiah(item.qty * item.harga_satuan)}</p>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-background font-bold text-dark text-sm">
                <span>Total Tagihan</span>
                <span className="text-primary text-base">{formatRupiah(selected.total_harga)}</span>
              </div>
            </div>

            <div className="mb-4">
              <p className="font-bold text-dark text-sm mb-2">Bukti Transfer:</p>
              {selected.bukti_transfer_url ? (
                <a href={selected.bukti_transfer_url} target="_blank" rel="noopener noreferrer" className="block relative group">
                  <img src={selected.bukti_transfer_url} alt="Bukti Transfer" className="w-full max-h-48 object-contain rounded-xl border-2 border-dark bg-background" />
                  <div className="text-[11px] text-center text-primary font-bold mt-1">
                    🔍 Klik untuk membuka foto resolusi penuh
                  </div>
                </a>
              ) : (
                <div className="border-2 border-dashed border-dark/30 rounded-xl p-4 text-center text-dark/40 text-sm">Belum ada bukti transfer</div>
              )}
            </div>

            <div className="mb-4">
              <label className="block font-bold text-dark text-sm mb-1">Update Status Pesanan</label>
              <select className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow text-sm" value={newStatus} onChange={e => setNewStatus(e.target.value as StatusPesanan)}>
                {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-bold text-dark text-sm mb-1">Catatan Admin (opsional, dapat dilihat ortu)</label>
              <textarea className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow resize-none text-sm" rows={2} value={catatanAdmin} onChange={e => setCatatanAdmin(e.target.value)} placeholder="Misal: Sudah siap diambil di dojo..." />
            </div>

            <div className="flex gap-3 mb-3">
              <Button variant="primary" onClick={handleUpdate} disabled={saving} className="flex-1">
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
              <Button variant="secondary" onClick={() => setSelected(null)}>Tutup</Button>
            </div>

            <div className="pt-2 border-t border-dark/15">
              <button
                onClick={handleBatalkanPesanan}
                disabled={cancelling}
                className="w-full py-2 text-xs font-bold text-red-600 hover:text-red-800 border-2 border-dashed border-red-300 hover:border-red-500 rounded-xl transition-colors"
              >
                {cancelling ? 'Membatalkan...' : '🗑️ Batalkan Pesanan & Kembalikan Stok'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
