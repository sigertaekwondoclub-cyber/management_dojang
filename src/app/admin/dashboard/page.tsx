'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    siswaAktif: 0,
    pelatihAktif: 0,
    iuranTotal: 0,
    iuranTerkumpul: 0,
    tagihanMenunggu: 0,
    daftarBaru: 0,
    income: 0,
    expense: 0
  })
  const [ujianMendatang, setUjianMendatang] = useState<any>(null)
  const [eventMendatang, setEventMendatang] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const bulan = now.getMonth() + 1
    const tahun = now.getFullYear()
    const today = now.toISOString().split('T')[0]

    // Fetch all dashboard data in parallel
    const [
      siswaResult,
      daftarResult,
      pelatihResult,
      iuranResult,
      cashflowResult,
      honorResult,
      ujianResult,
      eventResult
    ] = await Promise.all([
      supabase.from('siswa').select('status_aktif'),
      supabase.from('pendaftaran_siswa').select('id').eq('status', 'pending'),
      supabase.from('pelatih').select('id', { count: 'exact', head: true }).eq('status_aktif', true),
      supabase.from('iuran').select('nominal, status_bayar').eq('bulan', bulan).eq('tahun', tahun),
      supabase.from('keuangan_club').select('jenis, nominal').gte('tgl', `${tahun}-${String(bulan).padStart(2, '0')}-01`),
      supabase.from('honor_pelatih').select('honor_diterima').eq('tahun', tahun).eq('bulan', bulan).eq('status_dibayar', true),
      supabase.from('ujian_sabuk').select('tgl_ujian').gte('tgl_ujian', today).order('tgl_ujian', { ascending: true }).limit(1),
      supabase.from('event_kompetisi').select('nama, tgl').gte('tgl', today).order('tgl', { ascending: true }).limit(1)
    ])

    const siswaData = siswaResult.data
    const siswaAktif = siswaData?.filter(s => s.status_aktif).length || 0

    const daftarData = daftarResult.data
    const daftarBaru = daftarData?.length || 0

    const pelatihAktif = pelatihResult.count || 0

    const iuranData = iuranResult.data
    let iuranTotal = 0
    let iuranTerkumpul = 0
    let tagihanMenunggu = 0
    iuranData?.forEach(i => {
      iuranTotal += Number(i.nominal)
      if (i.status_bayar === 'lunas') iuranTerkumpul += Number(i.nominal)
      if (i.status_bayar === 'menunggu_verifikasi') tagihanMenunggu++
    })

    const cashflow = cashflowResult.data
    let income = iuranTerkumpul
    let expense = 0
    cashflow?.forEach(c => {
      if (c.jenis === 'income') income += Number(c.nominal)
      if (c.jenis === 'expense') expense += Number(c.nominal)
    })
    
    const honorData = honorResult.data
    honorData?.forEach(h => { expense += Number(h.honor_diterima) })

    const uData = ujianResult.data
    const eData = eventResult.data

    setStats({
      siswaAktif,
      pelatihAktif: pelatihAktif || 0,
      iuranTotal,
      iuranTerkumpul,
      tagihanMenunggu,
      daftarBaru,
      income,
      expense
    })
    setUjianMendatang(uData?.[0] || null)
    setEventMendatang(eData?.[0] || null)

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const iuranProgress = stats.iuranTotal > 0 ? (stats.iuranTerkumpul / stats.iuranTotal) * 100 : 0
  const saldo = stats.income - stats.expense

  if (loading) return <div className="p-8 text-center text-dark/50 font-bold font-sans">Memuat Dashboard...</div>

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🏠 Dashboard Admin</h1>
        <p className="text-dark/60 font-sans mt-1">Ringkasan aktivitas Siger Taekwondo Club</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Siswa & Pelatih */}
        <Card className="p-6 border-2 border-dark bg-[#BBF7D0] hover:-translate-y-1 transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Siswa Aktif</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.siswaAktif}</div>
            </div>
            <div className="text-4xl opacity-80">🥋</div>
          </div>
        </Card>
        
        <Card className="p-6 border-2 border-dark bg-[#BFDBFE] hover:-translate-y-1 transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Pelatih Aktif</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.pelatihAktif}</div>
            </div>
            <div className="text-4xl opacity-80">👨‍🏫</div>
          </div>
        </Card>

        {/* Action Items */}
        <Link href="/admin/pendaftaran" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full ${stats.daftarBaru > 0 ? 'bg-[#FDE68A]' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Daftar Baru</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.daftarBaru}</div>
              </div>
              <div className="text-4xl opacity-80">📝</div>
            </div>
            {stats.daftarBaru > 0 && <div className="text-xs font-bold text-dark mt-3">Menunggu verifikasi →</div>}
          </Card>
        </Link>

        <Link href="/admin/iuran" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full ${stats.tagihanMenunggu > 0 ? 'bg-[#FECACA]' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Verifikasi Iuran</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.tagihanMenunggu}</div>
              </div>
              <div className="text-4xl opacity-80">💰</div>
            </div>
            {stats.tagihanMenunggu > 0 && <div className="text-xs font-bold text-dark mt-3">Butuh pengecekan →</div>}
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Iuran Progress */}
        <Card className="flex flex-col gap-4">
          <h2 className="font-bold font-sans text-dark text-lg">Pemasukan Iuran Bulan Ini</h2>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold font-sans text-dark">{formatRupiah(stats.iuranTerkumpul)}</div>
              <div className="text-sm text-dark/60 font-sans mt-1">dari target {formatRupiah(stats.iuranTotal)}</div>
            </div>
            <div className="font-bold font-sans text-primary text-xl">{Math.round(iuranProgress)}%</div>
          </div>
          <div className="h-4 bg-dark/10 rounded-full overflow-hidden border border-dark/20 mt-2">
            <div 
              className="h-full bg-primary transition-all duration-1000" 
              style={{ width: `${Math.min(iuranProgress, 100)}%` }}
            />
          </div>
        </Card>

        {/* Cashflow Singkat */}
        <Card className="flex flex-col gap-4 bg-dark text-white border-dark">
          <h2 className="font-bold font-sans text-white/80 text-lg">Cashflow Bulan Ini</h2>
          <div className="grid grid-cols-3 gap-4 mt-2">
            <div>
              <div className="text-xs text-white/50 font-sans mb-1">Income</div>
              <div className="text-lg font-bold font-sans text-primary">{formatRupiah(stats.income)}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 font-sans mb-1">Expense</div>
              <div className="text-lg font-bold font-sans text-accent">{formatRupiah(stats.expense)}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 font-sans mb-1">Saldo Net</div>
              <div className={`text-lg font-bold font-sans ${saldo >= 0 ? 'text-white' : 'text-accent'}`}>{formatRupiah(saldo)}</div>
            </div>
          </div>
          <Link href="/admin/keuangan" className="text-xs text-white/50 hover:text-white mt-auto text-right font-sans transition-colors">Lihat detail laporan →</Link>
        </Card>

        {/* Jadwal Terdekat */}
        <Card className="lg:col-span-2">
          <h2 className="font-bold font-sans text-dark text-lg mb-4">📅 Jadwal Terdekat</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-dark bg-background flex flex-col gap-1">
              <div className="text-sm text-dark/60 font-bold font-sans">Ujian Kenaikan Sabuk</div>
              {ujianMendatang ? (
                <>
                  <div className="text-xl font-bold font-sans text-dark">
                    {new Date(ujianMendatang.tgl_ujian).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                  </div>
                  <Link href="/admin/ujian" className="text-xs font-bold text-primary hover:underline mt-2">Kelola Ujian →</Link>
                </>
              ) : (
                <div className="text-dark/50 italic text-sm mt-1">Belum ada jadwal</div>
              )}
            </div>

            <div className="p-4 rounded-xl border-2 border-dark bg-background flex flex-col gap-1">
              <div className="text-sm text-dark/60 font-bold font-sans">Event / Kompetisi</div>
              {eventMendatang ? (
                <>
                  <div className="text-lg font-bold font-sans text-dark leading-tight">{eventMendatang.nama}</div>
                  <div className="text-sm text-dark/70 font-sans mt-1">
                    {new Date(eventMendatang.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                  </div>
                  <Link href="/admin/event" className="text-xs font-bold text-primary hover:underline mt-2">Lihat Detail →</Link>
                </>
              ) : (
                <div className="text-dark/50 italic text-sm mt-1">Belum ada event mendatang</div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
