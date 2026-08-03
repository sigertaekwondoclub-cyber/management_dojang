'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { QRCodeSVG } from 'qrcode.react'
import type { KartuAnggota } from '@/lib/types'

type KartuWithSiswa = KartuAnggota & {
  siswa: { nama: string; sabuk_saat_ini: string; foto_url: string | null; program_kelas: { nama_program: string } | null }
}

export default function AdminKartuPage() {

  const [kartuList, setKartuList] = useState<KartuWithSiswa[]>([])
  const [siswaWithoutKartu, setSiswaWithoutKartu] = useState<{ id: string; nama: string; sabuk_saat_ini: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSiswa, setSelectedSiswa] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Ambil semua kartu anggota yang sudah ada
    const { data: kartuData } = await supabase
      .from('kartu_anggota')
      .select('*, siswa:siswa_id(nama, sabuk_saat_ini, foto_url, program_kelas:program_kelas_id(nama_program))')
      .order('created_at', { ascending: false })

    setKartuList((kartuData || []) as KartuWithSiswa[])

    // Cari siswa aktif yang belum punya kartu
    const existingSiswaIds = (kartuData || []).map(k => k.siswa_id)
    const { data: siswaData } = await supabase
      .from('siswa')
      .select('id, nama, sabuk_saat_ini')
      .eq('status_aktif', true)
      .not('id', 'in', existingSiswaIds.length > 0 ? `(${existingSiswaIds.map(id => `"${id}"`).join(',')})` : '("")')

    setSiswaWithoutKartu(siswaData || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const generateNoKartu = (baseNumber: number) => {
    const num = String(baseNumber).padStart(4, '0')
    return `TKD-${num}`
  }

  const handleGenerateKartu = async () => {
    const toGenerate = siswaWithoutKartu.filter(s => selectedSiswa.has(s.id))
    if (toGenerate.length === 0) return

    setGenerating(true)
    setError(null)

    // Ambil nomor kartu tertinggi dari database untuk menghindari duplikat
    const { data: maxData } = await supabase
      .from('kartu_anggota')
      .select('no_kartu')
      .like('no_kartu', 'TKD-%')
      .order('no_kartu', { ascending: false })
      .limit(1)

    let maxNumber = 0
    if (maxData && maxData.length > 0) {
      const lastNo = maxData[0].no_kartu // e.g. "TKD-0005"
      const parsed = parseInt(lastNo.replace('TKD-', ''), 10)
      if (!isNaN(parsed)) maxNumber = parsed
    }

    const rows = toGenerate.map((s, idx) => {
      const noKartu = generateNoKartu(maxNumber + idx + 1)
      return {
        siswa_id: s.id,
        no_kartu: noKartu,
        qr_code_value: noKartu,
        tgl_cetak: new Date().toISOString().split('T')[0],
        status_aktif: true,
      }
    })

    const { error: insertErr } = await supabase.from('kartu_anggota').insert(rows)

    if (insertErr) {
      setError('Gagal membuat kartu: ' + insertErr.message)
    } else {
      setSuccessMsg(`✅ ${toGenerate.length} kartu anggota berhasil dibuat!`)
      setSelectedSiswa(new Set())
      await fetchData()
    }
    setGenerating(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedSiswa(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedSiswa(new Set(siswaWithoutKartu.map(s => s.id)))
  }

  const SABUK_COLORS: Record<string, string> = {
    'Putih': '#FFFFFF', 'Kuning': '#FBBF24', 'Hijau': '#22C55E',
    'Biru': '#3B82F6', 'Merah': '#EF4444', 'Hitam': '#1E2A38',
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🪪 Kartu Anggota Digital</h1>
        <p className="text-dark/60 font-sans mt-1">Kelola dan generate kartu anggota untuk siswa aktif</p>
      </div>

      {error && <Card className="bg-accent/20 border-accent text-dark font-sans">⚠️ {error}</Card>}
      {successMsg && <Card className="bg-primary/20 border-primary text-dark font-bold font-sans">{successMsg}</Card>}

      {/* Siswa belum punya kartu */}
      {siswaWithoutKartu.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-bold font-sans text-dark text-lg">
              Siswa Belum Punya Kartu
              <span className="ml-2 text-sm font-normal text-dark/50">({siswaWithoutKartu.length} orang)</span>
            </h2>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-sm font-bold text-dark/60 hover:text-dark font-sans underline">
                Pilih Semua
              </button>
              <button onClick={() => setSelectedSiswa(new Set())} className="text-sm font-bold text-dark/60 hover:text-dark font-sans underline">
                Batal Pilih
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {siswaWithoutKartu.map(s => (
              <label key={s.id} className="flex items-center gap-3 cursor-pointer px-3 py-2 rounded-xl hover:bg-background transition-colors">
                <input
                  type="checkbox"
                  checked={selectedSiswa.has(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  className="w-5 h-5 rounded border-2 border-dark accent-primary cursor-pointer"
                />
                <span className="font-bold font-sans text-dark">{s.nama}</span>
                <span className="text-sm text-dark/50 font-sans">Sabuk {s.sabuk_saat_ini}</span>
              </label>
            ))}
          </div>
          <Button
            variant="primary"
            onClick={handleGenerateKartu}
            disabled={selectedSiswa.size === 0 || generating}
            className="w-full"
          >
            {generating ? '⏳ Membuat...' : `🪪 Generate ${selectedSiswa.size > 0 ? selectedSiswa.size : ''} Kartu Anggota`}
          </Button>
        </Card>
      )}

      {/* Daftar Kartu */}
      {loading ? (
        <Card className="text-center py-16 text-dark/50 font-sans">Memuat data...</Card>
      ) : kartuList.length === 0 ? (
        <Card className="text-center py-16 text-dark/50 font-sans">
          <div className="text-4xl mb-3">🪪</div>
          <p>Belum ada kartu anggota yang dibuat.</p>
        </Card>
      ) : (
        <div>
          <h2 className="font-bold font-sans text-dark text-xl mb-4">
            Semua Kartu
            <span className="ml-2 text-sm font-normal text-dark/50">({kartuList.length} kartu)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {kartuList.map(kartu => {
              const sabukColor = SABUK_COLORS[kartu.siswa?.sabuk_saat_ini || 'Putih'] || '#FDF6EC'
              const isGelap = ['Hitam', 'Biru'].includes(kartu.siswa?.sabuk_saat_ini || '')
              return (
                <div key={kartu.id}
                  className="border-2 border-dark rounded-2xl shadow-brutal overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${sabukColor}22, ${sabukColor}55)` }}>
                  {/* Card Header */}
                  <div className="bg-dark px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-bold font-sans text-sm">SIGER TAEKWONDO CLUB</span>
                    <span className="text-white/60 font-sans text-xs">{kartu.no_kartu}</span>
                  </div>
                  {/* Card Body */}
                  <div className="p-4 flex gap-4 items-center">
                    {/* QR Code */}
                    <div className="bg-white p-2 rounded-xl border-2 border-dark shrink-0">
                      <QRCodeSVG value={kartu.qr_code_value} size={72} />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold font-sans text-dark text-base leading-tight truncate">
                        {kartu.siswa?.nama || '-'}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="w-4 h-4 rounded-full border border-dark/30 shrink-0"
                          style={{ background: sabukColor }}
                        />
                        <span className="text-sm font-sans text-dark/70">
                          Sabuk {kartu.siswa?.sabuk_saat_ini || '-'}
                        </span>
                      </div>
                      <div className="text-xs text-dark/50 font-sans mt-1">
                        {kartu.siswa?.program_kelas?.nama_program || '-'}
                      </div>
                      <div className="mt-2">
                        <Badge color={kartu.status_aktif ? 'primary' : 'accent'}>
                          {kartu.status_aktif ? 'Aktif' : 'Non-Aktif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {/* Card Footer */}
                  <div className="border-t-2 border-dark/10 px-4 py-2">
                    <span className="text-xs text-dark/40 font-sans">
                      Dicetak: {kartu.tgl_cetak ? new Date(kartu.tgl_cetak + 'T00:00:00').toLocaleDateString('id-ID') : '-'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
