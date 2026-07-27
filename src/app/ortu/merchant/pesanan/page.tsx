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

  useEffect(() => {
    fetchPesanan()
  }, [fetchPesanan])

  const handleUploadBukti = async () => {
    if (!buktiFile || !selected) return
    setUploading(true)
    setError(null)
    const ext = buktiFile.name.split('.').pop()
    const { data: up, error: upErr } = await supabase.storage.from('merchant').upload(`bukti/${selected.id}.${ext}`, buktiFile, { upsert: true })
    if (upErr) {
      setError('Gagal upload: ' + upErr.message)
      setUploading(false)
      return
    }
    const url = supabase.storage.from('merchant').getPublicUrl(up.path).data.publicUrl
    await supabase.from('pesanan_merchant').update({ bukti_transfer_url: url }).eq('id', selected.id)
    setUploading(false)
    setSelected(null)
    fetchPesanan()
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
                <Badge color={STATUS_CONFIG[p.status].color}>{STATUS_CONFIG[p.status].label}</Badge>
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
              <Badge color={STATUS_CONFIG[selected.status].color}>{STATUS_CONFIG[selected.status].label}</Badge>
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
                {error && <div className="text-red-600 text-sm mb-2 font-bold">{error}</div>}
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

            <Button variant="secondary" onClick={() => setSelected(null)} className="w-full">Tutup</Button>
          </div>
        </div>
      )}
    </div>
  )
}
