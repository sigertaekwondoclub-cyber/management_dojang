'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { Siswa, Iuran, StatusPesanan } from '@/lib/types'

const STATUS_CONFIG_PESANAN: Record<StatusPesanan, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark' }> = {
  menunggu_pembayaran: { label: 'Menunggu Bayar', color: 'accent' },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi', color: 'accent' },
  lunas:               { label: 'Lunas',           color: 'secondary' },
  diproses:            { label: 'Diproses',         color: 'dark' },
  siap_diambil:        { label: 'Siap Diambil ✅',  color: 'primary' },
}

export default function OrtuDashboardPage() {
  const [siswa, setSiswa] = useState<Siswa | null>(null)
  const [iuran, setIuran] = useState<Iuran | null>(null)
  const [kehadiran, setKehadiran] = useState({ persen: 0, hadir: 0, total: 0 })
  const [agenda, setAgenda] = useState<{jenis: string, nama: string, tgl: string} | null>(null)
  const [pesananTerbaru, setPesananTerbaru] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // Widget baru states
  const [absensiListDetail, setAbsensiListDetail] = useState<{ id: string; tgl: string; status_hadir: string }[]>([])
  const [riwayatUjian, setRiwayatUjian] = useState<{ id: string; tgl_ujian: string; sabuk_asal: string; sabuk_tujuan: string; hasil: string | null }[]>([])

  const supabase = createClient()

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('siswa_id').eq('id', user.id).single()
    if (!profile?.siswa_id) { setLoading(false); return }

    // 1. Data Siswa
    const { data: sData } = await supabase
      .from('siswa')
      .select('*, program_kelas(nama_program)')
      .eq('id', profile.siswa_id)
      .single()
    
    if (sData) setSiswa(sData as Siswa)

    const now = new Date()
    const bulan = now.getMonth() + 1
    const tahun = now.getFullYear()
    const today = now.toISOString().split('T')[0]

    const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`
    const endDate = new Date(tahun, bulan, 0).toLocaleDateString('sv-SE')

    // Fetch dashboard data in parallel
    const [
      iuranResult,
      absensiResult,
      ujianResult,
      eventResult,
      pesananResult,
      // NEW Queries
      riwayatUjianResult
    ] = await Promise.all([
      supabase.from('iuran').select('*').eq('siswa_id', profile.siswa_id).eq('bulan', bulan).eq('tahun', tahun).maybeSingle(),
      supabase.from('absensi_siswa').select('id, tgl, status_hadir').eq('siswa_id', profile.siswa_id).gte('tgl', startDate).lte('tgl', endDate).order('tgl', { ascending: false }),
      supabase.from('ujian_sabuk').select('tgl_ujian').eq('siswa_id', profile.siswa_id).gte('tgl_ujian', today).order('tgl_ujian', { ascending: true }).limit(1),
      supabase.from('event_peserta').select('event_kompetisi!inner(nama, tgl)').eq('siswa_id', profile.siswa_id).eq('status_daftar', 'terdaftar').gte('event_kompetisi.tgl', today).order('event_kompetisi(tgl)', { ascending: true }).limit(1),
      supabase.from('pesanan_merchant').select('id, status, total_harga, created_at').eq('siswa_id', profile.siswa_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      // Riwayat Ujian Anak
      supabase.from('ujian_sabuk').select('id, tgl_ujian, sabuk_asal, sabuk_tujuan, hasil').eq('siswa_id', profile.siswa_id).order('tgl_ujian', { ascending: false })
    ])

    const iData = iuranResult.data
    setIuran(iData as Iuran)

    if (pesananResult.data) {
      setPesananTerbaru(pesananResult.data)
    }

    const absensiList = absensiResult.data || []
    setAbsensiListDetail(absensiList as any[])

    const totalPertemuan = absensiList.length
    const hadirCount = absensiList.filter(a => a.status_hadir === 'hadir').length

    const persenHadir = totalPertemuan > 0 ? (hadirCount / totalPertemuan) * 100 : 0
    setKehadiran({ persen: persenHadir, hadir: hadirCount, total: totalPertemuan })

    const ujianData = ujianResult.data
    const eventData = eventResult.data

    // Bandingkan mana yang lebih dekat
    let nextAgenda = null
    const uTgl = ujianData?.[0]?.tgl_ujian
    const eTgl = (eventData?.[0]?.event_kompetisi as any)?.tgl
    
    if (uTgl && eTgl) {
      if (new Date(uTgl) < new Date(eTgl)) {
        nextAgenda = { jenis: 'Ujian Sabuk', nama: 'Kenaikan Tingkat', tgl: uTgl }
      } else {
        nextAgenda = { jenis: 'Event/Kompetisi', nama: (eventData?.[0]?.event_kompetisi as any)?.nama, tgl: eTgl }
      }
    } else if (uTgl) {
      nextAgenda = { jenis: 'Ujian Sabuk', nama: 'Kenaikan Tingkat', tgl: uTgl }
    } else if (eTgl) {
      nextAgenda = { jenis: 'Event/Kompetisi', nama: (eventData?.[0]?.event_kompetisi as any)?.nama, tgl: eTgl }
    }

    setAgenda(nextAgenda)

    // Riwayat Ujian
    setRiwayatUjian(riwayatUjianResult.data || [])

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) return <div className="p-8 text-center text-dark/50 font-pixel text-sm">Loading...</div>
  if (!siswa) return <div className="p-8 text-center text-dark font-pixel text-sm">Akun Anda belum ditautkan ke data anak/siswa.</div>

  const iuranStatusText = iuran?.status_bayar === 'lunas' ? 'Lunas' : iuran?.status_bayar === 'menunggu_verifikasi' ? 'Menunggu Verifikasi' : 'Belum Bayar'
  const iuranColor = iuran?.status_bayar === 'lunas' ? 'primary' : iuran?.status_bayar === 'menunggu_verifikasi' ? 'secondary' : 'accent'

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }

  // RPG Rank / Belt visualizer
  const SABUK_ORDER = ['Putih', 'Kuning', 'Hijau', 'Biru', 'Merah', 'Hitam']
  const currentBeltIdx = SABUK_ORDER.indexOf(siswa.sabuk_saat_ini)
  const nextBelt = currentBeltIdx !== -1 && currentBeltIdx < SABUK_ORDER.length - 1 ? SABUK_ORDER[currentBeltIdx + 1] : 'Hitam (Max)'
  const progressBelt = currentBeltIdx !== -1 ? Math.round(((currentBeltIdx + 1) / SABUK_ORDER.length) * 100) : 100

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-pixel text-dark">Dashboard Orang Tua</h1>
        <p className="text-dark/60 font-sans text-sm mt-1">Pantau perkembangan dan administrasi anak Anda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kartu Anak - RPG Character Sheet */}
        <Card className="p-0 border-[3px] border-dark overflow-hidden flex flex-col h-full bg-white">
          <div className="h-20 bg-primary relative border-b-[3px] border-dark">
            <div className="absolute -bottom-8 left-5 w-20 h-20 bg-white border-[4px] border-dark shadow-[3px_3px_0px_#1E2A38] flex items-center justify-center text-3xl overflow-hidden">
              👤
            </div>
          </div>
          <div className="pt-12 px-5 pb-5 text-dark">
            <h2 className="font-pixel text-xl">{siswa.nama}</h2>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between border-b border-dark/10 pb-2">
                <span className="text-dark/50 font-pixel text-[11px]">SABUK SEKARANG</span>
                <span className="font-pixel text-sm">{siswa.sabuk_saat_ini}</span>
              </div>
              <div className="flex justify-between border-b border-dark/10 pb-2">
                <span className="text-dark/50 font-pixel text-[11px]">GUILD / KELAS</span>
                <span className="font-pixel text-sm">{siswa.program_kelas?.nama_program || '-'}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-dark/50 font-pixel text-[11px]">UMUR</span>
                <span className="font-pixel text-sm">{new Date().getFullYear() - new Date(siswa.tgl_lahir).getFullYear()} Tahun</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Iuran Bulan Ini */}
          <Card className="border-[3px] border-dark">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-pixel text-base text-dark">Iuran Bulan Ini</h3>
              <div className="text-xl">💰</div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-dark/70 font-sans text-sm">Status Tagihan:</span>
              <Badge color={iuranColor}>{iuranStatusText}</Badge>
            </div>
            
            {iuran?.status_bayar !== 'lunas' && (
              <Link href="/ortu/iuran" className="block mt-3 text-center py-2 bg-secondary/20 hover:bg-secondary/40 text-dark font-pixel text-xs border-[2px] border-dark transition-colors duration-75">
                Lihat Detail Tagihan →
              </Link>
            )}
          </Card>

          {/* Kehadiran - EXP Bar Style */}
          <Card className="border-[3px] border-dark flex flex-col justify-center">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-pixel text-base text-dark">EXP Kehadiran</h3>
              <div className="text-xl">📅</div>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-3xl font-pixel text-dark">{Math.round(kehadiran.persen)}%</div>
              <div className="text-dark/60 font-sans text-xs pb-1">({kehadiran.hadir}/{kehadiran.total} sesi)</div>
            </div>
            {/* EXP Bar */}
            <div className="h-4 bg-background border-[2px] border-dark mt-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${kehadiran.persen >= 75 ? 'bg-primary' : kehadiran.persen >= 50 ? 'bg-secondary' : 'bg-accent'}`}
                style={{ width: `${Math.min(kehadiran.persen, 100)}%` }}
              />
            </div>
            <p className="font-pixel text-[10px] text-dark/50 mt-1">
              {kehadiran.persen >= 75 ? 'STATUS: AKTIF' : kehadiran.persen >= 50 ? 'STATUS: CUKUP' : 'STATUS: PERLU TINGKATKAN'}
            </p>
          </Card>
        </div>
      </div>

      {/* ── BARIS 2: Progress Sabuk & Detail Absensi ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Progress Sabuk RPG Style */}
        <Card className="border-[3px] border-dark flex flex-col gap-4">
          <div>
            <h3 className="font-pixel text-base text-dark">🥋 Progress Level Sabuk</h3>
            <p className="text-xs text-dark/60 font-sans">Jalur kenaikan tingkat sabuk Taekwondo</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs font-pixel text-dark">
              <span>{siswa.sabuk_saat_ini}</span>
              <span>Next: {nextBelt}</span>
            </div>
            <div className="h-6 bg-background border-[2px] border-dark overflow-hidden p-0.5">
              <div 
                className="h-full bg-primary border-r border-dark flex items-center justify-end pr-2 transition-all duration-1000"
                style={{ width: `${progressBelt}%` }}
              >
                <span className="font-pixel text-[9px] text-dark font-bold">{progressBelt}%</span>
              </div>
            </div>
            <div className="flex gap-2 justify-between flex-wrap text-[10px] text-dark/50 font-pixel mt-1">
              <span>Rank {currentBeltIdx + 1} of {SABUK_ORDER.length}</span>
              <span>Keep training hard!</span>
            </div>
          </div>
        </Card>

        {/* Riwayat Absensi Bulanan Detail */}
        <Card className="border-[3px] border-dark flex flex-col gap-4">
          <div>
            <h3 className="font-pixel text-base text-dark">📅 Log Kehadiran Bulan Ini</h3>
            <p className="text-xs text-dark/60 font-sans">Daftar presensi latihan anak Anda</p>
          </div>
          {absensiListDetail.length === 0 ? (
            <div className="text-center py-6 text-dark/40 font-pixel text-xs">Belum ada sesi latihan tercatat bulan ini</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
              {absensiListDetail.map((item, idx) => (
                <div key={item.id || idx} className="flex justify-between items-center p-2 bg-background border-2 border-dark/10 text-xs font-sans">
                  <span className="font-bold text-dark">{new Date(item.tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase border ${
                    item.status_hadir === 'hadir' ? 'bg-primary/20 text-green-700 border-green-600/30' :
                    item.status_hadir === 'izin' ? 'bg-yellow-100 text-yellow-700 border-yellow-500/30' :
                    item.status_hadir === 'sakit' ? 'bg-blue-100 text-blue-700 border-blue-500/30' :
                    'bg-red-100 text-red-700 border-red-500/30'
                  }`}>
                    {item.status_hadir}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Pesanan Terbaru */}
      {pesananTerbaru && (
        <Link href="/ortu/merchant/pesanan">
          <Card hoverable className="border-2 border-dark p-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-dark text-sm">🛒 Pesanan Terbaru</p>
                <p className="text-primary font-bold mt-0.5">{formatRupiah(pesananTerbaru.total_harga)}</p>
              </div>
              <Badge color={STATUS_CONFIG_PESANAN[pesananTerbaru.status as StatusPesanan]?.color || 'dark'}>
                {STATUS_CONFIG_PESANAN[pesananTerbaru.status as StatusPesanan]?.label || pesananTerbaru.status}
              </Badge>
            </div>
          </Card>
        </Link>
      )}

      {/* Agenda Mendatang */}
      <Card className="border-[3px] border-dark">
        <h3 className="font-pixel text-base text-dark mb-4">Agenda Mendatang</h3>
        {agenda ? (
          <div className="p-3 border-[2px] border-dark bg-background flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="font-pixel text-[10px] text-dark/50 uppercase tracking-wider">{agenda.jenis}</div>
              <div className="font-pixel text-lg text-dark leading-tight mt-1">{agenda.nama}</div>
            </div>
            <div className="bg-white border-[2px] border-dark px-3 py-2 font-pixel text-xs text-dark shadow-[2px_2px_0px_#1E2A38] text-center min-w-[140px]">
              {new Date(agenda.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-dark/50 font-pixel text-sm">
            Belum ada jadwal ujian atau event terdekat.
          </div>
        )}
      </Card>

      {/* Riwayat Ujian & Hasil Sabuk */}
      <Card className="border-[3px] border-dark">
        <h3 className="font-pixel text-base text-dark mb-4">🏆 Riwayat Kenaikan Sabuk</h3>
        {riwayatUjian.length === 0 ? (
          <div className="py-6 text-center text-dark/50 font-pixel text-sm">
            Belum ada catatan riwayat ujian kenaikan sabuk.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {riwayatUjian.map((ujian) => (
              <div key={ujian.id} className="p-3 bg-white border-2 border-dark flex justify-between items-center text-xs font-sans">
                <div>
                  <p className="font-bold text-dark">{new Date(ujian.tgl_ujian).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="text-dark/60 text-[10px] mt-0.5">Ujian Sabuk {ujian.sabuk_asal} ➔ {ujian.sabuk_tujuan}</p>
                </div>
                <span className={`font-bold px-2 py-0.5 border border-dark uppercase ${ujian.hasil === 'lulus' ? 'bg-primary text-dark' : ujian.hasil === 'tidak_lulus' ? 'bg-accent text-white' : 'bg-yellow-100 text-dark'}`}>
                  {ujian.hasil === 'lulus' ? 'LULUS' : ujian.hasil === 'tidak_lulus' ? 'TIDAK LULUS' : 'MENUNGGU HASIL'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
