'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { AbsensiSiswa, AbsensiPelatih } from '@/lib/types'

type Tab = 'siswa' | 'pelatih'
type StatusHadir = 'hadir' | 'izin' | 'sakit' | 'alpha'

const STATUS_CONFIG: Record<StatusHadir, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark'; dot: string; bg: string }> = {
  hadir:  { label: 'Hadir',  color: 'primary',   dot: 'bg-primary',    bg: 'bg-primary' },
  izin:   { label: 'Izin',   color: 'dark',       dot: 'bg-yellow-400', bg: 'bg-yellow-400' },
  sakit:  { label: 'Sakit',  color: 'secondary',  dot: 'bg-secondary',  bg: 'bg-secondary' },
  alpha:  { label: 'Alpha',  color: 'accent',     dot: 'bg-accent',     bg: 'bg-accent' },
}

const KELAS_OPTIONS_FILTER = ['Semua', 'Umum', 'Pomsae', 'Kyurugi']
const KELAS_OPTIONS = ['Umum', 'Pomsae', 'Kyurugi']

function getMonthYear() {
  const now = new Date()
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  }
}

function hitungPersentase(records: AbsensiSiswa[]): number {
  if (records.length === 0) return 0
  const hadir = records.filter(r => r.status_hadir === 'hadir').length
  return Math.round((hadir / records.length) * 100)
}

// ── Modal Tambah Record ──────────────────────────────────
interface TambahModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

