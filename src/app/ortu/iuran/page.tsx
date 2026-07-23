'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Iuran } from '@/lib/types'

type StatusBayar = 'belum_bayar' | 'menunggu_verifikasi' | 'lunas' | 'ditolak'

const STATUS_CONFIG: Record<StatusBayar, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark'; icon: string; desc: string }> = {
  belum_bayar:          { label: 'Belum Bayar',    color: 'accent',    icon: '⏳', desc: 'Silakan upload bukti transfer' },
  menunggu_verifikasi:  { label: 'Menunggu Verif', color: 'secondary', icon: '🔍', desc: 'Sedang diverifikasi admin' },
  lunas:                { label: 'Lunas',           color: 'primary',   icon: '✅', desc: 'Pembayaran telah dikonfirmasi' },
  ditolak:              { label: 'Ditolak',          color: 'dark',      icon: '❌', desc: 'Bukti transfer ditolak, silakan upload ulang' },
}

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function OrtuIuranPage() {
  const supabase = createClient()

  const [siswaId, setSiswaId] = useState<string | null>(null)
  const [namaSiswa, setNamaSiswa] = useState('')
  const [iuranList, setIuranList] = useState<Iuran[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('siswa_id')
      .eq('id', user.id)
      .single()

    if (!profile?.siswa_id) {
      setError('Akun belum terhubung ke siswa. Hubungi admin.')
      setLoading(false)
      return
    }

    setSiswaId(profile.siswa_id)

    const { data: siswa } = await supabase.from('siswa').select('nama').eq('id', profile.siswa_id).single()
    if (siswa) setNamaSiswa(siswa.nama)

    const { data: iuranData, error: iuranErr } = await supabase
      .from('iuran')
      .select('*')
      .eq('siswa_id', profile.siswa_id)
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false })

    if (!iuranErr) setIuranList((iuranData || []) as Iuran[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUploadBukti = async (iuranId: string, file: File) => {
    if (!siswaId) return
    setUploading(iuranId)
    setError(null)
    setSuccessMsg(null)

    // Upload ke storage bucket
    const ext = file.name.split('.').pop()
    const filePath = `${siswaId}/${iuranId}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('bukti-transfer')
      .upload(filePath, file, { upsert: true })

    if (uploadErr) {
      setError('Gagal upload bukti: ' + uploadErr.message)
      setUploading(null)
      return
    }

    // Update iuran: set bukti_transfer_url + status menunggu_verifikasi
    const { error: updateErr } = await supabase
      .from('iuran')
      .update({
        bukti_transfer_url: filePath,
        status_bayar: 'menunggu_verifikasi',
      })
      .eq('id', iuranId)

    if (updateErr) {
      setError('Gagal update status: ' + updateErr.message)
    } else {
      setSuccessMsg('✅ Bukti transfer berhasil dikirim! Menunggu verifikasi admin.')
      await fetchData()
    }
    setUploading(null)
  }

  const handleFileChange = (iuranId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUploadBukti(iuranId, file)
  }

  // Group by tahun
  const groupedByTahun: Record<number, Iuran[]> = {}
  for (const i of iuranList) {
    if (!groupedByTahun[i.tahun]) groupedByTahun[i.tahun] = []
    groupedByTahun[i.tahun].push(i)
  }
  const sortedTahun = Object.keys(groupedByTahun).map(Number).sort((a, b) => b - a)

  // Statistik bulan ini
  const now = new Date()
  const iuranBulanIni = iuranList.find(i => i.bulan === now.getMonth() + 1 && i.tahun === now.getFullYear())

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">💰 Iuran</h1>
        {namaSiswa && (
          <p className="text-dark/60 font-sans mt-1">
            Tagihan iuran untuk <span className="font-bold text-dark">{namaSiswa}</span>
          </p>
        )}
      </div>

      {error && <Card className="bg-accent/20 border-accent text-dark font-sans">⚠️ {error}</Card>}
      {successMsg && <Card className="bg-primary/20 border-primary text-dark font-bold font-sans">{successMsg}</Card>}

      {/* Status Bulan Ini */}
      {iuranBulanIni && (
        <Card className={`border-2 ${
          iuranBulanIni.status_bayar === 'lunas' ? 'bg-primary/10 border-primary' :
          iuranBulanIni.status_bayar === 'menunggu_verifikasi' ? 'bg-secondary/10 border-secondary' :
          'bg-accent/10 border-accent'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-dark/60 font-sans">Status Iuran Bulan Ini</p>
              <h2 className="text-xl font-bold font-sans text-dark">
                {BULAN_NAMES[now.getMonth() + 1]} {now.getFullYear()}
              </h2>
              <p className="font-bold text-dark mt-1">{formatRupiah(iuranBulanIni.nominal)}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge color={STATUS_CONFIG[iuranBulanIni.status_bayar].color}>
                {STATUS_CONFIG[iuranBulanIni.status_bayar].icon} {STATUS_CONFIG[iuranBulanIni.status_bayar].label}
              </Badge>
              <p className="text-xs text-dark/60 font-sans text-right">
                {STATUS_CONFIG[iuranBulanIni.status_bayar].desc}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Daftar Tagihan */}
      {loading ? (
        <Card className="text-center py-16 text-dark/50 font-sans">Memuat data...</Card>
      ) : iuranList.length === 0 ? (
        <Card className="text-center py-16 text-dark/50 font-sans">
          <div className="text-4xl mb-3">💰</div>
          <p>Belum ada tagihan iuran.</p>
        </Card>
      ) : (
        sortedTahun.map(tahun => (
          <div key={tahun} className="flex flex-col gap-3">
            <h2 className="font-bold font-sans text-dark text-lg border-b-2 border-dark pb-2">📅 {tahun}</h2>
            {groupedByTahun[tahun].map(iuran => {
              const cfg = STATUS_CONFIG[iuran.status_bayar]
              const canUpload = iuran.status_bayar === 'belum_bayar' || iuran.status_bayar === 'ditolak'
              const isUploading = uploading === iuran.id

              return (
                <Card key={iuran.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold font-sans text-dark">{BULAN_NAMES[iuran.bulan]}</h3>
                        <Badge color={cfg.color}>{cfg.icon} {cfg.label}</Badge>
                      </div>
                      <p className="text-lg font-bold font-sans text-dark mt-1">{formatRupiah(iuran.nominal)}</p>
                      {iuran.tgl_bayar && (
                        <p className="text-sm text-dark/60 font-sans">
                          Dibayar: {new Date(iuran.tgl_bayar).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                          {iuran.metode ? ` · ${iuran.metode}` : ''}
                        </p>
                      )}
                      {iuran.catatan && (
                        <p className="text-sm text-accent font-sans mt-1 font-bold">📝 {iuran.catatan}</p>
                      )}
                    </div>
                  </div>

                  {/* Upload Bukti Transfer */}
                  {canUpload && (
                    <div className="border-t-2 border-dark/10 pt-3 flex flex-col gap-2">
                      <p className="text-sm font-sans text-dark/70">
                        {iuran.status_bayar === 'ditolak'
                          ? '⚠️ Bukti sebelumnya ditolak. Silakan upload ulang.'
                          : '📎 Upload bukti transfer untuk konfirmasi pembayaran'}
                      </p>
                      <input
                        ref={el => { fileInputRefs.current[iuran.id] = el }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={e => handleFileChange(iuran.id, e)}
                      />
                      <Button
                        variant={iuran.status_bayar === 'ditolak' ? 'accent' : 'secondary'}
                        onClick={() => fileInputRefs.current[iuran.id]?.click()}
                        disabled={isUploading}
                        className="w-full"
                      >
                        {isUploading ? '⏳ Mengupload...' : '📤 Upload Bukti Transfer'}
                      </Button>
                    </div>
                  )}

                  {iuran.status_bayar === 'menunggu_verifikasi' && iuran.bukti_transfer_url && (
                    <div className="border-t-2 border-dark/10 pt-3">
                      <p className="text-sm font-sans text-dark/60">✅ Bukti transfer sudah dikirim, menunggu verifikasi admin.</p>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
