'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function PelatihDashboardPage() {
  const [stats, setStats] = useState({
    sesiBulanIni: 0,
    estimasiHonor: 0,
    ujianPending: 0
  })
  const [loading, setLoading] = useState(true)
  const [pelatihInfo, setPelatihInfo] = useState<{nama: string, id: string} | null>(null)
  
  // Widget baru states
  const [kehadiranKelas, setKehadiranKelas] = useState<{ kelas: string; pct: number; total: number; hadir: number }[]>([])
  const [alphaWarning, setAlphaWarning] = useState<{ nama: string; count: number }[]>([])
  const [riwayatHonor, setRiwayatHonor] = useState<{ bulan: number; tahun: number; total_payout: number; status_dibayar: boolean }[]>([])

  const supabase = createClient()

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('pelatih_id').eq('id', user.id).single()
    if (!profile?.pelatih_id) { setLoading(false); return }

    const { data: pData } = await supabase.from('pelatih').select('nama, id').eq('id', profile.pelatih_id).single()
    if (pData) setPelatihInfo(pData)

    const now = new Date()
    const bulan = now.getMonth() + 1
    const tahun = now.getFullYear()

    const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`
    const endDate = new Date(tahun, bulan, 0).toLocaleDateString('sv-SE')

    // Fetch pelatih metrics in parallel
    const [
      absensiResult,
      pengaturanResult,
      iuranResult,
      ujianResult,
      // NEW Queries
      absensiSiswaResult,
      alphaSiswaResult,
      honorResult
    ] = await Promise.all([
      supabase.from('absensi_pelatih').select('pelatih_id').gte('tgl', startDate).lte('tgl', endDate),
      supabase.from('pengaturan_club').select('persentase_pool_honor').limit(1),
      supabase.from('iuran').select('nominal').eq('bulan', bulan).eq('tahun', tahun).eq('status_bayar', 'lunas'),
      supabase.from('ujian_sabuk').select('id').is('hasil', null),
      // Absensi murid kelas pelatih bulan ini
      supabase.from('absensi_siswa').select('kelas, status_hadir').eq('pelatih_id_pengajar', profile.pelatih_id).gte('tgl', startDate).lte('tgl', endDate),
      // Siswa alpha terbanyak di kelas pelatih bulan ini
      supabase.from('absensi_siswa').select('siswa_id, status_hadir, siswa:siswa_id(nama)').eq('pelatih_id_pengajar', profile.pelatih_id).eq('status_hadir', 'alpha').gte('tgl', startDate).lte('tgl', endDate),
      // Riwayat Honor / Payroll
      supabase.from('payroll_details').select('total_payout, status_dibayar, payroll_runs(bulan, tahun)').eq('pelatih_id', profile.pelatih_id).order('created_at', { ascending: false }).limit(3)
    ])

    const absensiList = absensiResult.data
    let mySesi = 0
    let totalSesiAll = 0
    absensiList?.forEach(a => {
      totalSesiAll++
      if (a.pelatih_id === profile.pelatih_id) mySesi++
    })

    let persentase = 40
    if (pengaturanResult.data?.[0]) persentase = pengaturanResult.data[0].persentase_pool_honor

    const iuranData = iuranResult.data
    let iuranTerkumpul = 0
    iuranData?.forEach(i => iuranTerkumpul += Number(i.nominal))

    const totalPool = (iuranTerkumpul * persentase) / 100
    let estimasiHonor = 0
    if (totalSesiAll > 0) {
      estimasiHonor = (mySesi / totalSesiAll) * totalPool
    }

    const ujianData = ujianResult.data
    
    setStats({
      sesiBulanIni: mySesi,
      estimasiHonor,
      ujianPending: ujianData?.length || 0
    })

    // ── Widget 1: Kehadiran per Kelas ──
    const asData = absensiSiswaResult.data || []
    const kelasMap: Record<string, { total: number; hadir: number }> = {}
    asData.forEach((r: any) => {
      if (!kelasMap[r.kelas]) kelasMap[r.kelas] = { total: 0, hadir: 0 }
      kelasMap[r.kelas].total++
      if (r.status_hadir === 'hadir') kelasMap[r.kelas].hadir++
    })
    setKehadiranKelas(Object.entries(kelasMap).map(([kelas, v]) => ({
      kelas, total: v.total, hadir: v.hadir,
      pct: v.total > 0 ? Math.round((v.hadir / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total))

    // ── Widget 2: Alpha Warning ──
    const alphaMap: Record<string, { nama: string; count: number }> = {}
    ;(alphaSiswaResult.data || []).forEach((r: any) => {
      const sId = r.siswa_id
      if (!alphaMap[sId]) alphaMap[sId] = { nama: (r.siswa as any)?.nama || '-', count: 0 }
      alphaMap[sId].count++
    })
    setAlphaWarning(
      Object.entries(alphaMap)
        .map(([_, v]) => ({ nama: v.nama, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    )

    // ── Widget 3: Riwayat Honor ──
    const rawHonor = honorResult.data || []
    setRiwayatHonor(rawHonor.map((h: any) => ({
      total_payout: h.total_payout,
      status_dibayar: h.status_dibayar,
      bulan: h.payroll_runs?.bulan || 0,
      tahun: h.payroll_runs?.tahun || 0
    })).filter(h => h.bulan > 0))

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

  if (loading) return <div className="p-8 text-center text-dark/50 font-bold font-sans">Memuat Dashboard...</div>
  if (!pelatihInfo) return <div className="p-8 text-center text-dark font-bold font-sans">Akun Anda belum ditautkan ke data pelatih.</div>

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🏠 Dashboard Pelatih</h1>
        <p className="text-dark/60 font-sans mt-1">Selamat datang, <span className="font-bold text-dark">{pelatihInfo.nama}</span>!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Sesi Mengajar */}
        <Card className="p-6 border-2 border-dark bg-[#BFDBFE] hover:-translate-y-1 transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Sesi Bulan Ini</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.sesiBulanIni}</div>
            </div>
            <div className="text-4xl opacity-80">📋</div>
          </div>
          <Link href="/pelatih/absensi" className="text-xs font-bold text-dark mt-4 block hover:underline">Isi Absensi Baru →</Link>
        </Card>

        {/* Estimasi Honor */}
        <Card className="p-6 border-2 border-dark bg-[#BBF7D0] hover:-translate-y-1 transition-transform">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Estimasi Honor (Real-time)</div>
              <div className="text-2xl font-bold font-sans text-dark mt-2">{formatRupiah(stats.estimasiHonor)}</div>
            </div>
            <div className="text-4xl opacity-80">💰</div>
          </div>
          <div className="text-xs text-dark/70 mt-3 font-sans">*Dihitung dari iuran terkumpul saat ini dibagi proporsi sesi mengajar.</div>
        </Card>

        {/* Ujian Pending */}
        <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform ${stats.ujianPending > 0 ? 'bg-[#FDE68A]' : 'bg-background'}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Ujian Menunggu Nilai</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1">{stats.ujianPending}</div>
            </div>
            <div className="text-4xl opacity-80">🏅</div>
          </div>
          {stats.ujianPending > 0 && (
            <Link href="/pelatih/ujian" className="text-xs font-bold text-dark mt-4 block hover:underline">
              Input nilai sekarang →
            </Link>
          )}
        </Card>
      </div>

      {/* ── BARIS 2: Widget Baru ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        {/* Kehadiran per Kelas */}
        <Card className="border-2 border-dark p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-dark text-lg font-sans">📈 Kehadiran Siswa Bulan Ini</h3>
            <p className="text-xs text-dark/60 font-sans">Persentase kehadiran di kelas yang Anda ajar</p>
          </div>
          {kehadiranKelas.length === 0 ? (
            <div className="text-center py-8 text-dark/40 text-sm font-sans">Belum ada data absensi murid bulan ini</div>
          ) : (
            <div className="flex flex-col gap-4">
              {kehadiranKelas.map(k => (
                <div key={k.kelas} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-sm font-bold text-dark font-sans">
                    <span>Kelas {k.kelas}</span>
                    <span className={k.pct >= 85 ? 'text-green-600' : k.pct >= 70 ? 'text-yellow-600' : 'text-red-500'}>{k.pct}%</span>
                  </div>
                  <div className="h-3 bg-dark/10 rounded-full border border-dark/10 overflow-hidden">
                    <div 
                      className={`h-full transition-all ${k.pct >= 85 ? 'bg-primary' : k.pct >= 70 ? 'bg-yellow-400' : 'bg-accent'}`}
                      style={{ width: `${k.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-dark/50 font-sans">{k.hadir} hadir dari {k.total} log absensi</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Siswa Alpha Warning */}
        <Card className={`border-2 border-dark p-6 flex flex-col gap-4 ${alphaWarning.length > 0 ? 'border-accent' : ''}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-dark text-lg font-sans">⚠️ Murid Alpha Terbanyak</h3>
              <p className="text-xs text-dark/60 font-sans">Siswa yang tidak hadir tanpa keterangan bulan ini</p>
            </div>
            {alphaWarning.length > 0 && <span className="text-2xl animate-wiggle">🚨</span>}
          </div>
          {alphaWarning.length === 0 ? (
            <div className="text-center py-8 text-dark/40 text-sm font-sans">
              <div className="text-3xl mb-2">🎉</div>
              Bagus! Tidak ada murid alpha bulan ini.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alphaWarning.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-background border-2 border-dark/10 rounded-xl hover:border-dark/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-dark/40 font-mono">#{idx+1}</span>
                    <span className="font-bold text-dark text-sm font-sans">{s.nama}</span>
                  </div>
                  <span className="text-sm font-bold text-accent font-sans">{s.count}× Alpha</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── BARIS 3: Riwayat Honor ── */}
      <Card className="border-2 border-dark p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-dark text-lg font-sans">🏅 Riwayat Honor (3 Bulan Terakhir)</h3>
          <p className="text-xs text-dark/60 font-sans">Status pembayaran rincian honor payroll resmi dari club</p>
        </div>
        {riwayatHonor.length === 0 ? (
          <div className="text-center py-8 text-dark/40 text-sm font-sans">Belum ada slip honor resmi yang dirilis oleh admin.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {riwayatHonor.map((h, idx) => (
              <div key={idx} className="p-4 bg-white border-2 border-dark rounded-xl flex flex-col justify-between gap-3 hover:-translate-y-0.5 transition-transform">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-dark/50 uppercase tracking-wider font-sans">Periode</p>
                    <p className="font-bold text-dark text-sm font-sans">{BULAN_NAMES[h.bulan]} {h.tahun}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border border-dark rounded-none font-sans ${h.status_dibayar ? 'bg-primary text-dark' : 'bg-accent text-white'}`}>
                    {h.status_dibayar ? 'Lunas Dibayar' : 'Pending'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-dark/50 uppercase tracking-wider font-sans">Nominal Diterima</p>
                  <p className="text-lg font-bold text-dark font-sans">{formatRupiah(h.total_payout)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