function TambahAbsensiModal({ isOpen, onClose, onSaved }: TambahModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const [tgl, setTgl] = useState(today)
  const [kelas, setKelas] = useState('Umum')
  const [siswaList, setSiswaList] = useState<{ id: string; nama: string }[]>([])
  const [pelatihList, setPelatihList] = useState<{ id: string; nama: string }[]>([])
  const [selectedSiswa, setSelectedSiswa] = useState('')
  const [selectedPelatih, setSelectedPelatih] = useState('')
  const [status, setStatus] = useState<StatusHadir>('hadir')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    // Load siswa & pelatih
    supabase.from('siswa').select('id, nama').eq('status_aktif', true).order('nama').then(({ data }) => {
      setSiswaList(data || [])
      if (data && data.length > 0 && !selectedSiswa) setSelectedSiswa(data[0].id)
    })
    supabase.from('pelatih').select('id, nama').eq('status_aktif', true).order('nama').then(({ data }) => {
      setPelatihList(data || [])
      if (data && data.length > 0 && !selectedPelatih) setSelectedPelatih(data[0].id)
    })
  }, [isOpen])

  const handleSimpan = async () => {
    if (!selectedSiswa || !selectedPelatih) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('absensi_siswa')
      .upsert(
        { tgl, siswa_id: selectedSiswa, kelas, status_hadir: status, pelatih_id_pengajar: selectedPelatih },
        { onConflict: 'tgl,siswa_id,kelas' }
      )

    if (err) {
      setError(err.message)
    } else {
      onSaved()
      onClose()
    }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-dark/50" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-white border-[3px] border-dark shadow-[8px_8px_0px_#1E2A38] w-full max-w-md flex flex-col gap-5 p-6 rounded-none z-10">
        <div className="flex items-center justify-between">
          <h3 className="font-pixel text-base text-dark">➕ Tambah Catatan Absensi</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 border-[2px] border-dark flex items-center justify-center font-pixel text-sm hover:bg-background transition-colors"
          >✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <Input label="Tanggal" type="date" value={tgl} onChange={e => setTgl(e.target.value)} />

          {/* Siswa */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Siswa</label>
            <select
              value={selectedSiswa}
              onChange={e => setSelectedSiswa(e.target.value)}
              className="border-2 border-dark px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans text-sm"
            >
              {siswaList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>

          {/* Kelas */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Kelas</label>
            <select
              value={kelas}
              onChange={e => setKelas(e.target.value)}
              className="border-2 border-dark px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans text-sm"
            >
              {KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Status Hadir</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STATUS_CONFIG) as StatusHadir[]).map(s => {
                const cfg = STATUS_CONFIG[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`px-4 py-2 border-2 font-bold text-sm font-sans transition-all ${
                      status === s
                        ? `${cfg.bg} border-dark shadow-[3px_3px_0px_#1E2A38]`
                        : 'bg-white border-dark/30 text-dark/50 hover:border-dark hover:text-dark'
                    }`}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pelatih */}
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Pelatih Pengajar</label>
            <select
              value={selectedPelatih}
              onChange={e => setSelectedPelatih(e.target.value)}
              className="border-2 border-dark px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans text-sm"
            >
              {pelatihList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="bg-accent/20 border-2 border-accent p-3 text-sm font-sans text-dark">⚠️ {error}</div>}

        <div className="flex gap-3 pt-2">
          <Button variant="primary" onClick={handleSimpan} disabled={saving} className="flex-1">
            {saving ? '⏳ Menyimpan...' : '💾 Simpan'}
          </Button>
          <Button variant="accent" onClick={onClose} className="flex-1">Batal</Button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Edit Status ────────────────────────────────────
interface EditModalProps {
  row: (AbsensiSiswa & { siswa: { nama: string }; pelatih: { nama: string } }) | null
  onClose: () => void
  onSaved: () => void
}

function EditAbsensiModal({ row, onClose, onSaved }: EditModalProps) {
  const [status, setStatus] = useState<StatusHadir>((row?.status_hadir as StatusHadir) || 'hadir')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (row) setStatus(row.status_hadir as StatusHadir)
  }, [row])

  if (!row) return null

  const handleSimpan = async () => {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('absensi_siswa')
      .update({ status_hadir: status })
      .eq('id', row.id)

    if (err) setError(err.message)
    else { onSaved(); onClose() }
    setSaving(false)
  }

  const tglFormatted = new Date(row.tgl + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-dark/50" onClick={onClose} />
      <div className="relative bg-white border-[3px] border-dark shadow-[8px_8px_0px_#1E2A38] w-full max-w-sm flex flex-col gap-5 p-6 z-10">
        <div className="flex items-center justify-between">
          <h3 className="font-pixel text-base text-dark">✏️ Edit Status Absensi</h3>
          <button onClick={onClose} className="w-8 h-8 border-[2px] border-dark flex items-center justify-center font-pixel text-sm hover:bg-background transition-colors">✕</button>
        </div>

        <div className="bg-background border-2 border-dark/20 p-3 flex flex-col gap-1 text-sm font-sans">
          <div className="font-bold text-dark">{row.siswa?.nama || '-'}</div>
          <div className="text-dark/60">{tglFormatted} · Kelas {row.kelas}</div>
          <div className="text-dark/50">Pelatih: {row.pelatih?.nama || '-'}</div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-dark text-sm">Status Hadir</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(STATUS_CONFIG) as StatusHadir[]).map(s => {
              const cfg = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 border-2 font-bold text-sm font-sans transition-all ${
                    status === s
                      ? `${cfg.bg} border-dark shadow-[3px_3px_0px_#1E2A38] scale-105`
                      : 'bg-white border-dark/30 text-dark/50 hover:border-dark hover:text-dark'
                  }`}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && <div className="bg-accent/20 border-2 border-accent p-3 text-sm font-sans text-dark">⚠️ {error}</div>}

        <div className="flex gap-3 pt-2">
          <Button variant="primary" onClick={handleSimpan} disabled={saving} className="flex-1">
            {saving ? '⏳ Menyimpan...' : '💾 Simpan'}
          </Button>
          <Button variant="accent" onClick={onClose} className="flex-1">Batal</Button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Konfirmasi Hapus ───────────────────────────────
interface HapusModalProps {
  row: (AbsensiSiswa & { siswa: { nama: string }; pelatih: { nama: string } }) | null
  onClose: () => void
  onDeleted: () => void
}

function HapusAbsensiModal({ row, onClose, onDeleted }: HapusModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!row) return null

  const handleHapus = async () => {
    setDeleting(true)
    setError(null)
    const { error: err } = await supabase.from('absensi_siswa').delete().eq('id', row.id)
    if (err) setError(err.message)
    else { onDeleted(); onClose() }
    setDeleting(false)
  }

  const tglFormatted = new Date(row.tgl + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-dark/50" onClick={onClose} />
      <div className="relative bg-white border-[3px] border-dark shadow-[8px_8px_0px_#1E2A38] w-full max-w-sm flex flex-col gap-5 p-6 z-10">
        <h3 className="font-pixel text-base text-dark">🗑️ Hapus Catatan Absensi</h3>

        <div className="bg-accent/10 border-2 border-accent p-4 font-sans text-sm text-dark">
          <p className="font-bold mb-1">Yakin hapus catatan ini?</p>
          <p><strong>{row.siswa?.nama || '-'}</strong></p>
          <p className="text-dark/60">{tglFormatted} · Kelas {row.kelas} · <Badge color={STATUS_CONFIG[row.status_hadir as StatusHadir]?.color}>{STATUS_CONFIG[row.status_hadir as StatusHadir]?.label}</Badge></p>
          <p className="text-dark/50 mt-2 text-xs">Tindakan ini tidak bisa dibatalkan.</p>
        </div>

        {error && <div className="bg-accent/20 border-2 border-accent p-3 text-sm font-sans text-dark">⚠️ {error}</div>}

        <div className="flex gap-3">
          <Button variant="accent" onClick={handleHapus} disabled={deleting} className="flex-1">
            {deleting ? '⏳ Menghapus...' : '🗑️ Ya, Hapus'}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">Batal</Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────
export default function AdminAbsensiPage() {
  const [activeTab, setActiveTab] = useState<Tab>('siswa')

  // Filter Siswa
  const [filterDari, setFilterDari] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [filterSampai, setFilterSampai] = useState(() => new Date().toISOString().split('T')[0])
  const [filterKelas, setFilterKelas] = useState('Semua')
  const [filterNamaSiswa, setFilterNamaSiswa] = useState('')

  const [absensiSiswa, setAbsensiSiswa] = useState<(AbsensiSiswa & { siswa: { nama: string }; pelatih: { nama: string } })[]>([])
  const [loadingSiswa, setLoadingSiswa] = useState(false)

  // Filter Pelatih
  const { month, year } = getMonthYear()
  const [filterBulan, setFilterBulan] = useState(month)
  const [filterTahun, setFilterTahun] = useState(year)
  const [absensiPelatih, setAbsensiPelatih] = useState<(AbsensiPelatih & { pelatih: { nama: string } })[]>([])
  const [loadingPelatih, setLoadingPelatih] = useState(false)

  // CRUD Modals
  const [showTambah, setShowTambah] = useState(false)
  const [editRow, setEditRow] = useState<(AbsensiSiswa & { siswa: { nama: string }; pelatih: { nama: string } }) | null>(null)
  const [hapusRow, setHapusRow] = useState<(AbsensiSiswa & { siswa: { nama: string }; pelatih: { nama: string } }) | null>(null)

  // Fetch Siswa
  const fetchAbsensiSiswa = useCallback(async () => {
    setLoadingSiswa(true)
    let query = supabase
      .from('absensi_siswa')
      .select('*, siswa:siswa_id(nama), pelatih:pelatih_id_pengajar(nama)')
      .gte('tgl', filterDari)
      .lte('tgl', filterSampai)
      .order('tgl', { ascending: false })

    if (filterKelas !== 'Semua') query = query.eq('kelas', filterKelas)

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

  // Fetch Pelatih
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

    if (!error && data) setAbsensiPelatih(data as (AbsensiPelatih & { pelatih: { nama: string } })[])
    setLoadingPelatih(false)
  }, [filterBulan, filterTahun])

  useEffect(() => {
    if (activeTab === 'siswa') fetchAbsensiSiswa()
    else fetchAbsensiPelatih()
  }, [activeTab, fetchAbsensiSiswa, fetchAbsensiPelatih])

  // Summary Stats
  const totalHadir = absensiSiswa.filter(r => r.status_hadir === 'hadir').length
  const totalIzin  = absensiSiswa.filter(r => r.status_hadir === 'izin').length
  const totalSakit = absensiSiswa.filter(r => r.status_hadir === 'sakit').length
  const totalAlpha = absensiSiswa.filter(r => r.status_hadir === 'alpha').length
  const pctHadir   = absensiSiswa.length > 0 ? Math.round((totalHadir / absensiSiswa.length) * 100) : 0

  const rekapPerSiswa: Record<string, { nama: string; records: AbsensiSiswa[] }> = {}
  for (const r of absensiSiswa) {
    if (!rekapPerSiswa[r.siswa_id]) rekapPerSiswa[r.siswa_id] = { nama: r.siswa?.nama || '-', records: [] }
    rekapPerSiswa[r.siswa_id].records.push(r)
  }
  const rekapSiswaList = Object.entries(rekapPerSiswa).map(([id, val]) => ({
    id, nama: val.nama, total: val.records.length,
    hadir: val.records.filter(r => r.status_hadir === 'hadir').length,
    pct: hitungPersentase(val.records),
  })).sort((a, b) => b.total - a.total)

  const rekapPerPelatih: Record<string, { nama: string; sesi: AbsensiPelatih[] }> = {}
  for (const r of absensiPelatih) {
    if (!rekapPerPelatih[r.pelatih_id]) rekapPerPelatih[r.pelatih_id] = { nama: r.pelatih?.nama || '-', sesi: [] }
    rekapPerPelatih[r.pelatih_id].sesi.push(r)
  }
  const rekapPelatihList = Object.entries(rekapPerPelatih).map(([id, val]) => ({
    id, nama: val.nama, jumlahSesi: val.sesi.length, detail: val.sesi,
  })).sort((a, b) => b.jumlahSesi - a.jumlahSesi)

  const namaBulan = (b: string) => {
    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return months[parseInt(b)] || b
  }

  const exportCSV = () => {
    const headers = ['Tanggal', 'Nama Siswa', 'Kelas', 'Status Hadir', 'Pelatih Pengajar']
    const rows = absensiSiswa.map(row => [row.tgl, row.siswa?.nama || '', row.kelas, row.status_hadir, row.pelatih?.nama || ''])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `absensi_siswa_${filterDari}_to_${filterSampai}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      {/* CRUD Modals */}
      <TambahAbsensiModal
        isOpen={showTambah}
        onClose={() => setShowTambah(false)}
        onSaved={fetchAbsensiSiswa}
      />
      <EditAbsensiModal
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={fetchAbsensiSiswa}
      />
      <HapusAbsensiModal
        row={hapusRow}
        onClose={() => setHapusRow(null)}
        onDeleted={fetchAbsensiSiswa}
      />

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
                    {KELAS_OPTIONS_FILTER.map(k => <option key={k} value={k}>{k}</option>)}
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
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctHadir}%` }} />
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

            {/* Tabel Detail Absensi + CRUD */}
            <Card>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <h2 className="font-bold font-sans text-dark">
                  Detail Absensi
                  {absensiSiswa.length > 0 && (
                    <span className="ml-2 font-normal text-sm text-dark/50">({absensiSiswa.length} catatan)</span>
                  )}
                </h2>
                <div className="flex gap-2 flex-wrap">
                  {/* Tombol Tambah */}
                  <Button variant="primary" onClick={() => setShowTambah(true)} className="text-sm px-4 py-2">
                    ➕ Tambah
                  </Button>
                  {/* Tombol Export CSV */}
                  {absensiSiswa.length > 0 && (
                    <Button variant="secondary" onClick={exportCSV} className="text-sm px-4 py-2">
                      📤 Export CSV
                    </Button>
                  )}
                </div>
              </div>

              {loadingSiswa ? (
                <div className="text-center py-12 text-dark/50 font-sans">Memuat data...</div>
              ) : absensiSiswa.length === 0 ? (
                <div className="text-center py-12 text-dark/50 font-sans flex flex-col items-center gap-3">
                  <span className="text-4xl">📋</span>
                  <p>Tidak ada data absensi untuk filter yang dipilih.</p>
                  <Button variant="primary" onClick={() => setShowTambah(true)}>➕ Tambah Catatan Pertama</Button>
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
                        <th className="text-center py-2 px-3 font-bold text-dark">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absensiSiswa.map(row => {
                        const cfg = STATUS_CONFIG[row.status_hadir as StatusHadir]
                        return (
                          <tr key={row.id} className="border-b border-dark/10 hover:bg-background transition-colors group">
                            <td className="py-3 px-3 text-dark/70 whitespace-nowrap">
                              {new Date(row.tgl + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-3 font-bold text-dark">{row.siswa?.nama || '-'}</td>
                            <td className="py-3 px-3 text-dark/70">{row.kelas}</td>
                            <td className="py-3 px-3">
                              <Badge color={cfg.color}>{cfg.label}</Badge>
                            </td>
                            <td className="py-3 px-3 text-dark/70">{row.pelatih?.nama || '-'}</td>
                            <td className="py-3 px-3">
                              <div className="flex gap-1.5 justify-center">
                                {/* Edit */}
                                <button
                                  onClick={() => setEditRow(row)}
                                  title="Edit status"
                                  className="w-8 h-8 border-[2px] border-dark bg-white hover:bg-secondary flex items-center justify-center text-sm transition-all hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_#1E2A38] active:translate-y-0 active:shadow-none"
                                >
                                  ✏️
                                </button>
                                {/* Hapus */}
                                <button
                                  onClick={() => setHapusRow(row)}
                                  title="Hapus catatan"
                                  className="w-8 h-8 border-[2px] border-dark bg-white hover:bg-accent flex items-center justify-center text-sm transition-all hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_#1E2A38] active:translate-y-0 active:shadow-none"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
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
    </>
  )
}
