'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { HonorPelatih } from '@/lib/types'

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function PelatihHonorPage() {
  const supabase = createClient()
  const [honorList, setHonorList] = useState<HonorPelatih[]>([])
  const [loading, setLoading] = useState(true)
  const [namaPelatih, setNamaPelatih] = useState('')

  const fetchHonor = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('pelatih_id, nama')
      .eq('id', user.id)
      .single()

    if (!profile?.pelatih_id) { setLoading(false); return }
    setNamaPelatih(profile.nama || '')

    const { data } = await supabase
      .from('honor_pelatih')
      .select('*')
      .eq('pelatih_id', profile.pelatih_id)
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false })

    setHonorList((data || []) as HonorPelatih[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchHonor() }, [fetchHonor])

  const totalDiterima = honorList.filter(h => h.status_dibayar).reduce((s, h) => s + Number(h.honor_diterima), 0)
  const totalBelum = honorList.filter(h => !h.status_dibayar).reduce((s, h) => s + Number(h.honor_diterima), 0)

  // Group by tahun
  const byTahun: Record<number, HonorPelatih[]> = {}
  for (const h of honorList) {
    if (!byTahun[h.tahun]) byTahun[h.tahun] = []
    byTahun[h.tahun].push(h)
  }
  const sortedTahun = Object.keys(byTahun).map(Number).sort((a, b) => b - a)

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🏆 Honor Saya</h1>
        {namaPelatih && (
          <p className="text-dark/60 font-sans mt-1">Riwayat honor untuk <span className="font-bold text-dark">{namaPelatih}</span></p>
        )}
      </div>

      {/* Summary Cards */}
      {!loading && honorList.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-primary/10 border-primary border-2 text-center p-4">
            <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(totalDiterima)}</div>
            <div className="text-sm text-dark/60 font-sans mt-1">✅ Total Sudah Diterima</div>
          </Card>
          <Card className="bg-accent/10 border-accent border-2 text-center p-4">
            <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(totalBelum)}</div>
            <div className="text-sm text-dark/60 font-sans mt-1">⏳ Menunggu Pembayaran</div>
          </Card>
        </div>
      )}

      {/* List honor */}
      {loading ? (
        <Card className="text-center py-12 text-dark/50 font-sans">Memuat data...</Card>
      ) : honorList.length === 0 ? (
        <Card className="text-center py-16 text-dark/50 font-sans">
          <div className="text-4xl mb-3">🏆</div>
          <p>Belum ada data honor.</p>
          <p className="text-sm mt-2">Data honor akan muncul setelah admin melakukan perhitungan honor bulanan.</p>
        </Card>
      ) : (
        sortedTahun.map(tahun => (
          <div key={tahun} className="flex flex-col gap-3">
            <h2 className="font-bold font-sans text-dark text-lg border-b-2 border-dark pb-2">📅 {tahun}</h2>
            {byTahun[tahun].map(honor => (
              <Card key={honor.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold font-sans text-dark text-lg">{BULAN_NAMES[honor.bulan]}</h3>
                      <Badge color={honor.status_dibayar ? 'primary' : 'accent'}>
                        {honor.status_dibayar ? '✅ Dibayar' : '⏳ Belum Dibayar'}
                      </Badge>
                    </div>
                    {honor.tgl_dibayar && (
                      <p className="text-sm text-dark/60 font-sans mt-1">
                        Dibayar pada {new Date(honor.tgl_dibayar + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(honor.honor_diterima)}</div>
                    <div className="text-xs text-dark/50 font-sans">honor diterima</div>
                  </div>
                </div>

                {/* Breakdown detail */}
                <div className="border-t-2 border-dark/10 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm font-sans">
                  {[
                    { label: 'Sesi Mengajar', val: `${honor.jumlah_sesi_mengajar} sesi` },
                    { label: 'Total Sesi Semua', val: `${honor.total_sesi_semua_pelatih} sesi` },
                    { label: 'Porsi', val: honor.total_sesi_semua_pelatih > 0
                      ? `${((honor.jumlah_sesi_mengajar / honor.total_sesi_semua_pelatih) * 100).toFixed(1)}%`
                      : '0%' },
                    { label: 'Total Iuran Lunas', val: formatRupiah(honor.total_iuran_terkumpul_bulan) },
                    { label: 'Pool Honor', val: formatRupiah(honor.total_pool_honor) },
                    { label: 'Persentase Pool', val: `${honor.persentase_pool_dipakai}%` },
                  ].map(item => (
                    <div key={item.label} className="bg-background rounded-xl p-3">
                      <div className="text-dark/50 text-xs mb-1">{item.label}</div>
                      <div className="font-bold text-dark">{item.val}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
