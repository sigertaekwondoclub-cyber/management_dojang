'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

interface KelasBreakdown {
  id: string
  nama: string
  biaya_bulanan: number
  jumlahSiswa: number
  revenueKelas: number
  proporsiPool: number
  classPool: number
  totalSesiKelas: number
  ratePerSesi: number
  sesiSaya: number
  honorKelas: number
}

interface EstimasiData {
  isOfficialPayroll: boolean
  officialTotalPayout: number
  officialTeachingHonor: number
  officialFounderShare: number
  officialSessionsTaught: number
  pctCoachPool: number
  pctFounderMargin: number
  totalIncomeLunas: number
  totalIncomeTarget: number
  coachPoolAmount: number
  founderMarginAmount: number
  totalSesiSaya: number
  totalSesiSemuaPelatih: number
  kelasBreakdown: KelasBreakdown[]
  teachingHonor: number
  founderShare: number
  totalEstimasi: number
  isFounder: boolean
  bulan: number
  tahun: number
  lastUpdated: Date
}

export default function PelatihEstimasiPage() {
  const supabase = createClient()
  const [data, setData] = useState<EstimasiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pelatihInfo, setPelatihInfo] = useState<{ nama: string; id: string } | null>(null)
  const [countdown, setCountdown] = useState(60)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchEstimasi = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles').select('pelatih_id').eq('id', user.id).single()

    if (!profile?.pelatih_id) { setLoading(false); return }

    const { data: pData } = await supabase
      .from('pelatih').select('nama, id, is_founder').eq('id', profile.pelatih_id).single()

    if (pData) setPelatihInfo({ nama: pData.nama, id: pData.id })
    const isFounder = pData?.is_founder || false

    const now = new Date()
    const bulan = now.getMonth() + 1
    const tahun = now.getFullYear()
    const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`
    const endDate = new Date(tahun, bulan, 0).toLocaleDateString('sv-SE')

    // Cek snapshot payroll resmi bulan ini
    const { data: runData } = await supabase
      .from('payroll_runs')
      .select('id, coach_pool_amount, founder_margin_amount')
      .eq('bulan', bulan).eq('tahun', tahun).maybeSingle()

    if (runData) {
      const { data: detailData } = await supabase
        .from('payroll_details')
        .select('total_payout, teaching_honor, founder_margin_share, sessions_taught')
        .eq('payroll_run_id', runData.id)
        .eq('pelatih_id', profile.pelatih_id).maybeSingle()

      if (detailData) {
        setData({
          isOfficialPayroll: true,
          officialTotalPayout: Number(detailData.total_payout || 0),
          officialTeachingHonor: Number(detailData.teaching_honor || 0),
          officialFounderShare: Number(detailData.founder_margin_share || 0),
          officialSessionsTaught: Number(detailData.sessions_taught || 0),
          pctCoachPool: 0, pctFounderMargin: 0,
          totalIncomeLunas: 0, totalIncomeTarget: 0,
          coachPoolAmount: Number(runData.coach_pool_amount || 0),
          founderMarginAmount: Number(runData.founder_margin_amount || 0),
          totalSesiSaya: Number(detailData.sessions_taught || 0),
          totalSesiSemuaPelatih: 0, kelasBreakdown: [],
          teachingHonor: Number(detailData.teaching_honor || 0),
          founderShare: Number(detailData.founder_margin_share || 0),
          totalEstimasi: Number(detailData.total_payout || 0),
          isFounder, bulan, tahun, lastUpdated: new Date(),
        })
        setLoading(false); setRefreshing(false); return
      }
    }

    // Hitung real-time
    const [configRes, iuranLunasRes, iuranAllRes, classesRes, studentsRes, absensiAllRes, allCoachesRes] = await Promise.all([
      supabase.from('pengaturan_club').select('pct_coach_pool, pct_founder_margin').limit(1).maybeSingle(),
      supabase.from('iuran').select('nominal').eq('bulan', bulan).eq('tahun', tahun).eq('status_bayar', 'lunas'),
      supabase.from('iuran').select('nominal').eq('bulan', bulan).eq('tahun', tahun),
      supabase.from('program_kelas').select('*').eq('status_aktif', true),
      supabase.from('siswa').select('program_kelas_id').eq('status_aktif', true),
      supabase.from('absensi_pelatih').select('id, program_kelas_id, pelatih_id').gte('tgl', startDate).lte('tgl', endDate),
      supabase.from('pelatih').select('id, is_founder').eq('status_aktif', true),
    ])

    const pctCoachPool = Number(configRes.data?.pct_coach_pool ?? 0.45)
    const pctFounderMargin = Number(configRes.data?.pct_founder_margin ?? 0.08)
    const totalIncomeLunas = (iuranLunasRes.data || []).reduce((a, c) => a + Number(c.nominal || 0), 0)
    const totalIncomeAll = (iuranAllRes.data || []).reduce((a, c) => a + Number(c.nominal || 0), 0)
    const coachPoolAmount = totalIncomeLunas * pctCoachPool
    const founderMarginAmount = totalIncomeLunas * pctFounderMargin

    const activeClasses = classesRes.data || []
    const allStudents = studentsRes.data || []
    const allSessions = absensiAllRes.data || []
    const allCoaches = allCoachesRes.data || []

    const classRevenue: Record<string, number> = {}
    let totalClassRevenue = 0
    for (const prog of activeClasses) {
      const count = allStudents.filter(s => s.program_kelas_id === prog.id).length
      const revenue = count * Number(prog.biaya_bulanan || 0)
      classRevenue[prog.id] = revenue
      totalClassRevenue += revenue
    }

    const kelasBreakdown: KelasBreakdown[] = []
    for (const prog of activeClasses) {
      const proporsiPool = totalClassRevenue > 0 ? classRevenue[prog.id] / totalClassRevenue : 0
      const classPool = coachPoolAmount * proporsiPool
      const totalSesiKelas = allSessions.filter(s => s.program_kelas_id === prog.id).length
      const ratePerSesi = totalSesiKelas > 0 ? classPool / totalSesiKelas : 0
      const sesiSaya = allSessions.filter(s => s.program_kelas_id === prog.id && s.pelatih_id === profile.pelatih_id).length
      const jumlahSiswa = allStudents.filter(s => s.program_kelas_id === prog.id).length
      kelasBreakdown.push({
        id: prog.id, nama: prog.nama_program,
        biaya_bulanan: Number(prog.biaya_bulanan || 0), jumlahSiswa,
        revenueKelas: classRevenue[prog.id],
        proporsiPool: Math.round(proporsiPool * 100),
        classPool, totalSesiKelas, ratePerSesi, sesiSaya,
        honorKelas: sesiSaya * ratePerSesi,
      })
    }
    kelasBreakdown.sort((a, b) => b.sesiSaya - a.sesiSaya)

    const totalSesiSaya = allSessions.filter(s => s.pelatih_id === profile.pelatih_id).length
    const totalSesiSemuaPelatih = allSessions.length
    const teachingHonor = kelasBreakdown.reduce((a, k) => a + k.honorKelas, 0)
    const founderCoaches = allCoaches.filter(c => c.is_founder)
    const founderShare = (isFounder && founderCoaches.length > 0) ? founderMarginAmount / founderCoaches.length : 0

    setData({
      isOfficialPayroll: false,
      officialTotalPayout: 0, officialTeachingHonor: 0, officialFounderShare: 0, officialSessionsTaught: 0,
      pctCoachPool: Math.round(pctCoachPool * 100),
      pctFounderMargin: Math.round(pctFounderMargin * 100),
      totalIncomeLunas, totalIncomeTarget: totalIncomeAll,
      coachPoolAmount, founderMarginAmount,
      totalSesiSaya, totalSesiSemuaPelatih, kelasBreakdown,
      teachingHonor, founderShare,
      totalEstimasi: Math.round(teachingHonor + founderShare),
      isFounder, bulan, tahun, lastUpdated: new Date(),
    })
    setLoading(false); setRefreshing(false)
  }, [supabase])

  useEffect(() => {
    fetchEstimasi()
    intervalRef.current = setInterval(() => { setCountdown(60); fetchEstimasi(true) }, 60_000)
    countdownRef.current = setInterval(() => { setCountdown(prev => prev <= 1 ? 60 : prev - 1) }, 1_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchEstimasi])

  const handleRefresh = () => { setCountdown(60); fetchEstimasi(true) }

  if (loading) return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <div className="h-8 w-72 bg-dark/10 rounded-xl animate-pulse" />
      <div className="h-44 bg-dark/10 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-dark/10 rounded-2xl animate-pulse" />)}
      </div>
      <div className="h-56 bg-dark/10 rounded-2xl animate-pulse" />
    </div>
  )

  if (!data) return (
    <div className="text-center py-20 text-dark/50 font-sans">
      <div className="text-5xl mb-3">⚠️</div>
      <p className="font-bold text-dark/60">Akun belum terhubung ke data pelatih.</p>
    </div>
  )

  const iuranProgress = data.totalIncomeTarget > 0 ? Math.min((data.totalIncomeLunas / data.totalIncomeTarget) * 100, 100) : 0

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-10">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">📊 Estimasi Honor Real-Time</h1>
          <p className="text-dark/60 font-sans mt-1">
            {BULAN_NAMES[data.bulan]} {data.tahun} — <span className="font-bold text-dark">{pelatihInfo?.nama}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-dark/40 font-sans text-right">
            <div>Update: {data.lastUpdated.toLocaleTimeString('id-ID')}</div>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Auto-refresh dalam <span className="font-bold text-dark/60">{countdown}d</span></span>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="px-3 py-2 border-2 border-dark bg-white font-pixel text-xs text-dark hover:bg-background transition-all disabled:opacity-50 shadow-[2px_2px_0px_#1E2A38] active:shadow-none active:translate-x-0.5 active:translate-y-0.5">
            {refreshing ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Banner Payroll Resmi */}
      {data.isOfficialPayroll && (
        <div className="bg-[#BBF7D0] border-4 border-dark p-5 rounded-2xl shadow-[4px_4px_0px_#1E2A38] flex items-center gap-4">
          <div className="text-3xl">✅</div>
          <div>
            <h4 className="font-bold text-dark font-sans text-lg">Payroll Resmi Bulan Ini Sudah Dirilis!</h4>
            <p className="text-dark/70 text-sm font-sans mt-0.5">
              Admin telah menghitung honor resmi. Data di bawah adalah angka final bukan estimasi.
            </p>
          </div>
        </div>
      )}

      {/* Hero Total Honor */}
      <div className="bg-dark text-white border-4 border-dark rounded-2xl p-6 shadow-[4px_4px_0px_#1E2A38]">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 font-sans mb-2">
              {data.isOfficialPayroll ? '✅ HONOR RESMI BULAN INI' : '📊 TOTAL ESTIMASI HONOR'}
            </div>
            <div className={`text-5xl font-bold font-sans ${refreshing ? 'opacity-40' : ''}`}>
              {formatRupiah(data.totalEstimasi)}
            </div>
            <div className="text-white/50 text-sm font-sans mt-2">
              {data.isOfficialPayroll
                ? `${data.officialSessionsTaught} sesi mengajar bulan ini`
                : `${data.totalSesiSaya} dari ${data.totalSesiSemuaPelatih} total sesi semua pelatih`}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[160px]">
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">🏫 Honor Mengajar</div>
              <div className="text-xl font-bold font-sans">
                {formatRupiah(data.isOfficialPayroll ? data.officialTeachingHonor : data.teachingHonor)}
              </div>
            </div>
            {(data.isFounder || data.founderShare > 0 || data.officialFounderShare > 0) && (
              <div className="bg-yellow-400/20 rounded-xl p-3 border border-yellow-400/30">
                <div className="text-[10px] uppercase tracking-wider text-yellow-300 font-bold mb-1">⭐ Founder Margin</div>
                <div className="text-xl font-bold font-sans">
                  {formatRupiah(data.isOfficialPayroll ? data.officialFounderShare : data.founderShare)}
                </div>
              </div>
            )}
          </div>
        </div>
        {!data.isOfficialPayroll && (
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40 font-sans">
            💡 Estimasi real-time berdasarkan iuran lunas & sesi mengajar bulan berjalan. Angka final ditetapkan saat admin generate payroll resmi.
          </div>
        )}
      </div>

      {/* Alur Kalkulasi 3 Langkah */}
      {!data.isOfficialPayroll && (
        <div>
          <h2 className="font-bold font-sans text-dark text-lg mb-3">🔢 Alur Kalkulasi Honor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Step 1 */}
            <Card className="border-2 border-dark p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-dark text-white font-pixel text-sm flex items-center justify-center shrink-0">1</span>
                <span className="font-bold text-dark font-sans text-sm">Iuran Lunas</span>
              </div>
              <div className="text-2xl font-bold font-sans text-green-700">{formatRupiah(data.totalIncomeLunas)}</div>
              <div>
                <div className="h-2 bg-dark/10 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-[#BBF7D0] border-r-2 border-green-600 transition-all duration-700" style={{ width: `${iuranProgress}%` }} />
                </div>
                <div className="text-[10px] text-dark/40 font-sans">{Math.round(iuranProgress)}% dari total tagihan</div>
              </div>
            </Card>

            {/* Step 2 */}
            <Card className="border-2 border-dark p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-dark text-white font-pixel text-sm flex items-center justify-center shrink-0">2</span>
                <span className="font-bold text-dark font-sans text-sm">Coach Pool ({data.pctCoachPool}%)</span>
              </div>
              <div className="text-2xl font-bold font-sans text-blue-700">{formatRupiah(data.coachPoolAmount)}</div>
              <div className="text-[10px] text-dark/40 font-sans">Alokasi untuk semua pelatih bulan ini</div>
              {data.isFounder && (
                <div className="p-2 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <div className="text-[10px] font-bold text-yellow-700">+ Founder Margin ({data.pctFounderMargin}%)</div>
                  <div className="font-bold text-yellow-800 text-sm mt-0.5">{formatRupiah(data.founderMarginAmount)}</div>
                </div>
              )}
            </Card>

            {/* Step 3 */}
            <Card className="border-2 border-dark p-5 flex flex-col gap-3 bg-[#BFDBFE]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-dark text-white font-pixel text-sm flex items-center justify-center shrink-0">3</span>
                <span className="font-bold text-dark font-sans text-sm">Honor Anda</span>
              </div>
              <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(data.teachingHonor)}</div>
              <div>
                <div className="text-[10px] text-dark/50 font-sans mb-1">
                  {data.totalSesiSaya} sesi dari {data.totalSesiSemuaPelatih} total sesi
                </div>
                {data.totalSesiSemuaPelatih > 0 && (
                  <div className="h-2 bg-dark/20 rounded-full overflow-hidden">
                    <div className="h-full bg-dark transition-all duration-700"
                      style={{ width: `${Math.min((data.totalSesiSaya / data.totalSesiSemuaPelatih) * 100, 100)}%` }} />
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Breakdown Per Kelas */}
      {!data.isOfficialPayroll && data.kelasBreakdown.length > 0 && (
        <div>
          <h2 className="font-bold font-sans text-dark text-lg mb-3">🥋 Rincian Per Program Kelas</h2>
          <div className="flex flex-col gap-3">
            {data.kelasBreakdown.map(k => (
              <Card key={k.id} className="border-2 border-dark p-5 hover:-translate-y-0.5 transition-transform">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <h3 className="font-bold font-sans text-dark text-base">{k.nama}</h3>
                    <p className="text-xs text-dark/40 font-sans mt-0.5">
                      {k.jumlahSiswa} siswa aktif · Iuran {formatRupiah(k.biaya_bulanan)}/bulan
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold font-sans text-primary">{formatRupiah(k.honorKelas)}</div>
                    <div className="text-[10px] uppercase text-dark/40 tracking-wider font-bold">Honor Kelas Ini</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-background rounded-xl p-3 border border-dark/10">
                    <div className="text-dark/40 uppercase text-[10px] font-bold mb-1">Revenue Kelas</div>
                    <div className="font-bold text-dark text-sm">{formatRupiah(k.revenueKelas)}</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-dark/10">
                    <div className="text-dark/40 uppercase text-[10px] font-bold mb-1">Pool ({k.proporsiPool}%)</div>
                    <div className="font-bold text-dark text-sm">{formatRupiah(k.classPool)}</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-dark/10">
                    <div className="text-dark/40 uppercase text-[10px] font-bold mb-1">Rate/Sesi</div>
                    <div className="font-bold text-dark text-sm">{formatRupiah(Math.round(k.ratePerSesi))}</div>
                    <div className="text-dark/30 text-[9px]">{k.totalSesiKelas} sesi total</div>
                  </div>
                  <div className={`rounded-xl p-3 border-2 ${k.sesiSaya > 0 ? 'bg-[#BFDBFE] border-dark' : 'bg-background border-dark/10'}`}>
                    <div className="text-dark/40 uppercase text-[10px] font-bold mb-1">Sesi Saya</div>
                    <div className={`font-bold ${k.sesiSaya > 0 ? 'text-dark text-lg' : 'text-dark/30 text-sm'}`}>{k.sesiSaya} sesi</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-dark/30 font-sans mb-1">
                    <span>Proporsi Coach Pool</span>
                    <span>{k.proporsiPool}%</span>
                  </div>
                  <div className="h-1.5 bg-dark/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(k.proporsiPool, 100)}%` }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Official Payroll Breakdown */}
      {data.isOfficialPayroll && (
        <div>
          <h2 className="font-bold font-sans text-dark text-lg mb-3">📋 Rincian Honor Resmi</h2>
          <Card className="border-2 border-dark p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#BBF7D0] rounded-xl p-4 border border-dark/10">
                <div className="text-[10px] uppercase font-bold text-dark/50 tracking-wider mb-2">Sesi Mengajar</div>
                <div className="text-4xl font-bold text-dark">{data.officialSessionsTaught}</div>
                <div className="text-xs text-dark/40 mt-1">sesi bulan ini</div>
              </div>
              <div className="bg-[#BFDBFE] rounded-xl p-4 border border-dark/10">
                <div className="text-[10px] uppercase font-bold text-dark/50 tracking-wider mb-2">Honor Mengajar</div>
                <div className="text-2xl font-bold text-dark">{formatRupiah(data.officialTeachingHonor)}</div>
              </div>
              <div className="bg-[#FDE68A] rounded-xl p-4 border border-dark/10">
                <div className="text-[10px] uppercase font-bold text-dark/50 tracking-wider mb-2">⭐ Founder Margin</div>
                <div className="text-2xl font-bold text-dark">{formatRupiah(data.officialFounderShare)}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t-2 border-dark/10 flex justify-between items-center">
              <span className="text-sm text-dark/50 font-sans">Total Coach Pool Club Bulan Ini</span>
              <span className="font-bold text-dark font-sans">{formatRupiah(data.coachPoolAmount)}</span>
            </div>
          </Card>
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/pelatih/honor"
          className="px-4 py-2.5 border-2 border-dark bg-white font-pixel text-xs text-dark hover:bg-background transition-all shadow-[2px_2px_0px_#1E2A38] active:shadow-none">
          🏆 Lihat Riwayat Slip Honor →
        </Link>
        <Link href="/pelatih/absensi"
          className="px-4 py-2.5 border-2 border-dark bg-white font-pixel text-xs text-dark hover:bg-background transition-all shadow-[2px_2px_0px_#1E2A38] active:shadow-none">
          📋 Input Absensi →
        </Link>
      </div>
    </div>
  )
}
