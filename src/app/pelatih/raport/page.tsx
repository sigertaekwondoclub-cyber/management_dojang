'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Siswa, PenilaianAtlet, SixAttributes, RawTestData } from '@/lib/types'
import {
  calculateAge,
  mapLegacyPenilaianToStats,
  calculateOVR,
  determineArchetype,
  getOVRTier,
  ATTRIBUTE_CONFIG,
  calculateDisciplineScore,
} from '@/lib/athlete-stats'
import { TestCalculatorModal } from '@/components/atlet/TestCalculatorModal'

const supabase = createClient()

const BULAN_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

interface RaportFormData {
  skor_str: number
  skor_agi: number
  skor_flx: number
  skor_sta: number
  skor_tec: number
  skor_dis: number
  catatan_pelatih: string
  rekomendasi: string
  raw_test_data: RawTestData | null
}

interface AttendanceStats {
  total: number
  hadir: number
  percent: number
}

export default function PelatihRaportPage() {
  const now = new Date()
  const [bulan, setBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [tahun, setTahun] = useState(String(now.getFullYear()))

  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [penilaianList, setPenilaianList] = useState<PenilaianAtlet[]>([])
  const [loading, setLoading] = useState(true)
  const [pelatihId, setPelatihId] = useState<string | null>(null)

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterKelas, setFilterKelas] = useState('semua')

  // Modal Input Nilai Raport
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats>({
    total: 0,
    hadir: 0,
    percent: 100,
  })
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  const [formData, setFormData] = useState<RaportFormData>({
    skor_str: 75,
    skor_agi: 75,
    skor_flx: 75,
    skor_sta: 75,
    skor_tec: 75,
    skor_dis: 85,
    catatan_pelatih: '',
    rekomendasi: 'Siap Ujian Sabuk',
    raw_test_data: null,
  })
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const bulInt = parseInt(bulan)
    const tahInt = parseInt(tahun)

    // Get Pelatih ID
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('pelatih_id')
        .eq('id', user.id)
        .single()
      if (profile?.pelatih_id) setPelatihId(profile.pelatih_id)
    }

    // 1. Fetch Siswa Aktif
    const { data: sData } = await supabase
      .from('siswa')
      .select('*, program_kelas(nama_program)')
      .eq('status_aktif', true)
      .order('nama', { ascending: true })

    if (sData) setSiswaList(sData as Siswa[])

    // 2. Fetch Penilaian periode ini
    const { data: pData } = await supabase
      .from('penilaian_atlet')
      .select('*')
      .eq('periode_bulan', bulInt)
      .eq('periode_tahun', tahInt)

    if (pData) setPenilaianList(pData as PenilaianAtlet[])

    setLoading(false)
  }, [bulan, tahun])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Hitung agregasi absensi siswa di periode tertentu
  const fetchAttendanceForSiswa = async (
    siswaId: string,
    bulInt: number,
    tahInt: number
  ): Promise<AttendanceStats> => {
    const padMonth = String(bulInt).padStart(2, '0')
    const startDate = `${tahInt}-${padMonth}-01`
    const lastDay = new Date(tahInt, bulInt, 0).getDate()
    const endDate = `${tahInt}-${padMonth}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('absensi_siswa')
      .select('id, status_hadir, tgl')
      .eq('siswa_id', siswaId)
      .gte('tgl', startDate)
      .lte('tgl', endDate)

    if (error || !data) {
      return { total: 0, hadir: 0, percent: 100 }
    }

    const total = data.length
    const hadir = data.filter((d) => d.status_hadir === 'hadir').length
    const percent = total > 0 ? Math.round((hadir / total) * 100) : 100

    return { total, hadir, percent }
  }

  const openFormModal = async (siswa: Siswa) => {
    setSelectedSiswa(siswa)
    setLoadingAttendance(true)

    const bulInt = parseInt(bulan)
    const tahInt = parseInt(tahun)

    // Agregasi kehadiran di bulan terpilih
    const att = await fetchAttendanceForSiswa(siswa.id, bulInt, tahInt)
    setAttendanceStats(att)
    setLoadingAttendance(false)

    const existing = penilaianList.find((p) => p.siswa_id === siswa.id)
    if (existing) {
      const stats = mapLegacyPenilaianToStats(existing)
      setFormData({
        skor_str: stats.skor_str,
        skor_agi: stats.skor_agi,
        skor_flx: stats.skor_flx,
        skor_sta: stats.skor_sta,
        skor_tec: stats.skor_tec,
        skor_dis: stats.skor_dis,
        catatan_pelatih: existing.catatan_pelatih || '',
        rekomendasi: existing.rekomendasi || 'Siap Ujian Sabuk',
        raw_test_data: (existing.raw_test_data as RawTestData) || null,
      })
    } else {
      // Siswa baru dinilai: sarankan skor disiplin dari presensi riil
      const suggestedDis = calculateDisciplineScore(att.hadir, att.total, 85)
      setFormData({
        skor_str: 75,
        skor_agi: 75,
        skor_flx: 75,
        skor_sta: 75,
        skor_tec: 75,
        skor_dis: suggestedDis,
        catatan_pelatih: '',
        rekomendasi: 'Siap Ujian Sabuk',
        raw_test_data: null,
      })
    }
    setIsModalOpen(true)
  }

  // Hitung OVR & Archetype real-time dari state modal form
  const modalScores: SixAttributes = useMemo(() => {
    return {
      skor_str: formData.skor_str,
      skor_agi: formData.skor_agi,
      skor_flx: formData.skor_flx,
      skor_sta: formData.skor_sta,
      skor_tec: formData.skor_tec,
      skor_dis: formData.skor_dis,
    }
  }, [formData.skor_str, formData.skor_agi, formData.skor_flx, formData.skor_sta, formData.skor_tec, formData.skor_dis])

  const modalOvr = useMemo(() => calculateOVR(modalScores), [modalScores])
  const modalArchetype = useMemo(() => determineArchetype(modalScores), [modalScores])
  const modalOvrTier = useMemo(() => getOVRTier(modalOvr), [modalOvr])

  const handleSavePenilaian = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSiswa) return
    setSaving(true)

    // Hitung 4 pilar lama untuk backward compatibility
    const legacyFisik = Math.round(
      (modalScores.skor_str + modalScores.skor_agi + modalScores.skor_flx + modalScores.skor_sta) / 4
    )
    const legacyKyorugi = Math.round((modalScores.skor_agi + modalScores.skor_str) / 2)
    const legacyPoomsae = modalScores.skor_tec
    const legacyDisiplin = modalScores.skor_dis

    const payload = {
      siswa_id: selectedSiswa.id,
      pelatih_id: pelatihId,
      periode_bulan: parseInt(bulan),
      periode_tahun: parseInt(tahun),
      // 6 Atribut Baru
      skor_str: modalScores.skor_str,
      skor_agi: modalScores.skor_agi,
      skor_flx: modalScores.skor_flx,
      skor_sta: modalScores.skor_sta,
      skor_tec: modalScores.skor_tec,
      skor_dis: modalScores.skor_dis,
      ovr_score: modalOvr,
      archetype: modalArchetype,
      raw_test_data: formData.raw_test_data,
      // 4 Pilar Lama
      skor_fisik: legacyFisik,
      skor_kyorugi: legacyKyorugi,
      skor_poomsae: legacyPoomsae,
      skor_disiplin: legacyDisiplin,
      catatan_pelatih: formData.catatan_pelatih,
      rekomendasi: formData.rekomendasi,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('penilaian_atlet')
      .upsert(payload, { onConflict: 'siswa_id,periode_bulan,periode_tahun' })

    if (error) {
      alert('Gagal menyimpan penilaian: ' + error.message)
    } else {
      showToast(`✅ Raport ${selectedSiswa.nama} berhasil disimpan!`)
      setIsModalOpen(false)
      await fetchData()
    }
    setSaving(false)
  }

  const filteredSiswa = siswaList.filter((s) => {
    const matchSearch = s.nama.toLowerCase().includes(searchQuery.toLowerCase())
    const programName = (s.program_kelas as any)?.nama_program?.toLowerCase() || 'umum'
    const matchKelas = filterKelas === 'semua' || programName.includes(filterKelas.toLowerCase())
    return matchSearch && matchKelas
  })

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-primary text-dark font-bold font-sans rounded-2xl border-2 border-dark shadow-brutal animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black font-sans text-dark tracking-tight">
            📊 Raport &amp; Statistik Atlet
          </h1>
          <p className="text-dark/60 font-sans mt-1">
            Evaluasi 6 atribut atlet (STR, AGI, FLX, STA, TEC, DIS), kalkulator tes fisik, dan gelar archetype
          </p>
        </div>
      </div>

      {/* Periode & Filter Card */}
      <Card className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Bulan Periode</label>
            <select
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[150px]"
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                <option key={m} value={m}>
                  {BULAN_NAMES[parseInt(m)]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Tahun</label>
            <input
              type="number"
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans w-[100px]"
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="border-2 border-dark/30 rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="semua">Semua Program</option>
            <option value="umum">Kelas Umum</option>
            <option value="prestasi">Kelas Prestasi</option>
          </select>
          <input
            type="text"
            placeholder="Cari nama siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-2 border-dark/30 rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
          />
        </div>
      </Card>

      {/* Grid Siswa & Raport */}
      {loading ? (
        <Card className="text-center py-16 text-dark/50 font-sans">
          <div className="text-3xl mb-2">⏳</div>
          <p className="font-bold">Memuat data raport siswa...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSiswa.map((siswa) => {
            const raport = penilaianList.find((p) => p.siswa_id === siswa.id)
            const hasRaport = !!raport
            const stats = hasRaport ? mapLegacyPenilaianToStats(raport) : null
            const ovr = hasRaport ? raport.ovr_score || calculateOVR(stats!) : null
            const archetype = hasRaport ? raport.archetype || determineArchetype(stats!) : null
            const ovrTier = ovr !== null ? getOVRTier(ovr) : null

            return (
              <Card
                key={siswa.id}
                className={`flex flex-col justify-between gap-4 border-2 transition-shadow ${
                  hasRaport
                    ? 'border-dark bg-white shadow-brutal'
                    : 'border-dashed border-dark/30 bg-background/50 hover:bg-background'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-dark font-sans text-base">{siswa.nama}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge color="dark">Sabuk {siswa.sabuk_saat_ini}</Badge>
                        <span className="text-xs text-dark/60 font-sans">
                          {(siswa.program_kelas as any)?.nama_program || 'Umum'}
                        </span>
                      </div>
                    </div>

                    {hasRaport && ovr !== null && ovrTier ? (
                      <div className="flex flex-col items-end gap-1">
                        <div
                          className="px-2.5 py-1 rounded-xl border-2 border-dark font-mono font-black text-lg text-dark shadow-[2px_2px_0px_#1E2A38]"
                          style={{ backgroundColor: ovrTier.color }}
                          title={`Tier: ${ovrTier.badge}`}
                        >
                          <span className="text-[10px] block leading-none opacity-80 uppercase">OVR</span>
                          {ovr}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs px-2.5 py-1 bg-dark/10 rounded-lg text-dark/50 font-bold">
                        Belum Dinilai
                      </span>
                    )}
                  </div>

                  {hasRaport && stats && (
                    <div className="mt-4 pt-3 border-t border-dark/10 flex flex-col gap-2.5 text-xs font-sans">
                      {/* Archetype Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-dark/5 border border-dark/20 text-dark">
                          {archetype}
                        </span>
                        {raport.raw_test_data && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-dark border border-primary/40 font-bold"
                            title="Diuji menggunakan Kalkulator Tes Fisik"
                          >
                            🧮 Tes Fisik
                          </span>
                        )}
                      </div>

                      {/* 6 Mini Atribut Badges */}
                      <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                        <div className="bg-background p-1.5 rounded-lg border border-dark/10 flex justify-between items-center px-2">
                          <span className="text-[11px] text-dark/60 font-sans">💥 STR</span>
                          <strong className="text-rose-600 font-bold">{stats.skor_str}</strong>
                        </div>
                        <div className="bg-background p-1.5 rounded-lg border border-dark/10 flex justify-between items-center px-2">
                          <span className="text-[11px] text-dark/60 font-sans">⚡ AGI</span>
                          <strong className="text-amber-600 font-bold">{stats.skor_agi}</strong>
                        </div>
                        <div className="bg-background p-1.5 rounded-lg border border-dark/10 flex justify-between items-center px-2">
                          <span className="text-[11px] text-dark/60 font-sans">🤸 FLX</span>
                          <strong className="text-emerald-600 font-bold">{stats.skor_flx}</strong>
                        </div>
                        <div className="bg-background p-1.5 rounded-lg border border-dark/10 flex justify-between items-center px-2">
                          <span className="text-[11px] text-dark/60 font-sans">🫁 STA</span>
                          <strong className="text-cyan-600 font-bold">{stats.skor_sta}</strong>
                        </div>
                        <div className="bg-background p-1.5 rounded-lg border border-dark/10 flex justify-between items-center px-2">
                          <span className="text-[11px] text-dark/60 font-sans">🥋 TEC</span>
                          <strong className="text-purple-600 font-bold">{stats.skor_tec}</strong>
                        </div>
                        <div className="bg-background p-1.5 rounded-lg border border-dark/10 flex justify-between items-center px-2">
                          <span className="text-[11px] text-dark/60 font-sans">⭐ DIS</span>
                          <strong className="text-blue-600 font-bold">{stats.skor_dis}</strong>
                        </div>
                      </div>

                      {raport.rekomendasi && (
                        <div className="mt-1 text-xs bg-primary/10 border border-primary/40 p-2 rounded-lg text-dark font-bold">
                          💡 {raport.rekomendasi}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  variant={hasRaport ? 'secondary' : 'primary'}
                  onClick={() => openFormModal(siswa)}
                  className="w-full text-xs py-2.5 font-bold"
                >
                  {hasRaport ? '✏️ Edit Nilai Raport' : '➕ Input Nilai Raport'}
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL INPUT RAPORT 6 ATRIBUT */}
      {isModalOpen && selectedSiswa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark/60 backdrop-blur-sm">
          <div
            className="relative bg-white border-3 border-dark shadow-[8px_8px_0px_#1E2A38] w-full max-w-xl rounded-2xl p-5 sm:p-6 z-10 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-dark/10 pb-3">
              <div>
                <h3 className="text-xl font-black font-sans text-dark">
                  Input Raport Atlet ({BULAN_NAMES[parseInt(bulan)]} {tahun})
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-dark/70 font-sans flex-wrap">
                  <span>
                    Siswa: <strong className="text-dark">{selectedSiswa.nama}</strong> ({selectedSiswa.sabuk_saat_ini})
                  </span>
                  <span>·</span>
                  <span>
                    Usia: <strong>{calculateAge(selectedSiswa.tgl_lahir)} thn</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full border-2 border-dark hover:bg-dark hover:text-white flex items-center justify-center font-bold text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Presensi & Kalkulator Banner */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-secondary/20 border-2 border-dark rounded-xl">
              <div className="text-xs font-sans text-dark">
                <span className="font-bold block">
                  Presensi Periode Ini:{' '}
                  {loadingAttendance ? (
                    '...'
                  ) : (
                    <span className="font-mono text-dark font-black">
                      {attendanceStats.hadir} / {attendanceStats.total} Sesi ({attendanceStats.percent}%)
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-dark/70">
                  {attendanceStats.total > 0
                    ? 'Disiplin terisi otomatis berdasarkan riwayat absensi'
                    : 'Belum ada catatan absensi di bulan ini'}
                </span>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={() => setIsCalculatorOpen(true)}
                className="text-xs py-2 px-3 font-black flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                🧮 Buka Kalkulator Tes Fisik
              </Button>
            </div>

            {/* Realtime OVR & Archetype Live Preview Card */}
            <div className="bg-slate-50 border-2 border-dark rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="px-3 py-1.5 rounded-xl border-2 border-dark font-black font-mono text-2xl text-dark shadow-[2px_2px_0px_#1E2A38]"
                  style={{ backgroundColor: modalOvrTier.color }}
                >
                  {modalOvr}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-dark/50 block">
                    {modalOvrTier.badge}
                  </span>
                  <strong className="text-base font-bold text-dark">{modalArchetype}</strong>
                </div>
              </div>

              {formData.raw_test_data && (
                <div className="text-right text-[11px] text-dark/70 bg-white px-2 py-1 rounded border border-dark/20 font-mono">
                  Data tes fisik lapangan terlampir ✓
                </div>
              )}
            </div>

            <form onSubmit={handleSavePenilaian} className="flex flex-col gap-4">
              {/* 6 Sliders Atribut */}
              <div className="flex flex-col gap-3.5">
                {/* 1. STR */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span className="flex items-center gap-1.5">
                      <span>{ATTRIBUTE_CONFIG.skor_str.icon}</span>
                      <span>
                        {ATTRIBUTE_CONFIG.skor_str.key} · {ATTRIBUTE_CONFIG.skor_str.fullLabel}
                      </span>
                    </span>
                    <span className="font-mono font-black text-rose-600 text-sm">
                      {formData.skor_str}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_str}
                    onChange={(e) =>
                      setFormData({ ...formData, skor_str: parseInt(e.target.value) || 75 })
                    }
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                </div>

                {/* 2. AGI */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span className="flex items-center gap-1.5">
                      <span>{ATTRIBUTE_CONFIG.skor_agi.icon}</span>
                      <span>
                        {ATTRIBUTE_CONFIG.skor_agi.key} · {ATTRIBUTE_CONFIG.skor_agi.fullLabel}
                      </span>
                    </span>
                    <span className="font-mono font-black text-amber-600 text-sm">
                      {formData.skor_agi}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_agi}
                    onChange={(e) =>
                      setFormData({ ...formData, skor_agi: parseInt(e.target.value) || 75 })
                    }
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>

                {/* 3. FLX */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span className="flex items-center gap-1.5">
                      <span>{ATTRIBUTE_CONFIG.skor_flx.icon}</span>
                      <span>
                        {ATTRIBUTE_CONFIG.skor_flx.key} · {ATTRIBUTE_CONFIG.skor_flx.fullLabel}
                      </span>
                    </span>
                    <span className="font-mono font-black text-emerald-600 text-sm">
                      {formData.skor_flx}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_flx}
                    onChange={(e) =>
                      setFormData({ ...formData, skor_flx: parseInt(e.target.value) || 75 })
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* 4. STA */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span className="flex items-center gap-1.5">
                      <span>{ATTRIBUTE_CONFIG.skor_sta.icon}</span>
                      <span>
                        {ATTRIBUTE_CONFIG.skor_sta.key} · {ATTRIBUTE_CONFIG.skor_sta.fullLabel}
                      </span>
                    </span>
                    <span className="font-mono font-black text-cyan-600 text-sm">
                      {formData.skor_sta}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_sta}
                    onChange={(e) =>
                      setFormData({ ...formData, skor_sta: parseInt(e.target.value) || 75 })
                    }
                    className="w-full accent-cyan-600 cursor-pointer"
                  />
                </div>

                {/* 5. TEC */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span className="flex items-center gap-1.5">
                      <span>{ATTRIBUTE_CONFIG.skor_tec.icon}</span>
                      <span>
                        {ATTRIBUTE_CONFIG.skor_tec.key} · {ATTRIBUTE_CONFIG.skor_tec.fullLabel}
                      </span>
                    </span>
                    <span className="font-mono font-black text-purple-600 text-sm">
                      {formData.skor_tec}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_tec}
                    onChange={(e) =>
                      setFormData({ ...formData, skor_tec: parseInt(e.target.value) || 75 })
                    }
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                {/* 6. DIS */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span className="flex items-center gap-1.5">
                      <span>{ATTRIBUTE_CONFIG.skor_dis.icon}</span>
                      <span>
                        {ATTRIBUTE_CONFIG.skor_dis.key} · {ATTRIBUTE_CONFIG.skor_dis.fullLabel}
                      </span>
                    </span>
                    <span className="font-mono font-black text-blue-600 text-sm">
                      {formData.skor_dis}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_dis}
                    onChange={(e) =>
                      setFormData({ ...formData, skor_dis: parseInt(e.target.value) || 85 })
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Rekomendasi */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark font-sans">Rekomendasi Pelatih</label>
                <select
                  value={formData.rekomendasi}
                  onChange={(e) => setFormData({ ...formData, rekomendasi: e.target.value })}
                  className="border-2 border-dark rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Siap Ujian Sabuk">🟢 Siap Ujian Sabuk</option>
                  <option value="Perlu Penguatan Fisik & Stamina">🟡 Perlu Penguatan Fisik &amp; Stamina</option>
                  <option value="Perlu Pemantapan Jurus Poomsae">🟡 Perlu Pemantapan Jurus Poomsae</option>
                  <option value="Direkomendasikan Masuk Kelas Prestasi / Kejuaraan">
                    ⭐ Direkomendasikan Masuk Kelas Prestasi / Kejuaraan
                  </option>
                  <option value="Tingkatkan Kedisiplinan Kehadiran">🔴 Tingkatkan Kedisiplinan Kehadiran</option>
                </select>
              </div>

              {/* Catatan Pelatih */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark font-sans">Catatan Evaluasi Khusus (Opsional)</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Tendangan dollyo chagi sangat baik, tingkatkan stamina dan kelenturan kaki..."
                  value={formData.catatan_pelatih}
                  onChange={(e) => setFormData({ ...formData, catatan_pelatih: e.target.value })}
                  className="border-2 border-dark rounded-xl p-3 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-dark/10">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                  Batal
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : '💾 Simpan Raport'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KALKULATOR TES FISIK */}
      {isCalculatorOpen && selectedSiswa && (
        <TestCalculatorModal
          isOpen={isCalculatorOpen}
          onClose={() => setIsCalculatorOpen(false)}
          siswa={selectedSiswa}
          initialRawData={formData.raw_test_data}
          attendancePercent={attendanceStats.percent}
          onApply={(scores, rawData) => {
            setFormData((prev) => ({
              ...prev,
              skor_str: scores.skor_str,
              skor_agi: scores.skor_agi,
              skor_flx: scores.skor_flx,
              skor_sta: scores.skor_sta,
              skor_tec: scores.skor_tec,
              skor_dis: scores.skor_dis,
              raw_test_data: rawData,
            }))
            showToast('⚡ Skor hasil tes fisik lapangan berhasil diterapkan!')
          }}
        />
      )}
    </div>
  )
}
