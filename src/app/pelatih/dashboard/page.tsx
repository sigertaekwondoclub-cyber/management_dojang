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
      ujianResult
    ] = await Promise.all([
      supabase.from('absensi_pelatih').select('pelatih_id').gte('tgl', startDate).lte('tgl', endDate),
      supabase.from('pengaturan_club').select('persentase_pool_honor').limit(1),
      supabase.from('iuran').select('nominal').eq('bulan', bulan).eq('tahun', tahun).eq('status_bayar', 'lunas'),
      supabase.from('ujian_sabuk').select('id').is('hasil', null)
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

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) return <div className="p-8 text-center text-dark/50 font-bold font-sans">Memuat Dashboard...</div>
  if (!pelatihInfo) return <div className="p-8 text-center text-dark font-bold font-sans">Akun Anda belum ditautkan ke data pelatih.</div>

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
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
    </div>
  )
}
