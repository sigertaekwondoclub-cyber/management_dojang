'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import type { AbsensiSiswa } from '@/lib/types'

type StatusHadir = 'hadir' | 'izin' | 'sakit' | 'alpha'

interface StatusConfig {
  label: string
  bg: string
  text: string
  border: string
  icon: string
  ringkasan: string
}

const STATUS_CONFIG: Record<StatusHadir, StatusConfig> = {
  hadir:  { label: 'Hadir',  bg: 'bg-primary',    text: 'text-dark',  border: 'border-green-600',  icon: '✅', ringkasan: 'bg-primary/20 border-primary' },
  izin:   { label: 'Izin',   bg: 'bg-yellow-400', text: 'text-dark',  border: 'border-yellow-500', icon: '📝', ringkasan: 'bg-yellow-100 border-yellow-400' },
  sakit:  { label: 'Sakit',  bg: 'bg-secondary',  text: 'text-dark',  border: 'border-blue-400',   icon: '🤒', ringkasan: 'bg-secondary/20 border-secondary' },
  alpha:  { label: 'Alpha',  bg: 'bg-accent',      text: 'text-dark',  border: 'border-red-400',    icon: '❌', ringkasan: 'bg-accent/20 border-accent' },
}

function getMonthYear() {
  const now = new Date()
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  }
}

const namaBulan = (b: string) => {
  const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return months[parseInt(b)] || b
}

