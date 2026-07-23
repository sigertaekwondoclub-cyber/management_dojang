'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { HonorPelatih } from '@/lib/types'

type HonorWithPelatih = HonorPelatih & { pelatih: { nama: string } }

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function AdminHonorPage() {
  const now = new Date()

  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))
  const [honorList, setHonorList] = useState<HonorWithPelatih[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchHonor = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('honor_pelatih')
      .select('*, pelatih:pelatih_id(nama)')
      .eq('bulan', parseInt(filterBulan))
      .eq('tahun', parseInt(filterTahun))
      .order('honor_diterima', { ascending: false })
    setHonorList((data || []) as HonorWithPelatih[])
    setLoading(false)
  }, [filterBulan, filterTahun])

  useEffect(() => { fetchHonor() }, [fetchHonor])

  const handleTandaiDibayar = async (id: string) => {
    setActionLoading(id)
    await supabase.from('honor_pelatih').update({
      status_dibayar: true,
      tgl_dibayar: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    await fetchHonor()
    setActionLoading(null)
  }

  const totalHonor = honorList.reduce((s, h) => s + Number(h.honor_diterima), 0)
  const totalDibayar = honorList.filter(h => h.status_dibayar).reduce((s, h) => s + Number(h.honor_diterima), 0)
  const totalBelum = honorList.filter(h => !h.status_dibayar).reduce((s, h) => s + Number(h.honor_diterima), 0)

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">🏆 Honor Pelatih</h1>
          <p className="text-dark/60 font-sans mt-1">Kelola pembayaran honor pelatih per bulan</p>
        </div>
        <a href="/admin/honor/generate">
          <Button variant="primary">⚡ Hitung Honor Baru</Button>
        </a>
      </div>

      {/* Filter */}
      <Card>
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark">Bulan</label>
            <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[150px]">
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
              ))}
            </select>
          </div>
          <Input label="Tahun" type="number" value={filterTahun}
            onChange={e => setFilterTahun(e.target.value)} className="max-w-[120px]" />
          <Button variant="secondary" onClick={fetchHonor} disabled={loading}>
            {loading ? 'Memuat...' : '🔍 Terapkan'}
          </Button>
        </div>
      </Card>

      {/* Summary Stats */}
      {honorList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Pool Honor', val: formatRupiah(totalHonor), bg: 'bg-dark text-white border-dark' },
            { label: '✅ Sudah Dibayar', val: formatRupiah(totalDibayar), bg: 'bg-primary/20 border-primary' },
            { label: '⏳ Belum Dibayar', val: formatRupiah(totalBelum), bg: 'bg-accent/20 border-accent' },
          ].map(s => (
            <Card key={s.label} className={`${s.bg} border-2 text-center p-4`}>
              <div className="text-xl font-bold font-sans">{s.val}</div>
              <div className="text-sm font-sans mt-1 opacity-70">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Tabel */}
      {loading ? (
        <Card className="text-center py-12 text-dark/50 font-sans">Memuat data...</Card>
      ) : honorList.length === 0 ? (
        <Card className="text-center py-16 text-dark/50 font-sans">
          <div className="text-4xl mb-3">🏆</div>
          <p>Belum ada data honor untuk periode ini.</p>
          <p className="text-sm mt-2">Gunakan tombol "Hitung Honor Baru" untuk generate.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {honorList.map(honor => (
            <Card key={honor.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold font-sans text-dark text-lg">{honor.pelatih?.nama || '-'}</h3>
                  <Badge color={honor.status_dibayar ? 'primary' : 'accent'}>
                    {honor.status_dibayar ? '✅ Dibayar' : '⏳ Belum Dibayar'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-dark/60 font-sans">
                  <span>{BULAN_NAMES[honor.bulan]} {honor.tahun}</span>
                  <span>·</span>
                  <span>{honor.jumlah_sesi_mengajar} sesi dari {honor.total_sesi_semua_pelatih} total</span>
                  <span>·</span>
                  <span>Pool: {formatRupiah(honor.total_pool_honor)}</span>
                  {honor.tgl_dibayar && (
                    <>
                      <span>·</span>
                      <span>Dibayar: {new Date(honor.tgl_dibayar + 'T00:00:00').toLocaleDateString('id-ID')}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(honor.honor_diterima)}</div>
                  <div className="text-xs text-dark/50 font-sans">honor diterima</div>
                </div>
                {!honor.status_dibayar && (
                  <Button
                    variant="primary"
                    onClick={() => handleTandaiDibayar(honor.id)}
                    disabled={actionLoading === honor.id}
                    className="text-sm py-2 px-4"
                  >
                    {actionLoading === honor.id ? '⏳' : '💳 Tandai Dibayar'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
