'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import type { Siswa, Profile } from '@/lib/types'

type StatusHadir = 'hadir' | 'izin' | 'sakit' | 'alpha'
type Mode = 'manual' | 'scan'

interface AbsensiEntry {
  siswa_id: string
  nama: string
  status: StatusHadir
}

interface ScanResult {
  siswa_id: string
  nama: string
  no_kartu: string
  scanned_at: Date
}

const KELAS_OPTIONS = ['Umum', 'Pomsae', 'Kyurugi']

function filterSiswaByKelas(siswaData: any[], kelas: string): any[] {
  if (kelas === 'Umum') return siswaData
  if (kelas === 'Pomsae') return siswaData.filter((s: any) => s.fokus_prestasi === 'pomsae')
  if (kelas === 'Kyurugi') return siswaData.filter((s: any) => s.fokus_prestasi === 'kyurugi')
  return siswaData
}

const STATUS_CONFIG: Record<StatusHadir, { label: string; bg: string; border: string; text: string }> = {
  hadir:  { label: 'Hadir',  bg: 'bg-primary',   border: 'border-primary',   text: 'text-dark' },
  izin:   { label: 'Izin',   bg: 'bg-yellow-400', border: 'border-yellow-500', text: 'text-dark' },
  sakit:  { label: 'Sakit',  bg: 'bg-secondary',  border: 'border-secondary',  text: 'text-dark' },
  alpha:  { label: 'Alpha',  bg: 'bg-accent',      border: 'border-accent',     text: 'text-dark' },
}

