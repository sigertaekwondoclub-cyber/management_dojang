'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'

const supabase = createClient()

const SABUK_ORDER = ['Putih', 'Kuning', 'Hijau', 'Biru', 'Merah', 'Hitam']
const SABUK_COLOR: Record<string, { fill: string; text: string }> = {
  Putih:  { fill: '#F9FAFB', text: '#1E2A38' },
  Kuning: { fill: '#FBBF24', text: '#1E2A38' },
  Hijau:  { fill: '#22C55E', text: '#fff' },
  Biru:   { fill: '#3B82F6', text: '#fff' },
  Merah:  { fill: '#EF4444', text: '#fff' },
  Hitam:  { fill: '#1E2A38', text: '#fff' },
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    siswaAktif: 0, pelatihAktif: 0,
    iuranTotal: 0, iuranTerkumpul: 0, tagihanMenunggu: 0,
    daftarBaru: 0, pesananMerchantMenunggu: 0,
    merchantPemasukan: 0, income: 0, expense: 0,
  })
  const [ujianMendatang, setUjianMendatang] = useState<any>(null)
  const [eventMendatang, setEventMendatang] = useState<any>(null)
  const [stokKritis, setStokKritis] = useState<any[]>([])

  // NEW state
  const [absensiHariIni, setAbsensiHariIni] = useState<{ hadir: number; izin: number; sakit: number; alpha: number; kelas: string[] }>({ hadir: 0, izin: 0, sakit: 0, alpha: 0, kelas: [] })
  const [kehadiranKelas, setKehadiranKelas] = useState<{ kelas: string; pct: number; total: number; hadir: number }[]>([])
  const [siswaBlmBayar, setSiswaBlmBayar] = useState<{ nama: string; id: string }[]>([])
  const [distribusiSabuk, setDistribusiSabuk] = useState<{ sabuk: string; count: number }[]>([])
  const [alphaWarning, setAlphaWarning] = useState<{ nama: string; siswa_id: string; count: number }[]>([])
  const [honorBelumBayar, setHonorBelumBayar] = useState<{ count: number; total: number }>({ count: 0, total: 0 })
  const [payrollGenerated, setPayrollGenerated] = useState(false)

  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const bulan = now.getMonth() + 1
    const tahun = now.getFullYear()
    const today = now.toISOString().split('T')[0]
    const bulanStr = String(bulan).padStart(2, '0')
    const startBulan = `${tahun}-${bulanStr}-01`

    // Ambil payroll_run bulan ini untuk kalkulasi honor pelatih
    const payrollRunResult = await supabase
      .from('payroll_runs')
      .select('id, coach_pool_amount')
      .eq('bulan', bulan)
      .eq('tahun', tahun)
      .maybeSingle()

    const payrollRunId = payrollRunResult.data?.id || null

    const [
      siswaResult, daftarResult, pelatihResult, iuranResult,
      cashflowResult, honorResult, ujianResult, eventResult,
      merchantMenungguResult, merchantOmzetResult, stokResult,
      // NEW
      absensiHariIniResult, absensiMonthResult,
      iuranBlmBayarResult, siswaAllResult,
      alphaResult, honorBelumResult,
    ] = await Promise.all([
      supabase.from('siswa').select('status_aktif'),
      supabase.from('pendaftaran_siswa').select('id').eq('status', 'pending'),
      supabase.from('pelatih').select('id', { count: 'exact', head: true }).eq('status_aktif', true),
      supabase.from('iuran').select('nominal, status_bayar').eq('bulan', bulan).eq('tahun', tahun),
      supabase.from('keuangan_club').select('jenis, nominal').gte('tgl', startBulan),
      // Honor sudah dibayar: dari payroll_details dengan status_dibayar = true
      payrollRunId
        ? supabase.from('payroll_details').select('total_payout').eq('payroll_run_id', payrollRunId).eq('status_dibayar', true)
        : Promise.resolve({ data: [] }),
      supabase.from('ujian_sabuk').select('tgl_ujian').gte('tgl_ujian', today).order('tgl_ujian', { ascending: true }).limit(1),
      supabase.from('event_kompetisi').select('nama, tgl').gte('tgl', today).order('tgl', { ascending: true }).limit(1),
      supabase.from('pesanan_merchant').select('id', { count: 'exact', head: true }).eq('status', 'menunggu_verifikasi'),
      supabase.from('pesanan_merchant').select('total_harga').in('status', ['lunas', 'diproses', 'siap_diambil']),
      supabase.from('produk_varian').select('ukuran, stok, produk_merchant(nama)').lte('stok', 5),
      // NEW queries
      supabase.from('absensi_siswa').select('status_hadir, kelas').eq('tgl', today),
      supabase.from('absensi_siswa').select('siswa_id, kelas, status_hadir').gte('tgl', startBulan).lte('tgl', today),
      supabase.from('iuran').select('siswa_id, siswa:siswa_id(nama)').eq('bulan', bulan).eq('tahun', tahun).eq('status_bayar', 'belum_bayar'),
      supabase.from('siswa').select('sabuk_saat_ini').eq('status_aktif', true),
      supabase.from('absensi_siswa').select('siswa_id, siswa:siswa_id(nama)').eq('status_hadir', 'alpha').gte('tgl', startBulan).lte('tgl', today),
      // Honor belum dibayar: dari payroll_details dengan status_dibayar = false
      payrollRunId
        ? supabase.from('payroll_details').select('total_payout').eq('payroll_run_id', payrollRunId).eq('status_dibayar', false)
        : Promise.resolve({ data: [] }),
    ])

    // ── Existing stats ──
    const siswaAktif = siswaResult.data?.filter(s => s.status_aktif).length || 0
    const daftarBaru = daftarResult.data?.length || 0
    const pelatihAktif = pelatihResult.count || 0

    let iuranTotal = 0, iuranTerkumpul = 0, tagihanMenunggu = 0
    iuranResult.data?.forEach(i => {
      iuranTotal += Number(i.nominal)
      if (i.status_bayar === 'lunas') iuranTerkumpul += Number(i.nominal)
      if (i.status_bayar === 'menunggu_verifikasi') tagihanMenunggu++
    })
    const merchantPemasukan = (merchantOmzetResult.data || []).reduce((acc, c) => acc + Number(c.total_harga), 0)
    let income = iuranTerkumpul + merchantPemasukan, expense = 0
    cashflowResult.data?.forEach(c => {
      if (c.jenis === 'income') income += Number(c.nominal)
      if (c.jenis === 'expense') expense += Number(c.nominal)
    })
    // Honor sudah dibayar dihitung dari payroll_details (total_payout)
    honorResult.data?.forEach((h: any) => { expense += Number(h.total_payout) })

    setStats({ siswaAktif, pelatihAktif: pelatihAktif || 0, iuranTotal, iuranTerkumpul, tagihanMenunggu, daftarBaru, pesananMerchantMenunggu: merchantMenungguResult.count || 0, merchantPemasukan, income, expense })
    setUjianMendatang(ujianResult.data?.[0] || null)
    setEventMendatang(eventResult.data?.[0] || null)
    setStokKritis((stokResult.data || []) as any[])

    // ── Widget 1: Absensi Hari Ini ──
    const ahiData = absensiHariIniResult.data || []
    const kelasHariIni = Array.from(new Set(ahiData.map((r: any) => r.kelas as string)))
    setAbsensiHariIni({
      hadir: ahiData.filter((r: any) => r.status_hadir === 'hadir').length,
      izin:  ahiData.filter((r: any) => r.status_hadir === 'izin').length,
      sakit: ahiData.filter((r: any) => r.status_hadir === 'sakit').length,
      alpha: ahiData.filter((r: any) => r.status_hadir === 'alpha').length,
      kelas: kelasHariIni,
    })

    // ── Widget 2: Kehadiran per Kelas Bulan Ini ──
    const monthData = absensiMonthResult.data || []
    const kelasMap: Record<string, { total: number; hadir: number }> = {}
    monthData.forEach((r: any) => {
      if (!kelasMap[r.kelas]) kelasMap[r.kelas] = { total: 0, hadir: 0 }
      kelasMap[r.kelas].total++
      if (r.status_hadir === 'hadir') kelasMap[r.kelas].hadir++
    })
    setKehadiranKelas(Object.entries(kelasMap).map(([kelas, v]) => ({
      kelas, total: v.total, hadir: v.hadir,
      pct: v.total > 0 ? Math.round((v.hadir / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total))

    // ── Widget 3: Siswa Belum Bayar ──
    const blmBayar = (iuranBlmBayarResult.data || []).map((r: any) => ({
      id: r.siswa_id, nama: (r.siswa as any)?.nama || '-',
    }))
    setSiswaBlmBayar(blmBayar)

    // ── Widget 4: Distribusi Sabuk ──
    const sabukCount: Record<string, number> = {}
    siswaAllResult.data?.forEach((s: any) => {
      const sb = s.sabuk_saat_ini || 'Putih'
      sabukCount[sb] = (sabukCount[sb] || 0) + 1
    })
    setDistribusiSabuk(
      SABUK_ORDER.filter(s => sabukCount[s])
        .map(s => ({ sabuk: s, count: sabukCount[s] }))
    )

    // ── Widget 5: Alpha Warning ──
    const alphaMap: Record<string, { nama: string; count: number }> = {}
    ;(alphaResult.data || []).forEach((r: any) => {
      if (!alphaMap[r.siswa_id]) alphaMap[r.siswa_id] = { nama: (r.siswa as any)?.nama || '-', count: 0 }
      alphaMap[r.siswa_id].count++
    })
    setAlphaWarning(
      Object.entries(alphaMap)
        .map(([siswa_id, v]) => ({ siswa_id, nama: v.nama, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    )

    // ── Widget 6: Honor Belum Bayar ──
    // Jika payroll belum di-generate bulan ini, widget akan tampil kosong/0
    const hbData = honorBelumResult.data || []
    setPayrollGenerated(payrollRunId !== null)
    setHonorBelumBayar({
      count: hbData.length,
      total: hbData.reduce((acc: number, h: any) => acc + Number(h.total_payout), 0),
    })

    setLoading(false)
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const iuranProgress = stats.iuranTotal > 0 ? (stats.iuranTerkumpul / stats.iuranTotal) * 100 : 0
  const saldo = stats.income - stats.expense
  const maxSabuk = Math.max(...distribusiSabuk.map(s => s.count), 1)
  const today = new Date()
  const todayStr = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return <div className="p-8 text-center text-dark/50 font-bold font-sans">Memuat Dashboard...</div>

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold font-sans text-dark">🏠 Dashboard Admin</h1>
        <p className="text-dark/60 font-sans mt-1">Ringkasan aktivitas Siger Taekwondo Club</p>
      </div>

      {/* Banner Milestone */}
      {stats.siswaAktif >= 30 && (
        <div className="bg-[#BFDBFE] border-4 border-dark p-5 rounded-2xl shadow-brutal flex items-center gap-4 animate-fade-in-up">
          <div className="text-3xl animate-bounce-gentle">🚀</div>
          <div>
            <h4 className="font-bold text-dark font-sans text-lg">Milestone Pertumbuhan Klub!</h4>
            <p className="text-dark/80 text-sm font-sans mt-0.5">
              {stats.siswaAktif >= 50 ? "Coach pool cukup besar (≥ 50 siswa aktif), evaluasi skema gaji semi-tetap."
                : stats.siswaAktif >= 40 ? "Pertimbangkan promosi asisten pelatih jadi pelatih inti (≥ 40 siswa aktif)."
                : "Coach pool sudah stabil (≥ 30 siswa aktif), evaluasi kenaikan rate per sesi."}
            </p>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
        <Card className="p-6 border-2 border-dark bg-[#BBF7D0] hover:-translate-y-1 transition-transform animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Siswa Aktif</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.siswaAktif}</div>
            </div>
            <div className="text-4xl opacity-80 animate-float">🥋</div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-dark bg-[#BFDBFE] hover:-translate-y-1 transition-transform animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Pelatih Aktif</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.pelatihAktif}</div>
            </div>
            <div className="text-4xl opacity-80 animate-float">👨‍🏫</div>
          </div>
        </Card>

        <Link href="/admin/pendaftaran" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full animate-fade-in-up ${stats.daftarBaru > 0 ? 'bg-[#FDE68A]' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Daftar Baru</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.daftarBaru}</div>
              </div>
              <div className={`text-4xl opacity-80 ${stats.daftarBaru > 0 ? 'animate-bounce-gentle' : ''}`}>📝</div>
            </div>
            {stats.daftarBaru > 0 && <div className="text-xs font-bold text-dark mt-3 animate-pulse-soft">Menunggu verifikasi →</div>}
          </Card>
        </Link>

        <Link href="/admin/iuran" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full animate-fade-in-up ${stats.tagihanMenunggu > 0 ? 'bg-[#FECACA]' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Verifikasi Iuran</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.tagihanMenunggu}</div>
              </div>
              <div className={`text-4xl opacity-80 ${stats.tagihanMenunggu > 0 ? 'animate-bounce-gentle' : ''}`}>💰</div>
            </div>
            {stats.tagihanMenunggu > 0 && <div className="text-xs font-bold text-dark mt-3 animate-pulse-soft">Butuh pengecekan →</div>}
          </Card>
        </Link>

        <Link href="/admin/merchant/pesanan" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full animate-fade-in-up ${stats.pesananMerchantMenunggu > 0 ? 'bg-accent' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Pesanan Baru</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.pesananMerchantMenunggu}</div>
              </div>
              <div className={`text-4xl opacity-80 ${stats.pesananMerchantMenunggu > 0 ? 'animate-bounce-gentle' : ''}`}>🛒</div>
            </div>
            {stats.pesananMerchantMenunggu > 0 && <div className="text-xs font-bold text-dark mt-3 animate-pulse-soft">Perlu diproses →</div>}
          </Card>
        </Link>
      </div>

      {/* ── BARIS 2: Widget Baru ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* WIDGET 1: Absensi Hari Ini */}
        <Card className="flex flex-col gap-4 border-2 border-dark animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold font-sans text-dark text-lg">📅 Absensi Hari Ini</h2>
              <p className="text-xs text-dark/50 font-sans mt-0.5">{todayStr}</p>
            </div>
            {absensiHariIni.kelas.length > 0 && (
              <div className="flex gap-1 flex-wrap justify-end">
                {absensiHariIni.kelas.map(k => (
                  <span key={k} className="text-[10px] font-bold px-2 py-0.5 bg-primary border border-dark font-sans">{k}</span>
                ))}
              </div>
            )}
          </div>

          {absensiHariIni.hadir + absensiHariIni.izin + absensiHariIni.sakit + absensiHariIni.alpha === 0 ? (
            <div className="text-center py-6 text-dark/40 font-sans text-sm">
              <div className="text-3xl mb-2">🌙</div>
              Belum ada sesi latihan hari ini
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '✅ Hadir',  val: absensiHariIni.hadir, cls: 'bg-primary/20 border-primary/40' },
                { label: '📝 Izin',   val: absensiHariIni.izin,  cls: 'bg-yellow-100 border-yellow-300' },
                { label: '🤒 Sakit',  val: absensiHariIni.sakit, cls: 'bg-secondary/20 border-secondary/40' },
                { label: '❌ Alpha',  val: absensiHariIni.alpha, cls: 'bg-accent/20 border-accent/40' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border-2 p-3 text-center ${s.cls}`}>
                  <div className="text-xl font-bold font-sans text-dark">{s.val}</div>
                  <div className="text-[10px] font-bold text-dark/60 font-sans mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          <Link href="/admin/absensi" className="text-xs text-dark/40 hover:text-dark font-sans text-right transition-colors">
            Lihat rekap absensi →
          </Link>
        </Card>

        {/* WIDGET 2: Kehadiran per Kelas Bulan Ini */}
        <Card className="flex flex-col gap-4 border-2 border-dark animate-fade-in-up">
          <div>
            <h2 className="font-bold font-sans text-dark text-lg">📈 Kehadiran Bulan Ini</h2>
            <p className="text-xs text-dark/50 font-sans mt-0.5">Per kelas — {today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
          </div>

          {kehadiranKelas.length === 0 ? (
            <div className="text-center py-6 text-dark/40 font-sans text-sm">Belum ada data absensi bulan ini</div>
          ) : (
            <div className="flex flex-col gap-3">
              {kehadiranKelas.map(k => (
                <div key={k.kelas} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-dark text-sm font-sans">{k.kelas}</span>
                    <span className={`font-bold text-sm font-sans ${k.pct >= 80 ? 'text-green-600' : k.pct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {k.pct}%
                      {k.pct < 70 && <span className="ml-1 text-[10px]">⚠️</span>}
                    </span>
                  </div>
                  <div className="h-3 bg-dark/10 rounded-full overflow-hidden border border-dark/10">
                    <div
                      className={`h-full rounded-full transition-all ${k.pct >= 80 ? 'bg-primary' : k.pct >= 60 ? 'bg-yellow-400' : 'bg-accent'}`}
                      style={{ width: `${k.pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-dark/40 font-sans">{k.hadir} hadir dari {k.total} sesi</div>
                </div>
              ))}
            </div>
          )}
          <Link href="/admin/absensi" className="text-xs text-dark/40 hover:text-dark font-sans text-right transition-colors">Detail absensi →</Link>
        </Card>

        {/* WIDGET 6: Honor Pelatih Belum Dibayar */}
        <Card className={`flex flex-col gap-4 border-2 border-dark animate-fade-in-up ${honorBelumBayar.count > 0 ? 'border-yellow-400 bg-yellow-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold font-sans text-dark text-lg">🏅 Honor Pelatih</h2>
              <p className="text-xs text-dark/50 font-sans mt-0.5">{today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
            </div>
            {honorBelumBayar.count > 0 && (
              <span className="text-2xl animate-bounce-gentle">⚠️</span>
            )}
          </div>

          {!payrollGenerated ? (
            <div className="text-center py-6 text-dark/40 font-sans text-sm">
              <div className="text-3xl mb-2">📭</div>
              Payroll bulan ini belum di-generate
            </div>
          ) : honorBelumBayar.count === 0 ? (
            <div className="text-center py-6 text-dark/40 font-sans text-sm">
              <div className="text-3xl mb-2">✅</div>
              Semua honor sudah dibayar
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="bg-yellow-100 border-2 border-yellow-400 p-4 rounded-xl flex flex-col gap-1">
                <div className="text-2xl font-bold font-sans text-dark">{honorBelumBayar.count}</div>
                <div className="text-sm text-dark/60 font-sans">pelatih belum menerima honor</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-xs text-dark/50 font-sans">Total yang perlu dibayar:</div>
                <div className="text-xl font-bold font-sans text-dark">{formatRupiah(honorBelumBayar.total)}</div>
              </div>
            </div>
          )}
          <Link href="/admin/honor" className="text-xs text-dark/40 hover:text-dark font-sans text-right transition-colors">
            Kelola honor →
          </Link>
        </Card>
      </div>

      {/* ── BARIS 3: Siswa Belum Bayar + Distribusi Sabuk ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* WIDGET 3: Siswa Belum Bayar Iuran */}
        <Card className={`flex flex-col gap-4 border-2 border-dark animate-fade-in-up ${siswaBlmBayar.length > 0 ? 'border-accent' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold font-sans text-dark text-lg">💸 Iuran Belum Bayar</h2>
              <p className="text-xs text-dark/50 font-sans mt-0.5">{today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
            </div>
            <span className={`text-3xl font-bold font-sans ${siswaBlmBayar.length > 0 ? 'text-accent' : 'text-green-600'}`}>
              {siswaBlmBayar.length}
            </span>
          </div>

          {siswaBlmBayar.length === 0 ? (
            <div className="text-center py-4 text-dark/40 font-sans text-sm">
              <div className="text-3xl mb-2">🎉</div>
              Semua siswa sudah bayar iuran bulan ini!
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {siswaBlmBayar.slice(0, 8).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-accent/10 border border-accent/30 rounded-xl">
                    <span className="text-xs font-bold text-dark/40 w-4 shrink-0">{i + 1}</span>
                    <span className="font-bold font-sans text-dark text-sm truncate flex-1">{s.nama}</span>
                    <Badge color="accent">Belum Bayar</Badge>
                  </div>
                ))}
                {siswaBlmBayar.length > 8 && (
                  <div className="text-xs text-dark/50 font-sans text-center py-1">
                    +{siswaBlmBayar.length - 8} siswa lainnya
                  </div>
                )}
              </div>
            </>
          )}
          <Link href="/admin/iuran" className="text-xs text-dark/40 hover:text-dark font-sans text-right transition-colors">
            Kelola iuran →
          </Link>
        </Card>

        {/* WIDGET 4: Distribusi Sabuk */}
        <Card className="flex flex-col gap-4 border-2 border-dark animate-fade-in-up">
          <div>
            <h2 className="font-bold font-sans text-dark text-lg">🥋 Distribusi Sabuk</h2>
            <p className="text-xs text-dark/50 font-sans mt-0.5">Komposisi level siswa aktif</p>
          </div>

          {distribusiSabuk.length === 0 ? (
            <div className="text-center py-6 text-dark/40 font-sans text-sm">Tidak ada data siswa</div>
          ) : (
            <div className="flex flex-col gap-2">
              {distribusiSabuk.map(s => {
                const pct = Math.round((s.count / maxSabuk) * 100)
                const cfg = SABUK_COLOR[s.sabuk] || { fill: '#E2E8F0', text: '#1E2A38' }
                return (
                  <div key={s.sabuk} className="flex items-center gap-3">
                    <div
                      className="w-16 text-center text-[10px] font-bold px-2 py-1 border border-dark/30 shrink-0 font-sans"
                      style={{ background: cfg.fill, color: cfg.text }}
                    >
                      {s.sabuk}
                    </div>
                    <div className="flex-1 h-5 bg-dark/10 rounded-full overflow-hidden border border-dark/10">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${Math.max(pct, 8)}%`, background: cfg.fill, border: `1px solid #1E2A38` }}
                      >
                        <span className="text-[10px] font-bold" style={{ color: cfg.text }}>{s.count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/admin/siswa" className="text-xs text-dark/40 hover:text-dark font-sans text-right transition-colors">
            Data siswa →
          </Link>
        </Card>
      </div>

      {/* ── BARIS 4: Charts + Widget Alpha Warning ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">

        {/* Bar Chart Cashflow */}
        <Card className="flex flex-col gap-4 border-2 border-dark p-6 animate-fade-in-up">
          <div>
            <h2 className="font-bold font-sans text-dark text-lg">Statistik Cashflow Bulan Ini</h2>
            <p className="text-xs text-dark/60">Perbandingan data kas masuk & keluar</p>
          </div>
          <div className="w-full flex items-center justify-center py-4 bg-background border-2 border-dark rounded-xl">
            <svg viewBox="0 0 400 240" className="w-full max-w-[400px]">
              <line x1="40" y1="40"  x2="360" y2="40"  stroke="#E2E8F0" strokeDasharray="3" />
              <line x1="40" y1="90"  x2="360" y2="90"  stroke="#E2E8F0" strokeDasharray="3" />
              <line x1="40" y1="140" x2="360" y2="140" stroke="#E2E8F0" strokeDasharray="3" />
              <line x1="40" y1="190" x2="360" y2="190" stroke="#1E2A38" strokeWidth="2" />
              {(() => {
                const maxVal = Math.max(stats.income - stats.merchantPemasukan, stats.merchantPemasukan, stats.expense, 100000)
                const scale = 140 / maxVal
                const h1 = (stats.income - stats.merchantPemasukan) * scale
                const h2 = stats.merchantPemasukan * scale
                const h3 = stats.expense * scale
                return (
                  <>
                    <rect x="75"  y={190 - h1} width="40" height={h1} fill="#BBF7D0" stroke="#1E2A38" strokeWidth="2" />
                    <text x="95"  y="210" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1E2A38">Iuran</text>
                    <text x="95"  y={180 - h1} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#1E2A38">{formatRupiah(stats.income - stats.merchantPemasukan)}</text>
                    <rect x="180" y={190 - h2} width="40" height={h2} fill="#BFDBFE" stroke="#1E2A38" strokeWidth="2" />
                    <text x="200" y="210" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1E2A38">Toko</text>
                    <text x="200" y={180 - h2} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#1E2A38">{formatRupiah(stats.merchantPemasukan)}</text>
                    <rect x="285" y={190 - h3} width="40" height={h3} fill="#FECACA" stroke="#1E2A38" strokeWidth="2" />
                    <text x="305" y="210" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1E2A38">Keluar</text>
                    <text x="305" y={180 - h3} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#1E2A38">{formatRupiah(stats.expense)}</text>
                  </>
                )
              })()}
            </svg>
          </div>
        </Card>

        {/* WIDGET 5: Alpha Warning */}
        <Card className={`flex flex-col gap-4 border-2 border-dark animate-fade-in-up ${alphaWarning.length > 0 ? 'border-accent' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold font-sans text-dark text-lg">⚠️ Siswa Jarang Hadir</h2>
              <p className="text-xs text-dark/50 font-sans mt-0.5">Alpha terbanyak bulan ini</p>
            </div>
            {alphaWarning.length > 0 && <span className="text-2xl animate-wiggle">🚨</span>}
          </div>

          {alphaWarning.length === 0 ? (
            <div className="text-center py-6 text-dark/40 font-sans text-sm">
              <div className="text-3xl mb-2">🏆</div>
              Tidak ada siswa dengan alpha bulan ini!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alphaWarning.map((s, i) => (
                <div key={s.siswa_id} className="flex items-center gap-3 px-3 py-2.5 bg-background border-2 border-dark/10 rounded-xl hover:border-dark/30 transition-colors">
                  <span className={`text-sm font-bold w-5 shrink-0 font-sans ${i === 0 ? 'text-red-500' : 'text-dark/40'}`}>{i + 1}</span>
                  <span className="font-bold font-sans text-dark flex-1 truncate">{s.nama}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.count >= 3 ? 'bg-red-500' : 'bg-yellow-400'}`} />
                    <span className={`font-bold text-sm font-sans ${s.count >= 3 ? 'text-red-500' : 'text-yellow-600'}`}>
                      {s.count}× alpha
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-xs text-dark/40 font-sans mt-1">💡 Pertimbangkan untuk menghubungi orang tua siswa yang jarang hadir</p>
            </div>
          )}
          <Link href="/admin/absensi" className="text-xs text-dark/40 hover:text-dark font-sans text-right transition-colors">Lihat rekap →</Link>
        </Card>

        {/* Donut Chart */}
        <Card className="flex flex-col gap-4 border-2 border-dark p-6 animate-fade-in-up">
          <div>
            <h2 className="font-bold font-sans text-dark text-lg">Distribusi Pemasukan</h2>
            <p className="text-xs text-dark/60">Persentase Iuran vs Toko Merchant</p>
          </div>
          <div className="w-full flex flex-col sm:flex-row items-center justify-around py-4 bg-background border-2 border-dark rounded-xl gap-4">
            {(() => {
              const iuran = stats.income - stats.merchantPemasukan
              const merchant = stats.merchantPemasukan
              const total = iuran + merchant || 1
              const pctIuran = Math.round((iuran / total) * 100)
              const pctMerchant = Math.round((merchant / total) * 100)
              const circ = 314
              const dashIuran = (pctIuran / 100) * circ
              const dashMerchant = (pctMerchant / 100) * circ
              return (
                <>
                  <svg viewBox="0 0 160 160" className="w-32 h-32 transform -rotate-90">
                    <circle cx="80" cy="80" r="50" fill="transparent" stroke="#1E2A38" strokeWidth="30" />
                    <circle cx="80" cy="80" r="50" fill="transparent" stroke="#BBF7D0" strokeWidth="26" strokeDasharray={`${dashIuran} ${circ}`} strokeDashoffset={0} />
                    {merchant > 0 && <circle cx="80" cy="80" r="50" fill="transparent" stroke="#BFDBFE" strokeWidth="26" strokeDasharray={`${dashMerchant} ${circ}`} strokeDashoffset={-dashIuran} />}
                    <circle cx="80" cy="80" r="37" fill="#FBFBFB" stroke="#1E2A38" strokeWidth="2" />
                  </svg>
                  <div className="flex flex-col gap-3 font-sans">
                    <div className="flex items-center gap-2"><span className="w-4 h-4 border border-dark rounded bg-[#BBF7D0]" /><span className="text-xs font-bold text-dark">Iuran Bulanan ({pctIuran}%)</span></div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 border border-dark rounded bg-[#BFDBFE]" /><span className="text-xs font-bold text-dark">Toko Merchant ({pctMerchant}%)</span></div>
                    <div className="border-t border-dark/10 pt-2 text-xs font-bold text-dark/70">Total Kas Masuk: {formatRupiah(total)}</div>
                  </div>
                </>
              )
            })()}
          </div>
        </Card>

        {/* Cashflow Singkat */}
        <Card className="flex flex-col gap-4 bg-dark text-white border-dark animate-fade-in-up">
          <h2 className="font-bold font-sans text-white/80 text-lg">Cashflow Bulan Ini</h2>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="bg-white rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-[10px] font-bold text-dark/60 uppercase tracking-wide font-sans">💵 Pemasukan</div>
              <div className="text-base font-bold font-sans text-green-700">{formatRupiah(stats.income)}</div>
            </div>
            <div className="bg-white rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-[10px] font-bold text-dark/60 uppercase tracking-wide font-sans">💸 Pengeluaran</div>
              <div className="text-base font-bold font-sans text-red-600">{formatRupiah(stats.expense)}</div>
            </div>
            <div className="bg-white rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-[10px] font-bold text-dark/60 uppercase tracking-wide font-sans">🏦 Saldo Bersih</div>
              <div className={`text-base font-bold font-sans ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(saldo)}</div>
            </div>
          </div>
          <Link href="/admin/keuangan" className="text-xs text-white/50 hover:text-white mt-auto text-right font-sans transition-colors">Lihat detail laporan →</Link>
        </Card>
      </div>

      {/* ── BARIS 5: Iuran Progress + Jadwal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Iuran Progress */}
        <Card className="flex flex-col gap-4 animate-fade-in-up">
          <h2 className="font-bold font-sans text-dark text-lg">Pemasukan Iuran Bulan Ini</h2>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold font-sans text-dark">{formatRupiah(stats.iuranTerkumpul)}</div>
              <div className="text-sm text-dark/60 font-sans mt-1">dari target {formatRupiah(stats.iuranTotal)}</div>
            </div>
            <div className="font-bold font-sans text-primary text-xl">{Math.round(iuranProgress)}%</div>
          </div>
          <div className="h-4 bg-dark/10 rounded-full overflow-hidden border border-dark/20 mt-2">
            <div className="h-full bg-primary transition-all duration-1000 animate-progress-fill" style={{ width: `${Math.min(iuranProgress, 100)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-sans">
            <div className="bg-primary/10 rounded-xl p-2">
              <div className="font-bold text-dark">{stats.iuranTerkumpul > 0 ? Math.round((stats.iuranTerkumpul / Math.max(stats.iuranTotal, 1)) * stats.siswaAktif) : 0}</div>
              <div className="text-dark/50">Sudah Bayar</div>
            </div>
            <div className="bg-accent/10 rounded-xl p-2">
              <div className="font-bold text-dark">{siswaBlmBayar.length}</div>
              <div className="text-dark/50">Belum Bayar</div>
            </div>
            <div className="bg-yellow-100 rounded-xl p-2">
              <div className="font-bold text-dark">{stats.tagihanMenunggu}</div>
              <div className="text-dark/50">Menunggu Verif</div>
            </div>
          </div>
        </Card>

        {/* Jadwal Terdekat */}
        <Card className="animate-fade-in-up">
          <h2 className="font-bold font-sans text-dark text-lg mb-4">📅 Jadwal Terdekat</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-dark bg-background flex flex-col gap-1">
              <div className="text-sm text-dark/60 font-bold font-sans">Ujian Kenaikan Sabuk</div>
              {ujianMendatang ? (
                <>
                  <div className="text-xl font-bold font-sans text-dark">
                    {new Date(ujianMendatang.tgl_ujian).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                    {new Date(eventMendatang.tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
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

      {/* Alert Stok Kritis */}
      {stokKritis.length > 0 && (
        <Card className="border-4 border-dark bg-accent shadow-brutal p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl animate-wiggle">⚠️</span>
            <h3 className="font-bold text-dark text-lg">Peringatan: Stok Produk Hampir Habis!</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {stokKritis.map((item, idx) => (
              <div key={idx} className="bg-white border-2 border-dark rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="font-bold text-dark text-sm truncate max-w-[150px]">{(item.produk_merchant as any)?.nama}</p>
                  <p className="text-dark/60 text-xs">Varian: {item.ukuran}</p>
                </div>
                <Badge color="dark" className="text-xs">{item.stok} Tersisa</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
