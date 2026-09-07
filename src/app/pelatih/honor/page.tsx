'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

interface PelatihPayrollDetail {
  id: string
  payroll_run_id: string
  pelatih_id: string
  sessions_taught: number
  teaching_honor: number
  founder_margin_share: number
  total_payout: number
  status_dibayar: boolean
  tgl_dibayar: string | null
  created_at: string
  payroll_runs: {
    id: string
    bulan: number
    tahun: number
    total_income: number
    coach_pool_amount: number
    founder_margin_amount: number
  }
}

export default function PelatihHonorPage() {
  const supabase = createClient()
  const [honorList, setHonorList] = useState<PelatihPayrollDetail[]>([])
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
      .from('payroll_details')
      .select('*, payroll_runs!inner(id, bulan, tahun, total_income, coach_pool_amount, founder_margin_amount)')
      .eq('pelatih_id', profile.pelatih_id)

    const items = (data || []) as unknown as PelatihPayrollDetail[]
    // Sort by tahun desc, bulan desc
    items.sort((a, b) => {
      if (b.payroll_runs.tahun !== a.payroll_runs.tahun) {
        return b.payroll_runs.tahun - a.payroll_runs.tahun
      }
      return b.payroll_runs.bulan - a.payroll_runs.bulan
    })

    setHonorList(items)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchHonor() }, [fetchHonor])

  const totalDiterima = honorList.filter(h => h.status_dibayar).reduce((s, h) => s + Number(h.total_payout), 0)
  const totalBelum = honorList.filter(h => !h.status_dibayar).reduce((s, h) => s + Number(h.total_payout), 0)

  // Group by tahun
  const byTahun: Record<number, PelatihPayrollDetail[]> = {}
  for (const h of honorList) {
    const t = h.payroll_runs.tahun
    if (!byTahun[t]) byTahun[t] = []
    byTahun[t].push(h)
  }
  const sortedTahun = Object.keys(byTahun).map(Number).sort((a, b) => b - a)

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🏆 Slip & Riwayat Honor Saya</h1>
        {namaPelatih && (
          <p className="text-dark/60 font-sans mt-1">Rincian honor resmi payroll club untuk <span className="font-bold text-dark">{namaPelatih}</span></p>
        )}
      </div>

      {/* Summary Cards */}
      {!loading && honorList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-[#BBF7D0] border-dark border-2 p-5">
            <div className="text-xs text-dark/70 font-sans font-bold uppercase tracking-wider">✅ Total Sudah Diterima</div>
            <div className="text-3xl font-bold font-sans text-dark mt-1">{formatRupiah(totalDiterima)}</div>
          </Card>
          <Card className="bg-[#FDE68A] border-dark border-2 p-5">
            <div className="text-xs text-dark/70 font-sans font-bold uppercase tracking-wider">⏳ Menunggu Pembayaran</div>
            <div className="text-3xl font-bold font-sans text-dark mt-1">{formatRupiah(totalBelum)}</div>
          </Card>
        </div>
      )}

      {/* List honor */}
      {loading ? (
        <Card className="text-center py-12 text-dark/50 font-sans">Memuat data honor...</Card>
      ) : honorList.length === 0 ? (
        <Card className="text-center py-16 text-dark/50 font-sans border-dashed border-4 border-dark/20 bg-transparent">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-bold text-lg text-dark/70">Belum Ada Slip Honor</p>
          <p className="text-sm mt-1 max-w-md mx-auto">
            Slip honor resmi akan tampil di sini secara otomatis setelah admin/owner melakukan kalkulasi payroll bulanan.
          </p>
        </Card>
      ) : (
        sortedTahun.map(tahun => (
          <div key={tahun} className="flex flex-col gap-4">
            <h2 className="font-bold font-sans text-dark text-lg border-b-2 border-dark pb-2">📅 Tahun {tahun}</h2>
            {byTahun[tahun].map(honor => (
              <Card key={honor.id} className="flex flex-col gap-4 border-2 border-dark p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold font-sans text-dark text-xl">{BULAN_NAMES[honor.payroll_runs.bulan]} {honor.payroll_runs.tahun}</h3>
                      <Badge color={honor.status_dibayar ? 'primary' : 'accent'}>
                        {honor.status_dibayar ? '✅ Lunas Dibayar' : '⏳ Menunggu Pembayaran'}
                      </Badge>
                    </div>
                    {honor.tgl_dibayar && (
                      <p className="text-xs text-dark/60 font-sans mt-1">
                        Ditransfer / dibayar pada: <strong>{new Date(honor.tgl_dibayar + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold font-sans text-primary">{formatRupiah(honor.total_payout)}</div>
                    <div className="text-[10px] uppercase font-bold text-dark/50 tracking-wider">Total Nominal Diterima</div>
                  </div>
                </div>

                {/* Breakdown detail */}
                <div className="border-t-2 border-dark/10 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-sans">
                  <div className="bg-background rounded-xl p-3 border border-dark/10">
                    <div className="text-dark/50 text-[10px] uppercase font-bold mb-1">Sesi Mengajar</div>
                    <div className="font-bold text-dark text-base">{honor.sessions_taught} kali</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-dark/10">
                    <div className="text-dark/50 text-[10px] uppercase font-bold mb-1">Honor Mengajar</div>
                    <div className="font-bold text-dark text-base">{formatRupiah(honor.teaching_honor)}</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-dark/10">
                    <div className="text-dark/50 text-[10px] uppercase font-bold mb-1">Founder Margin</div>
                    <div className="font-bold text-dark text-base">{formatRupiah(honor.founder_margin_share)}</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-dark/10">
                    <div className="text-dark/50 text-[10px] uppercase font-bold mb-1">Coach Pool Club</div>
                    <div className="font-bold text-dark text-base">{formatRupiah(honor.payroll_runs.coach_pool_amount)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