export default function PelatihAbsensiPage() {

  const [profile, setProfile] = useState<Profile | null>(null)
  const [pelatihId, setPelatihId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const [tanggal, setTanggal] = useState(today)
  const [kelas, setKelas] = useState('Umum')
  const [mode, setMode] = useState<Mode>('manual')

  // ── MODE MANUAL ──────────────────────────────────────────
  const [siswaList, setSiswaList] = useState<AbsensiEntry[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [loadingSiswa, setLoadingSiswa] = useState(false)

  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── MODE SCAN ────────────────────────────────────────────
  const [scanActive, setScanActive] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error' | 'dup'; msg: string } | null>(null)
  const [scanSaving, setScanSaving] = useState(false)
  const [scanSavedOk, setScanSavedOk] = useState(false)
  const scanFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce scan: hindari duplikat scan dalam 2 detik
  const lastScannedCode = useRef<string>('')
  const lastScannedTime = useRef<number>(0)

  // Fetch profile pelatih
  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) {
      setProfile(data as Profile)
      setPelatihId(data.pelatih_id)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // Saat ganti mode, reset state mode sebelumnya
  const handleModeSwitch = (newMode: Mode) => {
    setScanActive(false)
    setListLoaded(false)
    setSavedOk(false)
    setScanSavedOk(false)
    setError(null)
    setScanFeedback(null)
    setMode(newMode)
  }

  // ── MODE MANUAL: Load daftar siswa ──────────────────────
  const handleMuatSiswa = useCallback(async () => {
    if (!pelatihId) return
    setLoadingSiswa(true)
    setError(null)
    setSavedOk(false)

    const { data: siswaData, error: siswaErr } = await supabase
      .from('siswa')
      .select('id, nama, program_kelas_id, fokus_prestasi, program_kelas:program_kelas_id(nama_program)')
      .eq('status_aktif', true)
      .order('nama', { ascending: true })

    if (siswaErr) {
      setError('Gagal memuat data siswa.')
      setLoadingSiswa(false)
      return
    }

    const filtered = filterSiswaByKelas(siswaData || [], kelas)

    const { data: existingAbsensi } = await supabase
      .from('absensi_siswa')
      .select('siswa_id, status_hadir')
      .eq('tgl', tanggal)
      .eq('kelas', kelas)

    const existingMap: Record<string, StatusHadir> = {}
    if (existingAbsensi) {
      for (const a of existingAbsensi) {
        existingMap[a.siswa_id] = a.status_hadir as StatusHadir
      }
    }

    const entries: AbsensiEntry[] = filtered.map((s: any) => ({
      siswa_id: s.id,
      nama: s.nama,
      status: existingMap[s.id] || 'hadir',
    }))

    setSiswaList(entries)
    setListLoaded(true)
    setLoadingSiswa(false)
  }, [kelas, tanggal, pelatihId])

  const handleStatusChange = (siswaId: string, newStatus: StatusHadir) => {
    setSiswaList(prev =>
      prev.map(e => e.siswa_id === siswaId ? { ...e, status: newStatus } : e)
    )
  }

  const handleSimpan = async () => {
    if (!pelatihId || siswaList.length === 0) return
    setSaving(true)
    setError(null)
    setSavedOk(false)

    const { data: programKelasList } = await supabase.from('program_kelas').select('id, nama_program')
    let matchedClassId = null
    if (programKelasList) {
      const targetName = kelas === 'Umum' ? 'Umum' : 'Prestasi'
      const found = programKelasList.find(p => p.nama_program.toLowerCase().includes(targetName.toLowerCase()))
      if (found) matchedClassId = found.id
    }

    const absensiRows = siswaList.map(e => ({
      tgl: tanggal,
      siswa_id: e.siswa_id,
      kelas,
      status_hadir: e.status,
      pelatih_id_pengajar: pelatihId,
    }))

    const { error: upsertErr } = await supabase
      .from('absensi_siswa')
      .upsert(absensiRows, { onConflict: 'tgl,siswa_id,kelas' })

    if (upsertErr) {
      setError('Gagal menyimpan absensi siswa: ' + upsertErr.message)
      setSaving(false)
      return
    }

    const now = new Date()
    const jamMasuk = now.toTimeString().split(' ')[0]

    const { error: pelatihErr } = await supabase
      .from('absensi_pelatih')
      .upsert(
        { tgl: tanggal, pelatih_id: pelatihId, kelas, jam_masuk: jamMasuk, program_kelas_id: matchedClassId },
        { onConflict: 'tgl,pelatih_id,kelas' }
      )

    if (pelatihErr) {
      setError('Absensi siswa tersimpan, tapi gagal catat absensi pelatih: ' + pelatihErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSavedOk(true)
  }

  // ── MODE SCAN: Handling ──────────────────────────────────
  const showScanFeedback = (type: 'success' | 'error' | 'dup', msg: string) => {
    if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current)
    setScanFeedback({ type, msg })
    scanFeedbackTimer.current = setTimeout(() => setScanFeedback(null), 3000)
  }

  const handleScanResult = useCallback(async (decodedText: string) => {
    const now = Date.now()
    // Debounce: abaikan scan sama dalam 2 detik
    if (decodedText === lastScannedCode.current && now - lastScannedTime.current < 2000) return
    lastScannedCode.current = decodedText
    lastScannedTime.current = now

    if (!pelatihId) return

    // Cek duplikat di sesi ini
    const alreadyScanned = scanResults.some(r => r.no_kartu === decodedText)
    if (alreadyScanned) {
      showScanFeedback('dup', `⚠️ Kartu ${decodedText} sudah di-scan`)
      return
    }

    // Lookup kartu → siswa
    const { data: kartu, error: kartuErr } = await supabase
      .from('kartu_anggota')
      .select('siswa_id, no_kartu, siswa:siswa_id(nama)')
      .eq('qr_code_value', decodedText)
      .eq('status_aktif', true)
      .single()

    if (kartuErr || !kartu) {
      showScanFeedback('error', `❌ Kartu tidak ditemukan: ${decodedText}`)
      return
    }

    const siswaId = kartu.siswa_id
    const namaSiswa = (kartu as any).siswa?.nama || 'Unknown'

    // Upsert absensi hadir langsung
    const { error: absErr } = await supabase
      .from('absensi_siswa')
      .upsert(
        { tgl: tanggal, siswa_id: siswaId, kelas, status_hadir: 'hadir', pelatih_id_pengajar: pelatihId },
        { onConflict: 'tgl,siswa_id,kelas' }
      )

    if (absErr) {
      showScanFeedback('error', `❌ Gagal simpan absensi: ${absErr.message}`)
      return
    }

    // Tambah ke daftar hasil scan
    setScanResults(prev => [
      { siswa_id: siswaId, nama: namaSiswa, no_kartu: decodedText, scanned_at: new Date() },
      ...prev,
    ])
    showScanFeedback('success', `✅ ${namaSiswa} — Hadir`)
  }, [pelatihId, tanggal, kelas, scanResults])

  const handleSelesaiScan = async () => {
    setScanActive(false)
    if (!pelatihId || scanResults.length === 0) return
    setScanSaving(true)

    // Catat absensi pelatih jika belum
    const { data: programKelasList } = await supabase.from('program_kelas').select('id, nama_program')
    let matchedClassId = null
    if (programKelasList) {
      const targetName = kelas === 'Umum' ? 'Umum' : 'Prestasi'
      const found = programKelasList.find((p: any) => p.nama_program.toLowerCase().includes(targetName.toLowerCase()))
      if (found) matchedClassId = found.id
    }

    const now = new Date()
    const jamMasuk = now.toTimeString().split(' ')[0]
    await supabase
      .from('absensi_pelatih')
      .upsert(
        { tgl: tanggal, pelatih_id: pelatihId, kelas, jam_masuk: jamMasuk, program_kelas_id: matchedClassId },
        { onConflict: 'tgl,pelatih_id,kelas' }
      )

    setScanSaving(false)
    setScanSavedOk(true)
  }

  // ── RENDER ───────────────────────────────────────────────
  const tanggalFormatted = new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">Input Absensi</h1>
        <p className="text-dark/60 font-sans mt-1">Catat kehadiran siswa per sesi latihan</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-[3px] border-dark shadow-[4px_4px_0px_#1E2A38] overflow-hidden">
        <button
          onClick={() => handleModeSwitch('manual')}
          className={`flex-1 px-4 py-3 font-pixel text-sm transition-all duration-75 ${
            mode === 'manual'
              ? 'bg-primary border-r-[3px] border-dark text-dark'
              : 'bg-white border-r-[3px] border-dark text-dark/50 hover:bg-background'
          }`}
        >
          📋 Manual
        </button>
        <button
          onClick={() => handleModeSwitch('scan')}
          className={`flex-1 px-4 py-3 font-pixel text-sm transition-all duration-75 ${
            mode === 'scan'
              ? 'bg-secondary text-dark'
              : 'bg-white text-dark/50 hover:bg-background'
          }`}
        >
          📷 Scan Barcode
        </button>
      </div>

      {/* Filter Sesi — sama untuk kedua mode */}
      <Card className="flex flex-col gap-6">
        <h2 className="text-lg font-bold font-sans text-dark">Pilih Sesi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tanggal"
            type="date"
            value={tanggal}
            onChange={e => {
              setTanggal(e.target.value)
              setListLoaded(false)
              setScanResults([])
              setScanSavedOk(false)
            }}
          />
          <div className="flex flex-col gap-2 w-full">
            <label className="font-bold text-dark">Kelas</label>
            <select
              value={kelas}
              onChange={e => {
                setKelas(e.target.value)
                setListLoaded(false)
                setScanResults([])
                setScanSavedOk(false)
              }}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary transition-colors font-sans"
            >
              {KELAS_OPTIONS.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Keterangan hanya di mode manual */}
        {mode === 'manual' && (
          <>
            <Button
              variant="secondary"
              onClick={handleMuatSiswa}
              disabled={loadingSiswa || !pelatihId}
              className="w-full sm:w-auto"
            >
              {loadingSiswa ? 'Memuat...' : '🔍 Muat Daftar Siswa'}
            </Button>
            <div className="p-3 bg-background border-2 border-dark/20 rounded-xl text-xs font-sans text-dark/60 flex flex-col gap-1">
              <p>📌 <strong className="text-dark">Kelas Umum</strong> — Menampilkan <strong>semua siswa aktif</strong> (termasuk siswa spesialis Poomsae &amp; Kyorugi yang juga ikut latihan reguler)</p>
              <p>🥋 <strong className="text-dark">Kelas Pomsae</strong> — Hanya siswa dengan spesialisasi Poomsae</p>
              <p>🥊 <strong className="text-dark">Kelas Kyurugi</strong> — Hanya siswa dengan spesialisasi Kyorugi</p>
            </div>
          </>
        )}

        {/* Info mode scan */}
        {mode === 'scan' && (
          <div className="p-3 bg-background border-2 border-dark/20 rounded-xl text-xs font-sans text-dark/60 flex flex-col gap-1">
            <p>📷 <strong className="text-dark">Mode Scan Barcode</strong> — Arahkan kamera ke QR code di kartu anggota siswa</p>
            <p>✅ Setiap scan otomatis mencatat <strong>Hadir</strong> dan tersimpan langsung ke database</p>
            <p>🔄 Jika ada koreksi status, gunakan mode Manual setelah selesai scan</p>
          </div>
        )}
      </Card>

      {/* ─── MODE MANUAL ─────────────────────────────────── */}
      {mode === 'manual' && listLoaded && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-sans text-dark">
              Daftar Siswa
              <span className="ml-2 text-base font-normal text-dark/60">
                — Kelas {kelas} · {tanggalFormatted}
              </span>
            </h2>
            <span className="text-sm font-bold text-dark/50 bg-white border-2 border-dark px-3 py-1 rounded-full">
              {siswaList.length} siswa
            </span>
          </div>

          {siswaList.length === 0 ? (
            <Card className="text-center py-12 text-dark/50 font-sans">
              Tidak ada siswa aktif di program kelas ini.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {siswaList.map((entry, idx) => (
                <Card key={entry.siswa_id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-sm font-bold text-dark/40 w-6 shrink-0">{idx + 1}</span>
                    <span className="font-bold font-sans text-dark truncate">{entry.nama}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(STATUS_CONFIG) as StatusHadir[]).map(status => {
                      const cfg = STATUS_CONFIG[status]
                      const isActive = entry.status === status
                      return (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(entry.siswa_id, status)}
                          className={`px-4 py-2 rounded-full border-2 font-bold text-sm font-sans transition-all ${
                            isActive
                              ? `${cfg.bg} ${cfg.border} border-dark shadow-brutal scale-105`
                              : 'bg-white border-dark/30 text-dark/50 hover:border-dark hover:text-dark'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {siswaList.length > 0 && (
            <Card className="bg-dark text-white border-dark p-4">
              <div className="flex flex-wrap gap-4 justify-center">
                {(Object.keys(STATUS_CONFIG) as StatusHadir[]).map(status => {
                  const count = siswaList.filter(e => e.status === status).length
                  const cfg = STATUS_CONFIG[status]
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${cfg.bg}`} />
                      <span className="font-bold">{cfg.label}: {count}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {error && (
            <div className="bg-accent/20 border-2 border-accent rounded-2xl p-4 text-dark font-sans">
              ⚠️ {error}
            </div>
          )}
          {savedOk && (
            <div className="bg-primary/20 border-2 border-primary rounded-2xl p-4 text-dark font-bold font-sans">
              ✅ Absensi berhasil disimpan! Absensi pelatih juga tercatat otomatis.
            </div>
          )}

          {siswaList.length > 0 && (
            <Button
              variant="primary"
              onClick={handleSimpan}
              disabled={saving}
              className="w-full text-lg py-4"
            >
              {saving ? '⏳ Menyimpan...' : '💾 Simpan Absensi'}
            </Button>
          )}
        </div>
      )}

      {/* ─── MODE SCAN ───────────────────────────────────── */}
      {mode === 'scan' && (
        <div className="flex flex-col gap-6">

          {/* Kontrol Scan */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold font-sans text-dark">Scanner Kartu Anggota</h2>
                <p className="text-sm text-dark/60 font-sans">{tanggalFormatted} · Kelas {kelas}</p>
              </div>
              <div className="flex gap-3">
                {!scanActive ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setScanSavedOk(false)
                      setScanActive(true)
                    }}
                    disabled={!pelatihId}
                  >
                    📷 Mulai Scan
                  </Button>
                ) : (
                  <Button
                    variant="accent"
                    onClick={handleSelesaiScan}
                    disabled={scanSaving}
                  >
                    {scanSaving ? '⏳ Menyimpan...' : '⏹ Selesai Scan'}
                  </Button>
                )}
              </div>
            </div>

            {/* Kamera */}
            {scanActive && (
              <div className="flex flex-col gap-4">
                <BarcodeScanner
                  onScanSuccess={handleScanResult}
                  onScanError={(err) => showScanFeedback('error', `❌ Kamera error: ${err}`)}
                  isActive={scanActive}
                />
              </div>
            )}

            {/* Feedback Toast */}
            {scanFeedback && (
              <div className={`px-4 py-3 rounded-xl border-2 font-bold font-sans text-sm transition-all ${
                scanFeedback.type === 'success'
                  ? 'bg-primary/20 border-primary text-dark'
                  : scanFeedback.type === 'dup'
                  ? 'bg-yellow-100 border-yellow-400 text-dark'
                  : 'bg-accent/20 border-accent text-dark'
              }`}>
                {scanFeedback.msg}
              </div>
            )}
          </Card>

          {/* Hasil Scan — Ringkasan Sesi */}
          {scanResults.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-sans text-dark">
                  Sudah Scan
                  <span className="ml-2 text-base font-normal text-dark/60">— {scanResults.length} siswa</span>
                </h2>
                <span className="text-xs text-dark/50 font-sans">Tersimpan otomatis ✅</span>
              </div>
              <div className="flex flex-col gap-2">
                {scanResults.map((r, idx) => (
                  <Card key={r.siswa_id} className="flex items-center gap-4 p-4">
                    <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-dark text-sm shrink-0">
                      ✓
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold font-sans text-dark">{r.nama}</div>
                      <div className="text-xs text-dark/50 font-sans">{r.no_kartu} · {r.scanned_at.toLocaleTimeString('id-ID')}</div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-primary rounded-full border border-dark text-dark font-sans">
                      Hadir
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Sukses message setelah selesai */}
          {scanSavedOk && (
            <div className="bg-primary/20 border-2 border-primary rounded-2xl p-4 text-dark font-bold font-sans">
              ✅ Sesi absensi selesai! {scanResults.length} siswa tercatat hadir. Absensi pelatih juga tersimpan.
            </div>
          )}

          {/* Empty state */}
          {!scanActive && scanResults.length === 0 && (
            <Card className="text-center py-12 text-dark/50 font-sans flex flex-col items-center gap-3">
              <span className="text-5xl">📷</span>
              <p className="font-bold text-dark">Belum ada siswa di-scan</p>
              <p className="text-sm">Klik <strong>Mulai Scan</strong> lalu arahkan kamera ke QR kartu anggota</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
