'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { PesananMerchant, StatusPesanan } from '@/lib/types'

const supabase = createClient()

const STATUS_CONFIG: Record<StatusPesanan, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark' }> = {
  menunggu_pembayaran: { label: 'Menunggu Bayar', color: 'accent' },
  lunas:               { label: 'Lunas',           color: 'secondary' },
  diproses:            { label: 'Diproses',         color: 'dark' },
  siap_diambil:        { label: 'Siap Diambil',     color: 'primary' },
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
    await supabase.from('pesanan_merchant').update({ status: newStatus, catatan_admin: catatanAdmin || null }).eq('id', selected.id)
    setSaving(false)
    setSelected(null)
    fetchPesanan()
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
                  <Badge color={STATUS_CONFIG[p.status].color}>{STATUS_CONFIG[p.status].label}</Badge>
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
              <select className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow" value={newStatus} onChange={e => setNewStatus(e.target.value as StatusPesanan)}>
                {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-bold text-dark text-sm mb-1">Catatan Admin (opsional)</label>
              <textarea className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow resize-none" rows={2} value={catatanAdmin} onChange={e => setCatatanAdmin(e.target.value)} placeholder="Catatan untuk ortu..." />
            </div>
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleUpdate} disabled={saving} className="flex-1">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
              <Button variant="secondary" onClick={() => setSelected(null)}>Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
