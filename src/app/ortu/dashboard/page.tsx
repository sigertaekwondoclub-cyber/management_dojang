'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { Siswa, Iuran } from '@/lib/types'

export default function OrtuDashboardPage() {
  const [siswa, setSiswa] = useState<Siswa | null>(null)
  const [iuran, setIuran] = useState<Iuran | null>(null)
  const [kehadiran, setKehadiran] = useState({ persen: 0, hadir: 0, total: 0 })
  const [agenda, setAgenda] = useState<{jenis: string, nama: string, tgl: string} | null>(null)
  const [loading, setLoading] = useState(true)

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
      eventResult
    ] = await Promise.all([
      supabase.from('iuran').select('*').eq('siswa_id', profile.siswa_id).eq('bulan', bulan).eq('tahun', tahun).maybeSingle(),
      supabase.from('absensi_siswa').select('id, status_hadir').eq('siswa_id', profile.siswa_id).gte('tgl', startDate).lte('tgl', endDate),
      supabase.from('ujian_sabuk').select('tgl_ujian').eq('siswa_id', profile.siswa_id).gte('tgl_ujian', today).order('tgl_ujian', { ascending: true }).limit(1),
      supabase.from('event_peserta').select('event_kompetisi!inner(nama, tgl)').eq('siswa_id', profile.siswa_id).eq('status_daftar', 'terdaftar').gte('event_kompetisi.tgl', today).order('event_kompetisi(tgl)', { ascending: true }).limit(1)
    ])

    const iData = iuranResult.data
    setIuran(iData as Iuran)

    const absensiList = absensiResult.data
    const totalPertemuan = absensiList?.length || 0
    const hadirCount = absensiList?.filter(a => a.status_hadir === 'hadir').length || 0

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
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) return <div className="p-8 text-center text-dark/50 font-bold font-sans">Memuat Dashboard...</div>
  if (!siswa) return <div className="p-8 text-center text-dark font-bold font-sans">Akun Anda belum ditautkan ke data anak/siswa.</div>

  const iuranStatusText = iuran?.status_bayar === 'lunas' ? 'Lunas' : iuran?.status_bayar === 'menunggu_verifikasi' ? 'Menunggu Verifikasi' : 'Belum Bayar'
  const iuranColor = iuran?.status_bayar === 'lunas' ? 'primary' : iuran?.status_bayar === 'menunggu_verifikasi' ? 'secondary' : 'accent'

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🏠 Dashboard Orang Tua</h1>
        <p className="text-dark/60 font-sans mt-1">Pantau perkembangan dan administrasi anak Anda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kartu Anak */}
        <Card className="p-0 border-2 border-dark overflow-hidden flex flex-col h-full bg-dark">
          <div className="h-24 bg-primary relative border-b-2 border-dark">
            <div className="absolute -bottom-10 left-6 w-24 h-24 bg-white rounded-full border-4 border-dark shadow-brutal flex items-center justify-center text-4xl overflow-hidden">
              👤
            </div>
          </div>
          <div className="pt-14 px-6 pb-6 text-white">
            <h2 className="font-bold font-sans text-2xl">{siswa.nama}</h2>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/60 font-sans text-sm">Sabuk Saat Ini</span>
                <span className="font-bold font-sans">{siswa.sabuk_saat_ini}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/60 font-sans text-sm">Program Kelas</span>
                <span className="font-bold font-sans">{siswa.program_kelas?.nama_program || '-'}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-white/60 font-sans text-sm">Usia</span>
                <span className="font-bold font-sans">{new Date().getFullYear() - new Date(siswa.tgl_lahir).getFullYear()} Tahun</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Iuran Bulan Ini */}
          <Card className="border-2 border-dark">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold font-sans text-dark text-lg">Iuran Bulan Ini</h3>
              <div className="text-2xl">💰</div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-dark/70 font-sans text-sm">Status Tagihan:</span>
              <Badge color={iuranColor} className="text-sm px-3 py-1">{iuranStatusText}</Badge>
            </div>
            
            {iuran?.status_bayar !== 'lunas' && (
              <Link href="/ortu/iuran" className="block mt-4 text-center py-2 bg-secondary/20 hover:bg-secondary/40 text-dark font-bold font-sans rounded-lg border border-dark transition-colors">
                Lihat Detail Tagihan →
              </Link>
            )}
          </Card>

          {/* Kehadiran */}
          <Card className="border-2 border-dark flex flex-col justify-center">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold font-sans text-dark text-lg">Kehadiran Bulan Ini</h3>
              <div className="text-2xl">📅</div>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold font-sans text-dark">{Math.round(kehadiran.persen)}%</div>
              <div className="text-dark/60 font-sans text-sm pb-1">({kehadiran.hadir} dari {kehadiran.total} sesi)</div>
            </div>
            <div className="h-3 bg-background rounded-full border border-dark/20 mt-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${kehadiran.persen >= 75 ? 'bg-primary' : kehadiran.persen >= 50 ? 'bg-secondary' : 'bg-accent'}`}
                style={{ width: `${Math.min(kehadiran.persen, 100)}%` }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Agenda Mendatang */}
      <Card className="border-2 border-dark">
        <h3 className="font-bold font-sans text-dark text-lg mb-4">🗓️ Agenda Mendatang</h3>
        {agenda ? (
          <div className="p-4 border-2 border-dark rounded-xl bg-background flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-sm font-bold text-dark/50 uppercase tracking-wider">{agenda.jenis}</div>
              <div className="font-bold font-sans text-xl text-dark leading-tight mt-1">{agenda.nama}</div>
            </div>
            <div className="bg-white border-2 border-dark px-4 py-2 rounded-lg font-bold font-mono text-dark shadow-brutal-sm text-center min-w-[140px]">
              {new Date(agenda.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-dark/50 font-sans">
            Belum ada jadwal ujian atau event terdekat.
          </div>
        )}
      </Card>
    </div>
  )
}
