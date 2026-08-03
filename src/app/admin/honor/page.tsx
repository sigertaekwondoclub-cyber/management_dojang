'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { PayrollRun, PayrollDetail } from '@/lib/types'
import { generatePayroll, updateDetailStatusDibayar } from './actions'

const supabase = createClient()

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

type DetailWithPelatih = PayrollDetail & { 
  pelatih: { nama: string; role: 'head_coach' | 'core_coach' | 'assistant_coach'; is_founder: boolean } 
}

export default function AdminHonorPage() {
  const now = new Date()

  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))

  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null)
  const [details, setDetails] = useState<DetailWithPelatih[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPayroll = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)

    // Ambil payroll run untuk periode terpilih
    const { data: runData, error: runErr } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('bulan', bul)
      .eq('tahun', tah)
      .maybeSingle()

    if (runErr) {
      setError('Gagal memuat payroll: ' + runErr.message)
      setLoading(false)
      return
    }

    if (runData) {
      setPayrollRun(runData as PayrollRun)
      
      // Ambil detail payout pelatih
      const { data: detailsData, error: detailsErr } = await supabase
        .from('payroll_details')
        .select('*, pelatih:pelatih_id(nama, role, is_founder)')
        .eq('payroll_run_id', runData.id)
        .order('total_payout', { ascending: false })

      if (detailsErr) {
        setError('Gagal memuat rincian pelatih: ' + detailsErr.message)
      } else {
        setDetails((detailsData || []) as DetailWithPelatih[])
      }
    } else {
      setPayrollRun(null)
      setDetails([])
    }

    setLoading(false)
  }, [filterBulan, filterTahun])

  useEffect(() => { fetchPayroll() }, [fetchPayroll])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setSuccess(null)

    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)

    const res = await generatePayroll(bul, tah)
    if (res.success) {
      setSuccess(res.message)
      await fetchPayroll()
    } else {
      setError(res.message)
    }
    setGenerating(false)
  }

  const handleTandaiDibayar = async (detailId: string, currentStatus: boolean) => {
    setActionLoading(detailId)
    const res = await updateDetailStatusDibayar(detailId, !currentStatus)
    if (res.success) {
      await fetchPayroll()
    } else {
      alert(res.message)
    }
    setActionLoading(null)
  }

  const getRoleBadgeColor = (role: string) => {
    if (role === 'head_coach') return 'primary'
    if (role === 'core_coach') return 'dark'
    return 'secondary'
  }

  const getRoleLabel = (role: string) => {
    if (role === 'head_coach') return 'Head Coach'
    if (role === 'core_coach') return 'Core Coach'
    return 'Assistant Coach'
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">🏆 Sistem Payroll Pelatih</h1>
          <p className="text-dark/60 font-sans mt-1">Kelola pembagian iuran dan honor mengajar pelatih bulanan</p>
        </div>
      </div>

      {/* Filter & Action */}
      <Card>
        <div className="flex gap-4 flex-wrap items-end justify-between w-full">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark text-sm">Bulan</label>
              <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
                className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[150px]">
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                  <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
                ))}
              </select>
            </div>
            <Input label="Tahun" type="number" value={filterTahun}
              onChange={e => setFilterTahun(e.target.value)} className="max-w-[120px]" />
            <Button variant="secondary" onClick={fetchPayroll} disabled={loading}>
              🔍 Tampilkan
            </Button>
          </div>
          
          <Button variant="primary" onClick={handleGenerate} disabled={generating || loading} className="mb-0">
            {generating ? '⏳ Memproses...' : '⚡ Hitung & Generate Payroll'}
          </Button>
        </div>
      </Card>

      {error && <div className="bg-accent/20 border-2 border-accent rounded-xl p-4 text-dark font-bold text-sm">⚠️ {error}</div>}
      {success && <div className="bg-primary/20 border-2 border-primary rounded-xl p-4 text-dark font-bold text-sm">✅ {success}</div>}

      {loading ? (
        <Card className="text-center py-16 text-dark/50 font-sans">Memuat data payroll...</Card>
      ) : !payrollRun ? (
        <Card className="text-center py-16 text-dark/50 font-sans border-dashed border-4 border-dark/20 bg-transparent">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-bold text-lg text-dark/70">Payroll Belum Di-generate</p>
          <p className="text-sm mt-1 max-w-md mx-auto">
            Belum ada data snapshot payroll untuk bulan {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}. 
            Klik tombol <strong>Generate Payroll</strong> di atas untuk menghitung otomatis berdasarkan iuran terbayar.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Ringkasan Pembagian Budget */}
          <Card className="bg-dark text-white border-dark">
            <h2 className="font-bold font-sans text-xl mb-4 border-b border-white/20 pb-3 flex justify-between items-center">
              <span>📊 Alokasi Finansial Club</span>
              <span className="text-sm font-normal text-white/50">Periode: {BULAN_NAMES[payrollRun.bulan]} {payrollRun.tahun}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">💰 Total Income Iuran</div>
                <div className="text-xl font-bold font-sans text-green-700">{formatRupiah(payrollRun.total_income)}</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">🏆 Coach Pool (Honor)</div>
                <div className="text-xl font-bold font-sans text-blue-600">{formatRupiah(payrollRun.coach_pool_amount)}</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">⚙️ Operasional</div>
                <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.operational_amount)}</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">🏦 Dana Cadangan</div>
                <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.reserve_amount)}</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">📈 Pengembangan Club</div>
                <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.development_amount)}</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">👑 Founder Margin</div>
                <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.founder_margin_amount)}</div>
              </div>
            </div>
          </Card>

          {/* Rincian Honor Pelatih */}
          <Card className="border-2 border-dark">
            <h2 className="font-bold font-sans text-dark text-lg mb-4">🥋 Rincian Honor Pelatih</h2>
            <div className="flex flex-col gap-4">
              {details.map(item => (
                <div key={item.id} className="p-4 bg-background border-2 border-dark rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-dark text-lg">{item.pelatih?.nama || '-'}</span>
                      <Badge color={getRoleBadgeColor(item.pelatih?.role || '')}>{getRoleLabel(item.pelatih?.role || '')}</Badge>
                      {item.pelatih?.is_founder && <Badge color="primary">⭐ Founder</Badge>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-3 text-xs text-dark/70 font-sans">
                      <div>Sesi Mengajar: <strong className="text-dark font-mono text-sm">{item.sessions_taught} kali</strong></div>
                      <div>Honor Mengajar: <strong className="text-dark">{formatRupiah(item.teaching_honor)}</strong></div>
                      <div>Margin Founder: <strong className="text-dark">{formatRupiah(item.founder_margin_share)}</strong></div>
                      {item.tgl_dibayar && <div>Tgl Dibayar: <strong className="text-dark">{new Date(item.tgl_dibayar + 'T00:00:00').toLocaleDateString('id-ID')}</strong></div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-right">
                      <div className="text-xl font-bold font-sans text-primary">{formatRupiah(item.total_payout)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-dark/50 font-bold">Total Payout</div>
                    </div>

                    <Button
                      variant={item.status_dibayar ? 'secondary' : 'primary'}
                      onClick={() => handleTandaiDibayar(item.id, item.status_dibayar)}
                      disabled={actionLoading === item.id}
                      className="text-xs py-2 px-3 mb-0"
                    >
                      {actionLoading === item.id ? '⏳' : item.status_dibayar ? '✅ Dibayar' : '💳 Bayar'}
                    </Button>
                  </div>
                </div>
              ))}
              {details.length === 0 && (
                <div className="text-center py-6 text-dark/50">Belum ada rincian honor untuk pelatih aktif.</div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
