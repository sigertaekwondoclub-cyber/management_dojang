'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { AbsensiSiswa, AbsensiPelatih } from '@/lib/types'

type Tab = 'siswa' | 'pelatih'
type StatusHadir = 'hadir' | 'izin' | 'sakit' | 'alpha'

const STATUS_CONFIG: Record<StatusHadir, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark'; dot: string }> = {
  hadir:  { label: 'Hadir',  color: 'primary',   dot: 'bg-primary' },
  izin:   { label: 'Izin',   color: 'dark',      dot: 'bg-yellow-400' },
  sakit:  { label: 'Sakit',  color: 'secondary', dot: 'bg-secondary' },
  alpha:  { label: 'Alpha',  color: 'accent',    dot: 'bg-accent' },
}

const KELAS_OPTIONS = ['Semua', 'Umum', 'Pomsae', 'Kyurugi']

function getMonthYear() {
  const now = new Date()
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  }
}

// Hitung persentase kehadiran
function hitungPersentase(records: AbsensiSiswa[]): number {
  if (records.length === 0) return 0
  const hadir = records.filter(r => r.status_hadir === 'hadir').length
  return Math.round((hadir / records.length) * 100)
}

export default function AdminAbsensiPage() {
  const [activeTab, setActiveTab] = useState<Tab>('siswa')

  // --- Filter Absensi Siswa ---
  const [filterDari, setFilterDari] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [filterSampai, setFilterSampai] = useState(() => new Date().toISOString().split('T')[0])
  const [filterKelas, setFilterKelas] = useState('Semua')
  const [filterNamaSiswa, setFilterNamaSiswa] = useState('')

  const [absensiSiswa, setAbsensiSiswa] = useState<(AbsensiSiswa & { siswa: { nama: string }; pelatih: { nama: string } })[]>([])
  const [loadingSiswa, setLoadingSiswa] = useState(false)

  // --- Filter Absensi Pelatih ---
  const { month, year } = getMonthYear()
  const [filterBulan, setFilterBulan] = useState(month)
  const [filterTahun, setFilterTahun] = useState(year)
  const [absensiPelatih, setAbsensiPelatih] = useState<(AbsensiPelatih & { pelatih: { nama: string } })[]>([])
  const [loadingPelatih, setLoadingPelatih] = useState(false)

  // =====================
  // Fetch Absensi Siswa
  // =====================
  const fetchAbsensiSiswa = useCallback(async () => {
    setLoadingSiswa(true)

    let query = supabase
      .from('absensi_siswa')
      .select('*, siswa:siswa_id(nama), pelatih:pelatih_id_pengajar(nama)')
      .gte('tgl', filterDari)
      .lte('tgl', filterSampai)
      .order('tgl', { ascending: false })

    if (filterKelas !== 'Semua') {
      query = query.eq('kelas', filterKelas)
    }

    const { data, error } = await query

    if (!error && data) {
      let result = data as (AbsensiSiswa & { siswa: { nama: string }; pelatih: { nama: string } })[]
      if (filterNamaSiswa.trim()) {
        const q = filterNamaSiswa.toLowerCase()
        result = result.filter(r => r.siswa?.nama?.toLowerCase().includes(q))
      }
      setAbsensiSiswa(result)
    }
    setLoadingSiswa(false)
  }, [filterDari, filterSampai, filterKelas, filterNamaSiswa])

  // =====================
  // Fetch Absensi Pelatih
  // =====================
  const fetchAbsensiPelatih = useCallback(async () => {
    setLoadingPelatih(true)

    const bulanInt = parseInt(filterBulan)
    const tahunInt = parseInt(filterTahun)
    const startDate = `${tahunInt}-${String(bulanInt).padStart(2, '0')}-01`
    const endDate = new Date(tahunInt, bulanInt, 0).toLocaleDateString('sv-SE')

    const { data, error } = await supabase
      .from('absensi_pelatih')
      .select('*, pelatih:pelatih_id(nama)')
      .gte('tgl', startDate)
      .lte('tgl', endDate)
      .order('tgl', { ascending: false })

    if (!error && data) {
      setAbsensiPelatih(data as (AbsensiPelatih & { pelatih: { nama: string } })[])
    }
    setLoadingPelatih(false)
  }, [filterBulan, filterTahun])

  useEffect(() => {
    if (activeTab === 'siswa') fetchAbsensiSiswa()
    else fetchAbsensiPelatih()
  }, [activeTab, fetchAbsensiSiswa, fetchAbsensiPelatih])

  // =====================
  // Summary Stats Siswa
  // =====================
  const totalHadir = absensiSiswa.filter(r => r.status_hadir === 'hadir').length
  const totalIzin  = absensiSiswa.filter(r => r.status_hadir === 'izin').length
  const totalSakit = absensiSiswa.filter(r => r.status_hadir === 'sakit').length
  const totalAlpha = absensiSiswa.filter(r => r.status_hadir === 'alpha').length
  const pctHadir   = absensiSiswa.length > 0 ? Math.round((totalHadir / absensiSiswa.length) * 100) : 0

  // Rekap per siswa
  const rekapPerSiswa: Record<string, { nama: string; records: AbsensiSiswa[] }> = {}
  for (const r of absensiSiswa) {
    if (!rekapPerSiswa[r.siswa_id]) {
      rekapPerSiswa[r.siswa_id] = { nama: r.siswa?.nama || '-', records: [] }
    }
    rekapPerSiswa[r.siswa_id].records.push(r)
  }
  const rekapSiswaList = Object.entries(rekapPerSiswa).map(([id, val]) => ({
    id,
    nama: val.nama,
    total: val.records.length,
    hadir: val.records.filter(r => r.status_hadir === 'hadir').length,
    pct: hitungPersentase(val.records),
  })).sort((a, b) => b.total - a.total)

  // =====================
  // Summary Pelatih
  // =====================
  const rekapPerPelatih: Record<string, { nama: string; sesi: AbsensiPelatih[] }> = {}
  for (const r of absensiPelatih) {
    if (!rekapPerPelatih[r.pelatih_id]) {
      rekapPerPelatih[r.pelatih_id] = { nama: r.pelatih?.nama || '-', sesi: [] }
    }
    rekapPerPelatih[r.pelatih_id].sesi.push(r)
  }
  const rekapPelatihList = Object.entries(rekapPerPelatih).map(([id, val]) => ({
    id,
    nama: val.nama,
    jumlahSesi: val.sesi.length,
    detail: val.sesi,
  })).sort((a, b) => b.jumlahSesi - a.jumlahSesi)

  const namaBulan = (b: string) => {
    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return months[parseInt(b)] || b
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">Rekap Absensi</h1>
        <p className="text-dark/60 font-sans mt-1">Pantau kehadiran siswa dan sesi mengajar pelatih</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-dark pb-0">
        {(['siswa', 'pelatih'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-bold font-sans rounded-t-xl border-2 border-b-0 transition-all capitalize ${
              activeTab === tab
                ? 'bg-primary border-dark -mb-0.5 shadow-[4px_-4px_0px_#1E2A38]'
                : 'bg-white border-dark/30 text-dark/50 hover:text-dark hover:border-dark'
            }`}
          >
            {tab === 'siswa' ? '🧒 Absensi Siswa' : '🥋 Absensi Pelatih'}
          </button>
        ))}
      </div>

      {/* ===== TAB SISWA ===== */}
      {activeTab === 'siswa' && (
        <div className="flex flex-col gap-6">
          {/* Filter */}
          <Card>
            <h2 className="font-bold font-sans text-dark mb-4">Filter</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input label="Dari Tanggal" type="date" value={filterDari} onChange={e => setFilterDari(e.target.value)} />
              <Input label="Sampai Tanggal" type="date" value={filterSampai} onChange={e => setFilterSampai(e.target.value)} />
              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark">Kelas</label>
                <select
                  value={filterKelas}
                  onChange={e => setFilterKelas(e.target.value)}
                  className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans"
                >
                  {KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <Input
                label="Nama Siswa"
                type="text"
                placeholder="Cari nama..."
                value={filterNamaSiswa}
                onChange={e => setFilterNamaSiswa(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={fetchAbsensiSiswa} disabled={loadingSiswa} className="mt-4">
              {loadingSiswa ? 'Memuat...' : '🔍 Terapkan Filter'}
            </Button>
          </Card>

          {/* Summary Stats */}
          {absensiSiswa.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Total Catatan', val: absensiSiswa.length, cls: 'bg-white' },
                { label: '✅ Hadir', val: totalHadir, cls: 'bg-primary/20' },
                { label: '📝 Izin', val: totalIzin, cls: 'bg-yellow-100' },
                { label: '🤒 Sakit', val: totalSakit, cls: 'bg-secondary/20' },
                { label: '❌ Alpha', val: totalAlpha, cls: 'bg-accent/20' },
              ].map(stat => (
                <Card key={stat.label} className={`${stat.cls} p-4 text-center`}>
                  <div className="text-2xl font-bold font-sans text-dark">{stat.val}</div>
                  <div className="text-xs font-sans text-dark/60 mt-1">{stat.label}</div>
                </Card>
              ))}
            </div>
          )}

          {/* Persentase Bar */}
          {absensiSiswa.length > 0 && (
            <Card className="bg-dark text-white border-dark">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold font-sans">Persentase Kehadiran Keseluruhan</span>
                <span className="text-2xl font-bold font-sans">{pctHadir}%</span>
              </div>
              <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pctHadir}%` }}
                />
              </div>
            </Card>
          )}

          {/* Rekap Per Siswa */}
          {rekapSiswaList.length > 0 && (
            <Card>
              <h2 className="font-bold font-sans text-dark mb-4">Rekap Kehadiran Per Siswa</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b-2 border-dark">
                      <th className="text-left py-2 px-3 font-bold text-dark">Nama Siswa</th>
                      <th className="text-center py-2 px-3 font-bold text-dark">Total</th>
                      <th className="text-center py-2 px-3 font-bold text-dark">Hadir</th>
                      <th className="text-center py-2 px-3 font-bold text-dark">% Hadir</th>
                      <th className="text-left py-2 px-3 font-bold text-dark">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapSiswaList.map(s => (
                      <tr key={s.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                        <td className="py-3 px-3 font-bold text-dark">{s.nama}</td>
                        <td className="py-3 px-3 text-center text-dark/70">{s.total}</td>
                        <td className="py-3 px-3 text-center text-dark/70">{s.hadir}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-bold ${s.pct >= 80 ? 'text-green-600' : s.pct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {s.pct}%
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-2 bg-dark/10 rounded-full w-24 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.pct >= 80 ? 'bg-primary' : s.pct >= 60 ? 'bg-yellow-400' : 'bg-accent'}`}
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Tabel Detail */}
          <Card>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <h2 className="font-bold font-sans text-dark">
                Detail Absensi
                {absensiSiswa.length > 0 && (
                  <span className="ml-2 font-normal text-sm text-dark/50">({absensiSiswa.length} catatan)</span>
                )}
              </h2>
              {absensiSiswa.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const headers = ['Tanggal', 'Nama Siswa', 'Kelas', 'Status Hadir', 'Pelatih Pengajar'];
                    const rows = absensiSiswa.map(row => [
                      row.tgl,
                      row.siswa?.nama || '',
                      row.kelas,
                      row.status_hadir,
                      row.pelatih?.nama || ''
                    ]);
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `absensi_siswa_${filterDari}_to_${filterSampai}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  📤 Export CSV
                </Button>
              )}
            </div>
            {loadingSiswa ? (
              <div className="text-center py-12 text-dark/50 font-sans">Memuat data...</div>
            ) : absensiSiswa.length === 0 ? (
              <div className="text-center py-12 text-dark/50 font-sans">
                Tidak ada data absensi untuk filter yang dipilih.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b-2 border-dark">
                      <th className="text-left py-2 px-3 font-bold text-dark">Tanggal</th>
                      <th className="text-left py-2 px-3 font-bold text-dark">Siswa</th>
                      <th className="text-left py-2 px-3 font-bold text-dark">Kelas</th>
                      <th className="text-left py-2 px-3 font-bold text-dark">Status</th>
                      <th className="text-left py-2 px-3 font-bold text-dark">Pelatih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absensiSiswa.map(row => {
                      const cfg = STATUS_CONFIG[row.status_hadir as StatusHadir]
                      return (
                        <tr key={row.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                          <td className="py-3 px-3 text-dark/70">
                            {new Date(row.tgl + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-3 font-bold text-dark">{row.siswa?.nama || '-'}</td>
                          <td className="py-3 px-3 text-dark/70">{row.kelas}</td>
                          <td className="py-3 px-3">
                            <Badge color={cfg.color}>{cfg.label}</Badge>
                          </td>
                          <td className="py-3 px-3 text-dark/70">{row.pelatih?.nama || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===== TAB PELATIH ===== */}
      {activeTab === 'pelatih' && (
        <div className="flex flex-col gap-6">
          {/* Filter Bulan */}
          <Card>
            <h2 className="font-bold font-sans text-dark mb-4">Filter Periode</h2>
            <div className="flex gap-4 flex-wrap">
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
              <Input
                label="Tahun"
                type="number"
                value={filterTahun}
                onChange={e => setFilterTahun(e.target.value)}
                className="max-w-[120px]"
              />
              <div className="flex items-end">
                <Button variant="secondary" onClick={fetchAbsensiPelatih} disabled={loadingPelatih}>
                  {loadingPelatih ? 'Memuat...' : '🔍 Terapkan'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary Pelatih */}
          {rekapPelatihList.length > 0 && (
            <Card className="bg-dark text-white border-dark">
              <h2 className="font-bold font-sans mb-2">Ringkasan Sesi — {namaBulan(filterBulan)} {filterTahun}</h2>
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-3xl font-bold">{absensiPelatih.length}</div>
                  <div className="text-white/60 text-sm">Total Sesi Semua Pelatih</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{rekapPelatihList.length}</div>
                  <div className="text-white/60 text-sm">Pelatih Aktif</div>
                </div>
              </div>
              <p className="text-white/50 text-xs mt-3 font-sans">
                💡 Data sesi ini akan dipakai untuk menghitung honor pelatih di Fase 4.
              </p>
            </Card>
          )}

          {/* Rekap per Pelatih */}
          {loadingPelatih ? (
            <Card className="text-center py-12 text-dark/50 font-sans">Memuat data...</Card>
          ) : rekapPelatihList.length === 0 ? (
            <Card className="text-center py-12 text-dark/50 font-sans">
              Tidak ada data absensi pelatih untuk periode ini.
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {rekapPelatihList.map(p => (
                <Card key={p.id}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold font-sans text-dark text-lg">{p.nama}</h3>
                      <p className="text-sm text-dark/60 font-sans">{namaBulan(filterBulan)} {filterTahun}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold font-sans text-dark">{p.jumlahSesi}</div>
                      <div className="text-xs text-dark/50 font-sans">sesi mengajar</div>
                    </div>
                  </div>
                  {/* Detail sesi */}
                  <div className="border-t-2 border-dark/10 pt-4">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-bold text-dark/60 hover:text-dark font-sans list-none flex items-center gap-2">
                        <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                        Lihat detail sesi
                      </summary>
                      <div className="mt-3 flex flex-col gap-2">
                        {p.detail.map(sesi => (
                          <div key={sesi.id} className="flex items-center gap-3 text-sm font-sans bg-background rounded-xl px-3 py-2">
                            <span className="text-dark/50">
                              {new Date(sesi.tgl + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </span>
                            <span className="font-bold text-dark">{sesi.kelas}</span>
                            <span className="text-dark/50">
                              {sesi.jam_masuk.slice(0, 5)}
                              {sesi.jam_keluar ? ` – ${sesi.jam_keluar.slice(0, 5)}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
