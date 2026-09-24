'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { KasbonPelatih } from '@/lib/types'

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
  potongan_kasbon?: number
  honor_bersih?: number
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
  const [activeLoans, setActiveLoans] = useState<KasbonPelatih[]>([])
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

    // 1. Fetch payroll details
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

    // 2. Fetch kasbon / pinjaman pelatih
    const { data: loansData } = await supabase
      .from('kasbon_pelatih')
      .select('*')
      .eq('pelatih_id', profile.pelatih_id)
      .order('tgl_pinjam', { ascending: false })

    setActiveLoans((loansData || []) as KasbonPelatih[])

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchHonor() }, [fetchHonor])

  const totalDiterima = honorList.filter(h => h.status_dibayar).reduce((s, h) => {
    const net = h.honor_bersih !== null && h.honor_bersih !== undefined ? Number(h.honor_bersih) : (Number(h.total_payout) - Number(h.potongan_kasbon || 0))
    return s + net
  }, 0)

  const totalBelum = honorList.filter(h => !h.status_dibayar).reduce((s, h) => {
    const net = h.honor_bersih !== null && h.honor_bersih !== undefined ? Number(h.honor_bersih) : (Number(h.total_payout) - Number(h.potongan_kasbon || 0))
    return s + net
  }, 0)

  const totalSisaHutang = activeLoans.filter(l => l.status === 'belum_lunas').reduce((s, l) => s + Number(l.sisa_hutang), 0)

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
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-[#BBF7D0] border-dark border-2 p-5">
            <div className="text-xs text-dark/70 font-sans font-bold uppercase tracking-wider">✅ Total Bersih Sudah Diterima</div>
            <div className="text-3xl font-bold font-sans text-dark mt-1">{formatRupiah(totalDiterima)}</div>
          </Card>
          <Card className="bg-[#FDE68A] border-dark border-2 p-5">
            <div className="text-xs text-dark/70 font-sans font-bold uppercase tracking-wider">⏳ Menunggu Pembayaran</div>
            <div className="text-3xl font-bold font-sans text-dark mt-1">{formatRupiah(totalBelum)}</div>
          </Card>
        </div>
      )}

      {/* Card Tanggungan Kasbon Aktif (jika ada) */}
      {!loading && totalSisaHutang > 0 && (
        <Card className="bg-[#FEF2F2] border-2 border-red-300 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">💳</span>
              <div>
                <h3 className="font-bold text-dark text-base">Tanggungan Kasbon / Pinjaman Aktif</h3>
                <p className="text-xs text-dark/60 font-sans">Informasi kasbon aktif Anda yang tercatat di pembukuan klub</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-dark/50 uppercase font-bold tracking-wider">Sisa Hutang:</span>
              <div className="text-2xl font-bold font-sans text-red-600">
                {formatRupiah(totalSisaHutang)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-red-200">
            {activeLoans.filter(l => l.status === 'belum_lunas').map(l => (
              <div key={l.id} className="p-3 bg-white rounded-xl border border-red-200 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-dark">{l.keterangan}</div>
                  <div className="text-dark/50 text-[11px] mt-0.5">
                    Tgl Pinjam: {new Date(l.tgl_pinjam + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} • Pokok: {formatRupiah(Number(l.nominal_pinjaman))}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-dark/50">Sisa Tanggungan:</span>
                  <div className="font-bold text-sm text-red-600 font-sans">{formatRupiah(Number(l.sisa_hutang))}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
            {byTahun[tahun].map(honor => {
              const honorKotor = Number(honor.total_payout || 0)
              const potongan = Number(honor.potongan_kasbon || 0)
              const honorBersih = honor.honor_bersih !== null && honor.honor_bersih !== undefined ? Number(honor.honor_bersih) : (honorKotor - potongan)

              return (
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
                      <div className="text-2xl font-bold font-sans text-green-700">{formatRupiah(honorBersih)}</div>
                      <div className="text-[10px] uppercase font-bold text-dark/50 tracking-wider">Total Bersih Diterima</div>
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
                      <div className="text-dark/50 text-[10px] uppercase font-bold mb-1">Total Honor Kotor</div>
                      <div className="font-bold text-dark text-base">{formatRupiah(honorKotor)}</div>
                    </div>
                  </div>

                  {/* Rincian Potongan Kasbon jika ada */}
                  {potongan > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs font-sans">
                      <span className="text-red-700 font-bold flex items-center gap-1.5">
                        <span>✂️ Potongan Kasbon / Cicilan Hutang:</span>
                      </span>
                      <span className="font-bold text-red-700 text-sm">
                        -{formatRupiah(potongan)}
                      </span>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
