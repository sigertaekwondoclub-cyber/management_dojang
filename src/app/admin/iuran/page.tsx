'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { Iuran } from '@/lib/types'

type StatusBayar = 'belum_bayar' | 'menunggu_verifikasi' | 'lunas' | 'ditolak'
type IuranWithSiswa = Iuran & { siswa: { nama: string } }

const STATUS_CONFIG: Record<StatusBayar, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark'; icon: string }> = {
  belum_bayar:          { label: 'Belum Bayar',    color: 'accent',    icon: '⏳' },
  menunggu_verifikasi:  { label: 'Menunggu Verif', color: 'secondary', icon: '🔍' },
  lunas:                { label: 'Lunas',           color: 'primary',   icon: '✅' },
  ditolak:              { label: 'Ditolak',          color: 'dark',      icon: '❌' },
}

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function AdminIuranPage() {
  const now = new Date()

  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))
  const [filterStatus, setFilterStatus] = useState<string>('semua')

  const [iuranList, setIuranList] = useState<IuranWithSiswa[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [buktiUrl, setBuktiUrl] = useState<Record<string, string>>({})
  const [catatan, setCatatan] = useState<Record<string, string>>({})

  const fetchIuran = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('iuran')
      .select('*, siswa:siswa_id(nama)')
      .eq('bulan', parseInt(filterBulan))
      .eq('tahun', parseInt(filterTahun))
      .order('created_at', { ascending: false })

    if (filterStatus !== 'semua') {
      query = query.eq('status_bayar', filterStatus)
    }

    const { data } = await query
    setIuranList((data || []) as IuranWithSiswa[])
    setLoading(false)
  }, [filterBulan, filterTahun, filterStatus])

  useEffect(() => { fetchIuran() }, [fetchIuran])

  // Get signed URL for bukti transfer
  const getBuktiUrl = async (iuranId: string, path: string) => {
    if (buktiUrl[iuranId]) return
    const { data } = await supabase.storage
      .from('bukti-transfer')
      .createSignedUrl(path, 60 * 10) // 10 menit
    if (data?.signedUrl) {
      setBuktiUrl(prev => ({ ...prev, [iuranId]: data.signedUrl }))
    }
  }

  const handleTandaiLunas = async (id: string) => {
    setActionLoading(id)
    await supabase.from('iuran').update({
      status_bayar: 'lunas',
      tgl_bayar: new Date().toISOString(),
      metode: 'tunai',
    }).eq('id', id)
    await fetchIuran()
    setActionLoading(null)
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    await supabase.from('iuran').update({
      status_bayar: 'lunas',
      tgl_bayar: new Date().toISOString(),
    }).eq('id', id)
    await fetchIuran()
    setActionLoading(null)
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    await supabase.from('iuran').update({
      status_bayar: 'ditolak',
      catatan: catatan[id] || 'Bukti transfer tidak valid',
    }).eq('id', id)
    await fetchIuran()
    setActionLoading(null)
  }

  // Summary stats
  const totalTagihan = iuranList.length
  const totalLunas = iuranList.filter(i => i.status_bayar === 'lunas').length
  const totalNominalLunas = iuranList.filter(i => i.status_bayar === 'lunas').reduce((s, i) => s + Number(i.nominal), 0)
  const totalMenunggu = iuranList.filter(i => i.status_bayar === 'menunggu_verifikasi').length

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">Kelola Iuran</h1>
          <p className="text-dark/60 font-sans mt-1">Pantau dan verifikasi pembayaran iuran bulanan</p>
        </div>
        <a href="/admin/iuran/generate">
          <Button variant="primary">⚡ Generate Tagihan</Button>
        </a>
      </div>

      {/* Filter */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark">Bulan</label>
            <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[140px]">
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
              ))}
            </select>
          </div>
          <Input label="Tahun" type="number" value={filterTahun}
            onChange={e => setFilterTahun(e.target.value)} className="max-w-[120px]" />
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[180px]">
              <option value="semua">Semua Status</option>
              <option value="belum_bayar">Belum Bayar</option>
              <option value="menunggu_verifikasi">Menunggu Verifikasi</option>
              <option value="lunas">Lunas</option>
              <option value="ditolak">Ditolak</option>
            </select>
          </div>
          <Button variant="secondary" onClick={fetchIuran} disabled={loading}>
            {loading ? 'Memuat...' : '🔍 Terapkan'}
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Tagihan', val: totalTagihan, bg: 'bg-white' },
          { label: '✅ Lunas', val: totalLunas, bg: 'bg-primary/20' },
          { label: '🔍 Menunggu Verif', val: totalMenunggu, bg: 'bg-secondary/20' },
          { label: '💵 Total Terkumpul', val: formatRupiah(totalNominalLunas), bg: 'bg-yellow-100' },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} text-center p-4`}>
            <div className="text-xl font-bold font-sans text-dark">{s.val}</div>
            <div className="text-xs text-dark/60 font-sans mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Tabel Iuran */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <Card className="text-center py-16 text-dark/50 font-sans">Memuat data...</Card>
        ) : iuranList.length === 0 ? (
          <Card className="text-center py-16 text-dark/50 font-sans">
            <div className="text-4xl mb-3">💰</div>
            <p>Tidak ada tagihan untuk periode ini.</p>
          </Card>
        ) : (
          iuranList.map(iuran => {
            const cfg = STATUS_CONFIG[iuran.status_bayar]
            const isLoading = actionLoading === iuran.id
            const buktiPath = iuran.bukti_transfer_url
            return (
              <Card key={iuran.id} className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold font-sans text-dark text-lg">{iuran.siswa?.nama || '-'}</h3>
                      <Badge color={cfg.color}>{cfg.icon} {cfg.label}</Badge>
                    </div>
                    <p className="text-sm text-dark/60 font-sans mt-1">
                      {BULAN_NAMES[iuran.bulan]} {iuran.tahun} · {formatRupiah(iuran.nominal)}
                      {iuran.tgl_bayar && ` · Dibayar ${new Date(iuran.tgl_bayar).toLocaleDateString('id-ID')}`}
                      {iuran.metode && ` (${iuran.metode})`}
                    </p>
                    {iuran.catatan && (
                      <p className="text-sm text-accent font-sans mt-1">📝 {iuran.catatan}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-max">
                    {iuran.status_bayar === 'belum_bayar' && (
                      <Button variant="primary" onClick={() => handleTandaiLunas(iuran.id)} disabled={isLoading} className="text-sm py-2 px-4">
                        {isLoading ? '⏳' : '✅ Tandai Lunas (Tunai)'}
                      </Button>
                    )}

                    {iuran.status_bayar === 'menunggu_verifikasi' && (
                      <div className="flex flex-col gap-2">
                        {buktiPath && !buktiUrl[iuran.id] && (
                          <Button variant="secondary" onClick={() => getBuktiUrl(iuran.id, buktiPath)} className="text-sm py-2 px-4">
                            🖼️ Lihat Bukti Transfer
                          </Button>
                        )}
                        {buktiUrl[iuran.id] && (
                          <a href={buktiUrl[iuran.id]} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-bold text-dark underline font-sans">
                            📎 Buka Bukti Transfer ↗
                          </a>
                        )}
                        <div className="flex gap-2">
                          <Button variant="primary" onClick={() => handleApprove(iuran.id)} disabled={isLoading} className="text-sm py-2 px-3">
                            {isLoading ? '⏳' : '✅ Approve'}
                          </Button>
                          <Button variant="accent" onClick={() => handleReject(iuran.id)} disabled={isLoading} className="text-sm py-2 px-3">
                            {isLoading ? '⏳' : '❌ Tolak'}
                          </Button>
                        </div>
                        <input
                          type="text"
                          placeholder="Alasan penolakan (opsional)"
                          value={catatan[iuran.id] || ''}
                          onChange={e => setCatatan(prev => ({ ...prev, [iuran.id]: e.target.value }))}
                          className="border border-dark/30 rounded-xl px-3 py-2 text-sm font-sans text-dark"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
