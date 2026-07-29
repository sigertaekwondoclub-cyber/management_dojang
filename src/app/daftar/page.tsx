'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import type { ProgramKelas } from '@/lib/types'
import Link from 'next/link'

const SABUK_OPTIONS = [
  'Putih',
  'Kuning',
  'Kuning Strip',
  'Hijau',
  'Hijau Strip',
  'Biru',
  'Biru Strip',
  'Merah Strip 1',
  'Merah Strip 2',
]

export default function PendaftaranPage() {
  const [programs, setPrograms] = useState<ProgramKelas[]>([])
  const [loading, setLoading] = useState(true)

  const [formData, setFormData] = useState({
    nama_calon_siswa: '',
    tgl_lahir: '',
    tempat_lahir: '',
    nama_ortu: '',
    no_hp_ortu: '',
    program_kelas_id: '',
    fokus_prestasi: '' as 'pomsae' | 'kyurugi' | '',
    berat_badan: '',
    sabuk_pendaftaran: 'Putih',
    alamat: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchPrograms = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('program_kelas')
      .select('*')
      .eq('status_aktif', true)

    if (!fetchError && data) {
      setPrograms(data as ProgramKelas[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.program_kelas_id) {
      setError('Pilih salah satu program kelas!')
      return
    }

    const isPrestasi = programs.find(p => p.id === formData.program_kelas_id)?.nama_program.toLowerCase().includes('prestasi')
    if (isPrestasi && !formData.fokus_prestasi) {
      setError('Pilih fokus prestasi (Poomsae / Kyorugi)!')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const { error: submitError } = await supabase
        .from('pendaftaran_siswa')
        .insert([
          {
            nama_calon_siswa: formData.nama_calon_siswa,
            tgl_lahir: formData.tgl_lahir,
            tempat_lahir: formData.tempat_lahir || null,
            nama_ortu: formData.nama_ortu,
            no_hp_ortu: formData.no_hp_ortu,
            program_kelas_id: formData.program_kelas_id,
            fokus_prestasi: isPrestasi ? formData.fokus_prestasi : null,
            berat_badan: formData.berat_badan ? Number(formData.berat_badan) : null,
            sabuk_pendaftaran: formData.sabuk_pendaftaran,
            alamat: formData.alamat || null,
          }
        ])

      if (submitError) throw submitError

      setSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat mendaftar.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }))

  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-lg p-8 text-center flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary border-2 border-dark flex items-center justify-center text-4xl shadow-brutal mb-4">
            🎉
          </div>
          <h1 className="text-3xl font-bold font-sans text-dark">Pendaftaran Berhasil!</h1>
          <p className="text-dark/80 font-sans">
            Terima kasih telah mendaftar. Data Anda telah kami terima dengan status <strong>Pending</strong>.
            Admin kami akan segera menghubungi Anda melalui nomor HP yang didaftarkan untuk proses selanjutnya.
          </p>
          <Link href="/">
            <Button variant="secondary" className="mt-4">Kembali ke Beranda</Button>
          </Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <Link href="/">
            <Badge color="secondary" className="mb-6 hover:opacity-80 cursor-pointer">← Kembali</Badge>
          </Link>
          <h1 className="text-4xl font-bold font-sans text-dark">Pendaftaran Siswa Baru</h1>
          <p className="text-dark/80 mt-2 font-sans">Siger Taekwondo Club</p>
        </div>

        <Card className="p-6 md:p-8">
          {error && (
            <div className="mb-6 bg-accent/20 border-2 border-accent text-dark p-4 rounded-xl font-sans text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* ====== DATA CALON SISWA ====== */}
            <div>
              <h2 className="font-bold text-dark text-base mb-4 border-b-2 border-dark/10 pb-2">👤 Data Calon Siswa</h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Nama Lengkap Calon Siswa"
                  value={formData.nama_calon_siswa}
                  onChange={set('nama_calon_siswa')}
                  required
                  placeholder="Masukkan nama lengkap"
                />

                {/* Tempat & Tanggal Lahir */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Tempat Lahir"
                    value={formData.tempat_lahir}
                    onChange={set('tempat_lahir')}
                    placeholder="Kota tempat lahir"
                  />
                  <Input
                    label="Tanggal Lahir"
                    type="date"
                    value={formData.tgl_lahir}
                    onChange={set('tgl_lahir')}
                    required
                  />
                </div>

                {/* Berat Badan */}
                <Input
                  label="Berat Badan (kg)"
                  type="number"
                  min="10"
                  max="200"
                  step="0.1"
                  value={formData.berat_badan}
                  onChange={set('berat_badan')}
                  placeholder="Contoh: 45"
                />

                {/* Sabuk Saat Ini */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-dark text-sm">Sabuk Saat Ini</label>
                  <select
                    className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow"
                    value={formData.sabuk_pendaftaran}
                    onChange={set('sabuk_pendaftaran')}
                  >
                    {SABUK_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <p className="text-xs text-dark/50">Pilih sabuk terakhir yang dimiliki. Jika belum pernah, pilih Putih.</p>
                </div>

                {/* Alamat */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-dark text-sm">Alamat Lengkap</label>
                  <textarea
                    className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow resize-none"
                    rows={3}
                    value={formData.alamat}
                    onChange={set('alamat')}
                    placeholder="Jl. Contoh No. 1, Kelurahan, Kecamatan, Kota/Kabupaten..."
                  />
                </div>
              </div>
            </div>

            {/* ====== DATA ORANG TUA ====== */}
            <div>
              <h2 className="font-bold text-dark text-base mb-4 border-b-2 border-dark/10 pb-2">👨‍👩‍👦 Data Orang Tua / Wali</h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Nama Orang Tua/Wali"
                  value={formData.nama_ortu}
                  onChange={set('nama_ortu')}
                  required
                  placeholder="Masukkan nama orang tua/wali"
                />
                <Input
                  label="Nomor WhatsApp (Aktif)"
                  type="tel"
                  value={formData.no_hp_ortu}
                  onChange={set('no_hp_ortu')}
                  required
                  placeholder="0812xxxxxx"
                />
              </div>
            </div>

            {/* ====== PROGRAM KELAS ====== */}
            <div className="flex flex-col gap-3">
              <h2 className="font-bold text-dark text-base border-b-2 border-dark/10 pb-2">🥋 Pilih Program Kelas</h2>
              {loading ? (
                <div className="p-4 border-2 border-dark border-dashed rounded-2xl text-center text-dark/50">
                  Memuat program kelas...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {programs.map((prog) => (
                    <label
                      key={prog.id}
                      className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col gap-2
                        ${formData.program_kelas_id === prog.id
                          ? 'border-dark bg-secondary/20 shadow-brutal translate-x-[-2px] translate-y-[-2px]'
                          : 'border-dark/30 bg-white hover:border-dark'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="program_kelas"
                        value={prog.id}
                        checked={formData.program_kelas_id === prog.id}
                        onChange={() => setFormData({ ...formData, program_kelas_id: prog.id })}
                        className="hidden"
                      />
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-dark">{prog.nama_program}</h3>
                        <Badge color={formData.program_kelas_id === prog.id ? 'primary' : 'dark'}>
                          {prog.frekuensi_per_minggu}x / minggu
                        </Badge>
                      </div>
                      <p className="text-sm text-dark/70">{prog.deskripsi}</p>
                      <p className="font-bold text-dark mt-2">
                        Rp {prog.biaya_bulanan.toLocaleString('id-ID')} <span className="font-normal text-xs">/ bulan</span>
                      </p>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Fokus Prestasi (conditional) */}
            {(() => {
              const selectedProgram = programs.find(p => p.id === formData.program_kelas_id)
              if (selectedProgram && selectedProgram.nama_program.toLowerCase().includes('prestasi')) {
                return (
                  <div className="flex flex-col gap-3">
                    <label className="font-bold text-dark">Fokus Prestasi <span className="text-accent">*</span></label>
                    <div className="flex gap-4">
                      <label className={`flex-1 cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 ${formData.fokus_prestasi === 'pomsae' ? 'border-dark bg-secondary/20 shadow-brutal translate-x-[-2px] translate-y-[-2px]' : 'border-dark/30 bg-white hover:border-dark'}`}>
                        <input
                          type="radio"
                          name="fokus_prestasi"
                          value="pomsae"
                          checked={formData.fokus_prestasi === 'pomsae'}
                          onChange={() => setFormData({ ...formData, fokus_prestasi: 'pomsae' })}
                          className="hidden"
                          required
                        />
                        <span className="font-bold text-dark">🥋 Poomsae</span>
                      </label>
                      <label className={`flex-1 cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 ${formData.fokus_prestasi === 'kyurugi' ? 'border-dark bg-secondary/20 shadow-brutal translate-x-[-2px] translate-y-[-2px]' : 'border-dark/30 bg-white hover:border-dark'}`}>
                        <input
                          type="radio"
                          name="fokus_prestasi"
                          value="kyurugi"
                          checked={formData.fokus_prestasi === 'kyurugi'}
                          onChange={() => setFormData({ ...formData, fokus_prestasi: 'kyurugi' })}
                          className="hidden"
                          required
                        />
                        <span className="font-bold text-dark">🥊 Kyorugi</span>
                      </label>
                    </div>
                  </div>
                )
              }
              return null
            })()}

            <Button type="submit" variant="primary" disabled={submitting} className="mt-4 py-4 text-lg">
              {submitting ? 'Mengirim Data...' : 'Kirim Pendaftaran'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
