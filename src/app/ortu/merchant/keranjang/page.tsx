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
  
  // State Rekening
  const [bankInfo, setBankInfo] = useState({
    bank: 'BCA',
    nomor: '1234567890',
    atasNama: 'Siger Taekwondo Club'
  })

  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('siswa_id').eq('id', user.id).single()
        .then(({ data }) => setSiswaId(data?.siswa_id || null))
    })

    // Fetch rekening dari pengaturan_club
    supabase.from('pengaturan_club').select('*').limit(1).single()
      .then(({ data }) => {
        if (data) {
          // Gunakan rekening merchant jika diisi, jika tidak gunakan rekening utama iuran
          const bank = data.merchant_bank || data.rekening_bank || 'BCA'
          const nomor = data.merchant_nomor || data.rekening_nomor || '1234567890'
          const atasNama = data.merchant_atas_nama || data.rekening_atas_nama || 'Siger Taekwondo Club'
          setBankInfo({ bank, nomor, atasNama })
        }
      })
  }, [])

  const handleCheckout = async () => {
    if (!siswaId) { setError('Data siswa tidak ditemukan.'); return }
    if (items.length === 0) return
    setCheckingOut(true)
    setError(null)

    const { data: pesanan, error: err } = await supabase.from('pesanan_merchant')
      .insert({ siswa_id: siswaId, total_harga: totalHarga, status: 'menunggu_pembayaran' })
      .select().single()

    if (err || !pesanan) {
      setError('Gagal membuat pesanan: ' + (err?.message || ''))
      setCheckingOut(false)
      return
    }

    try {
      for (const item of items) {
        await supabase.from('pesanan_item').insert({
          pesanan_id: pesanan.id,
          produk_id: item.produk.id,
          varian_id: item.varian.id,
          qty: item.qty,
          harga_satuan: item.produk.harga
        })
        await supabase.from('produk_varian').update({ stok: Math.max(0, item.varian.stok - item.qty) }).eq('id', item.varian.id)
      }

      setPesananTotal(totalHarga)
      clearKeranjang()
      setPesananId(pesanan.id)
    } catch (e: any) {
      setError(e.message || 'Gagal checkout.')
    } finally {
      setCheckingOut(false)
    }
  }

  const handleUploadBukti = async () => {
    if (!buktiFile || !pesananId) return
    setUploadingBukti(true)
    setError(null)

    const ext = buktiFile.name.split('.').pop()
    const { data: up, error: upErr } = await supabase.storage.from('merchant').upload(`bukti/${pesananId}.${ext}`, buktiFile, { upsert: true })
    if (upErr) {
      setError('Gagal upload: ' + upErr.message)
      setUploadingBukti(false)
      return
    }

    const url = supabase.storage.from('merchant').getPublicUrl(up.path).data.publicUrl
    await supabase.from('pesanan_merchant').update({ bukti_transfer_url: url, status: 'menunggu_verifikasi' }).eq('id', pesananId)
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
            <p className="text-dark font-bold text-lg">{bankInfo.bank} · {bankInfo.nomor}</p>
            <p className="text-dark/60 text-sm">a/n {bankInfo.atasNama}</p>
            <div className="border-t border-dark/20 mt-3 pt-3">
              <p className="text-dark font-bold">Total: {formatRupiah(pesananTotal)}</p>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm mb-3 font-bold">{error}</div>}
          <div className="mb-4">
            <label className="block font-bold text-dark text-sm mb-2 text-left">Upload Bukti Transfer</label>
            <input type="file" accept="image/*" className="w-full border-2 border-dark rounded-xl px-4 py-2.5" onChange={e => setBuktiFile(e.target.files?.[0] || null)} />
          </div>
          <Button variant="primary" onClick={handleUploadBukti} disabled={!buktiFile || uploadingBukti} className="w-full mb-3">
            {uploadingBukti ? 'Mengupload...' : '📤 Upload Bukti Transfer'}
          </Button>
          <Link href="/ortu/merchant/pesanan">
            <Button variant="secondary" className="w-full">Lihat Riwayat Pesanan</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ortu/merchant">
          <button className="text-dark font-bold hover:text-primary transition-colors">← Lanjut Belanja</button>
        </Link>
        <h1 className="text-2xl font-bold font-sans text-dark">🛒 Keranjang</h1>
      </div>

      {items.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-4xl mb-4">🛒</p>
          <p className="text-dark/50 text-lg mb-4">Keranjang kosong</p>
          <Link href="/ortu/merchant">
            <Button variant="primary">Belanja Sekarang</Button>
          </Link>
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
          {error && <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 mb-4 text-red-700 text-sm font-bold">{error}</div>}
          <Button variant="primary" onClick={handleCheckout} disabled={checkingOut} className="w-full">
            {checkingOut ? 'Memproses...' : '✅ Checkout & Buat Pesanan'}
          </Button>
        </>
      )}
    </div>
  )
}
