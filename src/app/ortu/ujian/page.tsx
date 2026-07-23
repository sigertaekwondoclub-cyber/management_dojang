'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import type { UjianSabuk, Siswa } from '@/lib/types'

const SABUK_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  'Putih': { bg: '#FFFFFF', text: '#1E2A38', accent: '#E5E7EB' },
  'Kuning': { bg: '#FDE68A', text: '#1E2A38', accent: '#FBBF24' },
  'Hijau': { bg: '#BBF7D0', text: '#1E2A38', accent: '#22C55E' },
  'Biru': { bg: '#BFDBFE', text: '#1E2A38', accent: '#3B82F6' },
  'Merah': { bg: '#FECACA', text: '#1E2A38', accent: '#EF4444' },
  'Hitam': { bg: '#1E2A38', text: '#FFFFFF', accent: '#4B5563' },
}

export default function OrtuUjianPage() {
  const [riwayat, setRiwayat] = useState<UjianSabuk[]>([])
  const [siswaInfo, setSiswaInfo] = useState<Siswa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchRiwayat = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('siswa_id')
      .eq('id', user.id)
      .single()

    if (!profile?.siswa_id) {
      setError('Akun belum terhubung ke data siswa. Hubungi admin.')
      setLoading(false)
      return
    }

    // Get Siswa Info
    const { data: sData } = await supabase
      .from('siswa')
      .select('*')
      .eq('id', profile.siswa_id)
      .single()
    if (sData) setSiswaInfo(sData as Siswa)

    // Get Ujian Lulus (Riwayat Sabuk)
    const { data: uData } = await supabase
      .from('ujian_sabuk')
      .select('*')
      .eq('siswa_id', profile.siswa_id)
      .eq('hasil', 'lulus')
      .order('tgl_ujian', { ascending: false })

    if (uData) setRiwayat(uData as UjianSabuk[])

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchRiwayat()
  }, [fetchRiwayat])

  if (loading) {
    return <div className="max-w-2xl mx-auto py-12 text-center text-dark/50 font-bold font-sans">Memuat riwayat sabuk...</div>
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <h1 className="text-3xl font-bold font-sans text-dark">🏅 Riwayat Sabuk</h1>
        <Card className="bg-accent/10 border-accent text-center py-16">
          <p className="font-bold text-dark font-sans">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🏅 Riwayat Sabuk</h1>
        {siswaInfo && (
          <p className="text-dark/60 font-sans mt-1">
            Perjalanan sabuk Taekwondo untuk <span className="font-bold text-dark">{siswaInfo.nama}</span>
          </p>
        )}
      </div>

      <Card className="bg-dark text-white border-dark">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-sans text-white/70">Sabuk Saat Ini</h2>
            <div className="text-2xl font-bold font-sans mt-1">{siswaInfo?.sabuk_saat_ini || 'Putih'}</div>
          </div>
          <div className="text-6xl drop-shadow-lg">🥋</div>
        </div>
      </Card>

      <div className="relative pl-6 sm:pl-8 ml-4 mt-4">
        {/* Garis Vertikal */}
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-dark/20 rounded-full" />

        {riwayat.length === 0 ? (
          <div className="py-8 text-dark/50 font-sans text-center">
            Belum ada riwayat kenaikan sabuk. Terus berlatih!
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {riwayat.map((ujian, i) => {
              const sabukColors = SABUK_COLORS[ujian.sabuk_tujuan] || SABUK_COLORS['Putih']
              const isLatest = i === 0
              
              return (
                <div key={ujian.id} className="relative">
                  {/* Dot di garis vertikal */}
                  <div className={`absolute -left-[30px] sm:-left-[38px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-white shadow-brutal z-10 flex items-center justify-center ${isLatest ? 'bg-primary' : 'bg-dark/40'}`}>
                    {isLatest && <div className="w-2 h-2 bg-dark rounded-full animate-pulse" />}
                  </div>

                  <Card className="relative p-0 overflow-hidden border-2 border-dark transition-transform hover:-translate-y-1 hover:shadow-brutal-lg">
                    <div className="flex flex-col sm:flex-row">
                      {/* Badge Warna Sabuk (Sebelah Kiri) */}
                      <div 
                        className="p-6 sm:w-1/3 flex flex-col items-center justify-center gap-2 border-b-2 sm:border-b-0 sm:border-r-2 border-dark"
                        style={{ backgroundColor: sabukColors.bg }}
                      >
                        <span className="text-3xl drop-shadow-md">🏅</span>
                        <span 
                          className="font-bold font-sans text-lg tracking-wide px-3 py-1 bg-white/50 rounded-xl border border-dark/20 backdrop-blur-sm"
                          style={{ color: sabukColors.text }}
                        >
                          {ujian.sabuk_tujuan}
                        </span>
                      </div>

                      {/* Info Detail Ujian (Sebelah Kanan) */}
                      <div className="p-6 flex-1 flex flex-col justify-center bg-white">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold font-sans text-dark text-lg">Ujian Kenaikan Tingkat</h3>
                          <span className="text-xs font-bold font-mono bg-background px-2 py-1 rounded-md border border-dark/20 text-dark/60">
                            {new Date(ujian.tgl_ujian).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-1 mt-2 text-sm font-sans">
                          <div className="flex justify-between border-b border-dark/10 pb-1">
                            <span className="text-dark/50">Penguji</span>
                            <span className="font-bold text-dark">{ujian.penguji}</span>
                          </div>
                          <div className="flex justify-between border-b border-dark/10 pb-1 mt-1">
                            <span className="text-dark/50">Sabuk Asal</span>
                            <span className="font-bold text-dark">{ujian.sabuk_asal}</span>
                          </div>
                          {ujian.catatan && (
                            <div className="mt-2 text-dark/70 italic bg-background p-2 rounded-lg border border-dark/10">
                              "{ujian.catatan}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