export default function OrtuAbsensiPage() {

  const { month, year } = getMonthYear()
  const [filterBulan, setFilterBulan] = useState(month)
  const [filterTahun, setFilterTahun] = useState(year)

  const [namaSiswa, setNamaSiswa] = useState<string>('')
  const [absensiList, setAbsensiList] = useState<AbsensiSiswa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAbsensi = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Ambil profile ortu untuk dapatkan siswa_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('siswa_id')
      .eq('id', user.id)
      .single()

    if (!profile?.siswa_id) {
      setError('Akun ini belum terhubung ke data siswa. Hubungi admin.')
      setLoading(false)
      return
    }

    // Ambil nama siswa
    const { data: siswaData } = await supabase
      .from('siswa')
      .select('nama')
      .eq('id', profile.siswa_id)
      .single()
    if (siswaData) setNamaSiswa(siswaData.nama)

    // Hitung range tanggal
    const bulanInt = parseInt(filterBulan)
    const tahunInt = parseInt(filterTahun)
    const startDate = `${tahunInt}-${String(bulanInt).padStart(2, '0')}-01`
    const endDate = new Date(tahunInt, bulanInt, 0).toISOString().split('T')[0]

    const { data, error: fetchErr } = await supabase
      .from('absensi_siswa')
      .select('*')
      .eq('siswa_id', profile.siswa_id)
      .gte('tgl', startDate)
      .lte('tgl', endDate)
      .order('tgl', { ascending: false })

    if (fetchErr) {
      setError('Gagal memuat data absensi.')
    } else {
      setAbsensiList((data || []) as AbsensiSiswa[])
    }
    setLoading(false)
  }, [filterBulan, filterTahun])

  useEffect(() => {
    fetchAbsensi()
  }, [fetchAbsensi])

  // Hitung statistik
  const totalPertemuan = absensiList.length
  const jumlahHadir = absensiList.filter(r => r.status_hadir === 'hadir').length
  const jumlahIzin  = absensiList.filter(r => r.status_hadir === 'izin').length
  const jumlahSakit = absensiList.filter(r => r.status_hadir === 'sakit').length
  const jumlahAlpha = absensiList.filter(r => r.status_hadir === 'alpha').length
  const pctHadir = totalPertemuan > 0 ? Math.round((jumlahHadir / totalPertemuan) * 100) : 0

  const pctColor = pctHadir >= 80 ? '#22C55E' : pctHadir >= 60 ? '#FBBF24' : '#F4A5A5'
  const pctBg = pctHadir >= 80 ? 'bg-primary/10 border-primary' : pctHadir >= 60 ? 'bg-yellow-50 border-yellow-400' : 'bg-accent/10 border-accent'
  const pctLabel = pctHadir >= 80 ? '😊 Bagus!' : pctHadir >= 60 ? '😐 Perlu ditingkatkan' : '⚠️ Sering absen'

  // Group by tanggal untuk tampilan timeline
  const groupedByDate: Record<string, AbsensiSiswa[]> = {}
  for (const r of absensiList) {
    if (!groupedByDate[r.tgl]) groupedByDate[r.tgl] = []
    groupedByDate[r.tgl].push(r)
  }
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  // Tahun options (current year ± 2)
  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1].map(String)

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">Absensi Anak</h1>
        {namaSiswa && (
          <p className="text-dark/60 font-sans mt-1">
            Riwayat kehadiran <span className="font-bold text-dark">{namaSiswa}</span>
          </p>
        )}
      </div>

      {/* Filter Bulan */}
      <Card className="flex gap-4 flex-wrap items-end">
        <div className="flex flex-col gap-2">
          <label className="font-bold text-dark">Bulan</label>
          <select
            value={filterBulan}
            onChange={e => setFilterBulan(e.target.value)}
            className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[140px]"
          >
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
              <option key={m} value={m}>{namaBulan(m)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-bold text-dark">Tahun</label>
          <select
            value={filterTahun}
            onChange={e => setFilterTahun(e.target.value)}
            className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[100px]"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </Card>

      {error && (
        <Card className="bg-accent/20 border-accent text-dark font-sans">
          ⚠️ {error}
        </Card>
      )}

      {loading ? (
        <Card className="text-center py-16 text-dark/50 font-sans">Memuat data absensi...</Card>
      ) : (
        <>
          {/* Ringkasan Persentase Besar */}
          <Card className={`${pctBg} border-2 relative overflow-hidden`}>
            <div className="flex items-center gap-6">
              {/* Donut/Circle visual */}
              <div className="relative shrink-0">
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#1E2A38" strokeWidth="2" opacity="0.1" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#1E2A38" strokeWidth="2" opacity="0.05"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset="0"
                  />
                  <circle
                    cx="48" cy="48" r="40"
                    fill="none"
                    stroke={pctColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - pctHadir / 100)}`}
                    transform="rotate(-90 48 48)"
                    className="transition-all duration-700"
                  />
                  <text x="48" y="48" textAnchor="middle" dominantBaseline="middle" className="font-bold" fontSize="20" fontWeight="bold" fill="#1E2A38">
                    {pctHadir}%
                  </text>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold font-sans text-dark">Kehadiran Bulan Ini</h2>
                <p className="text-dark/60 font-sans text-sm">{namaBulan(filterBulan)} {filterTahun}</p>
                <p className="font-bold text-dark mt-2">{pctLabel}</p>
                {totalPertemuan > 0 && (
                  <p className="text-sm text-dark/60 font-sans mt-1">
                    Hadir {jumlahHadir} dari {totalPertemuan} pertemuan
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Kartu Statistik Kecil */}
          {totalPertemuan > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { key: 'hadir' as StatusHadir, count: jumlahHadir },
                { key: 'izin'  as StatusHadir, count: jumlahIzin },
                { key: 'sakit' as StatusHadir, count: jumlahSakit },
                { key: 'alpha' as StatusHadir, count: jumlahAlpha },
              ]).map(({ key, count }) => {
                const cfg = STATUS_CONFIG[key]
                return (
                  <Card key={key} className={`${cfg.ringkasan} border-2 text-center p-4`}>
                    <div className="text-2xl mb-1">{cfg.icon}</div>
                    <div className="text-2xl font-bold font-sans text-dark">{count}</div>
                    <div className="text-xs text-dark/60 font-sans">{cfg.label}</div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Timeline Absensi */}
          {sortedDates.length === 0 ? (
            <Card className="text-center py-16 text-dark/50 font-sans">
              <div className="text-4xl mb-4">📅</div>
              <p>Belum ada catatan absensi untuk bulan ini.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <h2 className="text-lg font-bold font-sans text-dark">Riwayat Kehadiran</h2>
              <div className="relative flex flex-col gap-4">
                {/* Timeline line */}
                <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-dark/10 z-0" />

                {sortedDates.map(tgl => {
                  const entries = groupedByDate[tgl]
                  const dateObj = new Date(tgl + 'T00:00:00')
                  const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' })
                  const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

                  return (
                    <div key={tgl} className="relative flex gap-4 z-10">
                      {/* Timeline dot */}
                      <div className={`w-9 h-9 rounded-full border-2 border-dark shrink-0 flex items-center justify-center text-sm ${
                        entries.every(e => e.status_hadir === 'hadir') ? 'bg-primary' :
                        entries.some(e => e.status_hadir === 'alpha') ? 'bg-accent' :
                        'bg-yellow-400'
                      }`}>
                        {entries.every(e => e.status_hadir === 'hadir') ? '✓' :
                         entries.some(e => e.status_hadir === 'alpha') ? '✗' : '~'}
                      </div>

                      <div className="flex-1 flex flex-col gap-2">
                        <div>
                          <span className="font-bold font-sans text-dark">{dayName}</span>
                          <span className="text-sm text-dark/50 font-sans ml-2">{dateStr}</span>
                        </div>
                        {entries.map(entry => {
                          const cfg = STATUS_CONFIG[entry.status_hadir as StatusHadir]
                          return (
                            <div
                              key={entry.id}
                              className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-dark shadow-brutal ${cfg.bg}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{cfg.icon}</span>
                                <div>
                                  <span className="font-bold font-sans text-dark">{entry.kelas}</span>
                                  <span className="text-sm text-dark/60 font-sans ml-2">Kelas {entry.kelas}</span>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full border-2 border-dark font-bold text-sm font-sans ${cfg.bg} ${cfg.text}`}>
                                {cfg.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
