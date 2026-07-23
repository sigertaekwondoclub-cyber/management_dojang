'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Siswa, Profile } from '@/lib/types'

type StatusHadir = 'hadir' | 'izin' | 'sakit' | 'alpha'

interface AbsensiEntry {
  siswa_id: string
  nama: string
  status: StatusHadir
}

const KELAS_OPTIONS = ['Umum', 'Pomsae', 'Kyurugi']

// Mapping: kelas → nama_program di program_kelas
function kelasToProgram(kelas: string): string[] {
  if (kelas === 'Umum') return ['Umum']
  return ['Prestasi'] // Pomsae & Kyurugi masuk program Prestasi
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

  const [siswaList, setSiswaList] = useState<AbsensiEntry[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [loadingSiswa, setLoadingSiswa] = useState(false)

  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  }, [supabase])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // Load daftar siswa sesuai kelas + cek absensi existing
  const handleMuatSiswa = useCallback(async () => {
    if (!pelatihId) return
    setLoadingSiswa(true)
    setError(null)
    setSavedOk(false)

    const programs = kelasToProgram(kelas)

    // Ambil siswa aktif berdasarkan program kelas
    const { data: siswaData, error: siswaErr } = await supabase
      .from('siswa')
      .select('id, nama, program_kelas_id, program_kelas:program_kelas_id(nama_program)')
      .eq('status_aktif', true)

    if (siswaErr) {
      setError('Gagal memuat data siswa.')
      setLoadingSiswa(false)
      return
    }

    // Filter siswa yang program_kelas-nya sesuai kelas yang dipilih
    const filtered = (siswaData || []).filter((s: Siswa & { program_kelas?: { nama_program: string } }) =>
      s.program_kelas && programs.includes(s.program_kelas.nama_program)
    )

    // Cek existing absensi untuk tgl + kelas ini
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

    const entries: AbsensiEntry[] = filtered.map((s: Siswa) => ({
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

    // Upsert absensi_siswa (bulk)
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

    // Upsert absensi_pelatih — jam masuk = sekarang (time only)
    const now = new Date()
    const jamMasuk = now.toTimeString().split(' ')[0] // HH:MM:SS

    const { error: pelatihErr } = await supabase
      .from('absensi_pelatih')
      .upsert(
        { tgl: tanggal, pelatih_id: pelatihId, kelas, jam_masuk: jamMasuk },
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

  const isEditing = listLoaded && siswaList.some(e => {
    // cek apakah ada data existing — kita tandai dari handleMuatSiswa tidak bisa, 
    // tapi simpan tombol tetap relevan
    return true
  })

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">Input Absensi</h1>
        <p className="text-dark/60 font-sans mt-1">Catat kehadiran siswa per sesi latihan</p>
      </div>

      {/* Filter Card */}
      <Card className="flex flex-col gap-6">
        <h2 className="text-lg font-bold font-sans text-dark">Pilih Sesi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tanggal"
            type="date"
            value={tanggal}
            onChange={e => { setTanggal(e.target.value); setListLoaded(false) }}
          />
          <div className="flex flex-col gap-2 w-full">
            <label className="font-bold text-dark">Kelas</label>
            <select
              value={kelas}
              onChange={e => { setKelas(e.target.value); setListLoaded(false) }}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary transition-colors font-sans"
            >
              {KELAS_OPTIONS.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={handleMuatSiswa}
          disabled={loadingSiswa || !pelatihId}
          className="w-full sm:w-auto"
        >
          {loadingSiswa ? 'Memuat...' : '🔍 Muat Daftar Siswa'}
        </Button>
      </Card>

      {/* Daftar Siswa */}
      {listLoaded && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-sans text-dark">
              Daftar Siswa
              <span className="ml-2 text-base font-normal text-dark/60">
                — Kelas {kelas} · {new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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

          {/* Summary bar */}
          {siswaList.length > 0 && (
            <Card className="bg-dark text-white border-dark p-4">
              <div className="flex flex-wrap gap-4 justify-center">
                {(Object.keys(STATUS_CONFIG) as StatusHadir[]).map(status => {
                  const count = siswaList.filter(e => e.status === status).length
                  const cfg = STATUS_CONFIG[status]
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${cfg.bg}`}></span>
                      <span className="font-bold">{cfg.label}: {count}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Error / Success */}
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

          {/* Simpan Button */}
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
    </div>
  )
}
