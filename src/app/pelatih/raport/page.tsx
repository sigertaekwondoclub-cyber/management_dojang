'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Siswa, PenilaianAtlet } from '@/lib/types'

const supabase = createClient()

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

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

  // Modal Input Nilai
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    skor_fisik: 80,
    skor_kyorugi: 80,
    skor_poomsae: 80,
    skor_disiplin: 90,
    catatan_pelatih: '',
    rekomendasi: 'Siap Ujian Sabuk'
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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('pelatih_id').eq('id', user.id).single()
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

  const openFormModal = (siswa: Siswa) => {
    setSelectedSiswa(siswa)
    const existing = penilaianList.find(p => p.siswa_id === siswa.id)
    if (existing) {
      setFormData({
        skor_fisik: existing.skor_fisik,
        skor_kyorugi: existing.skor_kyorugi,
        skor_poomsae: existing.skor_poomsae,
        skor_disiplin: existing.skor_disiplin,
        catatan_pelatih: existing.catatan_pelatih || '',
        rekomendasi: existing.rekomendasi || 'Siap Ujian Sabuk'
      })
    } else {
      setFormData({
        skor_fisik: 80,
        skor_kyorugi: 80,
        skor_poomsae: 80,
        skor_disiplin: 90,
        catatan_pelatih: '',
        rekomendasi: 'Siap Ujian Sabuk'
      })
    }
    setIsModalOpen(true)
  }

  const handleSavePenilaian = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSiswa) return
    setSaving(true)

    const payload = {
      siswa_id: selectedSiswa.id,
      pelatih_id: pelatihId,
      periode_bulan: parseInt(bulan),
      periode_tahun: parseInt(tahun),
      skor_fisik: formData.skor_fisik,
      skor_kyorugi: formData.skor_kyorugi,
      skor_poomsae: formData.skor_poomsae,
      skor_disiplin: formData.skor_disiplin,
      catatan_pelatih: formData.catatan_pelatih,
      rekomendasi: formData.rekomendasi,
      updated_at: new Date().toISOString()
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

  const filteredSiswa = siswaList.filter(s => {
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
          <h1 className="text-3xl font-bold font-sans text-dark">📊 Raport &amp; Penilaian Atlet</h1>
          <p className="text-dark/60 font-sans mt-1">Evaluasi kemajuan fisik, teknik kyorugi/poomsae, dan sikap siswa</p>
        </div>
      </div>

      {/* Periode & Filter Card */}
      <Card className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Bulan Periode</label>
            <select
              value={bulan}
              onChange={e => setBulan(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[150px]"
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Tahun</label>
            <input
              type="number"
              value={tahun}
              onChange={e => setTahun(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans w-[100px]"
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <select
            value={filterKelas}
            onChange={e => setFilterKelas(e.target.value)}
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
            onChange={e => setSearchQuery(e.target.value)}
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
          {filteredSiswa.map(siswa => {
            const raport = penilaianList.find(p => p.siswa_id === siswa.id)
            const hasRaport = !!raport
            const avgScore = hasRaport
              ? Math.round((raport.skor_fisik + raport.skor_kyorugi + raport.skor_poomsae + raport.skor_disiplin) / 4)
              : null

            return (
              <Card key={siswa.id} className={`flex flex-col justify-between gap-4 border-2 ${hasRaport ? 'border-dark bg-white' : 'border-dashed border-dark/30 bg-background'}`}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-dark font-sans text-base">{siswa.nama}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge color="dark">Sabuk {siswa.sabuk_saat_ini}</Badge>
                        <span className="text-xs text-dark/60 font-sans">{(siswa.program_kelas as any)?.nama_program || 'Umum'}</span>
                      </div>
                    </div>
                    {hasRaport ? (
                      <div className="text-center p-2 bg-green-50 border border-green-300 rounded-xl">
                        <span className="text-[10px] font-bold text-green-700 block uppercase">Skor Rata-rata</span>
                        <span className="text-lg font-bold text-green-800 font-mono">{avgScore}</span>
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-dark/10 rounded-lg text-dark/50 font-bold">
                        Belum Dinilai
                      </span>
                    )}
                  </div>

                  {hasRaport && (
                    <div className="mt-4 pt-3 border-t border-dark/10 flex flex-col gap-2 text-xs font-sans">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-background p-2 rounded-lg border border-dark/10 flex justify-between">
                          <span className="text-dark/60">🏃 Fisik:</span>
                          <strong className="text-dark">{raport.skor_fisik}</strong>
                        </div>
                        <div className="bg-background p-2 rounded-lg border border-dark/10 flex justify-between">
                          <span className="text-dark/60">🥊 Kyorugi:</span>
                          <strong className="text-dark">{raport.skor_kyorugi}</strong>
                        </div>
                        <div className="bg-background p-2 rounded-lg border border-dark/10 flex justify-between">
                          <span className="text-dark/60">🥋 Poomsae:</span>
                          <strong className="text-dark">{raport.skor_poomsae}</strong>
                        </div>
                        <div className="bg-background p-2 rounded-lg border border-dark/10 flex justify-between">
                          <span className="text-dark/60">🧘 Disiplin:</span>
                          <strong className="text-dark">{raport.skor_disiplin}</strong>
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

      {/* MODAL INPUT RAPORT */}
      {isModalOpen && selectedSiswa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white border-2 border-dark shadow-brutal w-full max-w-lg rounded-2xl p-6 z-10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-dark/10 pb-3">
              <div>
                <h3 className="text-xl font-bold font-sans text-dark">Raport Evaluasi Atlet</h3>
                <p className="text-xs text-dark/60 font-sans mt-0.5">
                  Siswa: <strong className="text-dark">{selectedSiswa.nama}</strong> ({selectedSiswa.sabuk_saat_ini}) · Periode {BULAN_NAMES[parseInt(bulan)]} {tahun}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full border border-dark/30 hover:bg-dark hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePenilaian} className="flex flex-col gap-4">
              {/* Sliders Kategori */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span>🏃 Fisik &amp; Stamina (0-100)</span>
                    <span className="font-mono text-primary font-bold text-sm">{formData.skor_fisik}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_fisik}
                    onChange={e => setFormData({ ...formData, skor_fisik: parseInt(e.target.value) })}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span>🥊 Kyorugi / Teknik Tanding (0-100)</span>
                    <span className="font-mono text-primary font-bold text-sm">{formData.skor_kyorugi}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_kyorugi}
                    onChange={e => setFormData({ ...formData, skor_kyorugi: parseInt(e.target.value) })}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span>🥋 Poomsae / Akurasi Jurus (0-100)</span>
                    <span className="font-mono text-primary font-bold text-sm">{formData.skor_poomsae}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_poomsae}
                    onChange={e => setFormData({ ...formData, skor_poomsae: parseInt(e.target.value) })}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark font-sans">
                    <span>🧘 Disiplin, Adab &amp; Sikap (0-100)</span>
                    <span className="font-mono text-primary font-bold text-sm">{formData.skor_disiplin}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={formData.skor_disiplin}
                    onChange={e => setFormData({ ...formData, skor_disiplin: parseInt(e.target.value) })}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* Rekomendasi */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark font-sans">Rekomendasi Pelatih</label>
                <select
                  value={formData.rekomendasi}
                  onChange={e => setFormData({ ...formData, rekomendasi: e.target.value })}
                  className="border-2 border-dark rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Siap Ujian Sabuk">🟢 Siap Ujian Sabuk</option>
                  <option value="Perlu Penguatan Fisik & Stamina">🟡 Perlu Penguatan Fisik & Stamina</option>
                  <option value="Perlu Pemantapan Jurus Poomsae">🟡 Perlu Pemantapan Jurus Poomsae</option>
                  <option value="Direkomendasikan Masuk Kelas Prestasi / Kejuaraan">⭐ Direkomendasikan Masuk Kelas Prestasi / Kejuaraan</option>
                  <option value="Tingkatkan Kedisiplinan Kehadiran">🔴 Tingkatkan Kedisiplinan Kehadiran</option>
                </select>
              </div>

              {/* Catatan Pelatih */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark font-sans">Catatan Evaluasi Khusus (Opsional)</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Tendangan dollyo chagi sangat baik, tingkatkan stamina untuk ronde kedua..."
                  value={formData.catatan_pelatih}
                  onChange={e => setFormData({ ...formData, catatan_pelatih: e.target.value })}
                  className="border-2 border-dark rounded-xl p-3 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
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
    </div>
  )
}
