'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { QRCodeSVG } from 'qrcode.react'
import type { KartuAnggota } from '@/lib/types'

const SABUK_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  'Putih': { bg: '#FFFFFF', text: '#1E2A38', accent: '#E5E7EB' },
  'Kuning': { bg: '#FDE68A', text: '#1E2A38', accent: '#FBBF24' },
  'Hijau': { bg: '#BBF7D0', text: '#1E2A38', accent: '#22C55E' },
  'Biru': { bg: '#BFDBFE', text: '#1E2A38', accent: '#3B82F6' },
  'Merah': { bg: '#FECACA', text: '#1E2A38', accent: '#EF4444' },
  'Hitam': { bg: '#1E2A38', text: '#FFFFFF', accent: '#4B5563' },
}

function getSabukColors(sabuk: string) {
  return SABUK_COLORS[sabuk] || SABUK_COLORS['Putih']
}

export default function OrtuKartuPage() {
  const supabase = createClient()

  const [kartu, setKartu] = useState<(KartuAnggota & {
    siswa: { nama: string; sabuk_saat_ini: string; foto_url: string | null; program_kelas: { nama_program: string } | null }
  }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  const fetchKartu = useCallback(async () => {
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

    const { data: kartuData, error: kartuErr } = await supabase
      .from('kartu_anggota')
      .select('*, siswa:siswa_id(nama, sabuk_saat_ini, foto_url, program_kelas:program_kelas_id(nama_program))')
      .eq('siswa_id', profile.siswa_id)
      .single()

    if (kartuErr || !kartuData) {
      setError('Kartu anggota belum diterbitkan. Hubungi admin untuk generate kartu.')
      setLoading(false)
      return
    }

    setKartu(kartuData as typeof kartu)

    // Load foto jika ada
    if (kartuData.siswa?.foto_url) {
      const { data: signedData } = await supabase.storage
        .from('foto-siswa')
        .createSignedUrl(kartuData.siswa.foto_url, 3600)
      if (signedData?.signedUrl) setFotoUrl(signedData.signedUrl)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchKartu() }, [fetchKartu])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <h1 className="text-3xl font-bold font-sans text-dark">🪪 Kartu Anggota Digital</h1>
        <Card className="text-center py-16 text-dark/50 font-sans">Memuat kartu...</Card>
      </div>
    )
  }

  if (error || !kartu) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <h1 className="text-3xl font-bold font-sans text-dark">🪪 Kartu Anggota Digital</h1>
        <Card className="bg-accent/10 border-accent text-center py-16">
          <div className="text-5xl mb-4">🪪</div>
          <p className="font-bold text-dark font-sans">{error || 'Kartu tidak ditemukan'}</p>
          <p className="text-dark/60 font-sans text-sm mt-2">Hubungi admin untuk menerbitkan kartu anggota Anda.</p>
        </Card>
      </div>
    )
  }

  const sabuk = kartu.siswa?.sabuk_saat_ini || 'Putih'
  const colors = getSabukColors(sabuk)
  const isGelap = sabuk === 'Hitam'

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🪪 Kartu Anggota Digital</h1>
        <p className="text-dark/60 font-sans mt-1">Tunjukkan QR code saat latihan atau ujian sabuk</p>
      </div>

      {/* KARTU DIGITAL — Desain seperti kartu fisik */}
      <div className="relative">
        {/* Shadow layer */}
        <div className="absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-2xl bg-dark" />

        {/* Kartu utama */}
        <div
          className="relative border-2 border-dark rounded-2xl overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${colors.bg}, ${colors.bg}DD)` }}
        >
          {/* Header strip */}
          <div className="bg-dark px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                <span className="text-dark font-bold text-[10px]">STC</span>
              </div>
              <span className="text-white font-bold font-sans text-sm tracking-wide">SIGER TAEKWONDO CLUB</span>
            </div>
            <span className={`text-xs font-bold ${kartu.status_aktif ? 'text-primary' : 'text-accent'}`}>
              {kartu.status_aktif ? '● AKTIF' : '● NON-AKTIF'}
            </span>
          </div>

          {/* Body */}
          <div className="p-5 flex gap-5 items-start">
            {/* Foto / Avatar */}
            <div className="shrink-0">
              {fotoUrl ? (
                <img
                  src={fotoUrl}
                  alt="Foto siswa"
                  className="w-20 h-20 rounded-xl border-2 border-dark object-cover shadow-brutal"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dark flex items-center justify-center shadow-brutal"
                  style={{ background: colors.accent }}>
                  <span className="text-3xl">🥋</span>
                </div>
              )}
              {/* Sabuk badge */}
              <div className="mt-2 flex items-center justify-center gap-1.5 px-2 py-1 rounded-full border-2 border-dark"
                style={{ background: colors.accent }}>
                <span className="text-xs font-bold" style={{ color: colors.text }}>
                  Sabuk {sabuk}
                </span>
              </div>
            </div>

            {/* Info utama */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold font-sans leading-tight" style={{ color: colors.text }}>
                {kartu.siswa?.nama || '-'}
              </h2>
              <p className="text-sm font-sans mt-1" style={{ color: isGelap ? '#9CA3AF' : '#4B5563' }}>
                {kartu.siswa?.program_kelas?.nama_program || '-'}
              </p>

              <div className="mt-3 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-sans" style={{ color: isGelap ? '#9CA3AF' : '#6B7280' }}>No. Kartu</span>
                </div>
                <span className="font-bold font-mono text-lg tracking-wider" style={{ color: colors.text }}>
                  {kartu.no_kartu}
                </span>
              </div>
            </div>

            {/* QR Code */}
            <div className="shrink-0">
              <div className="bg-white p-2 rounded-xl border-2 border-dark shadow-brutal">
                <QRCodeSVG
                  value={kartu.qr_code_value}
                  size={80}
                  bgColor="#FFFFFF"
                  fgColor="#1E2A38"
                />
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div className="border-t-2 border-dark/20 px-5 py-3 flex items-center justify-between"
            style={{ background: `${colors.accent}55` }}>
            <span className="text-xs font-sans" style={{ color: isGelap ? '#9CA3AF' : '#6B7280' }}>
              Berlaku selama terdaftar aktif
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: colors.text }}>
              {kartu.tgl_cetak ? new Date(kartu.tgl_cetak + 'T00:00:00').getFullYear() : new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>

      {/* Info Tambahan */}
      <Card className="bg-background">
        <h3 className="font-bold font-sans text-dark mb-3">Informasi Kartu</h3>
        <div className="flex flex-col gap-2 text-sm font-sans">
          {[
            { label: 'Nomor Kartu', val: kartu.no_kartu },
            { label: 'Nama', val: kartu.siswa?.nama || '-' },
            { label: 'Sabuk Saat Ini', val: `Sabuk ${sabuk}` },
            { label: 'Program', val: kartu.siswa?.program_kelas?.nama_program || '-' },
            { label: 'Tgl Dicetak', val: kartu.tgl_cetak ? new Date(kartu.tgl_cetak + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-' },
            { label: 'Status', val: kartu.status_aktif ? 'Aktif' : 'Non-Aktif' },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center border-b border-dark/10 pb-2">
              <span className="text-dark/60">{item.label}</span>
              <span className="font-bold text-dark">{item.val}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
